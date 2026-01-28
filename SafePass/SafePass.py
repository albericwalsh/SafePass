import log
import app
import subprocess
import time
import threading

def start_frontend():
    """Lance le serveur frontend Express.js"""
    try:
        print("Lancement du frontend Express.js...")
        log.info("Lancement du frontend Express.js...")
        # Lancer le serveur Express en arrière-plan sans ouvrir de console
        try:
            creationflags = subprocess.CREATE_NO_WINDOW
        except AttributeError:
            # Fallback pour CREATE_NO_WINDOW non disponible
            creationflags = 0x08000000

        subprocess.Popen(
            ['node', 'index.js'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
            cwd='.'
        )
        print("✓ Frontend Express.js démarré sur http://localhost:3000")
        log.info("Frontend Express.js démarré sur http://localhost:3000")
    except Exception as e:
        print(f"✗ Erreur lors du lancement du frontend: {str(e)}")
        log.error(f"Erreur lors du lancement du frontend: {str(e)}")

def wait_for_frontend():
    """Attendre que le frontend Express.js soit prêt"""
    import requests
    max_attempts = 15
    for attempt in range(max_attempts):
        try:
            response = requests.get('http://localhost:3000/', timeout=2)
            if response.status_code in (200, 304):
                print(f"✓ Frontend prêt après {attempt+1} tentatives")
                log.info("Frontend prêt")
                return True
        except Exception as e:
            print(f"Frontend tentative {attempt+1}/{max_attempts}: {str(e)}")
        time.sleep(1)
    print("✗ Frontend non détecté après plusieurs tentatives")
    log.warning("Frontend non détecté après plusieurs tentatives")
    return False


def is_backend_running():
    """Retourne True si le backend répond déjà sur le port 5000."""
    try:
        import requests
        r = requests.get('http://127.0.0.1:5000/test', timeout=1)
        return r.status_code == 200
    except Exception:
        return False

def wait_for_backend():
    """Attendre que le backend Flask soit prêt"""
    import requests
    max_attempts = 15
    for attempt in range(max_attempts):
        try:
            response = requests.get('http://127.0.0.1:5000/test', timeout=2)
            if response.status_code == 200:
                print(f"✓ Backend Flask prêt après {attempt+1} tentatives")
                log.info("Backend Flask prêt")
                return True
        except Exception as e:
            print(f"Tentative {attempt+1}/{max_attempts}: {str(e)}")
        time.sleep(1)
    print("✗ Backend Flask non détecté après plusieurs tentatives")
    log.warning("Backend Flask non détecté après plusieurs tentatives")
    return False

def main():
    # Créer un fichier de log
    log.info('SafePass starting')
    try:
        # Vérifier si un backend est déjà présent
        if is_backend_running():
            print("Backend déjà en cours d'exécution, pas de nouveau démarrage.")
            log.info("Backend déjà en cours d'exécution, skip start")
            flask_thread = None
        else:
            # Démarrer le backend Flask dans un thread séparé
            flask_thread = threading.Thread(target=app.run)
            flask_thread.daemon = True
            flask_thread.start()

        # Attendre que le backend soit prêt
        print("Attente du démarrage du backend Flask...")
        if wait_for_backend():
            print("Backend Flask prêt - lancement du frontend...")
            # Lancer le frontend une fois le backend prêt
            start_frontend()

            # Attendre que le frontend réponde puis ouvrir le navigateur
            if wait_for_frontend():
                try:
                    import webbrowser
                    webbrowser.open('http://localhost:3000')
                    log.info("Navigateur ouvert sur http://localhost:3000")
                except Exception as e:
                    log.error(f"Impossible d'ouvrir le navigateur: {e}")
            else:
                log.warning("Frontend non disponible, navigateur non ouvert")
        else:
            print("Erreur: Backend non disponible")
            log.error("Impossible de démarrer le frontend - backend non disponible")

        # Si on a démarré le backend ici, on attend son thread, sinon on quitte
        if flask_thread is not None:
            flask_thread.join()
        else:
            import sys
            print("Launcher terminé (backend déjà en cours).")
            sys.exit(0)

    except Exception as e:
        print(f"Erreur: {str(e)}")
        log.error(f'error: {str(e)}')


if __name__ == "__main__":
    log.initialize()
    main()
