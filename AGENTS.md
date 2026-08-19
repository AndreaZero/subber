# Subber

App desktop locale (Windows + macOS): qualsiasi video parlato → trascrizione fedele → traduzione editoriale opzionale → SRT per DaVinci Resolve.

Default UI: lingua parlata **Rileva automaticamente**, sottotitoli **Italiano**. Accetta qualsiasi lingua Whisper. I file usano il codice lingua reale: `{nome}.{lang}.txt`, `{nome}.{lang}.srt`.

## Pipeline (ordine fisso)

`video → FFmpeg audio → faster-whisper (task=transcribe) → traduzione contestuale su blocchi (prev + curr + next) se le lingue differiscono → formatter SRT → export`

Mai `task=translate` di Whisper come unico output. Mai tradurre l’audio diretto in italiano.

Output per video: cartella `{outputDir}/{stem}/` con `{nome}.{lingua}.txt`, `{nome}.{lingua}.srt`, `{nome}.{output}.srt`, `{nome}.json`. In modalità video anche `{stem}.{lang}.{res}.{ext}`.

## Stack

Tauri 2 + React + TypeScript + Rust. Worker Python (faster-whisper) dal task 3. Architettura minima.

## Task

1. **Fatto:** drag & drop video + gestione file + UI di base  
2. **Fatto:** estrazione audio FFmpeg (WAV 16 kHz mono)  
3. **Fatto:** trascrizione + timestamp (faster-whisper, `task=transcribe`, qualsiasi lingua)  
4. **Fatto:** export `{lang}.txt` / `{lang}.srt`  
5. **Fatto:** traduzione contestuale (default parlato auto, sottotitoli IT, lingue selezionabili)  
6. **Fatto:** Formatter SRT nella lingua di output  
7. **Fatto:** Export `{output}.srt` + `.json` in cartella per video  
8. **Fatto:** Glossario (ASR + traduzione)  
9. **Fatto:** Progress / errori  
11. **Fatto:** Modalità prodotto SRT | video in Home  
12. **Fatto:** Overlay didascalie + griglia magnetica  
13. **Fatto:** Stile didascalie (font, colori, posizione)  
14. **Fatto:** Export video sottotitolato (FFmpeg, fino a 4K)

## Contratti invoke

- `inspect_videos(paths: string[])` → `{ videos: VideoFile[], skipped: { path, reason }[] }`
  - `VideoFile`: `path`, `name`, `sizeBytes`, `parentDir`
  - Accetta file video o una cartella (solo primo livello)
  - Estensioni: `mp4 mov mkv m4v avi webm mpg mpeg wmv`
- `extract_audio(videoPaths: string[], outputDir: string)` → `{ ffmpegPath, items[] }`
  - `items`: `videoPath`, `audioPath`, `durationSecs`, `error`
  - Evento `extract-progress`: `videoPath`, `audioPath`, `status` (`extracting` | `done` | `error`), `message`, `percent`
  - Output: `{outputDir}/{stem}.wav` — PCM 16-bit, 16 kHz, mono
  - Se il WAV esiste già ed è più recente del video, l’estrazione viene saltata
- `transcribe_audio(items, language, quality, glossary)` → `{ items[] }`
  - `items` in: `{ videoPath, audioPath }`
  - `items` out: `{ videoPath, jsonPath, segmentCount, error }`
  - Evento `transcribe-progress`: `videoPath`, `status` (`transcribing` | `done` | `error`), `message`, `percent`
  - Output: `{outputDir}/{stem}.asr.json` (segmenti con start/end/text/confidence)
  - Qualità: `fast` → base, `balanced` → small, `max` → large-v3
  - Worker: `worker/transcribe.py` (mai `task=translate`; `auto` = rilevamento lingua)
- `export_source(items)` → `{ items[] }`
  - `items` in: `{ videoPath, jsonPath }`
  - `items` out: `{ videoPath, folderPath, txtPath, srtPath, language, error }`
  - File in `{outputDir}/{stem}/`: `{stem}.{lang}.txt` (trascrizione intera) e `{stem}.{lang}.srt` (max 2 righe, ~42 caratteri)
  - Formatter: `worker/subtitles.py` (riusato per la lingua di output)
- `translate_segments(items, targetLanguage, glossary)` → `{ items[] }`
  - `items` in: `{ videoPath, jsonPath, sourceLanguage? }`
  - `items` out: `{ videoPath, trlPath, sourceLanguage, targetLanguage, segmentCount, error }`
  - Evento `translate-progress`: `videoPath`, `status` (`translating` | `done` | `error`), `message`, `percent`
  - Output: `{outputDir}/{stem}.trl.json` (stessi timestamp; `text` originale, `translated`)
  - Contesto: segmento precedente + corrente + successivo
  - Worker: `worker/translate.py` — NLLB-200 locale, mai Whisper `task=translate`
  - Lingua sorgente dal file `.asr.json` (rilevata o scelta). Se uguale all’output, copia senza tradurre
  - Glossario: placeholder in traduzione (GLOSS00…) e forma canonica ripristinata; in ASR `initial_prompt` + correzione maiuscole/minuscole
- `save_script(items)` → `{ items[] }`
  - `items` in: `{ videoPath, path, segments }`
  - Aggiorna `.asr.json` / `.trl.json` e rigenera la cartella di export
- `engine_status(quality?)` → `{ ffmpegOk, ffmpegPath, pythonOk, pythonPath, whisperOk, translateOk, whisperReady, translateReady, modelsReady, whisperModel }`
  - `whisperOk` / `translateOk`: pacchetti Python
  - `whisperReady` / `translateReady` / `modelsReady`: file modello in cache HuggingFace
- `prepare_models(quality, parts?)` → `{ whisperReady, translateReady, modelsReady, whisperModel }`
  - `parts`: `all` | `whisper` | `translate` (default `all`)
  - Evento `prepare-progress`: `status`, `part`, `message`, `percent`
  - Worker: `worker/prepare.py` — scarica Whisper (qualità scelta) e NLLB prima del lavoro
  - All’avvio l’app installa Python (uv + venv in app data) e i pacchetti, poi scarica Whisper e NLLB. Loader a schermo intero finché `modelsReady`.
- `export_output(items)` → `{ items[] }`
  - `items` in: `{ videoPath, trlPath }`
  - `items` out: `{ videoPath, folderPath, srtPath, jsonPath, language, error }`
  - Evento `export-output-progress`: `videoPath`, `status` (`exporting` | `done` | `error`), `message`, `percent`
  - File in `{outputDir}/{stem}/`: `{stem}.{output}.srt` e `{stem}.json`
  - JSON minimo: `start`, `end`, `text` (sorgente), `translated`, `speaker` se c’è, `confidence` se c’è
  - Formatter: `worker/subtitles.py`

- `preview_videos(videoPaths: string[])` → `{ videoPath, frames[], durationSecs }[]`
  - Estrae fino a 3 fotogrammi JPEG (anteprima) all’aggiunta del video. I file stanno in `{appData}/previews/`
- `open_path(path)` → `{ ok, revealed, message }`
  - Apre la cartella in Explorer/Finder, o seleziona il file
- `import_davinci(srtPath, videoPath?)` → `{ ok, revealed, message }`
  - Importa SRT (e video se c’è) nel Media Pool di DaVinci Resolve via scripting. Se Resolve non è aperto o non c’è un progetto, apre la cartella dell’SRT
- `read_script(path)` → `{ sourceLanguage, targetLanguage, segments[] }`
  - Legge `.asr.json`, `.trl.json` o `{stem}.json` per mostrare testo e traduzione in app
- `read_project(folder)` → `ProjectFile | null`
  - Legge `{folder}/video-sub.json`. `null` se il file non c’è. Errore se la cartella manca.
- `write_project(folder, project)` → `()`
  - Scrive `{folder}/video-sub.json` (crea la cartella se manca)
  - `ProjectFile`: `version`, `id`, `name`, `folder`, `createdAt`, `openedAt`, `spokenLang`, `outputLang`, `quality`, `productMode` (`srt` | `video`, default `srt`), `captionStyle`, `videos[]` (path e artefatti della coda, incluso `burnedPath` se c’è)
- `burn_video(items, format, resolution, outputDir, fit?)` → `{ items[] }`
  - `items` in: `{ videoPath, assText, language?, folderPath?, fontDir? }`
  - `items` out: `{ videoPath, outputPath, error }`
  - Evento `burn-progress`: `videoPath`, `status` (`burning` | `done` | `error`), `message`, `percent`, `outputPath`
  - Formati: `mp4` (libx264 + AAC), `mov` (stesso), `webm` (VP9 + Opus). Se manca il codec, errore esplicito
  - Risoluzioni: `source`, `1080`, `1440`, `4k`. Il lato corto è quello nominale: un video verticale a 1080p esce `1080×1920`, non `1920×1080`
  - Inquadratura `fit`: `source` (default, stessa proporzione del video), `landscape` (16:9), `portrait` (9:16), `square` (1:1). Scale + pad letterbox, niente crop
  - File in `{outputDir}/{stem}/`: `{stem}.{lang}.{res}.{ext}` (es. `intervista.it.1080p.mp4`, `clip.it.1080p-9x16.mp4`)
  - ASS dal frontend (`captionsToAss` con PlayRes del canvas di export); FFmpeg filtro `subtitles` (libass). `fontDir` per TTF/OTF caricati. Senza libass, errore chiaro, niente `drawtext`
  - `Avvia` resta la pipeline SRT. L’export video è un passo dopo l’editor
- `probe_video(videoPath)` → `{ width, height }`
  - Dimensione visibile (ruota 90/270 se il file ha metadata di rotazione)
- `list_fonts()` → `{ fonts: { family, path }[] }`
  - Font installati sul computer (Windows Fonts + user fonts; su macOS Library/Fonts)
- `inspect_font(path)` → `{ family, path }`
  - Legge il nome famiglia da un file `.ttf` / `.otf` / `.ttc` caricato dall’utente

Se lingua parlata = lingua sottotitoli (e non `auto`), la traduzione NLLB non parte e non si scarica. L’SRT sorgente vale anche per DaVinci.

## FFmpeg (non scaricato dall’app)

Cercato in quest’ordine:

1. variabile d’ambiente `FFMPEG_PATH`
2. `ffmpeg.exe` / `ffmpeg` accanto all’eseguibile dell’app (sidecar)
3. `PATH` di sistema
4. su macOS, anche se il PATH dell’app è vuoto: `/opt/homebrew/bin/ffmpeg` (Apple Silicon) e `/usr/local/bin/ffmpeg` (Intel / Homebrew classico)

Avviata come `.app` o da Cursor, l’app non eredita il PATH di Homebrew: i path fissi coprono quel caso. Non serve reinstallare FFmpeg se `brew` lo vede già.

Windows (riaprire l’app dopo l’installazione):

```
winget install Gyan.FFmpeg
```

macOS:

```
brew install ffmpeg
```

## Avvio (non eseguito dall’agente)

Prerequisiti: Node.js 20+, Rust stable. Su Windows: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/), Visual Studio Build Tools con workload **Desktop C++** e **Windows 11 SDK** (serve `advapi32.lib`; senza di esso il link fallisce con LNK1181).

```
npm install
npm run tauri dev
```

All’avvio l’app prepara da sola l’ambiente (Python, pacchetti, modelli Whisper e NLLB) e mostra un loader finché non è pronto. Non serve creare un venv da terminale. I file restano in `{appData}/runtime/`.
