BiliShell 完整实施方案（Agent 执行版）
本文档面向自动化执行 Agent。每个任务包含：目标、文件路径、接口定义、实现要点、验收标准。按 P0 → P6 顺序执行，每阶段完成后必须通过验收标准再进入下一阶段。

0. 环境与前置条件
0.1 开发环境
项	要求
Node.js	≥ 20.11.0
包管理器	pnpm ≥ 9.0.0
Python	≥ 3.10（EVS 签名需要）
平台	Windows 10/11 x64
代码签名证书	EV 代码签名证书（或测试用自签名）
Castlabs 账号	注册于 https://castlabs.com/ ，用于 EVS
0.2 一次性安装
bash
# 安装 castlabs-evs
pip install castlabs-evs
python -m castlabs_evs.account signup   # 注册一次

# 安装 pnpm
npm i -g pnpm

# 安装 electron-builder 依赖（Windows 需要）
npm i -g electron-builder
1. 项目初始化（P0-1）
1.1 创建 monorepo
bash
mkdir bilishell && cd bilishell
pnpm init
1.2 根 package.json
json
{
  "name": "bilishell",
  "version": "0.1.0",
  "private": true,
  "license": "AGPL-3.0",
  "scripts": {
    "dev": "pnpm -F @bilishell/core dev",
    "build": "pnpm -F @bilishell/core build",
    "dist": "pnpm -F @bilishell/core dist",
    "sign:vmp": "node scripts/sign-vmp.mjs",
    "lint": "eslint . --ext .ts,.vue",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "prettier": "^3.2.0"
  },
  "packageManager": "pnpm@9.0.0"
}
1.3 pnpm-workspace.yaml
yaml
packages:
  - 'packages/*'
  - 'plugins/*'
1.4 目录结构（一次性创建）
text
bilishell/
├── packages/
│   ├── shared/          # 类型、常量、PlatformAdapter 接口
│   ├── core/            # Electron 主进程 + 构建配置
│   ├── preload/         # 沙箱桥接
│   ├── runtime/         # 模块 & 插件运行时（注入页面）
│   ├── modules/         # 内置功能模块
│   └── ui/              # 应用层 Vue UI
├── plugins/
│   └── example-hello/   # 示例插件
├── scripts/
│   ├── sign-vmp.mjs
│   └── build-modules.mjs
├── registry/
│   └── plugins.json
├── docs/
├── .gitignore
├── .npmrc
├── tsconfig.base.json
└── README.md
2. packages/shared（P0-2）
2.1 文件清单
text
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types/
    │   ├── adapter.ts        # PlatformAdapter 接口
    │   ├── module.ts         # ComponentModule 接口
    │   ├── plugin.ts         # 插件 manifest 类型
    │   ├── api.ts            # BiliShellAPI 接口
    │   └── danmaku.ts        # 弹幕数据类型
    ├── constants.ts          # 版本号、路径、默认值
    └── utils.ts              # 通用工具
2.2 关键接口定义
src/types/adapter.ts

ts
export interface PlatformAdapter {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    watch(key: string, cb: (v: unknown) => void): () => void
  }
  http: {
    request(opts: {
      url: string
      method?: string
      headers?: Record<string, string>
      body?: string | ArrayBuffer
      responseType?: 'json' | 'text' | 'arraybuffer'
    }): Promise<{ status: number; headers: Record<string, string>; data: unknown }>
    intercept(rule: InterceptRule): () => void
  }
  download: {
    save(blob: Blob | ArrayBuffer, filename: string): Promise<void>
    saveAs(url: string, filename: string): Promise<void>
  }
  ui: {
    mountPanel(el: HTMLElement, opts: PanelOptions): () => void
    toast(msg: string, type?: 'info' | 'warn' | 'error' | 'success'): void
    overlay(el: HTMLElement): () => void
  }
  media: {
    getVideoEl(): HTMLVideoElement | null
    seek(t: number): void
    screenshot(opts?: { includeDanmaku?: boolean; format?: 'png' | 'jpeg' }): Promise<Blob>
  }
  notify: { send(title: string, body: string): void }
  log: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
}

export interface InterceptRule {
  urlPattern: string | RegExp
  action: 'block' | 'redirect' | 'modifyHeaders'
  redirectTo?: string
  headers?: Record<string, string>
}

export interface PanelOptions {
  id: string
  title?: string
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  width?: number
  height?: number
}
src/types/module.ts

ts
import type { PlatformAdapter } from './adapter'

export type ModuleCategory = 'video' | 'live' | 'style' | 'utility' | 'ambient' | 'danmaku' | 'ui'

export interface SettingSchema {
  key: string
  type: 'boolean' | 'number' | 'string' | 'select' | 'color' | 'range'
  default: unknown
  label: string
  description?: string
  options?: { label: string; value: unknown }[]
  min?: number
  max?: number
  step?: number
}

export interface ModuleContext {
  adapter: PlatformAdapter
  settings: Record<string, unknown>
  getSetting<T>(key: string): T
  setSetting(key: string, value: unknown): Promise<void>
  log: PlatformAdapter['log']
}

export interface ComponentModule {
  id: string
  name: string
  category: ModuleCategory
  version: string
  description?: string
  dependencies?: string[]
  settings: SettingSchema[]
  onLoad(ctx: ModuleContext): void | Promise<void>
  onUnload(): void
}
src/types/plugin.ts

ts
export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  homepage?: string
  engines: { bilishell: string }
  apiVersion: number
  main: string
  permissions: PluginPermission[]
  contributes?: {
    settings?: PluginSettingContribution[]
    commands?: { id: string; title: string }[]
    shortcuts?: { command: string; default: string }[]
    navbarItems?: { id: string; title: string; icon?: string }[]
  }
}

export type PluginPermission =
  | 'storage'
  | 'ui.page'
  | 'ui.app'
  | 'media.video'
  | 'http.bilibili'
  | 'http.any'
  | 'danmaku.read'
  | 'download'
  | 'notify'
  | 'clipboard'
  | 'shortcut'

export interface PluginSettingContribution {
  key: string
  type: 'boolean' | 'number' | 'string' | 'select'
  default: unknown
  label: string
  description?: string
  options?: { label: string; value: unknown }[]
}
src/types/api.ts

ts
import type { DanmakuItem } from './danmaku'

export interface BiliShellAPI {
  onActivate(cb: () => void): void
  onDeactivate(cb: () => void): void

  storage: {
    get<T>(key: string): Promise<T | undefined>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    watch(key: string, cb: (v: unknown) => void): () => void
  }

  ui: {
    injectCSS(css: string): () => void
    mount(selectorOrEl: string | HTMLElement, render: (el: HTMLElement) => void): () => void
    toast(msg: string, type?: 'info' | 'warn' | 'error' | 'success'): void
    registerSettingPanel(render: (el: HTMLElement) => void): () => void
    registerNavbarItem(opts: { id: string; title: string; icon?: string; onClick: () => void }): () => void
  }

  media: {
    getVideo(): HTMLVideoElement | null
    onVideoChange(cb: (video: HTMLVideoElement | null) => void): () => void
    screenshot(opts?: { includeDanmaku?: boolean; format?: 'png' | 'jpeg' }): Promise<Blob>
    getCurrentTime(): number
    seek(t: number): void
  }

  danmaku: {
    fetch(cid: number): Promise<DanmakuItem[]>
    onReceive(cb: (d: DanmakuItem) => void): () => void
  }

  http: {
    request(opts: {
      url: string
      method?: string
      headers?: Record<string, string>
      body?: string
      responseType?: 'json' | 'text'
    }): Promise<{ status: number; data: unknown }>
  }

  commands: {
    register(id: string, handler: () => void): () => void
    execute(id: string): void
  }

  shortcuts: {
    register(combo: string, handler: () => void): () => void
  }

  notify(title: string, body: string): void

  log: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }

  app: {
    version: string
    apiVersion: number
  }
}
src/types/danmaku.ts

ts
export interface DanmakuItem {
  id: string
  content: string
  /** 弹幕在视频中的出现时间（秒） */
  time: number
  /** 弹幕发送时刻的视频进度（秒）—— 通常等于 time，用于分析时区分 */
  sendTime: number
  mode: 1 | 4 | 5 | 6  // 滚动/底部/顶部/逆向
  fontSize: number
  color: number
  senderHash: string
  timestamp: number  // 发送的 Unix 时间戳
}
2.3 验收标准
□ pnpm -F @bilishell/shared build 无错误
□ 所有接口导出，tsc --noEmit 通过
□ 类型文件无 any（除必要处标注 unknown）
3. packages/core（P0-3，最关键的阶段）
3.1 依赖
text
packages/core/package.json dependencies:
  electron: ^33.2.1
  electron-vite: ^2.3.0
  electron-builder: ^24.13.0
  electron-updater: ^6.3.0
  better-sqlite3: ^11.0.0
  vue: ^3.4.0
  pinia: ^2.1.0
  @bilishell/shared: workspace:*
  @bilishell/preload: workspace:*
  @bilishell/runtime: workspace:*

devDependencies:
  castlabs-electron: npm:@castlabs/electron-releases@^33.2.1+wvcus
⚠️ 关键：用 Castlabs 的 Electron 替换官方 Electron。 在 package.json 中通过 npm alias 完成：

json
"electron": "npm:@castlabs/electron-releases@33.2.1+wvcus"
若 alias 在 pnpm 下有问题，使用 .npmrc 配置 resolution-mode=highest 或直接 pnpm add @castlabs/electron-releases。

3.2 文件清单
text
packages/core/
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json
└── src/
    ├── main/
    │   ├── index.ts              # 入口
    │   ├── window.ts             # 窗口管理
    │   ├── views.ts              # WebContentsView 管理
    │   ├── session.ts            # 会话、Cookie 持久化
    │   ├── ipc.ts                # IPC 路由
    │   ├── download.ts           # 下载管理
    │   ├── plugin-manager.ts     # 插件加载器
    │   ├── storage.ts            # SQLite 封装
    │   ├── shortcuts.ts          # 全局快捷键
    │   ├── web-request.ts        # 请求拦截
    │   └── updater.ts            # 自动更新
    ├── preload/
    │   └── index.ts              # contextBridge
    └── renderer/                 # 应用层 UI（从 packages/ui 构建）
3.3 主进程入口 src/main/index.ts
ts
import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { setupIpc } from './ipc'
import { setupSession } from './session'
import { setupWebRequest } from './web-request'
import { setupShortcuts } from './shortcuts'
import { initStorage } from './storage'
import { initPluginManager } from './plugin-manager'
import { initUpdater } from './updater'

// Castlabs Electron 必须在 ready 前调用
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')
}

app.whenReady().then(async () => {
  await initStorage()
  await setupSession()
  setupWebRequest()
  await initPluginManager()
  setupIpc()
  setupShortcuts()
  createMainWindow()
  initUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
3.4 窗口与视图 src/main/views.ts
核心要求：

ts
import { BaseWindow, WebContentsView } from 'electron'
import path from 'node:path'

export interface ViewManager {
  window: BaseWindow
  pageView: WebContentsView   // 官方页面
  uiView: WebContentsView     // 应用层 UI（可选）
  loadPage(url: string): Promise<void>
  showUi(route: string): void
  hideUi(): void
  destroy(): void
}

export function createViewManager(preloadPath: string): ViewManager {
  const window = new BaseWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
  })

  const pageView = new WebContentsView({
    webPreferences: {
      preload: path.join(preloadPath, 'page-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,        // 需要 preload 访问部分 Node API
      webSecurity: true,
      partition: 'persist:bilishell',
    },
  })
  pageView.setBackgroundColor('#00000000')
  window.contentView.addChildView(pageView)
  pageView.setBounds({ x: 0, y: 0, width: 1400, height: 900 })

  const uiView = new WebContentsView({
    webPreferences: {
      preload: path.join(preloadPath, 'ui-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  uiView.setBackgroundColor('#00000000')
  uiView.setVisible(false)
  window.contentView.addChildView(uiView)
  uiView.setBounds({ x: 0, y: 0, width: 1400, height: 900 })

  window.on('resize', () => {
    const [w, h] = window.getContentSize()
    pageView.setBounds({ x: 0, y: 0, width: w, height: h })
    uiView.setBounds({ x: 0, y: 0, width: w, height: h })
  })

  return {
    window, pageView, uiView,
    async loadPage(url) {
      await pageView.webContents.loadURL(url)
    },
    showUi(route) {
      uiView.setVisible(true)
      uiView.webContents.loadURL(`app://ui/${route}`)
    },
    hideUi() {
      uiView.setVisible(false)
    },
    destroy() {
      window.destroy()
    },
  }
}
⚠️ Windows 已知问题（Issue #44934 / #45027）：

动态 addChildView/removeChildView 可能崩溃。解决：初始化时一次性添加两个 view，用 setVisible 切换，不动态增删。

重叠视图指针事件分发异常。解决：UI view 显示时，page view 设 setVisible(false)，避免重叠。

3.5 Session 持久化 src/main/session.ts
ts
import { session } from 'electron'

export async function setupSession() {
  const ses = session.fromPartition('persist:bilishell')

  // 标准 Chrome UA，去除 Electron 标识
  const chromeVersion = process.versions.chrome
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  ses.setUserAgent(ua)

  // 持久化 Cookie（默认 persist: 分区已自动持久化）
  ses.cookies.on('changed', (_e, cookie, cause) => {
    if (cause === 'explicit' || cause === 'overwrite') {
      // 可选的日志记录
    }
  })
}
3.6 请求拦截 src/main/web-request.ts
ts
import { session } from 'electron'
import adRules from '../../registry/ad-rules.json'

export function setupWebRequest() {
  const ses = session.fromPartition('persist:bilishell')

  ses.webRequest.onBeforeRequest({ urls: ['*://*.bilibili.com/*'] }, (details, cb) => {
    const url = details.url
    for (const rule of adRules.blockPatterns) {
      if (new RegExp(rule).test(url)) {
        return cb({ cancel: true })
      }
    }
    cb({})
  })

  // 可选的 header 修改（如 Referer 处理）
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*.bilibili.com/*'] }, (details, cb) => {
    cb({ requestHeaders: details.requestHeaders })
  })
}
registry/ad-rules.json 初始内容：

json
{
  "version": 1,
  "updatedAt": "2025-01-01",
  "blockPatterns": [
    "//api\\.bilibili\\.com/x/v2/feed/index.*ad",
    "//api\\.bilibili\\.com/x/v2/ad/",
    "//api\\.bilibili\\.com/x/v2/activity/"
  ],
  "hideSelectors": [
    ".bili-video-card:has(.bili-video-card__info--ad)",
    ".ad-report",
    ".slide-ad-exp",
    ".video-card-ad-small"
  ]
}
3.7 IPC 路由 src/main/ipc.ts
channel 命名规范： bilishell:<domain>:<action>

ts
import { ipcMain, session } from 'electron'
import { getStorage } from './storage'
import { getViewManager } from './window'
import { getPluginManager } from './plugin-manager'

export function setupIpc() {
  // storage
  ipcMain.handle('bilishell:storage:get', (_e, key: string) => getStorage().get(key))
  ipcMain.handle('bilishell:storage:set', (_e, key: string, value: unknown) => getStorage().set(key, value))
  ipcMain.handle('bilishell:storage:delete', (_e, key: string) => getStorage().delete(key))

  // http（受域名白名单限制）
  ipcMain.handle('bilishell:http:request', async (_e, opts: HttpOpts) => {
    const allowed = ['bilibili.com', 'bilivideo.com', 'hdslb.com', 'biliapi.net']
    const host = new URL(opts.url).hostname
    if (!allowed.some(d => host.endsWith(d))) {
      throw new Error(`Domain not allowed: ${host}`)
    }
    const res = await session.fromPartition('persist:bilishell').fetch(opts.url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      body: opts.body,
    })
    const data = opts.responseType === 'text' ? await res.text() : await res.json()
    return { status: res.status, data }
  })

  // download
  ipcMain.handle('bilishell:download:save', async (_e, { blob, filename }) => {
    // blob 以 ArrayBuffer 传输
    const { dialog } = await import('electron')
    const { filePath } = await dialog.showSaveDialog({ defaultPath: filename })
    if (!filePath) return false
    const fs = await import('node:fs/promises')
    await fs.writeFile(filePath, Buffer.from(blob))
    return true
  })

  // plugin
  ipcMain.handle('bilishell:plugin:list', () => getPluginManager().list())
  ipcMain.handle('bilishell:plugin:enable', (_e, id: string) => getPluginManager().enable(id))
  ipcMain.handle('bilishell:plugin:disable', (_e, id: string) => getPluginManager().disable(id))
  ipcMain.handle('bilishell:plugin:install', (_e, dir: string) => getPluginManager().installFromDir(dir))

  // window
  ipcMain.handle('bilishell:window:openSettings', () => getViewManager().showUi('settings'))
  ipcMain.handle('bilishell:window:closeSettings', () => getViewManager().hideUi())
}
3.8 Preload src/preload/page-preload.ts
这是安全边界的关键。 页面 preload 负责注入运行时，并暴露受控 API。

ts
import { contextBridge, ipcRenderer } from 'electron'
import { installRuntime } from '@bilishell/runtime'

// 不暴露 ipcRenderer 原始对象，只暴露包装后的 API
const api = {
  storage: {
    get: (key: string) => ipcRenderer.invoke('bilishell:storage:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('bilishell:storage:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('bilishell:storage:delete', key),
  },
  http: {
    request: (opts: unknown) => ipcRenderer.invoke('bilishell:http:request', opts),
  },
  download: {
    save: (blob: ArrayBuffer, filename: string) =>
      ipcRenderer.invoke('bilishell:download:save', { blob, filename }),
  },
  plugin: {
    list: () => ipcRenderer.invoke('bilishell:plugin:list'),
  },
  window: {
    openSettings: () => ipcRenderer.invoke('bilishell:window:openSettings'),
    closeSettings: () => ipcRenderer.invoke('bilishell:window:closeSettings'),
  },
  env: {
    platform: process.platform,
    appVersion: process.env.BILISHELL_VERSION ?? '0.0.0',
    apiVersion: 1,
  },
}

contextBridge.exposeInMainWorld('__bilishell_bridge__', api)

// 页面加载后注入运行时
window.addEventListener('DOMContentLoaded', () => {
  installRuntime(api)
})
3.9 存储 src/main/storage.ts
ts
import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

let db: Database.Database

export function initStorage() {
  const dbPath = path.join(app.getPath('userData'), 'bilishell.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plugin_state (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      installed_at INTEGER NOT NULL,
      version TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS danmaku_cache (
      cid INTEGER PRIMARY KEY,
      data BLOB NOT NULL,
      fetched_at INTEGER NOT NULL
    );
  `)
}

export function getStorage() {
  return {
    get(key: string) {
      const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined
      return row ? JSON.parse(row.value) : undefined
    },
    set(key: string, value: unknown) {
      db.prepare(`
        INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, JSON.stringify(value), Date.now())
    },
    delete(key: string) {
      db.prepare('DELETE FROM kv WHERE key = ?').run(key)
    },
  }
}
3.10 electron-builder 配置 electron-builder.yml
yaml
appId: com.bilishell.app
productName: BiliShell
copyright: Copyright © 2025 BiliShell Contributors
directories:
  output: release
  buildResources: build
files:
  - dist/**/*
  - package.json
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
  icon: build/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false
  createDesktopShortcut: true
  createStartMenuShortcut: true
publish:
  provider: github
  owner: <your-github-org>
  repo: bilishell
3.11 EVS VMP 签名脚本 scripts/sign-vmp.mjs
js
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const releaseDir = path.resolve('packages/core/release')
const exeFiles = fs.readdirSync(releaseDir)
  .filter(f => f.endsWith('.exe') && !f.includes('Setup'))
  .map(f => path.join(releaseDir, f))

if (exeFiles.length === 0) {
  console.error('未找到未打包的 exe')
  process.exit(1)
}

for (const exe of exeFiles) {
  console.log(`[EVS] 对 ${exe} 执行 VMP 签名（必须在代码签名之后）`)
  execSync(`python -m castlabs_evs.vmp sign-pkg "${exe}"`, { stdio: 'inherit' })
  console.log(`[EVS] 完成: ${exe}`)
}
CI 顺序（不可颠倒）：

text
1. pnpm dist                    # electron-builder 产出 exe（含代码签名）
2. node scripts/sign-vmp.mjs    # EVS VMP 签名
3. 上传产物到 GitHub Releases
⚠️ 若第 1 步未配置代码签名证书，VMP 签名会失败。P0 必须验证完整链路。

3.12 P0 验收标准（必须全通过）
□ pnpm dev 启动窗口，加载 https://www.bilibili.com
□ 能扫码登录，Cookie 持久化（重启后仍登录）
□ 打开任意番剧（如《孤独摇滚》），视频正常播放不黑屏（Widevine 验证）
□ pnpm dist 产出 exe，代码签名 + VMP 签名完成
□ 签名的 exe 在新机器上能播放番剧（验证 VMP 生效）
□ 广告拦截规则生效（首页推荐流无广告卡）
□ 登录后不触发风控（无异常验证码）
若 Widevine 播放失败，停止后续所有阶段，优先排查：

package.json 中 electron 是否真的指向 Castlabs 构建

VMP 签名是否在代码签名之后执行

app.commandLine.appendSwitch 是否在 whenReady 前调用

检查 chrome://media-internals 的 DRM 状态

4. packages/runtime（P1-1）
4.1 职责
在页面上下文运行，负责：

加载内置模块（从静态注册表）

加载用户插件（从主进程获取列表）

提供 ModuleContext 和 BiliShellAPI 实现

管理模块/插件生命周期

4.2 文件清单
text
packages/runtime/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── install.ts          # installRuntime 入口
    ├── adapter.ts          # ShellAdapter 实现
    ├── module-registry.ts  # 模块注册表
    ├── module-runner.ts    # 模块生命周期
    ├── plugin-runner.ts    # 插件生命周期 + 沙箱
    ├── plugin-sandbox.ts   # Proxy 白名单沙箱
    ├── api.ts              # BiliShellAPI 实现
    └── ui/
        ├── mount.ts        # Shadow DOM 挂载工具
        └── toast.ts
4.3 运行时入口 src/install.ts
ts
import { createShellAdapter } from './adapter'
import { getModuleRegistry } from './module-registry'
import { runModules } from './module-runner'
import { loadPlugins } from './plugin-runner'

export async function installRuntime(bridge: unknown) {
  if ((window as any).__bilishell_installed__) return
  ;(window as any).__bilishell_installed__ = true

  const adapter = createShellAdapter(bridge)

  // 1. 加载内置模块
  const modules = getModuleRegistry()
  await runModules(modules, adapter)

  // 2. 加载用户插件
  await loadPlugins(adapter)

  adapter.log.info(`[BiliShell] 运行时已安装，内置模块 ${modules.length} 个`)
}
4.4 ShellAdapter 实现 src/adapter.ts
要点：

storage 通过 bridge.storage 转发，watch 用轮询 + BroadcastChannel 实现跨窗口同步

http.request 通过 bridge.http.request 转发，受主进程域名白名单限制

download.save 通过 bridge.download.save，Blob 转 ArrayBuffer

ui.mountPanel 用 Shadow DOM 挂载

media.getVideoEl 查找页面中的 video 元素（B站播放器会动态替换，需要 MutationObserver）

media.screenshot 用 canvas 抓帧，可选叠加弹幕层

media.getVideoEl 关键实现：

ts
function createVideoTracker() {
  let currentVideo: HTMLVideoElement | null = null
  const listeners = new Set<(v: HTMLVideoElement | null) => void>()

  const check = () => {
    const v = document.querySelector('video') as HTMLVideoElement | null
    if (v !== currentVideo) {
      currentVideo = v
      listeners.forEach(cb => cb(v))
    }
  }
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true })
  check()

  return {
    get: () => currentVideo,
    onChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
  }
}
4.5 模块注册表 src/module-registry.ts
构建时静态导入所有内置模块：

ts
import { ambientLight } from '@bilishell/modules/ambient-light'
import { transparentPage } from '@bilishell/modules/transparent-page'
import { darkMode } from '@bilishell/modules/dark-mode'
import { customNavbar } from '@bilishell/modules/custom-navbar'
// ... 其余模块

import type { ComponentModule } from '@bilishell/shared'

const MODULES: ComponentModule[] = [
  ambientLight,
  transparentPage,
  darkMode,
  customNavbar,
  // ...
]

export function getModuleRegistry(): ComponentModule[] {
  return MODULES
}
4.6 模块运行器 src/module-runner.ts
ts
import type { ComponentModule, ModuleContext, PlatformAdapter } from '@bilishell/shared'

export async function runModules(modules: ComponentModule[], adapter: PlatformAdapter) {
  const loaded = new Map<string, ComponentModule>()
  const ctxCache = new Map<string, ModuleContext>()

  // 拓扑排序（按 dependencies）
  const sorted = topoSort(modules)

  for (const mod of sorted) {
    const settings = await loadSettings(mod, adapter)
    const ctx: ModuleContext = {
      adapter,
      settings,
      getSetting: (k) => settings[k],
      setSetting: async (k, v) => {
        settings[k] = v
        await adapter.storage.set(`module:${mod.id}:${k}`, v)
      },
      log: {
        info: (...a) => adapter.log.info(`[${mod.id}]`, ...a),
        warn: (...a) => adapter.log.warn(`[${mod.id}]`, ...a),
        error: (...a) => adapter.log.error(`[${mod.id}]`, ...a),
      },
    }
    ctxCache.set(mod.id, ctx)

    try {
      await mod.onLoad(ctx)
      loaded.set(mod.id, mod)
      adapter.log.info(`模块已加载: ${mod.name}`)
    } catch (e) {
      adapter.log.error(`模块加载失败: ${mod.name}`, e)
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    for (const mod of loaded.values()) {
      try { mod.onUnload() } catch (e) { adapter.log.error(`模块卸载失败: ${mod.name}`, e) }
    }
  })
}

async function loadSettings(mod: ComponentModule, adapter: PlatformAdapter) {
  const settings: Record<string, unknown> = {}
  for (const s of mod.settings) {
    const stored = await adapter.storage.get(`module:${mod.id}:${s.key}`)
    settings[s.key] = stored ?? s.default
  }
  return settings
}

function topoSort(modules: ComponentModule[]): ComponentModule[] {
  const byId = new Map(modules.map(m => [m.id, m]))
  const visited = new Set<string>()
  const result: ComponentModule[] = []
  const visit = (m: ComponentModule) => {
    if (visited.has(m.id)) return
    visited.add(m.id)
    for (const dep of m.dependencies ?? []) {
      const d = byId.get(dep)
      if (d) visit(d)
    }
    result.push(m)
  }
  modules.forEach(visit)
  return result
}
4.7 插件沙箱 src/plugin-sandbox.ts（安全核心）
ts
import type { BiliShellAPI, PluginManifest, PluginPermission } from '@bilishell/shared'

/**
 * 创建插件沙箱：返回一个受限的执行函数。
 * 插件代码在此函数中运行，全局对象被替换为白名单 Proxy。
 */
export function createSandbox(manifest: PluginManifest, api: BiliShellAPI) {
  const permissions = new Set(manifest.permissions)

  // 白名单 API
  const scopedApi = scopeApi(api, permissions)

  // 受限的 console
  const sandboxConsole = {
    log: (...a: unknown[]) => api.log.info(`[plugin:${manifest.id}]`, ...a),
    warn: (...a: unknown[]) => api.log.warn(`[plugin:${manifest.id}]`, ...a),
    error: (...a: unknown[]) => api.log.error(`[plugin:${manifest.id}]`, ...a),
  }

  // 用 Function 构造器隔离作用域（无法访问外层 require/process）
  const factory = new Function(
    'BiliShell', 'console', 'window', 'document', 'globalThis',
    `"use strict";
     return (function() {
       ${/* 插件源码在此拼接 */ ''}
     })();
    `
  )

  return {
    run(source: string) {
      // 将插件源码包装为模块
      const wrapped = `
        const module = { exports: {} };
        const exports = module.exports;
        (function(module, exports, BiliShell, console) {
          ${source}
        })(module, exports, BiliShell, console);
        return module.exports;
      `
      const fn = new Function('BiliShell', 'console', wrapped)
      // 注意：window/document 在此作用域内不可见，插件必须通过 BiliShell 访问 DOM
      return fn(scopedApi, sandboxConsole)
    },
  }
}

function scopeApi(api: BiliShellAPI, permissions: Set<PluginPermission>): BiliShellAPI {
  const deny = (name: string) => { throw new Error(`权限不足: ${name}`) }
  return {
    ...api,
    storage: permissions.has('storage') ? api.storage : new Proxy({}, { get: () => deny('storage') }),
    ui: {
      injectCSS: permissions.has('ui.page') ? api.ui.injectCSS : () => deny('ui.page'),
      mount: permissions.has('ui.page') ? api.ui.mount : () => deny('ui.page'),
      toast: api.ui.toast,
      registerSettingPanel: permissions.has('ui.app') ? api.ui.registerSettingPanel : () => deny('ui.app'),
      registerNavbarItem: permissions.has('ui.app') ? api.ui.registerNavbarItem : () => deny('ui.app'),
    },
    media: permissions.has('media.video') ? api.media : new Proxy({}, { get: () => deny('media.video') }),
    danmaku: permissions.has('danmaku.read') ? api.danmaku : new Proxy({}, { get: () => deny('danmaku.read') }),
    http: {
      request: (opts) => {
        const host = new URL(opts.url).hostname
        if (permissions.has('http.any')) return api.http.request(opts)
        if (permissions.has('http.bilibili') && host.endsWith('bilibili.com')) {
          return api.http.request(opts)
        }
        return deny('http')
      },
    },
    download: permissions.has('download') ? api.download : new Proxy({}, { get: () => deny('download') }),
    notify: permissions.has('notify') ? api.notify : () => deny('notify'),
    shortcuts: permissions.has('shortcut') ? api.shortcuts : new Proxy({}, { get: () => deny('shortcut') }),
  } as BiliShellAPI
}
⚠️ 注意： new Function 在 contextIsolation: true 的 preload 中可用，但在 MV3 content script 中受 CSP 限制。BiliShell 使用 Electron 的 preload，CSP 由页面控制。若 B 站页面 CSP 禁止 unsafe-eval，需要在 session.webRequest.onHeadersReceived 中移除 CSP 头。 这是一个必须处理的点。

CSP 处理（加入 web-request.ts）：

ts
ses.webRequest.onHeadersReceived({ urls: ['*://*.bilibili.com/*'] }, (details, cb) => {
  const headers = { ...details.responseHeaders }
  delete headers['content-security-policy']
  delete headers['Content-Security-Policy']
  cb({ responseHeaders: headers })
})
4.8 插件加载器 src/plugin-runner.ts
ts
import type { PlatformAdapter } from '@bilishell/shared'
import { createSandbox } from './plugin-sandbox'
import { createApi } from './api'

export async function loadPlugins(adapter: PlatformAdapter) {
  const bridge = (window as any).__bilishell_bridge__
  const plugins = await bridge.plugin.list()

  for (const plugin of plugins) {
    if (!plugin.enabled) continue
    try {
      const source = await bridge.plugin.readMain(plugin.id)
      const api = createApi(plugin, adapter)
      const sandbox = createSandbox(plugin.manifest, api)
      sandbox.run(source)
      adapter.log.info(`插件已加载: ${plugin.name}`)
    } catch (e) {
      adapter.log.error(`插件加载失败: ${plugin.name}`, e)
    }
  }
}
4.9 P1 验收标准
□ 模块运行时正确加载内置模块（先用 3 个测试模块验证）
□ 模块依赖拓扑排序正确（氛围光依赖 sampler）
□ 模块设置持久化到 SQLite，重启后保留
□ 页面卸载时模块正确清理
□ CSP 已移除，new Function 可执行
5. packages/modules（P1-2 到 P4）
5.1 目录结构
text
packages/modules/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── ambient/
    │   ├── video-frame-sampler.ts
    │   ├── ambient-light.ts
    │   └── transparent-page.ts
    ├── ui/
    │   ├── dark-mode.ts
    │   ├── custom-navbar.ts
    │   ├── comments-enhance.ts
    │   └── screenshot.ts
    ├── download/
    │   ├── download-video.ts
    │   ├── download-cover.ts
    │   ├── download-danmaku.ts
    │   └── save-metadata.ts
    ├── danmaku/
    │   ├── danmaku-filter.ts
    │   ├── danmaku-style.ts
    │   ├── danmaku-sender-info.ts
    │   └── danmaku-airborne.ts
    └── utility/
        ├── ad-block.ts
        ├── sponsor-skip.ts
        ├── shortcuts.ts
        └── live-enhance.ts
5.2 模块实现模板
每个模块导出一个 ComponentModule 对象。示例（夜间模式）：

ts
import type { ComponentModule } from '@bilishell/shared'

export const darkMode: ComponentModule = {
  id: 'dark-mode',
  name: '夜间模式',
  category: 'ui',
  version: '1.0.0',
  description: '跟随系统 / 定时 / 手动切换深色主题',
  settings: [
    {
      key: 'mode',
      type: 'select',
      default: 'auto',
      label: '切换模式',
      options: [
        { label: '跟随系统', value: 'auto' },
        { label: '定时', value: 'schedule' },
        { label: '手动', value: 'manual' },
        { label: '关闭', value: 'off' },
      ],
    },
    {
      key: 'scheduleStart',
      type: 'string',
      default: '19:00',
      label: '定时开始',
    },
    {
      key: 'scheduleEnd',
      type: 'string',
      default: '07:00',
      label: '定时结束',
    },
  ],
  async onLoad(ctx) {
    const styleId = 'bilishell-dark-mode'
    const apply = (enabled: boolean) => {
      let el = document.getElementById(styleId) as HTMLStyleElement | null
      if (enabled && !el) {
        el = document.createElement('style')
        el.id = styleId
        el.textContent = DARK_CSS
        document.head.appendChild(el)
      } else if (!enabled && el) {
        el.remove()
      }
    }

    const mode = ctx.getSetting<string>('mode')
    if (mode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      mq.addEventListener('change', e => apply(e.matches))
    } else if (mode === 'manual') {
      apply(true)
    } else if (mode === 'schedule') {
      const check = () => {
        const now = new Date()
        const start = ctx.getSetting<string>('scheduleStart')
        const end = ctx.getSetting<string>('scheduleEnd')
        const cur = now.getHours() * 60 + now.getMinutes()
        const [sh, sm] = start.split(':').map(Number)
        const [eh, em] = end.split(':').map(Number)
        const s = sh * 60 + sm, e = eh * 60 + em
        apply(s <= e ? cur >= s && cur < e : cur >= s || cur < e)
      }
      check()
      setInterval(check, 60_000)
    }
  },
  onUnload() {
    document.getElementById('bilishell-dark-mode')?.remove()
  },
}

const DARK_CSS = `
  :root { --bilishell-bg: #121212; --bilishell-fg: #e0e0e0; }
  html, body { background: var(--bilishell-bg) !important; color: var(--bilishell-fg) !important; }
  /* B 站具体选择器适配，此处省略 */
`
5.3 各模块实现要点
5.3.1 video-frame-sampler（底层工具）
ts
export interface SamplerOptions {
  fps?: number         // 默认 15
  edgeRatio?: number   // 边缘采样比例，默认 0.1
  downscale?: number   // 降采样尺寸，默认 64
}

export function createSampler(video: HTMLVideoElement, opts: SamplerOptions = {}) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const fps = opts.fps ?? 15
  const downscale = opts.downscale ?? 64

  let running = true
  let lastTime = 0
  const interval = 1000 / fps

  const sample = (now: number, _meta: VideoFrameCallbackMetadata) => {
    if (!running) return
    if (now - lastTime >= interval) {
      lastTime = now
      const w = downscale
      const h = Math.round(downscale * (video.videoHeight / video.videoWidth))
      canvas.width = w
      canvas.height = h
      ctx.drawImage(video, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h).data
      onColors(extractEdgeColors(data, w, h, opts.edgeRatio ?? 0.1))
    }
    video.requestVideoFrameCallback(sample)
  }

  let onColors: (colors: string[]) => void = () => {}
  video.requestVideoFrameCallback(sample)

  return {
    onColors(cb: (colors: string[]) => void) { onColors = cb },
    stop() { running = false },
  }
}
5.3.2 sponsor-skip（重点，P4）
三阶段实现：

阶段 1：SponsorBlock 查询

ts
async function fetchSponsorBlock(bvid: string, cid: number): Promise<Segment[]> {
  const hash = await sha256Prefix(bvid + cid)
  const res = await fetch(`https://sponsor.ajay.app/api/skipSegments/${hash}?categories=["sponsor","selfpromo","interaction"]`)
  if (res.status === 404) return []
  const data = await res.json()
  return data.map((d: any) => ({ start: d.segment[0], end: d.segment[1], source: 'sponsorblock' }))
}
阶段 2：弹幕分析

ts
// 时间解析器
const TIME_PATTERNS = [
  /(\d{1,2}):(\d{2})(?::(\d{2}))?/g,          // 1:30 / 1:30:00
  /(\d{1,2})分(\d{1,2})?秒?/g,                 // 1分30秒
  /(\d{1,2})分半/g,                             // 1分半
  /(\d{1,3})秒/g,                               // 90秒
  /(\d{2})(\d{2})工程/g,                        // 705工程
  /(\d{3,4})s\b/gi,                             // 90s
]

const KEYWORDS_HIGH = ['空降', '快进到', '跳转', '广告结束', '欢迎回来', '正片开始']
const KEYWORDS_LOW = ['广告', '恰饭', '推广']

const NOISE_PATTERNS = [
  /打\d+分/, /身高\d+/, /\d+米/, /发布.{0,3}(分钟|小时|天)/,
]

function parseTimeFromDanmaku(content: string): number | null {
  if (NOISE_PATTERNS.some(p => p.test(content))) return null
  for (const p of TIME_PATTERNS) {
    const m = p.exec(content)
    if (m) {
      // 根据匹配组数解析为秒
      return parseMatchToSeconds(m)
    }
  }
  return null
}

function scoreDanmaku(content: string): number {
  if (KEYWORDS_HIGH.some(k => content.includes(k))) return 3
  if (KEYWORDS_LOW.some(k => content.includes(k))) return 1
  return 0.5
}

// 聚类
function clusterTimes(points: { time: number; weight: number }[], epsilon = 3): Cluster[] {
  // 简单滑动窗口聚类，epsilon 单位：秒
  const sorted = [...points].sort((a, b) => a.time - b.time)
  const clusters: Cluster[] = []
  for (const p of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && p.time - last.center <= epsilon) {
      last.points.push(p)
      last.center = last.points.reduce((s, x) => s + x.time, 0) / last.points.length
      last.weight += p.weight
    } else {
      clusters.push({ center: p.time, points: [p], weight: p.weight })
    }
  }
  return clusters
}
阶段 3：触发策略

ts
// 默认手动模式
function setupSkipButton(segment: Segment, video: HTMLVideoElement) {
  const btn = document.createElement('button')
  btn.className = 'bilishell-skip-btn'
  btn.textContent = '跳过广告'
  btn.onclick = () => { video.currentTime = segment.end }

  const check = () => {
    if (video.currentTime >= segment.start && video.currentTime < segment.end) {
      btn.style.display = 'block'
    } else {
      btn.style.display = 'none'
    }
  }
  video.addEventListener('timeupdate', check)

  return () => {
    video.removeEventListener('timeupdate', check)
    btn.remove()
  }
}
弹幕抓取（Protobuf 解析）：

B 站弹幕接口返回 Protobuf，需要用 protobufjs 定义 schema：

protobuf
// registry/danmaku.proto
syntax = "proto3";
message DmSegMobileReply {
  repeated DanmakuElem elems = 1;
}
message DanmakuElem {
  int64 id = 1;
  int32 progress = 2;
  int32 mode = 3;
  int32 fontsize = 4;
  uint32 color = 5;
  string midHash = 6;
  string content = 7;
  int64 ctime = 8;
  int32 weight = 9;
}
调用接口：https://api.bilibili.com/x/v2/dm/wbi/web/seg.so?type=1&oid={cid}&segment_index=1

⚠️ WBI 签名是 B 站 2023 年后的接口鉴权机制，需要实现签名算法。P4 阶段优先用已解析好的第三方库或直接复用页面已有的请求结果（页面已经请求过弹幕，可以从 performance entries 或 XHR 拦截中获取）。

更简单的方案： 在页面 preload 中拦截 XMLHttpRequest 和 fetch，捕获 B 站自己请求的弹幕数据，避免自己实现 WBI 签名。

ts
// 在 adapter 中提供 danmaku.fetch，实际从缓存取
const danmakuCache = new Map<number, DanmakuItem[]>()

// 拦截 XHR
const OriginalXHR = window.XMLHttpRequest
window.XMLHttpRequest = function () {
  const xhr = new OriginalXHR()
  const origOpen = xhr.open
  xhr.open = function (method, url, ...rest) {
    if (url.includes('/x/v2/dm/')) {
      xhr.addEventListener('load', () => {
        try {
          const cid = new URL(url, location.href).searchParams.get('oid')
          if (cid) {
            danmakuCache.set(Number(cid), parseDanmakuResponse(xhr.response))
          }
        } catch {}
      })
    }
    return origOpen.call(this, method, url, ...rest)
  }
  return xhr
} as any
5.4 P1–P4 验收标准
阶段	验收标准
P1	氛围光、夜间模式、自定义顶栏 3 个模块可独立启停；氛围光在 1080p 视频下 CPU 占用 < 15%
P2	全局快捷键可触发下载；下载管理 UI 可查看进度；多窗口/画中画可用
P3	示例插件可安装、启用、禁用；沙箱拒绝越权 API 调用；设置面板自动生成
P4	SponsorBlock 数据可拉取；弹幕分析输出广告区间；手动跳过按钮正确显示；广告拦截规则生效
6. packages/ui（P2）
6.1 职责
应用层 Vue UI，运行在独立的 WebContentsView 中，与官方页面完全隔离。

6.2 页面路由
路由	功能
/settings	设置面板（模块设置 + 插件管理 + 通用设置）
/downloads	下载管理
/plugins	插件市场（本地列表 + 索引浏览）
/about	关于、版本、免责声明
6.3 设置面板自动生成
vue
<!-- SettingsView.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ComponentModule, SettingSchema } from '@bilishell/shared'

const modules = ref<{ module: ComponentModule; settings: Record<string, unknown> }[]>([])

onMounted(async () => {
  const list = await window.__bilishell_bridge__.module.list()
  modules.value = list
})

async function updateSetting(moduleId: string, key: string, value: unknown) {
  await window.__bilishell_bridge__.module.setSetting(moduleId, key, value)
}
</script>

<template>
  <div class="settings">
    <section v-for="m in modules" :key="m.module.id">
      <h2>{{ m.module.name }}</h2>
      <div v-for="s in m.module.settings" :key="s.key">
        <SettingField :schema="s" :value="m.settings[s.key]" @change="v => updateSetting(m.module.id, s.key, v)" />
      </div>
    </section>
  </div>
</template>
6.4 P2 验收标准
□ 设置面板列出所有模块及其设置项
□ 修改设置后立即生效（通过 IPC 通知页面层）
□ 下载管理显示进度、支持暂停/取消
□ 插件管理支持启用/禁用/卸载
7. 示例插件（P3）
7.1 plugins/example-hello/
manifest.json：

json
{
  "id": "com.bilishell.example.hello",
  "name": "示例插件",
  "version": "1.0.0",
  "description": "演示 BiliShell 插件 API",
  "author": "BiliShell",
  "license": "MIT",
  "engines": { "bilishell": ">=0.1.0 <1.0.0" },
  "apiVersion": 1,
  "main": "main.js",
  "permissions": ["storage", "ui.page", "media.video", "notify"],
  "contributes": {
    "settings": [
      { "key": "greeting", "type": "string", "default": "你好", "label": "问候语" }
    ],
    "commands": [
      { "id": "hello.greet", "title": "打个招呼" }
    ],
    "shortcuts": [
      { "command": "hello.greet", "default": "Ctrl+Shift+H" }
    ]
  }
}
main.js：

js
module.exports = {
  activate(BiliShell) {
    BiliShell.ui.toast('示例插件已加载', 'success')

    BiliShell.commands.register('hello.greet', async () => {
      const greeting = await BiliShell.storage.get('greeting') || '你好'
      const video = BiliShell.media.getVideo()
      const time = video ? video.currentTime : 0
      BiliShell.notify('BiliShell', `${greeting}！当前播放到 ${time.toFixed(1)}s`)
    })

    BiliShell.ui.injectCSS(`
      .bilishell-hello-badge {
        position: fixed; bottom: 16px; right: 16px;
        background: #fb7299; color: white; padding: 6px 12px;
        border-radius: 16px; font-size: 12px; z-index: 99999;
      }
    `)

    const badge = document.createElement('div')
    badge.className = 'bilishell-hello-badge'
    badge.textContent = 'BiliShell 示例'
    document.body.appendChild(badge)
  },

  deactivate() {
    document.querySelector('.bilishell-hello-badge')?.remove()
  },
}
7.2 P3 验收标准
□ 插件可安装到 ~/.bilishell/plugins/
□ 启用后 toast 提示、徽章显示
□ Ctrl+Shift+H 触发命令
□ 未声明的 API 调用抛「权限不足」
□ 插件抛错不影响外壳运行
8. 构建与发布（P5）
8.1 构建流程
bash
# 开发
pnpm dev

# 生产构建
pnpm build

# 打包（含代码签名）
pnpm dist

# EVS VMP 签名（必须在 dist 之后）
pnpm sign:vmp
8.2 GitHub Actions CI
.github/workflows/release.yml：

yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }

      - run: pnpm install
      - run: pip install castlabs-evs
      - run: python -m castlabs_evs.account signin --username ${{ secrets.EVS_USER }} --password ${{ secrets.EVS_PASS }}

      # 1. 代码签名 + 打包
      - run: pnpm dist
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}

      # 2. EVS VMP 签名（顺序不可颠倒）
      - run: node scripts/sign-vmp.mjs

      # 3. 上传产物
      - uses: softprops/action-gh-release@v2
        with:
          files: packages/core/release/*.exe
8.3 P5 验收标准
□ CI 产出签名的 exe
□ 签名的 exe 在干净 Windows 环境可安装、可播放番剧
□ 自动更新可用（旧版提示升级到新版）
□ 文档站部署成功（VitePress）
9. 执行顺序总览（Agent 按此顺序执行）
text
P0-1  项目初始化（monorepo、目录结构、根配置）
P0-2  packages/shared（所有类型定义）
P0-3  packages/core（主进程、窗口、IPC、session、存储）
P0-4  packages/preload（contextBridge）
P0-5  EVS 签名脚本 + CI 骨架
P0-6  【关键验收】Widevine 播放验证 → 若失败则停止

P1-1  packages/runtime（adapter、module-runner、install）
P1-2  packages/modules 前 3 个模块（ambient-light、dark-mode、custom-navbar）
P1-3  模块设置持久化 + 依赖拓扑排序
P1-4  【验收】3 个模块可用，氛围光性能达标

P2-1  packages/ui（Vue 设置面板）
P2-2  下载管理、多窗口、画中画、全局快捷键
P2-3  【验收】应用层差异化功能可用

P3-1  plugin-sandbox（Proxy 白名单）
P3-2  plugin-runner + plugin-manager（主进程）
P3-3  示例插件
P3-4  插件管理 UI
P3-5  【验收】示例插件完整生命周期可用

P4-1  danmaku 拦截 + Protobuf 解析
P4-2  ad-block（CSS + webRequest）
P4-3  sponsor-skip：SponsorBlock 查询
P4-4  sponsor-skip：弹幕时间解析 + 聚类
P4-5  sponsor-skip：手动跳过 UI
P4-6  其余模块（下载、弹幕、直播、截图、评论增强）
P4-7  【验收】所有内置模块可用

P5-1  electron-updater 集成
P5-2  文档站（VitePress）
P5-3  插件索引（registry/plugins.json）
P5-4  GitHub Actions 完整发布流程
P5-5  【验收】v1.0 可发布

P6    打磨（性能、i18n、崩溃恢复、设置导入导出）

P7    安卓探索（WebViewAdapter、小米平板5 测试）—— 非 v1.0 承诺
10. 关键注意事项（Agent 必读）
10.1 不可跳过的验证
验证点	阶段	失败后果
Widevine 播放番剧	P0-6	项目定位降级为「只能看普通视频」
VMP 签名顺序（代码签名 → VMP）	P0-5	Widevine 静默失败，无报错
WebContentsView 不动态增删	P0-3	Windows 崩溃
CSP 移除后才能 new Function	P1-1	插件沙箱完全不可用
弹幕默认手动跳过	P4-5	误判导致用户错过正片
10.2 必须避免的反模式
❌ 动态 addChildView / removeChildView（用 setVisible）

❌ 在插件沙箱中暴露 require / process / fs

❌ 绕过 Widevine（使用非 Castlabs 构建）

❌ 自己实现 WBI 签名（优先拦截页面已有请求）

❌ 直接读取 chrome.* API（用 PlatformAdapter 抽象）

❌ 在插件 API 中暴露 webSecurity: false

10.3 每个阶段的交付物
每阶段结束后必须产出：

可运行的代码（pnpm dev 能启动）

通过该阶段验收标准

更新 README 中的阶段状态

提交 git commit，tag 为 p0-6、p1-4 等

10.4 遇到阻塞时的处理
阻塞	处理
Castlabs Electron 安装失败	检查 package.json 的 alias 语法；尝试 npm install 而非 pnpm
Widevine 播放黑屏	检查 chrome://media-internals；确认 VMP 签名顺序；联系 Castlabs 支持
B 站页面 CSP 禁止 eval	在 onHeadersReceived 中删除 CSP 头
WebContentsView 崩溃	升级到 Electron 33.2.1+；检查是否动态增删了 view
插件沙箱被绕过	记录漏洞，作为已知问题；不追求绝对安全
弹幕接口变更	优先用拦截方案，避免依赖接口格式
11. 参考资源
资源	用途
https://github.com/castlabs/electron-releases	Castlabs ECS 官方仓库
https://github.com/castlabs/electron-releases/wiki/EVS	EVS 签名文档
https://www.electronjs.org/docs/latest/api/web-contents-view	WebContentsView API
https://github.com/ajayyy/SponsorBlock	SponsorBlock API 参考
https://github.com/the1812/Bilibili-Evolved	模块化设计参考
https://github.com/socialsisteryi/bilibili-API-collect	B 站 API 文档
https://github.com/hanydd/BilibiliSponsorBlock	SponsorBlock B 站适配参考
12. 最终交付清单（v1.0）
□ Windows 安装包（NSIS + portable），含代码签名 + VMP 签名
□ 能播放番剧（Widevine 验证通过）
□ 15+ 内置模块可用
□ 插件系统完整（manifest、沙箱、API、权限）
□ 示例插件 + 插件开发文档
□ 插件索引（社区可提交 PR）
□ 自动更新可用
□ 文档站（VitePress）
□ AGPL-3.0 许可证 + 免责声明
□ GitHub Actions CI 完整发布流程
文档版本：v1.0-agent-ready · 可直接交付 Agent 执行