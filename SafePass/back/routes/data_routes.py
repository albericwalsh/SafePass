import os
import json
from datetime import datetime, timezone
from io import StringIO, BytesIO
import csv
from urllib.parse import urlparse
from flask import jsonify, request, Response, send_file
from cryptography.fernet import Fernet

try:
    import tldextract
    _HAS_TLDEXTRACT = True
except Exception:
    tldextract = None
    _HAS_TLDEXTRACT = False


def _normalize_hostname(s):
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    try:
        if '://' not in s:
            s2 = 'http://' + s
        else:
            s2 = s
        parsed = urlparse(s2)
        host = parsed.hostname or s
    except Exception:
        host = s
    return (host or '').lower()


def _primary_domain(hostname):
    if not hostname:
        return None
    h = hostname.lower().strip()
    if _HAS_TLDEXTRACT:
        try:
            ext = tldextract.extract(h)
            reg = getattr(ext, 'registered_domain', None)
            if reg:
                return reg.lower()
            if ext.domain and ext.suffix:
                return f"{ext.domain}.{ext.suffix}".lower()
        except Exception:
            pass
    parts = h.split('.')
    if len(parts) >= 2:
        return '.'.join(parts[-2:])
    return h

from back.app import log, SETTINGS, verify_session_token, get_data_paths
from back import app as app_module
from werkzeug.security import check_password_hash
from back.crypting.decrypt_file import decryptByPath
from back.crypting.crypt_file import cryptData


def _utc_now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def register(app):
    @app.route('/saveData', methods=['POST'])
    def save_data():
        log.info("/saveData reçu")
        try:
            payload = request.get_json()

            # Mode 1: full dataset save (frontend saveAllData sends allData array/object)
            is_full_dataset_payload = False
            if isinstance(payload, list):
                is_full_dataset_payload = True
            elif isinstance(payload, dict) and 'extension_entry' not in payload:
                # accept dict shaped like {'sites':[], 'applications':[], 'autres':[]}
                if all(k in payload for k in ('sites', 'applications', 'autres')):
                    is_full_dataset_payload = True

            if is_full_dataset_payload:
                try:
                    if isinstance(payload, list):
                        base = payload
                    else:
                        base = [payload]

                    if not isinstance(base, list) or len(base) == 0:
                        base = [{'sites': [], 'applications': [], 'autres': []}]

                    # ensure minimum expected structure
                    root = base[0] if isinstance(base[0], dict) else {}
                    if not isinstance(root, dict):
                        root = {}
                    if 'sites' not in root or not isinstance(root.get('sites'), list):
                        root['sites'] = []
                    if 'applications' not in root or not isinstance(root.get('applications'), list):
                        root['applications'] = []
                    if 'autres' not in root or not isinstance(root.get('autres'), list):
                        root['autres'] = []
                    base[0] = root

                    data_paths = get_data_paths() or []
                    existing_path = data_paths[0] if data_paths else None
                    if not existing_path:
                        log.warning('/saveData full dataset mode: no configured data path')
                        return jsonify({'error': 'no configured data path'}), 400

                    raw = json.dumps(base, indent=2).encode('utf-8')
                    if app_module.key is None:
                        raise ValueError('Encryption key is not initialized')
                    encrypted = cryptData(app_module.key, raw)

                    tmp_path = existing_path + '.tmp'
                    with open(tmp_path, 'wb') as f:
                        f.write(encrypted)
                    os.replace(tmp_path, existing_path)

                    log.info('Données sauvegardées avec succès (full dataset mode)')
                    return jsonify({'status': 'success'})
                except Exception as e:
                    log.error('Erreur lors de la sauvegarde des données (full dataset mode): %s', e)
                    import traceback
                    log.error(f'Traceback: {traceback.format_exc()}')
                    return jsonify({'error': 'Erreur interne'}), 500

            if not payload or 'extension_entry' not in payload:
                log.warning('/saveData called with invalid payload')
                return jsonify({'error': 'invalid payload'}), 400

            entry = payload['extension_entry']
            if not isinstance(entry, dict):
                log.warning('/saveData called with invalid extension_entry format')
                return jsonify({'error': 'invalid extension_entry format'}), 400
            entry = dict(entry)
            log.info('Requête saveData reçue (contenu masqué)')
            created_at_now = _utc_now_iso()

            # Use configured data paths (no fallbacks)
            data_paths = get_data_paths() or []

            existing = None
            existing_path = data_paths[0] if data_paths else None
            for p in data_paths:
                try:
                    existing = decryptByPath(app_module.key, p)
                    existing_path = p
                    break
                except Exception:
                    existing = None
                    log.warning(f"Failed to decrypt existing data at {p}, trying next path if available")

            if existing is None:
                base = [{'sites': [], 'applications': [], 'autres': []}]
            else:
                if isinstance(existing, dict):
                    base = [existing]
                elif isinstance(existing, list):
                    base = existing
                else:
                    base = [{'sites': [], 'applications': [], 'autres': []}]

            target = base[0]
            if 'sites' not in target or not isinstance(target['sites'], list):
                target['sites'] = []

            # Update existing site if url+username match, else append
            updated = False
            try:
                entry_url = entry.get('url') if isinstance(entry, dict) else None
                entry_user = entry.get('username') if isinstance(entry, dict) else None
                entry_host = _normalize_hostname(entry_url)
                entry_base = _primary_domain(entry_host)
                for s in target['sites']:
                    if not isinstance(s, dict):
                        continue
                    s_url = s.get('url')
                    s_host = _normalize_hostname(s_url)
                    s_base = _primary_domain(s_host)
                    if entry_base and s_base and entry_base == s_base and (entry_user is None or s.get('username') == entry_user):
                        password_changed = False
                        # Manage password history: if password changed, prepend old password
                        try:
                            old_pw = s.get('password') if isinstance(s, dict) else None
                            new_pw = entry.get('password') if isinstance(entry, dict) else None
                            if old_pw is not None and new_pw is not None and old_pw != new_pw:
                                password_changed = True
                                hist = []
                                try:
                                    if isinstance(s.get('password_history'), list):
                                        hist = s.get('password_history')[:]
                                except Exception:
                                    hist = []
                                # prepend previous password if not already first
                                try:
                                    if old_pw and (len(hist) == 0 or hist[0] != old_pw):
                                        hist.insert(0, old_pw)
                                except Exception:
                                    pass
                                # determine max history length from SETTINGS
                                try:
                                    max_len = int(SETTINGS.get('security', {}).get('password_history_length') or SETTINGS.get('password_history_length') or 5)
                                except Exception:
                                    max_len = 5
                                if max_len < 0:
                                    max_len = 0
                                hist = hist[:max_len]
                                # attach to entry so it gets merged
                                try:
                                    entry['password_history'] = hist
                                except Exception:
                                    pass
                        except Exception:
                            pass
                        try:
                            if password_changed:
                                s['created_at'] = created_at_now
                            elif not s.get('created_at'):
                                s['created_at'] = created_at_now
                        except Exception:
                            pass
                        # Update fields including possible password_history
                        s.update({k: v for k, v in entry.items() if k in ('password', 'username', 'name', 'url', 'password_history')})
                        updated = True
                        break
            except Exception:
                updated = False
                log.warning("Failed to update existing entry, will attempt to append as new entry")

            if not updated:
                # ensure new entry contains password_history if provided or default
                try:
                    if 'password_history' not in entry:
                        entry['password_history'] = entry.get('password_history') or []
                except Exception:
                    try:
                        entry['password_history'] = []
                    except Exception:
                        pass
                try:
                    if not entry.get('created_at'):
                        entry['created_at'] = created_at_now
                except Exception:
                    pass
                target['sites'].append(entry)

            tmp_path = None
            try:
                raw = json.dumps(base, indent=2).encode('utf-8')
                if app_module.key is None:
                    raise ValueError('Encryption key is not initialized')
                encrypted = cryptData(app_module.key, raw)
                tmp_path = existing_path + '.tmp' if existing_path else None
                if tmp_path:
                    with open(tmp_path, 'wb') as f:
                        f.write(encrypted)
                    if existing_path:
                        os.replace(tmp_path, existing_path)
                log.info('Données chiffrées et sauvegardées (merge)')
                try:
                    if SETTINGS.get('backup_enabled'):
                        backup_loc = SETTINGS.get('backup_location') or SETTINGS.get('storage', {}).get('backup_location') or os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'backups')
                        os.makedirs(backup_loc, exist_ok=True)
                        ts = __import__('datetime').datetime.utcnow().strftime('%Y%m%d%H%M%S')
                        backup_name = f"data_encrypted_{ts}.sfpss"
                        backup_path = os.path.join(backup_loc, backup_name)
                        with open(backup_path, 'wb') as bf:
                            bf.write(encrypted)
                        log.info(f'Backup créé: {backup_path}')
                        try:
                            # enforce backup history retention
                            max_history = None
                            try:
                                max_history = int(SETTINGS.get('backup_history_count') or SETTINGS.get('storage', {}).get('backup_history_count') or 20)
                            except Exception:
                                max_history = 20
                            if max_history and max_history > 0:
                                # list backup files matching pattern
                                all_files = []
                                for fn in os.listdir(backup_loc):
                                    if fn.startswith('data_encrypted_') and fn.endswith('.sfpss'):
                                        fp = os.path.join(backup_loc, fn)
                                        try:
                                            mtime = os.path.getmtime(fp)
                                            all_files.append((fp, mtime))
                                        except Exception:
                                            log.warning(f'Failed to get mtime for backup file {fp}, skipping retention check for this file')
                                # sort by mtime ascending (oldest first)
                                all_files.sort(key=lambda x: x[1])
                                # delete oldest until count <= max_history
                                if len(all_files) > max_history:
                                    to_delete = len(all_files) - max_history
                                    for i in range(to_delete):
                                        try:
                                            os.remove(all_files[i][0])
                                            log.info(f'Retention: supprimé ancien backup {all_files[i][0]}')
                                        except Exception as e:
                                            log.warning(f'Failed to remove old backup {all_files[i][0]}: {e}')
                        except Exception:
                            log.warning('Failed to enforce backup retention policy, but backup was created successfully')
                except Exception as be:
                    log.error('Backup failed: %s', be)
            except Exception:
                try:
                    if tmp_path and os.path.exists(tmp_path):
                        os.remove(tmp_path)
                except Exception:
                    log.warning(f'Failed to remove temporary file {tmp_path}')
                raise
            log.info('Données sauvegardées avec succès')
            return jsonify({'status': 'success'})
        except Exception as e:
            log.error('Erreur lors de la sauvegarde des données: %s', e)
            import traceback
            log.error(f'Traceback: {traceback.format_exc()}')
            return jsonify({'error': 'Erreur interne'}), 500

    @app.route('/getData', methods=['GET'])
    def get_data():
        log.info("/getData reçu")
        try:
            # Use configured data paths (no fallbacks)
            data_paths = get_data_paths() or []
            data = None
            # Authorization: require session token unless master password is disabled
            token = request.headers.get('X-Auth-Token') or request.args.get('token')
            if SETTINGS.get('master_password_enabled'):
                if token and verify_session_token(token):
                    pass
                else:
                    # allow one-shot password via query param ?password=... (not recommended)
                    provided_pw = request.args.get('password') or request.headers.get('X-Master-Password')
                    stored_hash = SETTINGS.get('master_password_hash')
                    if provided_pw and stored_hash and check_password_hash(stored_hash, provided_pw):
                        pass
                    else:
                        return jsonify({'error': 'unauthorized'}), 401
            for data_path in data_paths:
                try:
                    data = decryptByPath(app_module.key, data_path)
                    break
                except Exception:
                    log.warning(f"Failed to decrypt data at {data_path}, trying next path if available")
                    continue
            if data is None:
                log.warning("Aucun fichier data_encrypted.sfpss trouvé, initialisation structure vide")
                raise FileNotFoundError("Aucun fichier data_encrypted.sfpss trouvé")
            log.info(f"Déchiffrement réussi - data type: {type(data).__name__}")
            if isinstance(data, dict):
                log.info("Conversion dict -> list")
                data = [data]
            elif not isinstance(data, list):
                log.warning("Type invalide, initialisation structure vide")
                data = [{"sites": [], "applications": [], "autres": []}]
            response = {'status': 'success', 'data': data}
            try:
                length = len(response['data']) if hasattr(response['data'], '__len__') else 'unknown'
            except Exception:
                length = 'unknown'
                log.warning("Failed to determine length of response data")
            log.info(f"Réponse préparée - Type: {type(response['data']).__name__}, Length: {length}")
            return jsonify(response)
        except FileNotFoundError:
            log.warning("⚠️ Fichier inexistant, initialisation structure vide")
            return jsonify({'status': 'warning', 'data': [{"sites": [], "applications": [], "autres": []}]})
        except Exception as e:
            log.error(f"❌ ERREUR lors du déchiffrement: {type(e).__name__}: {str(e)}")
            import traceback
            log.error(f"Traceback: {traceback.format_exc()}")
            return jsonify({'status': 'error', 'data': [{"sites": [], "applications": [], "autres": []}] }), 200
    # end of data routes
