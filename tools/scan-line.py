"""沿一条水平线输出颜色变化，用于确定控件边界与填充色"""
import sys
from PIL import Image

src = sys.argv[1]
y = int(sys.argv[2])
x0, x1 = (int(v) for v in sys.argv[3].split(','))

img = Image.open(src).convert('RGB')
px = img.load()

print(f'沿 y={y} 扫描 x {x0}..{x1}')
prev = None
start = x0
for x in range(x0, min(x1, img.width)):
    c = px[x, y]
    key = (c[0] // 6, c[1] // 6, c[2] // 6)
    if key != prev:
        if prev is not None and x - start >= 2:
            mid = (start + x - 1) // 2
            print(f'  x {start:>4}..{x - 1:>4}  宽 {x - start:>4}  #%02x%02x%02x' % px[mid, y])
        prev = key
        start = x
