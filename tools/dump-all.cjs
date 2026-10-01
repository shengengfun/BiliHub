// 全量导出 resources.arsc 条目：按类型归类，便于查询任意资源
const fs = require('node:fs')
const path = require('node:path')

const RES_STRING_POOL = 0x0001
const RES_TABLE_PACKAGE = 0x0200
const RES_TABLE_TYPE = 0x0201
const RES_TABLE_LIBRARY = 0x0203

function readStringPool(buffer, offset) {
  const headerSize = buffer.readUInt16LE(offset + 2)
  const stringCount = buffer.readUInt32LE(offset + 8)
  const flags = buffer.readUInt32LE(offset + 16)
  const stringsStart = buffer.readUInt32LE(offset + 20)
  const isUtf8 = (flags & 0x00000100) !== 0
  const base = offset + stringsStart
  const offsets = []
  for (let i = 0; i < stringCount; i++) offsets.push(buffer.readUInt32LE(offset + headerSize + i * 4))
  return offsets.map((stringOffset) => {
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
}

const TYPE_TAG = { 0x01: 'ref', 0x02: 'attr', 0x03: 'str', 0x04: 'float', 0x05: 'dim', 0x10: 'int', 0x11: 'hex', 0x12: 'bool', 0x1c: 'c8', 0x1d: 'color', 0x1e: 'c4' }

function formatValue(dataType, data, globalStrings) {
  if (dataType === 0x03) return globalStrings[data] ?? ''
  if (dataType === 0x1c || dataType === 0x1d || dataType === 0x1e) return `#${(data >>> 0).toString(16).padStart(8, '0')}`
  if (dataType === 0x01) return `@${(data >>> 0).toString(16)}`
  if (dataType === 0x12) return data !== 0 ? 'true' : 'false'
  if (dataType === 0x04) return String(Buffer.from(Uint32Array.of(data).buffer).readFloatLE(0))
  if (dataType === 0x05) return `${((data >>> 0) / 256).toFixed(2)}dp`
  if (dataType === 0x10) return String(data | 0)
  if (dataType === 0x11) return `0x${(data >>> 0).toString(16)}`
  return `${TYPE_TAG[dataType] ?? dataType}:${data}`
}

const buffer = fs.readFileSync(process.argv[2])
const outFile = process.argv[3]
const globalStrings = readStringPool(buffer, buffer.readUInt16LE(2))

const byType = new Map()
let offset = buffer.readUInt16LE(2)
const total = buffer.readUInt32LE(4)

while (offset + 8 <= Math.min(buffer.length, total)) {
  const type = buffer.readUInt16LE(offset)
  const headerSize = buffer.readUInt16LE(offset + 2)
  const size = buffer.readUInt32LE(offset + 4)
  if (size <= 0) break

  if (type === RES_TABLE_PACKAGE) {
    const typePool = readStringPool(buffer, offset + buffer.readUInt32LE(offset + 268))
    const keyPool = readStringPool(buffer, offset + buffer.readUInt32LE(offset + 276))
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
        const typeName = typePool[typeId - 1] ?? `type${typeId}`
        const entriesBase = sub + entriesStart
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = buffer.readUInt32LE(sub + typeHeaderSize + i * 4)
          if (entryOffset === 0xffffffff) continue
          const entryAt = entriesBase + entryOffset
          const flags = buffer.readUInt16LE(entryAt + 2)
          const keyName = keyPool[buffer.readUInt32LE(entryAt + 4)] ?? ''
          let valueAt = entryAt + 8
          if (flags & 0x0001) valueAt = entryAt + 16 + buffer.readUInt32LE(entryAt + 12) * 12
          const dataType = buffer[valueAt + 3]
          const data = buffer.readUInt32LE(valueAt + 4)
          const value = formatValue(dataType, data, globalStrings)
          if (!byType.has(typeName)) byType.set(typeName, [])
          byType.get(typeName).push(`${keyName}\t${value}`)
        }
      }
      sub += subSize
    }
  }
  offset += size
}

const lines = []
let count = 0
for (const [typeName, items] of [...byType].sort()) {
  lines.push(`## ${typeName} (${items.length})`)
  for (const item of items.sort()) lines.push(item)
  lines.push('')
  count += items.length
}
fs.writeFileSync(outFile, lines.join('\n'), 'utf8')
console.log(`导出 ${count} 条 -> ${path.basename(outFile)}; 类型: ${[...byType.keys()].sort().join(', ')}`)
