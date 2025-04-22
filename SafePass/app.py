from flask import Flask, jsonify, request
from flask_cors import CORS
from cryptography.fernet import Fernet

from back.detect import byUrl
from crypting.crypt_file import crypt, cryptData
from crypting.decrypt_file import decryptByPath, decryptData
import log

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# open and put in key value of "data/.token"

try:
    with open('data/.token', 'rb') as file:
        key = file.read()
    cipher_suite = Fernet(key)
except Exception as e:
    log.log("Error reading key file: " + str(e))
    key = None
    exit(1)


@app.route('/test', methods=['GET'])
def test():
    log.log('test')
    return jsonify({"status": "ok"}), 200


@app.route('/saveData', methods=['POST'])
def save_data():
    try:
        data = request.get_json()
        log.log("save data")
        crypt(key, 'data/data_encrypted.sfpss', data)
        return jsonify({'status': 'success'})
    except Exception as e:
        log.log(str(e))
        return jsonify({'error': str(e)})


@app.route('/getData', methods=['GET'])
def get_data():
    try:
        data = decryptByPath(key, 'data/data_encrypted.sfpss')
        log.log("decrypted data")
        return jsonify(data)
    except Exception as e:
        log.log(str(e))
        return jsonify({'error': str(e)})


@app.route('/decryptData', methods=['GET'])
def decrypt_data():
    try:
        data = request.args.get('data')
        data = decryptData(key, data.encode('utf-8'))
        log.log("decrypted data")
        return jsonify(data)
    except Exception as e:
        log.log(str(e))
        return jsonify({'error': str(e)})


@app.route('/cryptData', methods=['GET'])
def crypt_data():
    try:
        data = request.args.get('data')
        if data is None:
            return jsonify({'error': 'no data'})
        log.log("recived data")
        data = cryptData(key, data.encode('utf-8'))
        log.log("decrypted data")
        return data
    except Exception as e:
        log.log(str(e))
        return jsonify({'error': str(e)})


@app.route('/url', methods=['POST'])
def get_url():
    url = request.args.get('url')
    log.log("URL reçue : "+ url)
    byUrl(url)
    return {'status': 'success'}

if __name__ == '__main__':
    try:
        # onDetect()
        app.run(debug=True)
    except Exception as e:
        log.log(str(e))
        app.run(debug=True)

def run():
    app.run(debug=True)