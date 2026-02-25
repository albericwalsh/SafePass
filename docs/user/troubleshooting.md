# Dépannage

## SafePass ne démarre pas

1. Vérifier que l'archive release a bien été extraite complètement.
2. Lancer `SafePass.exe` en tant qu'utilisateur standard.
3. Vérifier les alertes antivirus/pare-feu.
4. Relancer la machine si un processus bloqué persiste.

## L'interface s'ouvre mal ou reste vide

1. Fermer SafePass.
2. Relancer `SafePass.exe`.
3. Vérifier qu'aucun outil de sécurité ne bloque la communication locale.

## Windows affiche une alerte SmartScreen/Defender

1. Vérifier que l'installateur ou l'archive provient bien de la release officielle GitHub.
2. Contrôler l'empreinte SHA256 publiée dans la release.
3. Si la source est fiable, autoriser l'exécution depuis l'alerte Windows.
4. Relancer `SafePass.exe` après autorisation.

## L'extension indique une erreur de connexion

1. Vérifier que SafePass est lancé.
2. Vérifier le jeton extension configuré.
3. Recharger l'extension depuis la page des extensions.
4. Tester sur une autre page web.

## Une entrée n'est pas proposée par l'extension

1. Vérifier l'URL/site enregistré dans l'entrée.
2. Vérifier que l'entrée est bien sauvegardée.
3. Relancer SafePass puis le navigateur.

## Après mise à jour, un comportement anormal apparaît

1. Fermer SafePass.
2. Revenir à la dernière version stable si nécessaire.
3. Ouvrir un ticket avec :
   - version utilisée,
   - étapes de reproduction,
   - capture d'écran si possible.

## Où trouver les logs

- Dossier par défaut : `%APPDATA%/SafePasse/logs`.
- Les fichiers de logs facilitent le diagnostic en cas de bug au démarrage ou avec l'extension.
