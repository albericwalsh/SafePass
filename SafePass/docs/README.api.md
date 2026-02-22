# Routes API SafePass

Ce document référence les endpoints backend exposés actuellement par SafePass.

## Base URL

- Développement local : `http://localhost:5000`

## Conventions générales

- Format de réponse : JSON (sauf endpoints de fichiers/ressources).
- Auth session (quand activée) : header `X-Auth-Token` ou query param `token`.
- Auth extension : header `X-Ext-Auth`.
- Certaines routes dépendent des settings (`master_password_enabled`, `detect_enabled`).

## Santé et settings

Source : [back/routes/settings_admin.py](../back/routes/settings_admin.py)

- `GET /test` — test de disponibilité backend.
- `GET /settings` — lecture des paramètres applicatifs.
- `POST /settings` — mise à jour des paramètres applicatifs.

## Authentification admin/session

Source : [back/routes/auth_routes.py](../back/routes/auth_routes.py)

- `POST /auth/unlock` — déverrouillage et émission de token de session.
- `POST /admin/export_password` — gestion mot de passe d’export.
- `POST /admin/master_password` — définir le mot de passe maître.
- `POST /admin/master_password/change` — changer le mot de passe maître.
- `POST /admin/master_password/reset` — réinitialiser le mot de passe maître.
- `POST /admin/master_password/file` — gestion fichier/hash mot de passe maître.

## Données coffre

Source : [back/routes/data_routes.py](../back/routes/data_routes.py)

- `POST /saveData` — sauvegarde/modification d’entrée(s) SafePass.
- `GET /getData` — lecture des données (protégée si master password activé).

## URL / détection / credentials

Source : [back/routes/url_routes.py](../back/routes/url_routes.py)

- `POST /url` — traitement d’URL côté backend.
- `GET /credentials` — récupération d’identifiants pour un domaine.

Notes :

- `GET /credentials` utilise le paramètre `url` (domaine).
- Si un token extension est actif, `X-Ext-Auth` est requis.
- Le comportement dépend de `detect_enabled`.

## Token extension

Source : [back/routes/extension_routes.py](../back/routes/extension_routes.py)

- `GET /extension/token` — lecture token extension courant + expiration.
- `POST /extension/token` — régénération token extension.

## Chiffrement

Source : [back/routes/crypting_routes.py](../back/routes/crypting_routes.py)

- `GET /decryptData` — déchiffrement selon logique applicative.
- `GET /cryptData` — chiffrement selon logique applicative.

## Import / export / assets

Source : [back/routes/export_routes.py](../back/routes/export_routes.py)

- `POST /exportCSV` — export des données en CSV.
- `POST /importCSV` — import CSV.
- `GET /brand-icon` — ressource icône marque.
- `GET /favicon` — récupération favicon distante (proxy backend).

## Logs

Source : [back/routes/logs_routes.py](../back/routes/logs_routes.py)

- `GET /api/logs` — lecture logs (API).
- `GET /api/logs/all` — lecture consolidée logs.
- `GET /api/logs/updates` — polling/updates logs.
- `GET /api/logs/<path:filename>` — lecture fichier de log ciblé.
- `GET /admin/logs` — vue/endpoint admin logs.
- `GET /admin/logs/list` — liste fichiers de logs.
- `GET /admin/logs/file` — récupération d’un fichier de logs.

## Paths et initialisation stockage

Source : [back/routes/path_routes.py](../back/routes/path_routes.py)

- `POST /select-path` (+ `OPTIONS`) — sélection/validation de chemin.
- `POST /validate-path` (+ `OPTIONS`) — validation chemin.
- `POST /ensure-token` (+ `OPTIONS`) — création/validation token file.
- `POST /initialize-data-file` (+ `OPTIONS`) — initialisation fichier de données.

## Intégrations sécurité/veille

Sources :

- [back/routes/anssi_routes.py](../back/routes/anssi_routes.py)
- [back/routes/leaks_routes.py](../back/routes/leaks_routes.py)

Endpoints repérés :

- `GET /api/anssi/recommendations`
- `POST /api/leaks/rss-matches`

## Points d’attention

- Certaines routes changent de comportement selon les settings runtime.
- Plusieurs endpoints admin supposent un contexte local de confiance.
- Les routes extension et session doivent rester alignées avec les docs :
  - [docs/extension/README.api-flow.md](extension/README.api-flow.md)
  - [docs/extension/README.security.md](extension/README.security.md)

## Références

- [Architecture backend](README.backend.md)
- [Sécurité et chiffrement](README.security.md)
