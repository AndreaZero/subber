#!/usr/bin/env python3
"""Export trascrizione sorgente: {stem}.{lang}.txt e {stem}.{lang}.srt."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from subtitles import cues_from_segments, render_srt


def emit(payload: dict) -> None:
    sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stderr.flush()


def stem_from_json(path: Path, data: dict) -> str:
    audio = data.get("audioPath")
    if audio:
        return Path(audio).stem
    name = path.name
    if name.endswith(".asr.json"):
        return name[: -len(".asr.json")]
    return path.stem


def language_code(data: dict) -> str:
    lang = str(data.get("language") or "und").strip().lower()
    if not lang or lang in ("auto", "unknown"):
        return "und"
    return lang.replace("_", "-").split("-")[0]


def full_transcript(segments: list) -> str:
    parts = []
    for segment in segments:
        text = " ".join(str(segment.get("text") or "").split())
        if text:
            parts.append(text)
    return "\n\n".join(parts) + ("\n" if parts else "")


def export_one(job: dict) -> dict:
    video_path = job.get("videoPath") or ""
    json_path = Path(job["jsonPath"])
    if not json_path.is_file():
        raise FileNotFoundError(f"Trascrizione non trovata: {json_path}")

    data = json.loads(json_path.read_text(encoding="utf-8"))
    segments = data.get("segments") or []
    lang = language_code(data)
    stem = stem_from_json(json_path, data)
    folder = json_path.parent
    txt_path = folder / f"{stem}.{lang}.txt"
    srt_path = folder / f"{stem}.{lang}.srt"

    emit(
        {
            "videoPath": video_path,
            "status": "exporting",
            "message": "Export sottotitoli",
            "percent": 20,
        }
    )

    txt_path.write_text(full_transcript(segments), encoding="utf-8")
    srt_body = render_srt(cues_from_segments(segments))
    srt_path.write_text(srt_body, encoding="utf-8-sig")

    emit(
        {
            "videoPath": video_path,
            "status": "done",
            "message": "File di testo e SRT pronti",
            "percent": 100,
            "txtPath": str(txt_path),
            "srtPath": str(srt_path),
            "language": lang,
        }
    )
    return {
        "videoPath": video_path,
        "txtPath": str(txt_path),
        "srtPath": str(srt_path),
        "language": lang,
        "error": None,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    args = parser.parse_args()
    request = json.loads(Path(args.batch).read_text(encoding="utf-8"))
    jobs = request.get("jobs") or []
    items = []
    for job in jobs:
        video_path = job.get("videoPath") or ""
        try:
            items.append(export_one(job))
        except Exception as err:
            message = str(err)
            emit(
                {
                    "videoPath": video_path,
                    "status": "error",
                    "message": message,
                    "percent": None,
                }
            )
            items.append(
                {
                    "videoPath": video_path,
                    "txtPath": None,
                    "srtPath": None,
                    "language": None,
                    "error": message,
                }
            )
    print(json.dumps({"ok": True, "items": items}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
