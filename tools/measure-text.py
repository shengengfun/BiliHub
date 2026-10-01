"""测量文字行的像素高度，用于推算字号"""
import sys
from PIL import Image

src = sys.argv[1]
img = Image.open(src).convert('RGB')
px = img.load()

DENSITY = 2.1875  # 由 card_margin 16dp -> 35px 推得

for spec in sys.argv[2:]:
    name, rect, thresh = spec.split('=')
    x0, y0, x1, y1 = (int(v) for v in rect.split(','))
    t = int(thresh)
    rows = []
    for y in range(y0, min(y1, img.height)):
        ink = 0
        for x in range(x0, min(x1, img.width)):
            c = px[x, y]
            if (c[0] + c[1] + c[2]) / 3 < t:
                ink += 1
        rows.append((y, ink))
    active = [y for y, n in rows if n >= 2]
    if not active:
        print(f'{name:<16} 未检测到文字')
        continue
    top, bottom = active[0], active[-1]
    h = bottom - top + 1
    print(f'{name:<16} y {top}..{bottom}  墨迹高 {h}px  ≈ {h / DENSITY:.1f}dp')

    # 找出连续文字行分组，用于区分多行
    groups = []
    start = active[0]
    prev = active[0]
    for y in active[1:]:
        if y - prev > 3:
            groups.append((start, prev))
            start = y
        prev = y
    groups.append((start, prev))
    for i, (a, b) in enumerate(groups):
        print(f'    行{i + 1}: y {a}..{b}  高 {b - a + 1}px  ≈ {(b - a + 1) / DENSITY:.1f}dp')
