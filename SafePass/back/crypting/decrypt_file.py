import json
from cryptography.fernet import Fernet
import log


def decryptByPath(key, path):
    """
    Déchiffre un fichier et retourne les données JSON

    Args:
        key: Clé de chiffrement Fernet
        path: Chemin vers le fichier chiffré

    Returns:
        dict ou list: Données déchiffrées et parsées

    Raises:
        FileNotFoundError: Si le fichier n'existe pas
        Exception: Pour toute autre erreur
    """
    try:
        # Validate key early to provide a clearer error message
        if key is None:
            log.error('Encryption key is not initialized (None)')
            raise ValueError('Encryption key is not initialized')
        cipher_suite = Fernet(key)

        # Lire les données chiffrées depuis le fichier
        log.info(f"Lecture du fichier: {path}")
        with open(path, 'rb') as file:
            encrypted_data = file.read()

        log.info(f"Fichier lu: {len(encrypted_data)} bytes")

        # Déchiffrer les données
        log.info("Déchiffrement en cours...")
        decrypted_data = cipher_suite.decrypt(encrypted_data)
        log.info(f"Déchiffrement réussi: {len(decrypted_data)} bytes")

        # Parser le JSON
        decoded_str = decrypted_data.decode('utf-8')
        log.info(f"Décodage UTF-8 réussi: {len(decoded_str)} caractères")

        # Aperçu sécurisé (premiers 100 caractères)
        preview = decoded_str[:100] + ("..." if len(decoded_str) > 100 else "")
        log.debug(f"Aperçu JSON: {preview}")

        data = json.loads(decoded_str)

        # Log du type et de la structure (sans révéler le contenu sensible)
        data_type = type(data).__name__
        if isinstance(data, list):
            log.info(f"✅ Données déchiffrées: type={data_type}, length={len(data)}")
            if len(data) > 0 and isinstance(data[0], dict):
                log.info(f"   Premier élément keys: {list(data[0].keys())}")
        elif isinstance(data, dict):
            log.info(f"✅ Données déchiffrées: type={data_type}, keys={list(data.keys())}")
        else:
            log.warning(f"⚠️ Type inattendu: {data_type}")

        return data

    except FileNotFoundError:
        log.error(f"❌ Fichier introuvable: {path}")
        raise
    except json.JSONDecodeError as e:
        log.error(f"❌ Erreur de parsing JSON: {str(e)}")
        log.error(f"   Position: line {e.lineno}, column {e.colno}")
        raise
    except Exception as e:
        log.error(f"❌ Erreur lors du déchiffrement: {type(e).__name__}: {str(e)}", e)
        raise


def decryptData(key, data):
    """
    Déchiffre des données et retourne le JSON parsé

    Args:
        key: Clé de chiffrement Fernet
        data: Données chiffrées (bytes)

    Returns:
        dict ou list: Données déchiffrées et parsées
    """
    try:
        # Validate key early to provide a clearer error message
        if key is None:
            log.error('Encryption key is not initialized (None)')
            raise ValueError('Encryption key is not initialized')
        cipher_suite = Fernet(key)

        # Déchiffrer les données
        log.info(f"Déchiffrement de {len(data)} bytes")
        decrypted_data = cipher_suite.decrypt(data)
        log.info(f"Déchiffrement réussi: {len(decrypted_data)} bytes")

        # Parser le JSON
        decoded_str = decrypted_data.decode('utf-8')
        data_parsed = json.loads(decoded_str)

        data_type = type(data_parsed).__name__
        if isinstance(data_parsed, list):
            log.info(f"✅ Données déchiffrées: type={data_type}, length={len(data_parsed)}")
        elif isinstance(data_parsed, dict):
            log.info(f"✅ Données déchiffrées: type={data_type}, keys={list(data_parsed.keys())}")
        else:
            log.warning(f"⚠️ Type inattendu: {data_type}")

        return data_parsed

    except json.JSONDecodeError as e:
        log.error(f"❌ Erreur de parsing JSON: {str(e)}", e)
        raise
    except Exception as e:
        log.error(f"❌ Erreur lors du déchiffrement: {type(e).__name__}: {str(e)}", e)
        raise