// 从资源导出中筛选图标，生成提取清单
const fs = require('node:fs')

const dump = fs.readFileSync(process.argv[2], 'utf8')

// 资源名 -> 文件路径
const map = new Map()
let currentType = ''
for (const line of dump.split(/\r?\n/)) {
  const section = line.match(/^## (\w+) \((\d+)\)$/)
  if (section) { currentType = section[1]; continue }
  if (currentType !== 'drawable' && currentType !== 'mipmap') continue
  const entry = line.match(/^(\S+)\t(res\/.+)$/)
  if (entry) {
    const [, name, file] = entry
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(file)
  }
}

// 需要的图标：优先矢量 XML
const wanted = [
  ['bili_player_ctrl_play_pause', 'player-play-pause'],
  ['bili_player_ctrl_play_previous', 'player-prev'],
  ['bili_player_ctrl_play_next', 'player-next'],
  ['bili_player_ctrl_toggle_danmaku', 'player-danmaku'],
  ['biliplayer_ic_danmaku_mode_move', 'dm-mode-move'],
  ['biliplayer_ic_danmaku_mode_top', 'dm-mode-top'],
  ['biliplayer_ic_danmaku_mode_bottom', 'dm-mode-bottom'],
  ['biliplayer_ic_danmaku_shield_move', 'dm-shield-move'],
  ['biliplayer_ic_danmaku_shield_top', 'dm-shield-top'],
  ['biliplayer_ic_danmaku_shield_bottom', 'dm-shield-bottom'],
  ['biliplayer_ic_danmaku_shield_same', 'dm-shield-same'],
  ['biliplayer_ic_danmaku_shield_color', 'dm-shield-color'],
  ['biliplayer_ic_danmaku_shield_senior', 'dm-shield-senior'],
  ['biliplayer_ic_danmaku_setting', 'dm-setting'],
  ['biliplayer_ic_danmaku_color', 'dm-color'],
  ['bili_player_ctrl_right', 'player-right'],
]

const lines = []
const preview = []
for (const [resName, alias] of wanted) {
  const files = map.get(resName) ?? []
  const vector = files.find((file) => file.endsWith('.xml'))
  const raster = files.find((file) => /\.(png|webp)$/.test(file))
  const chosen = vector ?? raster
  if (!chosen) { preview.push(`MISS ${resName}`); continue }
  lines.push(`${chosen}=${alias}`)
  preview.push(`${alias.padEnd(20)} ${resName} -> ${chosen}${vector ? ' (vector)' : ' (raster)'}`)
}

console.log(preview.join('\n'))
fs.writeFileSync(process.argv[3], lines.join('\n'), 'utf8')
console.log(`\n共 ${lines.length} 项已写入清单`)
