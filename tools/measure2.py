"""针对复刻界面的关键控件做精确测量。"""
from collections import Counter
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


def near(px, target, tol=10):
    return all(abs(int(px[i]) - target[i]) <= tol for i in range(3))


def pink(px, tol=40):
    r, g, b = px[:3]
    return r > 200 and 70 < g < 165 and 120 < b < 190


def bbox(im, box, pred, label):
    x0, y0, x1, y1 = box
    minx, miny, maxx, maxy = x1, y1, x0, y0
    found = False
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pred(im.getpixel((x, y))):
                found = True
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    if not found:
        p(f'{label}: 未找到')
        return None
    p(f'{label}: x {minx}..{maxx} (宽 {maxx - minx + 1})  y {miny}..{maxy} (高 {maxy - miny + 1})')
    return (minx, miny, maxx, maxy)


im = Image.open(HOME).convert('RGB')
p('===== HOME 选中标签下划线 =====')
bbox(im, (1000, 130, 1300, 152), pink, '推荐下划线')

p('\n===== HOME 卡片底部信息行 =====')
bbox(im, (56, 630, 640, 710), lambda px: not near(px, (255, 255, 255), 8), '底部整行')
bbox(im, (56, 640, 300, 710), lambda px: near(px, (255, 241, 238), 12), '点赞徽章底')
bbox(im, (56, 630, 300, 710), lambda px: px[0] > 200 and px[1] < 160 and px[2] < 140, '点赞徽章文字')
p('UP 徽章与作者：')
bbox(im, (280, 630, 640, 710), lambda px: not near(px, (255, 255, 255), 8), 'UP+作者+菜单')
p('标题包围盒:')
bbox(im, (56, 520, 640, 620), lambda px: not near(px, (255, 255, 255), 10), '标题')

p('\n===== HOME 封面信息行 =====')
bbox(im, (56, 440, 640, 520), lambda px: not near(px, (255, 255, 255), 60) and min(px[:3]) > 150, '亮色文字')

p('\n===== HOME 底栏 =====')
for y in (1460, 1470, 1480, 1500, 1540, 1560, 1575, 1590):
    row = Counter(im.getpixel((x, y))[:3] for x in range(0, 2560, 8))
    top = row.most_common(2)
    second = hexs(top[1][0]) if len(top) > 1 else '-'
    p(f'  y={y} 主色 {hexs(top[0][0])}  次色 {second}')
p('底栏内横向元素（y 1460..1600）:')
cols = []
for x in range(0, 2560):
    hit = any(not near(im.getpixel((x, y)), (255, 255, 255), 10) for y in range(1462, 1600, 2))
    cols.append(hit)
segs, start = [], None
for i, h in enumerate(cols):
    if h and start is None:
        start = i
    elif not h and start is not None:
        segs.append((start, i - 1)); start = None
if start is not None:
    segs.append((start, 2559))
merged = []
for s, e in segs:
    if merged and s - merged[-1][1] <= 30:
        merged[-1] = (merged[-1][0], e)
    else:
        merged.append((s, e))
for s, e in merged:
    p(f'   x {s}..{e} 宽 {e - s + 1} 中心 {(s + e) // 2}')

p('\n===== HOME 底栏纵向（x=1281） =====')
prev = None
for y in range(1450, 1600):
    v = near(im.getpixel((1281, y)), (255, 255, 255), 10)
    if prev is not None and v != prev:
        p(f'   y={y} {"空白" if v else "内容"}')
    prev = v

im = Image.open(MINE).convert('RGB')
p('\n===== MINE 分栏 =====')
p('y=1200 横向:')
prev = im.getpixel((0, 1200))[:3]
for x in range(2, 2560, 2):
    cur = im.getpixel((x, 1200))[:3]
    if sum(abs(cur[i] - prev[i]) for i in range(3)) > 6:
        p(f'   x={x} {hexs(prev)} -> {hexs(cur)}')
    prev = cur
p('x=1600 纵向（右栏）:')
prev = None
for y in range(40, 1500):
    v = near(im.getpixel((1600, y)), (255, 255, 255), 8)
    if prev is not None and v != prev:
        p(f'   y={y} {"白" if v else "非白"}')
    prev = v
p('左栏纵向 (x=300):')
prev = None
for y in range(40, 1500):
    v = near(im.getpixel((300, y)), (255, 255, 255), 8)
    if prev is not None and v != prev:
        p(f'   y={y} {"白" if v else "非白"}')
    prev = v

im = Image.open(SET).convert('RGB')
p('\n===== SETTINGS 右栏列表 =====')
p('x=800 纵向（行与分组间距）:')
prev = None
for y in range(150, 1470):
    px = im.getpixel((800, y))
    v = near(px, (255, 255, 255), 8)
    if prev is not None and v != prev:
        p(f'   y={y} {"白" if v else "非白 " + hexs(px)}')
    prev = v

im = Image.open(DYN).convert('RGB')
p('\n===== DYNAMIC 左栏列表 =====')
p('x=700 纵向:')
prev = None
for y in range(150, 1470):
    v = near(im.getpixel((700, y)), (246, 247, 249), 6)
    if prev is not None and v != prev:
        p(f'   y={y} {"底" if v else "内容"}')
    prev = v
p('左栏首项横向 (y=290):')
prev = im.getpixel((420, 290))[:3]
for x in range(422, 900, 2):
    cur = im.getpixel((x, 290))[:3]
    if sum(abs(cur[i] - prev[i]) for i in range(3)) > 14:
        p(f'   x={x} {hexs(prev)} -> {hexs(cur)}')
    prev = cur

im = Image.open(PLAYER).convert('RGB')
p('\n===== PLAYER 分栏 =====')
p('y=900 横向（找视频与侧栏边界）:')
prev = im.getpixel((0, 900))[:3]
for x in range(4, 2560, 4):
    cur = im.getpixel((x, 900))[:3]
    if sum(abs(cur[i] - prev[i]) for i in range(3)) > 40:
        p(f'   x={x} {hexs(prev)} -> {hexs(cur)}')
    prev = cur

with open('.analysis/measure2.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('written', len(out), 'lines')
