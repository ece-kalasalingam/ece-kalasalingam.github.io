from __future__ import annotations

import json
import os
import random
import sys
import time
from pathlib import Path
from typing import Final, TypedDict, cast, Any, Union

# Handle TypeAlias compatibility
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

# Strict JSON Type Definitions
JSONScalar: TypeAlias = Union[None, bool, int, float, str]
JSONObject: TypeAlias = dict[str, Any]
JSONArray: TypeAlias = list[Any]
JSONValue: TypeAlias = Union[JSONScalar, JSONObject, JSONArray]

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
        if default is not None: return default
        raise ValueError(f"Missing array field: {key}")
    if not isinstance(raw_value, list):
        raise ValueError(f"Field '{key}' must be a JSON array")
    return cast(JSONArray, raw_value)

def get_str_field(obj: JSONObject, key: str, default: str = "") -> str:
    raw_value = obj.get(key)
    if isinstance(raw_value, str): return raw_value
    if isinstance(raw_value, (int, float, bool)): return str(raw_value)
    return default

def get_int_field(obj: JSONObject, key: str, default: int = 0) -> int:
    raw_value = obj.get(key)
    if isinstance(raw_value, int): return raw_value
    if isinstance(raw_value, (float, bool)): return int(raw_value)
    if isinstance(raw_value, str):
        try:
            return int(raw_value.strip())
        except ValueError:
            return default
    return default

def load_faculty_list(path: Path) -> list[FacultyEntry]:
    # FIX: Fail loudly if the source file is missing
    if not path.exists():
        raise FileNotFoundError(f"Required configuration file missing: {path}")
    
    raw_text: str = path.read_text(encoding="utf-8")
    raw_data: object = json.loads(raw_text)
    raw_list: JSONArray = ensure_array(raw_data, "faculty.json")

    faculty_list: list[FacultyEntry] = []
    for raw_item in raw_list:
        if isinstance(raw_item, dict):
            item = cast(JSONObject, raw_item)
            faculty_list.append({
                "name": get_str_field(item, "name").strip(),
                "slug": get_str_field(item, "slug").strip(),
                "author_id": get_str_field(item, "author_id").strip(),
                "department": get_str_field(item, "department").strip(),
                "designation": get_str_field(item, "designation").strip(),
            })
    
    if not faculty_list:
        raise ValueError("faculty.json is empty or contains no valid entries.")
    return faculty_list

def perform_request(
    session: Session,
    headers: dict[str, str],
    params: dict[str, Union[str, int]], # Restored strict typing
    author_id: str,
    url: str = SEARCH_URL,
    max_retries: int = 3,
) -> Response:
    for attempt in range(max_retries):
        try:
            response: Response = session.get(
                url, headers=headers, params=params, timeout=30,
            )
            if response.status_code in (401, 403):
                raise RuntimeError(f"Auth failure ({response.status_code}) for {author_id}")
            if response.status_code == 429:
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Rate limit exceeded (429) for {author_id}")
                retry_after_raw = response.headers.get("Retry-After", "").strip()
                retry_after: float | None = None
                if retry_after_raw:
                    try:
                        retry_after = float(retry_after_raw)
                    except ValueError:
                        retry_after = None
                wait_seconds = retry_after if retry_after is not None else (2 ** attempt) + random.uniform(0, 0.8)
                time.sleep(max(wait_seconds, 0.5))
                continue
            if response.status_code >= 500:
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Server error ({response.status_code}) after {max_retries} attempts")
                time.sleep((2 ** attempt) + random.uniform(0, 0.6))
                continue
            response.raise_for_status()
            return response
        except (Timeout, RequestsConnectionError) as exc:
            if attempt == max_retries - 1:
                raise RuntimeError(f"Network failure for {author_id}") from exc
            time.sleep((2 ** attempt) + random.uniform(0, 0.6))
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
    headers: dict[str, str] = {"X-ELS-APIKey": api_key, "Accept": "application/json"}
    author_url = f"https://api.elsevier.com/content/author/author_id/{author_id}"
    params: dict[str, Union[str, int]] = {"view": "ENHANCED"}

    with requests.Session() as session:
        response: Response = perform_request(session, headers, params, author_id, url=author_url)
        raw_json: object = response.json()
        return extract_h_index(raw_json)

def fetch_author_publications(author_id: str, api_key: str, count: int = 25) -> list[PublicationEntry]:
    headers: dict[str, str] = {"X-ELS-APIKey": api_key, "Accept": "application/json"}
    params: dict[str, Union[str, int]] = {
        "query": f"AU-ID({author_id})",
        "count": count,
        "start": 0,
        "sort": "-coverDate",
    }
    results: list[PublicationEntry] = []

    with requests.Session() as session:
        while True:
            response: Response = perform_request(session, headers, params, author_id)
            raw_json: object = response.json()
            data: JSONObject = ensure_object(raw_json, "API response")
            search_results: JSONObject = get_json_object_field(data, "search-results", default={})
            entries_raw: JSONArray = get_json_array_field(search_results, "entry", default=[])

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
        # Phase 1: Write all new data to temp files in the same directory.
        for slug, data in outputs.items():
            temp_file = output_dir / f".{slug}.json.tmp"
            temp_file.write_text(
                json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            temp_files.append(temp_file)

        for slug, data in publication_outputs.items():
            temp_file = publications_dir / f".{slug}.json.tmp"
            temp_file.write_text(
                json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            temp_files.append(temp_file)

        # Phase 2: Atomically replace final files.
        for slug in outputs:
            temp_file = output_dir / f".{slug}.json.tmp"
            final_file = output_dir / f"{slug}.json"
            os.replace(temp_file, final_file)
        for slug in publication_outputs:
            temp_file = publications_dir / f".{slug}.json.tmp"
            final_file = publications_dir / f"{slug}.json"
            os.replace(temp_file, final_file)
    finally:
        # Cleanup in case an exception happened before replacement.
        for temp_file in temp_files:
            if temp_file.exists():
                temp_file.unlink()

def main() -> int:
    # 1. API Key Check: Skip safely if missing (e.g. on PRs from forks)
    if not API_KEY or not API_KEY.strip():
        print("::error::ELSEVIER_API_KEY is required but missing.")
        return 1

    try:
        # 2. Setup Check: Fail if config is missing
        faculty_list = load_faculty_list(Path("faculty.json"))
        collected_outputs: dict[str, FacultyOutput] = {}
        collected_publication_outputs: dict[str, PublicationsFileOutput] = {}

        # 3. Fetch Data: Fail loudly if ANY faculty member fails
        # No try/except here; we want the script to crash and return non-zero to GitHub Actions
        for fac in faculty_list:
            print(f"Fetching publications for {fac['name']}...")
            h_index = fetch_author_h_index(fac["author_id"], API_KEY)
            publications = fetch_author_publications(fac['author_id'], API_KEY)
            publications_file = f"publications/{fac['slug']}.json"
            collected_outputs[fac['slug']] = {
                "name": fac['name'],
                "slug": fac['slug'],
                "author_id": fac['author_id'],
                "h_index": h_index,
                "total_publications": len(publications),
                "publications_file": publications_file,
            }
            collected_publication_outputs[fac["slug"]] = {
                "publications": publications,
            }

        # 4. Atomic Write: Only happens if ALL fetches succeeded
        write_outputs_atomic(collected_outputs, collected_publication_outputs, Path("data"))
        print("All publications updated successfully.")
        return 0

    except Exception as e:
        print(f"::error::Workflow failed: {e}")
        # Return non-zero to stop the GitHub Action and prevent deployment of bad data
        return 1

if __name__ == "__main__":
    sys.exit(main())
