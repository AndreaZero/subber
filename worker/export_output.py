#!/usr/bin/env python3
"""Export lingua di output: cartella per video con {stem}.{lang}.srt e {stem}.json."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from subtitles import (
    cues_from_segments,
    language_code,
    package_dir,
    render_srt,
    segments_for_captions,
    sidecar_stem,
)


def emit(payload: dict) -> None:
    sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stderr.flush()


def public_segments(raw: list) -> list:
    out = []
    for segment in raw:
        item = {
            "start": segment.get("start"),
            "end": segment.get("end"),
            "text": segment.get("text") or "",
            "translated": segment.get("translated") or "",
        }
        if segment.get("speaker"):
            item["speaker"] = segment["speaker"]
        if segment.get("confidence") is not None:
            item["confidence"] = segment["confidence"]
        out.append(item)
    return out


def export_one(job: dict) -> dict:
    video_path = job.get("videoPath") or ""
    trl_path = Path(job["trlPath"])
    if not trl_path.is_file():
        raise FileNotFoundError(f"Traduzione non trovata: {trl_path}")

    data = json.loads(trl_path.read_text(encoding="utf-8"))
    segments = data.get("segments") or []
    source_lang = language_code(data, "sourceLanguage", "language")
    target_lang = language_code(data, "targetLanguage")
    if target_lang == "und":
        raise ValueError("Lingua di output assente nella traduzione.")
    stem = sidecar_stem(trl_path, data)
    folder = package_dir(trl_path, stem)
    srt_path = folder / f"{stem}.{target_lang}.srt"
    json_path = folder / f"{stem}.json"

    emit(
        {
            "videoPath": video_path,
            "status": "exporting",
            "message": "Export sottotitoli tradotti",
            "percent": 30,
            "folderPath": str(folder),
        }
    )

    captions = segments_for_captions(segments, "translated")
    srt_path.write_text(render_srt(cues_from_segments(captions)), encoding="utf-8-sig")

    bundle = {
        "videoPath": data.get("videoPath") or video_path,
        "sourceLanguage": source_lang,
        "targetLanguage": target_lang,
        "segments": public_segments(segments),
    }
    json_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")

    emit(
        {
            "videoPath": video_path,
            "status": "done",
            "message": "Cartella di export pronta",
            "percent": 100,
            "folderPath": str(folder),
            "srtPath": str(srt_path),
            "jsonPath": str(json_path),
            "language": target_lang,
        }
    )
    return {
        "videoPath": video_path,
        "folderPath": str(folder),
        "srtPath": str(srt_path),
        "jsonPath": str(json_path),
        "language": target_lang,
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
                    "folderPath": None,
                    "srtPath": None,
                    "jsonPath": None,
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
