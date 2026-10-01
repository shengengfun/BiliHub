"""从原包截图中量化真实配色与布局几何"""
import sys
from collections import Counter
from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert('RGB')
W, H = img.size
px = img.load()
print(f'图像尺寸: {W} x {H}')


def hexof(c):
    return '#%02x%02x%02x' % c


# 1. 全局调色板（按出现次数）
counts = Counter()
for y in range(0, H, 3):
    for x in range(0, W, 3):
        counts[px[x, y]] += 1
print('\n=== 主要颜色 (Top 12) ===')
for color, n in counts.most_common(12):
    print(f'  {hexof(color)}  {n:>7}  {n * 100.0 / sum(counts.values()):5.2f}%')


# 2. 逐行扫描：找出横向分界（整行颜色几乎一致的行）
print('\n=== 横向分界（近纯色行） ===')
prev = None
for y in range(H):
    row = [px[x, y] for x in range(0, W, 8)]
    c = Counter(row).most_common(1)[0]
    if c[1] >= len(row) - 1:
        if prev != c[0]:
            print(f'  y={y:>4}  {hexof(c[0])}')
            prev = c[0]
    else:
        prev = None


# 3. 在指定行上扫描竖直边界（卡片之间通常是背景色间隔）
def scan_row(y, label):
    runs = []
    cur = None
    start = 0
    for x in range(W):
        c = px[x, y]
        key = (c[0] // 12, c[1] // 12, c[2] // 12)
        if key != cur:
            if cur is not None and x - start > 3:
                runs.append((start, x - 1, x - start, hexof(px[(start + x - 1) // 2, y])))
            cur = key
            start = x
    runs.append((start, W - 1, W - start, hexof(px[(start + W - 1) // 2, y])))
    print(f'\n=== 行 y={y} ({label}) 的颜色分段 ===')
    for s, e, w, c in runs[:26]:
        print(f'  x {s:>4}..{e:>4}  宽 {w:>4}  {c}')


scan_row(int(H * 0.045), '顶栏')
scan_row(int(H * 0.30), '卡片区')
scan_row(int(H * 0.26), '卡片封面下缘')
scan_row(int(H * 0.965), '底部导航')


# 4. 竖直扫描左边缘，找出卡片行的上下边界
print('\n=== 列 x=20 的竖直分段（页面左边距区域） ===')
x = 20
prev = None
start = 0
for y in range(H):
    c = px[x, y]
    key = (c[0] // 12, c[1] // 12, c[2] // 12)
    if key != prev:
        if prev is not None and y - start > 4:
            print(f'  y {start:>4}..{y - 1:>4}  高 {y - start:>4}  {hexof(px[x, (start + y - 1) // 2])}')
        prev = key
        start = y
