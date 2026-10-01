"""对原始 APK 截图做像素级测量，用于校准复刻界面的尺寸与配色。
只读取用户自备的截图文件，不涉及 APK 内部资源。
"""
from collections import Counter
from PIL import Image

HOME = 'Screenshot_2026-10-01-09-18-49-645_tv.danmaku.bi.jpg'
DYN = 'Screenshot_2026-10-01-09-18-52-421_tv.danmaku.bi.jpg'
MINE = 'Screenshot_2026-10-01-09-18-55-869_tv.danmaku.bi.jpg'
SET = 'Screenshot_2026-10-01-09-19-07-518_tv.danmaku.bi.jpg'
PLAYER = 'player.jpg'

WHITE = (255, 255, 255)


def is_white(px, tol=12):
    return all(abs(int(px[i]) - 255) <= tol for i in range(3))


def row_nonwhite(im, y, x0=0, x1=None):
    x1 = im.width if x1 is None else x1
    count = 0
    for x in range(x0, x1):
        if not is_white(im.getpixel((x, y))):
            count += 1
    return count / (x1 - x0)


def bands(im, y0, y1, threshold=0.06, x0=0, x1=None, min_len=3):
    out, start = [], None
    for y in range(y0, y1):
        ratio = row_nonwhite(im, y, x0, x1)
        ok = ratio > threshold
        if ok and start is None:
            start = y
        elif not ok and start is not None:
            if y - start >= min_len:
                out.append((start, y - 1))
            start = None
    if start is not None:
        out.append((start, y1 - 1))
    return out


def columns(im, y0, y1, threshold=0.25, min_len=20):
    """在指定纵向区间内，找出内容列（非空白列）区段"""
    out, start = [], None
    for x in range(im.width):
        hits = 0
        for y in range(y0, y1, 2):
            if not is_white(im.getpixel((x, y))):
                hits += 1
        ratio = hits / len(range(y0, y1, 2))
        ok = ratio > threshold
        if ok and start is None:
            start = x
        elif not ok and start is not None:
            if x - start >= min_len:
                out.append((start, x - 1))
            start = None
    if start is not None:
        out.append((start, im.width - 1))
    return out


def common_colors(im, box, top=6):
    x0, y0, x1, y1 = box
    counter = Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            counter[im.getpixel((x, y))[:3]] += 1
    return counter.most_common(top)


def header(text):
    print(f'\n===== {text} =====')


def analyse_home():
    im = Image.open(HOME).convert('RGB')
    header(f'HOME {im.size}')

    # 顶栏与内容区的分界（发丝线）
    for y in range(120, 220):
        c, n = Counter(im.getpixel((x, y))[:3] for x in range(im.width)).most_common(1)[0]
        if n > im.width * 0.9 and not is_white(c, 8):
            print(f'顶栏下边界发丝线 y={y} 颜色={c}')
            break

    # 内容纵向分带
    bs = bands(im, 155, 1440, threshold=0.05)
    print('内容纵向分带 (y0, y1, 高):')
    for s, e in bs[:14]:
        print(f'   {s}..{e}   高 {e - s + 1}')

    # 取第一个封面带做列切分
    cover = next(((s, e) for s, e in bs if e - s > 150), None)
    if cover:
        cols = columns(im, cover[0] + 5, cover[1] - 5, threshold=0.25, min_len=40)
        print(f'封面带 {cover} 的列区段:')
        for s, e in cols:
            print(f'   x {s}..{e}  宽 {e - s + 1}')
        if len(cols) > 1:
            print('   列间距:', [cols[i + 1][0] - cols[i][1] - 1 for i in range(len(cols) - 1)])
            print('   左边距:', cols[0][0], ' 右边距:', im.width - 1 - cols[-1][1])

    # 底部导航
    bs2 = bands(im, 1440, im.height, threshold=0.02)
    print('底栏分带:', bs2)
    if bs2:
        top = bs2[0][0]
        print('底栏顶边 y=', top, ' 高=', im.height - top)


def analyse_screen(path, name, y_probe=(200, 700)):
    im = Image.open(path).convert('RGB')
    header(f'{name} {im.size}')
    for y in (300, 500):
        counter = Counter(im.getpixel((x, y))[:3] for x in range(0, im.width, 3))
        print(f'y={y} 主色:', counter.most_common(4))
    bs = bands(im, 0, im.height, threshold=0.06)
    print('纵向分带:', bs[:16])
    # 顶部栏高度
    for y in range(80, 260):
        c, n = Counter(im.getpixel((x, y))[:3] for x in range(im.width)).most_common(1)[0]
        if n > im.width * 0.85 and not is_white(c, 8):
            print(f'顶部区域下边界发丝线 y={y} 颜色={c}')
            break


if __name__ == '__main__':
    analyse_home()
    analyse_screen(DYN, 'DYNAMIC')
    analyse_screen(MINE, 'MINE')
    analyse_screen(SET, 'SETTINGS')
    analyse_screen(PLAYER, 'PLAYER')
