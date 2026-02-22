# Flux API extension ↔ backend

Ce document détaille les échanges HTTP entre l’extension SafePass et le backend local.

## Contexte

- Extension MV3 : `SafePass-Extention`
- Backend local : `http://localhost:5000`
- Authentification extension : header `X-Ext-Auth` (si token configuré)

## Endpoints utilisés

- `GET /test`
- `GET /settings`
- `GET /credentials?url=<domaine>`
- `POST /saveData`
- `GET /extension/token`

## Flux 1 — Vérification de connexion

Objectif : savoir si le backend est joignable et refléter cet état dans l’UI/icône.

1. Le service worker appelle `GET /test`.
2. Si `2xx`, l’état est considéré connecté.
3. Sinon (erreur HTTP/réseau), l’état passe en échec.
4. La popup lit l’état via message runtime (`getStatus`).

Résultat attendu :

- popup : “Connexion réussie” / “Échec de la connexion”
- icône extension : état OK/KO

## Flux 2 — Prise en compte de `detect_enabled`

Objectif : désactiver le comportement extension si la détection est désactivée côté app.

1. Extension appelle `GET /settings`.
2. Lecture de `detect_enabled` (structure tolérante : `settings.detect_enabled` ou `detect_enabled`).
3. Si `false` :
   - blocage de l’action de récupération,
   - état UI “Extension désactivée (detection inactive)”.

## Flux 3 — Récupération des identifiants pour une page

Objectif : récupérer les entrées correspondant au domaine courant.

1. L’utilisateur déclenche l’action (menu contextuel).
2. Le content script renvoie le contexte (`hostname`, coordonnées).
3. Le service worker appelle :
   - `GET /credentials?url=<hostname>`
   - avec `X-Ext-Auth` si token local présent.
4. Le backend répond avec une liste `matches`.
5. Le content script affiche un modal de sélection.

### Exemple de requête

```http
GET /credentials?url=example.com HTTP/1.1
Host: localhost:5000
X-Ext-Auth: <token-optionnel>
```

### Exemple de réponse (forme attendue)

```json
{
  "matches": [
    {
      "username": "alice@example.com",
      "password": "***",
      "url": "https://example.com/login",
      "domain": "example.com",
      "source": "SafePass"
    }
  ]
}
```

## Flux 4 — Remplissage des champs

Objectif : appliquer l’entrée choisie dans le formulaire actif.

1. L’utilisateur clique une entrée dans le modal.
2. Le content script :
   - sélectionne les champs candidats (username/password),
   - applique les valeurs via setters natifs,
   - déclenche les événements nécessaires côté page.
3. Le modal se ferme après tentative de remplissage.

Note : la réussite dépend du DOM et des protections JS du site cible.

## Flux 5 — Envoi d’une entrée détectée vers le backend

Objectif : enrichir les données côté SafePass.

1. Le content script collecte certaines valeurs (`url`, `username`, `password`).
2. Le service worker envoie `POST /saveData`.
3. Le payload est encapsulé dans `extension_entry`.
4. Le header `X-Ext-Auth` est envoyé si disponible.

### Exemple de requête

```http
POST /saveData HTTP/1.1
Host: localhost:5000
Content-Type: application/json
X-Ext-Auth: <token-optionnel>
```

```json
{
  "extension_entry": {
    "url": "example.com",
    "username": "alice@example.com",
    "password": "***"
  }
}
```

## Flux 6 — Validation du token extension

Objectif : informer l’utilisateur si le token local correspond au token serveur (et n’est pas expiré).

1. Le token local est lu depuis `chrome.storage.local.ext_token`.
2. L’extension appelle `GET /extension/token`.
3. Elle compare :
   - égalité du token,
   - date `expires_at` si fournie.
4. L’UI popup et l’icône affichent l’état valide/invalide.

## Gestion d’erreurs

- Erreur réseau backend : état KO, pas de remplissage.
- `401/403` (selon implémentation backend) : token absent/invalide.
- Réponse sans `matches` : modal affiché avec liste vide.
- Content script absent : tentative de réinjection via `chrome.scripting.executeScript`.

## Contrat minimal recommandé (backend)

Pour garder une extension robuste, le backend devrait :

- retourner un JSON stable sur tous les endpoints,
- renvoyer des codes HTTP explicites (`200`, `401/403`, `404`, `5xx`),
- inclure des messages d’erreur lisibles,
- conserver une structure cohérente pour `matches`.

## Références

- [Doc extension (vue d’ensemble)](README.md)
- [Architecture extension](README.architecture.md)
- [Sécurité extension](README.security.md)
- [Guide debug & troubleshooting](README.debug.md)
- [Guide publication navigateur](README.release.md)
