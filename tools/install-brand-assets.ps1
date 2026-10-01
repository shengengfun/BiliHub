$ErrorActionPreference = 'Stop'
$src = 'D:\Project\BiliHub\.analysis\assets\res'
$svg = 'D:\Project\BiliHub\.analysis\svg'
$dst = 'D:\Project\BiliHub\packages\ui\public\brand'

New-Item -ItemType Directory -Force $dst | Out-Null

$map = @{
  'VU6.png'  = 'logo.png'
  'ShY.png'  = 'logo-dark.png'
  'W8F.png'  = 'logo-white.png'
  'g9L.png'  = 'ic-qr.png'
  'SGR.png'  = 'ic-scan.png'
  'Lhf.png'  = 'ic-notice.png'
  'jGx.png'  = 'ic-avatar.png'
  '_9S.png'  = 'ic-mine-offline.png'
  'Gdu.png'  = 'ic-mine-history.png'
  'jX0.png'  = 'ic-mine-favorite.png'
  'Sk6.png'  = 'ic-mine-watchlater.png'
  'Emm.png'  = 'ic-mine-setting.png'
  'zpg.png'  = 'ic-mine-feedback.png'
  'poF.png'  = 'ic-mine-arrow.png'
  'bL6.png'  = 'ic-mine-theme.png'
  'z35.png'  = 'ic-mine-mall.png'
  'v5r.png'  = 'ic-mine-live.png'
  'g3_.png'  = 'ic-mine-wallet.png'
  'KYV.png'  = 'ic-mine-common.png'
  'Jtd.png'  = 'ic-mine-scan.png'
}

foreach ($key in $map.Keys) {
  $from = Join-Path $src $key
  if (Test-Path $from) { Copy-Item $from (Join-Path $dst $map[$key]) -Force }
  else { Write-Warning "缺少 $key" }
}

foreach ($file in Get-ChildItem $svg -Filter '*.svg') {
  Copy-Item $file.FullName (Join-Path $dst $file.Name) -Force
}

Get-ChildItem $dst | Sort-Object Name | Select-Object Name, Length
