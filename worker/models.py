"""Nomi e repository dei modelli locali. Unico posto per Whisper e NLLB."""

from __future__ import annotations

import os

MODELS = {
    "fast": "base",
    "balanced": "small",
    "max": "large-v3",
}

BEAMS = {
    "fast": 1,
    "balanced": 5,
    "max": 5,
}

WHISPER_REPOS = {
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
    "large-v3": "Systran/faster-whisper-large-v3",
}

WHISPER_SIZE = {
    "base": "~150 MB",
    "small": "~500 MB",
    "large-v3": "~3 GB",
}

NLLB_REPO = os.environ.get(
    "VIDEO_SUB_NLLB_REPO",
    "entai2965/nllb-200-distilled-600M-ctranslate2",
)
NLLB_LOCAL = os.environ.get("VIDEO_SUB_NLLB", "").strip()
NLLB_TOKENIZER_REPO = "facebook/nllb-200-distilled-600M"
NLLB_SIZE = "~1.2 GB"


def whisper_name(quality: str) -> str:
    return MODELS.get(quality, "small")


def whisper_repo(quality: str) -> str:
    return WHISPER_REPOS[whisper_name(quality)]
