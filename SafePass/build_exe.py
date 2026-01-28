import PyInstaller.__main__
import os

# Configuration pour PyInstaller
args = [
    'SafePass.py',           # Fichier principal
    '--onefile',             # Créer un seul fichier exécutable
    '--name=SafePass',       # Nom de l'exécutable
    '--icon=res/icon.ico',   # Icône de l'application (si disponible)
    '--add-data=data;data',  # Inclure le dossier data
    '--add-data=public;public',  # Inclure le dossier public
    '--add-data=res;res',    # Inclure le dossier res
    '--hidden-import=flask', # Imports cachés nécessaires
    '--hidden-import=flask_cors',
    '--hidden-import=cryptography',
    '--hidden-import=gevent',
    '--hidden-import=gevent.websocket',
    '--clean',               # Nettoyer le cache
    '--noconsole',           # Masquer la console (mode fenêtré)
]

print("Construction de l'exécutable SafePass...")
PyInstaller.__main__.run(args)