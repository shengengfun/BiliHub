# iBiliPlayer-bili 静态分析记录

分析对象：`iBiliPlayer-bili.apk`

- SHA-256：`6F1E80029B8A6001F47D58D2DEBC68FDE530C3EE547533170BD71CA1EC366CB0`
- 文件大小：约 122 MiB
- 分析方式：只读 ZIP/APK 目录、资源名和 dex 字符串；未安装、未运行、未修改 APK

## 结构结论

- 原生 Android APK，不是单纯 WebView 壳
- 24 个 dex（`classes.dex` 到 `classes24.dex`）
- 53 个 arm64-v8a native library
- 包含 `libijkplayer.so`、`libijkffmpeg.so`、`libijkDolbyVision.so`
- 包含 QuickJS、Bili 自有播放器和媒体处理库
- 存在 `libdexvmp.so`，后续静态分析应避免把保护逻辑当作可复制实现

## 可观察功能边界

资源和字符串中明确出现了：

- TV/平板播放器控件：`player_*_tv`、`inline_player_seek_bar_tv_*`、`player_loading_tv_*`
- 弹幕：`normal_danmaku.cron`、`fonts/danmaku.ttf`、弹幕推荐和弹幕屏蔽逻辑
- 直播：`live.json`、直播播放、礼物、RTC、多语音和直播侧栏资源
- 评论：评论筛选、评论搜索、回复和评论标签资源
- 下载：`downloader.verify_method_domains`、下载 tab 和播放器下载相关资源
- 播放协议：`bilibili.app.playurl.v1.DashItem`、`PlayURL`、播放器心跳和探测协议
- Web 容器：`com/bilibili/gripper/webview/*`、QuickJS JNI 和 JSB 服务接口

## BiliHub 净室实现边界

可以独立重写：

1. 以真实 B 站页面/公开接口为输入的第三方客户端容器。
2. TV/平板优先的播放器布局、控制条、弹幕面板和下载面板。
3. 通过 `PlatformAdapter` 接入去广告、弹幕过滤、截图、快捷键、插件和 AmbientLight。
4. 只依赖公开协议和用户当前页面产生的数据，不复制 APK 的代码、资源或私有实现。

暂不复制或绕过：

- APK 的 VMP/dex 保护实现
- 私有播放器 native 库
- 私有接口签名和 DRM 密钥流程
- APK 内置图片、字体、动画和品牌资源

## appbase 观察

APK 内嵌 `assets/appbase_1661149883752.zip`，包含：

- `shell.html`
- `service.base.js`
- `vue.runtime.js`
- `version.sapp`

这表明部分扩展界面使用 Vue shell，通过 `callNative` / `callNativeSync` 访问原生服务。BiliHub 对应采用安全的 `contextBridge`，不暴露原始 IPC：

| appbase 能力 | BiliHub 边界 |
| --- | --- |
| 系统信息 | `bilihub:platform` |
| 设置读写 | `bilihub:storage:get/set/delete` |
| 页面打开 | `bilihub:window:open-bilibili` |
| 下载 | `bilihub:download` |
| 截图 | `bilihub:window:screenshot` / `bilihub:download:save-data` |
| B 站 HTTP | `bilihub:http:request`，仅允许 B 站域名 |

这份映射只复现可观察的交互边界，不复制 appbase 的实现、资源或私有协议。