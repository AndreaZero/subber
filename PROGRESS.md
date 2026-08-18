# Progress

## Progetti (2026-08-18)

Dopo il boot, l’app apre una pagina progetti: recenti, crea (nome + cartella), apri cartella.

La cartella del progetto è l’`outputDir` della pipeline. Lo stato (lingue, qualità, coda video) sta in `{folder}/video-sub.json`. I recenti stanno in localStorage.

### Check in the running app

Ricarica `npm run tauri dev`:

1. Dopo i modelli, compare la schermata Progetti, non lo studio.
2. Crea un progetto (nome + cartella) e verifica che si apra lo studio.
3. Aggiungi un video, torna a Progetti, riapri: la coda c’è ancora.
4. “Cambia progetto” in sidebar torna alla schermata iniziale.

## Studio UI/UX redesign (2026-08-18)

Studio Home is two columns: miniplayer + Spotify-style audio on the left, Editor on the right.

### Information architecture

- **Sidebar:** Nav on top. **Coda** has a fixed height and internal scroll. The job **progress meter** sits under the queue (filename, %, bar, elapsed, Stop).
- **Topbar:** Spoken language → subtitles, quality, **Avvia**.
- **Home left:** Fixed-size video miniplayer (same box for landscape and portrait, `contain`) + controls. Separate **audio cover** under it: lyrics on the cover (karaoke highlight), then play + waveform visualizer.
- **Home right:** Editor — title only, then the segment list.
- **Lavori:** Full job cards; sidebar queue stays visible.

### Presentation only

Invoke contracts and pipeline workers were not changed. UI pieces: `QueueWidget`, `RunMeter`, `MonitorPanel`, `AudioCover`, `WaveformTrack`, `TranscriptEditor`, `JobsView`.
