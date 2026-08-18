# Video Sub — Caravaggio

App desktop locale (Windows + macOS): interviste lunghe → trascrizione fedele → traduzione editoriale → SRT per DaVinci Resolve.

Default UI: lingua parlata **Francese** (documentario Caravaggio), sottotitoli **Italiano**. Il programma accetta qualsiasi lingua Whisper, non è vincolato al francese. I file usano il codice lingua reale: `{nome}.{lang}.txt`, `{nome}.{lang}.srt`.

## Pipeline (ordine fisso)

`video → FFmpeg audio → faster-whisper FR → traduzione FR→IT su blocchi (prev + curr + next) → formatter SRT → export`

Mai `task=translate` di Whisper come unico output. Mai tradurre l’audio diretto in italiano.

Output per video: cartella `{outputDir}/{stem}/` con `{nome}.{lingua}.txt`, `{nome}.{lingua}.srt`, `{nome}.{output}.srt`, `{nome}.json`.

## Stack

Tauri 2 + React + TypeScript + Rust. Worker Python (faster-whisper) dal task 3. Architettura minima.

## Task

1. **Fatto:** drag & drop video + gestione file + UI di base  
2. **Fatto:** estrazione audio FFmpeg (WAV 16 kHz mono)  
3. **Fatto:** trascrizione + timestamp (faster-whisper, `task=transcribe`, qualsiasi lingua)  
4. **Fatto:** export `{lang}.txt` / `{lang}.srt`  
5. **Fatto:** traduzione contestuale (default FR→IT, lingua output selezionabile)  
6. **Fatto:** Formatter SRT nella lingua di output  
7. **Fatto:** Export `{output}.srt` + `.json` in cartella per video  
8. **Fatto:** Glossario (ASR + traduzione)  
9. **Fatto:** Progress / errori  
10. **Fatto:** Editor interno

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
- `engine_status()` → `{ ffmpegOk, ffmpegPath, pythonOk, pythonPath, whisperOk, translateOk }`
- `export_output(items)` → `{ items[] }`
  - `items` in: `{ videoPath, trlPath }`
  - `items` out: `{ videoPath, folderPath, srtPath, jsonPath, language, error }`
  - Evento `export-output-progress`: `videoPath`, `status` (`exporting` | `done` | `error`), `message`, `percent`
  - File in `{outputDir}/{stem}/`: `{stem}.{output}.srt` e `{stem}.json`
  - JSON minimo: `start`, `end`, `text` (sorgente), `translated`, `speaker` se c’è, `confidence` se c’è
  - Formatter: `worker/subtitles.py`

- `preview_videos(videoPaths: string[])` → `{ videoPath, frames[], durationSecs }[]`
  - Estrae fino a 3 fotogrammi JPEG (anteprima) all’aggiunta del video
- `read_script(path)` → `{ sourceLanguage, targetLanguage, segments[] }`
  - Legge `.asr.json`, `.trl.json` o `{stem}.json` per mostrare testo e traduzione in app

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
