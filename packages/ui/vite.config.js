import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const PASSTHROUGH = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'cache-control']

/**
 * 开发期 B 站代理：浏览器预览无法设置 Referer 且受 CORS 限制，
 * 这里统一在 dev server 侧转发，补齐 Referer/UA，并支持视频 Range 请求。
 * Electron 环境不使用此代理，由主进程注入请求头。
 */
function biliProxy() {
  return {
    name: 'bilihub-bili-proxy',
    configureServer(server) {
      server.middlewares.use('/bili-proxy', async (req, res) => {
        const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.end('missing url')
          return
        }
        try {
          const headers = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' }
          if (req.headers.range) headers.Range = req.headers.range
          if (req.headers.accept) headers.Accept = req.headers.accept
          const upstream = await fetch(target, { headers })
          res.statusCode = upstream.status
          for (const [key, value] of upstream.headers) {
            if (PASSTHROUGH.includes(key.toLowerCase())) res.setHeader(key, value)
          }
          res.setHeader('Access-Control-Allow-Origin', '*')
          if (!upstream.body) return res.end()
          const reader = upstream.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(Buffer.from(value))
          }
          res.end()
        } catch (error) {
          res.statusCode = 502
          res.end(String(error.message ?? error))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), biliProxy()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
})
