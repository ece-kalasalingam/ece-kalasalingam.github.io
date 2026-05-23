# CHANGELOG

## 2026-05-23 18:08 IST | author: Codex | type: fix
- Summary: Relaxed `photo_url` validation to accept wrapped shared URLs emitted by Google Sheets.
- Files: `scripts/validate_site.py`
- Details: Updated `is_valid_photo_url` to accept any string containing an HTTPS URL token (case-insensitive) instead of requiring strict prefix patterns, while still supporting raw Google Drive file IDs.
- Revert: No

## 2026-05-23 18:05 IST | author: Codex | type: fix
- Summary: Accepted formula-style Google Sheets photo-link cells and normalized embedded HTTPS URLs.
- Files: `scripts/fetch_publications.py`, `scripts/validate_site.py`
- Details: Updated photo-link parsing to extract the first HTTPS URL when the `link` cell contains a formula-style value (for example `=HYPERLINK(...)`) and aligned validator rules to accept formula strings that embed HTTPS URLs.
- Revert: No

## 2026-05-23 18:01 IST | author: Codex | type: fix
- Summary: Made photo-link tab detection case-insensitive and fetch by discovered tab name.
- Files: `scripts/fetch_publications.py`
- Details: Updated `fetch_photo_url_from_sheet` to match tab names by normalized key (so `Photo__link` and `photo__link` both work) and fetch values using the actual tab title from metadata, preventing range parse errors caused by case mismatch.
- Revert: No

## 2026-05-23 18:00 IST | author: Codex | type: fix
- Summary: Prevented sync warnings when `photo__link` tab is absent on a faculty sheet.
- Files: `scripts/fetch_publications.py`
- Details: Updated `fetch_photo_url_from_sheet` to check sheet tabs first and treat missing `photo__link` as optional (`photo_url` empty) instead of attempting a values fetch that triggers Google Sheets `Unable to parse range` HTTP 400 warnings.
- Revert: No

## 2026-05-23 17:52 IST | author: Codex | type: fix
- Summary: Renamed faculty photo sheet tab contract from `photos__link` to `photo__link`.
- Files: `scripts/fetch_publications.py`, `README.md`
- Details: Updated the dedicated photo-link tab reader to fetch from `photo__link` and aligned README documentation to the new fixed sheet name. Key/value rule remains unchanged (`link` -> URL).
- Revert: No

## 2026-05-23 17:45 IST | author: Codex | type: fix
- Summary: Switched faculty photo source contract from Profile `Photo URL` to fixed `photos__link` tab key `link`.
- Files: `scripts/fetch_publications.py`, `scripts/sync_sheet_sections_only.py`, `README.md`
- Details: Removed dependency on Profile-section photo fields and introduced dedicated `photos__link` reader per faculty sheet. The sync pipeline now reads key/value rows from `photos__link` and persists `photo_url` using only key `link`, while keeping local-image and initials fallback behavior unchanged.
- Revert: No

## 2026-05-23 17:40 IST | author: Codex | type: feature
- Summary: Implemented multi-source faculty photo lookup with Google Sheet `Photo URL` primary source, local image fallback, and initials fallback.
- Files: `scripts/fetch_publications.py`, `scripts/sync_sheet_sections_only.py`, `assets/js/common.js`, `assets/js/index.js`, `assets/js/faculty.js`, `scripts/validate_site.py`, `README.md`
- Details: Added sheet-profile `Photo URL` extraction and persisted `photo_url` into `data/<slug>.json` during full and partial sheet sync. Extended shared photo loader to validate/normalize remote URLs, auto-convert common Google Drive links/file-ids into direct-view URLs, then fallback to `images/faculty/<slug>.(jpg|jpeg|png|webp)` and finally initials placeholder. Updated list/profile call sites to pass remote photo URL, added validator checks for optional `photo_url`, and documented the new sheet contract/public sharing requirement.
- Revert: No

## 2026-05-23 17:06 IST | author: Codex | type: feature
- Summary: Added faculty-level email fallback support for vCard/QR contact generation.
- Files: `faculty.json`, `assets/js/faculty.js`
- Details: Added `email` field to every faculty entry in `faculty.json` (auto-filled where available from profile sheet data, empty string otherwise). Updated `faculty.js` to prefer sheet profile email and fall back to `faculty.json` email when sheet email is missing.
- Revert: No

## 2026-05-23 17:19 IST | author: Codex | type: feature
- Summary: Updated vCard URL behavior to prefer profile website and fallback to slug URL.
- Files: `assets/js/faculty.js`
- Details: In vCard generation, URL now uses faculty profile website field when present and valid (`https`), otherwise falls back to canonical slug-based faculty page URL.
- Revert: No

## 2026-05-23 17:19 IST | author: Codex | type: fix
- Summary: Hardened GitHub Pages deploy workflow authentication for content-change deployments.
- Files: `.github/workflows/deploy_site_on_content_change.yaml`
- Details: Added explicit `token: ${{ secrets.GITHUB_TOKEN }}` to `actions/configure-pages@v6` and `actions/deploy-pages@v5`, and enabled `enablement: true` in `configure-pages` to auto-enable/configure Pages when needed by the workflow.
- Revert: No

## 2026-05-23 17:21 IST | author: Codex | type: fix
- Summary: Applied the same Pages auth hardening to remaining GitHub Pages deployment workflows.
- Files: `.github/workflows/sync_changed_faculty_sheets.yaml`, `.github/workflows/update_publications.yaml`
- Details: Added explicit `token: ${{ secrets.GITHUB_TOKEN }}` to both `actions/configure-pages@v6` and `actions/deploy-pages@v5`, and set `enablement: true` on each `configure-pages` step for consistent Pages setup/auth behavior across workflows.
- Revert: No

## 2026-05-23 17:30 IST | author: Codex | type: fix
- Summary: Restored vCard URL population by extracting the first valid URL from mixed website field text.
- Files: `assets/js/faculty.js`
- Details: Replaced strict single-value website parsing with `extractFirstSafeUrl()` so vCard generation can pick the first valid HTTPS/`www.` URL even when the profile website field contains multiple links or surrounding text, then fallback to canonical slug URL only when no safe URL is found.
- Revert: No
