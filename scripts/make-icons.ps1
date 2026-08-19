# Generates Subber icons from subber-logo.png (alpha preserved).
# Run: powershell -STA -File scripts/make-icons.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName WindowsBase

$root = Split-Path (Split-Path $PSCommandPath -Parent) -Parent
$srcPath = Join-Path $root "subber-logo.png"
if (-not (Test-Path $srcPath)) {
  throw "Missing $srcPath"
}

function Write-Be32([System.IO.BinaryWriter]$w, [uint32]$value) {
  $bytes = [BitConverter]::GetBytes($value)
  if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($bytes) }
  $w.Write($bytes)
}

function Save-ScaledPng([System.Windows.Media.Imaging.BitmapSource]$source, [int]$size, [string]$dest) {
  $visual = New-Object System.Windows.Media.DrawingVisual
  $dc = $visual.RenderOpen()
  [System.Windows.Media.RenderOptions]::SetBitmapScalingMode(
    $visual,
    [System.Windows.Media.BitmapScalingMode]::HighQuality
  )
  $dc.DrawImage($source, (New-Object System.Windows.Rect 0, 0, $size, $size))
  $dc.Close()

  $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(
    $size, $size, 96, 96,
    [System.Windows.Media.PixelFormats]::Pbgra32
  )
  $bmp.Render($visual)
  $bmp.Freeze()

  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
  $dir = Split-Path $dest -Parent
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $fs = [System.IO.File]::Open($dest, [System.IO.FileMode]::Create)
  try { $encoder.Save($fs) } finally { $fs.Dispose() }
}

function Write-Ico([string]$dest, [hashtable]$pngs) {
  $ordered = $pngs.GetEnumerator() | Sort-Object { [int]$_.Key }
  $count = $ordered.Count
  $offset = 6 + (16 * $count)
  $ms = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter $ms
  $w.Write([uint16]0)
  $w.Write([uint16]1)
  $w.Write([uint16]$count)
  foreach ($entry in $ordered) {
    $bytes = [System.IO.File]::ReadAllBytes($entry.Value)
    $dim = [int]$entry.Key
    $wh = if ($dim -ge 256) { [byte]0 } else { [byte]$dim }
    $w.Write($wh)
    $w.Write($wh)
    $w.Write([byte]0)
    $w.Write([byte]0)
    $w.Write([uint16]1)
    $w.Write([uint16]32)
    $w.Write([uint32]$bytes.Length)
    $w.Write([uint32]$offset)
    $offset += $bytes.Length
  }
  foreach ($entry in $ordered) {
    $w.Write([System.IO.File]::ReadAllBytes($entry.Value))
  }
  $w.Flush()
  [System.IO.File]::WriteAllBytes($dest, $ms.ToArray())
  $w.Dispose()
  $ms.Dispose()
}

function Write-Icns([string]$dest, [hashtable]$pngs) {
  $chunks = New-Object System.Collections.Generic.List[byte[]]
  $total = 8
  foreach ($pair in $pngs.GetEnumerator()) {
    $type = [System.Text.Encoding]::ASCII.GetBytes($pair.Key)
    $data = [System.IO.File]::ReadAllBytes($pair.Value)
    $len = 8 + $data.Length
    $ms = New-Object System.IO.MemoryStream
    $w = New-Object System.IO.BinaryWriter $ms
    $w.Write($type)
    Write-Be32 $w ([uint32]$len)
    $w.Write($data)
    $w.Flush()
    $chunks.Add($ms.ToArray())
    $total += $len
    $w.Dispose()
    $ms.Dispose()
  }
  $out = New-Object System.IO.MemoryStream
  $ow = New-Object System.IO.BinaryWriter $out
  $ow.Write([System.Text.Encoding]::ASCII.GetBytes("icns"))
  Write-Be32 $ow ([uint32]$total)
  foreach ($chunk in $chunks) { $ow.Write($chunk) }
  $ow.Flush()
  [System.IO.File]::WriteAllBytes($dest, $out.ToArray())
  $ow.Dispose()
  $out.Dispose()
}

$uri = New-Object System.Uri ((Resolve-Path $srcPath).Path)
$decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create(
  $uri,
  [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
  [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
)
$source = $decoder.Frames[0]

$tmp = Join-Path $root ".icon-tmp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$sizes = 16, 24, 32, 48, 64, 128, 180, 256, 512, 1024
$map = @{}
foreach ($size in $sizes) {
  $path = Join-Path $tmp "$size.png"
  Save-ScaledPng $source $size $path
  $map[$size] = $path
}

$icons = Join-Path $root "src-tauri\icons"
Copy-Item $map[32] (Join-Path $icons "32x32.png") -Force
Copy-Item $map[128] (Join-Path $icons "128x128.png") -Force
Copy-Item $map[256] (Join-Path $icons "128x128@2x.png") -Force
Copy-Item $map[512] (Join-Path $icons "icon.png") -Force
Write-Ico (Join-Path $icons "icon.ico") @{
  16 = $map[16]
  32 = $map[32]
  48 = $map[48]
  256 = $map[256]
}
Write-Icns (Join-Path $icons "icon.icns") @{
  icp4 = $map[16]
  icp5 = $map[32]
  icp6 = $map[64]
  ic07 = $map[128]
  ic08 = $map[256]
  ic09 = $map[512]
  ic10 = $map[1024]
  ic11 = $map[32]
  ic12 = $map[64]
  ic13 = $map[256]
  ic14 = $map[512]
}

$public = Join-Path $root "public"
Copy-Item $map[256] (Join-Path $public "icon.png") -Force
Copy-Item (Join-Path $icons "icon.ico") (Join-Path $public "favicon.ico") -Force

$web = Join-Path $root "website\public"
if (Test-Path $web) {
  Copy-Item $map[256] (Join-Path $web "icon.png") -Force
  Copy-Item $map[180] (Join-Path $web "apple-touch-icon.png") -Force
  Copy-Item (Join-Path $icons "icon.ico") (Join-Path $web "favicon.ico") -Force
}

Remove-Item -Recurse -Force $tmp
Write-Output "Icons written from subber-logo.png"
