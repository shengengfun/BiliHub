const AD_PATTERNS = [/api\.bilibili\.com\/x\/v2\/ad\//i, /api\.bilibili\.com\/x\/v2\/activity\//i, /bili(?:g|m)eta\.com\/.*(?:ad|advert)/i]

// 视频与封面分布在不同 CDN（含运营商镜像），统一补上 Referer 才能播放
const CDN_HINTS = [/bilivideo\.(com|cn)$/i, /hdslb\.com$/i, /akamaized\.net$/i, /mountaintoys\.cn$/i, /bilivideo\.com\.cn$/i]

function setupWebRequest(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['*://*.bilibili.com/*', '*://*.hdslb.com/*'] }, (details, callback) => callback({ cancel: AD_PATTERNS.some((pattern) => pattern.test(details.url)) }))
  ses.webRequest.onHeadersReceived({ urls: ['*://*.bilibili.com/*'] }, (details, callback) => {
    const headers = { ...details.responseHeaders }
    delete headers['content-security-policy']; delete headers['Content-Security-Policy']
    callback({ responseHeaders: headers })
  })
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    let host = ''
    try { host = new URL(details.url).hostname } catch {}
    const needsReferer = details.resourceType === 'media' || CDN_HINTS.some((pattern) => pattern.test(host))
    if (needsReferer) {
      details.requestHeaders.Referer = 'https://www.bilibili.com/'
      details.requestHeaders.Origin = 'https://www.bilibili.com'
      details.requestHeaders['User-Agent'] = details.requestHeaders['User-Agent'] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
    callback({ requestHeaders: details.requestHeaders })
  })
}

module.exports = { setupWebRequest }