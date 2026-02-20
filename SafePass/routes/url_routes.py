import os
import json
from flask import jsonify, request

from app import log, SETTINGS, key, EXT_TOKEN, get_data_paths
from back.detect import byUrl
from back.crypting.decrypt_file import decryptByPath


def register(app):
    @app.route('/url', methods=['POST'])
    def get_url():
        log.info("/url reçu (modular)")
        try:
            url = request.args.get('url')
            if not url:
                log.warning("Paramètre 'url' manquant")
                return jsonify({'error': 'no url'}), 400
            if not SETTINGS.get('detect_enabled'):
                log.info('Detection disabled by settings')
                return jsonify({'status': 'disabled'}), 200
            byUrl(url)
            log.info("Analyse terminée")
            return jsonify({'status': 'success'})
        except Exception as e:
            log.error("Erreur lors du traitement de l'URL", e)
            return jsonify({'error': 'Erreur interne'}), 500


    @app.route('/credentials', methods=['GET'])
    def get_credentials():
        log.info("/credentials reçu (modular)")
        try:
            url = request.args.get('url')
            if not url:
                return jsonify({'error': 'no url'}), 400

            try:
                token_header = request.headers.get('X-Ext-Auth')
            except Exception:
                token_header = None
            if EXT_TOKEN:
                if not token_header or token_header != EXT_TOKEN:
                    log.warning('/credentials unauthorized request')
                    return jsonify({'error': 'unauthorized'}), 401

            data_paths = get_data_paths() or []
            data = None
            for data_path in data_paths:
                try:
                    data = decryptByPath(key, data_path)
                    break
                except Exception:
                    continue
            if data is None:
                return jsonify({'status': 'warning', 'message': 'no data'}), 404

            entries = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
            matches = []
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                entry_url = entry.get('url')
                if entry_url and isinstance(entry_url, str) and url in entry_url:
                    matches.append({'username': entry.get('username'), 'password': entry.get('password'), 'source': 'entry'})
                sites = entry.get('sites') or []
                for s in sites:
                    s_url = s.get('url') if isinstance(s, dict) else None
                    if s_url and isinstance(s_url, str) and url in s_url:
                        matches.append({'username': s.get('username'), 'password': s.get('password'), 'source': 'site'})

            if len(matches) == 0:
                return jsonify({'status': 'not_found'}), 404
            log.info(f'/credentials returning {len(matches)} matches for url')
            return jsonify({'status': 'ok', 'matches': matches}), 200
        except Exception as e:
            import traceback
            log.error('get_credentials error: %s', e)
            log.debug(f'Traceback: {traceback.format_exc()}')
            return jsonify({'error': 'Unable to retrieve credentials'}), 500
