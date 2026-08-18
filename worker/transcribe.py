#!/usr/bin/env python3
"""Trascrizione fedele con timestamp. Mai task=translate."""

from __future__ import annotations

import argparse
import json
import logging
import math
import sys
from pathlib import Path
from typing import Optional, Tuple

from glossary import apply_to_text, parse_terms
from models import BEAMS, MODELS

logging.getLogger("faster_whisper").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)


def emit(payload: dict) -> None:
    sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stderr.flush()


def pick_device() -> Tuple[str, str]:
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


def initial_prompt(glossary: str) -> Optional[str]:
    terms = [line.strip() for line in glossary.splitlines() if line.strip()]
    if not terms:
        return None
    text = ", ".join(terms)
    return text[:800]


def transcribe_one(model, job: dict, language: str, quality: str, prompt: Optional[str], terms: list[str]) -> dict:
    audio = Path(job["audioPath"])
    output = Path(job["outputJson"])
    video_path = job["videoPath"]

    if not audio.is_file():
        raise FileNotFoundError(f"Audio non trovato: {audio}")

    emit(
        {
            "videoPath": video_path,
            "status": "transcribing",
            "message": "Trascrizione",
            "percent": 0,
        }
    )

    lang_arg = None if language in ("auto", "", "detect") else language
    kwargs = {
        "language": lang_arg,
        "task": "transcribe",
        "beam_size": BEAMS.get(quality, 5),
        "vad_filter": True,
        "condition_on_previous_text": True,
        "initial_prompt": prompt,
    }
    try:
        import inspect

        if prompt and "hotwords" in inspect.signature(model.transcribe).parameters:
            kwargs["hotwords"] = prompt
    except Exception:
        pass
    segments_iter, info = model.transcribe(str(audio), **kwargs)

    duration = float(info.duration or 0.0)
    segments = []
    for index, segment in enumerate(segments_iter):
        text = apply_to_text((segment.text or "").strip(), terms)
        if not text:
            continue
        avg = float(segment.avg_logprob)
        segments.append(
            {
                "id": index,
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "text": text,
                "avgLogProb": round(avg, 4),
                "noSpeechProb": round(float(segment.no_speech_prob), 4),
                "confidence": round(math.exp(min(avg, 0.0)), 4),
            }
        )
        percent = 99.0
        if duration > 0:
            percent = min(99.0, (float(segment.end) / duration) * 100.0)
        emit(
            {
                "videoPath": video_path,
                "status": "transcribing",
                "message": "Trascrizione",
                "percent": round(percent, 1),
            }
        )

    payload = {
        "audioPath": str(audio),
        "videoPath": video_path,
        "language": getattr(info, "language", None) or language or "und",
        "duration": round(duration, 3),
        "segments": segments,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    emit(
        {
            "videoPath": video_path,
            "status": "done",
            "message": "Trascrizione pronta",
            "percent": 100,
            "jsonPath": str(output),
            "segmentCount": len(segments),
        }
    )
    return {
        "videoPath": video_path,
        "jsonPath": str(output),
        "segmentCount": len(segments),
        "error": None,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    args = parser.parse_args()

    request_path = Path(args.batch)
    request = json.loads(request_path.read_text(encoding="utf-8"))
    language = (request.get("language") or "fr").strip() or "fr"
    quality = (request.get("quality") or "balanced").strip() or "balanced"
    glossary = request.get("glossary") or ""
    jobs = request.get("jobs") or []
    model_name = MODELS.get(quality, "small")
    terms = parse_terms(glossary)
    prompt = initial_prompt(glossary)

    if not jobs:
        print(json.dumps({"ok": False, "error": "Nessun audio da trascrivere.", "items": []}))
        return 1

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "faster-whisper non è installato. Nella cartella worker: python -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt",
                    "items": [],
                }
            )
        )
        return 2

    emit(
        {
            "videoPath": jobs[0]["videoPath"],
            "status": "transcribing",
            "message": f"Caricamento modello {model_name}",
            "percent": 0,
        }
    )

    device, compute = pick_device()
    try:
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute,
            local_files_only=True,
        )
    except Exception as err:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": (
                        f"Modello Whisper {model_name} non è in cache. "
                        "Scaricalo da Impostazioni prima di avviare il lavoro. "
                        f"({err})"
                    ),
                    "items": [],
                }
            )
        )
        return 1

    items = []
    for job in jobs:
        video_path = job.get("videoPath") or ""
        try:
            items.append(transcribe_one(model, job, language, quality, prompt, terms))
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
                    "jsonPath": None,
                    "segmentCount": 0,
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
