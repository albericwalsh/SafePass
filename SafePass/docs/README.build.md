# Build et lancement développeur (Windows)

## Objectif

Cette page documente le flux recommandé pour :

- lancer SafePass en dev,
- construire les exécutables Windows,
- valider rapidement le résultat d’un build.

Règle projet : toute modification du process doit être reflétée dans cette documentation dans le même commit.

## Prérequis

- Python installé.
- Environnement virtuel projet (`.venv`).
- Dépendances Python installées (`requirements.txt`).
- Node.js disponible (frontend local lancé par `SafePass.py`).
- Outil `pybuilder` disponible dans l’environnement activé (si utilisé pour le bump + build).

## Lancement en mode développement

PowerShell :

```powershell
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
py SafePass.py
```

Notes :

- Le backend écoute par défaut sur `127.0.0.1:5000`.
- Le launcher démarre ensuite le frontend local (Node) et peut ouvrir le navigateur.
- En runtime, les données/settings sont gérés via l’arborescence AppData SafePass.

## Build standard (recommandé)

PowerShell :

```powershell
. .venv\Scripts\Activate.ps1
echo y | pybuilder --bump fix --spec SafePass.spec --name SafePass
```

Variantes de version :

- `--bump fix` : correctif,
- `--bump minor` : évolution mineure,
- `--bump major` : version majeure.

## Build direct PyInstaller (fallback)

Si tu veux builder sans `pybuilder` :

```powershell
. .venv\Scripts\Activate.ps1
py -m PyInstaller SafePass.spec
```

## Rebuild propre (quand des process tournent déjà)

```powershell
Get-Process | Where-Object { $_.Name -in @('SafePass','SafePassBackend','node') } | Stop-Process -Force
Start-Sleep -Seconds 1
py -m PyInstaller SafePass.spec
```

## Artefacts attendus

Le spec produit :

- `SafePass` (backend + frontend),
- `SafePassBackend` (backend seul).

Selon ton mode/build, les exécutables peuvent apparaître soit dans `dist/`, soit dans `dist/SafePass/` (onedir PyInstaller).

## Exécution des binaires

Mode normal :

```powershell
./dist/SafePass.exe
```

Mode console (debug) :

```powershell
./dist/SafePass.exe --cli
./dist/SafePassBackend.exe --cli
```

## Validation rapide après build

1. Lancer `SafePass.exe --cli`.
2. Vérifier que le backend répond sur `/test`.
3. Vérifier l’ouverture frontend et les opérations basiques (lecture/sauvegarde).
4. Vérifier les logs en cas d’erreur.

## Dépannage rapide

- **Build échoue / fichiers verrouillés** : tuer `SafePass`, `SafePassBackend`, `node`, puis rebuild.
- **Lancement dev échoue** : vérifier venv activé + dépendances installées.
- **Backend non joignable** : vérifier port `5000` et logs console (`--cli`).

## Références

- [README principal](../README.md)
- [Release, build et installation](README.release.md)
- [Tests et validation](README.tests.md)
