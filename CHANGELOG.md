# CHANGELOG

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
