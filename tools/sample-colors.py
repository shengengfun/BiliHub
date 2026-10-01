"""在指定矩形内采样主要颜色"""
import sys
from collections import Counter
from PIL import Image

src = sys.argv[1]
img = Image.open(src).convert('RGB')
px = img.load()

for spec in sys.argv[2:]:
    name, rect = spec.split('=')
    x0, y0, x1, y1 = (int(v) for v in rect.split(','))
    counts = Counter()
    darkest = (255, 255, 255)
    for y in range(y0, min(y1, img.height)):
        for x in range(x0, min(x1, img.width)):
            c = px[x, y]
            counts[c] += 1
            if sum(c) < sum(darkest):
                darkest = c
    top = counts.most_common(4)
    palette = '  '.join('#%02x%02x%02x(%d)' % (c[0], c[1], c[2], n) for c, n in top)
    print(f'{name:<18} 主色 {palette}   最深 #%02x%02x%02x' % darkest)
