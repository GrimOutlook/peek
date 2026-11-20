const { pathToFileURL } = require('url')

const MAX_PAYLOAD = 64 * 1024
const MAX_STATE = 256
const dangerous = new Set(['__proto__', 'prototype', 'constructor'])
const identifier = v => typeof v === 'string' && /^[a-zA-Z0-9_ .:-]{1,128}$/.test(v) && !dangerous.has(v.toLowerCase())
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = v => typeof v === 'string' && v.length <= 256

function validateConfig(cfg) {
  if (!record(cfg)) throw new Error('Invalid configuration')
  const frigate = new URL(cfg.frigateUrl)
  if (frigate.protocol !== 'https:' || frigate.username || frigate.password || frigate.search || frigate.hash || !['', '/'].includes(frigate.pathname)) {
    throw new Error('Frigate requires an HTTPS origin without URL credentials or a path')
  }
  if (cfg.frigateAllowSelfSigned) throw new Error('Certificate bypass is disabled; install a trusted CA')
  const broker = new URL(cfg.mqtt)
  const loopback = ['127.0.0.1', '[::1]'].includes(broker.hostname)
  if (broker.protocol !== 'mqtts:' && !(broker.protocol === 'mqtt:' && loopback)) {
    throw new Error('MQTT requires TLS (mqtts://), or a loopback endpoint forwarded through an encrypted tunnel')
  }
  if (broker.search || broker.hash || !['', '/'].includes(broker.pathname)) throw new Error('Invalid MQTT URL')
  if (cfg.topicPrefix !== undefined && !/^[a-zA-Z0-9_-]{1,64}$/.test(cfg.topicPrefix)) throw new Error('Invalid MQTT topic prefix')
  if (cfg.cameras !== undefined && (!record(cfg.cameras) || Object.keys(cfg.cameras).length > MAX_STATE || !Object.entries(cfg.cameras).every(([k,v]) => identifier(k) && text(v)))) throw new Error('Invalid cameras')
  return cfg
}

function validEvent(data) {
  if (!record(data) || !['new', 'update', 'end'].includes(data.type)) return false
  const a = data.after || data.before
  if (!record(a) || !identifier(a.camera) || !identifier(a.label) || !identifier(a.id)) return false
  for (const key of ['score', 'top_score']) if (a[key] !== undefined && (typeof a[key] !== 'number' || !Number.isFinite(a[key]) || a[key] < 0 || a[key] > 1)) return false
  for (const key of ['current_zones', 'entered_zones']) if (a[key] !== undefined && (!Array.isArray(a[key]) || a[key].length > 32 || !a[key].every(identifier))) return false
  if (a.box !== undefined && (!Array.isArray(a.box) || a.box.length !== 4 || !a.box.every(Number.isFinite))) return false
  if (a.sub_label != null && !(text(a.sub_label) || (Array.isArray(a.sub_label) && a.sub_label.length <= 2 && text(a.sub_label[0]) && (a.sub_label[1] === undefined || Number.isFinite(a.sub_label[1]))))) return false
  if (a.recognized_license_plate != null && !text(a.recognized_license_plate)) return false
  return true
}

class BoundedSet extends Set {
  add(value) {
    if (!this.has(value) && this.size >= MAX_STATE) this.delete(this.values().next().value)
    return super.add(value)
  }
}

function sameOriginUrl(url, base) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.username && !u.password && u.origin === new URL(base).origin
  } catch { return false }
}

function trustedSender(event, win, filename) {
  return !!win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === pathToFileURL(filename).href
}

function hardenWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', e => e.preventDefault())
  win.webContents.on('will-redirect', e => e.preventDefault())
  win.webContents.on('will-attach-webview', e => e.preventDefault())
}

module.exports = { MAX_PAYLOAD, MAX_STATE, identifier, validateConfig, validEvent, BoundedSet, sameOriginUrl, trustedSender, hardenWindow }
