// 汇总解码后的 AndroidManifest：按功能域归类组件
const fs = require('node:fs')

const source = process.argv[2]
const text = fs.readFileSync(source, 'utf8')

const componentTags = ['activity', 'activity-alias', 'service', 'receiver', 'provider']
const buckets = new Map()
const PACKAGE_PREFIXES = [/^tv\.danmaku\.bilibilihd\./, /^tv\.danmaku\.bili\./, /^com\.bilibili\./]

const groups = [
  ['播放器内核/播放页', /(^|\.)(ijk|xplayer|bplayer|playurl)|playerbizcommon|Player[A-Z]|MediaPlayer/i],
  ['弹幕', /danmaku|danmu/i],
  ['下载/离线', /download|offline|okdownload|p2p|Downloaded|Downloading/i],
  ['直播', /bililive|LiveRoom|LivePlay|LiveArea|LiveAll/i],
  ['番剧/OGV', /bangumi|ogv|season|anime|theseus/i],
  ['评论/回复', /comment|reply|Reply/i],
  ['搜索', /search|Search/i],
  ['动态/投稿', /dynamic|opus|publish|Publish/i],
  ['账号/登录', /login|Login|passport|account|verify|register|Register|sso|SSO/i],
  ['Web 容器/JSB', /webview|MWeb|gripper|jsb|Jsb|hybrid|Hybrid/i],
  ['投屏/多设备', /cast|Cast|projection|remote|Remote|media_link|MediaLink|dlna/i],
  ['设置/偏好', /setting|Setting|preference|Preference|config|Config/i],
  ['推送/监控', /push|Push|bugly|Bugly|track|Track|report|Report/i],
  ['更新/安装', /update|Update|upgrade|apkpatch|install|Install/i],
  ['图片/编解码', /image|Image|avif|webp|glide|Glide|fresco|image2/i],
  ['分享/社交', /share|Share|social|follow|Follow|favorite|Favorite/i],
  ['UP主空间', /space|Space|upper|Upper|author|Author|member|Member/i],
  ['其它', /.*/],
]

const seen = new Set()

for (const line of text.split(/\r?\n/)) {
  const match = line.match(/^<(\w[\w-]*)\s+[^>]*name="([^"]+)"/)
  if (!match) continue
  const [, tag, name] = match
  if (!componentTags.includes(tag)) continue
  const key = `${tag}:${name}`
  if (seen.has(key)) continue
  seen.add(key)
  const entry = `${tag.padEnd(14)} ${name}`
  let probe = name.replace(/\.[A-Z][\w$]*$/, '')
  for (const prefix of PACKAGE_PREFIXES) probe = probe.replace(prefix, '')
  const group = groups.find(([, pattern]) => pattern.test(probe))
  const groupName = group ? group[0] : '其它'
  if (!buckets.has(groupName)) buckets.set(groupName, [])
  buckets.get(groupName).push(entry)
}

const report = [`组件总数: ${seen.size}`]
for (const [groupName] of groups) {
  const items = buckets.get(groupName)
  if (!items?.length) continue
  report.push('', `### ${groupName} (${items.length})`)
  for (const item of items.slice(0, 30)) report.push('  ' + item)
  if (items.length > 30) report.push(`  ... 另有 ${items.length - 30} 个`)
}

const out = process.argv[3]
if (out) { fs.writeFileSync(out, report.join('\n'), 'utf8'); console.log('written', out, report.length, 'lines') }
else console.log(report.join('\n'))
