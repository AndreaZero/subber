# Progress

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

### Check in the running app

Reload the existing `npm run tauri dev` window:

1. Queue height stays put with 1 or 6+ files (list scrolls).
2. Run a job — progress appears under Coda, not as a top bar.
3. Video stays inside a fixed miniplayer box (portrait and landscape).
4. Audio card is separate: lyrics on cover, waveform underneath.
5. Editor column shows only the title **Editor**, then the lines.
