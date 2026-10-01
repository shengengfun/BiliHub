# BiliHub

面向 Windows 的第三方哔哩哔哩客户端。

界面以项目内提供的实机截图为视觉基准（逐像素量取后换算，见 `tools/measure-*.py`），
底层承载真实的 `https://www.bilibili.com` 页面，通过模块与插件在其上叠加增强能力。
主进程独占网络与持久会话，渲染进程只能通过 `contextBridge` 暴露的白名单接口访问平台能力。

## 目录结构

```
electron/             Electron 入口与两个 preload（B 站页面 / 客户端面板）
packages/core/        主进程：会话、请求拦截、IPC、下载、插件、更新、协议
packages/shared/      跨包类型契约
packages/runtime/     模块运行时：适配器、运行器、插件沙箱
packages/modules/     13 个内置模块
packages/ui/          Vue 3 客户端界面（复刻界面 + 功能面板）
plugins/              示例插件
registry/             模块与插件索引
scripts/              EVS VMP 签名等发布脚本
tools/                逆向分析与版面测量工具
docs/                 分析记录与 Widevine 说明
```

## 开发

```powershell
pnpm install
pnpm dev:electron        # 启动完整客户端
pnpm dev:ui              # 只起面板的浏览器预览（登录不可用）
pnpm build:all           # 构建 packages 与 UI
pnpm typecheck           # 全仓库类型检查
```

Electron 下载受网络环境影响时，可使用镜像：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
pnpm rebuild electron
```

## 打包与签名

```powershell
pnpm dist          # electron-builder 产出 NSIS + portable
pnpm sign:vmp      # EVS VMP 签名（必须在打包之后）
pnpm release       # 上面两步连做
```

Widevine 需要 castlabs 的 Electron 构建，替换方式与完整链路见 `docs/widevine.md`。

## 已实现能力

### 客户端界面（对齐原包实测尺寸）

| 页面 | 说明 |
| --- | --- |
| 首页 | 4 列信息流、热搜词轮播搜索框、分区标签、真实封面与播放数据 |
| 动态 | 居中双栏，左关注列表 + 右动态卡片流 |
| 我的 | 双栏：账号卡片 / 大会员推广 / 分组菜单，右侧消息与设置 |
| 设置 | 与原包一致的分组设置列表 |
| 播放页 | 自定义控制条、弹幕层与弹幕设置面板、清晰度 / 倍速 / 画中画 / 截图 / 下载 |
| 功能面板 | 模块管理、插件管理、下载管理、关于与更新 |

### 主进程

- `persist:bilihub` 持久会话，登录 Cookie 显式随请求下发
- 广告请求拦截、CSP 处理、媒体请求补齐 Referer / Origin
- 下载管理器：队列、进度、暂停 / 续传（HTTP Range）、取消
- 页面请求捕获（CDP）：需要 WBI 签名的接口复用页面自身请求，不自行实现签名算法
- `bilihub://` 私有协议向页面提供模块产物（带 CORS 头，注册在业务会话上）
- electron-updater 自动更新（仅打包后生效）

### 内置模块（13 个）

氛围光、夜间模式、自定义顶栏、广告拦截、弹幕优化、评论区增强、自动跳过 UP 主广告、
视频下载、弹幕工具、快捷键、播放增强、直播优化、截图。

模块统一通过 `RuntimeAdapter` 访问平台能力（存储 / HTTP / 下载 / 媒体元素 / UI 挂载），
可独立启停，设置项在面板中自动生成。

### 插件系统

- 清单校验（必填字段、id 规范、引擎版本）
- 权限沙箱：未声明的 API 调用直接抛错
- 生命周期：安装、启用、停用
- 面板内可直接安装仓库自带的示例插件

## 许可与免责

AGPL-3.0。BiliHub 是独立的第三方客户端，与哔哩哔哩官方无关联。
所有内容版权归原作者与平台所有，本客户端不绕过付费、DRM 或登录保护，
也不重新分发任何受版权保护的素材。

仓库不包含从 APK 提取的品牌资源；`packages/ui/public/brand/` 需由使用者自行准备。

## 贡献者

小丸 / shengengfun / DeepSeek / GitHub Copilot
