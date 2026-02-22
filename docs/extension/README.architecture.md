# Architecture de l'extension SafePass

Ce document décrit l’architecture technique de l’extension navigateur SafePass (Manifest V3) et ses interactions avec le backend local.

## Objectif

L’extension permet de :

- détecter le contexte d’une page de connexion,
- récupérer les identifiants correspondant au domaine courant,
- afficher une sélection d’identifiants,
- remplir les champs login / mot de passe de façon fiable,
- remonter certaines informations au backend (`/saveData`) si nécessaire.

## Vue d’ensemble

Architecture en 3 blocs :

1. **UI Popup** (`popup.html`, `src/popup.js`)
   - affiche l’état de connexion au backend,
   - permet de configurer le jeton `X-Ext-Auth`,
   - affiche un état de validité du jeton.

2. **Service Worker** (`src/background.js`)
   - point d’orchestration central,
   - gère menu contextuel et statut de connexion,
   - appelle les endpoints backend,
   - communique avec le content script,
   - met à jour l’icône d’état de l’extension.

3. **Content Script** (`src/content.js` + `src/utils.js`)
   - exécution dans les pages web,
   - collecte URL/contexte/champs,
   - affiche le modal de choix d’identifiants,
   - applique le remplissage des formulaires.

## Flux principal (remplissage)

1. L’utilisateur déclenche l’action via menu contextuel.
2. Le service worker demande le contexte de la page (domaine + position).
3. Le service worker appelle `GET /credentials?url=<domaine>`.
4. Le content script affiche un modal listant les comptes trouvés.
5. L’utilisateur choisit une entrée.
6. Le content script remplit les champs du formulaire.

## Flux secondaire (statut & token)

- La popup interroge le service worker (`getStatus`, `testConnection`).
- Le service worker teste le backend (`GET /test`) et lit les réglages (`GET /settings`).
- Le token local est stocké dans `chrome.storage.local` (`ext_token`).
- La validité est comparée avec `GET /extension/token`.
- Les appels sensibles incluent le header `X-Ext-Auth` quand disponible.

## Contrats backend utilisés

- `GET /test`
- `GET /settings`
- `GET /credentials?url=<domaine>`
- `POST /saveData`
- `GET /extension/token`

## Résilience et fallback

- Réinjection des scripts (`chrome.scripting.executeScript`) si un onglet n’a pas encore chargé le content script.
- Fallback UI si composant `aws-input` non disponible dans la popup.
- Fallback icône (path puis `imageData`) selon support navigateur.
- Gestion d’état “détection désactivée” si `detect_enabled = false`.

## Permissions et surface d’accès

Déclarées dans `manifest.json` :

- `tabs`, `activeTab`, `contextMenus`, `windows`, `scripting`, `storage`
- `host_permissions` sur `localhost:5000` / `127.0.0.1:5000`
- `content_scripts` sur `<all_urls>`

## Sécurité (principes)

- Authentification backend via jeton partagé (`X-Ext-Auth`).
- Aucune clé/secrets en dur dans le code.
- Limitation des permissions réseau aux hôtes locaux déclarés.
- Recommandation de TLS/reverse proxy en environnement exposé.

## Limites actuelles

- Dépendance au backend local disponible sur le port configuré.
- Fiabilité du remplissage dépendante de la structure DOM des sites.
- Le matching d’identifiants dépend de la qualité des données côté backend.

## Références

- [Doc extension (vue d’ensemble)](README.md)
- [Flux API extension ↔ backend](README.api-flow.md)
- [Sécurité extension](README.security.md)
- [Guide debug & troubleshooting](README.debug.md)
- [Guide publication navigateur](README.release.md)
- [Charte UI extension](../../SafePass-Extention/src/STYLE_GUIDE.md)
