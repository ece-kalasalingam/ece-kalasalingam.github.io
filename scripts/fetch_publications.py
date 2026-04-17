from __future__ import annotations

import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final, TypedDict, Union, cast

if sys.version_info >= (3, 10):
    from typing import TypeAlias
else:
    from typing_extensions import TypeAlias

import requests
from requests import Response, Session
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout

SEARCH_URL: Final[str] = "https://api.elsevier.com/content/search/scopus"
API_KEY: Final[str | None] = os.getenv("ELSEVIER_API_KEY")
OUTPUT_DIR: Final[Path] = Path("data")
STATE_FILE: Final[Path] = OUTPUT_DIR / "sync_state.json"

FETCH_MODE_ENV: Final[str] = os.getenv("FETCH_MODE", "incremental").strip().lower()
BATCH_SIZE_ENV: Final[str] = os.getenv("BATCH_SIZE", "20").strip()
INCREMENTAL_YEARS_ENV: Final[str] = os.getenv("INCREMENTAL_YEARS", "2").strip()

JSONScalar: TypeAlias = Union[None, bool, int, float, str]
JSONObject: TypeAlias = dict[str, Any]
JSONArray: TypeAlias = list[Any]


class FacultyEntry(TypedDict):
    name: str
    slug: str
    author_id: str
    department: str
    designation: str


class PublicationEntry(TypedDict):
    title: str
    source: str
    date: str
    doi: str
    citations: int
    eid: str
    link: str


class FacultyOutput(TypedDict):
    name: str
    slug: str
    author_id: str
    h_index: int | None
    total_publications: int
    publications_file: str


class PublicationsFileOutput(TypedDict):
    publications: list[PublicationEntry]


class SyncState(TypedDict, total=False):
    cursor: int
    last_run_at: str
    last_mode: str
    batch_size: int
    incremental_years: int
    processed_slugs: list[str]
    faculty_status: dict[str, dict[str, str]]


def ensure_object(value: object, context: str) -> JSONObject:
    if not isinstance(value, dict):
        raise ValueError(f"{context} must be a JSON object")
    return cast(JSONObject, value)


def ensure_array(value: object, context: str) -> JSONArray:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a JSON array")
    return cast(JSONArray, value)


def get_json_object_field(obj: JSONObject, key: str, default: JSONObject | None = None) -> JSONObject:
    raw_value = obj.get(key)
    if raw_value is None:
        if default is not None:
            return default
        raise ValueError(f"Missing object field: {key}")
    if not isinstance(raw_value, dict):
        raise ValueError(f"Field '{key}' must be a JSON object")
    return cast(JSONObject, raw_value)


def get_json_array_field(obj: JSONObject, key: str, default: JSONArray | None = None) -> JSONArray:
    raw_value = obj.get(key)
    if raw_value is None:
        if default is not None:
            return default
        raise ValueError(f"Missing array field: {key}")
    if not isinstance(raw_value, list):
        raise ValueError(f"Field '{key}' must be a JSON array")
    return cast(JSONArray, raw_value)


def get_str_field(obj: JSONObject, key: str, default: str = "") -> str:
    raw_value = obj.get(key)
    if isinstance(raw_value, str):
        return raw_value
    if isinstance(raw_value, (int, float, bool)):
        return str(raw_value)
    return default


def get_int_field(obj: JSONObject, key: str, default: int = 0) -> int:
    raw_value = obj.get(key)
    if isinstance(raw_value, int):
        return raw_value
    if isinstance(raw_value, (float, bool)):
        return int(raw_value)
    if isinstance(raw_value, str):
        try:
            return int(raw_value.strip())
        except ValueError:
            return default
    return default


def parse_positive_int(raw: str, default: int) -> int:
    try:
        value = int(raw)
    except ValueError:
        return default
    if value <= 0:
        return default
    return value


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def validate_mode(mode: str) -> str:
    if mode not in ("incremental", "full"):
        return "incremental"
    return mode


def load_faculty_list(path: Path) -> list[FacultyEntry]:
    if not path.exists():
        raise FileNotFoundError(f"Required configuration file missing: {path}")

    raw_text = path.read_text(encoding="utf-8")
    raw_data: object = json.loads(raw_text)
    raw_list = ensure_array(raw_data, "faculty.json")

    faculty_list: list[FacultyEntry] = []
    for raw_item in raw_list:
        if isinstance(raw_item, dict):
            item = cast(JSONObject, raw_item)
            faculty_list.append(
                {
                    "name": get_str_field(item, "name").strip(),
                    "slug": get_str_field(item, "slug").strip(),
                    "author_id": get_str_field(item, "author_id").strip(),
                    "department": get_str_field(item, "department").strip(),
                    "designation": get_str_field(item, "designation").strip(),
                }
            )

    if not faculty_list:
        raise ValueError("faculty.json is empty or contains no valid entries.")
    return faculty_list


def load_sync_state(path: Path) -> SyncState:
    if not path.exists():
        return SyncState(cursor=0, processed_slugs=[], faculty_status={})
    raw_data: object = json.loads(path.read_text(encoding="utf-8"))
    obj = ensure_object(raw_data, "sync_state.json")
    state: SyncState = {}
    state["cursor"] = get_int_field(obj, "cursor", 0)
    processed = obj.get("processed_slugs")
    state["processed_slugs"] = [str(x) for x in processed] if isinstance(processed, list) else []
    faculty_status_raw = obj.get("faculty_status")
    if isinstance(faculty_status_raw, dict):
        normalized: dict[str, dict[str, str]] = {}
        for slug, status in faculty_status_raw.items():
            if isinstance(status, dict):
                normalized[str(slug)] = {str(k): str(v) for k, v in status.items()}
        state["faculty_status"] = normalized
    else:
        state["faculty_status"] = {}
    return state


def save_sync_state_atomic(state: SyncState, path: Path) -> None:
    path.parent.mkdir(exist_ok=True)
    temp_file = path.parent / ".sync_state.json.tmp"
    temp_file.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(temp_file, path)


def perform_request(
    session: Session,
    headers: dict[str, str],
    params: dict[str, Union[str, int]],
    author_id: str,
    url: str = SEARCH_URL,
    max_retries: int = 4,
) -> Response:
    for attempt in range(max_retries):
        try:
            response: Response = session.get(url, headers=headers, params=params, timeout=30)
            if response.status_code in (401, 403):
                raise RuntimeError(f"Auth failure ({response.status_code}) for {author_id}")
            if response.status_code == 429:
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Rate limit exceeded (429) for {author_id}")
                retry_after_raw = response.headers.get("Retry-After", "").strip()
                retry_after_seconds: float | None = None
                if retry_after_raw:
                    try:
                        retry_after_seconds = float(retry_after_raw)
                    except ValueError:
                        retry_after_seconds = None
                wait_seconds = retry_after_seconds if retry_after_seconds is not None else (2**attempt) + random.uniform(0, 0.8)
                time.sleep(max(wait_seconds, 0.5))
                continue
            if response.status_code >= 500:
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Server error ({response.status_code}) after {max_retries} attempts")
                time.sleep((2**attempt) + random.uniform(0, 0.6))
                continue
            response.raise_for_status()
            return response
        except (Timeout, RequestsConnectionError) as exc:
            if attempt == max_retries - 1:
                raise RuntimeError(f"Network failure for {author_id}") from exc
            time.sleep((2**attempt) + random.uniform(0, 0.6))
    raise RuntimeError(f"Unexpected retry failure for {author_id}")


def transform_entry(entry: JSONObject) -> PublicationEntry:
    return {
        "title": get_str_field(entry, "dc:title"),
        "source": get_str_field(entry, "prism:publicationName"),
        "date": get_str_field(entry, "prism:coverDate"),
        "doi": get_str_field(entry, "prism:doi"),
        "citations": get_int_field(entry, "citedby-count", 0),
        "eid": get_str_field(entry, "eid"),
        "link": get_str_field(entry, "prism:url"),
    }


def extract_h_index(raw_data: object) -> int | None:
    def walk(value: object) -> int | None:
        if isinstance(value, dict):
            for key in ("h-index", "h_index", "hIndex"):
                raw = value.get(key)
                if raw is not None:
                    if isinstance(raw, int):
                        return raw
                    if isinstance(raw, (float, bool)):
                        return int(raw)
                    if isinstance(raw, str):
                        try:
                            return int(raw.strip())
                        except ValueError:
                            pass
            for nested in value.values():
                found = walk(nested)
                if found is not None:
                    return found
        elif isinstance(value, list):
            for nested in value:
                found = walk(nested)
                if found is not None:
                    return found
        return None

    return walk(raw_data)


def fetch_author_h_index(author_id: str, api_key: str) -> int | None:
    headers = {"X-ELS-APIKey": api_key, "Accept": "application/json"}
    author_url = f"https://api.elsevier.com/content/author/author_id/{author_id}"
    params: dict[str, Union[str, int]] = {"view": "ENHANCED"}

    with requests.Session() as session:
        response = perform_request(session, headers, params, author_id, url=author_url)
        raw_json: object = response.json()
        return extract_h_index(raw_json)


def fetch_author_publications(
    author_id: str,
    api_key: str,
    mode: str,
    incremental_years: int,
    count: int = 25,
) -> list[PublicationEntry]:
    headers = {"X-ELS-APIKey": api_key, "Accept": "application/json"}
    query = f"AU-ID({author_id})"
    if mode == "incremental":
        cutoff_year = datetime.now(timezone.utc).year - max(incremental_years, 1)
        query = f"{query} AND PUBYEAR > {cutoff_year}"

    params: dict[str, Union[str, int]] = {
        "query": query,
        "count": count,
        "start": 0,
        "sort": "-coverDate",
    }
    results: list[PublicationEntry] = []

    with requests.Session() as session:
        while True:
            response = perform_request(session, headers, params, author_id, url=SEARCH_URL)
            raw_json: object = response.json()
            data = ensure_object(raw_json, "API response")
            search_results = get_json_object_field(data, "search-results", default={})
            entries_raw = get_json_array_field(search_results, "entry", default=[])

            if not entries_raw:
                break

            valid_found = False
            for raw_item in entries_raw:
                if isinstance(raw_item, dict):
                    results.append(transform_entry(cast(JSONObject, raw_item)))
                    valid_found = True
            if not valid_found:
                break

            items_per_page = get_int_field(search_results, "opensearch:itemsPerPage", 0)
            start_index = get_int_field(search_results, "opensearch:startIndex", 0)
            total_results = get_int_field(search_results, "opensearch:totalResults", 0)

            next_start = start_index + items_per_page
            if next_start >= total_results or items_per_page <= 0:
                break
            params["start"] = next_start

    return results


def read_publications_file(path: Path) -> list[PublicationEntry]:
    if not path.exists():
        return []
    raw_data: object = json.loads(path.read_text(encoding="utf-8"))
    obj = ensure_object(raw_data, str(path))
    pubs_raw = get_json_array_field(obj, "publications", default=[])
    pubs: list[PublicationEntry] = []
    for item in pubs_raw:
        if isinstance(item, dict):
            pubs.append(
                {
                    "title": get_str_field(cast(JSONObject, item), "title"),
                    "source": get_str_field(cast(JSONObject, item), "source"),
                    "date": get_str_field(cast(JSONObject, item), "date"),
                    "doi": get_str_field(cast(JSONObject, item), "doi"),
                    "citations": get_int_field(cast(JSONObject, item), "citations", 0),
                    "eid": get_str_field(cast(JSONObject, item), "eid"),
                    "link": get_str_field(cast(JSONObject, item), "link"),
                }
            )
    return pubs


def publication_key(pub: PublicationEntry) -> str:
    if pub["eid"]:
        return f"eid:{pub['eid']}"
    if pub["doi"]:
        return f"doi:{pub['doi'].lower()}"
    title_key = pub["title"].strip().lower()
    source_key = pub["source"].strip().lower()
    date_key = pub["date"].strip()
    return f"title:{title_key}|source:{source_key}|date:{date_key}"


def merge_publications(existing: list[PublicationEntry], incoming: list[PublicationEntry]) -> list[PublicationEntry]:
    merged: dict[str, PublicationEntry] = {}
    for pub in existing:
        merged[publication_key(pub)] = pub
    for pub in incoming:
        merged[publication_key(pub)] = pub

    def sort_key(pub: PublicationEntry) -> tuple[str, str]:
        return (pub.get("date", ""), pub.get("title", ""))

    return sorted(merged.values(), key=sort_key, reverse=True)


def write_outputs_atomic(
    outputs: dict[str, FacultyOutput],
    publication_outputs: dict[str, PublicationsFileOutput],
    output_dir: Path,
) -> None:
    output_dir.mkdir(exist_ok=True)
    publications_dir = output_dir / "publications"
    publications_dir.mkdir(exist_ok=True)
    temp_files: list[Path] = []

    try:
        for slug, data in outputs.items():
            temp_file = output_dir / f".{slug}.json.tmp"
            temp_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            temp_files.append(temp_file)

        for slug, data in publication_outputs.items():
            temp_file = publications_dir / f".{slug}.json.tmp"
            temp_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            temp_files.append(temp_file)

        for slug in outputs:
            os.replace(output_dir / f".{slug}.json.tmp", output_dir / f"{slug}.json")
        for slug in publication_outputs:
            os.replace(publications_dir / f".{slug}.json.tmp", publications_dir / f"{slug}.json")
    finally:
        for temp_file in temp_files:
            if temp_file.exists():
                temp_file.unlink()


def select_batch(
    faculty_list: list[FacultyEntry],
    batch_size: int,
    cursor: int,
    output_dir: Path,
) -> tuple[list[FacultyEntry], int]:
    if not faculty_list:
        return ([], 0)
    capped_size = min(batch_size, len(faculty_list))

    missing = [fac for fac in faculty_list if not (output_dir / f"{fac['slug']}.json").exists()]
    if missing:
        selected = missing[:capped_size]
        return (selected, cursor % len(faculty_list))

    start = cursor % len(faculty_list)
    selected: list[FacultyEntry] = []
    for i in range(capped_size):
        selected.append(faculty_list[(start + i) % len(faculty_list)])
    next_cursor = (start + capped_size) % len(faculty_list)
    return (selected, next_cursor)


def main() -> int:
    if not API_KEY or not API_KEY.strip():
        print("::error::ELSEVIER_API_KEY is required but missing.")
        return 1

    mode = validate_mode(FETCH_MODE_ENV)
    batch_size = parse_positive_int(BATCH_SIZE_ENV, 20)
    incremental_years = parse_positive_int(INCREMENTAL_YEARS_ENV, 2)

    try:
        faculty_list = load_faculty_list(Path("faculty.json"))
        sync_state = load_sync_state(STATE_FILE)
        cursor = max(sync_state.get("cursor", 0), 0)
        batch, next_cursor = select_batch(faculty_list, batch_size, cursor, OUTPUT_DIR)
        if not batch:
            print("No faculty entries available for processing.")
            return 0

        print(f"Mode: {mode}; Batch size: {batch_size}; Incremental years: {incremental_years}")
        print(f"Processing {len(batch)} faculty entries in this run.")

        collected_outputs: dict[str, FacultyOutput] = {}
        collected_publications: dict[str, PublicationsFileOutput] = {}

        for fac in batch:
            slug = fac["slug"]
            print(f"Fetching publications for {fac['name']} ({slug})...")
            h_index = fetch_author_h_index(fac["author_id"], API_KEY)
            incoming_publications = fetch_author_publications(
                fac["author_id"],
                API_KEY,
                mode=mode,
                incremental_years=incremental_years,
            )

            publications_path = OUTPUT_DIR / "publications" / f"{slug}.json"
            if mode == "incremental":
                existing_publications = read_publications_file(publications_path)
                publications = merge_publications(existing_publications, incoming_publications)
            else:
                publications = incoming_publications

            publications_file = f"publications/{slug}.json"
            collected_outputs[slug] = {
                "name": fac["name"],
                "slug": slug,
                "author_id": fac["author_id"],
                "h_index": h_index,
                "total_publications": len(publications),
                "publications_file": publications_file,
            }
            collected_publications[slug] = {"publications": publications}

        write_outputs_atomic(collected_outputs, collected_publications, OUTPUT_DIR)

        faculty_status = sync_state.get("faculty_status", {})
        processed_slugs = sync_state.get("processed_slugs", [])
        for fac in batch:
            slug = fac["slug"]
            faculty_status[slug] = {
                "last_synced_at": utc_now_iso(),
                "last_mode": mode,
            }
            if slug not in processed_slugs:
                processed_slugs.append(slug)

        new_state: SyncState = {
            "cursor": next_cursor,
            "last_run_at": utc_now_iso(),
            "last_mode": mode,
            "batch_size": batch_size,
            "incremental_years": incremental_years,
            "processed_slugs": processed_slugs,
            "faculty_status": faculty_status,
        }
        save_sync_state_atomic(new_state, STATE_FILE)
        print("Batch update completed successfully.")
        return 0
    except Exception as exc:
        print(f"::error::Workflow failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
