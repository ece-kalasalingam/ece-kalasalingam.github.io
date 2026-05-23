# ece-kalasalingam.github.io

ECE Department, Kalasalingam University

## Site Routes

- `/` - Social feed home (LinkedIn + YouTube recent posts)
- `/directory/` - Faculty directory listing
- `/faculty/?faculty=<slug>` - Individual faculty profile

## Local Run

Serve the repository root with any static server (for example, `python -m http.server`) and open `index.html`.

## Social Feed Backend

The homepage fetches live data from `GET /api/social-feed?limit=<n>`.

Backend contract and required secrets are documented in `api/README.md`.

## Data Pipeline

- Source faculty list: `faculty.json`
- Faculty metadata output: `data/<slug>.json`
- Publications payload output: `data/publications/<slug>.json`
- Sync checkpoint state: `data/sync_state.json`
- Fetch script: `scripts/fetch_publications.py`

### Scalable Fetch Modes

The fetch script supports scalable operation for larger faculty counts:

- `FETCH_MODE=incremental|full`
- `BATCH_SIZE=<positive integer>`
- `INCREMENTAL_YEARS=<positive integer>`

`incremental` mode fetches recent publications only and merges with existing cached publications.
`full` mode refreshes full publication history for processed faculty.
Batch checkpoint progress is persisted in `data/sync_state.json`.

## Faculty Photos

Photo rendering uses this priority order:

1. `photo__link` tab from each faculty Google Sheet, with key `link`.
2. Local fallback image in `images/faculty/` named by slug.
3. Initials placeholder.

`photo__link` tab format:

- Header row optional.
- Key/label must be `link`.
- Value cell is the public image URL (editable).

Supported `link` values:

- Direct `https://` image URL.
- Google Drive share URL (auto-converted at runtime).
- Google Drive file id.

Google Drive files must be shared publicly for browser access.

Local fallback photos can be placed as:

- `images/faculty/<slug>.jpg`
- `images/faculty/<slug>.jpeg`
- `images/faculty/<slug>.png`
- `images/faculty/<slug>.webp`
