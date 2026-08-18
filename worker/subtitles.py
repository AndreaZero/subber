"""Formatter SRT per DaVinci Resolve. Riusato per la lingua originale e per la traduzione."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Sequence

MAX_CHARS = 42
MAX_LINES = 2
MIN_DURATION = 1.15
MAX_DURATION = 6.5
MAX_MERGE_GAP = 0.45


def srt_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    millis = int(round(seconds * 1000.0))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def clean_text(text: str) -> str:
    return " ".join((text or "").split())


def _break_index(text: str, limit: int) -> int:
    if len(text) <= limit:
        return len(text)
    window = text[: limit + 1]
    for sep in (". ", "? ", "! ", "; ", ": ", ", "):
        idx = window.rfind(sep)
        if idx >= max(12, limit // 2):
            return idx + 1
    idx = window.rfind(" ")
    if idx >= max(8, limit // 3):
        return idx
    if " " not in text:
        return limit
    return limit


def wrap_lines(text: str) -> List[str]:
    text = clean_text(text)
    if not text:
        return []
    if " " not in text:
        return [text[i : i + MAX_CHARS] for i in range(0, len(text), MAX_CHARS)] or [text]
    lines: List[str] = []
    remaining = text
    while remaining:
        if len(remaining) <= MAX_CHARS:
            lines.append(remaining)
            break
        at = _break_index(remaining, MAX_CHARS)
        if at <= 0:
            at = MAX_CHARS
        lines.append(remaining[:at].strip())
        remaining = remaining[at:].strip()
        if remaining == lines[-1]:
            break
    return lines


def caption_blocks(text: str) -> List[List[str]]:
    text = clean_text(text)
    if not text:
        return []
    blocks: List[List[str]] = []
    remaining = text
    while remaining:
        lines = wrap_lines(remaining)
        if len(lines) <= MAX_LINES:
            blocks.append(lines)
            break
        used = " ".join(lines[:MAX_LINES])
        blocks.append(lines[:MAX_LINES])
        leftover = remaining[len(used) :].strip()
        if leftover == remaining:
            leftover = remaining[len(lines[0]) :].strip()
        remaining = leftover
    return blocks


def merge_segments(segments: Sequence[Dict]) -> List[Dict]:
    merged: List[Dict] = []
    for raw in segments:
        text = clean_text(str(raw.get("text") or ""))
        if not text:
            continue
        start = float(raw.get("start") or 0)
        end = float(raw.get("end") or start)
        if end < start:
            end = start
        current = {"start": start, "end": end, "text": text}
        if not merged:
            merged.append(current)
            continue
        prev = merged[-1]
        gap = current["start"] - prev["end"]
        prev_dur = prev["end"] - prev["start"]
        short = len(prev["text"]) < 22 or prev_dur < MIN_DURATION
        combined = current["end"] - prev["start"]
        if short and 0 <= gap <= MAX_MERGE_GAP and combined <= MAX_DURATION:
            prev["text"] = clean_text(prev["text"] + " " + current["text"])
            prev["end"] = current["end"]
            continue
        merged.append(current)
    return merged


def cues_from_segments(segments: Sequence[Dict]) -> List[Dict]:
    cues: List[Dict] = []
    for segment in merge_segments(segments):
        start = float(segment["start"])
        end = float(segment["end"])
        if end - start < 0.4:
            end = start + 0.4
        blocks = caption_blocks(segment["text"])
        if not blocks:
            continue
        if len(blocks) == 1:
            cues.append({"start": start, "end": end, "lines": blocks[0]})
            continue
        total = sum(max(len(" ".join(block)), 1) for block in blocks)
        cursor = start
        duration = end - start
        for index, block in enumerate(blocks):
            share = max(len(" ".join(block)), 1) / total
            stop = end if index == len(blocks) - 1 else cursor + duration * share
            if stop <= cursor:
                stop = cursor + 0.4
            cues.append({"start": cursor, "end": stop, "lines": block})
            cursor = stop
    return cues


def render_srt(cues: Sequence[Dict]) -> str:
    chunks = []
    for index, cue in enumerate(cues, start=1):
        lines = [line for line in cue.get("lines") or [] if line]
        if not lines:
            continue
        chunks.append(
            f"{index}\n{srt_timestamp(float(cue['start']))} --> {srt_timestamp(float(cue['end']))}\n"
            + "\n".join(lines)
        )
    return "\n\n".join(chunks) + ("\n" if chunks else "")


def language_code(data: dict, *keys: str) -> str:
    for key in keys or ("language",):
        lang = str(data.get(key) or "").strip().lower()
        if lang and lang not in ("auto", "unknown"):
            return lang.replace("_", "-").split("-")[0]
    return "und"


def sidecar_stem(path: Path, data: dict) -> str:
    audio = data.get("audioPath")
    if audio:
        return Path(str(audio)).stem
    name = path.name
    for suffix in (".asr.json", ".trl.json"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return path.stem


def package_dir(sidecar_path: Path, stem: str) -> Path:
    folder = sidecar_path.parent / stem
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def segments_for_captions(segments: Sequence[Dict], text_key: str = "text") -> List[Dict]:
    out: List[Dict] = []
    for raw in segments:
        out.append(
            {
                "start": raw.get("start"),
                "end": raw.get("end"),
                "text": raw.get(text_key) or "",
            }
        )
    return out
