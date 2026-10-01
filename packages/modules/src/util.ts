/** 模块公用工具 */

/** 注入样式表，返回移除函数 */
export function injectStyle(id: string, css: string): () => void {
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.appendChild(style)
  return () => style.remove()
}

/** 监听新出现的元素（B 站是单页应用，节点会被反复替换） */
export function observeSelector(selector: string, callback: (element: Element) => void): () => void {
  const seen = new WeakSet<Element>()
  const scan = () => {
    document.querySelectorAll(selector).forEach((element) => {
      if (seen.has(element)) return
      seen.add(element)
      callback(element)
    })
  }
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return () => observer.disconnect()
}

/** 立即移除匹配的节点，并持续清理后续新增的 */
export function removeSelector(selector: string): () => void {
  const strip = () => document.querySelectorAll(selector).forEach((element) => element.remove())
  strip()
  const observer = new MutationObserver(strip)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return () => observer.disconnect()
}

/** 简易节流 */
export function throttle<T extends (...args: never[]) => void>(fn: T, wait = 200): T {
  let last = 0
  let timer: number | undefined
  return ((...args: never[]) => {
    const now = Date.now()
    const remain = wait - (now - last)
    if (remain <= 0) {
      last = now
      fn(...args)
    } else if (timer === undefined) {
      timer = window.setTimeout(() => {
        last = Date.now()
        timer = undefined
        fn(...args)
      }, remain)
    }
  }) as T
}

/** requestVideoFrameCallback 的兼容封装：不支持时回退到定时器 */
export function onVideoFrame(video: HTMLVideoElement, callback: () => void, fps = 15): () => void {
  const interval = 1000 / fps
  let running = true
  let lastTime = 0

  type WithFrameCallback = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number) => void) => number
  }
  const target = video as WithFrameCallback

  if (typeof target.requestVideoFrameCallback === 'function') {
    const step = (now: number) => {
      if (!running) return
      if (now - lastTime >= interval) {
        lastTime = now
        callback()
      }
      target.requestVideoFrameCallback?.(step)
    }
    target.requestVideoFrameCallback(step)
    return () => { running = false }
  }

  const timer = window.setInterval(() => { if (running) callback() }, interval)
  return () => { running = false; window.clearInterval(timer) }
}
