const { BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

/**
 * BiliHub 应用层面板窗口：加载 packages/ui 的构建产物。
 * 与 B 站页面窗口分离，互不影响。
 */
function createUiWindow() {
  const preload = path.resolve(__dirname, '../../../../electron/ui-preload.cjs')
  const distIndex = path.resolve(__dirname, '../../../../packages/ui/dist/index.html')

  const window = new BrowserWindow({
    // 原包 (tv.danmaku.bilibilihd) 设计宽度为 1170dp，窗口按此宽度可 1:1 还原排版
    width: 1170,
    height: 820,
    minWidth: 860,
    minHeight: 620,
    show: false,
    title: 'BiliHub 面板',
    backgroundColor: '#f1f2f4',
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false },
  })

  if (fs.existsSync(distIndex)) window.loadFile(distIndex)
  else window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h2 style="font-family:sans-serif">面板未构建，请先运行 pnpm --filter @bilihub/ui build</h2>'))

  return {
    show() { if (window.isMinimized()) window.restore(); window.show(); window.focus() },
    hide() { window.hide() },
    window,
  }
}

module.exports = { createUiWindow }
