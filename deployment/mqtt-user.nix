# Insert the returned value under services.mosquitto.listeners.<listener>.users
# using a unique per-device name (for example peek-laptop). passwordFile must
# point to an owner-only runtime secret, not a plaintext file in the Nix store.
{ passwordFile, topicPrefix ? "frigate" }:
assert builtins.match "[a-zA-Z0-9_-]{1,64}" topicPrefix != null;
{
  inherit passwordFile;
  acl = [
    "read ${topicPrefix}/events"
    "read ${topicPrefix}/available"
    "read ${topicPrefix}/+/audio/+"
  ];
}
