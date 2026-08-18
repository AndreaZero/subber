# Video Sub — Caravaggio

App desktop locale (Windows + macOS): interviste lunghe → trascrizione fedele → traduzione editoriale → SRT per DaVinci Resolve.

Default UI: lingua parlata **Francese** (documentario Caravaggio), sottotitoli **Italiano**. Il programma accetta qualsiasi lingua Whisper, non è vincolato al francese. I file usano il codice lingua reale: `{nome}.{lang}.txt`, `{nome}.{lang}.srt`.

## Pipeline (ordine fisso)

`video → FFmpeg audio → faster-whisper FR → traduzione FR→IT su blocchi (prev + curr + next) → formatter SRT → export`

Mai `task=translate` di Whisper come unico output. Mai tradurre l’audio diretto in italiano.

Output per video: `{nome}.{lingua}.txt`, `{nome}.{lingua}.srt` (trascrizione), poi `{nome}.{output}.srt` e `{nome}.json` dopo la traduzione.

## Stack

Tauri 2 + React + TypeScript + Rust. Worker Python (faster-whisper) dal task 3. Architettura minima.

## Task

1. **Fatto:** drag & drop video + gestione file + UI di base  
2. **Fatto:** estrazione audio FFmpeg (WAV 16 kHz mono)  
3. **Fatto:** trascrizione + timestamp (faster-whisper, `task=transcribe`, qualsiasi lingua)  
4. **Fatto:** export `{lang}.txt` / `{lang}.srt`  
5. **Fatto:** traduzione contestuale (default FR→IT, lingua output selezionabile)  
6. Formatter SRT nella lingua di output  
7. Export `{output}.srt` + `.json`  
8. Glossario (ASR + traduzione)  
9. Progress / errori  
10. Editor interno (solo dopo)

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
  - `items` out: `{ videoPath, txtPath, srtPath, language, error }`
  - File: `{stem}.{lang}.txt` (trascrizione intera) e `{stem}.{lang}.srt` (max 2 righe, ~42 caratteri)
  - Formatter: `worker/subtitles.py` (riusato in seguito per la lingua di output)
- `translate_segments(items, targetLanguage, glossary)` → `{ items[] }`
  - `items` in: `{ videoPath, jsonPath, sourceLanguage? }`
  - `items` out: `{ videoPath, trlPath, sourceLanguage, targetLanguage, segmentCount, error }`
  - Evento `translate-progress`: `videoPath`, `status` (`translating` | `done` | `error`), `message`, `percent`
  - Output: `{outputDir}/{stem}.trl.json` (stessi timestamp; `text` originale, `translated`)
  - Contesto: segmento precedente + corrente + successivo
  - Worker: `worker/translate.py` — NLLB-200 locale, mai Whisper `task=translate`
  - Lingua sorgente dal file `.asr.json` (rilevata o scelta). Se uguale all’output, copia senza tradurre
  - Il glossario resta invariato (placeholder)

Plugin UI: `@tauri-apps/plugin-dialog` (`open` file multipli, `open` cartella output).

## FFmpeg (non scaricato dall’app)

Cercato in quest’ordine:

1. variabile d’ambiente `FFMPEG_PATH`
2. `ffmpeg.exe` / `ffmpeg` accanto all’eseguibile dell’app (sidecar)
3. `PATH` di sistema

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

Worker Python (nella cartella `worker`, non eseguito dall’agente). Prima esecuzione scarica il modello Whisper:

```
cd worker
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

Prima traduzione (lingue diverse) scarica il modello NLLB (~1 GB, una tantum).

macOS:

```
cd worker
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```
