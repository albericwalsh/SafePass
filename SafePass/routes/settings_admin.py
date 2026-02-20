import os
import json
from flask import jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash

from app import load_app_settings, write_app_settings, SETTINGS, log, save_master_password, load_master_password
from app import generate_session_token, verify_session_token
from datetime import datetime, timedelta


def register(app):
    @app.route('/test', methods=['GET'])
    def test():
        log.debug("/test appelé")
        return jsonify({"status": "ok"}), 200

    @app.route('/settings', methods=['GET'])
    def get_settings():
        try:
            settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
            settings_path = os.path.normpath(settings_path)
            if not os.path.exists(settings_path):
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
                    "strength_threshold_red": 20,
                    "strength_threshold_orange": 45,
                    "strength_threshold_yellow": 75,
                    "confirm_before_delete": True,
                    "server_host": "127.0.0.1",
                    "server_port": 5000,
                    "allow_remote_connections": False,
                    "cors_allowed_origins": ["http://localhost:3000"],
                    "debug_mode": False,
                    "log_level": "INFO",
                    "detect_enabled": False
                }
                try:
                    log.debug(f"get_settings (defaults) -> storage.data_path={defaults.get('storage', {}).get('data_path')}")
                except Exception:
                    pass
                return jsonify({"status": "ok", "settings": defaults})
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            safe = dict(settings)
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
            configured = bool(SETTINGS.get('master_password_hash'))
            safe['master_password_configured'] = configured
            try:
                log.debug(f"get_settings -> returning storage.data_path={safe.get('storage', {}).get('data_path')}")
            except Exception:
                pass
            return jsonify({"status": "ok", "settings": safe})
        except Exception as e:
            log.error('get_settings error: ' + str(e))
            return jsonify({'error': 'Unable to read settings'}), 500

    def read_settings_file():
        settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
        settings_path = os.path.normpath(settings_path)
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
            settings = payload if isinstance(payload, dict) else {}
            os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'data'), exist_ok=True)
            settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
            settings_path = os.path.normpath(settings_path)
            with open(settings_path, 'w', encoding='utf-8') as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
            try:
                log.debug(f"save_settings payload -> storage.data_path={settings.get('storage', {}).get('data_path')}")
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
            return jsonify({'status': 'ok'})
        except Exception as e:
            log.error('save_settings error: ' + str(e))
            return jsonify({'error': 'Unable to save settings'}), 500

    @app.route('/admin/export_password', methods=['POST'])
    def admin_set_export_password():
        try:
            payload = request.get_json(force=True) or {}
            pw = payload.get('password')
            if not pw:
                return jsonify({'error': 'no password provided'}), 400
            settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
            settings_path = os.path.normpath(settings_path)
            current = read_settings_file()
            current['export_password_hash'] = generate_password_hash(pw)
            current['require_password_on_export'] = True
            write_app_settings(current)
            load_app_settings()
            return jsonify({'status': 'ok'})
        except Exception as e:
            log.error('admin_set_export_password error: ' + str(e))
            return jsonify({'error': 'Unable to set password'}), 500

    @app.route('/admin/master_password', methods=['POST'])
    def admin_set_master_password():
        try:
            payload = request.get_json(force=True) or {}
            pw = payload.get('password')
            if not pw:
                return jsonify({'error': 'no password provided'}), 400
            # save hash in dedicated file, and enable master flag in settings.json
            save_master_password(generate_password_hash(pw))
            current = read_settings_file()
            current['master_password_enabled'] = True
            write_app_settings(current)
            load_app_settings()
            load_master_password()
            return jsonify({'status': 'ok'})
        except Exception as e:
            log.error('admin_set_master_password error: ' + str(e))
            return jsonify({'error': 'Unable to set master password'}), 500

    @app.route('/admin/master_password/change', methods=['POST'])
    def admin_change_master_password():
        try:
            payload = request.get_json(force=True) or {}
            old = payload.get('old_password')
            new = payload.get('new_password')
            if not old or not new:
                return jsonify({'error': 'missing parameters'}), 400
            stored = SETTINGS.get('master_password_hash')
            if not stored:
                return jsonify({'error': 'no master password configured'}), 400
            if not check_password_hash(stored, old):
                return jsonify({'error': 'unauthorized'}), 401
            # save new hash in dedicated file and ensure enabled flag
            save_master_password(generate_password_hash(new))
            current = read_settings_file()
            current['master_password_enabled'] = True
            write_app_settings(current)
            load_app_settings()
            load_master_password()
            return jsonify({'status': 'ok'})
        except Exception as e:
            log.error('admin_change_master_password error: ' + str(e))
            return jsonify({'error': 'Unable to change master password'}), 500

    @app.route('/admin/master_password/reset', methods=['POST'])
    def admin_reset_master_password():
        try:
            remote = request.remote_addr or ''
            if remote not in ('127.0.0.1', '::1'):
                return jsonify({'error': 'forbidden'}), 403
            # remove stored hash and disable flag
            save_master_password(None)
            current = read_settings_file()
            current['master_password_enabled'] = False
            write_app_settings(current)
            load_app_settings()
            load_master_password()
            return jsonify({'status': 'ok'})
        except Exception as e:
            log.error('admin_reset_master_password error: ' + str(e))
            return jsonify({'error': 'Unable to reset master password'}), 500

    @app.route('/admin/master_password/file', methods=['POST'])
    def admin_master_password_file():
        """Create/replace or clear the dedicated master password file.

        Accepts JSON body:
          - { password: '...'}  -> hashes then saves
          - { hash: '...'}      -> saves raw hash
          - { clear: true }     -> removes stored hash
        """
        try:
            payload = request.get_json(force=True) or {}
            # clear file
            if payload.get('clear'):
                save_master_password(None)
                current = read_settings_file()
                current['master_password_enabled'] = False
                write_app_settings(current)
                load_app_settings()
                load_master_password()
                return jsonify({'status': 'ok', 'action': 'cleared'})

            if 'password' in payload:
                pw = payload.get('password')
                if not pw:
                    return jsonify({'error': 'no password provided'}), 400
                save_master_password(generate_password_hash(pw))
                current = read_settings_file()
                current['master_password_enabled'] = True
                write_app_settings(current)
                load_app_settings()
                load_master_password()
                return jsonify({'status': 'ok', 'action': 'set'})

            if 'hash' in payload:
                h = payload.get('hash')
                if not h:
                    return jsonify({'error': 'no hash provided'}), 400
                save_master_password(h)
                current = read_settings_file()
                current['master_password_enabled'] = True
                write_app_settings(current)
                load_app_settings()
                load_master_password()
                return jsonify({'status': 'ok', 'action': 'set_raw'})

            return jsonify({'error': 'invalid payload'}), 400
        except Exception as e:
            log.error('admin_master_password_file error: ' + str(e))
            return jsonify({'error': 'Unable to manage master password file'}), 500

    @app.route('/auth/unlock', methods=['POST'])
    def auth_unlock():
        try:
            payload = request.get_json(force=True) or {}
            provided = payload.get('password')
            if not SETTINGS.get('master_password_enabled'):
                return jsonify({'status': 'ok'})
            stored = SETTINGS.get('master_password_hash')
            if not stored:
                return jsonify({'error': 'no master password configured'}), 400
            if not provided:
                return jsonify({'error': 'no password provided'}), 400
            if check_password_hash(stored, provided):
                # generate a session token for the frontend to store, using auto-lock minutes
                expiry_minutes = int(SETTINGS.get('auto_lock_minutes', 5) or 5)
                token = generate_session_token(expiry_minutes)
                try:
                    expires_at = (datetime.utcnow() + timedelta(minutes=expiry_minutes)).isoformat()
                except Exception:
                    expires_at = None
                resp = {'status': 'ok', 'token': token}
                if expires_at:
                    resp['expires_at'] = expires_at
                return jsonify(resp)
            else:
                return jsonify({'error': 'unauthorized'}), 401
        except Exception as e:
            log.error('auth_unlock error: ' + str(e))
            return jsonify({'error': 'Unable to validate password'}), 500
