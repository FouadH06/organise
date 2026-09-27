Set WShell = CreateObject("WScript.Shell")
Dim dir
dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
WShell.Run "cmd /c cd /d """ & dir & """ && npm run dev", 0, False
