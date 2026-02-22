# Tests et validation — SafePass

Ce document décrit la stratégie de validation actuelle du projet et comment exécuter les tests existants.

## Objectif

S’assurer que les flux critiques restent stables :

- authentification / mot de passe maître,
- export,
- gestion historique de mots de passe,
- cohérence des paramètres.

## Où sont les tests

Tests principaux : [tests](../tests)

- [tests/test_export.py](../tests/test_export.py)
- [tests/test_master_password_flow.py](../tests/test_master_password_flow.py)
- [tests/test_password_history.py](../tests/test_password_history.py)

Scripts de validation complémentaires : [scripts](../scripts)

- [scripts/run_master_tests.py](../scripts/run_master_tests.py)
- [scripts/test_update_settings.py](../scripts/test_update_settings.py)

## Environnement recommandé

- Utiliser l’environnement virtuel projet (`.venv`).
- Exécuter les tests depuis la racine du repo.
- Éviter de lancer les tests en parallèle d’une instance backend active qui manipule les mêmes fichiers runtime.

## Exécution (base)

### 1) Via pytest (recommandé)

```powershell
. .venv\Scripts\Activate.ps1
pytest tests -q
```

### 2) Test ciblé mot de passe maître (script helper)

```powershell
. .venv\Scripts\Activate.ps1
py scripts\run_master_tests.py
```

### 3) Vérification ponctuelle d’un test

```powershell
. .venv\Scripts\Activate.ps1
pytest tests\test_password_history.py -q
```

## Ordre de validation conseillé

1. tests unitaires/flux critiques (`tests/`),
2. script de vérification settings,
3. smoke test applicatif (backend + UI),
4. validation extension si changement impactant les routes extension.

## Contrôles manuels minimum

Après succès des tests automatiques, vérifier :

- ouverture SafePass en mode normal et `--cli`,
- lecture/sauvegarde d’entrées,
- comportement master password (si activé),
- import/export de base,
- statut extension si routes concernées.

## Bonnes pratiques

- Ajouter un test pour tout correctif de bug backend significatif.
- Préférer un test ciblé reproduisant le bug plutôt qu’un scénario large fragile.
- Garder les fixtures/données de test séparées des données runtime utilisateur.
- Ne pas intégrer de secrets dans les tests.
- Mettre à jour la documentation liée dans le même commit que le changement de code.

## Dépannage test

Si un test échoue :

1. relancer le test isolé en mode verbeux,
2. vérifier les dépendances Python installées,
3. vérifier l’état des fichiers de données/settings utilisés par le test,
4. confirmer qu’aucun process SafePass n’interfère,
5. consulter les logs backend si le test couvre des routes API.

## Références

- [Architecture backend](README.backend.md)
- [Routes API](README.api.md)
- [Sécurité et chiffrement](README.security.md)
- [Données, stockage et migration](README.data.md)
- [Documentation extension](extension/README.md)
