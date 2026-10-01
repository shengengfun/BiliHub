// 品牌资源路径解析：兼容 Vite dev 与 Electron file:// 加载
const base = import.meta.env.BASE_URL

/**
 * 解析 public/brand 下的资源路径。
 * 图标提取自用户提供的 iBiliPlayer-bili.apk，仅本地使用，不随仓库分发。
 */
export function brand(file) {
  return `${base}brand/${file}`
}
