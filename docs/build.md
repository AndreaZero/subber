# Build Subber

**[Italiano](build.it.md)**

Source: [https://github.com/AndreaZero/subber](https://github.com/AndreaZero/subber)  
Site: [https://subber.it](https://subber.it)

## Prerequisites

- Node.js 20+
- Rust stable (`rustup`)
- FFmpeg on `PATH` (or `FFMPEG_PATH`)
- Windows: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/), Visual Studio Build Tools with **Desktop C++** and the **Windows 11 SDK** (`advapi32.lib` is required; without it the link fails with LNK1181)

```bash
git clone https://github.com/AndreaZero/subber.git
cd subber
npm install
npm run tauri dev
```

The app installs Python (uv + venv in app data) and downloads Whisper / translation models on first launch. Files stay in `{appData}/runtime/`.

## Production build

```bash
npm run tauri build
```

Installers are written under `src-tauri/target/release/bundle/`.

- Windows: build on Windows (NSIS `.exe` and/or `.msi`)
- macOS: build on a Mac (`.dmg`)

Do not build the macOS app from Windows.
