const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function readPrivateJson(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try {
    const stat = fs.fstatSync(fd)
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Invalid configuration file')
    if (process.platform !== 'win32' && (stat.uid !== process.getuid() || (stat.mode & 0o077))) throw new Error('Configuration must be owned by you and mode 0600')
    return JSON.parse(fs.readFileSync(fd, 'utf8'))
  } finally { fs.closeSync(fd) }
}

function writePrivateJson(file, data) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const stat = fs.lstatSync(dir)
  if (!stat.isDirectory() || (process.platform !== 'win32' && stat.uid !== process.getuid())) throw new Error('Unsafe configuration directory')
  fs.chmodSync(dir, 0o700)
  const tmp = path.join(dir, '.' + path.basename(file) + '-' + crypto.randomUUID())
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' })
    fs.renameSync(tmp, file)
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) }
}
module.exports = { readPrivateJson, writePrivateJson }
