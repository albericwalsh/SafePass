import json
from cryptography.fernet import Fernet


def crypt(key, path, data):
    cipher_suite = Fernet(key)
    data = json.dumps(data, indent=2)
    encrypted_data = cipher_suite.encrypt(data.encode('utf-8'))

    path = path.replace('.json', '.sfpss')
    with open(path, 'wb') as f:
        f.write(encrypted_data)

def cryptData(key, data):
    cipher_suite = Fernet(key)
    encrypted_data = cipher_suite.encrypt(data)
    return encrypted_data

def main():
    path = input('Entrez le chemin : ')
    key = input('Entrez la clé privée : ')
    crypt(key, path, open(path, 'r').read())

if __name__ == '__main__':
    main()

#     D:\Documents\Other\data_test.json
#       eMpfLpIEXCNm8O2mVp8AKgds1r4j6mFfgCku2pNnQlY=