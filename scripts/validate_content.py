#!/usr/bin/env python3
"""
PRD Section 11 — Standalone Build-Time Content Validator
Verifies:
1. Every data/**/*.json parses as valid JSON.
2. Every file has title, subtitle, description and a non-empty questions array.
3. Every question has 2..6 options and an 'a' index within range.
4. Every catalogue file path in catalog.json resolves to a real file in assets/web/.
5. No duplicate chapter IDs exist.
"""

import json
import sys
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent.parent / "app/src/main/assets/web"


def resolve_chapter_file(base_dir: str, file_rel: str) -> Path:
    if file_rel.startswith("COMMON/"):
        return WEB_ROOT / "data" / file_rel
    if file_rel.startswith("data/"):
        return WEB_ROOT / file_rel
    clean_base = base_dir if base_dir.endswith("/") else f"{base_dir}/"
    return WEB_ROOT / f"{clean_base}{file_rel}"


def main() -> int:
    catalog_path = WEB_ROOT / "catalog.json"
    if not catalog_path.exists():
        print(f"[ERROR] Missing catalog.json at {catalog_path}", file=sys.stderr)
        return 1

    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[ERROR] Invalid JSON in catalog.json: {exc}", file=sys.stderr)
        return 1

    seen_ids = set()
    courses = catalog.get("courses", [])
    if not courses:
        print("[ERROR] catalog.json has no courses.", file=sys.stderr)
        return 1

    def check_chapter(course_id: str, base_dir: str, ch: dict):
        ch_id = ch.get("id") or f"{course_id}:{ch.get('file')}"
        if ch_id in seen_ids:
            raise ValueError(f"Duplicate chapter id in catalog.json: {ch_id}")
        seen_ids.add(ch_id)
        file_rel = ch.get("file")
        if not file_rel:
            raise ValueError(f"Chapter {ch_id} missing 'file' attribute")
        target = resolve_chapter_file(base_dir, file_rel)
        if not target.exists():
            raise ValueError(f"Catalogue entry '{ch_id}' points to missing file: {target.relative_to(WEB_ROOT)}")

    try:
        for course in courses:
            c_id = course.get("id", "unknown")
            base_dir = course.get("baseDir", "")
            for subj in course.get("subjects", []):
                for ch in subj.get("chapters", []):
                    check_chapter(c_id, base_dir, ch)
                for sec in subj.get("sections", []):
                    for ch in sec.get("chapters", []):
                        check_chapter(c_id, base_dir, ch)
    except ValueError as err:
        print(f"[ERROR] {err}", file=sys.stderr)
        return 1

    data_dir = WEB_ROOT / "data"
    json_files = sorted(data_dir.rglob("*.json"))
    if not json_files:
        print("[ERROR] No JSON files found under assets/web/data/", file=sys.stderr)
        return 1

    total_questions = 0
    for jf in json_files:
        rel = jf.relative_to(WEB_ROOT)
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[ERROR] Invalid JSON in {rel}: {exc}", file=sys.stderr)
            return 1

        for field in ("title", "subtitle", "description"):
            if not isinstance(data.get(field), str) or not data[field].strip():
                print(f"[ERROR] Missing or empty '{field}' in {rel}", file=sys.stderr)
                return 1

        questions = data.get("questions")
        if not isinstance(questions, list) or len(questions) == 0:
            print(f"[ERROR] Empty or invalid 'questions' array in {rel}", file=sys.stderr)
            return 1

        for idx, q in enumerate(questions):
            if not isinstance(q, dict) or "q" not in q:
                print(f"[ERROR] Question #{idx} missing 'q' in {rel}", file=sys.stderr)
                return 1
            opts = q.get("o")
            if not isinstance(opts, list) or not (2 <= len(opts) <= 6):
                print(f"[ERROR] Question #{idx} in {rel} must have 2..6 options", file=sys.stderr)
                return 1
            ans = q.get("a")
            if not isinstance(ans, int) or not (0 <= ans < len(opts)):
                print(f"[ERROR] Question #{idx} in {rel} has out-of-range answer index 'a'={ans}", file=sys.stderr)
                return 1
            total_questions += 1

    print(f"✓ Content validation passed: {len(courses)} tracks, {len(seen_ids)} catalog chapters, {len(json_files)} JSON files, {total_questions} verified MCQs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
