# SafePass Extension

Cette extension navigateur complète SafePass pour récupérer et remplir des identifiants directement dans les formulaires web.

Ce README couvre uniquement la base du fonctionnement.
Les détails techniques sont renvoyés vers des README dédiés (section Documentation détaillée).

## Fonctionnement de base

### Vue d'ensemble

L'extension fonctionne avec le backend local SafePass (API sur `localhost:5000`) :

1. l'utilisateur fait un clic droit dans un champ éditable,
2. l'extension récupère le domaine de la page,
3. elle demande les identifiants au backend,
4. elle affiche une liste de comptes disponibles,
5. au clic sur un compte, elle remplit les champs login/mot de passe.

En parallèle, l'extension peut envoyer au backend des champs détectés pour enrichir les entrées (`/saveData`).

### Composants principaux

- `manifest.json` : déclaration MV3, permissions, scripts et popup.
- `src/background.js` : service worker (statut backend, menu contextuel, appels API, icône).
- `src/content.js` : logique d'injection/remplissage des formulaires.
- `src/utils.js` : utilitaires DOM et remplissage.
- `popup.html` + `src/popup.js` : UI de statut et gestion du jeton extension.

### API backend utilisée

- `GET /test` : test de disponibilité backend.
- `GET /settings` : lecture de `detect_enabled`.
- `GET /credentials?url=<domaine>` : récupération des identifiants.
- `POST /saveData` : envoi des champs détectés.
- `GET /extension/token` : contrôle validité/expiration du jeton.

Header d'authentification extension : `X-Ext-Auth` (si un jeton est configuré).

## Démarrage rapide (dev)

### Prérequis

- SafePass backend démarré localement.
- Port API accessible : `http://localhost:5000`.
- Navigateur Chromium (Chrome, Edge, Brave...).

### Charger l'extension

1. Ouvrir `chrome://extensions` (ou équivalent).
2. Activer le mode développeur.
3. Choisir **Load unpacked**.
4. Sélectionner le dossier `SafePass-Extention`.

### Configurer le jeton (recommandé)

1. Ouvrir la popup de l'extension.
2. Saisir le jeton partagé avec SafePass.
3. Cliquer sur **Enregistrer le jeton**.
4. Vérifier l'état de connexion et l'icône de validité.

## Sécurité (minimum attendu)

- N'ajoutez jamais de secrets (token, clés, `.pem`) dans Git.
- En environnement exposé, placez l'API derrière HTTPS (reverse proxy TLS).
- Conservez l'authentification extension via `X-Ext-Auth` active.
- Ne packagez pas d'artefacts locaux ni de sauvegardes sensibles.

## Packaging (résumé)

Pour un package Chromium, inclure au minimum :

- `manifest.json`
- `popup.html`
- `src/`
- `icon.png`, `icon_ok.png`, `icon_failed.png`

Exclure les fichiers temporaires, secrets et artefacts de build non nécessaires.

## Documentation détaillée

### Disponible

- [Charte UI extension](../../SafePass-Extention/src/STYLE_GUIDE.md)
- [Architecture extension](README.architecture.md)
- [Flux API extension ↔ backend](README.api-flow.md)
- [Sécurité extension](README.security.md)
- [Guide debug & troubleshooting](README.debug.md)
- [Guide publication navigateur](README.release.md)
