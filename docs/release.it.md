# Release GitHub

**[English](release.md)**

Repo: [https://github.com/AndreaZero/subber](https://github.com/AndreaZero/subber)  
Sito: [https://subber.it](https://subber.it)

## Checklist

1. Controlla che `package.json` e `src-tauri/tauri.conf.json` abbiano la stessa versione (oggi: `0.1.0`).
2. Su Windows: `npm run tauri build`. Allega i file in `src-tauri/target/release/bundle/` (di solito NSIS `.exe` e/o `.msi`).
3. Su Mac: lo stesso comando, allega il `.dmg`.
4. Tag e pubblicazione:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Poi crea la GitHub Release su [https://github.com/AndreaZero/subber/releases/new](https://github.com/AndreaZero/subber/releases/new) per il tag `v0.1.0`. Titolo: **Subber 0.1.0**. Carica gli installer. Incolla le note sotto.

I download su [subber.it](https://subber.it) puntano già a `https://github.com/AndreaZero/subber/releases/latest`.

## Note di release (v0.1.0)

### Italiano

Prima release pubblica di Subber: sottotitoli gratis, in locale, open source, per Windows e macOS.

- Trascrivi qualsiasi video parlato sul computer (niente upload, niente account)
- Traduzione contestuale opzionale
- SRT pronto per DaVinci Resolve
- Didascalie bruciate opzionali fino al 4K
- FFmpeg va installato a parte (`winget install Gyan.FFmpeg` / `brew install ffmpeg`)

Sito: https://subber.it

### English

First public release of Subber: free, local, open-source subtitles for Windows and macOS.

- Transcribe any spoken video on your computer (no upload, no account)
- Optional contextual translation
- SRT ready for DaVinci Resolve
- Optional burned-in captions up to 4K
- FFmpeg must be installed separately (`winget install Gyan.FFmpeg` / `brew install ffmpeg`)

Website: https://subber.it
