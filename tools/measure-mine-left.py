# 「我的」页左栏结构化测量
#
# 逐行统计非白像素，识别：分隔线（整行浅灰）、分组标题（少量深色文字像素）、
# 菜单行（图标 + 文字像素簇）。输出设备像素与 CSS 像素两套值。
#
# 用法：python tools/measure-mine-left.py <截图> [基准 y 偏移] [下边界]
import sys
import pathlib
from PIL import Image

SCALE = 2.188
path = sys.argv[1] if len(sys.argv) > 1 else 'Screenshot_2026-10-01-09-18-55-869_tv.danmaku.bi.jpg'
top = int(sys.argv[2]) if len(sys.argv) > 2 else 540
bottom = int(sys.argv[3]) if len(sys.argv) > 3 else 1600

image = Image.open(path).convert('RGB')
width, _ = image.size
LEFT_W = 637  # 左栏宽度（设备像素）

profile = []
for y in range(top, bottom):
    dark = 0
    light = 0
    for x in range(0, LEFT_W):
        r, g, b = image.getpixel((x, y))
        value = (r + g + b) / 3
        if value < 200:
            dark += 1
        elif value < 252:
            light += 1
    profile.append((y, dark, light))

print(f'区域 y {top}-{bottom}，左栏宽 {LEFT_W} 设备像素\n')

# 1) 分隔线：整行几乎全是浅灰，深色像素极少，浅灰像素很多
print('== 分隔线候选（浅灰像素 > 300 且深色 < 20）==')
lines = []
prev = None
for y, dark, light in profile:
    if light > 300 and dark < 20:
        if prev is None or y - prev > 3:
            lines.append(y)
        prev = y
for y in lines:
    print(f'  y={y}')

# 2) 内容行：深色像素 > 20 的连续区段
print('\n== 内容行（深色像素 > 20 的连续段）==')
segments = []
inside = False
start = 0
for y, dark, light in profile:
    solid = dark > 20
    if solid and not inside:
        start = y
        inside = True
    elif not solid and inside:
        segments.append((start, y - 1))
        inside = False

for s, e in segments:
    # 该段里深色像素的最左最右位置，用于推断图标与文字的水平范围
    xs = []
    for y in range(s, e + 1):
        for x in range(0, LEFT_W):
            r, g, b = image.getpixel((x, y))
            if (r + g + b) / 3 < 200:
                xs.append(x)
                break
    left = min(xs) if xs else -1
    print(f'  y {s}-{e}  高 {e - s + 1} ({round((e - s + 1) / SCALE, 1)} CSS)  最左深色 x={left}')

if len(segments) >= 2:
    print('\n相邻内容段起始间距（设备像素 -> CSS）：')
    for a, b in zip(segments, segments[1:]):
        gap = b[0] - a[0]
        print(f'  {gap}  ->  {gap / SCALE:.1f}')

lines_out = [f'lines\t{len(lines)}', *[f'line\t{y}' for y in lines]]
lines_out += [f'seg\t{s}\t{e}\t{e - s + 1}' for s, e in segments]
pathlib.Path('.analysis/mine-left-measure.txt').write_text('\n'.join(lines_out), encoding='utf-8')
