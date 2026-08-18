#!/usr/bin/env python3
"""Salva correzioni dell’editor e rigenera la cartella di export."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from typing import Optional

from export_output import export_one as export_output_one
from export_source import export_one as export_source_one
from subtitles import sidecar_stem


def emit(payload: dict) -> None:
    sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stderr.flush()


def locate(sidecar: Path, data: dict) -> tuple[Path, Path, Path]:
    stem = sidecar_stem(sidecar, data)
    name = sidecar.name
    if name.endswith(".asr.json"):
        work = sidecar.parent
        return sidecar, work / f"{stem}.trl.json", work / stem / f"{stem}.json"
    if name.endswith(".trl.json"):
        work = sidecar.parent
        return work / f"{stem}.asr.json", sidecar, work / stem / f"{stem}.json"
    work = sidecar.parent.parent if sidecar.parent.name == stem else sidecar.parent
    return work / f"{stem}.asr.json", work / f"{stem}.trl.json", sidecar


def as_segment(src: dict, with_translated: bool) -> dict:
    start = src.get("start")
    end = src.get("end")
    item = {
        "start": float(start) if start is not None else 0.0,
        "end": float(end) if end is not None else 0.0,
        "text": src.get("text") or "",
    }
    if src.get("speaker") is not None:
        item["speaker"] = src.get("speaker")
    if src.get("confidence") is not None:
        item["confidence"] = src.get("confidence")
    if with_translated:
        item["translated"] = src.get("translated") or ""
    return item


def patch_list(raw: list, incoming: list, with_translated: bool) -> list:
    if not incoming:
        return []
    return [as_segment(src if isinstance(src, dict) else {}, with_translated) for src in incoming]


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: Path) -> Optional[dict]:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_one(job: dict) -> dict:
    video_path = job.get("videoPath") or ""
    sidecar = Path(job["path"])
    incoming = job.get("segments") or []
    if not sidecar.is_file():
        raise FileNotFoundError(f"File non trovato: {sidecar}")

    data = json.loads(sidecar.read_text(encoding="utf-8"))
    asr_path, trl_path, bundle_path = locate(sidecar, data)
    asr = load_json(asr_path) or {"segments": [], "videoPath": video_path}
    trl = load_json(trl_path)
    has_translation = bool(trl) or any(
        item.get("translated") for item in (data.get("segments") or [])
    )

    emit(
        {
            "videoPath": video_path,
            "status": "exporting",
            "message": "Salvataggio modifiche",
            "percent": 20,
        }
    )

    asr["segments"] = patch_list(asr.get("segments") or data.get("segments") or [], incoming, False)
    asr["videoPath"] = asr.get("videoPath") or video_path
    write_json(asr_path, asr)

    if has_translation:
        base = trl or data
        base["segments"] = patch_list(base.get("segments") or [], incoming, True)
        base["videoPath"] = base.get("videoPath") or video_path
        base["asrPath"] = str(asr_path)
        write_json(trl_path, base)
        trl = base

    folder = None
    srt_path = None
    json_path = None
    if asr_path.is_file():
        source = export_source_one({"videoPath": video_path, "jsonPath": str(asr_path)})
        folder = source.get("folderPath")
        if source.get("error"):
            raise RuntimeError(source["error"])
    if trl and trl_path.is_file():
        packed = export_output_one({"videoPath": video_path, "trlPath": str(trl_path)})
        folder = packed.get("folderPath") or folder
        srt_path = packed.get("srtPath")
        json_path = packed.get("jsonPath")
        if packed.get("error"):
            raise RuntimeError(packed["error"])

    emit(
        {
            "videoPath": video_path,
            "status": "done",
            "message": "Modifiche salvate",
            "percent": 100,
            "folderPath": folder,
            "srtPath": srt_path,
            "jsonPath": json_path,
        }
    )
    return {
        "videoPath": video_path,
        "path": str(sidecar),
        "folderPath": folder,
        "srtPath": srt_path,
        "jsonPath": json_path or (str(bundle_path) if bundle_path.is_file() else None),
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
            items.append(save_one(job))
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
                    "path": job.get("path"),
                    "folderPath": None,
                    "srtPath": None,
                    "jsonPath": None,
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
