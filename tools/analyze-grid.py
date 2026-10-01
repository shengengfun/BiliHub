"""精确测量信息流栅格几何与关键配色"""
import sys
from collections import Counter
from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert('RGB')
W, H = img.size
px = img.load()

BG = None
counts = Counter()
for y in range(0, H, 2):
    for x in range(0, W, 2):
        counts[px[x, y]] += 1
BG = counts.most_common(2)[1][0] if counts.most_common(1)[0][0] == (255, 255, 255) else counts.most_common(1)[0][0]
print(f'尺寸 {W}x{H}   页面底色 {"#%02x%02x%02x" % BG}')


def is_bg(c, tol=10):
    return abs(c[0] - BG[0]) < tol and abs(c[1] - BG[1]) < tol and abs(c[2] - BG[2]) < tol


def is_white(c, tol=10):
    return c[0] > 255 - tol and c[1] > 255 - tol and c[2] > 255 - tol


# 顶栏与底栏的竖直边界
top_end = 0
for y in range(H):
    if not is_white(px[W // 2, y]):
        top_end = y
        break
bottom_start = H
for y in range(H - 1, -1, -1):
    if not is_white(px[W // 2, y]):
        bottom_start = y + 1
        break
print(f'顶栏 0..{top_end}（高 {top_end}）  底部导航 {bottom_start}..{H}（高 {H - bottom_start}）')

# 内容区内的竖直间隙（列间空白）
content_top, content_bottom = top_end, bottom_start
probe_rows = range(content_top + 20, min(content_bottom, content_top + 700), 5)
gap_cols = []
for x in range(W):
    total = 0
    hit = 0
    for y in probe_rows:
        total += 1
        if is_bg(px[x, y]) or is_white(px[x, y]):
            hit += 1
    if total and hit / total > 0.92:
        gap_cols.append(x)

runs = []
if gap_cols:
    start = gap_cols[0]
    prev = gap_cols[0]
    for x in gap_cols[1:]:
        if x - prev > 1:
            runs.append((start, prev))
            start = x
        prev = x
    runs.append((start, prev))
print('\n=== 列间空白（栅格间隙） ===')
for s, e in runs:
    print(f'  x {s:>4}..{e:>4}  宽 {e - s + 1}')

cols = []
prev_end = None
for s, e in runs:
    if prev_end is not None:
        cols.append((prev_end + 1, s - 1))
    prev_end = e
print('\n=== 推断列区间 ===')
for i, (s, e) in enumerate(cols):
    print(f'  第{i + 1}列 x {s:>4}..{e:>4}  宽 {e - s + 1}')

# 卡片行：在某一列内部找竖直空隙
if cols:
    cs, ce = cols[0]
    mid = (cs + ce) // 2
    gap_rows = []
    for y in range(content_top, content_bottom):
        if is_bg(px[cs + 4, y]) and is_bg(px[ce - 4, y]) and is_bg(px[mid, y]):
            gap_rows.append(y)
    rowruns = []
    if gap_rows:
        start = gap_rows[0]
        prev = gap_rows[0]
        for y in gap_rows[1:]:
            if y - prev > 1:
                rowruns.append((start, prev))
                start = y
            prev = y
        rowruns.append((start, prev))
    print('\n=== 行间空白 ===')
    for s, e in rowruns[:14]:
        print(f'  y {s:>4}..{e:>4}  高 {e - s + 1}')
    cards = []
    prev_end = content_top
    for s, e in rowruns:
        if s - prev_end > 40:
            cards.append((prev_end, s - 1))
        prev_end = e
    print('\n=== 推断卡片行高度 ===')
    for i, (s, e) in enumerate(cards[:6]):
        print(f'  第{i + 1}行 y {s:>4}..{e:>4}  高 {e - s + 1}')

# 主题色（在底栏选中项处采样）
print('\n=== 底栏选中色采样 ===')
best = None
for y in range(bottom_start, H):
    for x in range(W):
        c = px[x, y]
        if c[0] > 200 and 60 < c[1] < 180 and 100 < c[2] < 200:
            best = (x, y, c)
            break
    if best:
        break
if best:
    print(f'  位置 {best[0]},{best[1]}  #%02x%02x%02x' % best[2])
