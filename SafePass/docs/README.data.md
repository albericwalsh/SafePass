# Données, stockage et migration — SafePass

Ce document décrit où SafePass stocke ses données, comment elles sont initialisées, et les points clés de migration/compatibilité.

## Vue d’ensemble

Le runtime SafePass privilégie un stockage utilisateur dans AppData, avec une structure contrôlée par le backend.

Composants principaux :

- paramètres applicatifs (`settings.json`),
- fichier de données chiffrées (`.sfpss`),
- token de chiffrement,
- token extension,
- répertoire de sauvegardes et cache.

Référence centrale : [back/app.py](../back/app.py).

## Arborescence runtime

D’après `get_system_paths()` :

- racine : `%APPDATA%/SafePass` (ou fallback `%LOCALAPPDATA%` / profil utilisateur),
- settings : `%APPDATA%/SafePass/settings.json`,
- données : `%APPDATA%/SafePass/data/mdp.sfpss`,
- token chiffrement : `%APPDATA%/SafePass/data/mdp.token`,
- hash master password : `%APPDATA%/SafePass/data/.master_password.json`,
- token extension : `%APPDATA%/SafePass/data/extention_token.json` (+ legacy `extension_token.json`),
- sauvegardes : `%APPDATA%/SafePass/backup`,
- cache : `%APPDATA%/SafePass/cache`.

## Initialisation automatique

Au démarrage backend, `ensure_system_tree()` :

1. crée les dossiers manquants,
2. crée/normalise `settings.json`,
3. initialise les fichiers token extension (courant + legacy),
4. prépare le runtime pour les routes de lecture/écriture.

Référence : [back/app.py](../back/app.py).

## Format des settings

Les settings suivent un schéma structuré :

- `display`
- `general`
- `security`
- `storage`
- `advanced`

`normalize_settings_for_persist()` applique :

- valeurs par défaut,
- remappage de clés legacy vers sections actuelles,
- normalisation des chemins critiques (`backup_location`, `extension_token_path`, logs).

## Données coffre (`.sfpss`)

Le backend lit/écrit les entrées SafePass dans un fichier chiffré `.sfpss`.

Routes liées :

- [back/routes/data_routes.py](../back/routes/data_routes.py)
  - `GET /getData`
  - `POST /saveData`
- [back/routes/path_routes.py](../back/routes/path_routes.py)
  - `POST /initialize-data-file`

`/saveData` supporte :

- sauvegarde dataset complet,
- sauvegarde ciblée d’une entrée extension (`extension_entry`).

## Sélection du chemin de données

La résolution du fichier de données passe par `get_data_paths()` :

1. priorité à `storage.data_path` (settings),
2. fallback sur chemin canonique AppData,
3. filtrage strict extension `.sfpss`.

Référence : [back/app.py](../back/app.py).

## Migration et compatibilité legacy

Le backend garde des compatibilités legacy :

- lecture seed initiale depuis ancien `data/settings.json` projet,
- gestion token extension legacy `extension_token.json`,
- remappage de clés settings historiques vers nouveau schéma sectionné.

Objectif : migration progressive sans casser les installations existantes.

## Sauvegardes

Les paramètres de sauvegarde sont portés par `storage` :

- `backup_enabled`
- `backup_interval_days`
- `backup_location`
- `backup_history_count`

Le dossier de backup canonique est créé sous AppData runtime.

## Sécurité des données (minimum)

- Ne jamais versionner les fichiers runtime AppData.
- Protéger accès au compte utilisateur hébergeant AppData.
- Ne pas exposer tokens/fichiers sensibles dans logs ou exports.
- Vérifier que les écritures passent par les routes backend (pas d’édition manuelle concurrente).

## Dépannage data/storage

En cas de problème de lecture/écriture :

1. vérifier existence des dossiers AppData SafePass,
2. vérifier validité du token chiffrement,
3. vérifier que `storage.data_path` pointe vers un `.sfpss` valide,
4. tester `/validate-path`, `/ensure-token`, `/initialize-data-file`,
5. relancer backend en mode CLI pour logs détaillés.

## Références

- [Architecture backend](README.backend.md)
- [Routes API](README.api.md)
- [Sécurité et chiffrement](README.security.md)
- [Frontend (structure UI)](README.frontend.md)
