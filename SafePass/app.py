
from flask import Flask, send_file, jsonify, request, Response
from io import StringIO, BytesIO
import csv
import json
from flask_cors import CORS
from cryptography.fernet import Fernet
import log
import secrets
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

from back.detect import byUrl
from back.crypting.crypt_file import crypt, cryptData
from back.crypting.decrypt_file import decryptByPath, decryptData
import requests

app = Flask(__name__)

# -----------------------------------------------------------------------------
# Runtime settings (loaded from data/settings.json)
# -----------------------------------------------------------------------------
SETTINGS = {}
key = None
cipher_suite = None

def load_app_settings():
    global SETTINGS
    import os
    settings_path = os.path.join(os.path.dirname(__file__), 'data', 'settings.json')
    defaults = {
        "language": "fr",
        "start_on_boot": False,
        "auto_update_check": False,
        "open_front_on_start": True,
        "master_password_enabled": True,
        "auto_lock_minutes": 5,
        "enable_biometric": False,
        "require_password_on_export": True,
        "encryption_algorithm": "Fernet",
        "data_path": "data/data_encrypted.sfpss",
        "backup_enabled": True,
        "backup_interval_days": 7,
        "backup_location": "data/backups",
        "sync_enabled": False,
        "sync_provider": "none",
        "export_format_default": "csv",
        "theme": "system",
        "items_per_page": 20,
        "show_password_strength_meter": True,
        "confirm_before_delete": True,
        "server_host": "127.0.0.1",
        "server_port": 5000,
        "allow_remote_connections": False,
        "cors_allowed_origins": ["http://localhost:3000"],
        "debug_mode": False,
        "log_level": "INFO",
        "detect_enabled": False
    }
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
        SETTINGS = data
    else:
        SETTINGS = defaults

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
    import os
    return [
        os.path.join(os.path.dirname(__file__), 'data', '.master_password.json'),
        os.path.join(os.path.dirname(__file__), 'data', 'master_password.json')
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
    dir_path = os.path.join(os.path.dirname(__file__), 'data')
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
        log.initialize(app_name='flask_api', file_path=log_file_path, to_file=log_to_file, max_size_mb=max_log_size, retention_days=retention)
    except Exception:
        pass
except Exception:
    pass

# Load optional extension token (JSON with value and expiry) for extension<>app communication
EXT_TOKEN = None
EXT_TOKEN_INFO = None
def _ext_token_paths(): 
    import os
    return [
        os.path.join(os.path.dirname(__file__), 'data', 'extension_token.json'),
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
    import os
    dir_path = os.path.join(os.path.dirname(__file__), 'data')
    json_path = os.path.join(dir_path, 'extension_token.json')
    payload = {'token': token_value, 'expires_at': expires_at_iso}
    os.makedirs(dir_path, exist_ok=True)
    try:
        # write JSON file
        with open(json_path, 'w', encoding='utf-8') as f:
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
    import os
    # prefer configured token_path, then legacy data/.token
    paths = []
    try:
        tp = SETTINGS.get('storage', {}).get('token_path') if isinstance(SETTINGS, dict) else None
        if tp:
            paths.append(tp)
    except Exception:
        pass
    paths.append(os.path.join(os.path.dirname(__file__), 'data', '.token'))
    return paths


def load_encryption_key():
    """Attempt to load Fernet key from configured token file or data/.token."""
    global key
    import os
    from cryptography.fernet import Fernet
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
                key = raw
                log.info(f'Clé de chiffrement chargée depuis: {p}')
                return
            except Exception:
                # try decode as text
                try:
                    s = raw.decode('utf-8').strip()
                    Fernet(s)
                    key = s
                    log.info(f'Clé de chiffrement chargée depuis: {p} (decoded)')
                    return
                except Exception as e:
                    log.error(f'Error reading key file: {e}')
                    continue
        except Exception as e:
            log.error(f'Error reading key file: {e}')
            continue
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
    import os
    paths = []
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
        # If a data path is explicitly configured, try only that path (do not load defaults)
        return [dp]
    # No configured data path: do NOT fall back to default locations.
    return []
    # Deduplicate while preserving order
    seen = set(); out = []
    for p in paths:
        if p not in seen:
            seen.add(p); out.append(p)
    return out


def write_app_settings(settings_obj: dict):
    import os
    try:
        if not isinstance(settings_obj, dict):
            settings_obj = {}

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
                advanced['log_dir'] = 'logs'
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

        settings_path = os.path.join(os.path.dirname(__file__), 'data', 'settings.json')
        os.makedirs(os.path.join(os.path.dirname(__file__), 'data'), exist_ok=True)
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings_obj, f, ensure_ascii=False, indent=2)
    except Exception:
        # best-effort write; on failure, raise so callers can handle
        raise




# extension token routes moved to routes/extension_routes.py

try:
    # register modular routes from routes/ package
    from routes import router
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
