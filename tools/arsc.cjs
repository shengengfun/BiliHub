// 最小 resources.arsc 解析器：将资源名解析为文件路径
const fs = require('node:fs')

const RES_STRING_POOL = 0x0001
const RES_TABLE = 0x0002
const RES_TABLE_PACKAGE = 0x0200
const RES_TABLE_TYPE = 0x0201
const RES_TABLE_TYPE_SPEC = 0x0202
const RES_TABLE_LIBRARY = 0x0203

function readStringPool(buffer, offset) {
  const headerSize = buffer.readUInt16LE(offset + 2)
  const chunkSize = buffer.readUInt32LE(offset + 4)
  const stringCount = buffer.readUInt32LE(offset + 8)
  const flags = buffer.readUInt32LE(offset + 16)
  const stringsStart = buffer.readUInt32LE(offset + 20)
  const isUtf8 = (flags & 0x00000100) !== 0
  const base = offset + stringsStart
  const offsets = []
  for (let i = 0; i < stringCount; i++) offsets.push(buffer.readUInt32LE(offset + headerSize + i * 4))
  const strings = offsets.map((stringOffset) => {
    const at = base + stringOffset
    try {
      if (isUtf8) {
        let cursor = at
        let length = buffer[cursor++]
        if (length & 0x80) length = ((length & 0x7f) << 8) | buffer[cursor++]
        let byteLength = buffer[cursor++]
        if (byteLength & 0x80) byteLength = ((byteLength & 0x7f) << 8) | buffer[cursor++]
        return buffer.toString('utf8', cursor, cursor + byteLength)
      }
      let cursor = at
      let length = buffer.readUInt16LE(cursor); cursor += 2
      if (length & 0x8000) { length = ((length & 0x7fff) << 16) | buffer.readUInt16LE(cursor); cursor += 2 }
      return buffer.toString('utf16le', cursor, cursor + length * 2)
    } catch { return '' }
  })
  return { strings, chunkSize }
}

function readValue(buffer, at) {
  const dataType = buffer[at + 3]
  const data = buffer.readUInt32LE(at + 4)
  return { dataType, data }
}

const TYPE_NAMES = { 0x01: 'reference', 0x02: 'attribute', 0x03: 'string', 0x10: 'int', 0x11: 'hex', 0x12: 'boolean' }

function parseTable(buffer) {
  const globalPool = readStringPool(buffer, buffer.readUInt16LE(2))
  const result = { packages: [], entries: new Map() }

  let offset = buffer.readUInt16LE(2)
  const total = buffer.readUInt32LE(4)

  while (offset + 8 <= Math.min(buffer.length, total)) {
    const type = buffer.readUInt16LE(offset)
    const headerSize = buffer.readUInt16LE(offset + 2)
    const size = buffer.readUInt32LE(offset + 4)
    if (size <= 0) break

    if (type === RES_TABLE_PACKAGE) {
      const packageId = buffer.readUInt32LE(offset + 8)
      const typeStringsOffset = buffer.readUInt32LE(offset + 268)
      const keyStringsOffset = buffer.readUInt32LE(offset + 276)
      const typePool = readStringPool(buffer, offset + typeStringsOffset)
      const keyPool = readStringPool(buffer, offset + keyStringsOffset)
      const pkg = { packageId, typePool, keyPool, types: new Map() }

      let sub = offset + headerSize
      while (sub + 8 <= offset + size) {
        const subType = buffer.readUInt16LE(sub)
        const subSize = buffer.readUInt32LE(sub + 4)
        if (subSize <= 0) break

        if (subType === RES_TABLE_TYPE) {
          const typeId = buffer[sub + 8]
          const entryCount = buffer.readUInt32LE(sub + 12)
          const entriesStart = buffer.readUInt32LE(sub + 16)
          const typeHeaderSize = buffer.readUInt16LE(sub + 2)
          const typeName = typePool.strings[typeId - 1] ?? `type${typeId}`
          const entriesBase = sub + entriesStart

          for (let i = 0; i < entryCount; i++) {
            const entryOffset = buffer.readUInt32LE(sub + typeHeaderSize + i * 4)
            if (entryOffset === 0xffffffff) continue
            const entryAt = entriesBase + entryOffset
            const flags = buffer.readUInt16LE(entryAt + 2)
            const keyIndex = buffer.readUInt32LE(entryAt + 4)
            const keyName = keyPool.strings[keyIndex] ?? ''
            let valueAt = entryAt + 8
            if (flags & 0x0001) {
              const count = buffer.readUInt32LE(entryAt + 12)
              valueAt = entryAt + 16 + count * 12
            }
            const value = readValue(buffer, valueAt)
            const resolved = value.dataType === 0x03 ? globalPool.strings[value.data] : undefined
            const id = (packageId << 24 | typeId << 16 | i) >>> 0
            pkg.types.set(`${typeName}/${keyName}`, { id, typeName, name: keyName, dataType: value.dataType, data: value.data, value: resolved })
            result.entries.set(id, { typeName, name: keyName, value: resolved, dataType: value.dataType })
          }
        }
        sub += subSize
      }
      result.packages.push(pkg)
    }
    offset += size
  }
  return result
}

const file = process.argv[2]
const buffer = fs.readFileSync(file)
const table = parseTable(buffer)

const mode = process.argv[3]
if (mode === 'resolve') {
  const ids = process.argv.slice(4)
  for (const raw of ids) {
    const id = Number.parseInt(raw.replace(/^@/, ''), 16) >>> 0
    const entry = table.entries.get(id)
    console.log(raw, '->', entry ? `${entry.typeName}/${entry.name} = ${entry.value ?? `(${TYPE_NAMES[entry.dataType] ?? entry.dataType}:${entry.data})`}` : '未找到')
  }
} else {
  const keyword = mode ?? 'logo'
  const matcher = new RegExp(keyword, 'i')
  let count = 0
  for (const [, entry] of table.entries) {
    if (!matcher.test(entry.name)) continue
    if (!entry.value) continue
    console.log(`${entry.typeName}/${entry.name} = ${entry.value}`)
    if (++count > 80) break
  }
  console.log('--- 总条目', table.entries.size, '---')
}
