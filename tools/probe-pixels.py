# 探测若干水平位置的像素颜色，用于确认分隔线 / 底带色值
import sys
from PIL import Image

path = 'Screenshot_2026-10-01-09-18-55-869_tv.danmaku.bi.jpg'
image = Image.open(path).convert('RGB')
ys = [int(v) for v in sys.argv[1:]] or [671, 1189, 1451]
for y in ys:
    values = [image.getpixel((x, y)) for x in (200, 400, 500)]
    print(y, values)
