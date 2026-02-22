# SafePass — Build instructions

Usez de l'environnement virtuel du projet et du script `pybuilder` fourni pour construire l'application.

PowerShell (recommended):

1. Activer le virtualenv :

```powershell
. .venv\Scripts\Activate.ps1
```

2. Construire (exemples selon type de mise à jour de version) :

- Build pour une correction (patch / `fix`) :

```powershell
. .venv\Scripts\Activate.ps1
echo y | pybuilder --bump fix --spec SafePass.spec --name SafePass
```

- Build pour une petite amélioration (minor) :

```powershell
. .venv\Scripts\Activate.ps1
echo y | pybuilder --bump minor --spec SafePass.spec --name SafePass
```

- Build pour une grande version (major) :

```powershell
. .venv\Scripts\Activate.ps1
echo y | pybuilder --bump major --spec SafePass.spec --name SafePass
```

Remarques :

- N'utilisez `--bump refactory` que si vous souhaitez changer la numérotation majeure radicalement (non recommandé pour l'instant).
- Les commandes ci‑dessus supposent que `pybuilder` est l'outil projet personnalisé présent dans le PATH une fois le `venv` activé.
- Si PyInstaller demande confirmation pour supprimer `dist/`, la commande `echo y | ...` valide automatiquement la suppression.

Fichiers utiles :
- `SafePass.spec` — spec PyInstaller utilisée pour la build.
- `VERSION` — fichier contenant la version actuelle (mis à jour automatiquement par `pybuilder --bump`).

Exécutables générés :
- `SafePass.exe` : lance backend + frontend.
- `SafePassBackend.exe` : lance uniquement le backend (sans frontend).

Mode CLI (console à la demande) :
- `SafePass.exe --cli`
- `SafePassBackend.exe --cli`

Ce paramètre ouvre/attache une console Windows pour voir les sorties et logs en direct, tout en gardant le mode GUI par défaut sans console.

Après build avec `SafePass.spec`, les deux exécutables sont produits dans `dist/SafePass/`.

Usage conseillé pour le démarrage Windows :
- `open_front_on_start = true` → démarrage avec `SafePass.exe`.
- `open_front_on_start = false` → démarrage avec `SafePassBackend.exe`.
