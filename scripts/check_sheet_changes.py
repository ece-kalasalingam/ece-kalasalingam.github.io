from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict, cast

import requests
from requests import HTTPError

SHEET_ID_MAP_PATH = Path("faculty_sheet_ids_json.json")
STATE_PATH = Path("data/sheet_change_state.json")
DRIVE_FILE_URL = "https://www.googleapis.com/drive/v3/files/{file_id}"


class SheetStateEntry(TypedDict):
    sheet_id: str
    modified_time: str
    checked_at: str


class SheetState(TypedDict):
    version: int
    sheets: dict[str, SheetStateEntry]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_object(value: object, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{context} must be a JSON object")
    return cast(dict[str, Any], value)


def load_sheet_mapping(path: Path) -> dict[str, str]:
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path.as_posix()}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    obj = ensure_object(raw, path.as_posix())
    mapping: dict[str, str] = {}
    for slug_raw, sheet_id_raw in obj.items():
        slug = str(slug_raw).strip()
        sheet_id = str(sheet_id_raw).strip()
        if slug and sheet_id:
            mapping[slug] = sheet_id
    if not mapping:
        raise ValueError("No valid slug -> sheet_id entries found.")
    return mapping


def load_state(path: Path) -> SheetState:
    if not path.exists():
        return {"version": 1, "sheets": {}}
    raw = json.loads(path.read_text(encoding="utf-8"))
    obj = ensure_object(raw, path.as_posix())
    sheets_raw = obj.get("sheets")
    sheets: dict[str, SheetStateEntry] = {}
    if isinstance(sheets_raw, dict):
        for slug_raw, entry_raw in sheets_raw.items():
            slug = str(slug_raw).strip()
            if not slug or not isinstance(entry_raw, dict):
                continue
            entry = cast(dict[str, Any], entry_raw)
            sheet_id = str(entry.get("sheet_id", "")).strip()
            modified_time = str(entry.get("modified_time", "")).strip()
            checked_at = str(entry.get("checked_at", "")).strip()
            if not sheet_id or not modified_time:
                continue
            sheets[slug] = {
                "sheet_id": sheet_id,
                "modified_time": modified_time,
                "checked_at": checked_at,
            }
    return {"version": 1, "sheets": sheets}


def save_state(path: Path, state: SheetState) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def fetch_modified_time(sheet_id: str, api_key: str) -> str:
    url = DRIVE_FILE_URL.format(file_id=sheet_id)
    params = {"fields": "id,modifiedTime", "key": api_key}
    response = requests.get(url, params=params, timeout=20)
    response.raise_for_status()
    payload = ensure_object(response.json(), "Drive API response")
    modified_time = str(payload.get("modifiedTime", "")).strip()
    if not modified_time:
        raise ValueError(f"modifiedTime missing for sheet_id={sheet_id}")
    return modified_time


def is_public_access_error(exc: Exception) -> bool:
    if not isinstance(exc, HTTPError):
        return False
    response = exc.response
    if response is None:
        return False
    return response.status_code in (403, 404)


def write_github_output(changed_slugs: list[str], skipped_slugs: list[str]) -> None:
    output_path = os.getenv("GITHUB_OUTPUT", "").strip()
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as handle:
        handle.write(f"changed_count={len(changed_slugs)}\n")
        handle.write(f"changed_slugs_csv={','.join(changed_slugs)}\n")
        handle.write(f"skipped_count={len(skipped_slugs)}\n")
        handle.write(f"skipped_slugs_csv={','.join(skipped_slugs)}\n")


def main() -> int:
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        print("::error::GOOGLE_API_KEY is required.")
        return 1

    try:
        mapping = load_sheet_mapping(SHEET_ID_MAP_PATH)
        state = load_state(STATE_PATH)
    except Exception as exc:
        print(f"::error::{exc}")
        return 1

    now_iso = utc_now_iso()
    previous = state.get("sheets", {})
    next_sheets: dict[str, SheetStateEntry] = {}
    changed: list[str] = []
    errors: list[str] = []
    skipped_private_or_missing: list[str] = []

    for slug in sorted(mapping.keys()):
        sheet_id = mapping[slug]
        try:
            modified_time = fetch_modified_time(sheet_id, api_key)
            prev = previous.get(slug)
            if prev is None or prev.get("sheet_id") != sheet_id or prev.get("modified_time") != modified_time:
                changed.append(slug)
            next_sheets[slug] = {
                "sheet_id": sheet_id,
                "modified_time": modified_time,
                "checked_at": now_iso,
            }
        except Exception as exc:
            if is_public_access_error(exc):
                skipped_private_or_missing.append(slug)
                print(
                    f"::notice::Skipping non-public or missing sheet for slug='{slug}' "
                    f"(public-only mode): {exc}"
                )
            else:
                errors.append(f"{slug}: {exc}")
            prev = previous.get(slug)
            if prev is not None:
                next_sheets[slug] = prev

    save_state(STATE_PATH, {"version": 1, "sheets": next_sheets})

    if changed:
        print(f"Changed sheets: {', '.join(changed)}")
    else:
        print("No sheet changes detected.")

    if skipped_private_or_missing:
        print(
            "Public-only skip list: "
            + ", ".join(sorted(skipped_private_or_missing))
        )

    write_github_output(changed, sorted(skipped_private_or_missing))

    if errors:
        for msg in errors:
            print(f"::warning::{msg}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
