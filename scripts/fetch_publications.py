from __future__ import annotations

import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final, TypedDict, Union, cast
from urllib.parse import quote

if sys.version_info >= (3, 10):
    from typing import TypeAlias
else:
    from typing_extensions import TypeAlias

import requests
from requests import Response, Session
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout

SEARCH_URL: Final[str] = "https://api.elsevier.com/content/search/scopus"
AUTHOR_URL_TEMPLATE: Final[str] = "https://api.elsevier.com/content/author/author_id/{author_id}"

API_KEY: Final[str | None] = os.getenv("ELSEVIER_API_KEY")
INST_TOKEN: Final[str | None] = os.getenv("ELSEVIER_INST_TOKEN")

OUTPUT_DIR: Final[Path] = Path("data")
STATE_FILE: Final[Path] = OUTPUT_DIR / "sync_state.json"

FETCH_MODE_ENV: Final[str] = os.getenv("FETCH_MODE", "incremental").strip().lower()
BATCH_SIZE_ENV: Final[str] = os.getenv("BATCH_SIZE", "20").strip()
INCREMENTAL_YEARS_ENV: Final[str] = os.getenv("INCREMENTAL_YEARS", "2").strip()
FACULTY_SHEET_IDS_JSON_ENV: Final[str] = os.getenv("FACULTY_SHEET_IDS_JSON", "").strip()
GOOGLE_API_KEY: Final[str | None] = os.getenv("GOOGLE_API_KEY")
SHEETS_META_URL_TEMPLATE: Final[str] = "https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}"
SHEETS_VALUES_URL_TEMPLATE: Final[str] = "https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{range_name}"
TAB_NAME_PATTERN: Final[re.Pattern[str]] = re.compile(r"^(?:(\d{2})__)?(.+?)__(kv|md|table)$")

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
    sections: list["FacultySection"]


class SectionKVItem(TypedDict):
    label: str
    value: str


class FacultySection(TypedDict, total=False):
    id: str
    title: str
    type: str
    items: list[SectionKVItem]
    markdown: str
    columns: list[str]
    rows: list[list[str]]


class PublicationsFileOutput(TypedDict):
    publications: list[PublicationEntry]


class FacultyRunStatus(TypedDict, total=False):
    last_synced_at: str
    last_mode: str
    status: str
    message: str


class SyncState(TypedDict, total=False):
    cursor: int
    last_run_at: str
    last_mode: str
    batch_size: int
    incremental_years: int
    processed_slugs: list[str]
    faculty_status: dict[str, FacultyRunStatus]


class RequestResult(TypedDict):
    ok: bool
    status_code: int | None
    response: Response | None
    error: str | None


class SheetTabDescriptor(TypedDict):
    title: str
    section_type: str
    tab_name: str
    section_id: str


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


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return normalized or "section"


def to_title_case(value: str) -> str:
    parts = [part for part in re.split(r"\s+", value.strip()) if part]
    if not parts:
        return value.strip()
    return " ".join(part[:1].upper() + part[1:].lower() for part in parts)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def validate_mode(mode: str) -> str:
    return mode if mode in ("incremental", "full") else "incremental"


def build_headers(api_key: str) -> dict[str, str]:
    headers = {
        "X-ELS-APIKey": api_key,
        "Accept": "application/json",
    }
    if INST_TOKEN and INST_TOKEN.strip():
        headers["X-ELS-Insttoken"] = INST_TOKEN.strip()
    return headers


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
    if isinstance(processed, list):
        # Narrow the type once for the whole block
        safe_list = cast("list[Any]", processed)
        state["processed_slugs"] = [str(x) for x in safe_list]
    else:
        state["processed_slugs"] = []

    faculty_status_raw = obj.get("faculty_status")
    normalized: dict[str, FacultyRunStatus] = {}
    if isinstance(faculty_status_raw, dict):
        faculty_status = cast("dict[str, Any]", faculty_status_raw)
        for slug, status in faculty_status.items():
            if isinstance(status, dict):
                normalized[str(slug)] = {
                    "last_synced_at": get_str_field(cast(JSONObject, status), "last_synced_at"),
                    "last_mode": get_str_field(cast(JSONObject, status), "last_mode"),
                    "status": get_str_field(cast(JSONObject, status), "status"),
                    "message": get_str_field(cast(JSONObject, status), "message"),
                }
    state["faculty_status"] = normalized
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
    url: str,
    max_retries: int = 4,
) -> RequestResult:
    for attempt in range(max_retries):
        try:
            response = session.get(url, headers=headers, params=params, timeout=30)

            if response.status_code in (401, 403):
                return {
                    "ok": False,
                    "status_code": response.status_code,
                    "response": None,
                    "error": f"Auth failure ({response.status_code}) for {author_id}",
                }

            if response.status_code == 429:
                if attempt == max_retries - 1:
                    return {
                        "ok": False,
                        "status_code": 429,
                        "response": None,
                        "error": f"Rate limit exceeded (429) for {author_id}",
                    }

                retry_after_raw = response.headers.get("Retry-After", "").strip()
                retry_after_seconds: float | None = None
                if retry_after_raw:
                    try:
                        retry_after_seconds = float(retry_after_raw)
                    except ValueError:
                        retry_after_seconds = None

                wait_seconds = (
                    retry_after_seconds
                    if retry_after_seconds is not None
                    else (2**attempt) + random.uniform(0, 0.8)
                )
                time.sleep(max(wait_seconds, 0.5))
                continue

            if response.status_code >= 500:
                if attempt == max_retries - 1:
                    return {
                        "ok": False,
                        "status_code": response.status_code,
                        "response": None,
                        "error": f"Server error ({response.status_code}) after {max_retries} attempts for {author_id}",
                    }
                time.sleep((2**attempt) + random.uniform(0, 0.6))
                continue

            response.raise_for_status()
            return {
                "ok": True,
                "status_code": response.status_code,
                "response": response,
                "error": None,
            }

        except (Timeout, RequestsConnectionError) as exc:
            if attempt == max_retries - 1:
                return {
                    "ok": False,
                    "status_code": None,
                    "response": None,
                    "error": f"Network failure for {author_id}: {exc}",
                }
            time.sleep((2**attempt) + random.uniform(0, 0.6))

        except requests.RequestException as exc:
            return {
                "ok": False,
                "status_code": None,
                "response": None,
                "error": f"Request failed for {author_id}: {exc}",
            }

    return {
        "ok": False,
        "status_code": None,
        "response": None,
        "error": f"Unexpected retry failure for {author_id}",
    }


def parse_sheet_id_map(raw_json: str) -> dict[str, str]:
    if not raw_json:
        return {}
    parsed: object = json.loads(raw_json)
    obj = ensure_object(parsed, "FACULTY_SHEET_IDS_JSON")
    mapping: dict[str, str] = {}
    for slug_raw, sheet_id_raw in obj.items():
        slug = str(slug_raw).strip()
        sheet_id = str(sheet_id_raw).strip()
        if slug and sheet_id:
            mapping[slug] = sheet_id
    return mapping


def parse_tab_descriptor(tab_name: str) -> SheetTabDescriptor | None:
    raw_name = tab_name.strip()
    match = TAB_NAME_PATTERN.match(raw_name)
    if not match:
        return None
    _, title_raw, section_type = match.groups()
    title = to_title_case(title_raw.strip())
    normalized_type = "markdown" if section_type == "md" else section_type
    descriptor: SheetTabDescriptor = {
        "title": title,
        "section_type": normalized_type,
        "tab_name": tab_name,
        "section_id": slugify(title),
    }
    return descriptor


def fetch_sheet_tabs(sheet_id: str, google_api_key: str) -> tuple[list[SheetTabDescriptor], str | None]:
    url = SHEETS_META_URL_TEMPLATE.format(sheet_id=sheet_id)
    params: dict[str, str] = {
        "fields": "sheets.properties.title",
        "key": google_api_key,
    }
    try:
        response = requests.get(url, params=params, timeout=20)
        response.raise_for_status()
        payload: object = response.json()
        obj = ensure_object(payload, "Sheets metadata")
        sheets_raw = get_json_array_field(obj, "sheets", default=[])
    except Exception as exc:
        return [], f"Unable to fetch sheet tabs: {exc}"

    descriptors: list[SheetTabDescriptor] = []
    for sheet in sheets_raw:
        if not isinstance(sheet, dict):
            continue
        properties = get_json_object_field(cast(JSONObject, sheet), "properties", default={})
        tab_name = get_str_field(properties, "title").strip()
        if not tab_name:
            continue
        parsed = parse_tab_descriptor(tab_name)
        if parsed is None:
            print(f"Warning: ignored tab '{tab_name}' (must match Title__kv|md|table with lowercase suffix).")
            continue
        descriptors.append(parsed)
    return descriptors, None


def fetch_sheet_values(sheet_id: str, tab_name: str, google_api_key: str) -> tuple[list[list[str]], str | None]:
    range_name = quote(tab_name, safe="")
    url = SHEETS_VALUES_URL_TEMPLATE.format(sheet_id=sheet_id, range_name=range_name)
    params: dict[str, str] = {"key": google_api_key}
    try:
        response = requests.get(url, params=params, timeout=20)
        response.raise_for_status()
        payload: object = response.json()
        obj = ensure_object(payload, "Sheets values")
        values_raw = get_json_array_field(obj, "values", default=[])
    except Exception as exc:
        return [], f"Unable to fetch tab '{tab_name}': {exc}"

    rows: list[list[str]] = []
    for row in values_raw:
        if not isinstance(row, list):
            continue
        rows.append([str(cell) for cell in cast("list[Any]", row)])
    return rows, None


def parse_kv_section(rows: list[list[str]]) -> tuple[list[SectionKVItem], str | None]:
    if not rows:
        return [], "kv tab is empty"

    first_row = rows[0] if rows else []
    normalized_headers = [cell.strip().lower() for cell in first_row]
    has_label_value_headers = ("label" in normalized_headers) and ("value" in normalized_headers)

    # Prefer explicit header mapping when available.
    if has_label_value_headers:
        label_idx = normalized_headers.index("label")
        value_idx = normalized_headers.index("value")
        data_rows = rows[1:]
    else:
        # Generic fallback: first column = label, remaining columns joined as value.
        label_idx = 0
        value_idx = -1
        data_rows = rows

    items: list[SectionKVItem] = []
    for row in data_rows:
        label = row[label_idx].strip() if label_idx < len(row) else ""
        if value_idx >= 0:
            value = row[value_idx].strip() if value_idx < len(row) else ""
        else:
            value = " | ".join(cell.strip() for cell in row[1:] if cell.strip())
        if not label and not value:
            continue
        if not label:
            label = "Detail"
        items.append({"label": label, "value": value})
    return items, None


def parse_markdown_section(rows: list[list[str]]) -> tuple[str, str | None]:
    for row in rows:
        for cell in row:
            text = cell.strip()
            if text:
                return text, None
    return "", "markdown tab has no non-empty content"


def parse_table_section(rows: list[list[str]]) -> tuple[list[str], list[list[str]], str | None]:
    if not rows:
        return [], [], "table tab is empty"

    raw_headers = rows[0]
    headers = [cell.strip() for cell in raw_headers if cell.strip()]
    if not headers:
        return [], [], "table tab must include a non-empty header row"

    expected_len = len(headers)
    parsed_rows: list[list[str]] = []
    for row in rows[1:]:
        normalized = [cell.strip() for cell in row[:expected_len]]
        while len(normalized) < expected_len:
            normalized.append("")
        if not any(normalized):
            continue
        parsed_rows.append(normalized)

    return headers, parsed_rows, None


def fetch_sheet_sections(sheet_id: str, google_api_key: str) -> tuple[list[FacultySection], list[str]]:
    sections: list[FacultySection] = []
    warnings: list[str] = []

    tabs, tab_error = fetch_sheet_tabs(sheet_id, google_api_key)
    if tab_error:
        return [], [tab_error]

    for tab in tabs:
        rows, value_error = fetch_sheet_values(sheet_id, tab["tab_name"], google_api_key)
        if value_error:
            warnings.append(value_error)
            continue

        if tab["section_type"] == "kv":
            items, parse_error = parse_kv_section(rows)
            if parse_error:
                warnings.append(f"tab '{tab['tab_name']}': {parse_error}")
                continue
            if not items:
                continue
            sections.append(
                {
                    "id": tab["section_id"],
                    "title": tab["title"],
                    "type": "kv",
                    "items": items,
                }
            )
            continue

        if tab["section_type"] == "table":
            columns, table_rows, parse_error = parse_table_section(rows)
            if parse_error:
                warnings.append(f"tab '{tab['tab_name']}': {parse_error}")
                continue
            if not table_rows:
                continue
            sections.append(
                {
                    "id": tab["section_id"],
                    "title": tab["title"],
                    "type": "table",
                    "columns": columns,
                    "rows": table_rows,
                }
            )
            continue

        markdown, parse_error = parse_markdown_section(rows)
        if parse_error:
            warnings.append(f"tab '{tab['tab_name']}': {parse_error}")
            continue
        sections.append(
            {
                "id": tab["section_id"],
                "title": tab["title"],
                "type": "markdown",
                "markdown": markdown,
            }
        )

    return sections, warnings


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


from typing import Any, cast, Union

def extract_h_index(raw_data: object) -> int | None:
    """
    Recursively searches for h-index values in a nested JSON-like structure.
    """
    def walk(value: object) -> int | None:
        # Case 1: Handle Dictionaries
        if isinstance(value, dict):
            # Narrow 'value' to dict[str, Any]
            obj = cast("dict[str, Any]", value)
            
            # Step A: Check current level for known keys
            for key in ("h-index", "h_index", "hIndex"):
                raw = obj.get(key)
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
            
            # Step B: Recurse into dictionary values
            # Cast to list[Any] to ensure 'nested' is not 'Unknown'
            for nested in list(obj.values()):
                found = walk(nested)
                if found is not None:
                    return found

        # Case 2: Handle Lists
        elif isinstance(value, list):
            # Cast the list elements to Any for the recursive call
            for item in cast("list[Any]", value):
                found = walk(item)
                if found is not None:
                    return found

        return None

    return walk(raw_data)


def compute_h_index(publications: list[PublicationEntry]) -> int:
    citations = sorted((p.get("citations") or 0 for p in publications), reverse=True)
    h = 0
    for i, c in enumerate(citations, start=1):
        if c >= i:
            h = i
        else:
            break
    return h


def fetch_author_h_index(author_id: str, api_key: str) -> tuple[int | None, str | None]:
    headers = build_headers(api_key)
    author_url = AUTHOR_URL_TEMPLATE.format(author_id=author_id)
    params: dict[str, Union[str, int]] = {"view": "ENHANCED"}

    with requests.Session() as session:
        result = perform_request(session, headers, params, author_id, url=author_url)
        if not result["ok"]:
            return None, result["error"]

        response = result["response"]
        if response is None:
            return None, f"Empty response for h-index fetch of {author_id}"

        try:
            raw_json: object = response.json()
            return extract_h_index(raw_json), None
        except ValueError as exc:
            return None, f"Invalid JSON in h-index response for {author_id}: {exc}"


def fetch_author_publications(
    author_id: str,
    api_key: str,
    mode: str,
    incremental_years: int,
    count: int = 25,
) -> tuple[list[PublicationEntry], str | None]:
    headers = build_headers(api_key)
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
            request_result = perform_request(session, headers, params, author_id, url=SEARCH_URL)
            if not request_result["ok"]:
                return results, request_result["error"]

            response = request_result["response"]
            if response is None:
                return results, f"Empty response while fetching publications for {author_id}"

            try:
                raw_json: object = response.json()
                data = ensure_object(raw_json, "API response")
                search_results = get_json_object_field(data, "search-results", default={})
                entries_raw = get_json_array_field(search_results, "entry", default=[])
            except Exception as exc:
                return results, f"Invalid JSON structure for {author_id}: {exc}"

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

    return results, None


def read_publications_file(path: Path) -> list[PublicationEntry]:
    if not path.exists():
        return []

    raw_data: object = json.loads(path.read_text(encoding="utf-8"))
    obj = ensure_object(raw_data, str(path))
    pubs_raw = get_json_array_field(obj, "publications", default=[])

    pubs: list[PublicationEntry] = []
    for item in pubs_raw:
        if isinstance(item, dict):
            entry = cast(JSONObject, item)
            pubs.append(
                {
                    "title": get_str_field(entry, "title"),
                    "source": get_str_field(entry, "source"),
                    "date": get_str_field(entry, "date"),
                    "doi": get_str_field(entry, "doi"),
                    "citations": get_int_field(entry, "citations", 0),
                    "eid": get_str_field(entry, "eid"),
                    "link": get_str_field(entry, "link"),
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


def remove_retired_faculty_files(output_dir: Path, active_slugs: set[str]) -> list[str]:
    removed_paths: list[str] = []
    publications_dir = output_dir / "publications"

    def maybe_remove_json_file(path: Path) -> None:
        if not path.exists() or path.suffix.lower() != ".json":
            return
        if path.name == "sync_state.json":
            return
        slug = path.stem
        if slug in active_slugs:
            return
        path.unlink()
        removed_paths.append(str(path))

    if output_dir.exists():
        for child in output_dir.iterdir():
            if child.is_file():
                maybe_remove_json_file(child)

    if publications_dir.exists():
        for child in publications_dir.iterdir():
            if child.is_file():
                maybe_remove_json_file(child)

    return removed_paths


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
        faculty_sheet_ids = parse_sheet_id_map(FACULTY_SHEET_IDS_JSON_ENV)
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

        faculty_status = sync_state.get("faculty_status", {})
        processed_slugs = sync_state.get("processed_slugs", [])

        success_count = 0
        full_fail_count = 0

        for fac in batch:
            slug = fac["slug"]
            author_id = fac["author_id"]
            print(f"Fetching publications for {fac['name']} ({slug})...")

            h_index, h_error = fetch_author_h_index(author_id, API_KEY)
            if h_error:
                print(f"Warning: h-index fetch failed for {slug}: {h_error}")

            incoming_publications, pub_error = fetch_author_publications(
                author_id,
                API_KEY,
                mode=mode,
                incremental_years=incremental_years,
            )
            if pub_error:
                print(f"Warning: publication fetch issue for {slug}: {pub_error}")

            publications_path = OUTPUT_DIR / "publications" / f"{slug}.json"

            if mode == "incremental":
                existing_publications = read_publications_file(publications_path)
                publications = merge_publications(existing_publications, incoming_publications)
            else:
                publications = incoming_publications

            # Decide if this faculty is a complete failure
            # Complete failure = h-index failed AND no incoming publications AND there is a publication error
            is_complete_failure = (h_error is not None) and (pub_error is not None) and (len(incoming_publications) == 0)

            if is_complete_failure:
                faculty_status[slug] = {
                    "last_synced_at": utc_now_iso(),
                    "last_mode": mode,
                    "status": "failed",
                    "message": pub_error or h_error or "Unknown failure",
                }
                full_fail_count += 1
                print(f"Skipping output write for {slug} due to complete failure.")
                continue

            if h_index is None:
                h_index = compute_h_index(publications)
                if h_error:
                    print(f"Using locally computed h-index for {slug}: {h_index}")
                    h_error = None

            publications_file = f"publications/{slug}.json"
            sections: list[FacultySection] = []
            sheet_id = faculty_sheet_ids.get(slug, "")
            if sheet_id:
                if GOOGLE_API_KEY and GOOGLE_API_KEY.strip():
                    sections, section_warnings = fetch_sheet_sections(sheet_id, GOOGLE_API_KEY.strip())
                    for warning in section_warnings:
                        print(f"Warning: sheet parse issue for {slug}: {warning}")
                else:
                    print(f"Warning: GOOGLE_API_KEY missing; skipping sheet sections for {slug}.")

            collected_outputs[slug] = {
                "name": fac["name"],
                "slug": slug,
                "author_id": author_id,
                "h_index": h_index,
                "total_publications": len(publications),
                "publications_file": publications_file,
                "sections": sections,
            }
            collected_publications[slug] = {"publications": publications}

            status_message_parts: list[str] = []
            if h_error:
                status_message_parts.append(f"h-index issue: {h_error}")
            if pub_error:
                status_message_parts.append(f"publications issue: {pub_error}")
            if not status_message_parts:
                status_message_parts.append("success")

            faculty_status[slug] = {
                "last_synced_at": utc_now_iso(),
                "last_mode": mode,
                "status": "partial_success" if (h_error or pub_error) else "success",
                "message": " | ".join(status_message_parts),
            }

            if slug not in processed_slugs:
                processed_slugs.append(slug)

            success_count += 1

        if collected_outputs or collected_publications:
            write_outputs_atomic(collected_outputs, collected_publications, OUTPUT_DIR)

        active_slugs = {fac["slug"] for fac in faculty_list if fac.get("slug")}
        removed_files = remove_retired_faculty_files(OUTPUT_DIR, active_slugs)
        for removed in removed_files:
            print(f"Removed retired faculty data file: {removed}")

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

        print(f"Batch summary: success={success_count}, full_failures={full_fail_count}, batch_size={len(batch)}")

        if success_count == 0:
            print("::error::Workflow failed: all faculty fetches in this batch failed.")
            return 1

        print("Batch update completed successfully.")
        return 0

    except Exception as exc:
        print(f"::error::Workflow failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
