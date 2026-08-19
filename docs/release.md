# GitHub release

**[Italiano](release.it.md)**

Repo: [https://github.com/AndreaZero/subber](https://github.com/AndreaZero/subber)  
Site: [https://subber.it](https://subber.it)

## Checklist

1. Confirm `package.json` and `src-tauri/tauri.conf.json` share the same version (today: `0.1.0`).
2. On Windows: `npm run tauri build`. Attach the files from `src-tauri/target/release/bundle/` (typically NSIS `.exe` and/or `.msi`).
3. On a Mac: the same command, attach the `.dmg`.
4. Tag and publish:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then create the GitHub Release at [https://github.com/AndreaZero/subber/releases/new](https://github.com/AndreaZero/subber/releases/new) for tag `v0.1.0`. Title: **Subber 0.1.0**. Upload the installers. Paste the notes below.

Landing downloads on [subber.it](https://subber.it) already point at `https://github.com/AndreaZero/subber/releases/latest`.

## Release notes (v0.1.0)

### English

First public release of Subber: free, local, open-source subtitles for Windows and macOS.

- Transcribe any spoken video on your computer (no upload, no account)
- Optional contextual translation
- SRT ready for DaVinci Resolve
- Optional burned-in captions up to 4K
- FFmpeg must be installed separately (`winget install Gyan.FFmpeg` / `brew install ffmpeg`)

Website: https://subber.it

### Italiano

Prima release pubblica di Subber: sottotitoli gratis, in locale, open source, per Windows e macOS.

- Trascrivi qualsiasi video parlato sul computer (niente upload, niente account)
- Traduzione contestuale opzionale
- SRT pronto per DaVinci Resolve
- Didascalie bruciate opzionali fino al 4K
- FFmpeg va installato a parte (`winget install Gyan.FFmpeg` / `brew install ffmpeg`)

Sito: https://subber.it
