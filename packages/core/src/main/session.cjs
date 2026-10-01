const { session } = require('electron')

function setupSession() {
  const ses = session.fromPartition('persist:bilihub')
  ses.setUserAgent(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/${process.versions.chrome} Safari/537.36`)
  return ses
}

module.exports = { setupSession }