# Subber

**[English](README.md)** · [Sito](https://subber.it) · [Release](https://github.com/AndreaZero/subber/releases)

App desktop gratuita, locale e open source per Windows e macOS. Trascini un video parlato, ottieni una trascrizione fedele e un SRT pronto per DaVinci Resolve. Traduzione opzionale. Nessun upload.

## Perché Subber

- **Gratis.** Non è una prova, non è un piano free.
- **In locale.** Il video resta sul computer. Dopo il primo download dei modelli funziona offline.
- **Open source.** Codice ispezionabile. Niente lock-in.
- **Qualsiasi lingua parlata.** Rilevamento automatico, sottotitoli nella lingua che scegli.
- **Per un montaggio.** Traduzione con contesto (riga prima + corrente + dopo). SRT pensato per Resolve, non per un social.

## Download

Gli installer sono su [GitHub Releases](https://github.com/AndreaZero/subber/releases).

| Piattaforma | File |
|---|---|
| Windows 10 / 11 | `.exe` / `.msi` |
| macOS (Apple Silicon e Intel) | `.dmg` |

Serve anche **FFmpeg** sul sistema (l’app non lo include):

```bash
# Windows (riapri Subber dopo l’installazione)
winget install Gyan.FFmpeg
```

```bash
# macOS
brew install ffmpeg
```

Al primo avvio Subber prepara da sola Python, i pacchetti e i modelli. Una GPU dedicata è facoltativa: gira sulla CPU, la GPU accelera.

## Come funziona

1. Trascini un video.
2. L’app trascrive (e traduce se la lingua di output è diversa).
3. Ottieni `{nome}.{lang}.txt`, `{nome}.{lang}.srt`, `{nome}.{output}.srt` e `{nome}.json` in una cartella per video.

Puoi modificare il testo, proteggere un glossario e, se serve, bruciare didascalie stilizzate in un video esportato (fino al 4K).

## Compilare dal sorgente

Prerequisiti: **Node.js 20+**, **Rust stable**. Su Windows: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) e Visual Studio Build Tools con workload **Desktop C++** e **Windows 11 SDK**.

```bash
git clone https://github.com/AndreaZero/subber.git
cd subber
npm install
npm run tauri dev
```

Installer di produzione:

```bash
npm run tauri build
```

I file escono in `src-tauri/target/release/bundle/`. L’installer Windows si genera su Windows. Il `.dmg` macOS si genera su Mac.

Dettaglio: [docs/build.it.md](docs/build.it.md). Pubblicare una release GitHub: [docs/release.it.md](docs/release.it.md).

## Contribuire

Issue e pull request sono benvenute. La pipeline resta:

`video → audio FFmpeg → trascrizione locale → traduzione contestuale se le lingue differiscono → SRT → export`

Non usare Whisper `task=translate` come unico output. Non mandare il video a un’API cloud.

## Licenza

[MIT](LICENSE)
