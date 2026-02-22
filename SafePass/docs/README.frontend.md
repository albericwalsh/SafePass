# Frontend SafePass (structure UI)

Ce document décrit l’organisation du frontend web SafePass et son fonctionnement de base.

## Rôle du frontend

Le frontend fournit l’interface utilisateur locale pour :

- consulter les entrées de mots de passe,
- ajouter/modifier/supprimer des entrées,
- gérer les paramètres,
- visualiser les logs et informations annexes.

Il consomme l’API backend locale (Flask).

## Arborescence principale

Racine frontend : [public](../public)

Fichiers et dossiers clés :

- [public/index.html](../public/index.html) — interface principale coffre.
- [public/parameters.html](../public/parameters.html) — écran paramètres.
- [public/logs.html](../public/logs.html) — écran logs.
- [public/js](../public/js) — scripts frontend.
- [public/style](../public/style) — feuilles CSS principales.
- [public/locales](../public/locales) — traductions (i18n).

## Organisation JavaScript

Dossier : [public/js](../public/js)

Scripts fonctionnels principaux :

- [public/js/display.js](../public/js/display.js) — affichage des données.
- [public/js/add_form.js](../public/js/add_form.js) — ajout d’entrée.
- [public/js/edit_form.js](../public/js/edit_form.js) — édition d’entrée.
- [public/js/saving.js](../public/js/saving.js) — persistance via backend.
- [public/js/password.js](../public/js/password.js) — logique mot de passe/force.
- [public/js/theme.js](../public/js/theme.js) — gestion thème.
- [public/js/i18n.js](../public/js/i18n.js) — internationalisation.
- [public/js/logs.js](../public/js/logs.js) — logique page logs.
- [public/js/auto_lock.js](../public/js/auto_lock.js) — verrouillage automatique.
- [public/js/check_paths.js](../public/js/check_paths.js) — vérification chemins/settings.

Sous-modules :

- [public/js/display](../public/js/display) — composants d’affichage spécialisés.
- [public/js/parameters](../public/js/parameters) — logique page paramètres.
- [public/js/parameters/categories](../public/js/parameters/categories) — catégories de paramètres.

## Organisation CSS

Dossier : [public/style](../public/style)

- [public/style/style.css](../public/style/style.css) — styles globaux UI principale.
- [public/style/parameters.css](../public/style/parameters.css) — styles page paramètres.
- [public/style/parameters-common.css](../public/style/parameters-common.css) — styles partagés paramètres.
- [public/style/logs.css](../public/style/logs.css) — styles page logs.
- [public/style/colors.css](../public/style/colors.css) — couleurs/tokens.
- [public/style/font.css](../public/style/font.css) — polices.

## Internationalisation

Dossier : [public/locales](../public/locales)

- [public/locales/fr.json](../public/locales/fr.json)
- [public/locales/en.json](../public/locales/en.json)

Le frontend s’appuie sur ces fichiers via [public/js/i18n.js](../public/js/i18n.js).

## Pages et responsabilités

### Coffre principal

- Fichier : [public/index.html](../public/index.html)
- Fonctions : listing entrées, formulaires add/edit, actions sur credentials.

### Paramètres

- Fichier : [public/parameters.html](../public/parameters.html)
- Fonctions : configuration app (général, sécurité, stockage, affichage, extension, etc.).

### Logs

- Fichier : [public/logs.html](../public/logs.html)
- Fonctions : consultation des journaux backend.

## Flux frontend ↔ backend (base)

1. Chargement des settings au démarrage UI.
2. Lecture des données (`getData`) pour affichage.
3. Sauvegarde des modifications (`saveData`).
4. Appels spécialisés selon page (logs, export/import, extension, etc.).

Détail API : [docs/README.api.md](README.api.md).

## Bonnes pratiques frontend

- Conserver la logique métier côté backend autant que possible.
- Garder des modules JS ciblés (éviter les fichiers monolithiques).
- Centraliser les clés de traduction et styles partagés.
- Ne pas exposer d’information sensible dans le DOM ou les logs console.

## Références

- [README principal](../README.md)
- [Widgets AWS](../README.aws-widgets.md)
- [Architecture backend](README.backend.md)
- [Routes API](README.api.md)
- [Sécurité et chiffrement](README.security.md)
- [Documentation extension](extension/README.md)
