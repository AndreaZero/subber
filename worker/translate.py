#!/usr/bin/env python3
"""Traduzione contestuale su blocchi (prev + curr + next). Mai Whisper task=translate."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from glossary import enforce, parse_terms, protect, restore
from models import NLLB_LOCAL, NLLB_REPO
from subtitles import clean_text

MAX_BATCH = 8
MAX_CHARS = 900

# Whisper ISO-639 → Flores-200 (NLLB).
FLORES = {
    "af": "afr_Latn",
    "am": "amh_Ethi",
    "ar": "arb_Arab",
    "as": "asm_Beng",
    "az": "azj_Latn",
    "ba": "bak_Cyrl",
    "be": "bel_Cyrl",
    "bg": "bul_Cyrl",
    "bn": "ben_Beng",
    "bo": "bod_Tibt",
    "br": "bre_Latn",
    "bs": "bos_Latn",
    "ca": "cat_Latn",
    "cs": "ces_Latn",
    "cy": "cym_Latn",
    "da": "dan_Latn",
    "de": "deu_Latn",
    "el": "ell_Grek",
    "en": "eng_Latn",
    "es": "spa_Latn",
    "et": "est_Latn",
    "eu": "eus_Latn",
    "fa": "pes_Arab",
    "fi": "fin_Latn",
    "fo": "fao_Latn",
    "fr": "fra_Latn",
    "gl": "glg_Latn",
    "gu": "guj_Gujr",
    "ha": "hau_Latn",
    "he": "heb_Hebr",
    "hi": "hin_Deva",
    "hr": "hrv_Latn",
    "ht": "hat_Latn",
    "hu": "hun_Latn",
    "hy": "hye_Armn",
    "id": "ind_Latn",
    "is": "isl_Latn",
    "it": "ita_Latn",
    "ja": "jpn_Jpan",
    "jw": "jav_Latn",
    "jv": "jav_Latn",
    "ka": "kat_Geor",
    "kk": "kaz_Cyrl",
    "km": "khm_Khmr",
    "kn": "kan_Knda",
    "ko": "kor_Hang",
    "la": "lat_Latn",
    "lb": "ltz_Latn",
    "ln": "lin_Latn",
    "lo": "lao_Laoo",
    "lt": "lit_Latn",
    "lv": "lvs_Latn",
    "mg": "plt_Latn",
    "mi": "mri_Latn",
    "mk": "mkd_Cyrl",
    "ml": "mal_Mlym",
    "mn": "khk_Cyrl",
    "mr": "mar_Deva",
    "ms": "zsm_Latn",
    "mt": "mlt_Latn",
    "my": "mya_Mymr",
    "nb": "nob_Latn",
    "ne": "npi_Deva",
    "nl": "nld_Latn",
    "nn": "nno_Latn",
    "no": "nob_Latn",
    "oc": "oci_Latn",
    "pa": "pan_Guru",
    "pl": "pol_Latn",
    "ps": "pbt_Arab",
    "pt": "por_Latn",
    "ro": "ron_Latn",
    "ru": "rus_Cyrl",
    "sa": "san_Deva",
    "sd": "snd_Arab",
    "si": "sin_Sinh",
    "sk": "slk_Latn",
    "sl": "slv_Latn",
    "sn": "sna_Latn",
    "so": "som_Latn",
    "sq": "als_Latn",
    "sr": "srp_Cyrl",
    "su": "sun_Latn",
    "sv": "swe_Latn",
    "sw": "swh_Latn",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "tg": "tgk_Cyrl",
    "th": "tha_Thai",
    "tk": "tuk_Latn",
    "tl": "tgl_Latn",
    "tr": "tur_Latn",
    "tt": "tat_Cyrl",
    "uk": "ukr_Cyrl",
    "ur": "urd_Arab",
    "uz": "uzn_Latn",
    "vi": "vie_Latn",
    "yi": "ydd_Hebr",
    "yo": "yor_Latn",
    "yue": "yue_Hant",
    "zh": "zho_Hans",
}

C_LINE = re.compile(r"(?im)^C:\s*(.+)$")


def emit(payload: dict) -> None:
    sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stderr.flush()


def iso_code(raw: str) -> str:
    lang = str(raw or "").strip().lower().replace("_", "-")
    if not lang or lang in ("auto", "unknown", "und"):
        return ""
    return lang.split("-")[0]


def flores_code(lang: str) -> str:
    code = iso_code(lang)
    flores = FLORES.get(code)
    if not flores:
        raise ValueError(
            f"Lingua non supportata dalla traduzione: {lang or 'sconosciuta'}."
        )
    return flores


def pack_block(prev: str, curr: str, nxt: str) -> str:
    parts = []
    if prev:
        parts.append(f"P: {prev}")
    parts.append(f"C: {curr}")
    if nxt:
        parts.append(f"N: {nxt}")
    return "\n".join(parts)


def extract_current(translated: str, had_context: bool) -> Optional[str]:
    text = (translated or "").strip()
    if not text:
        return None
    match = C_LINE.search(text)
    if match:
        return clean_text(match.group(1))
    if not had_context:
        stripped = re.sub(r"(?i)^C:\s*", "", text).strip()
        return clean_text(stripped) or None
    return None


def stem_from_json(path: Path, data: dict) -> str:
    audio = data.get("audioPath")
    if audio:
        return Path(audio).stem
    name = path.name
    if name.endswith(".asr.json"):
        return name[: -len(".asr.json")]
    return path.stem


def pick_device() -> Tuple[str, str]:
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "int8_float16"
    except Exception:
        pass
    return "cpu", "int8"


class NllbEngine:
    def __init__(self, video_path: str) -> None:
        emit(
            {
                "videoPath": video_path,
                "status": "translating",
                "message": "Caricamento modello di traduzione",
                "percent": 0,
            }
        )
        try:
            import ctranslate2
            from huggingface_hub import snapshot_download
            from transformers import AutoTokenizer
        except ImportError as err:
            raise RuntimeError(
                "Traduzione: installa transformers e sentencepiece. "
                "Nella cartella worker: .venv\\Scripts\\python.exe -m pip install -r requirements.txt"
            ) from err

        if NLLB_LOCAL:
            model_dir = Path(NLLB_LOCAL)
            if not model_dir.exists():
                raise FileNotFoundError(f"VIDEO_SUB_NLLB non valido: {model_dir}")
        else:
            try:
                model_dir = Path(snapshot_download(NLLB_REPO, local_files_only=True))
            except Exception as err:
                raise RuntimeError(
                    "Modello di traduzione NLLB non è in cache. "
                    "Scaricalo da Impostazioni prima di avviare il lavoro."
                ) from err

        device, compute = pick_device()
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
        except Exception:
            self.tokenizer = AutoTokenizer.from_pretrained(
                "facebook/nllb-200-distilled-600M"
            )
        self.translator = ctranslate2.Translator(
            str(model_dir),
            device=device,
            compute_type=compute,
        )

    def translate_many(self, src_lang: str, tgt_lang: str, texts: Sequence[str]) -> List[str]:
        src = flores_code(src_lang)
        tgt = flores_code(tgt_lang)
        self.tokenizer.src_lang = src
        tokenized = []
        for text in texts:
            ids = self.tokenizer.encode(text)
            tokenized.append(self.tokenizer.convert_ids_to_tokens(ids))
        results = self.translator.translate_batch(
            tokenized,
            target_prefix=[[tgt]] * len(tokenized),
            beam_size=4,
            max_decoding_length=512,
        )
        out = []
        for result in results:
            hyp = result.hypotheses[0] if result.hypotheses else []
            if hyp and hyp[0] == tgt:
                hyp = hyp[1:]
            out.append(
                self.tokenizer.decode(
                    self.tokenizer.convert_tokens_to_ids(hyp),
                    skip_special_tokens=True,
                ).strip()
            )
        return out


def neighbor(segments: Sequence[dict], index: int, offset: int) -> str:
    pos = index + offset
    if pos < 0 or pos >= len(segments):
        return ""
    return clean_text(str(segments[pos].get("text") or ""))


def translate_segments(
    engine: NllbEngine,
    source_lang: str,
    target_lang: str,
    segments: Sequence[dict],
    terms: Sequence[str],
    video_path: str,
) -> List[str]:
    packed: List[str] = []
    maps: List[Dict[str, str]] = []
    flags: List[bool] = []
    plains: List[str] = []

    for index, segment in enumerate(segments):
        curr = clean_text(str(segment.get("text") or ""))
        if not curr:
            packed.append("")
            maps.append({})
            flags.append(False)
            plains.append("")
            continue
        prev = neighbor(segments, index, -1)
        nxt = neighbor(segments, index, 1)
        curr_p, mapping = protect(curr, terms)
        prev_p, prev_map = protect(prev, terms)
        nxt_p, nxt_map = protect(nxt, terms)
        mapping.update(prev_map)
        mapping.update(nxt_map)
        had_context = bool(prev or nxt)
        block = pack_block(prev_p, curr_p, nxt_p) if had_context else curr_p
        if len(block) > MAX_CHARS:
            block = curr_p
            had_context = False
        packed.append(block)
        maps.append(mapping)
        flags.append(had_context)
        plains.append(curr_p)

    translated = [""] * len(packed)
    work_idx = [index for index, text in enumerate(packed) if text]
    total = max(len(work_idx), 1)
    done = 0
    for start in range(0, len(work_idx), MAX_BATCH):
        batch_idx = work_idx[start : start + MAX_BATCH]
        chunk = [packed[index] for index in batch_idx]
        outputs = engine.translate_many(source_lang, target_lang, chunk)
        for index, text in zip(batch_idx, outputs):
            translated[index] = text
        done += len(chunk)
        emit(
            {
                "videoPath": video_path,
                "status": "translating",
                "message": "Traduzione",
                "percent": round(min(99.0, done / total * 100.0), 1),
            }
        )

    retry_idx = []
    retry_text = []
    outputs: List[str] = [""] * len(packed)
    for index, raw in enumerate(translated):
        extracted = extract_current(raw, flags[index])
        if extracted:
            outputs[index] = enforce(restore(extracted, maps[index]), terms)
        elif not plains[index]:
            outputs[index] = ""
        else:
            retry_idx.append(index)
            retry_text.append(plains[index])

    if retry_text:
        retried = engine.translate_many(source_lang, target_lang, retry_text)
        for index, raw in zip(retry_idx, retried):
            outputs[index] = enforce(restore(extract_current(raw, False) or raw, maps[index]), terms)

    return outputs


def copy_segments(segments: Sequence[dict], terms: Sequence[str]) -> List[str]:
    return [enforce(clean_text(str(segment.get("text") or "")), terms) for segment in segments]


def translate_one(job: dict, target_lang: str, terms: Sequence[str], engine: Optional[NllbEngine]) -> Tuple[dict, Optional[NllbEngine]]:
    video_path = job.get("videoPath") or ""
    json_path = Path(job["jsonPath"])
    if not json_path.is_file():
        raise FileNotFoundError(f"Trascrizione non trovata: {json_path}")

    data = json.loads(json_path.read_text(encoding="utf-8"))
    segments = data.get("segments") or []
    source_lang = iso_code(data.get("language") or "") or iso_code(
        job.get("sourceLanguage") or ""
    )
    if not source_lang:
        raise ValueError("Lingua sorgente assente nella trascrizione.")
    target_lang = iso_code(target_lang)
    if not target_lang:
        raise ValueError("Lingua di output non valida.")

    stem = stem_from_json(json_path, data)
    trl_path = json_path.parent / f"{stem}.trl.json"

    emit(
        {
            "videoPath": video_path,
            "status": "translating",
            "message": "Traduzione",
            "percent": 1,
        }
    )

    same_lang = source_lang == target_lang
    if (
        trl_path.is_file()
        and trl_path.stat().st_mtime >= json_path.stat().st_mtime
    ):
        existing = json.loads(trl_path.read_text(encoding="utf-8"))
        if existing.get("targetLanguage") == target_lang and existing.get("sourceLanguage") == source_lang:
            emit(
                {
                    "videoPath": video_path,
                    "status": "done",
                    "message": "Traduzione già presente",
                    "percent": 100,
                    "trlPath": str(trl_path),
                    "sourceLanguage": source_lang,
                    "targetLanguage": target_lang,
                    "segmentCount": len(existing.get("segments") or []),
                }
            )
            return (
                {
                    "videoPath": video_path,
                    "trlPath": str(trl_path),
                    "sourceLanguage": source_lang,
                    "targetLanguage": target_lang,
                    "segmentCount": len(existing.get("segments") or []),
                    "error": None,
                },
                engine,
            )

    if same_lang:
        texts = copy_segments(segments, terms)
    else:
        flores_code(source_lang)
        flores_code(target_lang)
        if engine is None:
            engine = NllbEngine(video_path)
        texts = translate_segments(
            engine, source_lang, target_lang, segments, terms, video_path
        )

    out_segments = []
    for segment, translated in zip(segments, texts):
        item = {
            "id": segment.get("id"),
            "start": segment.get("start"),
            "end": segment.get("end"),
            "text": segment.get("text") or "",
            "translated": translated,
        }
        if segment.get("speaker"):
            item["speaker"] = segment["speaker"]
        if segment.get("confidence") is not None:
            item["confidence"] = segment["confidence"]
        out_segments.append(item)

    payload = {
        "audioPath": data.get("audioPath"),
        "videoPath": data.get("videoPath") or video_path,
        "asrPath": str(json_path),
        "sourceLanguage": source_lang,
        "targetLanguage": target_lang,
        "model": "copy" if same_lang else "nllb-200-distilled-600M",
        "segments": out_segments,
    }
    trl_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    emit(
        {
            "videoPath": video_path,
            "status": "done",
            "message": "Traduzione pronta",
            "percent": 100,
            "trlPath": str(trl_path),
            "sourceLanguage": source_lang,
            "targetLanguage": target_lang,
            "segmentCount": len(out_segments),
        }
    )
    return (
        {
            "videoPath": video_path,
            "trlPath": str(trl_path),
            "sourceLanguage": source_lang,
            "targetLanguage": target_lang,
            "segmentCount": len(out_segments),
            "error": None,
        },
        engine,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    args = parser.parse_args()
    request = json.loads(Path(args.batch).read_text(encoding="utf-8"))
    jobs = request.get("jobs") or []
    target_lang = request.get("targetLanguage") or "it"
    terms = parse_terms(request.get("glossary") or "")
    if not jobs:
        print(json.dumps({"ok": False, "error": "Nessuna trascrizione da tradurre.", "items": []}))
        return 1

    items = []
    engine: Optional[NllbEngine] = None
    for job in jobs:
        video_path = job.get("videoPath") or ""
        try:
            item, engine = translate_one(job, target_lang, terms, engine)
            items.append(item)
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
                    "trlPath": None,
                    "sourceLanguage": None,
                    "targetLanguage": iso_code(target_lang) or None,
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
