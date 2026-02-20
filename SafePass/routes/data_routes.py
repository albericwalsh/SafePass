import os
import json
from io import StringIO, BytesIO
import csv
from flask import jsonify, request, Response, send_file
from cryptography.fernet import Fernet

from app import log, SETTINGS, key, verify_session_token, get_data_paths
from werkzeug.security import check_password_hash
from back.crypting.decrypt_file import decryptByPath
from back.crypting.crypt_file import cryptData


def register(app):
    @app.route('/saveData', methods=['POST'])
    def save_data():
        log.info("/saveData reçu")
        try:
            payload = request.get_json()
            if not payload or 'extension_entry' not in payload:
                log.warning('/saveData called with invalid payload')
                return jsonify({'error': 'invalid payload'}), 400

            entry = payload['extension_entry']
            log.info('Requête saveData reçue (contenu masqué)')

            # Use configured data paths (no fallbacks)
            data_paths = get_data_paths() or []

            existing = None
            existing_path = data_paths[0] if data_paths else None
            for p in data_paths:
                try:
                    existing = decryptByPath(key, p)
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
                for s in target['sites']:
                    if not isinstance(s, dict):
                        continue
                    if entry_url and s.get('url') == entry_url and (entry_user is None or s.get('username') == entry_user):
                        s.update({k: v for k, v in entry.items() if k in ('password', 'username', 'name', 'url')})
                        updated = True
                        break
            except Exception:
                updated = False
                log.warning("Failed to update existing entry, will attempt to append as new entry")

            if not updated:
                target['sites'].append(entry)

            tmp_path = None
            try:
                raw = json.dumps(base, indent=2).encode('utf-8')
                if key is None:
                    raise ValueError('Encryption key is not initialized')
                encrypted = cryptData(key, raw)
                tmp_path = existing_path + '.tmp' if existing_path else None
                if tmp_path:
                    with open(tmp_path, 'wb') as f:
                        f.write(encrypted)
                    if existing_path:
                        os.replace(tmp_path, existing_path)
                log.info('Données chiffrées et sauvegardées (merge)')
                try:
                    if SETTINGS.get('backup_enabled'):
                        backup_loc = SETTINGS.get('backup_location') or SETTINGS.get('storage', {}).get('backup_location') or os.path.join(os.path.dirname(__file__), '..', 'data', 'backups')
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
                    data = decryptByPath(key, data_path)
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
