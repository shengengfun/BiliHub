// Android VectorDrawable(AXML) -> SVG 转换器
const fs = require('node:fs')
const path = require('node:path')

const RES_STRING_POOL = 0x0001
const RES_XML_START_ELEMENT = 0x0102
const RES_XML_END_ELEMENT = 0x0103

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
}

function decodeValue(buffer, at) {
  const dataType = buffer[at + 3]
  const raw = buffer.readUInt32LE(at + 4)
  return { dataType, raw }
}

// 读取 AXML 为带层级的元素树
function readTree(buffer) {
  const headerSize = buffer.readUInt16LE(2)
  const total = buffer.readUInt32LE(4)
  let offset = headerSize
  let pool = null
  const root = { children: [] }
  const stack = [root]

  while (offset + 8 <= Math.min(buffer.length, total)) {
    const type = buffer.readUInt16LE(offset)
    const size = buffer.readUInt32LE(offset + 4)
    if (size <= 0) break

    if (type === RES_STRING_POOL) {
      pool = readStringPool(buffer, offset)
    } else if (type === RES_XML_START_ELEMENT && pool) {
      const nameIndex = buffer.readInt32LE(offset + 20)
      const attributeStart = buffer.readUInt16LE(offset + 24)
      const attributeSize = buffer.readUInt16LE(offset + 26)
      const attributeCount = buffer.readUInt16LE(offset + 28)
      const attributes = {}
      let attrOffset = offset + 16 + attributeStart
      for (let i = 0; i < attributeCount; i++) {
        const aName = buffer.readInt32LE(attrOffset + 4)
        const { dataType, raw } = decodeValue(buffer, attrOffset + 12)
        attributes[pool[aName]] = { dataType, raw }
        attrOffset += attributeSize
      }
      const element = { tag: pool[nameIndex], attributes, children: [] }
      stack[stack.length - 1].children.push(element)
      stack.push(element)
    } else if (type === RES_XML_END_ELEMENT) {
      if (stack.length > 1) stack.pop()
    }
    offset += size
  }
  return root
}

function attrString(attr, pool) { return attr === undefined ? undefined : pool?.[attr.raw] }
function attrFloat(attr) { return attr === undefined ? undefined : attr.raw }

function toHexColor(raw) {
  const alpha = (raw >>> 24) & 0xff
  const rgb = raw & 0xffffff
  return { hex: `#${rgb.toString(16).padStart(6, '0')}`, alpha: +(alpha / 255).toFixed(3) }
}

function floatOf(buffer, offset, attr) {
  if (!attr) return undefined
  // 类型 4 = float
  if (attr.dataType === 0x04) return Buffer.from(Uint32Array.of(attr.raw).buffer).readFloatLE(0)
  return attr.raw
}

function convert(file) {
  const buffer = fs.readFileSync(file)
  const tree = readTree(buffer)
  const vector = tree.children.find((child) => child.tag === 'vector')
  if (!vector) throw new Error(`${path.basename(file)} 不是 vector drawable`)

  const viewportWidth = floatOf(buffer, 0, vector.attributes.viewportWidth) ?? 24
  const viewportHeight = floatOf(buffer, 0, vector.attributes.viewportHeight) ?? 24

  const body = []
  const walk = (node, transform) => {
    if (node.tag === 'path') {
      const pathData = attrString(node.attributes.pathData, stringPoolCache.get(file))
      if (!pathData) return
      const parts = []
      if (node.attributes.fillColor) {
        const { hex, alpha } = toHexColor(node.attributes.fillColor.raw)
        parts.push(`fill="${hex}"`)
        if (alpha < 1) parts.push(`fill-opacity="${alpha}"`)
      } else if (node.attributes.strokeColor) {
        parts.push('fill="none"')
      }
      if (node.attributes.strokeColor) {
        const { hex, alpha } = toHexColor(node.attributes.strokeColor.raw)
        parts.push(`stroke="${hex}"`)
        if (alpha < 1) parts.push(`stroke-opacity="${alpha}"`)
      }
      if (node.attributes.strokeWidth) {
        const width = floatOf(buffer, 0, node.attributes.strokeWidth) ?? 1
        parts.push(`stroke-width="${width}"`)
      }
      const fillType = node.attributes.fillType
      if (fillType) {
        const rule = fillType.raw === 1 ? 'nonzero' : 'evenodd'
        parts.push(`fill-rule="${rule}"`)
      }
      body.push(`  <path ${transform}${parts.join(' ')} d="${pathData}"/>`)
      return
    }
    if (node.tag === 'group') {
      const tx = floatOf(buffer, 0, node.attributes.translateX) ?? 0
      const ty = floatOf(buffer, 0, node.attributes.translateY) ?? 0
      const sx = floatOf(buffer, 0, node.attributes.scaleX) ?? 1
      const sy = floatOf(buffer, 0, node.attributes.scaleY) ?? 1
      const next = `${transform}transform="translate(${tx} ${ty}) scale(${sx} ${sy})" `
      for (const child of node.children) walk(child, next)
      return
    }
    for (const child of node.children) walk(child, transform)
  }
  for (const child of vector.children) walk(child, '')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewportWidth}" height="${viewportHeight}" viewBox="0 0 ${viewportWidth} ${viewportHeight}">\n${body.join('\n')}\n</svg>\n`
  return { svg, viewportWidth, viewportHeight, paths: body.length }
}

// 每个文件的字符串池缓存（pathData 是字符串类型）
const stringPoolCache = new Map()

function withPool(file, fn) {
  const buffer = fs.readFileSync(file)
  const headerSize = buffer.readUInt16LE(2)
  const pool = readStringPool(buffer, headerSize)
  stringPoolCache.set(file, pool)
  return fn()
}

const inputs = process.argv.slice(2)
const outDir = process.env.SVG_OUT || '.'

for (const input of inputs) {
  const [file, name] = input.split('=')
  try {
    const result = withPool(file, () => convert(file))
    const target = path.join(outDir, `${name || path.basename(file, '.xml')}.svg`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, result.svg, 'utf8')
    console.log(`ok ${name} <- ${path.basename(file)} (${result.paths} paths, ${result.viewportWidth}x${result.viewportHeight})`)
  } catch (error) {
    console.error(`fail ${file}: ${error.message}`)
  }
}
