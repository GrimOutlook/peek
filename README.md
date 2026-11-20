# Peek — hardened fork

Desktop Frigate camera overlays using MQTT and WebRTC. This fork prioritizes
NixOS/Linux and package-manager updates. Upstream: https://github.com/casi-3/peek.

## Security policy and intentional compatibility changes

- Supported Electron runtime; renderer sandbox and context isolation enabled.
- Frigate must be an **HTTPS origin**, without a path or embedded credentials.
  Certificates and hostnames are always verified. Install private issuing CAs in
  the system trust store; certificate bypass is not supported.
- MQTT must use `mqtts://` with verified TLS. Alternatively, `mqtt://127.0.0.1`
  or `mqtt://[::1]` is permitted for an **independently configured encrypted
  tunnel**. Peek cannot verify that a loopback forward is encrypted: the
  administrator must ensure the remote leg is SSH/WireGuard-protected.
- Use separate broker identities per desktop. Give each identity only:

  ```text
  read frigate/events
  read frigate/available
  read frigate/+/audio/+
  ```

  Adjust `frigate` if using a different topic prefix. Do not reuse the Frigate,
  Home Assistant, or administrator broker account. The broker, not Peek, must
  enforce these ACLs. Provisioning accounts and TLS is a deployment prerequisite.
- Settings are plaintext because unattended reconnection requires credentials.
  The app uses private directories and atomic owner-only JSON writes. Existing
  configuration files must be owned by the current user and mode `0600`.
  Never put credentials into the Nix store, source control, command-line arguments,
  screenshots, or issue reports. Encrypt disks/backups and use least privilege.
- No current-working-directory/repository configuration discovery. Configuration
  comes from `FRIGATE_OVERLAY_CONFIG` or Electron's user-data `config.json`.
- Self-updating and release-asset installation are removed. Update using Nix or
  your platform package manager. This fork does not consume upstream installers.
- No public STUN servers are contacted by default. The video component uses an
  empty ICE-server list; remote connections may require routing or an explicitly
  configured private relay. HTTPS protects signaling, not WebRTC peer discovery.
- Popups may show private footage during screen sharing. Choose cameras carefully
  and pause notifications when appropriate; this is not a surveillance-grade
  authenticated notification channel.

## Running from source

Use a currently supported Node.js and Electron:

```sh
npm ci --ignore-scripts
npm test
npm audit
# Electron's npm download script was intentionally not run above.
# Prefer the Nix package, or explicitly provision your trusted Electron runtime.
/path/to/electron .
```

First launch opens Settings. Select MQTT TLS (default port 8883) or a loopback
forward, and enter your HTTPS Frigate origin and dedicated credentials. A
reverse proxy with browser-only SSO is not automatically compatible with
Frigate's native `/api/login` API. Never bypass proxy authentication to fix this.

## NixOS

`package.nix` uses `buildNpmPackage` and Nixpkgs Electron rather than downloading
an npm runtime. Call it with a pinned `src` and matching `npmDepsHash`.
The launcher uses native Wayland when available, keeps Chromium's sandbox,
sets umask 077, and exposes no additional listening services. Configuration is
entered at runtime, not baked into the derivation. It does not autostart or
provision network access/credentials.

Linux tray behavior, global shortcuts and overlay placement depend on the
compositor. Under Wayland a global shortcut may require a compositor binding
and always-on-top positioning may require window rules. Do not use
`--no-sandbox` or run Peek as root to work around compatibility issues.

## Validation

`npm test` runs offline Node security regression tests. CI additionally audits
the full dependency graph, including Electron and build dependencies. These
checks do not replace GUI smoke tests on the target compositor or a security
assessment of Frigate, MQTT, camera streams, or the desktop session.

## License

MIT. Vendored go2rtc VideoRTC component retains its original license.
