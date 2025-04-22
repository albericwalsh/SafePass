Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node ./index.js", 0
WshShell.Run "pip install flask", 0
WshShell.Run "python -m flask run --no-debug --no-debugger", 0

