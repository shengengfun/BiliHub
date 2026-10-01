// 从模块实现生成 registry/modules.json，避免注册表与代码脱节
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'packages/modules/dist/index.js')

const mod = await import(pathToFileURL(dist).href)

const ORDER = [
  'ambient-light',
  'dark-mode',
  'custom-navbar',
  'ad-block',
  'danmaku-enhance',
  'comments-enhance',
  'sponsor-skip',
  'download',
  'danmaku-tools',
  'shortcuts',
  'video-tools',
  'live-enhance',
  'screenshot',
]

const modules = ORDER
  .map((id) => mod[
    id.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
  ])
  .filter(Boolean)
  .map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    version: item.version,
    description: item.description,
    ...(item.dependencies ? { dependencies: item.dependencies } : {}),
    settings: item.settings,
  }))

writeFileSync(
  path.join(root, 'registry/modules.json'),
  `${JSON.stringify({ version: 2, generatedAt: new Date().toISOString(), modules }, null, 2)}\n`,
  'utf8',
)

console.log(`已写入 ${modules.length} 个模块定义`)
for (const item of modules) console.log(`  ${item.id}  ${item.settings.length} 项设置`)
