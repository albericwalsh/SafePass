# Installation

SafePass est distribué via les releases GitHub du dépôt public.

## 1) Télécharger la release

Dans la page Releases, récupérer :

- `SafePass-X.Y.Z-windows-x64.zip`
- `SHA256SUMS.txt`

Si vous utilisez l'extension navigateur, récupérer aussi :

- `SafePass-extension-X.Y.Z.zip`

## 2) Vérifier l'intégrité (recommandé)

Sous PowerShell :

```powershell
Get-FileHash .\SafePass-X.Y.Z-windows-x64.zip -Algorithm SHA256
```

Comparer la valeur avec la ligne correspondante dans `SHA256SUMS.txt`.

## 3) Installer l'application

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
3. Décompresser dans un nouveau dossier ou remplacer les fichiers existants.
4. Relancer `SafePass.exe`.
