# Sécurité et chiffrement — SafePass

Ce document décrit la base du modèle de sécurité global de SafePass (backend, stockage, session, extension).

## Objectifs de sécurité

- protéger les données sensibles (identifiants, mots de passe),
- limiter les accès non autorisés aux endpoints critiques,
- réduire l’exposition des secrets et tokens,
- garantir un comportement sûr en mode local et en release.

## Périmètre

- Backend Flask local.
- Données persistées sur le poste utilisateur (AppData).
- Session utilisateur liée au mot de passe maître.
- Extension navigateur connectée au backend local.

## Mécanismes en place

### 1) Mot de passe maître et session

- Le mot de passe maître est stocké sous forme de hash (pas en clair).
- Le déverrouillage se fait via endpoint d’authentification.
- Une session est matérialisée par un token temporaire.
- Les routes sensibles peuvent exiger ce token (`X-Auth-Token`).

Références :

- [back/routes/auth_routes.py](../back/routes/auth_routes.py)
- [back/routes/data_routes.py](../back/routes/data_routes.py)
- [back/routes/export_routes.py](../back/routes/export_routes.py)

### 2) Token extension

- L’extension utilise un token dédié transmis via `X-Ext-Auth`.
- Le backend peut refuser les appels extension sans token valide.
- Un endpoint permet lecture/régénération du token extension.

Références :

- [back/routes/extension_routes.py](../back/routes/extension_routes.py)
- [back/routes/url_routes.py](../back/routes/url_routes.py)
- [docs/extension/README.security.md](extension/README.security.md)

### 3) Chiffrement des données

- SafePass embarque des opérations de chiffrement/déchiffrement côté backend.
- Le stockage runtime est centralisé dans l’arborescence système SafePass (AppData).

Références :

- [back/crypting/crypt_file.py](../back/crypting/crypt_file.py)
- [back/crypting/decrypt_file.py](../back/crypting/decrypt_file.py)
- [back/routes/crypting_routes.py](../back/routes/crypting_routes.py)

## Risques principaux

1. Compromission locale du poste (malware, compte OS compromis).
2. Exposition de secrets (token, hash, exports) via logs/fichiers/versioning.
3. Appels non authentifiés aux endpoints sensibles.
4. Mauvaise configuration runtime (détection/permissions/token expiré).
5. Publication d’artefacts contenant des données sensibles.

## Exigences minimales

- Ne jamais committer de secrets (tokens, clés, fichiers sensibles).
- Garder hors Git les fichiers runtime sensibles: `data/.token`, `data/mdp.token`, `data/.master_password.json`, `data/extension_token.json`.
- Garder les contrôles d’auth activés sur routes critiques.
- Utiliser des tokens de session courts et vérifiés côté backend.
- Exiger `X-Ext-Auth` pour les flux extension sensibles.
- Protéger les exports si mot de passe maître activé.

## Bonnes pratiques recommandées

### Backend

- Valider systématiquement entrées JSON et paramètres.
- Renvoyer des statuts HTTP explicites (`401`, `403`, `400`, `500`).
- Réduire les messages d’erreur exposés au strict utile.
- Journaliser les échecs d’auth sans écrire de secrets.

### Données et stockage

- Limiter les droits d’accès dossier runtime au compte utilisateur.
- Sauvegarder de façon sécurisée (chiffrement + rotation).
- Éviter toute copie non maîtrisée de fichiers de données.

### Extension

- Limiter les permissions navigateur au strict nécessaire.
- Ne pas afficher de token complet dans l’UI.
- Vérifier régulièrement validité/expiration du token extension.

## Checklist sécurité release

- [ ] aucun secret dans Git et les artefacts,
- [ ] routes sensibles testées avec et sans token,
- [ ] flux master password validés (unlock/protection data/export),
- [ ] token extension généré et testé,
- [ ] logs vérifiés (pas de fuite d’informations sensibles),
- [ ] documentation sécurité à jour.

## Réponse à incident (minimum)

1. Isoler l’environnement concerné.
2. Révoquer les tokens (session/extension) compromis.
3. Régénérer les secrets nécessaires.
4. Vérifier l’intégrité des données et des fichiers runtime.
5. Corriger la cause racine puis retester les flux critiques.

## Références

- [Architecture backend](README.backend.md)
- [Routes API](README.api.md)
- [Documentation extension](extension/README.md)
- [Sécurité extension](extension/README.security.md)
