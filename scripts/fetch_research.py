from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final, TypeAlias, cast

import requests

AFFILIATION_URL: Final[str] = "https://api.elsevier.com/content/search/affiliation"
RESEARCH_QUERY: Final[str] = 'AFFIL("Electronics and Communication Engineering" AND "Kalasalingam Academy of Research and Education")'
OUTPUT_PATH: Final[Path] = Path("data/research.json")

API_KEY = os.getenv("ELSEVIER_API_KEY")
INST_TOKEN = os.getenv("ELSEVIER_INST_TOKEN")

JSONScalar: TypeAlias = None | bool | int | float | str
JSONObject: TypeAlias = dict[str, Any]
JSONArray: TypeAlias = list[Any]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def build_headers(api_key: str) -> dict[str, str]:
    headers = {
        "X-ELS-APIKey": api_key,
        "Accept": "application/json",
    }
    if INST_TOKEN and INST_TOKEN.strip():
        headers["X-ELS-Insttoken"] = INST_TOKEN.strip()
    return headers


def ensure_object(value: object, context: str) -> JSONObject:
    if not isinstance(value, dict):
        raise ValueError(f"{context} must be a JSON object")
    return cast(JSONObject, value)


def ensure_array(value: object, context: str) -> JSONArray:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a JSON array")
    return cast(JSONArray, value)


def get_str_field(obj: JSONObject, key: str, default: str = "") -> str:
    raw_value = obj.get(key)
    if isinstance(raw_value, str):
        return raw_value.strip()
    if isinstance(raw_value, (int, float, bool)):
        return str(raw_value).strip()
    return default


def parse_int(value: object, default: int = 0) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, (float, bool)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return default
    return default


def normalize_entry(item: JSONObject) -> dict[str, str]:
    return {
        "affiliation_name": get_str_field(item, "affiliation-name"),
        "affiliation_id": get_str_field(item, "dc:identifier"),
        "city": get_str_field(item, "affiliation-city"),
        "country": get_str_field(item, "affiliation-country"),
        "document_count": get_str_field(item, "document-count"),
    }


def main() -> int:
    if not API_KEY or not API_KEY.strip():
        print("::error::ELSEVIER_API_KEY is required but missing.")
        return 1

    params: dict[str, str | int] = {"query": RESEARCH_QUERY, "count": 10}
    response = requests.get(
        AFFILIATION_URL,
        headers=build_headers(API_KEY.strip()),
        params=params,
        timeout=30,
    )
    response.raise_for_status()

    raw_payload: object = response.json()
    payload = ensure_object(raw_payload, "Elsevier response")
    search_results = ensure_object(payload.get("search-results", {}), "search-results")
    entries_raw = ensure_array(search_results.get("entry", []), "search-results.entry")
    total_results = parse_int(search_results.get("opensearch:totalResults", 0), 0)

    entries: list[dict[str, str]] = []
    for item in entries_raw:
        if not isinstance(item, dict):
            continue
        entry_obj = cast(JSONObject, item)
        entries.append(normalize_entry(entry_obj))
    entries = [entry for entry in entries if entry]

    output: dict[str, JSONScalar | list[dict[str, str]]] = {
        "query": RESEARCH_QUERY,
        "total_results": total_results,
        "entries": entries,
        "last_synced_at": utc_now_iso(),
    }

    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved research data to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except requests.RequestException as exc:
        print(f"::error::Failed to fetch research data: {exc}")
        raise SystemExit(1)
