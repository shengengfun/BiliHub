$ErrorActionPreference = 'Stop'
$apk = 'D:\Project\BiliHub\iBiliPlayer-bili.apk'
$list = 'D:\Project\BiliHub\.analysis\icon-list.txt'
$raw = 'D:\Project\BiliHub\.analysis\icons-raw'
$svgOut = 'D:\Project\BiliHub\packages\ui\public\brand'
$jar = 'C:\Program Files\Java\jdk-26.0.2.1\bin\jar.exe'

New-Item -ItemType Directory -Force $raw | Out-Null
New-Item -ItemType Directory -Force $svgOut | Out-Null

$entries = Get-Content $list | ForEach-Object { ($_ -split '=')[0].Trim() } | Where-Object { $_ }
Push-Location $raw
& $jar xf $apk @entries
Pop-Location

$vectorArgs = @()
$copied = 0
foreach ($line in Get-Content $list) {
  $parts = $line -split '='
  $path = $parts[0].Trim()
  $alias = $parts[1].Trim()
  $local = Join-Path $raw ($path -replace '/', '\')
  if (-not (Test-Path $local)) { Write-Warning "缺少 $path"; continue }
  if ($path.EndsWith('.xml')) {
    $vectorArgs += "$local=$alias"
  } else {
    Copy-Item $local (Join-Path $svgOut "$alias.png") -Force
    $copied++
  }
}

if ($vectorArgs.Count -gt 0) {
  $env:SVG_OUT = $svgOut
  Push-Location 'D:\Project\BiliHub'
  & node tools/vector-to-svg.cjs @vectorArgs
  Pop-Location
}
Write-Output "位图复制: $copied"
Get-ChildItem $svgOut -Filter 'player-*' | Select-Object Name, Length
Get-ChildItem $svgOut -Filter 'dm-*' | Select-Object Name, Length
