"""裁剪截图区域以便放大查看细节"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
box = tuple(int(v) for v in sys.argv[3].split(','))
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0

img = Image.open(src).convert('RGB').crop(box)
if scale != 1.0:
    img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
img.save(dst)
print(f'{dst}  {img.width}x{img.height}')
