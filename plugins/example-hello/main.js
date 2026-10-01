module.exports = {
  activate(BiliShell) {
    const dispose = BiliShell.ui.injectCSS('.bilihub-example-badge{position:fixed;bottom:18px;left:18px;z-index:2147483647;padding:6px 10px;border-radius:5px;background:#fb7299;color:white;font:12px sans-serif}')
    const badge = document.createElement('div')
    badge.className = 'bilihub-example-badge'
    badge.textContent = 'BiliHub 示例插件'
    document.body.appendChild(badge)
    BiliShell.notify('BiliHub', '示例插件已加载')
    BiliShell._dispose = () => { dispose(); badge.remove() }
  },
  deactivate() {},
}