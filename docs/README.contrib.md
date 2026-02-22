# Guide de contribution — SafePass

Ce document fixe les règles de contribution minimales pour garder le projet stable, lisible et maintenable.

## Règle non négociable

Toute modification de code doit inclure la mise à jour de la documentation impactée dans le **même commit**.

Ce projet est propriétaire (non open source) : seules les personnes explicitement validées par écrit par le propriétaire sont autorisées à contribuer.
Référence légale : [LICENSE](../LICENSE)

Exemples :

- changement d’endpoint API → mise à jour [README.api.md](README.api.md),
- changement sécurité/auth → mise à jour [README.security.md](README.security.md),
- changement extension → mise à jour [extension/README.md](extension/README.md) et sous-docs,
- changement process de test/release → mise à jour des guides dédiés.

## Workflow conseillé

1. Créer une branche de travail ciblée.
2. Faire une modification atomique (scope clair).
3. Mettre à jour les tests concernés.
4. Mettre à jour la documentation concernée.
5. Valider localement (tests + smoke test).
6. Committer avec message explicite.

## Convention de commit

Message court + précis, par exemple :

- `fix(api): validate X-Ext-Auth on /credentials`
- `docs(api): update /credentials auth requirements`

Pour un changement de code, un commit sans doc associée est considéré incomplet.

## Qualité attendue

- éviter les changements hors scope,
- préserver la compatibilité existante quand possible,
- éviter d’introduire des secrets dans le dépôt,
- garder les docs synchronisées avec le code réel.

## Références

- [README principal](../README.md)
- [Architecture backend](README.backend.md)
- [Routes API](README.api.md)
- [Sécurité et chiffrement](README.security.md)
- [Tests et validation](README.tests.md)
- [Documentation extension](extension/README.md)
