"""测量单个卡片内部结构：封面高度、文字区高度、字号"""
import sys
from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert('RGB')
px = img.load()

# 第一列第一张卡片（由 analyze-grid 测得）
COL = (54, 639)
ROW = (187, 713)
BG = (241, 242, 244)


def is_bg(c, tol=8):
    return abs(c[0] - BG[0]) < tol and abs(c[1] - BG[1]) < tol and abs(c[2] - BG[2]) < tol


print(f'卡片区域 x {COL[0]}..{COL[1]}  y {ROW[0]}..{ROW[1]}  宽 {COL[1] - COL[0] + 1}  高 {ROW[1] - ROW[0] + 1}')

# 逐行判断：该行是否几乎全是页面底色（说明是卡片间隙或卡片外）
print('\n=== 卡片内竖直结构（按行主色） ===')
prev = None
start = ROW[0]
for y in range(ROW[0], ROW[1] + 1):
    row = [px[x, y] for x in range(COL[0], COL[1] + 1, 6)]
    c = max(set(row), key=row.count)
    key = (c[0] // 8, c[1] // 8, c[2] // 8)
    if key != prev:
        if prev is not None and y - start > 6:
            print(f'  y {start:>4}..{y - 1:>4}  高 {y - start:>4}  #%02x%02x%02x' % px[(COL[0] + COL[1]) // 2, (start + y - 1) // 2])
        prev = key
        start = y

# 找封面底边：从上往下第一条持续为白色（卡片底）的行
print('\n=== 封面/文字区分界 ===')
white_start = None
run = 0
for y in range(ROW[0], ROW[1] + 1):
    c = px[(COL[0] + COL[1]) // 2, y]
    if c[0] > 246 and c[1] > 246 and c[2] > 246:
        run += 1
        if run == 18 and white_start is None:
            white_start = y - 17
    else:
        run = 0
        if white_start is not None and y - white_start > 40:
            pass
if white_start:
    cover_h = white_start - ROW[0]
    print(f'  封面底边 y={white_start}  封面高度 {cover_h}px  宽高比 {COL[1] - COL[0] + 1}:{cover_h} = {round((COL[1] - COL[0] + 1) / cover_h, 3)}')
    print(f'  文字区高度 {ROW[1] - white_start + 1}px')

# 文字行检测：在文字区内找深色像素行（区分标题/UP 主行）
print('\n=== 文字区内的文字行 ===')
tx0, tx1 = COL[0], COL[1]
for y in range(white_start or ROW[0], ROW[1] + 1):
    dark = 0
    for x in range(tx0, tx1 + 1, 2):
        c = px[x, y]
        if c[0] < 150 and c[1] < 150 and c[2] < 150:
            dark += 1
    if dark > 4:
        print(f'  y={y:>4}  深色像素 {dark}')
