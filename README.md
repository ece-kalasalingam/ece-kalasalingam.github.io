# ece-kalasalingam.github.io

ECE Department, Kalasalingam University

## Local Run

Serve the repository root with any static server (for example, `python -m http.server`) and open `index.html`.

## Data Pipeline

- Source faculty list: `faculty.json`
- Faculty metadata output: `data/<slug>.json`
- Publications payload output: `data/publications/<slug>.json`
- Fetch script: `scripts/fetch_publications.py`

## Faculty Photos

Optional photos can be added under `images/faculty/` named by slug:

- `images/faculty/<slug>.jpg`
- `images/faculty/<slug>.jpeg`
- `images/faculty/<slug>.png`
- `images/faculty/<slug>.webp`

If no photo exists, the UI shows an initials placeholder.
