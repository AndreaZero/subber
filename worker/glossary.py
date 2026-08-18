"""Glossario: termini intoccabili in ASR e traduzione."""

from __future__ import annotations

import re
from typing import Dict, List, Sequence, Tuple

from subtitles import clean_text


def parse_terms(glossary: str) -> List[str]:
    seen = set()
    terms: List[str] = []
    for line in str(glossary or "").splitlines():
        term = line.strip()
        if len(term) < 2:
            continue
        key = term.casefold()
        if key in seen:
            continue
        seen.add(key)
        terms.append(term)
    terms.sort(key=len, reverse=True)
    return terms


def _pattern(term: str):
    escaped = re.escape(term)
    if re.fullmatch(r"[\w\-']+", term, re.UNICODE):
        return re.compile(rf"(?<!\w){escaped}(?!\w)", re.IGNORECASE | re.UNICODE)
    return re.compile(escaped, re.IGNORECASE)


def apply_to_text(text: str, terms: Sequence[str]) -> str:
    out = text or ""
    for term in terms:
        out = _pattern(term).sub(term, out)
    return out


def protect(text: str, terms: Sequence[str]) -> Tuple[str, Dict[str, str]]:
    mapping: Dict[str, str] = {}
    protected = text or ""
    for index, term in enumerate(terms):
        pattern = _pattern(term)
        if not pattern.search(protected):
            continue
        token = f"GLOSS{index:02d}"
        protected = pattern.sub(token, protected)
        mapping[token] = term
    return protected, mapping


def restore(text: str, mapping: Dict[str, str]) -> str:
    out = text or ""
    for token, term in mapping.items():
        out = re.sub(re.escape(token), term, out, flags=re.IGNORECASE)
    return clean_text(out)


def enforce(text: str, terms: Sequence[str]) -> str:
    return clean_text(apply_to_text(text, terms))
