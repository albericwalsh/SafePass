# SafePass

SafePass est une application de gestion sécurisée de mots de passe avec une architecture hybride :

- un backend Python (API locale),
- une interface web locale (frontend),
- un packaging desktop Windows via PyInstaller.

Ce README explique uniquement la base du fonctionnement du projet.
Toute la documentation détaillée est découpée dans des README dédiés (voir section plus bas).

## Fonctionnement de base

### 1) Démarrage global

Le point d'entrée principal démarre le backend puis sert/ouvre l'interface utilisateur locale.

- `SafePass.py` : lancement en mode développement.
- `SafePass.exe` : lancement packagé (backend + frontend).
- `SafePassBackend.exe` : backend seul.

Option CLI :

- `SafePass.exe --cli`
- `SafePassBackend.exe --cli`

Le mode `--cli` force une console visible pour suivre les logs en direct.

### 2) Backend

Le backend vit dans `back/` et expose les routes API via `back/app.py` et `back/router.py`.
Il gère notamment :

- l'authentification,
- la cryptographie/chiffrement,
- l'export,
- les paramètres,
- les logs,
- les intégrations (fuites, extensions, URL, ANSSI, etc.).

### 3) Frontend

Le frontend principal est dans `public/` :

- pages HTML (`index.html`, `logs.html`, `parameters.html`),
- scripts JS (`public/js/...`),
- styles (`public/style/...`),
- traductions (`public/locales/...`).

L'UI consomme les endpoints du backend local.

### 4) Données et configuration

- `data/` : paramètres internes de l'application.
- `data.json` / `data_test.json` : jeux de données selon contexte.
- `VERSION` : version applicative.

Les informations sensibles et fichiers de runtime doivent rester hors versionnement Git.

## Documentation détaillée

Règle projet : toute modification fonctionnelle ou technique doit inclure la mise à jour de la documentation concernée dans le même commit.

### Déjà disponible

- [Build / packaging principal](docs/README.build.md)
- [Extension navigateur](docs/extension/README.md)

### Documentation disponible

- [Architecture backend](docs/README.backend.md)
- [Routes API](docs/README.api.md)
- [Sécurité et chiffrement](docs/README.security.md)
- [Frontend (structure UI)](docs/README.frontend.md)
- [Données, stockage et migration](docs/README.data.md)
- [Tests et validation](docs/README.tests.md)
- [Release, build et installation](docs/README.release.md)
- [Guide de contribution](docs/README.contrib.md)

## Build (résumé)

Le build Windows est géré par `SafePass.spec` (PyInstaller) et l'outil `pybuilder`.

Exemple (PowerShell) :

```powershell
. .venv\Scripts\Activate.ps1
echo y | pybuilder --bump fix --spec SafePass.spec --name SafePass
```

Sortie attendue : exécutables dans `dist/SafePass/`.

## Licence

Ce projet est propriétaire (non open source).

- Titulaire des droits : Albéric WALSH DE SERRANT.
- Toute contribution est interdite sans validation explicite préalable avec trace écrite.

Voir [LICENSE](LICENSE).
