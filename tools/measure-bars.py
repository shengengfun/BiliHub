"""补充测量：顶栏、底栏、搜索框、各页分栏。"""
from PIL import Image

HOME = 'Screenshot_2026-10-01-09-18-49-645_tv.danmaku.bi.jpg'
DYN = 'Screenshot_2026-10-01-09-18-52-421_tv.danmaku.bi.jpg'
MINE = 'Screenshot_2026-10-01-09-18-55-869_tv.danmaku.bi.jpg'
SET = 'Screenshot_2026-10-01-09-19-07-518_tv.danmaku.bi.jpg'
PLAYER = 'player.jpg'


def hexs(c):
    return '#%02x%02x%02x' % c[:3]


def vscan(path, x, y0, y1, step=2, tol=14, label=''):
    im = Image.open(path).convert('RGB')
    print(f'\n--- {label} 纵向 x={x} ---')
    prev = im.getpixel((x, y0))[:3]
    for y in range(y0 + step, y1, step):
        cur = im.getpixel((x, y))[:3]
        if sum(abs(cur[i] - prev[i]) for i in range(3)) > tol:
            print(f'  y={y:5d} {hexs(prev)} -> {hexs(cur)}')
        prev = cur


def hscan(path, y, x0, x1, step=2, tol=10, label=''):
    im = Image.open(path).convert('RGB')
    print(f'\n--- {label} 横向 y={y} ---')
    prev = im.getpixel((x0, y))[:3]
    for x in range(x0 + step, x1, step):
        cur = im.getpixel((x, y))[:3]
        if sum(abs(cur[i] - prev[i]) for i in range(3)) > tol:
            print(f'  x={x:5d} {hexs(prev)} -> {hexs(cur)}')
        prev = cur


def extent(path, x, y0, y1, predicate, label):
    """找满足条件的第一段纵向区间"""
    im = Image.open(path).convert('RGB')
    start = None
    for y in range(y0, y1):
        ok = predicate(im.getpixel((x, y))[:3])
        if ok and start is None:
            start = y
        elif not ok and start is not None:
            print(f'{label}: y {start}..{y - 1}  高 {y - start}')
            return
    if start is not None:
        print(f'{label}: y {start}..{y1 - 1}')


if __name__ == '__main__':
    print('=========== HOME 顶栏 ===========')
    extent(HOME, 400, 0, 200, lambda p: not (abs(p[0] - 255) < 8 and abs(p[1] - 255) < 8 and abs(p[2] - 255) < 8), '搜索框（x=400）')
    vscan(HOME, 83, 0, 160, 2, 14, 'HOME 头像')
    vscan(HOME, 1240, 100, 200, 2, 14, 'HOME 选中下划线')
    hscan(HOME, 67, 0, 260, 2, 12, 'HOME 顶栏左端')
    hscan(HOME, 67, 2100, 2560, 2, 12, 'HOME 顶栏右端')

    print('\n=========== HOME 底栏 ===========')
    vscan(HOME, 600, 1400, 1600, 2, 10, 'HOME 底栏')
    hscan(HOME, 1500, 0, 2560, 4, 20, 'HOME 底栏图标')

    print('\n=========== DYNAMIC 分栏 ===========')
    hscan(DYN, 1200, 380, 500, 2, 4, 'DYNAMIC 左栏起点')
    hscan(DYN, 1200, 800, 940, 2, 4, 'DYNAMIC 分隔')
    hscan(DYN, 1200, 2080, 2200, 2, 4, 'DYNAMIC 右栏终点')
    vscan(DYN, 1000, 100, 300, 2, 10, 'DYNAMIC 顶栏/内容')
    vscan(DYN, 700, 140, 400, 2, 8, 'DYNAMIC 左栏首项')

    print('\n=========== MINE 分栏 ===========')
    hscan(MINE, 800, 0, 700, 4, 8, 'MINE 左侧')
    hscan(MINE, 800, 700, 2560, 4, 8, 'MINE 右侧')
    vscan(MINE, 200, 0, 300, 2, 10, 'MINE 顶部')

    print('\n=========== SETTINGS 分栏 ===========')
    hscan(SET, 800, 0, 700, 4, 8, 'SETTINGS 左侧')
    hscan(SET, 800, 700, 2560, 4, 8, 'SETTINGS 右侧')
    vscan(SET, 1300, 400, 700, 2, 8, 'SETTINGS 中部')

    print('\n=========== PLAYER ===========')
    hscan(PLAYER, 800, 0, 2560, 8, 20, 'PLAYER 横向')
    vscan(PLAYER, 300, 1300, 1600, 2, 20, 'PLAYER 控制条')
