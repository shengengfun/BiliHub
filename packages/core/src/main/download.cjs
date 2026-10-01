// 下载管理器：视频 / 封面 / 弹幕 / 元数据
// 支持并发队列、进度统计、暂停（Range 断点续传）、恢复、取消。
const fs = require('node:fs')
const path = require('node:path')
const { app, session, shell } = require('electron')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com/'
const MAX_CONCURRENT = 3

/** @type {Map<string, object>} */
const tasks = new Map()
const queue = []
let sequence = 0
let running = 0
let notify = () => {}

function downloadsDir() {
  const dir = path.join(app.getPath('downloads'), 'BiliHub')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** 去掉 Windows 文件名非法字符，并限制长度 */
function safeName(name, fallback = 'bilihub') {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/^\.+/, '')
    .trim()
  const base = cleaned || fallback
  return base.length > 80 ? base.slice(0, 80) : base
}

function uniquePath(dir, filename) {
  const ext = path.extname(filename)
  const stem = path.basename(filename, ext)
  let candidate = path.join(dir, filename)
  let index = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${index})${ext}`)
    index += 1
  }
  return candidate
}

function snapshot(task) {
  return {
    id: task.id,
    type: task.type,
    title: task.title,
    bvid: task.bvid,
    cid: task.cid,
    filename: path.basename(task.filePath),
    dir: path.dirname(task.filePath),
    total: task.total,
    received: task.received,
    percent: task.total > 0 ? Math.min(100, Math.round((task.received / task.total) * 1000) / 10) : 0,
    speed: task.speed,
    status: task.status,
    error: task.error,
    createdAt: task.createdAt,
    finishedAt: task.finishedAt,
  }
}

function stats() {
  const all = [...tasks.values()]
  const count = (status) => all.filter((task) => task.status === status).length
  return {
    total: all.length,
    running: count('running'),
    paused: count('paused') + count('pending'),
    done: count('done'),
    error: count('error'),
    speed: all.filter((task) => task.status === 'running').reduce((sum, task) => sum + (task.speed || 0), 0),
  }
}

function broadcast() {
  try {
    notify({ items: [...tasks.values()].map(snapshot), stats: stats() })
  } catch {
    /* 窗口可能已关闭 */
  }
}

function setStatus(task, status, error) {
  task.status = status
  if (error !== undefined) task.error = error
  broadcast()
}

async function runTask(task) {
  const ses = session.fromPartition('persist:bilihub')
  const controller = new AbortController()
  task.controller = controller
  setStatus(task, 'running')

  const headers = {
    'User-Agent': UA,
    Referer: REFERER,
    Origin: 'https://www.bilibili.com',
  }
  // 断点续传：把已完成字节数作为 Range 起点
  if (task.received > 0) headers.Range = `bytes=${task.received}-`
  else fs.mkdirSync(path.dirname(task.filePath), { recursive: true })

  task.sampler = { lastBytes: task.received, lastTime: Date.now(), speed: 0 }

  try {
    const response = await ses.fetch(task.url, { headers, signal: controller.signal })
    if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`)

    if (response.status === 206) {
      const range = response.headers.get('content-range') || ''
      const total = Number(range.split('/')[1])
      if (Number.isFinite(total)) task.total = total
    } else {
      // 服务器不支持断点续传，从头写
      task.received = 0
      task.total = Number(response.headers.get('content-length') || 0)
    }

    const out = fs.createWriteStream(task.filePath, { flags: task.received > 0 ? 'a' : 'w' })
    const body = Readable.fromWeb(response.body)
    body.on('data', (chunk) => {
      task.received += chunk.length
      const now = Date.now()
      const elapsed = now - task.sampler.lastTime
      if (elapsed >= 500) {
        task.sampler.speed = ((task.received - task.sampler.lastBytes) / elapsed) * 1000
        task.sampler.lastBytes = task.received
        task.sampler.lastTime = now
        task.speed = task.sampler.speed
        broadcast()
      }
    })
    await pipeline(body, out)

    task.speed = 0
    task.finishedAt = Date.now()
    setStatus(task, 'done')
  } catch (error) {
    if (task.status === 'canceled' || task.status === 'paused') return
    task.speed = 0
    setStatus(task, 'error', error?.message || String(error))
  } finally {
    task.controller = null
    running -= 1
    pump()
  }
}

function pump() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const task = queue.shift()
    if (task.status !== 'pending') continue
    running += 1
    void runTask(task)
  }
  broadcast()
}

/**
 * 创建下载任务
 * @param {{type?:string,url:string,title?:string,filename?:string,bvid?:string,cid?:number|string,content?:string}} options
 */
function create(options) {
  if (!options?.url) throw new Error('缺少下载地址')
  const type = options.type || 'video'
  const id = `dl-${Date.now().toString(36)}-${(sequence += 1)}`
  const dir = downloadsDir()
  const fallbackExt = { video: '.mp4', cover: '.jpg', danmaku: '.xml', metadata: '.json' }[type] || '.bin'
  const stem = safeName(options.title || options.bvid || 'bilihub')
  const filename = safeName(options.filename || `${stem}${fallbackExt}`)
  const filePath = uniquePath(dir, filename)

  const task = {
    id,
    type,
    title: options.title || filename,
    bvid: options.bvid || '',
    cid: options.cid ?? '',
    url: options.url,
    filePath,
    total: 0,
    received: 0,
    speed: 0,
    status: 'pending',
    error: null,
    createdAt: Date.now(),
    finishedAt: 0,
    controller: null,
    sampler: null,
  }
  tasks.set(id, task)

  // 弹幕 / 元数据这类小文本直接落盘，不占队列
  if (typeof options.content === 'string') {
    fs.writeFileSync(filePath, options.content, 'utf8')
    task.received = Buffer.byteLength(options.content, 'utf8')
    task.total = task.received
    task.finishedAt = Date.now()
    setStatus(task, 'done')
    return snapshot(task)
  }

  queue.push(task)
  broadcast()
  pump()
  return snapshot(task)
}

function pause(id) {
  const task = tasks.get(id)
  if (!task || (task.status !== 'running' && task.status !== 'pending')) return false
  task.status = 'paused'
  const index = queue.indexOf(task)
  if (index >= 0) queue.splice(index, 1)
  task.controller?.abort()
  broadcast()
  return true
}

function resume(id) {
  const task = tasks.get(id)
  if (!task || task.status !== 'paused') return false
  task.status = 'pending'
  queue.push(task)
  pump()
  return true
}

function cancel(id) {
  const task = tasks.get(id)
  if (!task) return false
  task.status = 'canceled'
  const index = queue.indexOf(task)
  if (index >= 0) queue.splice(index, 1)
  task.controller?.abort()
  // 已完成的文件保留，中间文件删除
  if (task.received > 0 && task.finishedAt === 0) {
    try {
      fs.rmSync(task.filePath, { force: true })
    } catch {
      /* 文件可能被占用 */
    }
  }
  task.received = 0
  broadcast()
  return true
}

function remove(id) {
  const task = tasks.get(id)
  if (!task) return false
  cancel(id)
  tasks.delete(id)
  broadcast()
  return true
}

function list() {
  return { items: [...tasks.values()].map(snapshot), stats: stats() }
}

function openFolder(id) {
  const task = id ? tasks.get(id) : null
  const target = task && fs.existsSync(path.dirname(task.filePath)) ? path.dirname(task.filePath) : downloadsDir()
  shell.openPath(target)
  return target
}

module.exports = {
  downloadsDir,
  create,
  pause,
  resume,
  cancel,
  remove,
  list,
  openFolder,
  setNotifier(fn) {
    notify = typeof fn === 'function' ? fn : () => {}
  },
}
