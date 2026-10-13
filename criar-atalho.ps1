# (Re)cria o atalho "Versículo Live" na área de trabalho.
# Uso: powershell -ExecutionPolicy Bypass -File criar-atalho.ps1
$pasta = $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$caminho = Join-Path $desktop 'Versículo Live.lnk'
$sh = New-Object -ComObject WScript.Shell
$a = $sh.CreateShortcut($caminho)
$a.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$a.Arguments = '"' + (Join-Path $pasta 'iniciar.vbs') + '"'
$a.WorkingDirectory = $pasta
$a.IconLocation = (Join-Path $pasta 'icone.ico') + ',0'
$a.Description = 'Abre o Versículo Live'
$a.Save()
Write-Host "Atalho criado: $caminho"
