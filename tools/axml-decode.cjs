// 最小 AXML (Android binary XML) 解析器：用于只读分析 APK 的 AndroidManifest.xml
const fs = require('node:fs')

const RES_STRING_POOL = 0x0001
const RES_XML_START_ELEMENT = 0x0102
const RES_XML_END_ELEMENT = 0x0103
const RES_XML_START_NAMESPACE = 0x0100
const RES_XML_END_NAMESPACE = 0x0101
const RES_XML_CDATA = 0x0104
const RES_XML_RESOURCE_MAP = 0x0180

const TYPE_NAMES = {
  0x00: 'null', 0x01: 'reference', 0x02: 'attribute', 0x03: 'string',
  0x04: 'float', 0x05: 'dimension', 0x06: 'fraction', 0x07: 'dynamic-ref',
  0x08: 'dynamic-attr', 0x10: 'int', 0x11: 'hex', 0x12: 'boolean', 0x1c: 'color8',
  0x1d: 'color', 0x1e: 'color4',
}

function parseStringPool(buffer, offset) {
  const type = buffer.readUInt16LE(offset)
  if (type !== RES_STRING_POOL) throw new Error(`不是字符串池: 0x${type.toString(16)}`)
  const headerSize = buffer.readUInt16LE(offset + 2)
  const chunkSize = buffer.readUInt32LE(offset + 4)
  const stringCount = buffer.readUInt32LE(offset + 8)
  const styleCount = buffer.readUInt32LE(offset + 12)
  const flags = buffer.readUInt32LE(offset + 16)
  const stringsStart = buffer.readUInt32LE(offset + 20)
  const stylesStart = buffer.readUInt32LE(offset + 24)
  const isUtf8 = (flags & 0x00000100) !== 0

  const base = offset + stringsStart
  const offsets = []
  for (let i = 0; i < stringCount; i++) offsets.push(buffer.readUInt32LE(offset + headerSize + i * 4))

  const strings = offsets.map((stringOffset) => {
    const at = base + stringOffset
    if (isUtf8) {
      let cursor = at
      // u8 length (high bit continues) then u8 byte length
      let length = buffer[cursor++]
      if (length & 0x80) length = ((length & 0x7f) << 8) | buffer[cursor++]
      let byteLength = buffer[cursor++]
      if (byteLength & 0x80) byteLength = ((byteLength & 0x7f) << 8) | buffer[cursor++]
      return buffer.toString('utf8', cursor, cursor + byteLength)
    }
    let cursor = at
    let length = buffer.readUInt16LE(cursor); cursor += 2
    if (length & 0x8000) {
      length = ((length & 0x7fff) << 16) | buffer.readUInt16LE(cursor)
      cursor += 2
    }
    const value = buffer.toString('utf16le', cursor, cursor + length * 2)
    return value
  })

  return { strings, chunkSize, isUtf8, styleCount, stylesStart }
}

function formatValue(type, data, rawIndex, strings) {
  if (rawIndex !== 0xffffffff && (type === 0x03 || type === 0x10 || type === 0x11)) {
    if (rawIndex < strings.length && strings[rawIndex]) return strings[rawIndex]
  }
  switch (type) {
    case 0x03: return rawIndex < strings.length ? strings[rawIndex] : `"<string?>"`
    case 0x12: return data !== 0 ? 'true' : 'false'
    case 0x11: return `0x${(data >>> 0).toString(16)}`
    case 0x10: return String(data | 0)
    case 0x01: return `@${(data >>> 0).toString(16)}`
    case 0x05: return `${(data >>> 0) / (1 << 8)}dp?`
    default: return String(data | 0)
  }
}

function parseXml(buffer) {
  const headerType = buffer.readUInt16LE(0)
  const headerSize = buffer.readUInt16LE(2)
  const totalSize = buffer.readUInt32LE(4)
  if (headerType !== 0x0003) throw new Error('不是 AXML')

  let offset = headerSize
  let pool = null
  const resourceMap = []
  const lines = []
  const stack = []
  const elements = []

  while (offset + 8 <= Math.min(buffer.length, totalSize)) {
    const type = buffer.readUInt16LE(offset)
    const chunkHeaderSize = buffer.readUInt16LE(offset + 2)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkSize <= 0) break

    if (type === RES_STRING_POOL) {
      pool = parseStringPool(buffer, offset)
    } else if (type === RES_XML_RESOURCE_MAP) {
      let at = offset + chunkHeaderSize
      while (at + 4 <= offset + chunkSize) { resourceMap.push(buffer.readUInt32LE(at)); at += 4 }
    } else if (type === RES_XML_START_ELEMENT) {
      const ns = buffer.readInt32LE(offset + 16)
      const nameIndex = buffer.readInt32LE(offset + 20)
      const attributeStart = buffer.readUInt16LE(offset + 24)
      const attributeSize = buffer.readUInt16LE(offset + 26)
      const attributeCount = buffer.readUInt16LE(offset + 28)
      const tagName = pool.strings[nameIndex]
      const attributes = []
      let attrOffset = offset + 16 + attributeStart
      for (let i = 0; i < attributeCount; i++) {
        const aNs = buffer.readInt32LE(attrOffset)
        const aName = buffer.readInt32LE(attrOffset + 4)
        const aRaw = buffer.readInt32LE(attrOffset + 8)
        const aSize = buffer.readUInt16LE(attrOffset + 12)
        const aType = buffer[attrOffset + 15]
        const aData = buffer.readInt32LE(attrOffset + 16)
        attributes.push({
          name: pool.strings[aName],
          ns: aNs >= 0 ? pool.strings[aNs] : null,
          resourceId: resourceMap.length > aName ? resourceMap[aName] : null,
          value: formatValue(aType, aData, aRaw, pool.strings),
        })
        attrOffset += attributeSize
      }
      const selfClosing = (buffer.readUInt16LE(offset + 30) !== 0xffff)
      elements.push({ tag: tagName, attributes, ns: ns >= 0 ? pool.strings[ns] : null })
      lines.push({ indent: stack.length, text: `<${tagName}${attributes.map((a) => ` ${a.name}="${a.value}"`).join('')}${selfClosing ? '/' : ''}>` })
      if (!selfClosing) stack.push(tagName)
    } else if (type === RES_XML_END_ELEMENT) {
      stack.pop()
    } else if (type === RES_XML_START_NAMESPACE) {
      const prefix = buffer.readInt32LE(offset + 16)
      const uri = buffer.readInt32LE(offset + 20)
      lines.push({ indent: 0, text: `<!-- ns ${pool.strings[prefix]} = ${pool.strings[uri]} -->` })
    } else if (type === RES_XML_END_NAMESPACE) {
      // 忽略
    } else if (type === RES_XML_CDATA) {
      // 忽略
    }

    offset += chunkSize
    if (chunkHeaderSize === 0) break
  }

  return { pool, elements, lines }
}

const target = process.argv[2]
const buffer = fs.readFileSync(target)
const { pool, elements, lines } = parseXml(buffer)

console.log('=== 字符串池数量 ===', pool.strings.length, 'UTF8:', pool.isUtf8)
console.log('=== XML ===')
for (const line of lines) console.log(`${'  '.repeat(line.indent)}${line.text}`)
console.log('=== 元素数量 ===', elements.length)
