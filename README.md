# Subber

**[Italiano](README.it.md)** · [Website](https://subber.it) · [Releases](https://github.com/AndreaZero/subber/releases)

Free, local, open-source desktop app for Windows and macOS. Drop any spoken video, get a faithful transcript and an SRT ready for DaVinci Resolve. Optional translation. Nothing is uploaded.

## Why Subber

- **Free.** Not a trial, not a free tier.
- **Local.** Video stays on your computer. Works offline after the first model download.
- **Open source.** Inspect the code. No vendor lock-in.
- **Any spoken language.** Auto-detect, then output subtitles in the language you choose.
- **Built for an edit.** Contextual translation (previous + current + next line). SRT shaped for Resolve, not a social shortcut.

## Download

Installers are on [GitHub Releases](https://github.com/AndreaZero/subber/releases).

| Platform | File |
|---|---|
| Windows 10 / 11 | `.exe` / `.msi` |
| macOS (Apple Silicon and Intel) | `.dmg` |

You also need **FFmpeg** on your system (the app does not bundle it):

```bash
# Windows (reopen Subber after installing)
winget install Gyan.FFmpeg
```

```bash
# macOS
brew install ffmpeg
```

On first launch Subber prepares Python, packages, and models by itself. A dedicated GPU is optional: CPU works, GPU is faster.

## How it works

1. Drop a video.
2. The app transcribes (and translates if the output language differs).
3. You get `{name}.{lang}.txt`, `{name}.{lang}.srt`, `{name}.{output}.srt`, and `{name}.json` in a folder per video.

You can edit the transcript, keep a glossary of protected terms, and optionally burn styled captions into an exported video (up to 4K).

## Build from source

Prerequisites: **Node.js 20+**, **Rust stable**. On Windows: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) and Visual Studio Build Tools with the **Desktop C++** workload plus the **Windows 11 SDK**.

```bash
git clone https://github.com/AndreaZero/subber.git
cd subber
npm install
npm run tauri dev
```

Production installer:

```bash
npm run tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`. Build Windows installers on Windows. Build the macOS `.dmg` on a Mac.

More detail: [docs/build.md](docs/build.md). Cutting a GitHub release: [docs/release.md](docs/release.md).

## Contributing

Issues and pull requests are welcome. Keep the pipeline as:

`video → FFmpeg audio → transcribe locally → contextual translation if languages differ → SRT → export`

Do not use Whisper `task=translate` as the only output. Do not send video to a cloud API.

## License

[MIT](LICENSE)
