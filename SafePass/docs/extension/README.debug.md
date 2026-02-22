# Guide debug & troubleshooting — Extension SafePass

Ce guide aide à diagnostiquer rapidement les problèmes de l’extension SafePass en développement et en test.

## Pré-check rapide

Avant d’investiguer en détail :

1. Backend SafePass lancé.
2. API locale accessible sur `http://localhost:5000`.
3. Extension rechargée depuis `chrome://extensions`.
4. Token configuré dans la popup si requis.
5. Site cible rechargé après installation/reload extension.

## Outils de debug à ouvrir

- **Popup** : clic sur l’icône extension pour lire l’état.
- **Service worker logs** :
  - `chrome://extensions` → extension → **Service worker** → Inspect.
- **Page cible (content script)** : DevTools onglet de la page.
- **Backend logs** : console SafePass (mode `--cli` conseillé).

## Symptômes fréquents et résolution

### 1) Statut “Échec de la connexion” dans la popup

Causes probables :

- backend non démarré,
- mauvais port/API indisponible,
- erreur réseau locale.

Vérifications :

- Tester `GET /test` depuis navigateur ou terminal.
- Regarder les erreurs `fetch` dans les logs service worker.
- Cliquer sur le bouton de reload dans la popup.

### 2) “Extension désactivée (detection inactive)”

Cause probable : `detect_enabled = false` côté paramètres backend.

Vérifications :

- Tester `GET /settings`.
- Vérifier la valeur `detect_enabled`.
- Réactiver la détection côté application SafePass puis relancer le test.

### 3) Menu contextuel visible mais aucun identifiant affiché

Causes probables :

- pas d’entrée correspondante pour le domaine,
- token invalide/refus backend,
- content script non injecté sur l’onglet.

Vérifications :

- Contrôler la requête `GET /credentials?url=...` dans les logs worker.
- Vérifier statut HTTP (`200` vs `401/403/404`).
- Recharger l’onglet, puis retester (l’extension tente une réinjection si nécessaire).

### 4) Le modal apparaît mais le remplissage échoue

Causes probables :

- structure DOM atypique,
- champs dynamiques remplacés par JS,
- iframe/Shadow DOM côté site cible.

Vérifications :

- Observer les logs `content.js` (candidats username/password).
- Tester sur une page simple pour isoler le bug.
- Vérifier que les champs sont visibles et réellement éditables.

### 5) Token affiché invalide dans la popup

Causes probables :

- token local différent du serveur,
- token expiré (`expires_at`),
- endpoint `/extension/token` inaccessible.

Vérifications :

- Effacer/réenregistrer le token dans la popup.
- Tester `GET /extension/token`.
- Vérifier les logs réseau popup/service worker.

## Procédure de diagnostic standard

1. Recharger extension.
2. Recharger onglet cible.
3. Vérifier popup (connexion + token).
4. Vérifier logs service worker.
5. Vérifier logs content script.
6. Vérifier logs backend.
7. Reproduire sur un second site de test.

Si l’étape 7 passe mais pas le site initial, le problème est probablement spécifique au DOM du site initial.

## Points de contrôle backend

- `/test` répond en `200`.
- `/settings` renvoie une structure JSON valide.
- `/credentials` renvoie `matches` cohérent pour le domaine.
- `/saveData` accepte le payload `extension_entry`.
- `/extension/token` renvoie token et expiration attendus.

## Points de contrôle extension

- `manifest.json` chargé sans erreur.
- permissions présentes (`contextMenus`, `scripting`, `storage`, etc.).
- scripts `src/utils.js` et `src/content.js` bien injectés.
- icônes `icon_ok.png` / `icon_failed.png` disponibles.

## Bonnes pratiques de debug

- Toujours tester avec une fenêtre fraîche après reload extension.
- Éviter de debugger avec un token obsolète.
- Isoler backend vs extension en testant endpoints manuellement.
- Capturer : URL testée, statut HTTP, logs worker, logs content script.

## Références

- [Doc extension (vue d’ensemble)](README.md)
- [Flux API extension ↔ backend](README.api-flow.md)
- [Sécurité extension](README.security.md)
- [Architecture extension](README.architecture.md)
- [Guide publication navigateur](README.release.md)
