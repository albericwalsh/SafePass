# Installation

SafePass est distribué via les releases GitHub du dépôt public.

## 1) Télécharger la release

Dans la page Releases, récupérer :

- `SafePass-Installer-X.Y.Z.exe` (recommandé)
- `SafePass-X.Y.Z-windows-x64.zip` (mode portable)
- `SHA256SUMS.txt`

Si vous utilisez l'extension navigateur, récupérer aussi :

- `SafePass-extension-X.Y.Z.zip`

## 2) Vérifier l'intégrité (recommandé)

Sous PowerShell :

```powershell
Get-FileHash .\SafePass-Installer-X.Y.Z.exe -Algorithm SHA256
```

Comparer la valeur avec la ligne correspondante dans `SHA256SUMS.txt`.

## 3) Installer l'application

### Option A (recommandée) : installateur

1. Exécuter `SafePass-Installer-X.Y.Z.exe`.
2. Suivre l'assistant d'installation.
3. Lancer SafePass depuis le raccourci créé.

### Option B : version portable (.zip)

1. Décompresser `SafePass-X.Y.Z-windows-x64.zip` dans un dossier dédié.
2. Lancer `SafePass.exe`.
3. Autoriser l'application dans le pare-feu Windows si demandé.

## 4) Premier lancement

Au premier lancement, SafePass prépare ses dossiers de travail et ses paramètres locaux.

Ensuite, ouvrir le coffre et configurer vos préférences depuis la page Paramètres.

## Mise à jour

Pour mettre à jour SafePass :

1. Fermer complètement l'application.
2. Télécharger la nouvelle release.
3. Si vous utilisez l'installateur, relancer `SafePass-Installer-X.Y.Z.exe`.
4. Si vous utilisez la version portable, remplacer le dossier de l'ancienne version.
5. Relancer SafePass.
