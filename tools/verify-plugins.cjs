// 校验面板依赖的主进程数据面：模块注册表、插件扫描、下载目录
const { app } = require('electron')
const path = require('node:path')
const modules = require('../packages/core/src/main/modules.cjs')
const plugins = require('../packages/core/src/main/plugins.cjs')
const download = require('../packages/core/src/main/download.cjs')
const { createStorage } = require('../packages/core/src/main/storage.cjs')

app.whenReady().then(() => {
  const storage = createStorage(path.join(app.getPath('userData'), 'bilihub-settings.json'))

  const list = modules.listModules(storage)
  console.log(`[模块] 共 ${list.length} 个`)
  for (const item of list) {
    console.log(`  ${String(item.id).padEnd(18)} ${String(item.category).padEnd(11)} v${item.version}  设置 ${item.settings.length} 项  启用=${item.enabled}`)
  }

  console.log('\n[模块设置示例] danmaku-enhance:', JSON.stringify(modules.getModuleSettings(storage, 'danmaku-enhance')))
  console.log('[下载目录]', download.downloadsDir())

  console.log('\n[插件]')
  console.log(JSON.stringify(plugins.installBundled()))
  for (const item of plugins.list(storage)) {
    console.log(`  ${String(item.id).padEnd(32)} valid=${item.valid} enabled=${item.enabled} perms=${item.permissions.join(',')}`)
  }

  app.quit()
})

app.on('window-all-closed', () => app.quit())
