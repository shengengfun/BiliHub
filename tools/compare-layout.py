"""把原包截图与当前复刻截图按同一比例做对比，输出归一化后的关键尺寸。"""
from collections import Counter
from PIL import Image

ORIG = 'Screenshot_2026-10-01-09-18-49-645_tv.danmaku.bi.jpg'
CUR = '.analysis/cur-home.png'
DESIGN_W = 1170


def near(px, target, tol=10):
    return all(abs(int(px[i]) - target[i]) <= tol for i in range(3))


def white(px, tol=8):
    return near(px, (255, 255, 255), tol)


def pagebg(px):
    return near(px, (241, 242, 244), 8)


def flat(px):
    return white(px) or pagebg(px)


def analyse(path, label, ignore_status_bar=True):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    k = DESIGN_W / W  # 换算到 1170 设计宽度
    print(f'\n===== {label} ({W}x{H}, 系数 {k:.4f}) =====')

    # 顶栏下沿：整行基本都是同一种浅灰/白，且颜色不是纯白 → 发丝线
    topbar = None
    start = int(60 * W / 2560) if ignore_status_bar else 0
    for y in range(start, int(300 * W / 2560)):
        c, n = Counter(im.getpixel((x, y))[:3] for x in range(0, W, 3)).most_common(1)[0]
        if n > (W / 3) * 0.85 and not white(c, 6) and c[0] > 180:
            topbar = y
            break
    if topbar:
        print(f'  顶栏高度      {topbar} → {topbar * k:.1f}px')

    # 首行卡片横向边界：在封面带内找非空白列
    band_top = topbar or int(152 * W / 2560)
    probe_y = None
    for y in range(band_top + int(20 * W / 2560), band_top + int(300 * W / 2560)):
        hits = sum(1 for x in range(0, W, 4) if not flat(im.getpixel((x, y))))
        if hits > (W / 4) * 0.5:
            probe_y = y
            break
    if probe_y is None:
        print('  未找到封面行')
        return

    cols, start = [], None
    band = int(60 * W / 2560)
    for x in range(W):
        hits = sum(1 for y in range(probe_y, probe_y + band) if not flat(im.getpixel((x, y))))
        # 封面内部可能有接近白色的区域，用比例而不是全等来判断“有内容”
        hit = hits > band * 0.55
        if hit and start is None:
            start = x
        elif not hit and start is not None:
            if x - start > W * 0.02:
                cols.append((start, x - 1))
            start = None
    if start is not None:
        cols.append((start, W - 1))

    print(f'  列数          {len(cols)}')
    if len(cols) >= 3:
        widths = [(e - s + 1) * k for s, e in cols]
        gaps = [(cols[i + 1][0] - cols[i][1] - 1) * k for i in range(len(cols) - 1)]
        print(f'  卡片宽        {[round(v, 1) for v in widths]}')
        print(f'  列间距        {[round(v, 1) for v in gaps]}')
        print(f'  左边距        {cols[0][0] * k:.1f}px   右边距 {(W - 1 - cols[-1][1]) * k:.1f}px')

    # 第一列纵向结构
    cx = (cols[0][0] + cols[0][1]) // 2
    marks = []
    prev = None
    for y in range(band_top, H):
        v = flat(im.getpixel((cx, y)))
        if prev is not None and v != prev:
            marks.append((y, 'flat' if v else 'content'))
        prev = v
    print(f'  第一列纵向切换（前 12 个，换算为设计像素）:')
    for y, kind in marks[:12]:
        print(f'    y={y * k:7.1f}  {kind}')


analyse(ORIG, 'ORIGINAL')
analyse(CUR, 'CURRENT')
