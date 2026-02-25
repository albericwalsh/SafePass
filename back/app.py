
from flask import Flask, send_file, jsonify, request, Response
from io import StringIO, BytesIO
import csv
import json
import os
import copy
from flask_cors import CORS
from cryptography.fernet import Fernet
from back import log
import secrets
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

from back.detect import byUrl
from back.crypting.crypt_file import crypt, cryptData
from back.crypting.decrypt_file import decryptByPath, decryptData
import requests

app = Flask(__name__)
PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, 'public')

# -----------------------------------------------------------------------------
# Runtime settings (loaded from data/settings.json)
# -----------------------------------------------------------------------------
SETTINGS = {}
key = None
cipher_suite = None


def _default_settings_template(system_paths: dict | None = None):
    sp = system_paths or {}
    data_path = sp.get('data_file_path') or ""
    backup_location = sp.get('backups_dir') or ""
    token_path = sp.get('master_token_path') or ""
    ext_token_path = sp.get('extension_token_path') or ""
    log_dir = sp.get('logs_dir') or ""
    return {
        "display": {
            "theme": "dark"
        },
        "general": {
            "auto_update_check": False,
            "debug_mode": False,
            "detect_enabled": True,
            "items_per_page": 20,
            "language": "en",
            "open_front_on_start": True,
            "start_on_boot": True
        },
        "security": {
            "auto_lock_minutes": 5,
            "master_password_enabled": False,
            "password_blacklist": [],
            "password_history_length": 5,
            "password_min_length": 12,
            "require_lowercase": True,
            "require_numbers": True,
            "require_password_on_export": False,
            "require_symbols": True,
            "require_uppercase": True,
            "strength_threshold_orange": 45,
            "strength_threshold_red": 20,
            "strength_threshold_yellow": 75
        },
        "storage": {
            "data_path": data_path,
            "token_path": token_path,
            "backup_enabled": True,
            "backup_interval_days": 7,
            "backup_location": backup_location,
            "backup_history_count": 20,
            "extension_token_path": ext_token_path,
        },
        "advanced": {
                "log_dir": log_dir,
            "max_size_mb": 1,
            "retention_days": 15,
            "to_file": True,
            "log_level": "INFO"
        }
    }


def normalize_settings_for_persist(settings_obj):
    """Force persisted settings to project schema while filling required system paths."""
    sp = get_system_paths()
    defaults = _default_settings_template(sp)
    src = settings_obj if isinstance(settings_obj, dict) else {}

    out = copy.deepcopy(defaults)

    for section in ('display', 'general', 'security', 'storage', 'advanced'):
        if not isinstance(src.get(section), dict):
            continue
        for key in out[section].keys():
            if key in src[section]:
                out[section][key] = src[section][key]

    legacy_map = {
        'language': ('general', 'language'),
        'start_on_boot': ('general', 'start_on_boot'),
        'auto_update_check': ('general', 'auto_update_check'),
        'open_front_on_start': ('general', 'open_front_on_start'),
        'items_per_page': ('general', 'items_per_page'),
        'debug_mode': ('general', 'debug_mode'),
        'detect_enabled': ('general', 'detect_enabled'),
        'theme': ('display', 'theme'),
        'master_password_enabled': ('security', 'master_password_enabled'),
        'auto_lock_minutes': ('security', 'auto_lock_minutes'),
        'require_password_on_export': ('security', 'require_password_on_export'),
        'data_path': ('storage', 'data_path'),
        'backup_location': ('storage', 'backup_location'),
        'backup_enabled': ('storage', 'backup_enabled'),
        'backup_interval_days': ('storage', 'backup_interval_days'),
        'backup_history_count': ('storage', 'backup_history_count'),
        'token_path': ('storage', 'token_path'),
        'log_level': ('advanced', 'log_level'),
    }
    for old_key, target in legacy_map.items():
        if old_key in src:
            sec, key = target
            out[sec][key] = src[old_key]

    # if not out['storage'].get('data_path'):
    #     out['storage']['data_path'] = sp['data_file_path']
    # if not out['storage'].get('token_path'):
    #     out['storage']['token_path'] = sp['master_token_path']
    if not out['storage'].get('backup_location'):
        out['storage']['backup_location'] = sp['backups_dir']
    if not out['storage'].get('extension_token_path'):
        out['storage']['extension_token_path'] = sp['extension_token_path']

    try:
        current_log_dir = out['advanced'].get('log_dir')
        old_default_log_dir = os.path.join(sp['root_dir'], 'logs')
        if (not current_log_dir) or (os.path.normpath(str(current_log_dir)) == os.path.normpath(old_default_log_dir)):
            out['advanced']['log_dir'] = sp['logs_dir']
    except Exception:
        out['advanced']['log_dir'] = sp['logs_dir']

    return out


def get_system_paths():
    """Return canonical system paths for SafePass runtime data."""
    appdata = os.getenv('APPDATA') or os.getenv('LOCALAPPDATA')
    if not appdata:
        appdata = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming')

    root_dir = os.path.normpath(os.path.join(appdata, 'SafePass'))
    data_dir = os.path.join(root_dir, 'data')
    backups_dir = os.path.join(root_dir, 'backup')
    cache_dir = os.path.join(root_dir, 'cache')

    return {
        'root_dir': root_dir,
        'settings_path': os.path.join(root_dir, 'settings.json'),
        'data_dir': data_dir,
        'backups_dir': backups_dir,
        'cache_dir': cache_dir,
        'extension_token_path': os.path.join(data_dir, 'extention_token.json'),
        'extension_token_legacy_path': os.path.join(data_dir, 'extension_token.json'),
        'master_token_path': os.path.join(data_dir, 'mdp.token'),
        'master_hash_path': os.path.join(data_dir, '.master_password.json'),
        'data_file_path': os.path.join(data_dir, 'mdp.sfpss'),
        # legacy compatibility locations (read fallback only)
        'legacy_settings_path': os.path.join(PROJECT_ROOT, 'data', 'settings.json'),
        'legacy_data_dir': os.path.join(PROJECT_ROOT, 'data'),
            'logs_dir': os.path.normpath(os.path.join(appdata, 'SafePasse', 'logs')),
    }


def _read_json_file(path):
    try:
        if path and os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        return None
    return None


def _merge_dict(dst, src):
    if not isinstance(dst, dict):
        dst = {}
    if not isinstance(src, dict):
        return dst
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            dst[k] = _merge_dict(dst.get(k, {}), v)
        else:
            dst[k] = v
    return dst


def get_nested(obj, path):
    """Retrieve a value from a nested dictionary using dot-notation path (e.g. 'security.master_password_configured')."""
    if not isinstance(obj, dict) or not isinstance(path, str):
        return None
    keys = path.split('.')
    current = obj
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        else:
            return None
    return current


def _normalize_storage_paths(settings_obj):
    """Ensure critical storage paths are never empty."""
    return normalize_settings_for_persist(settings_obj)


def ensure_system_tree():
    """Ensure canonical SafePass system tree exists in AppData and seed defaults."""
    sp = get_system_paths()

    os.makedirs(sp['root_dir'], exist_ok=True)
    os.makedirs(sp['backups_dir'], exist_ok=True)
    os.makedirs(sp['cache_dir'], exist_ok=True)
    os.makedirs(sp['data_dir'], exist_ok=True)
    os.makedirs(sp['logs_dir'], exist_ok=True)

    defaults = _default_settings_template(sp)

    settings_path = sp['settings_path']
    if not os.path.exists(settings_path):
        seed = _read_json_file(sp.get('legacy_settings_path'))
        merged = _merge_dict(copy.deepcopy(defaults), seed if isinstance(seed, dict) else {})
        merged = normalize_settings_for_persist(merged)
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
    else:
        current = _read_json_file(settings_path)
        if isinstance(current, dict):
            normalized = normalize_settings_for_persist(current)
            if normalized != current:
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(normalized, f, ensure_ascii=False, indent=2)

    if not os.path.exists(sp['extension_token_path']):
        with open(sp['extension_token_path'], 'w', encoding='utf-8') as f:
            json.dump({'token': None, 'expires_at': None}, f, ensure_ascii=False, indent=2)

    if not os.path.exists(sp['extension_token_legacy_path']):
        with open(sp['extension_token_legacy_path'], 'w', encoding='utf-8') as f:
            json.dump({'token': None, 'expires_at': None}, f, ensure_ascii=False, indent=2)

    # if not os.path.exists(sp['master_token_path']):
    #     with open(sp['master_token_path'], 'wb') as f:
    #         f.write(Fernet.generate_key())

    return sp


SYSTEM_PATHS = ensure_system_tree()

def load_app_settings():
    global SETTINGS
    settings_path = get_system_paths()['settings_path']
    defaults = _default_settings_template(get_system_paths())
    data = None
    try:
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                orig_data = data
                # Prefer nested settings structure (e.g. security.*, general.*, storage.*, display.*, advanced)
                # Build a flattened view that overlays top-level and nested categories
                def make_flattened(orig):
                    flat = {}
                    # start from top-level keys present in the file
                    if isinstance(orig, dict):
                        for k, v in orig.items():
                            if not isinstance(v, dict):
                                flat[k] = v
                    # overlay known nested sections in order of precedence
                    for sec in ('general', 'security', 'storage', 'display', 'advanced'):
                        try:
                            secv = orig.get(sec) if isinstance(orig, dict) else None
                            if isinstance(secv, dict):
                                for k, v in secv.items():
                                    flat[k] = v
                        except Exception:
                            pass
                    return flat

                mapping = {
                    "language": "general.language",
                    "start_on_boot": "general.start_on_boot",
                    "auto_update_check": "general.auto_update_check",
                    "open_front_on_start": "general.open_front_on_start",
                    "master_password_enabled": "security.master_password_enabled",
                    "auto_lock_minutes": "security.auto_lock_minutes",
                    "enable_biometric": "security.enable_biometric",
                    "require_password_on_export": "security.require_password_on_export",
                    "encryption_algorithm": "security.encryption_algorithm",
                    "data_path": "storage.data_path",
                    "backup_enabled": "storage.backup_enabled",
                    "backup_interval_days": "storage.backup_interval_days",
                    "backup_location": "storage.backup_location",
                    "sync_enabled": "storage.sync_enabled",
                    "sync_provider": "storage.sync_provider",
                    "export_format_default": "general.export_format_default",
                    "theme": "display.theme",
                    "items_per_page": "general.items_per_page",
                    "show_password_strength_meter": "security.show_password_strength_meter",
                    "confirm_before_delete": "general.confirm_before_delete",
                    "server_host": "general.server_host",
                    "server_port": "general.server_port",
                    "allow_remote_connections": "general.allow_remote_connections",
                    "cors_allowed_origins": "general.cors_allowed_origins",
                    "debug_mode": "general.debug_mode",
                    "log_level": "general.log_level",
                    "detect_enabled": "general.detect_enabled"
                }

                # Build final settings starting from defaults and override with values
                # found in the file (top-level and nested sections). We create a
                # flattened view of the file that gives precedence to nested
                # sections so users can store values under `advanced`, `general`,
                # etc. and still have them picked up by the runtime.
                flat = make_flattened(orig_data)
                final = dict(defaults)
                for k in final.keys():
                    if k in flat:
                        final[k] = flat[k]
                # also apply mapping for any remaining mapped keys if present in flat
                for k, path in mapping.items():
                    if k in flat:
                        final[k] = flat[k]

                # Also mirror master_password_configured if present under security
                mconf = get_nested(data, 'security.master_password_configured')
                if mconf is not None:
                    final['master_password_configured'] = bool(mconf)

                # Preserve nested blocks so other code can read storage.token_path, etc.
                try:
                    final['storage'] = orig_data.get('storage', {}) if isinstance(orig_data, dict) else {}
                    final['security'] = orig_data.get('security', {}) if isinstance(orig_data, dict) else {}
                    final['general'] = orig_data.get('general', {}) if isinstance(orig_data, dict) else {}
                    final['display'] = orig_data.get('display', {}) if isinstance(orig_data, dict) else {}
                    # prefer explicit `advanced` section; fall back to legacy `logs` if present
                    try:
                        if isinstance(orig_data, dict) and 'advanced' in orig_data:
                            final['advanced'] = orig_data.get('advanced', {}) if isinstance(orig_data.get('advanced'), dict) else {}
                        else:
                            final['advanced'] = orig_data.get('logs', {}) if isinstance(orig_data.get('logs'), dict) else {}
                    except Exception:
                        final['advanced'] = {}
                except Exception:
                    pass

                data = final
    except Exception:
        pass
    # Use parsed/flattened data if available, otherwise fall back to defaults
    if data is not None and isinstance(data, dict):
        SETTINGS = _normalize_storage_paths(data)
    else:
        SETTINGS = _normalize_storage_paths(defaults)

# load settings early
try:
    load_app_settings()
except Exception:
    SETTINGS = {}


# -----------------------------------------------------------------------------
# Master password storage (separate file)
# -----------------------------------------------------------------------------
MASTER_PASSWORD_HASH = None

def _master_password_paths():
    sp = get_system_paths()
    return [
        sp['master_hash_path'],
        os.path.join(sp['data_dir'], 'master_password.json'),
        os.path.join(PROJECT_ROOT, 'data', '.master_password.json'),
        os.path.join(PROJECT_ROOT, 'data', 'master_password.json'),
    ]

def load_master_password():
    """Load master password hash from a separate file and set runtime value."""
    global MASTER_PASSWORD_HASH
    import os
    for p in _master_password_paths():
        try:
            if not os.path.exists(p):
                continue
            with open(p, 'r', encoding='utf-8') as f:
                data = json.load(f)
            h = data.get('master_password_hash') if isinstance(data, dict) else None
            MASTER_PASSWORD_HASH = h
            # mirror into SETTINGS for code compatibility
            try:
                SETTINGS['master_password_hash'] = h
            except Exception:
                pass
            log.info(f'Master password loaded from {p}')
            return
        except Exception:
            continue
    MASTER_PASSWORD_HASH = None
    try:
        SETTINGS.pop('master_password_hash', None)
    except Exception:
        pass


def save_master_password(hash_value: str | None):
    """Save (or remove) the master password hash to a dedicated file.

    If `hash_value` is None the file is removed/cleared and runtime value updated.
    """
    import os
    dir_path = get_system_paths()['data_dir']
    os.makedirs(dir_path, exist_ok=True)
    primary = _master_password_paths()[0]
    if hash_value is None:
        try:
            if os.path.exists(primary):
                os.remove(primary)
        except Exception:
            pass
        global MASTER_PASSWORD_HASH
        MASTER_PASSWORD_HASH = None
        try:
            SETTINGS.pop('master_password_hash', None)
        except Exception:
            pass
        return
    payload = {'master_password_hash': hash_value}
    try:
        with open(primary, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        MASTER_PASSWORD_HASH = hash_value
        try:
            SETTINGS['master_password_hash'] = hash_value
        except Exception:
            pass
        log.info(f'Master password saved to {primary}')
    except Exception as e:
        log.error('Failed to save master password file: ' + str(e))
        raise

# load master password after settings
try:
    load_master_password()
except Exception:
    MASTER_PASSWORD_HASH = None


# -----------------------------------------------------------------------------
# Session token helpers (for frontend "remember me" session)
# -----------------------------------------------------------------------------
def generate_session_token(expiry_minutes: int = 60 * 24):
    """Generate a Fernet-encrypted session token valid for `expiry_minutes` minutes."""
    try:
        from cryptography.fernet import Fernet
        import time, secrets, json
        if key is None:
            raise RuntimeError('Encryption key not initialized')
        f = Fernet(key)
        now = int(time.time())
        payload = {'iat': now, 'exp': now + int(expiry_minutes) * 60, 'nonce': secrets.token_urlsafe(8)}
        token = f.encrypt(json.dumps(payload).encode('utf-8'))
        return token.decode('utf-8')
    except Exception as e:
        log.error('generate_session_token error: ' + str(e))
        return None


def verify_session_token(token: str) -> bool:
    """Verify token created by generate_session_token; return True if valid and not expired."""
    try:
        from cryptography.fernet import Fernet
        import time, json
        if not token:
            return False
        if key is None:
            return False
        f = Fernet(key)
        # decrypt will raise if invalid or expired when ttl used, but we check exp manually
        raw = f.decrypt(token.encode('utf-8'))
        obj = json.loads(raw.decode('utf-8'))
        exp = int(obj.get('exp', 0))
        now = int(time.time())
        return now <= exp
    except Exception:
        return False

# Configure CORS according to settings (fallback to permissive if not set)
CORS(app, resources={r"/*": {"origins": SETTINGS.get('cors_allowed_origins', '*')}})

# Ensure common dev origins are accepted: add 127.0.0.1 if localhost present
try:
    cors_origins = SETTINGS.get('cors_allowed_origins')
    if isinstance(cors_origins, list):
        # if localhost:3000 present but 127.0.0.1:3000 missing, add it
        addrs = set(cors_origins)
        if any('localhost:3000' in s for s in addrs) and not any('127.0.0.1:3000' in s for s in addrs):
            addrs.add('http://127.0.0.1:3000')
        # update CORS with augmented list
        CORS(app, resources={r"/*": {"origins": list(addrs)}})
    else:
        # fallback: permissive
        CORS(app, resources={r"/*": {"origins": cors_origins or '*'}})
except Exception:
    CORS(app, resources={r"/*": {"origins": '*'}})

# Apply log level from settings if available
try:
    log.set_level(SETTINGS.get('log_level', 'INFO'))
except Exception:
    pass

# -----------------------------------------------------------------------------
# Initialisation du logging (UNE SEULE FOIS)
# Use runtime settings to configure log file, rotation and retention
# -----------------------------------------------------------------------------
try:
    adv = SETTINGS.get('advanced') if isinstance(SETTINGS, dict) else {}
    # log file path: prefer advanced.log_dir, then storage.log_file_path, then legacy
    log_file_path = None
    try:
        if isinstance(adv, dict):
            log_file_path = adv.get('log_dir')
    except Exception:
        log_file_path = None
    if not log_file_path:
        try:
            log_file_path = SETTINGS.get('storage', {}).get('log_file_path') or SETTINGS.get('log_file_path')
        except Exception:
            log_file_path = None
    if not log_file_path:
        try:
            log_file_path = get_system_paths()['logs_dir']
        except Exception:
            log_file_path = None

    # whether to write to file
    try:
        log_to_file = bool(adv.get('to_file')) if isinstance(adv, dict) else False
    except Exception:
        log_to_file = False
    if not log_to_file:
        try:
            log_to_file = bool(SETTINGS.get('storage', {}).get('log_to_file') or SETTINGS.get('log_to_file'))
        except Exception:
            log_to_file = False

    # size and retention
    try:
        max_log_size = int(adv.get('max_size_mb', 0)) if isinstance(adv, dict) and adv.get('max_size_mb') is not None else None
    except Exception:
        max_log_size = None
    if not max_log_size:
        try:
            max_log_size = int(SETTINGS.get('storage', {}).get('max_log_size_mb') or SETTINGS.get('max_log_size_mb') or 5)
        except Exception:
            max_log_size = 5

    try:
        retention = int(adv.get('retention_days', 0)) if isinstance(adv, dict) and adv.get('retention_days') is not None else None
    except Exception:
        retention = None
    if not retention:
        try:
            retention = int(SETTINGS.get('storage', {}).get('log_retention_days') or SETTINGS.get('log_retention_days') or 30)
        except Exception:
            retention = 30

    # ensure sensible defaults
    if max_log_size is None:
        max_log_size = 5
    if retention is None:
        retention = 30
    # initialize the logging subsystem
    try:
        log.initialize(
            app_name='flask_api',
            file_path=log_file_path,
            to_file=log_to_file,
            max_size_mb=max_log_size,
            retention_days=retention,
            settings_path=get_system_paths()['settings_path'],
        )
    except Exception:
        pass
except Exception:
    pass

# Load optional extension token (JSON with value and expiry) for extension<>app communication
EXT_TOKEN = None
EXT_TOKEN_INFO = None
def _ext_token_paths(): 
    sp = get_system_paths()
    return [
        sp['extension_token_path'],
        sp['extension_token_legacy_path'],
        os.path.join(PROJECT_ROOT, 'data', 'extension_token.json'),
    ]

def load_extension_token():
    global EXT_TOKEN, EXT_TOKEN_INFO
    import os
    for p in _ext_token_paths():
        try:
            if not os.path.exists(p):
                continue
            with open(p, 'r', encoding='utf-8') as f:
                data = json.load(f) if p.lower().endswith('.json') else {'token': f.read().strip(), 'expires_at': None}
            token = data.get('token')
            expires_at = data.get('expires_at')
            # validate expiry
            if expires_at:
                try:
                    exp = datetime.fromisoformat(expires_at)
                    if exp < datetime.utcnow():
                        log.info(f'Extension token in {p} is expired')
                        EXT_TOKEN = None
                        EXT_TOKEN_INFO = None
                        return
                except Exception:
                    pass
            EXT_TOKEN = token
            EXT_TOKEN_INFO = data
            log.info(f'Extension token loaded from {p}')
            return
        except Exception:
            continue
    log.info('No extension token configured; extension requests will be accepted without token')

def save_extension_token(token_value, expires_at_iso):
    sp = get_system_paths()
    dir_path = sp['data_dir']
    json_path = sp['extension_token_path']
    payload = {'token': token_value, 'expires_at': expires_at_iso}
    os.makedirs(dir_path, exist_ok=True)
    try:
        # write canonical JSON file
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        # write legacy compatible JSON file
        with open(sp['extension_token_legacy_path'], 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        log.info(f'Extension token saved to {json_path}')
    except Exception as e:
        log.error('Failed to save extension token files: ' + str(e))
        raise
    # update runtime
    load_extension_token()

# try load at startup
try:
    load_extension_token()
except Exception:
    EXT_TOKEN = None
    EXT_TOKEN_INFO = None


# -----------------------------------------------------------------------------
# Encryption key loader
# -----------------------------------------------------------------------------
def _encryption_key_paths():
    # prefer configured token_path, then token files near configured data_path,
    # then canonical AppData token, then legacy tokens
    paths = []

    def _add(path_value):
        if not path_value:
            return
        p = str(path_value).strip()
        if not p:
            return
        if p not in paths:
            paths.append(p)

    try:
        tp = SETTINGS.get('storage', {}).get('token_path') if isinstance(SETTINGS, dict) else None
        _add(tp)
    except Exception:
        pass

    try:
        dp = None
        if isinstance(SETTINGS, dict):
            storage_cfg = SETTINGS.get('storage') if isinstance(SETTINGS.get('storage'), dict) else None
            if storage_cfg:
                dp = storage_cfg.get('data_path')
            if not dp:
                dp = SETTINGS.get('data_path')

        if dp:
            sp = get_system_paths()
            data_path = str(dp).strip()
            if data_path and not os.path.isabs(data_path):
                data_path = os.path.normpath(os.path.join(sp['root_dir'], data_path))

            if data_path.lower().endswith('.sfpss'):
                data_dir = os.path.dirname(data_path)
                data_base = os.path.splitext(os.path.basename(data_path))[0]
                _add(os.path.join(data_dir, f'{data_base}.token'))
                _add(os.path.join(data_dir, 'mdp.token'))
                _add(os.path.join(data_dir, '.token'))
    except Exception:
        pass

    sp = get_system_paths()
    _add(sp['master_token_path'])
    _add(os.path.join(sp['data_dir'], 'mdp.token'))
    _add(os.path.join(PROJECT_ROOT, 'data', '.token'))
    _add(os.path.join(PROJECT_ROOT, 'data', 'mdp.token'))
    return paths


def load_encryption_key():
    """Attempt to load Fernet key from configured token file or data/.token."""
    global key
    import os
    from cryptography.fernet import Fernet

    sp = get_system_paths()

    candidate_data_paths = []
    try:
        dp = None
        if isinstance(SETTINGS, dict):
            storage_cfg = SETTINGS.get('storage') if isinstance(SETTINGS.get('storage'), dict) else None
            if storage_cfg:
                dp = storage_cfg.get('data_path')
            if not dp:
                dp = SETTINGS.get('data_path')
        if dp:
            if not os.path.isabs(dp):
                dp = os.path.normpath(os.path.join(sp['root_dir'], dp))
            candidate_data_paths.append(dp)
    except Exception:
        pass

    candidate_data_paths.extend([
        sp.get('data_file_path'),
        os.path.join(PROJECT_ROOT, 'data', 'data_encrypted.sfpss'),
        os.path.join(PROJECT_ROOT, 'data', 'mdp.sfpss'),
    ])

    seen_data = set()
    existing_data_paths = []
    for path_value in candidate_data_paths:
        if not path_value:
            continue
        p = os.path.normpath(str(path_value))
        if p in seen_data:
            continue
        seen_data.add(p)
        if os.path.exists(p):
            existing_data_paths.append(p)

    def _candidate_works_for_data(candidate_key):
        if not existing_data_paths:
            return True
        for data_path in existing_data_paths:
            try:
                with open(data_path, 'rb') as encrypted_file:
                    encrypted_payload = encrypted_file.read()
                cipher = Fernet(candidate_key)
                decrypted = cipher.decrypt(encrypted_payload)
                json.loads(decrypted.decode('utf-8'))
                log.info(f'Clé validée par déchiffrement de: {data_path}')
                return True
            except Exception:
                continue
        return False

    first_valid_key = None
    first_valid_source = None

    for p in _encryption_key_paths():
        try:
            if not p:
                continue
            log.info(f'Tentative de lecture depuis: {p}')
            if not os.path.exists(p):
                continue
            # read raw bytes
            with open(p, 'rb') as f:
                raw = f.read().strip()
            if not raw:
                continue
            # try as bytes first
            try:
                Fernet(raw)
                candidate = raw
            except Exception:
                # try decode as text
                try:
                    s = raw.decode('utf-8').strip()
                    Fernet(s)
                    candidate = s
                except Exception as e:
                    log.error(f'Error reading key file: {e}')
                    continue

            if first_valid_key is None:
                first_valid_key = candidate
                first_valid_source = p

            if _candidate_works_for_data(candidate):
                key = candidate
                log.info(f'Clé de chiffrement chargée depuis: {p}')
                return

            log.warning(f'Clé non compatible avec les données existantes, ignorée: {p}')
        except Exception as e:
            log.error(f'Error reading key file: {e}')
            continue

    if first_valid_key is not None:
        key = first_valid_key
        log.warning(f'Aucune clé ne déchiffre les données existantes; fallback sur la première clé valide: {first_valid_source}')
        return

    log.info('No encryption key found; continuing without key (data encrypted operations will fail)')


# try load encryption key at startup
try:
    load_encryption_key()
except Exception:
    key = None

# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------


def get_data_paths():
    """Return ordered list of data paths to try, preferring configured `data_path`."""
    sp = get_system_paths()
    paths = []

    def _is_sfpss_path(path_value):
        return isinstance(path_value, str) and path_value.strip().lower().endswith('.sfpss')

    # prefer nested storage.data_path if configured
    dp = None
    try:
        storage_cfg = SETTINGS.get('storage') if isinstance(SETTINGS, dict) else None
        if storage_cfg and isinstance(storage_cfg, dict):
            dp = storage_cfg.get('data_path')
    except Exception:
        dp = None
    if not dp:
        dp = SETTINGS.get('data_path') if isinstance(SETTINGS, dict) else None
    if dp:
        if not os.path.isabs(dp):
            dp = os.path.normpath(os.path.join(sp['root_dir'], dp))
        if _is_sfpss_path(dp):
            return [dp]
        log.warning(f"Configured data path ignored because extension is not .sfpss: {dp}")

    canonical_path = sp['data_file_path']
    if _is_sfpss_path(canonical_path):
        return [canonical_path]

    log.warning(f"Canonical data path ignored because extension is not .sfpss: {canonical_path}")
    return []
    # Deduplicate while preserving order
    seen = set(); out = []
    for p in paths:
        if p not in seen:
            seen.add(p); out.append(p)
    return out


def write_app_settings(settings_obj: dict):
    try:
        if not isinstance(settings_obj, dict):
            settings_obj = {}

        settings_obj = _normalize_storage_paths(settings_obj)

        # Normalize `detect_enabled` into `general`
        try:
            if 'detect_enabled' in settings_obj:
                val = settings_obj.pop('detect_enabled')
                if 'general' not in settings_obj or not isinstance(settings_obj['general'], dict):
                    settings_obj['general'] = {}
                settings_obj['general']['detect_enabled'] = bool(val)
            # also move if present under storage
            if isinstance(settings_obj.get('storage'), dict) and 'detect_enabled' in settings_obj['storage']:
                try:
                    settings_obj['general'] = settings_obj.get('general', {}) if isinstance(settings_obj.get('general'), dict) else {}
                    settings_obj['general']['detect_enabled'] = bool(settings_obj['storage'].pop('detect_enabled'))
                except Exception:
                    pass
        except Exception:
            pass

        # Consolidate log settings into `advanced` section
        try:
            advanced = settings_obj.get('advanced') if isinstance(settings_obj.get('advanced'), dict) else {}
            # ensure advanced is always a dict
            if not isinstance(advanced, dict):
                advanced = {}
            # gather legacy keys from top-level
            for kmap in (('log_file_path', 'log_dir'), ('log_to_file', 'to_file'), ('max_log_size_mb', 'max_size_mb'), ('log_retention_days', 'retention_days'), ('log_level', 'log_level')):
                old, new = kmap
                if old in settings_obj and new not in advanced:
                    try:
                        advanced[new] = settings_obj.pop(old)
                    except Exception:
                        pass
            # gather legacy keys from storage
            if isinstance(settings_obj.get('storage'), dict):
                storage = settings_obj['storage']
                for kmap in (('log_file_path', 'log_dir'), ('log_to_file', 'to_file'), ('max_log_size_mb', 'max_size_mb'), ('log_retention_days', 'retention_days'), ('log_level', 'log_level')):
                    old, new = kmap
                    if old in storage and new not in advanced:
                        try:
                            advanced[new] = storage.pop(old)
                        except Exception:
                            pass

            # apply sensible defaults
            if 'log_dir' not in advanced:
                advanced['log_dir'] = get_system_paths()['logs_dir']
            if 'to_file' not in advanced:
                advanced['to_file'] = True
            if 'max_size_mb' not in advanced:
                advanced['max_size_mb'] = 5
            if 'retention_days' not in advanced:
                advanced['retention_days'] = 30
            # ensure log_level also present
            if 'log_level' not in advanced:
                lv = None
                if isinstance(settings_obj.get('general'), dict):
                    lv = settings_obj['general'].get('log_level')
                if not lv:
                    lv = settings_obj.get('log_level')
                advanced['log_level'] = lv or 'INFO'

            settings_obj['advanced'] = advanced
        except Exception:
            pass

        sp = get_system_paths()
        settings_path = sp['settings_path']
        os.makedirs(sp['root_dir'], exist_ok=True)
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings_obj, f, ensure_ascii=False, indent=2)
    except Exception:
        # best-effort write; on failure, raise so callers can handle
        raise




# extension token routes moved to routes/extension_routes.py


@app.route('/', methods=['GET'])
def serve_front_index():
    index_path = os.path.join(PUBLIC_DIR, 'index.html')
    if os.path.isfile(index_path):
        return send_file(index_path)
    return jsonify({'error': 'frontend unavailable'}), 404


@app.route('/<path:asset_path>', methods=['GET'])
def serve_front_asset(asset_path):
    file_path = os.path.normpath(os.path.join(PUBLIC_DIR, asset_path))
    if not file_path.startswith(os.path.normpath(PUBLIC_DIR)):
        return jsonify({'error': 'invalid path'}), 400

    if os.path.isfile(file_path):
        return send_file(file_path)

    return jsonify({'error': 'not found'}), 404

try:
    # register modular routes from routes/ package
    from back.routes import router
    router.register_routes(app)
except Exception as e:
    log.error(f'Failed to register modular routes: {e}')


# -----------------------------------------------------------------------------
# Lancement application
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    try:
        # respect settings for host/port/debug
        host = SETTINGS.get('server_host', '127.0.0.1')
        port = int(SETTINGS.get('server_port', 5000) or 5000)
        if SETTINGS.get('allow_remote_connections'):
            host = '0.0.0.0'
        debug_flag = bool(SETTINGS.get('debug_mode', False))
        log.info(f"Lancement du serveur Flask (host={host} port={port} debug={debug_flag})")
        app.run(host=host, port=port, debug=debug_flag)
    except Exception as e:
        log.critical("Erreur critique au lancement du serveur", e)


def run():
    # respect settings when launching via run()
    host = SETTINGS.get('server_host', '127.0.0.1')
    port = int(SETTINGS.get('server_port', 5000) or 5000)
    if SETTINGS.get('allow_remote_connections'):
        host = '0.0.0.0'
    debug_flag = bool(SETTINGS.get('debug_mode', False))
    log.info(f"Lancement via fonction run() (host={host} port={port} debug={debug_flag})")
    app.run(host=host, port=port, debug=debug_flag)
