# Compilare Subber

**[English](build.md)**

Sorgente: [https://github.com/AndreaZero/subber](https://github.com/AndreaZero/subber)  
Sito: [https://subber.it](https://subber.it)

## Prerequisiti

- Node.js 20+
- Rust stable (`rustup`)
- FFmpeg nel `PATH` (o `FFMPEG_PATH`)
- Windows: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/), Visual Studio Build Tools con workload **Desktop C++** e **Windows 11 SDK** (serve `advapi32.lib`; senza di esso il link fallisce con LNK1181)

```bash
git clone https://github.com/AndreaZero/subber.git
cd subber
npm install
npm run tauri dev
```

All’avvio l’app installa Python (uv + venv in app data) e scarica i modelli Whisper / traduzione. I file restano in `{appData}/runtime/`.

## Build di produzione

```bash
npm run tauri build
```

Gli installer escono in `src-tauri/target/release/bundle/`.

- Windows: compilare su Windows (NSIS `.exe` e/o `.msi`)
- macOS: compilare su Mac (`.dmg`)

Non compilare l’app macOS da Windows.
