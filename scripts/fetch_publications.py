from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, TypedDict, cast

import requests

API_KEY: str | None = os.getenv("ELSEVIER_API_KEY")
SEARCH_URL: str = "https://api.elsevier.com/content/search/scopus"


class JsonObject(TypedDict, total=False):
    pass


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
    total_publications: int
    publications: list[PublicationEntry]


def fetch_author_publications(author_id: str, api_key: str, count: int = 25) -> list[dict[str, Any]]:
    headers: dict[str, str] = {
        "X-ELS-APIKey": api_key,
        "Accept": "application/json",
    }

    params: dict[str, str | int] = {
        "query": f"AU-ID({author_id})",
        "count": count,
        "start": 0,
        "sort": "-coverDate",
    }

    results: list[dict[str, Any]] = []

    while True:
        response = requests.get(SEARCH_URL, headers=headers, params=params, timeout=30)
        response.raise_for_status()

        data_any: Any = response.json()
        if not isinstance(data_any, dict):
            break

        data: dict[str, Any] = cast(dict[str, Any], data_any)

        search_results_any: Any = data.get("search-results", {})
        if not isinstance(search_results_any, dict):
            break

        search_results: dict[str, Any] = cast(dict[str, Any], search_results_any)

        entries_any: Any = search_results.get("entry", [])
        if not isinstance(entries_any, list):
            break

        entries: list[dict[str, Any]] = []
        
        for raw_item in cast(list[Any], entries_any):
            if isinstance(raw_item, dict):
                typed_raw_item: dict[str, Any] = cast(dict[str, Any], raw_item)
                entries.append(typed_raw_item)

        if not entries:
            break

        entry: dict[str, Any]
        for entry in entries:
            results.append(entry)

        items_per_page: int = int(search_results.get("opensearch:itemsPerPage", 0))
        start_index: int = int(search_results.get("opensearch:startIndex", 0))
        total_results: int = int(search_results.get("opensearch:totalResults", 0))

        next_start: int = start_index + items_per_page
        if next_start >= total_results:
            break

        params["start"] = next_start

    return results


def transform_entry(entry: dict[str, Any]) -> PublicationEntry:
    return {
        "title": str(entry.get("dc:title", "")),
        "source": str(entry.get("prism:publicationName", "")),
        "date": str(entry.get("prism:coverDate", "")),
        "doi": str(entry.get("prism:doi", "")),
        "citations": int(entry.get("citedby-count", 0)),
        "eid": str(entry.get("eid", "")),
        "link": str(entry.get("prism:url", "")),
    }


def load_faculty_list(path: Path) -> list[FacultyEntry]:
    raw_any: Any = json.loads(path.read_text(encoding="utf-8"))

    if not isinstance(raw_any, list):
        raise ValueError("faculty.json must contain a list")

    faculty_list: list[FacultyEntry] = []

    # raw_any was already checked to be a list above
    for item_any in cast(list[Any], raw_any): 
        if not isinstance(item_any, dict):
            continue

        item: dict[str, Any] = cast(dict[str, Any], item_any)

        name: str = str(item.get("name", "")).strip()
        slug: str = str(item.get("slug", "")).strip()
        author_id: str = str(item.get("author_id", "")).strip()
        department: str = str(item.get("department", "")).strip()
        designation: str = str(item.get("designation", "")).strip()

        if not name or not slug or not author_id:
            continue

        faculty_list.append(
            {
                "name": name,
                "slug": slug,
                "author_id": author_id,
                "department": department,
                "designation": designation,
            }
        )

    return faculty_list


def main() -> None:
    if not API_KEY:
        raise ValueError("ELSEVIER_API_KEY is not set")

    faculty_file: Path = Path("faculty.json")
    output_dir: Path = Path("data")
    output_dir.mkdir(exist_ok=True)

    faculty_list: list[FacultyEntry] = load_faculty_list(faculty_file)

    faculty: FacultyEntry
    for faculty in faculty_list:
        name: str = faculty["name"]
        slug: str = faculty["slug"]
        author_id: str = faculty["author_id"]

        print(f"Fetching publications for {name} ({author_id})...")

        raw_publications: list[dict[str, Any]] = fetch_author_publications(author_id, API_KEY)

        publications: list[PublicationEntry] = []
        raw_pub: dict[str, Any]
        for raw_pub in raw_publications:
            publications.append(transform_entry(raw_pub))

        output: FacultyOutput = {
            "name": name,
            "slug": slug,
            "author_id": author_id,
            "total_publications": len(publications),
            "publications": publications,
        }

        output_path: Path = output_dir / f"{slug}.json"
        output_path.write_text(
            json.dumps(output, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    print("Done.")


if __name__ == "__main__":
    main()