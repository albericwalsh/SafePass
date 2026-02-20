SafePass Extension - Notes de packaging et sécurité

HTTPS et packaging

- En production, exposez l'API Flask uniquement via HTTPS (reverse proxy ou configuration SSL).
  - Exemple simple (nginx) : mettre en place un certificat TLS (Let's Encrypt) et proxy_pass vers votre app Flask en local.
- Ne pas conserver de secrets (clé privée, .pem, tokens) dans le dépôt git.
- Le header `X-Ext-Auth` est utilisé pour authentifier l'extension auprès de `/credentials` et `/saveData`.
  - Le jeton est maintenant géré via `data/extension_token.json` (créé par l'UI "Générer" dans les paramètres de l'application).
  - Configurez l'extension en ouvrant la popup et en collant le jeton si nécessaire.

Conseils de packaging

- Pour packager l'extension pour Chromium :
  - Générer un zip des fichiers nécessaires (`manifest.json`, `src/`, `icon_*.png`, `popup.html`, etc.).
  - Evitez d'inclure `dist/extension_artifacts` ni des clés privées.
- Tests rapides :
  - Charger l'extension en mode développeur (Load unpacked) en pointant sur le dossier `SafePass-Extention`.
  - Tester les endpoints `/test`, `/credentials` et `/saveData` via PowerShell ou curl en ajoutant l'en-tête `X-Ext-Auth` si vous avez configuré un jeton.

Sécurité avancée

- Pour plus de sécurité, remplacez le jeton par un système HMAC ou OAuth2 et limitez les IP autorisées côté serveur.
- Activer le chiffrement au repos et des sauvegardes sécurisées pour les fichiers `data/data_encrypted.sfpss`.
