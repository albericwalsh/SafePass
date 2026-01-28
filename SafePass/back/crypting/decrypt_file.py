import json

from cryptography.fernet import Fernet


def decryptByPath(key, path):
    cipher_suite = Fernet(key)

    # Lire les données chiffrées depuis le fichier
    with open(path, 'rb') as file:
        encrypted_data = file.read()

    # Déchiffrer les données
    decrypted_data = cipher_suite.decrypt(encrypted_data)
    print(decrypted_data.decode('utf-8'))
    data = json.loads(decrypted_data.decode('utf-8'))

    print('Données déchiffrées :')
    print(json.dumps(data, indent=2))
    return data

def decryptData(key, data):
    cipher_suite = Fernet(key)

    # Déchiffrer les données
    decrypted_data = cipher_suite.decrypt(data)
    print(decrypted_data.decode('utf-8'))
    data = json.loads(decrypted_data.decode('utf-8'))

    print('Données déchiffrées :')
    print(json.dumps(data, indent=2))
    return data
#
# Key = input('Entrez la clé privée : ')
# decrypt(Key, 'data_encrypted.sfpss')