const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const s = require('../src/security')
const { readPrivateJson, writePrivateJson } = require('../src/private-json')
const config = () => ({ frigateUrl: 'https://video.example.test', mqtt: 'mqtts://peek:password@broker.example.test:8883', topicPrefix: 'frigate' })

test('require verified HTTPS and encrypted MQTT', () => {
  assert.equal(s.validateConfig(config()).topicPrefix, 'frigate')
  for (const changes of [
    { frigateUrl: 'http://video.example.test' }, { frigateAllowSelfSigned: true },
    { mqtt: 'mqtt://broker.example.test' }, { mqtt: 'ws://broker.example.test' },
    { frigateUrl: 'https://user:password@video.example.test' },
    { frigateUrl: 'https://video.example.test/path' }, { topicPrefix: 'frigate/#' },
    { cameras: JSON.parse('{"__proto__":"bad"}') }
  ]) assert.throws(() => s.validateConfig({ ...config(), ...changes }))
  assert.doesNotThrow(() => s.validateConfig({ ...config(), mqtt: 'mqtt://127.0.0.1:18883' }))
  assert.doesNotThrow(() => s.validateConfig({ ...config(), mqtt: 'mqtt://[::1]:18883' }))
})

test('reject malformed events without throwing', () => {
  const good = { type: 'new', after: { id: '123.4-abc', camera: 'front-door', label: 'person', score: 0.9, current_zones: ['driveway'] } }
  assert.equal(s.validEvent(good), true)
  for (const bad of [null, [], 42, {}, { ...good, type: 'invalid' }, { ...good, after: null }]) assert.equal(s.validEvent(bad), false)
  for (const changes of [{ camera: '__proto__' }, { label: {} }, { id: 'x'.repeat(129) }, { score: NaN }, { box: [0, 1] }, { current_zones: {} }, { sub_label: {} }, { recognized_license_plate: {} }]) assert.equal(s.validEvent({ ...good, after: { ...good.after, ...changes } }), false)
})

test('bounded event state', () => {
  const set = new s.BoundedSet()
  for (let i = 0; i < 10000; i++) set.add(i)
  assert.equal(set.size, s.MAX_STATE)
  assert.equal(set.has(9999), true)
})

test('external URLs compare origins, not prefixes', () => {
  const base = 'https://video.example.test'
  assert.equal(s.sameOriginUrl(base + '/explore?event_id=1', base), true)
  for (const url of [base + '.evil.test/', 'https://video.example.test@evil.test/', 'http://video.example.test/', 'javascript:alert(1)', base + ':8443/']) assert.equal(s.sameOriginUrl(url, base), false)
})

test('IPC accepts only expected window main frame and exact local URL', () => {
  const frame = { url: pathToFileURL('/app/setup.html').href }
  const wc = { mainFrame: frame }
  const win = { isDestroyed: () => false, webContents: wc }
  assert.equal(s.trustedSender({ sender: wc, senderFrame: frame }, win, '/app/setup.html'), true)
  assert.equal(s.trustedSender({ sender: wc, senderFrame: { ...frame } }, win, '/app/setup.html'), false)
  assert.equal(s.trustedSender({ sender: {}, senderFrame: frame }, win, '/app/setup.html'), false)
  frame.url = 'https://evil.test/'
  assert.equal(s.trustedSender({ sender: wc, senderFrame: frame }, win, '/app/setup.html'), false)
})

test('private atomic persistence fixes existing permissions and rejects symlinks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'peek-test-'))
  try {
    const file = path.join(root, 'private', 'config.json')
    writePrivateJson(file, { password: 'test' })
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700)
    assert.deepEqual(readPrivateJson(file), { password: 'test' })
    fs.chmodSync(file, 0o644)
    assert.throws(() => readPrivateJson(file))
    writePrivateJson(file, { replaced: true })
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    const link = path.join(root, 'link')
    fs.symlinkSync(file, link)
    assert.throws(() => readPrivateJson(link))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('security invariants remain enabled in application source', () => {
  const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8')
  assert.ok(main.includes('sandbox: true'))
  assert.ok(main.includes('security.validEvent(data)'))
  assert.ok(main.includes('payload.length > security.MAX_PAYLOAD'))
  assert.ok(!main.includes('setCertificateVerifyProc'))
  assert.ok(!main.includes('spawn('))
  assert.ok(!main.includes('installMacUpdate'))
  const video = fs.readFileSync(path.join(__dirname, '../src/renderer/vendor/video-rtc.js'), 'utf8')
  assert.ok(video.includes('iceServers: []'))
  assert.ok(!video.includes('stun:stun.'))
})
