from __future__ import annotations

import json
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


def validate_faculty_file(repo_root: Path) -> list[dict[str, str]]:
    faculty_path = repo_root / "faculty.json"
    faculty_raw = load_json(faculty_path)
    require(isinstance(faculty_raw, list), "faculty.json must contain a JSON array")
    require(len(faculty_raw) > 0, "faculty.json must contain at least one faculty entry")

    seen_slugs: set[str] = set()
    validated: list[dict[str, str]] = []
    for i, item in enumerate(faculty_raw):
        require(isinstance(item, dict), f"faculty.json entry #{i + 1} must be an object")
        for key in ("name", "slug", "author_id", "designation"):
            value = item.get(key)
            require(isinstance(value, str) and value.strip(), f"faculty.json entry #{i + 1}: '{key}' is required")
        slug = item["slug"].strip()
        require(slug not in seen_slugs, f"Duplicate slug in faculty.json: {slug}")
        seen_slugs.add(slug)
        validated.append(
            {
                "name": item["name"].strip(),
                "slug": slug,
                "author_id": item["author_id"].strip(),
                "designation": item["designation"].strip(),
            }
        )
    return validated


def validate_data_files(repo_root: Path, faculty_list: list[dict[str, str]]) -> None:
    data_dir = repo_root / "data"
    require(data_dir.exists(), "data directory is missing")

    for faculty in faculty_list:
        slug = faculty["slug"]
        data_path = data_dir / f"{slug}.json"
        data_raw = load_json(data_path)
        require(isinstance(data_raw, dict), f"{data_path} must contain an object")
        require(data_raw.get("slug") == slug, f"{data_path} has mismatched slug")
        require(isinstance(data_raw.get("name"), str), f"{data_path} missing 'name'")
        require(isinstance(data_raw.get("author_id"), str), f"{data_path} missing 'author_id'")
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


def validate_html_files(repo_root: Path) -> None:
    index_js = (repo_root / "assets" / "js" / "index.js").read_text(encoding="utf-8")
    faculty_js = (repo_root / "assets" / "js" / "faculty.js").read_text(encoding="utf-8")
    require("faculty/?faculty=" in index_js, "index.js should link to faculty pages with '?faculty=' parameter")
    require("getFacultyFromQuery" in faculty_js, "faculty.js should resolve query with getFacultyFromQuery")


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    faculty_list = validate_faculty_file(repo_root)
    validate_data_files(repo_root, faculty_list)
    validate_html_files(repo_root)
    print("Validation passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"Validation failed: {exc}")
        raise SystemExit(1)
