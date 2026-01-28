from flask import Flask, send_file, jsonify, request
from io import StringIO, BytesIO
import csv
import json
from flask_cors import CORS
from cryptography.fernet import Fernet
import log

from back.detect import byUrl
from back.crypting.crypt_file import crypt, cryptData
from back.crypting.decrypt_file import decryptByPath, decryptData

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# -----------------------------------------------------------------------------
# Initialisation du logging (UNE SEULE FOIS)
# -----------------------------------------------------------------------------
log.initialize("flask_api")
log.info("Démarrage de l'application Flask")

# -----------------------------------------------------------------------------
# Initialisation du chiffrement
# -----------------------------------------------------------------------------
try:
    import os
    # Essayer plusieurs chemins possibles pour le fichier .token
    token_paths = [
        'data/.token',  # Chemin relatif normal
        './data/.token',  # Chemin relatif avec point
        os.path.join(os.path.dirname(__file__), 'data', '.token'),  # Chemin absolu
        os.path.join(os.getcwd(), 'data', '.token')  # Chemin depuis le répertoire courant
    ]
    
    key = None
    for token_path in token_paths:
        try:
            log.info(f"Tentative de lecture depuis: {token_path}")
            with open(token_path, 'rb') as file:
                key = file.read()
            log.info(f"Clé de chiffrement chargée depuis: {token_path}")
            break
        except Exception:
            continue
    
    if key is None:
        raise FileNotFoundError("Aucun fichier .token trouvé dans les chemins testés")
    
    cipher_suite = Fernet(key)
    log.info("Clé de chiffrement chargée avec succès")
except Exception as e:
    log.critical("Impossible de lire la clé de chiffrement", e)
    import sys
    sys.exit(1)

# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.route('/test', methods=['GET'])
def test():
    log.debug("/test appelé")
    return jsonify({"status": "ok"}), 200


# Settings endpoints
@app.route('/settings', methods=['GET'])
def get_settings():
    try:
        import os
        settings_path = os.path.join(os.path.dirname(__file__), 'data', 'settings.json')
        if not os.path.exists(settings_path):
            # return defaults
            defaults = {
                "language": "fr",
                "start_on_boot": False,
                "auto_update_check": True,
                "open_front_on_start": True,
                "master_password_enabled": True,
                "auto_lock_minutes": 5,
                "password_strength_policy": "medium",
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
            return jsonify({"status": "ok", "settings": defaults})
        with open(settings_path, 'r', encoding='utf-8') as f:
            settings = json.load(f)
        return jsonify({"status": "ok", "settings": settings})
    except Exception as e:
        log.error('get_settings error: ' + str(e))
        return jsonify({'error': 'Unable to read settings'}), 500


@app.route('/settings', methods=['POST'])
def save_settings():
    try:
        import os
        payload = request.get_json(force=True)
        settings = payload if isinstance(payload, dict) else {}
        os.makedirs(os.path.join(os.path.dirname(__file__), 'data'), exist_ok=True)
        settings_path = os.path.join(os.path.dirname(__file__), 'data', 'settings.json')
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return jsonify({'status': 'ok'})
    except Exception as e:
        log.error('save_settings error: ' + str(e))
        return jsonify({'error': 'Unable to save settings'}), 500

@app.route('/exportCSV', methods=['POST'])
def export_csv():
    try:
        payload = request.get_json(force=True)
        data = payload.get('data') if isinstance(payload, dict) else None
        # If frontend passed data, use it; else fallback to load stored data
        if data is None:
            # fallback: try to load stored data (reuse decrypt logic)
            import os
            data_paths = [
                'data/data_encrypted.sfpss',
                './data/data_encrypted.sfpss',
                os.path.join(os.path.dirname(__file__), 'data', 'data_encrypted.sfpss'),
                os.path.join(os.getcwd(), 'data', 'data_encrypted.sfpss')
            ]
            data_val = None
            for data_path in data_paths:
                try:
                    data_val = decryptByPath(key, data_path)
                    break
                except Exception:
                    continue

            if data_val is None:
                data_list = []
            else:
                if isinstance(data_val, dict):
                    data_list = [data_val]
                elif isinstance(data_val, list):
                    data_list = data_val
                else:
                    data_list = [data_val]
        else:
            data_list = data if isinstance(data, list) else (json.loads(data) if isinstance(data, str) else [])

        # Build CSV
        output = StringIO()
        if len(data_list) > 0 and isinstance(data_list[0], dict):
            headers = list(data_list[0].keys())
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            for item in data_list:
                writer.writerow({k: item.get(k, '') for k in headers})
        else:
            # Fallback: write raw rows
            writer = csv.writer(output)
            for row in data_list:
                if isinstance(row, list):
                    writer.writerow(row)
                elif isinstance(row, dict):
                    writer.writerow([str(v) for v in row.values()])
                else:
                    writer.writerow([str(row)])

        csv_bytes = output.getvalue().encode('utf-8')
        return send_file(
            BytesIO(csv_bytes),
            mimetype='text/csv',
            as_attachment=True,
            download_name='SafePass_export.csv'
        )
    except Exception as e:
        log.error('export_csv error: ' + str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/saveData', methods=['POST'])
def save_data():
    log.info("/saveData reçu")
    try:
        data = request.get_json()

        # NE PAS LOG LES DONNÉES SENSIBLES
        log.info("Chiffrement et sauvegarde des données (contenu masqué)")

        crypt(key, 'data/data_encrypted.sfpss', data)
        log.info("Données chiffrées et sauvegardées avec succès")
        return jsonify({'status': 'success'})
    except Exception as e:
        log.error("Erreur lors de la sauvegarde des données", e)
        return jsonify({'error': 'Erreur interne'}), 500


@app.route('/getData', methods=['GET'])
def get_data():
    log.info("/getData reçu")
    try:
        import os
        log.info("Déchiffrement du fichier de données")
        # Essayer plusieurs chemins possibles
        data_paths = [
            'data/data_encrypted.sfpss',
            './data/data_encrypted.sfpss',
            os.path.join(os.path.dirname(__file__), 'data', 'data_encrypted.sfpss'),
            os.path.join(os.getcwd(), 'data', 'data_encrypted.sfpss')
        ]
        
        data = None
        for data_path in data_paths:
            try:
                log.info(f"Lecture du fichier: {data_path}")
                data = decryptByPath(key, data_path)
                log.info(f"Fichier lu: {len(data)} bytes")
                break
            except Exception:
                continue
        
        if data is None:
            raise FileNotFoundError("Aucun fichier data_encrypted.sfpss trouvé")

        # 🔹 DÉBOGAGE : Afficher le type et le contenu
        log.info(f"✅ Déchiffrement réussi - Type de data: {type(data).__name__}")

        # Afficher un aperçu sécurisé
        if isinstance(data, (list, dict)):
            log.info(f"Aperçu data: {str(data)[:100]}...")
        else:
            log.warning(f"⚠️ Type inattendu: {type(data)}")

        # 🔹 CORRECTION : Si data est un dict, le transformer en list
        if isinstance(data, dict):
            log.info("Conversion dict -> list")
            data = [data]
        elif not isinstance(data, list):
            log.warning("Type invalide, initialisation structure vide")
            data = [{
                "sites": [],
                "applications": [],
                "autres": []
            }]

        response = {
            'status': 'success',
            'data': data
        }

        log.info(f"✅ Réponse préparée - Type: {type(response['data']).__name__}, Length: {len(response['data'])}")
        return jsonify(response)

    except FileNotFoundError:
        log.warning("⚠️ Fichier inexistant, initialisation structure vide")
        return jsonify({
            'status': 'warning',
            'data': [{
                "sites": [],
                "applications": [],
                "autres": []
            }]
        })
    except Exception as e:
        # 🔹 LOG DÉTAILLÉ de l'erreur
        log.error(f"❌ ERREUR lors du déchiffrement: {type(e).__name__}: {str(e)}")
        import traceback
        log.error(f"Traceback: {traceback.format_exc()}")

        # 🔹 Retourner une structure vide en cas d'erreur
        return jsonify({
            'status': 'error',
            'data': [{
                "sites": [],
                "applications": [],
                "autres": []
            }]
        }), 200  # ← Notez le code 200 au lieu de 500

@app.route('/decryptData', methods=['GET'])
def decrypt_data():
    log.info("/decryptData reçu")
    try:
        encrypted_data = request.args.get('data')
        if not encrypted_data:
            log.warning("Paramètre 'data' manquant")
            return jsonify({'error': 'no data'}), 400

        data = decryptData(key, encrypted_data.encode('utf-8'))
        return data
    except Exception as e:
        log.error("Erreur lors du déchiffrement de la donnée", e)
        return jsonify({'error': 'Erreur interne'}), 500


@app.route('/cryptData', methods=['GET'])
def crypt_data():
    log.info("/cryptData reçu")
    try:
        data = request.args.get('data')
        if not data:
            log.warning("Paramètre 'data' manquant")
            return jsonify({'error': 'no data'}), 400

        encrypted = cryptData(key, data.encode('utf-8'))
        return jsonify({'status': 'success'})
    except Exception as e:
        log.error("Erreur lors du chiffrement de la donnée", e)
        return jsonify({'error': 'Erreur interne'}), 500


@app.route('/url', methods=['POST'])
def get_url():
    log.info("/url reçu")
    try:
        url = request.args.get('url')
        if not url:
            log.warning("Paramètre 'url' manquant")
            return jsonify({'error': 'no url'}), 400

        log.info("Analyse de l'URL en cours")
        byUrl(url)
        log.info("Analyse terminée")
        return jsonify({'status': 'success'})
    except Exception as e:
        log.error("Erreur lors du traitement de l'URL", e)
        return jsonify({'error': 'Erreur interne'}), 500


# -----------------------------------------------------------------------------
# Lancement application
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    try:
        log.info("Lancement du serveur Flask (debug)")
        app.run(debug=True)
    except Exception as e:
        log.critical("Erreur critique au lancement du serveur", e)


def run():
    log.info("Lancement via fonction run()")
    app.run(debug=False)
