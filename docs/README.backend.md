# Backend SafePass

Ce document décrit la base du fonctionnement du backend SafePass côté Python/Flask.

## Rôle du backend

Le backend expose une API locale utilisée par :

- l’interface web SafePass,
- l’extension navigateur,
- les fonctionnalités de sécurité (authentification, chiffrement, token).

Responsabilités principales :

- gestion des paramètres applicatifs,
- lecture/écriture des données chiffrées,
- routes d’authentification et de session,
- routes d’export et de logs,
- routes d’intégration extension/URL/fuites.

## Entrée et initialisation

Point d’entrée principal : [back/app.py](../back/app.py).

Au démarrage, le backend :

1. initialise l’application Flask,
2. prépare l’arborescence système SafePass,
3. charge/normalise les paramètres,
4. enregistre dynamiquement les routes modulaires,
5. expose les endpoints attendus par le frontend et l’extension.

Enregistrement des routes : [back/routes/router.py](../back/routes/router.py) (liste statique + découverte dynamique).

## Organisation du code backend

- [back/app.py](../back/app.py) : cœur de l’application Flask et runtime global.
- [back/router.py](../back/router.py) : utilitaire d’enregistrement dynamique de routes.
- [back/routes](../back/routes) : modules de routes fonctionnelles.
- [back/crypting](../back/crypting) : chiffrement/déchiffrement des données.
- [back/detect.py](../back/detect.py) : logique de détection/matching URL.
- [back/log.py](../back/log.py) : journalisation.

## Modules de routes

Les modules enregistrés incluent notamment :

- settings admin,
- ANSSI,
- auth,
- crypting,
- data,
- export,
- extension,
- leaks,
- logs,
- path,
- url.

Répertoire : [back/routes](../back/routes).

## Stockage runtime (AppData)

Le backend crée et maintient une arborescence système SafePass (Windows AppData), avec :

- dossier racine SafePass,
- dossier data,
- dossier backup,
- dossier cache,
- settings normalisés,
- token extension,
- données chiffrées.

La logique de paths systèmes et de normalisation des settings est centralisée dans [back/app.py](../back/app.py).

## Paramètres et normalisation

Le backend applique un schéma de paramètres structuré (display, general, security, storage, advanced), avec :

- valeurs par défaut,
- compatibilité legacy,
- normalisation avant persistance.

Objectif : éviter les settings incomplets et garantir un état cohérent au runtime.

## Sécurité backend (vue de base)

Mécanismes utilisés dans l’architecture actuelle :

- hash de mot de passe maître,
- token extension avec expiration,
- endpoints protégés selon le contexte,
- chiffrement/déchiffrement des données sensibles.

Pour le détail sécurité : [docs/README.security.md](README.security.md) et [docs/extension/README.security.md](extension/README.security.md).

## Interaction avec l’extension

Le backend répond notamment aux endpoints extension suivants :

- test de disponibilité,
- lecture des settings (`detect_enabled`),
- récupération d’identifiants par domaine,
- sauvegarde d’entrée extension,
- lecture/validation token extension.

Détail des flux : [docs/extension/README.api-flow.md](extension/README.api-flow.md).

## Observabilité et debug

Pour diagnostiquer un problème backend :

1. lancer SafePass en mode CLI,
2. vérifier les logs backend,
3. tester les endpoints critiques,
4. valider la présence des fichiers runtime (settings/data/token).

Guide extension associé : [docs/extension/README.debug.md](extension/README.debug.md).

## Limites actuelles

- une partie importante de la logique est concentrée dans [back/app.py](../back/app.py),
- la documentation endpoint-by-endpoint reste à détailler,
- certains comportements legacy coexistent avec la structure normalisée.

## Références

- [README principal](../README.md)
- [Routes API](README.api.md)
- [Sécurité globale](README.security.md)
- [Documentation extension](extension/README.md)
