import os
import json
from flask import jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash

from app import load_app_settings, write_app_settings, SETTINGS, log, save_master_password, load_master_password
from app import generate_session_token
from datetime import datetime, timedelta


def register(app):
    def _resp_json(route, ok, message, data=None, status_code=200):
        body = {'route': route, 'status': 'ok' if ok else 'error', 'message': message}
        if data is not None:
            body['data'] = data
        try:
            if ok:
                log.info(f"{route} OK: {message}")
            else:
                log.error(f"{route} ERROR: {message}")
        except Exception:
            log.warning(f"Could not log response for {route}")
            pass
        return jsonify(body), status_code

    @app.route('/admin/export_password', methods=['POST'])
    def admin_set_export_password():
        try:
            payload = request.get_json(force=True) or {}
            pw = payload.get('password')
            if not pw:
                return _resp_json('/admin/export_password', False, 'no password provided', None, 400)
            settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
            settings_path = os.path.normpath(settings_path)
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    current = json.load(f) or {}
            except Exception:
                current = {}
            current['export_password_hash'] = generate_password_hash(pw)
            current['require_password_on_export'] = True
            try:
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(current, f, ensure_ascii=False, indent=2)
            except Exception:
                log.warning('Could not save export password to settings file')
                pass
            try:
                load_app_settings()
            except Exception:
                log.warning('Could not reload app settings after setting export password')
                pass
            return _resp_json('/admin/export_password', True, 'export password configured')
        except Exception as e:
            log.error('admin_set_export_password error: ' + str(e))
            return _resp_json('/admin/export_password', False, f'Unable to set password: {e}', None, 500)

    @app.route('/admin/master_password', methods=['POST'])
    def admin_set_master_password():
        try:
            payload = request.get_json(force=True) or {}
            pw = payload.get('password')
            if not pw:
                return _resp_json('/admin/master_password', False, 'no password provided', None, 400)
            save_master_password(generate_password_hash(pw))
            settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
            settings_path = os.path.normpath(settings_path)
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    current = json.load(f) or {}
            except Exception:
                current = {}
            current['master_password_enabled'] = True
            try:
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(current, f, ensure_ascii=False, indent=2)
            except Exception:
                log.warning('Could not save master password to settings file')
            try:
                load_app_settings()
                load_master_password()
            except Exception:
                log.warning('Could not reload app settings after setting master password')
            return _resp_json('/admin/master_password', True, 'master password set and enabled')
        except Exception as e:
            log.error('admin_set_master_password error: ' + str(e))
            return _resp_json('/admin/master_password', False, f'Unable to set master password: {e}', None, 500)

    @app.route('/admin/master_password/change', methods=['POST'])
    def admin_change_master_password():
        try:
            payload = request.get_json(force=True) or {}
            old = payload.get('old_password')
            new = payload.get('new_password')
            if not old or not new:
                return _resp_json('/admin/master_password/change', False, 'missing parameters', None, 400)
            stored = SETTINGS.get('master_password_hash')
            if not stored:
                return _resp_json('/admin/master_password/change', False, 'no master password configured', None, 400)
            if not check_password_hash(stored, old):
                return _resp_json('/admin/master_password/change', False, 'unauthorized', None, 401)
            save_master_password(generate_password_hash(new))
            settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
            settings_path = os.path.normpath(settings_path)
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    current = json.load(f) or {}
            except Exception:
                current = {}
            current['master_password_enabled'] = True
            try:
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(current, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
            try:
                load_app_settings()
                load_master_password()
            except Exception:
                log.warning('Could not reload master password after changing it')
                pass
            return _resp_json('/admin/master_password/change', True, 'master password changed')
        except Exception as e:
            log.error('admin_change_master_password error: ' + str(e))
            return _resp_json('/admin/master_password/change', False, f'Unable to change master password: {e}', None, 500)

    @app.route('/admin/master_password/reset', methods=['POST'])
    def admin_reset_master_password():
        try:
            remote = request.remote_addr or ''
            if remote not in ('127.0.0.1', '::1'):
                return _resp_json('/admin/master_password/reset', False, 'forbidden', None, 403)
            save_master_password(None)
            settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
            settings_path = os.path.normpath(settings_path)
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    current = json.load(f) or {}
            except Exception:
                current = {}
            current['master_password_enabled'] = False
            try:
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(current, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
            try:
                load_app_settings()
                load_master_password()
            except Exception:
                log.warning('Could not reload master password after resetting it')
            return _resp_json('/admin/master_password/reset', True, 'master password reset and disabled')
        except Exception as e:
            log.error('admin_reset_master_password error: ' + str(e))
            return _resp_json('/admin/master_password/reset', False, f'Unable to reset master password: {e}', None, 500)

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
            if payload.get('clear'):
                save_master_password(None)
                settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
                settings_path = os.path.normpath(settings_path)
                try:
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        current = json.load(f) or {}
                except Exception:
                    current = {}
                current['master_password_enabled'] = False
                try:
                    with open(settings_path, 'w', encoding='utf-8') as f:
                        json.dump(current, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
                try:
                    load_app_settings()
                    load_master_password()
                except Exception:
                    log.warning('Could not reload master password after clearing it')
                return _resp_json('/admin/master_password/file', True, 'master password file cleared', {'action': 'cleared'})

            if 'password' in payload:
                pw = payload.get('password')
                if not pw:
                    return _resp_json('/admin/master_password/file', False, 'no password provided', None, 400)
                save_master_password(generate_password_hash(pw))
                settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
                settings_path = os.path.normpath(settings_path)
                try:
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        current = json.load(f) or {}
                except Exception:
                    current = {}
                current['master_password_enabled'] = True
                try:
                    with open(settings_path, 'w', encoding='utf-8') as f:
                        json.dump(current, f, ensure_ascii=False, indent=2)
                except Exception:
                    log.warning('Could not save master password settings to file')
                try:
                    load_app_settings()
                    load_master_password()
                except Exception:
                    log.warning('Could not reload master password after setting it')
                return _resp_json('/admin/master_password/file', True, 'master password file set (password)', {'action': 'set'})

            if 'hash' in payload:
                h = payload.get('hash')
                if not h:
                    return _resp_json('/admin/master_password/file', False, 'no hash provided', None, 400)
                save_master_password(h)
                settings_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json')
                settings_path = os.path.normpath(settings_path)
                try:
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        current = json.load(f) or {}
                except Exception:
                    current = {}
                current['master_password_enabled'] = True
                try:
                    with open(settings_path, 'w', encoding='utf-8') as f:
                        json.dump(current, f, ensure_ascii=False, indent=2)
                except Exception:
                    log.warning('Could not save master password settings to file')
                try:
                    load_app_settings()
                    load_master_password()
                except Exception:
                    log.warning('Could not reload master password after setting it')    
                return _resp_json('/admin/master_password/file', True, 'master password file set (raw hash)', {'action': 'set_raw'})

            return _resp_json('/admin/master_password/file', False, 'invalid payload', None, 400)
        except Exception as e:
            log.error('admin_master_password_file error: ' + str(e))
            return _resp_json('/admin/master_password/file', False, f'Unable to manage master password file: {e}', None, 500)

    @app.route('/auth/unlock', methods=['POST'])
    def auth_unlock():
        try:
            payload = request.get_json(force=True) or {}
            provided = payload.get('password')
            if not SETTINGS.get('master_password_enabled'):
                return _resp_json('/auth/unlock', True, 'master password disabled; unlocked by default')
            stored = SETTINGS.get('master_password_hash')
            if not stored:
                return _resp_json('/auth/unlock', False, 'no master password configured', None, 400)
            if not provided:
                return _resp_json('/auth/unlock', False, 'no password provided', None, 400)
            if check_password_hash(stored, provided):
                expiry_minutes = int(SETTINGS.get('auto_lock_minutes', 5) or 5)
                token = generate_session_token(expiry_minutes)
                try:
                    expires_at = (datetime.utcnow() + timedelta(minutes=expiry_minutes)).isoformat()
                except Exception:
                    expires_at = None
                data = {'token': token}
                if expires_at:
                    data['expires_at'] = expires_at
                return _resp_json('/auth/unlock', True, 'unlock successful', data)
            else:
                return _resp_json('/auth/unlock', False, 'unauthorized', None, 401)
        except Exception as e:
            log.error('auth_unlock error: ' + str(e))
            return _resp_json('/auth/unlock', False, f'Unable to validate password: {e}', None, 500)
