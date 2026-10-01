"""从 APK 资源表抽取「设计令牌」，输出给实现层直接使用。

只读用户自备的资源名/值清单（.analysis/resources-all.txt），不复制任何 APK 资源本体。
产出：
  specs/tokens.json      机器可读的设计令牌（颜色 / 尺寸 / 文案）
  specs/tokens.md        人可读的规格说明
"""
import json
import re
from pathlib import Path

SRC = Path('.analysis/resources-all.txt')
OUT = Path('specs')

# 每个界面用到的资源名前缀，用于把 token 归到具体界面
SCREEN_PREFIXES = {
    'global': ('bili_', 'hd_common', 'common_'),
    'home': ('hd_home', 'hd_index', 'pegasus', 'bili_home'),
    'dynamic': ('hd_mine', 'hd_following', 'bili_dyn', 'dynamic', 'following'),
    'mine': ('hd_mine', 'mine_', 'bili_mine', 'bili_app_layout_user_center', 'bili_layout_main_user_center'),
    'player': ('bili_player', 'biliplayer', 'player_', 'bili_player_controller', 'hd_player'),
    'danmaku': ('danmaku', 'bili_danmaku', 'dm_'),
    'settings': ('hd_setting', 'setting_', 'bili_setting'),
    'live': ('live_', 'bili_live', 'hd_live'),
    'login': ('login', 'auth_', 'account_', 'bili_nologin', 'bili_app_auth'),
}


def parse_sections(text):
    sections = {}
    current = None
    for line in text.splitlines():
        match = re.match(r'^## (\S+) \((\d+)\)', line)
        if match:
            current = match.group(1)
            sections[current] = []
            continue
        if current is None or not line.strip():
            continue
        sections[current].append(line)
    return sections


def parse_pairs(lines):
    """资源行是 `名称\\t值`；字符串资源同名多条（多语言），优先保留简体中文。"""
    pairs = []
    for line in lines:
        if '\t' in line:
            name, value = line.split('\t', 1)
            pairs.append((name, value))
            continue
        match = re.match(r'^(\S+)\s+(.+?)\s*$', line)
        if match:
            pairs.append((match.group(1), match.group(2)))
    return pairs


def looks_hant(value):
    """粗略判断繁体：出现仅在繁体写法中使用的字"""
    return any(ch in value for ch in '麼們個來時說話級會員區別於爾後選項讓點擊確設置觀靈')


def collect_strings(lines):
    """同名多条时优先简体，其次第一条"""
    result = {}
    for name, value in parse_pairs(lines):
        if len(value) > 200 or '\\n' in value:
            continue
        current = result.get(name)
        if current is None:
            result[name] = value
        elif looks_hant(current) and not looks_hant(value):
            result[name] = value
    return result


def classify(name):
    lowered = name.lower()
    hits = [screen for screen, prefixes in SCREEN_PREFIXES.items() if any(lowered.startswith(p) or p in lowered for p in prefixes)]
    return hits or ['other']


def to_dp(value):
    match = re.match(r'^(-?[\d.]+)dp$', value)
    return float(match.group(1)) if match else None


def main():
    sections = parse_sections(SRC.read_text(encoding='utf-8'))
    OUT.mkdir(exist_ok=True)

    colors = {}
    for name, value in parse_pairs(sections.get('color', [])):
        # 多主题资源会重名，保留最后一个（night-v8 之后覆盖不了，这里只做基线）
        if re.match(r'^#[0-9a-fA-F]{6,8}$', value):
            colors[name] = value.lower()

    dimens = {}
    for name, value in parse_pairs(sections.get('dimen', [])):
        dp = to_dp(value)
        if dp is not None:
            dimens[name] = dp

    strings = collect_strings(sections.get('string', []))

    screens = {key: {'colors': {}, 'dimens': {}, 'strings': []} for key in list(SCREEN_PREFIXES) + ['other']}

    for name, value in colors.items():
        for screen in classify(name):
            screens[screen]['colors'][name] = value
    for name, value in dimens.items():
        for screen in classify(name):
            screens[screen]['dimens'][name] = value
    for name in strings:
        for screen in classify(name):
            screens[screen]['strings'].append(name)

    tokens = {
        'source': str(SRC),
        'counts': {
            'color': len(colors),
            'dimen': len(dimens),
            'string': len(strings),
        },
        'screens': {key: {'colors': len(val['colors']), 'dimens': len(val['dimens']), 'strings': len(val['strings'])} for key, val in screens.items()},
        'colors': colors,
        'dimens': dimens,
        'strings': strings,
        'screens_detail': {key: val for key, val in screens.items() if key != 'other'},
    }
    (OUT / 'tokens.json').write_text(json.dumps(tokens, ensure_ascii=False, indent=2), encoding='utf-8')

    md = ['# 设计令牌（从 APK 资源表抽取）', '']
    md.append(f'来源：`{SRC}`　颜色 {len(colors)} 条 / 尺寸 {len(dimens)} 条 / 文案 {len(strings)} 条')
    md.append('')
    md.append('## 各界面覆盖情况')
    md.append('')
    md.append('| 界面 | 颜色 | 尺寸 | 文案 |')
    md.append('| --- | --- | --- | --- |')
    for key, val in tokens['screens'].items():
        md.append(f'| {key} | {val["colors"]} | {val["dimens"]} | {val["strings"]} |')
    (OUT / 'tokens.md').write_text('\n'.join(md) + '\n', encoding='utf-8')

    print('颜色', len(colors), '尺寸', len(dimens), '文案', len(strings))
    for key, val in tokens['screens'].items():
        print(f'  {key:<10} colors={val["colors"]:<5} dimens={val["dimens"]:<5} strings={val["strings"]}')


if __name__ == '__main__':
    main()
