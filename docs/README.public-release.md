# Publication vers le dépôt public

Ce document décrit le workflow entre :

- dépôt privé de développement : `albericwalsh/SafePass-dev`,
- dépôt public de diffusion : `albericwalsh/SafePass`.

## Objectif

Dans le dépôt public, on conserve uniquement :

- `README.md` (miroir de `docs/user/README.md`),
- `LICENCE`,
- `docs/user/**`.

Entrée principale de la doc utilisateur : `docs/user/README.md`.

Lors de la synchronisation, `README.md` racine est généré à partir de `docs/user/README.md` avec réécriture automatique des liens vers `docs/user/...`.

Les binaires sont publiés sous forme d'assets GitHub Release dans le dépôt public.

## Prérequis GitHub

Dans `SafePass-dev`, créer le secret Actions :

- `PUBLIC_REPO_TOKEN` : Personal Access Token avec accès en écriture sur `albericwalsh/SafePass`.

Permissions minimales recommandées sur le repo public :

- Contents: Read and write,
- Metadata: Read.

## Workflows disponibles

### 1) Synchronisation du contenu public

Workflow : `.github/workflows/sync-public-content.yml`

- Déclenchement manuel, ou automatiquement sur push de :
  - `LICENCE`,
  - `docs/user/**`.
- Action : met à jour le repo public pour ne contenir que `LICENCE` + `docs/user/**`.

### 2) Release publique manuelle

Workflow : `.github/workflows/release-public.yml`

Entrées :

- `version` (ex: `1.3.0`),
- `prerelease` (`true`/`false`),
- `release_notes` (optionnel, texte libre).

Actions :

1. synchronise `LICENCE` + doc user vers le repo public,
2. build Windows via `PyInstaller` (`SafePass.spec`),
3. crée un zip applicatif,
4. crée un zip de l'extension depuis `SafePass-Extention/`,
5. génère `SHA256SUMS.txt`,
6. génère automatiquement `RELEASE_NOTES.md` à partir de `.github/release-notes-template.md`,
7. crée la release `vX.Y.Z` dans `albericwalsh/SafePass`.

Règle obligatoire : une release publiée est immuable.

- ne pas écraser les assets d’un tag existant,
- en cas de correctif post-publication, incrémenter la version (ex: `1.2.1` → `1.2.2`) et publier un nouveau tag.

## Template de notes de release

Template source : `.github/release-notes-template.md`

Le workflow remplace automatiquement :

- `__TAG__` (ex: `v1.3.0`),
- `__VERSION__` (ex: `1.3.0`),
- `__DATE__` (date UTC du run),
- `__EXTRA_NOTES__` (valeur de l'input `release_notes`, ou `- Maintenance release` par défaut).

Si le tag existe déjà, la publication doit échouer : il faut publier une nouvelle version.

## Convention recommandée

- Développement quotidien dans `SafePass-dev`.
- Publication uniquement via workflow `Release to public repository`.
- Documentation utilisateur maintenue dans `docs/user/` côté privé.
