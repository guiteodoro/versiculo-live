# Gera icone.ico (círculo azul com brilho dourado e cruz) em 256/48/32/16 px.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\gerar-icone.ps1
Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'icone.ico'

function Novo-Png([int]$t) {
  $bmp = New-Object System.Drawing.Bitmap $t, $t, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $m = [single]($t * 0.03)
  $d = [single]($t - 2 * $m)
  $retCirculo = New-Object System.Drawing.RectangleF $m, $m, $d, $d
  # fundo: degradê azul-escuro -> azul
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $retCirculo, ([System.Drawing.Color]::FromArgb(255, 11, 16, 60)), ([System.Drawing.Color]::FromArgb(255, 44, 100, 200)), 60.0
  $g.FillEllipse($grad, $retCirculo)
  # brilho dourado suave no centro
  $cam = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = $t * 0.36; $c = $t / 2
  $cam.AddEllipse([single]($c - $r), [single]($c - $r), [single](2 * $r), [single](2 * $r))
  $pg = New-Object System.Drawing.Drawing2D.PathGradientBrush $cam
  $pg.CenterColor = [System.Drawing.Color]::FromArgb(150, 255, 214, 120)
  $pg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 214, 120))
  $g.FillEllipse($pg, [single]($c - $r), [single]($c - $r), [single](2 * $r), [single](2 * $r))
  # cruz dourada
  $ouro = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 215, 120))
  $esp = [single]([Math]::Max(2, $t * 0.11))
  $altura = $t * 0.52; $largura = $t * 0.34
  $topo = $t * 0.22; $barra = $t * 0.37
  $g.FillRectangle($ouro, [single]($c - $esp / 2), [single]$topo, $esp, [single]$altura)
  $g.FillRectangle($ouro, [single]($c - $largura / 2), [single]$barra, [single]$largura, $esp)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return ,$ms.ToArray()
}

$tamanhos = 256, 48, 32, 16
$pngs = foreach ($t in $tamanhos) { ,(Novo-Png $t) }
$fs = [System.IO.File]::Create($destino)
$w = New-Object System.IO.BinaryWriter $fs
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$tamanhos.Count)
$offset = 6 + 16 * $tamanhos.Count
for ($i = 0; $i -lt $tamanhos.Count; $i++) {
  $t = $tamanhos[$i]; $b = $pngs[$i]
  $dim = if ($t -ge 256) { 0 } else { $t }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32)
  $w.Write([uint32]$b.Length); $w.Write([uint32]$offset)
  $offset += $b.Length
}
foreach ($b in $pngs) { $w.Write($b) }
$w.Close(); $fs.Close()
Write-Host "Ícone gerado: $destino"
