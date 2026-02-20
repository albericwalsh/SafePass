import secrets
from datetime import datetime, timedelta
from flask import jsonify, request

from app import load_extension_token, EXT_TOKEN_INFO, save_extension_token, log


def register(app):
    @app.route('/extension/token', methods=['GET'])
    def get_extension_token():
        try:
            # refresh runtime token info from disk
            load_extension_token()
        except Exception as e:
            log.error('Failed to load extension token info: ' + str(e))
        if EXT_TOKEN_INFO is None:
            log.info('No extension token found')
            return jsonify({'status': 'empty', 'token': None}), 200
        info = EXT_TOKEN_INFO.copy()
        log.info('Extension token info retrieved: token exists, expires_at: ' + str(info.get('expires_at')))
        return jsonify({'status': 'ok', 'token': info.get('token'), 'expires_at': info.get('expires_at')}), 200

    @app.route('/extension/token', methods=['POST'])
    def regenerate_extension_token():
        try:
            payload = request.get_json(force=True) or {}
            ttl = int(payload.get('ttl_days', 30))
            if ttl <= 0:
                ttl = 30
            token_value = secrets.token_urlsafe(32)
            expires_at = (datetime.utcnow() + timedelta(days=ttl)).isoformat()
            save_extension_token(token_value, expires_at)
            log.info('New extension token generated')
            return jsonify({'status': 'ok', 'token': token_value, 'expires_at': expires_at}), 200
        except Exception as e:
            log.error('regenerate_extension_token error: ' + str(e))
            return jsonify({'error': 'Unable to generate token'}), 500
