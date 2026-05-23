from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, cast

from fetch_publications import (
    ensure_object,
    fetch_photo_url_from_sheet,
    fetch_sheet_sections,
    load_sheet_id_map,
)

FACULTY_FILE = Path("faculty.json")
SHEET_MAP_FILE = Path("faculty_sheet_ids_json.json")
DATA_DIR = Path("data")


def load_faculty_slugs(path: Path) -> set[str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("faculty.json must contain a JSON array")
    slugs: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        slug = str(item.get("slug", "")).strip()
        if slug:
            slugs.add(slug)
    return slugs


def main() -> int:
    google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    faculty_slug = os.getenv("FACULTY_SLUG", "").strip()

    if not google_api_key:
        print("::error::GOOGLE_API_KEY is required.")
        return 1
    if not faculty_slug:
        print("::error::FACULTY_SLUG is required.")
        return 1

    valid_slugs = load_faculty_slugs(FACULTY_FILE)
    if faculty_slug not in valid_slugs:
        print(f"::error::Unknown FACULTY_SLUG '{faculty_slug}' in faculty.json.")
        return 1

    sheet_map = load_sheet_id_map(SHEET_MAP_FILE)
    sheet_id = sheet_map.get(faculty_slug, "").strip()
    if not sheet_id:
        print(f"::notice::No sheet mapping for slug '{faculty_slug}'. Skipping.")
        return 0

    data_path = DATA_DIR / f"{faculty_slug}.json"
    if not data_path.exists():
        print(f"::warning::Data file not found for slug '{faculty_slug}': {data_path.as_posix()}")
        return 0

    raw_data: Any = json.loads(data_path.read_text(encoding="utf-8"))
    data_obj = ensure_object(raw_data, data_path.as_posix())

    sections, warnings = fetch_sheet_sections(sheet_id, google_api_key)
    for warning in warnings:
        print(f"::warning::{faculty_slug}: {warning}")
    photo_url, photo_error = fetch_photo_url_from_sheet(sheet_id, google_api_key)
    if photo_error:
        print(f"::warning::{faculty_slug}: photo link tab issue: {photo_error}")

    data_obj["sections"] = sections
    data_obj["photo_url"] = photo_url
    data_path.write_text(json.dumps(data_obj, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated sheet sections for slug '{faculty_slug}' with {len(sections)} sections.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

