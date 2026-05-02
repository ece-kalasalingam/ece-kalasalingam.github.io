# ece-kalasalingam.github.io

ECE Department, Kalasalingam University

## Local Run

Serve the repository root with any static server (for example, `python -m http.server`) and open `index.html`.

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

Optional photos can be added under `images/faculty/` named by slug:

- `images/faculty/<slug>.jpg`
- `images/faculty/<slug>.jpeg`
- `images/faculty/<slug>.png`
- `images/faculty/<slug>.webp`

If no photo exists, the UI shows an initials placeholder.
