{
  lib,
  buildNpmPackage,
  electron_44,
  makeWrapper,
  makeDesktopItem,
  copyDesktopItems,
  src,
  npmDepsHash ? "sha256-73bn5hYIyWT8h2NQvw2H5CbOwDucgsUHWetRFugZGsY=",
}:
assert lib.assertMsg (lib.versionAtLeast electron_44.version "44.9.3") "Peek requires a patched, supported Electron (44.9.3 or newer on the 44 branch)";
buildNpmPackage {
  pname = "peek";
  version = "0.7.0-hardened";
  inherit src npmDepsHash;
  nativeBuildInputs = [ makeWrapper copyDesktopItems ];
  # Electron is supplied by Nix, never downloaded by an npm lifecycle hook.
  npmFlags = [ "--ignore-scripts" ];
  ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
  dontNpmBuild = true;
  doCheck = true;
  checkPhase = ''
    runHook preCheck
    npm test
    node --check src/main.js
    node --check src/setup/setup.js
    runHook postCheck
  '';
  installPhase = ''
    runHook preInstall
    npm prune --omit=dev --ignore-scripts --offline
    mkdir -p "$out/share/peek" "$out/share/icons/hicolor/256x256/apps" "$out/bin"
    cp -r src package.json node_modules "$out/share/peek/"
    install -Dm644 build/icon.png "$out/share/icons/hicolor/256x256/apps/peek.png"
    makeWrapper ${electron_44}/bin/electron "$out/bin/peek" \
      --run 'umask 077' \
      --add-flags "$out/share/peek" \
      --add-flags '--ozone-platform-hint=auto'
    runHook postInstall
  '';
  desktopItems = [
    (makeDesktopItem {
      name = "peek";
      desktopName = "Peek";
      comment = "Hardened Frigate camera notifications";
      exec = "peek";
      icon = "peek";
      categories = [ "Utility" ];
      terminal = false;
    })
  ];
  meta = {
    description = "Hardened desktop Frigate camera overlay";
    homepage = "https://github.com/GrimOutlook/peek";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
    mainProgram = "peek";
  };
}
