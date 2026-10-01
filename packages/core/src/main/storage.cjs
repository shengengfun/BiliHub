// 轻量键值存储：设置项与插件启用状态都落在这个 JSON 文件里
const fs = require('node:fs')
const path = require('node:path')

function createStorage(filePath) {
  let data = {}
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    data = {}
  }

  const flush = () => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('[bilihub:storage] 写入失败', error)
    }
  }

  return {
    get: (key) => data[key],
    set: (key, value) => {
      data[key] = value
      flush()
    },
    delete: (key) => {
      delete data[key]
      flush()
    },
    /** 导出全部键值，供设置导入导出使用 */
    all: () => ({ ...data }),
    /** 合并导入；replace 为 true 时先清空 */
    merge: (values, replace = false) => {
      if (!values || typeof values !== 'object') return 0
      if (replace) data = {}
      let count = 0
      for (const [key, value] of Object.entries(values)) {
        data[key] = value
        count += 1
      }
      flush()
      return count
    },
    filePath,
  }
}

module.exports = { createStorage }
