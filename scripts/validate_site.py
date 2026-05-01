from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"Missing required file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in {path}: {exc}") from exc


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def validate_faculty_file(repo_root: Path, allow_missing: bool) -> list[dict[str, str]]:
    faculty_path = repo_root / "faculty.json"
    faculty_raw = load_json(faculty_path)
    require(isinstance(faculty_raw, list), "faculty.json must contain a JSON array")
    require(len(faculty_raw) > 0, "faculty.json must contain at least one faculty entry")

    seen_slugs: set[str] = set()
    validated: list[dict[str, str | None]] = []
    for i, item in enumerate(faculty_raw):
        require(isinstance(item, dict), f"faculty.json entry #{i + 1} must be an object")
        for key in ("name", "slug", "designation"):
            value = item.get(key)
            require(isinstance(value, str) and value.strip(), f"faculty.json entry #{i + 1}: '{key}' is required")
        scopus_id = item.get("scopus_id")
        normalized_scopus_id: str | None
        if scopus_id is None:
            normalized_scopus_id = None
        elif isinstance(scopus_id, str):
            cleaned = scopus_id.strip()
            normalized_scopus_id = None if (not cleaned or cleaned.upper() in {"NA", "N/A", "NULL"}) else cleaned
        else:
            raise RuntimeError(f"faculty.json entry #{i + 1}: 'scopus_id' must be a string, null, or 'NA'")
        if normalized_scopus_id is None and allow_missing:
            print(f"Validation note: faculty.json entry #{i + 1} has missing 'scopus_id' (allowed in batching mode).")
        slug = item["slug"].strip()
        require(slug not in seen_slugs, f"Duplicate slug in faculty.json: {slug}")
        seen_slugs.add(slug)
        validated.append(
            {
                "name": item["name"].strip(),
                "slug": slug,
                "scopus_id": normalized_scopus_id,
                "designation": item["designation"].strip(),
            }
        )
    return validated


def validate_data_files(repo_root: Path, faculty_list: list[dict[str, str | None]], allow_missing: bool) -> None:
    data_dir = repo_root / "data"
    require(data_dir.exists(), "data directory is missing")

    for faculty in faculty_list:
        slug = faculty["slug"]
        data_path = data_dir / f"{slug}.json"
        if not data_path.exists() and allow_missing:
            print(f"Validation note: data file not found yet for slug '{slug}' (allowed in batching mode).")
            continue
        data_raw = load_json(data_path)
        require(isinstance(data_raw, dict), f"{data_path} must contain an object")
        require(data_raw.get("slug") == slug, f"{data_path} has mismatched slug")
        require(isinstance(data_raw.get("name"), str), f"{data_path} missing 'name'")
        require(isinstance(data_raw.get("scopus_id"), str), f"{data_path} missing 'scopus_id'")
        require(isinstance(data_raw.get("total_publications"), int), f"{data_path} missing integer 'total_publications'")

        has_inline_publications = isinstance(data_raw.get("publications"), list)
        publications_file = data_raw.get("publications_file")
        has_external_publications = isinstance(publications_file, str) and publications_file.strip() != ""
        require(
            has_inline_publications or has_external_publications,
            f"{data_path} must contain 'publications' array or 'publications_file' path",
        )

        if has_external_publications:
            publications_path = data_dir / publications_file
            pubs_raw = load_json(publications_path)
            require(isinstance(pubs_raw, dict), f"{publications_path} must contain an object")
            pubs = pubs_raw.get("publications")
            require(isinstance(pubs, list), f"{publications_path} must contain 'publications' array")

        sections = data_raw.get("sections")
        if sections is not None:
            require(isinstance(sections, list), f"{data_path} 'sections' must be an array")
            for idx, section in enumerate(sections):
                prefix = f"{data_path} sections[{idx}]"
                require(isinstance(section, dict), f"{prefix} must be an object")
                require(isinstance(section.get("id"), str) and section["id"].strip(), f"{prefix} missing non-empty 'id'")
                require(isinstance(section.get("title"), str) and section["title"].strip(), f"{prefix} missing non-empty 'title'")
                require(section.get("type") in ("kv", "markdown", "table"), f"{prefix} 'type' must be 'kv', 'markdown', or 'table'")

                if section.get("type") == "kv":
                    items = section.get("items")
                    require(isinstance(items, list), f"{prefix} with type 'kv' must include 'items' array")
                    for item_idx, item in enumerate(items):
                        item_prefix = f"{prefix} items[{item_idx}]"
                        require(isinstance(item, dict), f"{item_prefix} must be an object")
                        require(
                            isinstance(item.get("label"), str) and item["label"].strip(),
                            f"{item_prefix} missing non-empty 'label'",
                        )
                        require(
                            isinstance(item.get("value"), str) and item["value"].strip(),
                            f"{item_prefix} missing non-empty 'value'",
                        )
                elif section.get("type") == "markdown":
                    markdown = section.get("markdown")
                    require(
                        isinstance(markdown, str) and markdown.strip(),
                        f"{prefix} with type 'markdown' must include non-empty 'markdown'",
                    )
                else:
                    columns = section.get("columns")
                    rows = section.get("rows")
                    require(isinstance(columns, list) and len(columns) > 0, f"{prefix} with type 'table' must include non-empty 'columns'")
                    require(isinstance(rows, list), f"{prefix} with type 'table' must include 'rows' array")
                    for col_idx, col in enumerate(columns):
                        require(
                            isinstance(col, str) and col.strip(),
                            f"{prefix} columns[{col_idx}] must be a non-empty string",
                        )
                    for row_idx, row in enumerate(rows):
                        require(
                            isinstance(row, list),
                            f"{prefix} rows[{row_idx}] must be an array",
                        )


def validate_html_files(repo_root: Path) -> None:
    index_js = (repo_root / "assets" / "js" / "index.js").read_text(encoding="utf-8")
    faculty_js = (repo_root / "assets" / "js" / "faculty.js").read_text(encoding="utf-8")
    require("faculty/?${encodeURIComponent(person.slug || \"\")}" in index_js, "index.js should link to faculty pages with bare '?slug' query")
    require("getFacultyFromBareQuery" in faculty_js, "faculty.js should resolve bare '?slug' query format")


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    allow_missing = os.getenv("VALIDATE_ALLOW_MISSING", "").strip() == "1"
    faculty_list = validate_faculty_file(repo_root, allow_missing=allow_missing)
    validate_data_files(repo_root, faculty_list, allow_missing=allow_missing)
    validate_html_files(repo_root)
    print("Validation passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"Validation failed: {exc}")
        raise SystemExit(1)
