$ErrorActionPreference = 'Stop'
$apk = 'D:\Project\BiliHub\iBiliPlayer-bili.apk'
$out = 'D:\Project\BiliHub\.analysis\assets'
$jar = 'C:\Program Files\Java\jdk-26.0.2.1\bin\jar.exe'

New-Item -ItemType Directory -Force $out | Out-Null

# 需要提取的资源：res 内的混淆文件名
$files = @(
  'res/GjV.xml', 'res/yPt.xml', 'res/R7R.xml', 'res/Pom.xml', 'res/Ydp.xml', 'res/KRU.xml',
  'res/VU6.png', 'res/ShY.png', 'res/W8F.png', 'res/aWq.png', 'res/NAt.png',
  'res/_9S.png', 'res/Gdu.png', 'res/jX0.png', 'res/Sk6.png', 'res/Jtd.png', 'res/Emm.png',
  'res/zpg.png', 'res/poF.png', 'res/bL6.png', 'res/z35.png', 'res/v5r.png', 'res/g3_.png', 'res/KYV.png',
  'res/SGR.png', 'res/Lhf.png', 'res/g9L.png', 'res/jGx.png'
)

Push-Location $out
& $jar xf $apk @files
Pop-Location

Get-ChildItem (Join-Path $out 'res') | Sort-Object Name | Select-Object Name, Length
