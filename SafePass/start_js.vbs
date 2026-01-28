Set WshShell = CreateObject("WScript.Shell")

' Définit le dossier backend
WshShell.CurrentDirectory = "C:\Users\alber\Documents\Informatique\php\SafePass 1.0\SafePass"

' Lancer frontend
WshShell.Run "node index.js", 0

' Lancer backend
WshShell.Run "py.exe SafePass.py", 0
