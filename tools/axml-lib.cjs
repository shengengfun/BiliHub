// AXML 解析库（供其它分析脚本复用）
const fs = require('node:fs')

const RES_STRING_POOL = 0x0001
const RES_XML_START_ELEMENT = 0x0102
const RES_XML_START_NAMESPACE = 0x0100
const RES_XML_RESOURCE_MAP = 0x0180

function parseStringPool(buffer, offset) {
  const headerSize = buffer.readUInt16LE(offset + 2)
  const stringCount = buffer.readUInt32LE(offset + 8)
  const flags = buffer.readUInt32LE(offset + 16)
  const stringsStart = buffer.readUInt32LE(offset + 20)
  const isUtf8 = (flags & 0x00000100) !== 0
  const base = offset + stringsStart
  const offsets = []
  for (let i = 0; i < stringCount; i++) offsets.push(buffer.readUInt32LE(offset + headerSize + i * 4))
  const strings = offsets.map((stringOffset) => {
    const at = base + stringOffset
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
  })
  return { strings, isUtf8 }
}

function parseXml(buffer) {
  const headerType = buffer.readUInt16LE(0)
  if (headerType !== 0x0003) throw new Error('不是 AXML')
  const headerSize = buffer.readUInt16LE(2)
  const totalSize = buffer.readUInt32LE(4)

  let offset = headerSize
  let pool = null
  const resourceMap = []
  const elements = []

  while (offset + 8 <= Math.min(buffer.length, totalSize)) {
    const type = buffer.readUInt16LE(offset)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkSize <= 0) break

    if (type === RES_STRING_POOL) pool = parseStringPool(buffer, offset)
    else if (type === RES_XML_RESOURCE_MAP) {
      let at = offset + buffer.readUInt16LE(offset + 2)
      while (at + 4 <= offset + chunkSize) { resourceMap.push(buffer.readUInt32LE(at)); at += 4 }
    } else if (type === RES_XML_START_ELEMENT) {
      const nameIndex = buffer.readInt32LE(offset + 20)
      const attributeStart = buffer.readUInt16LE(offset + 24)
      const attributeSize = buffer.readUInt16LE(offset + 26)
      const attributeCount = buffer.readUInt16LE(offset + 28)
      const attributes = []
      let attrOffset = offset + 16 + attributeStart
      for (let i = 0; i < attributeCount; i++) {
        const aName = buffer.readInt32LE(attrOffset + 4)
        const aRaw = buffer.readInt32LE(attrOffset + 8)
        const aType = buffer[attrOffset + 15]
        const aData = buffer.readInt32LE(attrOffset + 16)
        let value
        if (aRaw >= 0 && aRaw < pool.strings.length) value = pool.strings[aRaw]
        else if (aType === 0x1c || aType === 0x1d || aType === 0x1e) value = `#${(aData >>> 0).toString(16).padStart(8, '0')}`
        else if (aType === 0x01) value = `@${(aData >>> 0).toString(16)}`
        else if (aType === 0x12) value = aData !== 0 ? 'true' : 'false'
        else if (aType === 0x10) value = String(aData | 0)
        else value = `t${aType}:${aData}`
        attributes.push({ name: pool.strings[aName], value })
        attrOffset += attributeSize
      }
      elements.push({ tag: pool.strings[nameIndex], attributes })
    }
    offset += chunkSize
  }
  return { elements }
}

function decodeFile(file) {
  return parseXml(fs.readFileSync(file))
}

function toXml(elements) {
  const stack = []
  const lines = []
  // 无闭合标记信息时按顺序输出为扁平列表
  for (const element of elements) {
    const attrs = element.attributes.map((a) => `${a.name}="${a.value}"`).join(' ')
    lines.push(`<${element.tag} ${attrs}>`)
  }
  return lines.join('\n')
}

module.exports = { decodeFile, toXml, parseXml, parseStringPool }
