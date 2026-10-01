# BiliHub

BiliHub 是面向 Windows 的第三方 B 站客户端。界面以项目内提供的截图为视觉基准，Electron 主进程负责 B 站页面容器、广告请求拦截、下载、截图、快捷键和持久会话。

## 开发

```powershell
pnpm install
pnpm dev
pnpm dev:electron
pnpm build
pnpm build:electron
```

Electron 下载受网络环境影响时，可使用镜像：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
pnpm rebuild electron
```

## 当前实现

- Electron 持久会话与 B 站页面入口
- B 站广告请求拦截与 CSP 处理
- 下载 IPC、窗口截图与 `Ctrl+Shift+S` 快捷键
- 模块注册表、设置持久化、下载队列
- 弹幕时间解析、权重评分和广告区间聚类
- 浏览器预览模式与 Windows Electron 模式 bridge

后续功能按 `guide.md` 的 P0 到 P7 顺序推进，DRM 播放必须在 Windows Castlabs 构建与签名链路完成后验收。

## 贡献者

小丸 / shengengfun / DeepSeek / GitHub Copilot