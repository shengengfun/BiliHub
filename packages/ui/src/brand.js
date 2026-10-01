// 品牌资源路径解析：兼容 Vite dev 与 Electron file:// 加载
const base = import.meta.env.BASE_URL

/**
 * 解析 public/brand 下的资源路径。
 * 图标提取自用户提供的 iBiliPlayer-bili.apk，仅本地使用，不随仓库分发。
 */
export function brand(file) {
  return `${base}brand/${file}`
}

/**
 * 解析图标名：带扩展名的原样使用，否则按 PNG 处理。
 * 便于菜单同时使用 APK 提取的位图与自绘的矢量图标。
 */
export function brandIcon(name) {
  return brand(/\.[a-z0-9]+$/i.test(name) ? name : `${name}.png`)
}
