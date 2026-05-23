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
