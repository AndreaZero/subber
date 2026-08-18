#!/usr/bin/env python3
"""Importa SRT (e opzionalmente il video) nel Media Pool di DaVinci Resolve."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def scripting_roots() -> list[Path]:
    roots: list[Path] = []
    if sys.platform.startswith("win"):
        programdata = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
        programfiles = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        roots.append(
            Path(programdata)
            / "Blackmagic Design"
            / "DaVinci Resolve"
            / "Support"
            / "Developer"
            / "Scripting"
        )
        roots.append(
            Path(programfiles)
            / "Blackmagic Design"
            / "DaVinci Resolve"
            / "Developer"
            / "Scripting"
        )
    elif sys.platform == "darwin":
        roots.append(
            Path("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting")
        )
        roots.append(
            Path.home()
            / "Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting"
        )
    return [path for path in roots if path.is_dir()]


def resolve_lib() -> Path | None:
    if sys.platform.startswith("win"):
        programfiles = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        path = Path(programfiles) / "Blackmagic Design" / "DaVinci Resolve" / "fusionscript.dll"
        return path if path.is_file() else None
    if sys.platform == "darwin":
        path = Path(
            "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
        )
        return path if path.is_file() else None
    return None


def prepare_env() -> None:
    lib = resolve_lib()
    if lib is not None:
        os.environ.setdefault("RESOLVE_SCRIPT_LIB", str(lib))
    for root in scripting_roots():
        os.environ.setdefault("RESOLVE_SCRIPT_API", str(root))
        modules = root / "Modules"
        if modules.is_dir() and str(modules) not in sys.path:
            sys.path.insert(0, str(modules))


def connect():
    prepare_env()
    try:
        import DaVinciResolveScript as dvr  # type: ignore
    except ImportError as err:
        raise RuntimeError(
            "API di DaVinci Resolve non trovata. Installa Resolve e apri un progetto."
        ) from err
    return dvr.scriptapp("Resolve")


def launch_resolve() -> bool:
    if sys.platform.startswith("win"):
        programfiles = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        exe = Path(programfiles) / "Blackmagic Design" / "DaVinci Resolve" / "Resolve.exe"
        if exe.is_file():
            os.startfile(str(exe))  # type: ignore[attr-defined]
            return True
        return False
    if sys.platform == "darwin":
        result = subprocess.run(
            ["open", "-a", "DaVinci Resolve"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return result.returncode == 0
    return False


def fail(message: str) -> int:
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
    return 1


def import_media(resolve, paths: list[str]) -> tuple[int, bool]:
    manager = resolve.GetProjectManager()
    project = manager.GetCurrentProject() if manager else None
    if project is None:
        raise RuntimeError("Apri un progetto in DaVinci Resolve, poi riprova.")
    pool = project.GetMediaPool()
    if pool is None:
        raise RuntimeError("Media Pool non disponibile nel progetto aperto.")
    imported = pool.ImportMedia(paths) or []
    appended = False
    timeline = project.GetCurrentTimeline()
    if timeline is not None and imported:
        try:
            appended = bool(pool.AppendToTimeline(imported))
        except Exception:
            appended = False
    return len(imported), appended


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--srt", required=True)
    parser.add_argument("--video")
    args = parser.parse_args()

    srt = Path(args.srt).expanduser()
    if not srt.is_file():
        return fail(f"SRT non trovato: {srt}")

    paths = [str(srt.resolve())]
    if args.video:
        video = Path(args.video).expanduser()
        if video.is_file():
            paths.append(str(video.resolve()))

    resolve = connect()
    if resolve is None:
        launched = launch_resolve()
        if launched:
            for _ in range(8):
                time.sleep(1.2)
                resolve = connect()
                if resolve is not None:
                    break
        if resolve is None:
            if launched:
                return fail(
                    "Ho avviato DaVinci Resolve. Apri un progetto e premi di nuovo Importa."
                )
            return fail("DaVinci Resolve non è aperto. Aprilo con un progetto e riprova.")

    try:
        count, appended = import_media(resolve, paths)
    except Exception as err:
        return fail(str(err))

    if count <= 0:
        return fail("Resolve non ha importato il file. Controlla il progetto aperto e riprova.")

    if appended:
        message = f"Importati {count} elementi nella timeline corrente."
    else:
        message = f"Importati {count} elementi nel Media Pool."
    print(json.dumps({"ok": True, "message": message, "count": count}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
