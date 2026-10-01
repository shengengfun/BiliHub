const fs = require('node:fs')
const path = require('node:path')

function createStorage(filePath) {
  let data = {}
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch {}
  const flush = () => { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(data, null, 2)) }
  return { get: (key) => data[key], set: (key, value) => { data[key] = value; flush() }, delete: (key) => { delete data[key]; flush() } }
}

module.exports = { createStorage }