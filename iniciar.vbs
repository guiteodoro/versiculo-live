' Abre o Versiculo Live sem janela de terminal.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
exe = pasta & "\node_modules\electron\dist\electron.exe"
If Not fso.FileExists(exe) Then
  MsgBox "Nao encontrei o Electron em:" & vbCrLf & exe & vbCrLf & vbCrLf & "Rode 'npm install' na pasta do projeto (veja o LEIA-ME).", 16, "Versiculo Live"
  WScript.Quit 1
End If
' Estilo 1 (normal): o electron.exe nao abre terminal. Com 0 (oculto) o Windows
' escondia a primeira janela do app, a de controle.
sh.Run """" & exe & """ """ & pasta & """", 1, False
