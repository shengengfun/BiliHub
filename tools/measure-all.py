"""完整测量原始截图版面，结果写入 .analysis/measure.txt。"""
from PIL import Image

HOME = 'Screenshot_2026-10-01-09-18-49-645_tv.danmaku.bi.jpg'
DYN = 'Screenshot_2026-10-01-09-18-52-421_tv.danmaku.bi.jpg'
MINE = 'Screenshot_2026-10-01-09-18-55-869_tv.danmaku.bi.jpg'
SET = 'Screenshot_2026-10-01-09-19-07-518_tv.danmaku.bi.jpg'
PLAYER = 'player.jpg'

out = []


def p(text=''):
    out.append(str(text))


def hexs(c):
    return '#%02x%02x%02x' % tuple(c[:3])


def near(px, target, tol=8):
    return all(abs(int(px[i]) - target[i]) <= tol for i in range(3))


def bbox(im, box, predicate, label):
    """返回 box 内满足 predicate 的像素包围盒"""
    x0, y0, x1, y1 = box
    minx, miny, maxx, maxy = x1, y1, x0, y0
    found = False
    for y in range(y0, y1):
        for x in range(x0, x1):
            if predicate(im.getpixel((x, y))):
                found = True
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    if not found:
        p(f'{label}: 未找到')
        return None
    p(f'{label}: x {minx}..{maxx} (宽 {maxx - minx + 1})  y {miny}..{maxy} (高 {maxy - miny + 1})')
    return (minx, miny, maxx, maxy)


def content_boxes(im, box, predicate, min_gap=6):
    """在 box 内按列找连续内容段"""
    x0, y0, x1, y1 = box
    cols = []
    for x in range(x0, x1):
        hit = any(predicate(im.getpixel((x, y))) for y in range(y0, y1))
        cols.append(hit)
    segs, start = [], None
    for i, hit in enumerate(cols):
        if hit and start is None:
            start = i
        elif not hit and start is not None:
            segs.append((x0 + start, x0 + i - 1))
            start = None
    if start is not None:
        segs.append((x0 + start, x1 - 1))
    merged = []
    for s, e in segs:
        if merged and s - merged[-1][1] <= min_gap:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    return merged


# ---------------- HOME ----------------
im = Image.open(HOME).convert('RGB')
p('=========== HOME 顶栏 (0..152) ===========')
white = lambda px: near(px, (255, 255, 255), 6)
p('顶栏内非白元素（按列分组，x 0..2560, y 55..150）:')
for s, e in content_boxes(im, (0, 55, 2560, 150), lambda px: not white(px), min_gap=10):
    p(f'   x {s}..{e}  宽 {e - s + 1}')
p()
p('元素纵向包围盒:')
bbox(im, (55, 55, 140, 152), lambda px: not white(px), '头像')
bbox(im, (150, 55, 660, 152), lambda px: not white(px), '搜索框整体')
bbox(im, (1140, 40, 1340, 152), lambda px: not white(px), '选中标签 推荐')
bbox(im, (2190, 55, 2560, 152), lambda px: not white(px), '右侧图标组')

p()
p('=========== HOME 内容骨架 ===========')
p('卡片行纵向（x=100）:')
COL = (56, 639)


def flat(px):
    return near(px, (241, 242, 244), 8) or near(px, (255, 255, 255), 6)


prev = None
for y in range(150, 1460):
    v = flat(im.getpixel((100, y)))
    if prev is not None and v != prev:
        p(f'   y={y} {"空白" if v else "内容"}')
    prev = v


def row_major(im, y, x0, x1, target, tol=6):
    """该行在 [x0,x1] 内 target 颜色占比"""
    n = sum(1 for x in range(x0, x1) if near(im.getpixel((x, y)), target, tol))
    return n / (x1 - x0)


p()
p('第1列 x 56..639 各行主色（找分隔线与卡片边界）:')
last = None
for y in range(150, 1460):
    from collections import Counter
    c = Counter(im.getpixel((x, y))[:3] for x in range(56, 640, 3)).most_common(1)[0]
    key = ('flat' if near(c[0], (241, 242, 244), 8) else ('white' if near(c[0], (255, 255, 255), 6) else 'other'))
    if key != last:
        p(f'   y={y} {key} {hexs(c[0])}')
        last = key

p()
p('=========== HOME 底栏 ===========')
bbox(im, (0, 1455, 2560, 1600), lambda px: not near(px, (255, 255, 255), 6), '底栏内容')
p('底栏内元素（按列分组）:')
for s, e in content_boxes(im, (0, 1460, 2560, 1560), lambda px: not near(px, (255, 255, 255), 8), min_gap=24):
    p(f'   x {s}..{e}  宽 {e - s + 1}  中心 {(s + e) // 2}')
for label, box in (('首页', (400, 1460, 900, 1560)), ('动态', (1100, 1460, 1500, 1560)), ('我的', (1700, 1460, 2300, 1560))):
    bbox(im, box, lambda px: not near(px, (255, 255, 255), 8), label)

# ---------------- DYNAMIC ----------------
im = Image.open(DYN).convert('RGB')
p()
p('=========== DYNAMIC ===========')
bbox(im, (0, 40, 2560, 145), lambda px: not near(px, (255, 255, 255), 8), '顶栏内容')
p('顶部标签组:')
for s, e in content_boxes(im, (900, 60, 1700, 140), lambda px: not near(px, (255, 255, 255), 10), min_gap=30):
    p(f'   x {s}..{e}  宽 {e - s + 1}')
bbox(im, (2400, 50, 2560, 145), lambda px: not near(px, (255, 255, 255), 8), '右上按钮')
bbox(im, (400, 150, 900, 400), lambda px: not near(px, (246, 247, 249), 4), '左栏首项')
p('左栏各项纵向（x=700）:')
prev = None
for y in range(150, 1460):
    v = near(im.getpixel((700, y)), (246, 247, 249), 5)
    if prev is not None and v != prev:
        p(f'   y={y} {"空白" if v else "内容"}')
    prev = v

# ---------------- MINE ----------------
im = Image.open(MINE).convert('RGB')
p()
p('=========== MINE ===========')
p('横向扫描 y=800 主色变化:')
prev = im.getpixel((0, 800))[:3]
for x in range(4, 2560, 4):
    cur = im.getpixel((x, 800))[:3]
    if sum(abs(cur[i] - prev[i]) for i in range(3)) > 8:
        p(f'   x={x} {hexs(prev)} -> {hexs(cur)}')
    prev = cur
bbox(im, (0, 40, 2560, 150), lambda px: not near(px, (255, 255, 255), 8), '顶栏内容')

# ---------------- SETTINGS ----------------
im = Image.open(SET).convert('RGB')
p()
p('=========== SETTINGS ===========')
p('横向扫描 y=800 主色变化:')
prev = im.getpixel((0, 800))[:3]
for x in range(4, 2560, 4):
    cur = im.getpixel((x, 800))[:3]
    if sum(abs(cur[i] - prev[i]) for i in range(3)) > 8:
        p(f'   x={x} {hexs(prev)} -> {hexs(cur)}')
    prev = cur
bbox(im, (0, 40, 2560, 150), lambda px: not near(px, (255, 255, 255), 8), '顶栏内容')

# ---------------- PLAYER ----------------
im = Image.open(PLAYER).convert('RGB')
p()
p('=========== PLAYER ===========')
p('横向扫描 y=800:')
prev = im.getpixel((0, 800))[:3]
for x in range(8, 2560, 8):
    cur = im.getpixel((x, 800))[:3]
    if sum(abs(cur[i] - prev[i]) for i in range(3)) > 24:
        p(f'   x={x} {hexs(prev)} -> {hexs(cur)}')
    prev = cur
p('控制条区域纵向 x=1400:')
prev = im.getpixel((1400, 1200))[:3]
for y in range(1204, 1600, 2):
    cur = im.getpixel((1400, y))[:3]
    if sum(abs(cur[i] - prev[i]) for i in range(3)) > 20:
        p(f'   y={y} {hexs(prev)} -> {hexs(cur)}')
    prev = cur

with open('.analysis/measure.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('written .analysis/measure.txt', len(out), 'lines')
