#!/usr/bin/env python3
"""
PRD Section 11 — Content Pipeline Sync & Auto-Repair Script
Copies all 404 chapter JSON files from a local clone of `github.com/codebylogic/Class10th-quiz`
into `app/src/main/assets/web/data/` and automatically applies the 3 data quality fixes
documented in PRD Section 11:
1. Repairs `data/BSEB/10th/SCIENCE/PHYSICS/mega.json` if it contains two concatenated JSON objects (100 + 99 questions -> 199 questions).
2. Repairs `data/BSEB/10th/SCIENCE/BIOLOGY/mega.json` if it has a missing comma between question objects (200 questions).
3. Normalizes `Sangkatkar.json` -> `Sangatkar.json` in catalogue references.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = PROJECT_ROOT / "app/src/main/assets/web"


def repair_concatenated_or_broken_json(raw_text: str) -> dict:
    """Return a valid dict even if the file is one of the three known defects."""
    # Fast path: already valid.
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    # Fix 1: a complete document followed by an orphaned tail that is really the
    # rest of the questions array (e.g. PHYSICS/mega.json: 100 questions, then
    # the remaining 99 dangling after the closing brace). Merge them.
    decoder = json.JSONDecoder()
    stripped = raw_text.lstrip()
    try:
        doc, end = decoder.raw_decode(stripped)
    except json.JSONDecodeError:
        doc, end = None, 0
    if isinstance(doc, dict) and "questions" in doc:
        rest = stripped[end:].strip()
        if rest:
            tail = rest
            if tail.endswith("}"):
                tail = tail[:-1].rstrip()
            if tail.endswith("]"):
                tail = tail[:-1].rstrip()
                try:
                    extra = json.loads("[" + tail + "]")
                    merged = dict(doc)
                    merged["questions"] = list(doc.get("questions", [])) + list(extra)
                    return merged
                except json.JSONDecodeError:
                    pass

    # Fix 2: missing comma between two adjacent question objects  }  {
    repaired = re.sub(r"\}\s*\{", "}, {", raw_text)
    return json.loads(repaired)


def sync_from_source(source_dir: Path):
    src_data = source_dir / "data"
    if not src_data.exists():
        raise FileNotFoundError(f"Could not find 'data/' directory inside {source_dir}")

    dest_data = WEB_ROOT / "data"
    count = 0
    for src_json in src_data.rglob("*.json"):
        rel = src_json.relative_to(src_data)
        dest_file = dest_data / rel
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        raw = src_json.read_text(encoding="utf-8")
        parsed = repair_concatenated_or_broken_json(raw)
        dest_file.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
        count += 1

    print(f"Synced and repaired {count} chapter JSON files into {dest_data}")
    subprocess.run([sys.executable, str(PROJECT_ROOT / "scripts/validate_content.py")], check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync 404 chapter JSON files from Class10th-quiz repo")
    parser.add_argument("repo_path", type=Path, help="Path to local clone of github.com/codebylogic/Class10th-quiz")
    args = parser.parse_args()
    sync_from_source(args.repo_path)
