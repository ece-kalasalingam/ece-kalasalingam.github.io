const RESEARCH_DATA_PATH = "../data/research.json";

function textOrNA(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return "N/A";
}

function buildLine(label, value) {
  const p = document.createElement("p");
  p.className = "detail-line";

  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  p.appendChild(strong);

  p.appendChild(document.createTextNode(textOrNA(value)));
  return p;
}

function renderResults(entries, totalResults) {
  const container = document.getElementById("content");
  container.innerHTML = "";

  const summary = document.createElement("p");
  summary.className = "subtext";
  summary.textContent = `Results returned: ${entries.length} (total matches: ${totalResults})`;
  container.appendChild(summary);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.textContent = "No department details found for this query.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "result-list";

  for (const entry of entries) {
    const card = document.createElement("article");
    card.className = "result-card";

    const name = document.createElement("h2");
    name.className = "result-title";
    name.textContent = textOrNA(entry.affiliation_name);
    card.appendChild(name);

    card.appendChild(buildLine("Affiliation ID", entry.affiliation_id));
    card.appendChild(buildLine("City", entry.city));
    card.appendChild(buildLine("Country", entry.country));
    card.appendChild(buildLine("Document Count", entry.document_count));

    list.appendChild(card);
  }

  container.appendChild(list);
}

function extractPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return { entries: [], totalResults: 0 };
  }
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const totalResults = Number(raw.total_results || entries.length || 0);
  return { entries, totalResults };
}

async function loadResearchDetails() {
  const content = document.getElementById("content");
  content.textContent = "Loading research details...";

  try {
    const response = await fetch(RESEARCH_DATA_PATH, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Research data request failed with ${response.status}`);
    }

    const payload = await response.json();
    const { entries, totalResults } = extractPayload(payload);
    renderResults(entries, totalResults);
  } catch (error) {
    console.error(error);
    content.textContent = "Failed to load research details. Run scripts/fetch_research.py to generate data/research.json.";
  }
}

loadResearchDetails();
