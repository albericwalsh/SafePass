import os
import json
from flask import jsonify, request

from back.app import log, SETTINGS
from back import app as app_module
from back.crypting.decrypt_file import decryptData
from back.crypting.crypt_file import cryptData


def register(app):
    @app.route('/decryptData', methods=['GET'])
    def decrypt_data():
        log.info("/decryptData reçu (modular)")
        try:
            encrypted_data = request.args.get('data')
            if not encrypted_data:
                log.warning("Paramètre 'data' manquant")
                return jsonify({'error': 'no data'}), 400

            # decryptData expects bytes
            data = decryptData(app_module.key, encrypted_data.encode('utf-8'))
            log.info("Donnée déchiffrée avec succès")
            return data
        except Exception as e:
            log.error("Erreur lors du déchiffrement de la donnée", e)
            return jsonify({'error': 'Erreur interne'}), 500


    @app.route('/cryptData', methods=['GET'])
    def crypt_data():
        log.info("/cryptData reçu (modular)")
        try:
            data = request.args.get('data')
            if not data:
                log.warning("Paramètre 'data' manquant")
                return jsonify({'error': 'no data'}), 400

            encrypted = cryptData(app_module.key, data.encode('utf-8'))
            log.info("Donnée chiffrée avec succès")
            return jsonify({'status': 'success'})
        except Exception as e:
            log.error("Erreur lors du chiffrement de la donnée", e)
            return jsonify({'error': 'Erreur interne'}), 500
