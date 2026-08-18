#!/usr/bin/env python3
"""Controllo e download modelli Whisper + NLLB prima del lavoro."""

from __future__ import annotations

import argparse
import inspect
import json
import os
import sys
from pathlib import Path
from typing import Optional

from models import (
    NLLB_LOCAL,
    NLLB_REPO,
    NLLB_TOKENIZER_REPO,
    whisper_name,
    whisper_repo,
)

PART = "engine"
PART_LABEL = "Motore"
PART_WEIGHT = (0.0, 100.0)


def emit(payload: dict) -> None:
    sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stderr.flush()


def result(
    quality: str,
    whisper_ready: bool,
    translate_ready: bool,
    error: Optional[str] = None,
) -> dict:
    name = whisper_name(quality)
    return {
        "ok": error is None,
        "error": error,
        "quality": quality,
        "whisperModel": name,
        "whisperRepo": whisper_repo(quality),
        "whisperReady": whisper_ready,
        "translateRepo": NLLB_REPO,
        "translateReady": translate_ready,
        "modelsReady": whisper_ready and translate_ready,
    }


def repo_ready(repo: str, local_dir: Optional[str] = None) -> bool:
    if local_dir:
        path = Path(local_dir)
        return path.is_dir() and any(path.iterdir())
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        return False
    try:
        snapshot_download(repo_id=repo, local_files_only=True)
        return True
    except Exception:
        return False


def whisper_ready(quality: str) -> bool:
    return repo_ready(whisper_repo(quality))


def translate_ready() -> bool:
    if NLLB_LOCAL:
        return repo_ready(NLLB_REPO, NLLB_LOCAL)
    return repo_ready(NLLB_REPO)


class EmitTqdm:
    """tqdm-compatible: progresso JSON, niente barra nel log."""

    def __init__(self, *args, **kwargs) -> None:
        self.n = kwargs.get("initial") or 0
        total = kwargs.get("total")
        self.total = float(total) if total else 0.0
        self.desc = kwargs.get("desc") or PART_LABEL
        self._last = -1
        iterable = args[0] if args else None
        self._iterable = iterable
        if iterable is not None and not self.total:
            try:
                self.total = float(len(iterable))
            except TypeError:
                self.total = 0.0

    def __iter__(self):
        if self._iterable is None:
            return iter(())
        for item in self._iterable:
            self.update(1)
            yield item

    def __enter__(self):
        return self

    def __exit__(self, *args) -> None:
        return None

    def update(self, n: float = 1) -> None:
        self.n = float(self.n) + float(n)
        inner = (self.n / self.total * 100.0) if self.total > 0 else 0.0
        pct = int(inner)
        if pct == self._last:
            return
        self._last = pct
        lo, hi = PART_WEIGHT
        overall = lo + (hi - lo) * min(1.0, max(0.0, inner / 100.0))
        emit(
            {
                "status": "downloading",
                "part": PART,
                "message": str(self.desc),
                "percent": round(overall, 1),
            }
        )

    def close(self) -> None:
        return None

    def reset(self, total: Optional[float] = None) -> None:
        if total is not None:
            self.total = float(total)
        self.n = 0
        self._last = -1

    def refresh(self) -> None:
        return None

    def set_postfix(self, *args, **kwargs) -> None:
        return None

    def display(self, **kwargs) -> None:
        return None

    def clear(self, **kwargs) -> None:
        return None

    def __getattr__(self, name: str):
        return lambda *args, **kwargs: None

    def set_description(self, desc: Optional[str] = None, refresh: bool = True) -> None:
        if desc:
            self.desc = desc


def snapshot(repo: str, **extra):
    from huggingface_hub import snapshot_download

    kwargs = dict(extra)
    try:
        params = inspect.signature(snapshot_download).parameters
        if "tqdm_class" in params:
            kwargs["tqdm_class"] = EmitTqdm
    except (TypeError, ValueError):
        pass
    return snapshot_download(repo_id=repo, **kwargs)


def set_part(part: str, label: str, weight: tuple[float, float]) -> None:
    global PART, PART_LABEL, PART_WEIGHT
    PART = part
    PART_LABEL = label
    PART_WEIGHT = weight


def download_whisper(quality: str) -> None:
    name = whisper_name(quality)
    repo = whisper_repo(quality)
    emit(
        {
            "status": "downloading",
            "part": "whisper",
            "message": f"Download Whisper {name}",
            "percent": PART_WEIGHT[0],
        }
    )
    snapshot(repo)
    emit(
        {
            "status": "verifying",
            "part": "whisper",
            "message": f"Whisper {name} in cache",
            "percent": PART_WEIGHT[1],
        }
    )


def download_translate() -> None:
    if NLLB_LOCAL:
        path = Path(NLLB_LOCAL)
        if not path.exists():
            raise FileNotFoundError(f"VIDEO_SUB_NLLB non valido: {path}")
        emit(
            {
                "status": "verifying",
                "part": "translate",
                "message": "Modello NLLB locale",
                "percent": 96,
            }
        )
        return
    emit(
        {
            "status": "downloading",
            "part": "translate",
            "message": "Download traduzione NLLB",
            "percent": PART_WEIGHT[0],
        }
    )
    snapshot(NLLB_REPO)
    try:
        from transformers import AutoTokenizer

        model_dir = snapshot(NLLB_REPO, local_files_only=True)
        AutoTokenizer.from_pretrained(str(model_dir))
    except Exception:
        emit(
            {
                "status": "downloading",
                "part": "translate",
                "message": "Download tokenizer NLLB",
                "percent": 90,
            }
        )
        snapshot(
            NLLB_TOKENIZER_REPO,
            allow_patterns=[
                "*.json",
                "*.model",
                "sentencepiece*",
                "tokenizer*",
                "*.txt",
            ],
        )
    emit(
        {
            "status": "verifying",
            "part": "translate",
            "message": "NLLB in cache",
            "percent": PART_WEIGHT[1],
        }
    )


def check(quality: str) -> dict:
    emit(
        {
            "status": "checking",
            "part": "engine",
            "message": "Controllo modelli",
            "percent": 0,
        }
    )
    return result(quality, whisper_ready(quality), translate_ready())


def download(quality: str, parts: str) -> dict:
    want_whisper = parts in ("all", "whisper")
    want_translate = parts in ("all", "translate")
    if want_whisper and want_translate:
        w_weight, t_weight = (4.0, 58.0), (60.0, 96.0)
    elif want_whisper:
        w_weight, t_weight = (4.0, 96.0), (60.0, 96.0)
    else:
        w_weight, t_weight = (4.0, 58.0), (4.0, 96.0)

    if want_whisper:
        if whisper_ready(quality):
            emit(
                {
                    "status": "verifying",
                    "part": "whisper",
                    "message": f"Whisper {whisper_name(quality)} già presente",
                    "percent": w_weight[1],
                }
            )
        else:
            set_part("whisper", f"Whisper {whisper_name(quality)}", w_weight)
            download_whisper(quality)

    if want_translate:
        if translate_ready():
            emit(
                {
                    "status": "verifying",
                    "part": "translate",
                    "message": "NLLB già presente",
                    "percent": t_weight[1],
                }
            )
        else:
            set_part("translate", "NLLB", t_weight)
            download_translate()

    payload = result(quality, whisper_ready(quality), translate_ready())
    emit(
        {
            "status": "done",
            "part": "engine",
            "message": "Modelli pronti" if payload["modelsReady"] else "Download incompleto",
            "percent": 100 if payload["modelsReady"] else 96,
        }
    )
    return payload


def main() -> int:
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--quality", default="balanced")
    parser.add_argument("--parts", default="all", choices=["all", "whisper", "translate"])
    args = parser.parse_args()
    quality = (args.quality or "balanced").strip() or "balanced"

    try:
        payload = check(quality) if not args.download else download(quality, args.parts)
    except Exception as err:
        emit(
            {
                "status": "error",
                "part": PART,
                "message": str(err),
                "percent": None,
            }
        )
        payload = result(quality, whisper_ready(quality), translate_ready(), str(err))
        print(json.dumps(payload, ensure_ascii=False))
        return 1

    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
