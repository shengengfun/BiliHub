const AD_PATTERNS = [/api\.bilibili\.com\/x\/v2\/ad\//i, /api\.bilibili\.com\/x\/v2\/activity\//i, /bili(?:g|m)eta\.com\/.*(?:ad|advert)/i]

function setupWebRequest(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['*://*.bilibili.com/*', '*://*.hdslb.com/*'] }, (details, callback) => callback({ cancel: AD_PATTERNS.some((pattern) => pattern.test(details.url)) }))
  ses.webRequest.onHeadersReceived({ urls: ['*://*.bilibili.com/*'] }, (details, callback) => {
    const headers = { ...details.responseHeaders }
    delete headers['content-security-policy']; delete headers['Content-Security-Policy']
    callback({ responseHeaders: headers })
  })
}

module.exports = { setupWebRequest }