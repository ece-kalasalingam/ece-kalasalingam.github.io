from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import TypedDict, TypeAlias, cast

JSONValue: TypeAlias = str | int | float | bool | None | dict[str, "JSONValue"] | list["JSONValue"]
JSONObject: TypeAlias = dict[str, JSONValue]
JSONArray: TypeAlias = list[JSONValue]


class FacultyRecord(TypedDict):
    name: str
    slug: str
    scopus_id: str | None
    designation: str


def is_valid_photo_url(value: str) -> bool:
    raw = value.strip()
    if not raw:
        return False
    if re.search(r"https://[^\s\"')]+", raw, flags=re.IGNORECASE):
        return True
    # Allow plain Google Drive file-id style values to support runtime conversion.
    return bool(re.fullmatch(r"[A-Za-z0-9_-]{20,}", raw))


def photo_url_debug_summary(value: str) -> str:
    raw = str(value)
    trimmed = raw.strip()
    extracted_match = re.search(r"https://[^\s\"')]+", trimmed, flags=re.IGNORECASE)
    extracted_url = extracted_match.group(0) if extracted_match else ""
    first_char = f"U+{ord(raw[0]):04X}" if raw else "n/a"
    trimmed_first_char = f"U+{ord(trimmed[0]):04X}" if trimmed else "n/a"
    return (
        f"raw_repr={raw!r}; trimmed_repr={trimmed!r}; raw_len={len(raw)}; trimmed_len={len(trimmed)}; "
        f"first_char={first_char}; trimmed_first_char={trimmed_first_char}; "
        f"contains_https={bool(extracted_url)}; extracted_url={extracted_url!r}"
    )


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"Missing required file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in {path}: {exc}") from exc


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def ensure_object(value: object, context: str) -> JSONObject:
    if not isinstance(value, dict):
        raise RuntimeError(f"{context} must contain an object")
    return cast(JSONObject, value)


def ensure_array(value: object, context: str) -> JSONArray:
    if not isinstance(value, list):
        raise RuntimeError(f"{context} must contain a JSON array")
    return cast(JSONArray, value)


def get_optional_string_field(obj: JSONObject, key: str) -> str | None:
    raw_value = obj.get(key)
    if raw_value is None:
        return None
    if not isinstance(raw_value, str):
        raise RuntimeError(f"Field '{key}' must be a string when present")
    value = raw_value.strip()
    return value if value else None


def get_required_string_field(obj: JSONObject, key: str, context: str) -> str:
    value = get_optional_string_field(obj, key)
    if value is None:
        raise RuntimeError(f"{context}: '{key}' is required")
    return value


def validate_faculty_file(repo_root: Path, allow_missing: bool) -> list[FacultyRecord]:
    faculty_path = repo_root / "faculty.json"
    faculty_raw = ensure_array(load_json(faculty_path), "faculty.json")
    require(len(faculty_raw) > 0, "faculty.json must contain at least one faculty entry")

    seen_slugs: set[str] = set()
    validated: list[FacultyRecord] = []
    for i, item in enumerate(faculty_raw):
        context = f"faculty.json entry #{i + 1}"
        obj = ensure_object(item, context)

        for key in ("name", "slug", "designation"):
            value = obj.get(key)
            require(isinstance(value, str) and bool(value.strip()), f"{context}: '{key}' is required")

        scopus_id = obj.get("scopus_id")
        normalized_scopus_id: str | None
        if scopus_id is None:
            normalized_scopus_id = None
        elif isinstance(scopus_id, str):
            cleaned = scopus_id.strip()
            normalized_scopus_id = None if (not cleaned or cleaned.upper() in {"NA", "N/A", "NULL"}) else cleaned
        else:
            raise RuntimeError(f"{context}: 'scopus_id' must be a string, null, or 'NA'")
        if normalized_scopus_id is None and allow_missing:
            print(f"Validation note: {context} has missing 'scopus_id' (allowed in batching mode).")
        name = get_required_string_field(obj, "name", context)
        slug = get_required_string_field(obj, "slug", context)
        designation = get_required_string_field(obj, "designation", context)
        require(slug not in seen_slugs, f"Duplicate slug in faculty.json: {slug}")
        seen_slugs.add(slug)
        validated.append(
            {
                "name": name,
                "slug": slug,
                "scopus_id": normalized_scopus_id,
                "designation": designation,
            }
        )
    return validated


def validate_data_files(repo_root: Path, faculty_list: list[FacultyRecord], allow_missing: bool) -> None:
    data_dir = repo_root / "data"
    require(data_dir.exists(), "data directory is missing")

    for faculty in faculty_list:
        slug = faculty["slug"].strip()
        data_path = data_dir / f"{slug}.json"
        if not data_path.exists() and allow_missing:
            print(f"Validation note: data file not found yet for slug '{slug}' (allowed in batching mode).")
            continue
        data_raw = ensure_object(load_json(data_path), str(data_path))
        require(data_raw.get("slug") == slug, f"{data_path} has mismatched slug")
        require(isinstance(data_raw.get("name"), str), f"{data_path} missing 'name'")
        require(isinstance(data_raw.get("scopus_id"), str), f"{data_path} missing 'scopus_id'")
        require(isinstance(data_raw.get("total_publications"), int), f"{data_path} missing integer 'total_publications'")
        photo_url = data_raw.get("photo_url")
        if photo_url is not None:
            require(isinstance(photo_url, str), f"{data_path} 'photo_url' must be a string when present")
            require(
                is_valid_photo_url(photo_url),
                (
                    f"{data_path} 'photo_url' must be an https URL or Google Drive file id | "
                    f"debug: {photo_url_debug_summary(photo_url)}"
                ),
            )

        has_inline_publications = isinstance(data_raw.get("publications"), list)
        publications_file = data_raw.get("publications_file")
        has_external_publications = isinstance(publications_file, str) and publications_file.strip() != ""
        require(
            has_inline_publications or has_external_publications,
            f"{data_path} must contain 'publications' array or 'publications_file' path",
        )

        if isinstance(publications_file, str) and publications_file.strip():
            publications_path = data_dir / publications_file.strip()
            pubs_raw = ensure_object(load_json(publications_path), str(publications_path))
            pubs = pubs_raw.get("publications")
            require(isinstance(pubs, list), f"{publications_path} must contain 'publications' array")

        sections = data_raw.get("sections")
        if sections is not None:
            section_array = ensure_array(sections, f"{data_path} 'sections'")
            for idx, section in enumerate(section_array):
                prefix = f"{data_path} sections[{idx}]"
                section_obj = ensure_object(section, prefix)
                section_id = get_optional_string_field(section_obj, "id")
                section_title = get_optional_string_field(section_obj, "title")
                section_type = get_optional_string_field(section_obj, "type")
                require(section_id is not None, f"{prefix} missing non-empty 'id'")
                require(section_title is not None, f"{prefix} missing non-empty 'title'")
                require(section_type in ("kv", "markdown", "table"), f"{prefix} 'type' must be 'kv', 'markdown', or 'table'")

                if section_type == "kv":
                    items_array = ensure_array(section_obj.get("items"), f"{prefix} with type 'kv' items")
                    for item_idx, item in enumerate(items_array):
                        item_prefix = f"{prefix} items[{item_idx}]"
                        item_obj = ensure_object(item, item_prefix)
                        label = get_optional_string_field(item_obj, "label")
                        value = get_optional_string_field(item_obj, "value")
                        require(
                            label is not None,
                            f"{item_prefix} missing non-empty 'label'",
                        )
                        require(
                            value is not None,
                            f"{item_prefix} missing non-empty 'value'",
                        )
                elif section_type == "markdown":
                    markdown = get_optional_string_field(section_obj, "markdown")
                    require(
                        markdown is not None,
                        f"{prefix} with type 'markdown' must include non-empty 'markdown'",
                    )
                else:
                    columns = ensure_array(section_obj.get("columns"), f"{prefix} with type 'table' columns")
                    rows = ensure_array(section_obj.get("rows"), f"{prefix} with type 'table' rows")
                    require(len(columns) > 0, f"{prefix} with type 'table' must include non-empty 'columns'")
                    for col_idx, col in enumerate(columns):
                        require(
                            isinstance(col, str) and bool(col.strip()),
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
