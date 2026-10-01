# 从 APK 资源表里捞「未登录态」相关文案，确认游客态各区域该显示什么
#
# 用法：
#   python tools/find-guest-strings.py            全部候选
#   python tools/find-guest-strings.py mine im    只看名字里含这些关键字的
import json
import re
import sys
import pathlib

tokens = json.loads(pathlib.Path('specs/tokens.json').read_text(encoding='utf-8'))
strings = tokens.get('strings') or tokens.get('__strings') or {}

PATTERN = re.compile(r'登录|未登录|登入|登陆|注册|游客|登录后|登入後')
SCOPE = [word.lower() for word in sys.argv[1:]]

hits = []
for name, value in strings.items():
    if not isinstance(value, str) or len(value) > 40:
        continue
    if SCOPE and not any(word in name.lower() for word in SCOPE):
        continue
    if not PATTERN.search(value):
        continue
    hits.append((name, value))

hits.sort(key=lambda item: item[0])

# 同名资源有多语言副本，优先繁体以外的简体
CJK_TW = set('帳號請錄觀個還來爲後數電設置')
deduped = {}
for name, value in hits:
    if name not in deduped:
        deduped[name] = value
        continue
    if any(char in CJK_TW for char in deduped[name]) and not any(char in CJK_TW for char in value):
        deduped[name] = value

lines = [f'共 {len(deduped)} 条候选']
for name, value in sorted(deduped.items()):
    lines.append(f'{name}\t{value}')

pathlib.Path('.analysis/guest-strings.txt').write_text('\n'.join(lines), encoding='utf-8')
print(f'.analysis/guest-strings.txt 写入 {len(deduped)} 条', flush=True)
