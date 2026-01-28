@echo off
echo Construction de l'executable SafePass...
py -m PyInstaller SafePass.spec
echo Construction terminee! L'executable se trouve dans le dossier dist\