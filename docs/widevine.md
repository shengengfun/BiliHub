# Widevine / DRM 支持

B 站的番剧、影视与部分高码率内容受 Widevine 保护。官方 Electron 不带 Widevine CDM，
必须换成 castlabs 的构建，并让可执行文件通过 EVS VMP 签名，否则播放时只会黑屏且不报错。

## 1. 换成 castlabs 构建

```bash
pnpm add -D electron@npm:@castlabs/electron-releases@33.2.1+wvcus
```

`package.json` 里会写成 npm alias：

```json
"devDependencies": {
  "electron": "npm:@castlabs/electron-releases@33.2.1+wvcus"
}
```

安装后确认指向正确：

```bash
node -e "console.log(require('electron/package.json').version)"
```

> 本仓库默认保留官方 Electron，便于在没有 DRM 需求的环境里直接开发。
> 需要播番剧时再执行上面的替换命令。

## 2. 代码签名

Windows 上 `electron-builder` 会读取以下环境变量完成代码签名：

| 变量 | 说明 |
| --- | --- |
| `CSC_LINK` | 证书文件路径或 base64（`.pfx`） |
| `CSC_KEY_PASSWORD` | 证书密码 |

没有证书时打包仍可完成，但 **VMP 签名会失败**，DRM 内容依旧无法播放。

## 3. EVS VMP 签名

```bash
pip install castlabs-evs
python -m castlabs_evs.account signup     # 只需注册一次

pnpm dist                                 # 1. 打包（含代码签名）
pnpm sign:vmp                             # 2. VMP 签名
```

**顺序不可颠倒**：VMP 必须作用在已经完成代码签名的 exe 上。

## 4. 验证

1. `chrome://gpu` 里确认 `Widevine` 相关条目不是 disabled；
2. 打开任意番剧（例如《孤独摇滚》）确认画面正常、不黑屏；
3. 把签好名的 exe 拷到另一台干净机器上再验证一次（确认 VMP 真正生效）。

## 5. 常见问题

| 现象 | 排查方向 |
| --- | --- |
| 番剧黑屏、无报错 | `electron` 是否真的指向 castlabs 构建 |
| 签名后仍黑屏 | VMP 是否在代码签名之后执行 |
| 启动即崩溃 | `app.commandLine.appendSwitch` 是否在 `whenReady` 之前调用 |
| 想确认 CDM | 打开 `chrome://media-internals` 查看 Widevine 日志 |
