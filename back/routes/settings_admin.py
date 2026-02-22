import os
import json
import sys
from flask import jsonify, request, Response
from werkzeug.security import generate_password_hash, check_password_hash

from back.app import load_app_settings, write_app_settings, SETTINGS, log, save_master_password, load_master_password
from back.app import generate_session_token, verify_session_token
from back.app import get_system_paths
from back.app import normalize_settings_for_persist
from datetime import datetime, timedelta


def register(app):
    def _resolve_autostart_command(open_front_on_start: bool) -> str:
        app_name = 'SafePass.exe' if open_front_on_start else 'SafePassBackend.exe'

        if getattr(sys, 'frozen', False):
            exe_dir = os.path.dirname(sys.executable)
            preferred = os.path.join(exe_dir, app_name)
            if os.path.exists(preferred):
                return f'"{preferred}" --startup'
            return f'"{sys.executable}" --startup'

        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        script_name = 'SafePass.py' if open_front_on_start else 'SafePassBackend.py'
        script_path = os.path.join(root_dir, script_name)
        py_exec = sys.executable or 'python'
        return f'"{py_exec}" "{script_path}" --startup'

    def _apply_windows_autostart(start_on_boot: bool, open_front_on_start: bool):
        if os.name != 'nt':
            return
        try:
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            value_name = 'SafePass'
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ | winreg.KEY_WRITE) as key:
                if not start_on_boot:
                    try:
                        winreg.DeleteValue(key, value_name)
                        log.info('Autostart disabled (Run key removed)')
                    except FileNotFoundError:
                        pass
                    return

                cmd = _resolve_autostart_command(open_front_on_start)
                winreg.SetValueEx(key, value_name, 0, winreg.REG_SZ, cmd)
                log.info(f'Autostart command updated: {cmd}')
        except Exception as e:
            log.warning(f'Unable to update Windows autostart command: {e}')

    def _settings_path():
        return get_system_paths()['settings_path']

    @app.route('/test', methods=['GET'])
    def test():
        log.debug("/test appelé")
        return jsonify({"status": "ok"}), 200

    @app.route('/settings', methods=['GET'])
    def get_settings():
        try:
            sp = get_system_paths()
            settings_path = _settings_path()
            if not os.path.exists(settings_path):
                defaults = normalize_settings_for_persist({})
                try:
                    log.debug(f"get_settings (defaults) -> storage.data_path={defaults.get('storage', {}).get('data_path')}")
                except Exception:
                    pass
                return jsonify({"status": "ok", "settings": defaults})
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            safe = normalize_settings_for_persist(dict(settings))
            try:
                security = safe.get('security') if isinstance(safe.get('security'), dict) else {}
                sec_blacklist = security.get('password_blacklist') if isinstance(security, dict) else None
                chosen = sec_blacklist if isinstance(sec_blacklist, list) else []

                cleaned = []
                seen = set()
                for v in chosen:
                    s = str(v).strip() if v is not None else ''
                    if not s:
                        continue
                    k = s.lower()
                    if k in seen:
                        continue
                    seen.add(k)
                    cleaned.append(s)

                if 'security' not in safe or not isinstance(safe['security'], dict):
                    safe['security'] = {}
                safe['security']['password_blacklist'] = cleaned
                if 'password_blacklist' in safe:
                    safe.pop('password_blacklist')
            except Exception:
                pass
            # do not reveal stored hashes
            for k in ('export_password_hash', 'master_password_hash'):
                if k in safe:
                    safe.pop(k)
            # ensure runtime master password status is up-to-date and expose whether a master hash is configured
            try:
                # load_master_password will populate SETTINGS['master_password_hash'] if present
                load_master_password()
            except Exception:
                pass
            # Do not expose `master_password_configured` in the public settings
            # response to avoid persisting or leaking transient state to the UI.
            configured = bool(SETTINGS.get('master_password_hash'))
            try:
                log.debug(f"get_settings -> returning storage.data_path={safe.get('storage', {}).get('data_path')}")
            except Exception:
                pass
            return jsonify({"status": "ok", "settings": safe})
        except Exception as e:
            log.error('get_settings error: ' + str(e))
            return jsonify({'error': 'Unable to read settings'}), 500

    def read_settings_file():
        settings_path = _settings_path()
        if os.path.exists(settings_path):
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    return json.load(f) or {}
            except Exception:
                return {}
        return {}

    @app.route('/settings', methods=['POST'])
    def save_settings():
        try:
            payload = request.get_json(force=True)
            incoming = payload if isinstance(payload, dict) else {}
            # Remove transient or sensitive keys that should never be persisted
            try:
                for _k in ('master_password_configured', 'master_password_hash', 'export_password_hash'):
                    if _k in incoming:
                        try:
                            incoming.pop(_k)
                        except Exception:
                            pass
            except Exception:
                pass

            # read existing settings and merge recursively
            sp = get_system_paths()
            settings_path = _settings_path()
            os.makedirs(sp['root_dir'], exist_ok=True)

            # Load current settings from disk; if that fails, fall back to
            # runtime `SETTINGS` so we don't accidentally overwrite the file
            # with just the incoming delta when the on-disk JSON can't be read.
            try:
                current = read_settings_file() or {}
            except Exception:
                current = {}
            if not current:
                try:
                    # Use the in-memory runtime SETTINGS as a safer baseline
                    current = dict(SETTINGS) if isinstance(SETTINGS, dict) else {}
                except Exception:
                    current = {}

            # ensure transient/sensitive keys are removed from the current file snapshot
            try:
                for _k in ('master_password_configured', 'master_password_hash', 'export_password_hash'):
                    try:
                        if _k in current:
                            current.pop(_k)
                    except Exception:
                        pass
            except Exception:
                pass

            def merge(dst, src):
                for k, v in (src.items() if isinstance(src, dict) else []):
                    if isinstance(v, dict) and isinstance(dst.get(k), dict):
                        merge(dst[k], v)
                    else:
                        dst[k] = v
                return dst

            merged = merge(dict(current), incoming)
            merged = normalize_settings_for_persist(merged)

            # Normalize password blacklist into `security` only.
            try:
                security = merged.get('security') if isinstance(merged.get('security'), dict) else {}
                sec_blacklist = security.get('password_blacklist') if isinstance(security, dict) else None

                chosen = sec_blacklist if isinstance(sec_blacklist, list) else None
                if chosen is None:
                    chosen = []

                cleaned = []
                seen = set()
                for v in chosen:
                    s = str(v).strip() if v is not None else ''
                    if not s:
                        continue
                    k = s.lower()
                    if k in seen:
                        continue
                    seen.add(k)
                    cleaned.append(s)

                if 'security' not in merged or not isinstance(merged['security'], dict):
                    merged['security'] = {}
                merged['security']['password_blacklist'] = cleaned
                if 'password_blacklist' in merged:
                    merged.pop('password_blacklist')
            except Exception:
                pass

            # Normalize log-related keys into a dedicated `advanced` section for consistency
            advanced = merged.get('advanced', {}) if isinstance(merged.get('advanced', {}), dict) else {}
            # from storage.*
            storage = merged.get('storage', {}) if isinstance(merged.get('storage', {}), dict) else {}
            if 'log_file_path' in storage:
                advanced.setdefault('log_dir', storage.get('log_file_path'))
            if 'log_to_file' in storage:
                advanced.setdefault('to_file', storage.get('log_to_file'))
            if 'max_log_size_mb' in storage:
                advanced.setdefault('max_size_mb', storage.get('max_log_size_mb'))
            if 'log_retention_days' in storage:
                advanced.setdefault('retention_days', storage.get('log_retention_days'))

            # also check top-level legacy keys
            if 'log_file_path' in merged:
                advanced.setdefault('log_dir', merged.get('log_file_path'))
            if 'log_to_file' in merged:
                advanced.setdefault('to_file', merged.get('log_to_file'))
            if 'max_log_size_mb' in merged:
                advanced.setdefault('max_size_mb', merged.get('max_log_size_mb'))
            if 'log_retention_days' in merged:
                advanced.setdefault('retention_days', merged.get('log_retention_days'))

            # ensure some sensible defaults
            if 'log_dir' not in advanced:
                advanced['log_dir'] = 'logs'
            if 'max_size_mb' not in advanced:
                advanced['max_size_mb'] = 5
            if 'retention_days' not in advanced:
                advanced['retention_days'] = 30
            if 'to_file' not in advanced:
                advanced['to_file'] = True

            merged['advanced'] = advanced

            # Normalize detect_enabled into general
            try:
                # if top-level detect_enabled present, move it into merged['general']
                if 'detect_enabled' in merged:
                    if 'general' not in merged or not isinstance(merged['general'], dict):
                        merged['general'] = {}
                    merged['general']['detect_enabled'] = bool(merged.pop('detect_enabled'))
                # if present under storage (legacy), prefer general
                storage_dict = merged.get('storage')
                if isinstance(storage_dict, dict) and 'detect_enabled' in storage_dict:
                    if 'general' not in merged or not isinstance(merged['general'], dict):
                        merged['general'] = {}
                    merged['general']['detect_enabled'] = bool(merged['storage'].pop('detect_enabled'))
            except Exception:
                pass

            # Remove legacy/duplicate log keys from `storage` and top-level
            try:
                if 'storage' in merged and isinstance(merged['storage'], dict):
                    for k in ('log_file_path', 'log_to_file', 'max_log_size_mb', 'log_retention_days', 'log_level'):
                        if k in merged['storage']:
                            try:
                                merged['storage'].pop(k)
                            except Exception:
                                pass
                for k in ('log_file_path', 'log_to_file', 'max_log_size_mb', 'log_retention_days', 'log_level'):
                    if k in merged:
                        try:
                            merged.pop(k)
                        except Exception:
                            pass
            except Exception:
                pass

            # If incoming contained `advanced`, map its keys into `advanced` (persist under advanced)
            try:
                incoming_adv = incoming.get('advanced') if isinstance(incoming, dict) else None
                if isinstance(incoming_adv, dict):
                    for ok, nk in (('to_file','to_file'), ('log_dir','log_dir'), ('log_level','log_level'), ('max_size_mb','max_size_mb'), ('retention_days','retention_days')):
                        if ok in incoming_adv:
                            try:
                                merged.setdefault('advanced', {})[nk] = incoming_adv[ok]
                            except Exception:
                                pass
                    # keep `advanced` in merged to persist advanced settings
            except Exception:
                pass

            # Normalize `log_level`: prefer `advanced.log_level`, then `general`, then top-level.
            # Persist `log_level` only under `advanced` to avoid duplicate entries.
            try:
                log_level_val = None
                if isinstance(merged.get('advanced'), dict) and 'log_level' in merged.get('advanced', {}):
                    log_level_val = merged['advanced'].get('log_level')
                elif isinstance(merged.get('general'), dict) and 'log_level' in merged.get('general', {}):
                    log_level_val = merged['general'].get('log_level')
                elif 'log_level' in merged:
                    log_level_val = merged.get('log_level')

                # ensure advanced exists and store chosen value (fallback to INFO)
                if 'advanced' not in merged or not isinstance(merged['advanced'], dict):
                    merged['advanced'] = {}
                merged['advanced']['log_level'] = log_level_val or merged['advanced'].get('log_level') or 'INFO'

                # remove duplicates from top-level and general
                try:
                    if 'log_level' in merged:
                        merged.pop('log_level')
                except Exception:
                    pass
                try:
                    if isinstance(merged.get('general'), dict) and 'log_level' in merged['general']:
                        merged['general'].pop('log_level')
                except Exception:
                    pass
            except Exception:
                pass

            # Ensure transient/sensitive top-level keys are not persisted
            try:
                for _k in ('master_password_configured', 'master_password_hash', 'export_password_hash'):
                    if _k in merged:
                        try:
                            merged.pop(_k)
                        except Exception:
                            pass
            except Exception:
                pass
            # write merged settings back
            with open(settings_path, 'w', encoding='utf-8') as f:
                json.dump(merged, f, ensure_ascii=False, indent=2)
            try:
                log.debug(f"save_settings payload -> storage.data_path={merged.get('storage', {}).get('data_path')}")
            except Exception:
                pass
            try:
                load_app_settings()
                try:
                    log.set_level(SETTINGS.get('log_level', 'INFO'))
                except Exception:
                    pass
            except Exception:
                pass

            try:
                general_cfg = merged.get('general') if isinstance(merged.get('general'), dict) else {}
                if not isinstance(general_cfg, dict):
                    general_cfg = {}
                start_on_boot = bool(general_cfg.get('start_on_boot', merged.get('start_on_boot', False)))
                open_front = bool(general_cfg.get('open_front_on_start', merged.get('open_front_on_start', True)))
                _apply_windows_autostart(start_on_boot, open_front)
            except Exception as e:
                log.warning(f'Failed to apply startup mode settings: {e}')

            return jsonify({'status': 'ok'})
        except Exception as e:
            log.error('save_settings error: ' + str(e))
            return jsonify({'error': 'Unable to save settings'}), 500
