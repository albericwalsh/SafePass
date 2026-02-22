# Guide publication navigateur — Extension SafePass

Ce document décrit un processus simple et fiable pour préparer, valider et publier l’extension SafePass.

## Objectif

Garantir qu’une release extension est :

- fonctionnelle,
- cohérente avec le backend SafePass,
- propre (sans fichiers parasites),
- conforme aux exigences minimales de sécurité.

## Préparation de release

1. Vérifier que les docs sont à jour :
   - `docs/extension/README.md`
   - `docs/extension/README.api-flow.md`
   - `docs/extension/README.security.md`
2. Vérifier la version dans `SafePass-Extention/manifest.json`.
3. Confirmer la compatibilité backend (endpoints utilisés).
4. Recharger l’extension localement et faire un smoke test.

## Check fonctionnelle minimale

Tester au moins les scénarios suivants :

1. **Connexion backend**
   - popup affiche un statut correct (OK/KO).
2. **Token extension**
   - sauvegarde token,
   - validation token (icône/indicateur).
3. **Récupération credentials**
   - clic droit dans un champ éditable,
   - modal d’identifiants affiché.
4. **Autofill**
   - sélection d’une entrée,
   - champs login/password remplis.
5. **Détection désactivée**
   - `detect_enabled = false` bloque les actions.

## Check sécurité minimale

- [ ] Aucun secret dans les fichiers de release.
- [ ] Aucun token réel dans documentation/captures.
- [ ] Endpoints sensibles protégés côté backend.
- [ ] Permissions extension revues (pas d’ajout inutile).

## Contenu du package

Inclure :

- `SafePass-Extention/manifest.json`
- `SafePass-Extention/popup.html`
- `SafePass-Extention/src/`
- `SafePass-Extention/icon.png`
- `SafePass-Extention/icon_ok.png`
- `SafePass-Extention/icon_failed.png`

Exclure :

- dossiers temporaires,
- artefacts de test,
- secrets/clefs,
- fichiers locaux non nécessaires.

## Construction de l’archive

Créer une archive ZIP du contenu publié de `SafePass-Extention` (racine du zip = fichiers extension, pas le dossier parent global).

Recommandations :

- nommage explicite, ex. `safepass-extension-vX.Y.Z.zip`,
- conserver un hash (SHA256) de l’archive pour traçabilité.

## Validation avant livraison

1. Installer l’archive en mode développeur sur un profil navigateur vierge.
2. Refaire le smoke test.
3. Vérifier l’absence d’erreurs dans :
   - console service worker,
   - console page (content script).
4. Vérifier que l’extension fonctionne avec un backend propre.

## Livraison

Selon cible :

- distribution interne : archive + note de release,
- store navigateur : soumission package + métadonnées + captures.

Inclure une note de release concise :

- version,
- changements fonctionnels,
- impacts sécurité,
- prérequis backend.

## Rollback (retour arrière)

En cas de problème post-release :

1. retirer la version fautive,
2. remettre la dernière version stable,
3. révoquer le token si suspicion de compromission,
4. documenter incident + correctif.

## Références

- [Doc extension (vue d’ensemble)](README.md)
- [Architecture extension](README.architecture.md)
- [Flux API extension ↔ backend](README.api-flow.md)
- [Sécurité extension](README.security.md)
- [Guide debug & troubleshooting](README.debug.md)
