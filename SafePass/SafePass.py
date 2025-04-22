import log
import app


def main():
    # Créer un fichier de log
    log.log('SafePass starting')
    try:
        # Démarrer app.py dans une nouvelle fenêtre de commande
        # os.system(f'start cmd /k python ./SafePass/app.py"')
        app.run()

    except Exception as e:
        log.log(f'error: {str(e)}')


if __name__ == "__main__":
    log.initialize()
    main()
