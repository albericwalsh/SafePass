# Sécurité de l’extension SafePass

Ce document décrit le modèle de sécurité de l’extension navigateur SafePass, les protections actuelles et les recommandations de durcissement.

## Périmètre

- Extension Chromium (Manifest V3)
- Communication avec backend local SafePass (`localhost:5000`)
- Gestion d’un jeton partagé via `X-Ext-Auth`

## Objectifs de sécurité

- empêcher les appels non autorisés aux endpoints sensibles,
- limiter l’exposition des secrets (token extension),
- réduire la surface d’attaque navigateur,
- éviter les fuites accidentelles dans le dépôt ou les builds.

## Menaces principales

1. **Appels API non authentifiés**
   - Un acteur local tente d’appeler `/credentials` ou `/saveData` sans token valide.

2. **Vol du token extension**
   - Token exposé dans logs, screenshots, backup non chiffré ou dépôt Git.

3. **Interception trafic en environnement exposé**
   - Si API non protégée hors localhost, risque MITM sans TLS.

4. **Abus de permissions extension**
   - Permissions trop larges ou scripts injectés hors besoin.

5. **Injection/altération côté page**
   - DOM de sites tiers perturbant le remplissage ou capturant des événements.

## Mesures actuellement en place

- Authentification applicative via header `X-Ext-Auth` (si configuré).
- Vérification de validité/expiration du token via `GET /extension/token`.
- Stockage local du token dans `chrome.storage.local` (`ext_token`).
- Restriction backend déclarée dans `host_permissions` (`localhost` / `127.0.0.1`).
- Comportement bloqué si `detect_enabled = false` côté backend.
- Séparation logique popup / background / content script (MV3).

## Exigences minimales (obligatoires)

- Ne jamais committer de secrets (`token`, `.pem`, clés privées).
- Garder l’authentification `X-Ext-Auth` active côté backend.
- Refuser explicitement les requêtes sans token valide sur les endpoints sensibles.
- Éviter l’exposition du backend sur des interfaces publiques sans contrôle d’accès.

## Hardening recommandé

### Backend

- Exposer l’API via HTTPS (reverse proxy TLS) si sortie de `localhost`.
- Implémenter rotation/expiration courte des tokens extension.
- Ajouter rate limiting sur endpoints sensibles.
- Journaliser les refus d’authentification (sans loguer le token brut).
- Normaliser les réponses d’erreur (`401/403`) pour faciliter le diagnostic.

### Extension

- Réduire permissions au strict nécessaire à chaque release.
- Éviter toute persistance de secrets hors `chrome.storage.local`.
- Ne jamais afficher le token complet en UI.
- Limiter les traces console contenant des données sensibles.

### Opérations

- Scanner les artefacts de release pour secrets avant publication.
- Séparer environnements dev/test/prod et leurs tokens.
- Révoquer immédiatement un token suspecté compromis.

## Checklist release sécurité

- [ ] Aucun secret dans Git (`git grep` sur tokens/keys).
- [ ] `manifest.json` revu (permissions minimales).
- [ ] Endpoints sensibles protégés par `X-Ext-Auth` côté backend.
- [ ] Token expiré/invalide correctement refusé.
- [ ] Build extension ne contient pas d’artefacts temporaires/sensibles.
- [ ] Notes de sécurité release mises à jour.

## Réponse à incident (token compromis)

1. Révoquer le token côté SafePass.
2. Générer un nouveau token.
3. Mettre à jour la popup extension.
4. Vérifier les logs backend autour de la période suspecte.
5. Forcer une rotation préventive sur autres environnements si nécessaire.

## Références

- [Doc extension (vue d’ensemble)](README.md)
- [Flux API extension ↔ backend](README.api-flow.md)
- [Architecture extension](README.architecture.md)
- [Guide debug & troubleshooting](README.debug.md)
- [Guide publication navigateur](README.release.md)
