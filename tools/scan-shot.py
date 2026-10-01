"""按行/列采样原始截图的颜色，用于定位版面边界。"""
import sys
from collections import Counter
from PIL import Image

FILES = {
    'home': 'Screenshot_2026-10-01-09-18-49-645_tv.danmaku.bi.jpg',
    'dynamic': 'Screenshot_2026-10-01-09-18-52-421_tv.danmaku.bi.jpg',
    'mine': 'Screenshot_2026-10-01-09-18-55-869_tv.danmaku.bi.jpg',
    'settings': 'Screenshot_2026-10-01-09-19-07-518_tv.danmaku.bi.jpg',
    'player': 'player.jpg',
}


def scan_x(name, y, step=40):
    im = Image.open(FILES[name]).convert('RGB')
    print(f'\n--- {name} 横向采样 y={y} (步长 {step}) ---')
    prev = None
    for x in range(0, im.width, step):
        c = im.getpixel((x, y))[:3]
        hexval = '#%02x%02x%02x' % c
        mark = ''
        if prev and sum(abs(c[i] - prev[i]) for i in range(3)) > 24:
            mark = '  <== 变化'
        print(f'x={x:5d} {hexval}{mark}')
        prev = c


def scan_y(name, x, step=20, y0=0, y1=None):
    im = Image.open(FILES[name]).convert('RGB')
    y1 = im.height if y1 is None else y1
    print(f'\n--- {name} 纵向采样 x={x} (步长 {step}, {y0}..{y1}) ---')
    prev = None
    for y in range(y0, y1, step):
        c = im.getpixel((x, y))[:3]
        hexval = '#%02x%02x%02x' % c
        mark = ''
        if prev and sum(abs(c[i] - prev[i]) for i in range(3)) > 24:
            mark = '  <== 变化'
        print(f'y={y:5d} {hexval}{mark}')
        prev = c


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'home'
    mode = sys.argv[2] if len(sys.argv) > 2 else 'x'
    value = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    step = int(sys.argv[4]) if len(sys.argv) > 4 else 40
    if mode == 'x':
        scan_x(target, value, step)
    else:
        scan_y(target, value, step)
