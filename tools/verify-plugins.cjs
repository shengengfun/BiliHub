// 校验插件安装 / 扫描 / 启用链路
const { app } = require('electron')
const plugins = require('../packages/core/src/main/plugins.cjs')
const { createStorage } = require('../packages/core/src/main/storage.cjs')
const path = require('node:path')

app.whenReady().then(() => {
  const storage = createStorage(path.join(app.getPath('userData'), 'bilihub-settings.json'))
  console.log('[插件目录]', plugins.pluginsDir())
  console.log('[内置安装]', JSON.stringify(plugins.installBundled()))
  const list = plugins.list(storage)
  console.log('[插件列表]', JSON.stringify(list.map((item) => ({ id: item.id, name: item.name, version: item.version, valid: item.valid, enabled: item.enabled, permissions: item.permissions, errors: item.errors })), null, 2))
  const first = list[0]
  if (first) {
    console.log('[启用]', JSON.stringify(plugins.setEnabled(first.id, true, storage)))
    console.log('[重新读取]', JSON.stringify(plugins.list(storage).map((item) => ({ id: item.id, enabled: item.enabled }))))
    const source = plugins.readSource(first.id, storage)
    console.log('[源码长度]', source?.source?.length ?? 0)
  }
  app.quit()
})

app.on('window-all-closed', () => app.quit())
