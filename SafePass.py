from back import log
import sys
import os
import ctypes

# If running in a frozen environment (PyInstaller), add library paths
if getattr(sys, 'frozen', False):
    # Add the bundle directory to sys.path so it can find modules
    bundle_dir = sys._MEIPASS
    sys.path.insert(0, bundle_dir)  # This allows imports from the bundle

from back import app
import subprocess
import time
import threading

FRONTEND_BASE_URL = 'http://localhost:3000'
FRONTEND_HEALTH_URL = f'{FRONTEND_BASE_URL}/health'
BACKEND_FRONT_URL = 'http://127.0.0.1:5000/'


def _runtime_root_dir():
    try:
        if getattr(sys, 'frozen', False):
            return os.path.dirname(sys.executable)
        return os.path.dirname(os.path.abspath(__file__))
    except Exception:
        return os.getcwd()


def _enable_cli_console_if_requested():
    try:
        wants_cli = ('--cli' in sys.argv) or (os.environ.get('SAFEPASS_CLI') in ('1', 'true', 'True'))
        if not wants_cli:
            return False

        if '--cli' in sys.argv:
            try:
                sys.argv.remove('--cli')
            except Exception:
                pass

        kernel32 = ctypes.windll.kernel32
        attached = bool(kernel32.AttachConsole(-1))
        if not attached:
            kernel32.AllocConsole()

        try:
            sys.stdout = open('CONOUT$', 'w', encoding='utf-8', buffering=1)
            sys.stderr = open('CONOUT$', 'w', encoding='utf-8', buffering=1)
            sys.stdin = open('CONIN$', 'r', encoding='utf-8', buffering=1)
        except Exception:
            pass

        return True
    except Exception:
        return False

def _diagnose_frontend_port_conflict():
    try:
        import requests
        response = requests.get(FRONTEND_BASE_URL + '/', timeout=2)
        status = response.status_code
        server = response.headers.get('server', 'unknown')
        csp = response.headers.get('content-security-policy', '')
        log.warning(
            f"Port 3000 occupé par un autre service (status={status}, server={server}, csp={'present' if csp else 'absent'})"
        )
        print("✗ Port 3000 occupé par un autre service. Ferme l'application qui utilise ce port puis relance SafePass.")
    except Exception:
        log.warning("Frontend indisponible sur localhost:3000 après démarrage")


def wait_for_backend_front(max_attempts=5, delay_seconds=0.6, quiet=False):
    """Vérifie que le frontend statique servi par Flask est disponible."""
    import requests
    for attempt in range(max_attempts):
        try:
            response = requests.get(BACKEND_FRONT_URL, timeout=2)
            if response.status_code in (200, 304):
                if not quiet:
                    print(f"✓ Frontend Flask prêt après {attempt+1} tentatives")
                    log.info("Frontend Flask prêt")
                return True
        except Exception as e:
            if not quiet:
                print(f"Frontend Flask tentative {attempt+1}/{max_attempts}: {str(e)}")
        time.sleep(delay_seconds)
    if not quiet:
        print("✗ Frontend Flask non détecté")
        log.warning("Frontend Flask non détecté")
    return False


def start_frontend():
    """Lance le serveur frontend Express.js"""
    try:
        if wait_for_frontend(max_attempts=2, delay_seconds=0.5, quiet=True):
            print("✓ Frontend déjà actif sur http://localhost:3000")
            log.info("Frontend déjà actif sur http://localhost:3000")
            return FRONTEND_BASE_URL

        print("Lancement du frontend Express.js...")
        log.info("Lancement du frontend Express.js...")
        runtime_root = _runtime_root_dir()
        meipass_root = getattr(sys, '_MEIPASS', runtime_root)

        frontend_candidates = [
            os.path.join(meipass_root, 'index.js'),
            os.path.join(runtime_root, 'index.js'),
        ]
        frontend_entry = next((path for path in frontend_candidates if os.path.exists(path)), None)

        if not frontend_entry:
            raise FileNotFoundError(
                f"Frontend introuvable. Candidats testés: {', '.join(frontend_candidates)}"
            )

        frontend_cwd = os.path.dirname(frontend_entry)

        # Lancer le serveur Express en arrière-plan sans ouvrir de console
        try:
            creationflags = subprocess.CREATE_NO_WINDOW
        except AttributeError:
            # Fallback pour CREATE_NO_WINDOW non disponible
            creationflags = 0x08000000

        subprocess.Popen(
            ['node', frontend_entry],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
            cwd=frontend_cwd
        )
        if wait_for_frontend(max_attempts=8, delay_seconds=1, quiet=True):
            print("✓ Frontend Express.js démarré sur http://localhost:3000")
            log.info("Frontend Express.js démarré sur http://localhost:3000")
            return FRONTEND_BASE_URL

        _diagnose_frontend_port_conflict()
        if wait_for_backend_front(max_attempts=4, delay_seconds=0.7, quiet=True):
            print("✓ Fallback frontend actif via Flask sur http://127.0.0.1:5000/")
            log.info("Fallback frontend actif via Flask sur http://127.0.0.1:5000/")
            return BACKEND_FRONT_URL
        return None
    except Exception as e:
        print(f"✗ Erreur lors du lancement du frontend Express: {str(e)}")
        log.error(f"Erreur lors du lancement du frontend Express: {str(e)}")
        if wait_for_backend_front(max_attempts=6, delay_seconds=0.7, quiet=True):
            print("✓ Fallback frontend actif via Flask sur http://127.0.0.1:5000/")
            log.info("Fallback frontend actif via Flask sur http://127.0.0.1:5000/")
            return BACKEND_FRONT_URL
        return None

def wait_for_frontend(max_attempts=15, delay_seconds=1, quiet=False):
    """Attendre que le frontend Express.js soit prêt"""
    import requests
    for attempt in range(max_attempts):
        try:
            response = requests.get(FRONTEND_HEALTH_URL, timeout=2)
            if response.status_code == 200:
                if not quiet:
                    print(f"✓ Frontend prêt après {attempt+1} tentatives")
                    log.info("Frontend prêt")
                return True
        except Exception as e:
            if not quiet:
                print(f"Frontend tentative {attempt+1}/{max_attempts}: {str(e)}")
        time.sleep(delay_seconds)
    if not quiet:
        print("✗ Frontend non détecté après plusieurs tentatives")
        log.warning("Frontend non détecté après plusieurs tentatives")
    return False


def is_backend_running():
    """Retourne True si le backend répond déjà sur le port 5000."""
    try:
        import requests
        r = requests.get('http://127.0.0.1:5000/test', timeout=1)
        return r is not None
    except Exception:
        return False

def wait_for_backend():
    """Attendre que le backend Flask soit prêt"""
    import requests
    max_attempts = 15
    for attempt in range(max_attempts):
        try:
            response = requests.get('http://127.0.0.1:5000/test', timeout=2)
            if response is not None:
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
    _enable_cli_console_if_requested()
    # Créer un fichier de log
    log.info('SafePass starting')
    try:
        # Detect if launcher was invoked as an automated startup (e.g. Windows task at login)
        started_by_system = False
        try:
            if '--startup' in sys.argv or os.environ.get('SAFEPASS_AUTOSTART') in ('1', 'true', 'True'):
                started_by_system = True
        except Exception:
            started_by_system = False
        log.info(f'Started by system: {started_by_system}')
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
            cfg_open = True
            try:
                cfg_open = bool(app.SETTINGS.get('open_front_on_start', True))
            except Exception:
                cfg_open = True

            launch_frontend = (not started_by_system) or cfg_open

            if launch_frontend:
                print("Backend Flask prêt - lancement du frontend...")
                # Lancer le frontend une fois le backend prêt
                frontend_url = start_frontend()
            else:
                print("Backend Flask prêt - frontend ignoré (startup + open_front_on_start=false)")
                log.info("Frontend non lancé au démarrage système (open_front_on_start=false)")
                frontend_url = None

            frontend_ready = bool(frontend_url)

            # Attendre que le frontend réponde puis ouvrir le navigateur only for manual starts
            try_open = False
            try:
                # respect runtime setting but do not open when started automatically
                if (not started_by_system) and cfg_open:
                    try_open = True
            except Exception:
                try_open = False

            if launch_frontend and try_open and frontend_ready:
                try:
                    import webbrowser
                    webbrowser.open(frontend_url)
                    log.info(f"Navigateur ouvert sur {frontend_url}")
                except Exception as e:
                    log.error(f"Impossible d'ouvrir le navigateur: {e}")
            else:
                if launch_frontend:
                    if frontend_ready:
                        log.info("Frontend démarré mais navigateur non ouvert (automated start or disabled)")
                    else:
                        log.warning("Frontend non prêt, navigateur non ouvert")
                else:
                    log.info("Mode backend-only actif pour ce démarrage")
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
