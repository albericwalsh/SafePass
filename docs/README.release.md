# Release, build et installation — SafePass

Ce document centralise le processus de release applicative (backend/frontend desktop) et les vérifications avant diffusion.

## Objectif

Garantir qu’une release SafePass est :

- reproductible,
- testée,
- documentée,
- distribuable sans fuite d’informations sensibles.

## Préparation

1. Mettre à jour la version projet si nécessaire (`VERSION`).
2. Vérifier les dépendances Python/Node utilisées.
3. Exécuter les tests critiques.
4. Vérifier que la documentation est à jour.

Règle de versioning release : **chaque nouveau build publié doit utiliser une nouvelle version**.
Il est interdit d’écraser les assets d’une release déjà publiée (tag immuable).

Règle projet : chaque commit de code doit inclure la mise à jour de la documentation impactée.

## Build principal (Windows)

Référence build : [README.build.md](README.build.md)

Exemple rapide :

```powershell
. .venv\Scripts\Activate.ps1
echo y | pybuilder --bump fix --spec SafePass.spec --name SafePass
```

Sortie attendue : artefacts dans `dist/SafePass/`.

## Exécutables attendus

- `SafePass.exe` : backend + frontend.
- `SafePassBackend.exe` : backend seul.

Mode console utile pour debug :

- `SafePass.exe --cli`
- `SafePassBackend.exe --cli`

## Validation pré-release

1. Lancer les tests automatiques.
2. Démarrer l’exécutable en mode normal.
3. Démarrer en mode `--cli` et vérifier les logs.
4. Vérifier les flux critiques :
   - lecture/sauvegarde des données,
   - paramètres,
   - export/import,
   - extension (si activée).

## Checklist sécurité release

- [ ] Aucun secret dans le dépôt ou artefacts.
- [ ] Tokens/session testés et valides.
- [ ] Données runtime hors versionnement.
- [ ] Documentation sécurité/API à jour.

## Installation (base)

- Build local via PyInstaller/pybuilder,
- Installation via l’exécutable distribué,
- Vérification du premier lancement et de la création des chemins runtime.

## Rollback

En cas de régression :

1. revenir à la dernière version stable,
2. révoquer/renouveler les tokens si nécessaire,
3. documenter l’incident et le correctif,
4. republier une version corrigée avec un **nouveau numéro de version**.

## Références

- [README principal](../README.md)
- [Publication vers dépôt public](README.public-release.md)
- [Build détaillé](README.build.md)
- [Tests et validation](README.tests.md)
- [Sécurité et chiffrement](README.security.md)
- [Guide de contribution](README.contrib.md)

Pour la publication GitHub (assets + notes de release templatisées), voir [Publication vers dépôt public](README.public-release.md).
