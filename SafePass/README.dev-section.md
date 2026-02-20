## Lancement en mode développement

- **But:** Lancer l'application localement pour développement et débogage.
- **Prérequis:** Python 3.10+, `virtualenv` et `pip`.
- **Étapes (PowerShell) :**

```powershell
python -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Créer le répertoire data si nécessaire
mkdir data -ErrorAction Ignore
# Générer la clé de chiffrement (créera `data/.token`)
python "back/crypting/generate a crypting key.py" > data/.token
# Lancer l'application
python app.py
```

- **Remarques :**
  - L'application lit la clé de chiffrement depuis `data/.token` (fichier binaire ASCII). Gardez-la secrète.
  - Pour activer le mode débogage, éditez `data/settings.json` et mettez `"debug_mode": true` ou créez le fichier avec :

```powershell
mkdir data -ErrorAction Ignore
'{ "debug_mode": true }' | Out-File -Encoding utf8 data\settings.json
```

- **Port/host :** par défaut `127.0.0.1:5000`. Modifiez `data/settings.json` pour changer `server_host` / `server_port` ou activer `allow_remote_connections`.
