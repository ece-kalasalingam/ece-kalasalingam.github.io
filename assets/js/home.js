function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function clipText(text, max = 220) {
  const safe = String(text || "").trim();
  if (safe.length <= max) return safe;
  return `${safe.slice(0, max - 1)}...`;
}

function postCard(item) {
  const platform = escapeHtml(item.platform || "update");
  const author = escapeHtml(item.author || "ECE Department");
  const text = escapeHtml(clipText(item.text || ""));
  const postUrl = escapeHtml(item.postUrl || "#");
  const dateLabel = escapeHtml(formatDate(item.postedAt));
  const thumb = item.thumbnailUrl || item.mediaUrl || "";
  const thumbHtml = thumb
    ? `<img class="feed-thumb" src="${escapeHtml(thumb)}" alt="${platform} post thumbnail" loading="lazy">`
    : "";

  return `<article class="feed-card">${thumbHtml}<div class="feed-body"><div class="feed-top"><span class="platform-pill">${platform}</span><time class="feed-date">${dateLabel}</time></div><p class="feed-author">${author}</p><p class="feed-text">${text || "No preview text available."}</p><a class="feed-link" href="${postUrl}" target="_blank" rel="noopener noreferrer">Open post</a></div></article>`;
}

async function loadSocialFeed() {
  const root = document.getElementById("content");
  const endpoint = `${window.location.origin}/api/social-feed?limit=4`;

  const res = await fetch(endpoint, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Feed request failed with status ${res.status}`);
  }

  const payload = await res.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!items.length) {
    root.innerHTML = '<p class="feed-meta">No posts are available right now. Please check back soon.</p>';
    return;
  }

  const fetchedAt = payload?.fetchedAt ? formatDate(payload.fetchedAt) : "unknown";
  root.innerHTML = `<p class="feed-meta">Showing ${items.length} recent posts. Last refreshed: ${escapeHtml(fetchedAt)}.</p><section class="feed-grid">${items.map(postCard).join("")}</section>`;
}

loadSocialFeed().catch((error) => {
  const root = document.getElementById("content");
  root.innerHTML = '<p class="feed-meta">Unable to load social feed at the moment. Please try again later.</p>';
  console.error(error);
});

