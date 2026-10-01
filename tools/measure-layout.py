"""定位原始截图里的封面带、分隔线与底栏，输出可直接换算成 CSS 的数值。"""
from collections import Counter
from PIL import Image

FILES = {
    'home': 'Screenshot_2026-10-01-09-18-49-645_tv.danmaku.bi.jpg',
    'dynamic': 'Screenshot_2026-10-01-09-18-52-421_tv.danmaku.bi.jpg',
    'mine': 'Screenshot_2026-10-01-09-18-55-869_tv.danmaku.bi.jpg',
    'settings': 'Screenshot_2026-10-01-09-19-07-518_tv.danmaku.bi.jpg',
    'player': 'player.jpg',
}

PAGE_BG = (241, 242, 244)


def eq(px, target, tol=8):
    return all(abs(int(px[i]) - target[i]) <= tol for i in range(3))


def is_flat(px):
    """页面底色或纯白都算“空白”"""
    return eq(px, PAGE_BG, 8) or eq(px, (255, 255, 255), 6)


def cover_bands(im, x, y0, y1, min_len=60):
    out, start = [], None
    for y in range(y0, y1):
        flat = is_flat(im.getpixel((x, y)))
        if not flat and start is None:
            start = y
        elif flat and start is not None:
            if y - start >= min_len:
                out.append((start, y - 1, y - start))
            start = None
    if start is not None and y1 - start >= min_len:
        out.append((start, y1 - 1, y1 - start))
    return out


def divider_rows(im, x0, x1, y0, y1):
    """找出横向发丝线：该行在 [x0,x1] 内绝大部分是很浅的灰"""
    out = []
    for y in range(y0, y1):
        counter = Counter(im.getpixel((x, y))[:3] for x in range(x0, x1, 2))
        color, count = counter.most_common(1)[0]
        total = len(range(x0, x1, 2))
        if count > total * 0.7 and 200 <= color[0] <= 245 and abs(color[0] - color[2]) < 12:
            out.append((y, color))
    return out


def report_home():
    im = Image.open(FILES['home']).convert('RGB')
    print(f'=== HOME {im.size} ===')
    for x, name in ((300, '第1列'), (900, '第2列')):
        bs = cover_bands(im, x, 155, 1450)
        print(f'{name} x={x} 封面带:')
        for s, e, h in bs:
            print(f'    y {s}..{e}  高 {h}')
    print('第1列分隔线 (x 56..640):')
    for y, color in divider_rows(im, 56, 640, 500, 1450)[:12]:
        print(f'    y={y} {color}')


def report_band(path, name, y0, y1, x):
    im = Image.open(FILES[path]).convert('RGB')
    print(f'\n=== {name} {im.size} ===')
    bs = cover_bands(im, x, y0, y1, min_len=20)
    for s, e, h in bs[:20]:
        print(f'    y {s}..{e}  高 {h}')


def report_column_edges(path, name, y, step=4):
    im = Image.open(FILES[path]).convert('RGB')
    print(f'\n=== {name} 列边界 y={y} ===')
    prev = im.getpixel((0, y))[:3]
    for x in range(step, im.width, step):
        cur = im.getpixel((x, y))[:3]
        if sum(abs(cur[i] - prev[i]) for i in range(3)) > 20:
            print(f'    x={x:5d} #%02x%02x%02x' % prev + ' -> #%02x%02x%02x' % cur)
        prev = cur


if __name__ == '__main__':
    report_home()
    report_column_edges('dynamic', 'DYNAMIC', 800)
    report_column_edges('mine', 'MINE', 800)
    report_column_edges('settings', 'SETTINGS', 800)
    report_column_edges('player', 'PLAYER', 800)
