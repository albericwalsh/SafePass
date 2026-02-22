import os
import sys
import ctypes

from back import log

# If running in a frozen environment (PyInstaller), add library paths
if getattr(sys, 'frozen', False):
    bundle_dir = getattr(sys, '_MEIPASS', None)
    if not bundle_dir:
        bundle_dir = os.path.dirname(sys.executable)
    sys.path.insert(0, bundle_dir)

from back import app


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


def is_backend_running():
    """Retourne True si le backend répond déjà sur le port 5000."""
    try:
        import requests
        r = requests.get('http://127.0.0.1:5000/test', timeout=1)
        return r is not None
    except Exception:
        return False


def main():
    _enable_cli_console_if_requested()
    log.info('SafePass backend-only launcher starting')
    try:
        started_by_system = False
        try:
            if '--startup' in sys.argv or os.environ.get('SAFEPASS_AUTOSTART') in ('1', 'true', 'True'):
                started_by_system = True
        except Exception:
            started_by_system = False

        log.info(f'Backend-only started by system: {started_by_system}')

        if is_backend_running():
            print("Backend déjà en cours d'exécution, arrêt du launcher backend-only.")
            log.info('Backend already running, backend-only launcher exits')
            return

        host = app.SETTINGS.get('server_host', '127.0.0.1')
        port = int(app.SETTINGS.get('server_port', 5000) or 5000)
        if app.SETTINGS.get('allow_remote_connections'):
            host = '0.0.0.0'
        debug_flag = bool(app.SETTINGS.get('debug_mode', False))

        log.info(f"Lancement backend-only (host={host} port={port} debug={debug_flag})")
        app.app.run(host=host, port=port, debug=debug_flag)
    except Exception as e:
        print(f"Erreur backend-only: {str(e)}")
        log.error(f'backend-only error: {str(e)}')


if __name__ == '__main__':
    log.initialize()
    main()
