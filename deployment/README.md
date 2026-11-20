# Least-privilege MQTT deployment

Peek cannot enforce permissions on a remote broker. Provision one identity per
device and enforce read-only ACLs server-side. `mqtt-user.nix` returns a NixOS
Mosquitto user definition given a **runtime** password-file path. Attach it to the
existing listener's `users` attribute; do not create a duplicate listener.

Example (substitute your own agenix/sops secret declaration):

```nix
users.peek-laptop = import ./mqtt-user.nix {
  passwordFile = config.age.secrets.peek-laptop-mqtt-password.path;
};
```

The returned ACL permits only the events, availability and camera-audio topics.
It grants no publish permission and no access to other home automation topics.
Generate an independent random secret for each identity, encrypt it to only the
broker/device/admin recipients, and use a mode-0400 runtime secret on the device.
Do not put the raw password into a Nix expression or the public repository.

## Transport

Prefer a verified `mqtts://` listener. When the existing broker has no TLS,
forward to its **remote loopback address** using authenticated SSH instead:

```sh
ssh -N -T -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -L 127.0.0.1:18883:127.0.0.1:1883 broker-ssh-alias
```

Use an already trusted SSH host key and your normal authorized SSH identity.
Never disable host-key checking. Do not bind the local forward to 0.0.0.0.
Configure Peek's loopback MQTT endpoint as `127.0.0.1`, port `18883`, and use
that device's dedicated MQTT username/password. No MQTT firewall port needs to
be opened. The loopback exception in Peek is only safe when the remote leg is
actually encrypted. Other local processes can access a loopback port, which is
why MQTT authentication/ACLs are still required.

The tunnel may be an optional user service with on-failure restart; it need not
start automatically. Deploy the broker account before connecting the desktop.
Frigate still uses verified HTTPS independently of the MQTT tunnel.

## Acceptance checks after deployment

1. Confirm the new identity can subscribe to each of the three permitted topics.
2. Confirm it cannot subscribe to an unrelated topic or publish to any topic.
3. Confirm port 18883 listens only on loopback, and the SSH process uses strict
   host-key checking and a remote-loopback destination.
4. Confirm untrusted server certificates and non-loopback plaintext MQTT fail.
5. Test the actual desktop/compositor, Frigate authentication and camera routes.

These live checks are necessary before claiming deployment is verified; offline
application tests and Nix evaluation cannot prove remote broker ACL enforcement.
