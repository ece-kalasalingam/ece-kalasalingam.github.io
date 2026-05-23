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

function extractYouTubeVideoId(item) {
  if (item.platform !== "youtube") return "";
  const directId = String(item.id || "").trim();
  if (directId && !directId.startsWith("youtube-")) return directId;

  const postUrl = String(item.postUrl || "").trim();
  if (!postUrl) return "";
  try {
    const parsed = new URL(postUrl);
    return parsed.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function postCard(item, index) {
  const platform = escapeHtml(item.platform || "update");
  const author = escapeHtml(item.author || "ECE Department");
  const text = escapeHtml(clipText(item.text || ""));
  const postUrl = escapeHtml(item.postUrl || "#");
  const dateLabel = escapeHtml(formatDate(item.postedAt));
  const thumb = item.thumbnailUrl || item.mediaUrl || "";
  const thumbHtml = thumb
    ? `<img class="feed-thumb" src="${escapeHtml(thumb)}" alt="${platform} post thumbnail" loading="lazy">`
    : "";

  const videoId = escapeHtml(extractYouTubeVideoId(item));
  const watchAction = videoId
    ? `<button type="button" class="feed-link feed-watch-btn" data-video-id="${videoId}" data-title="${escapeHtml(item.text || "YouTube video")}" data-index="${index}">Watch here</button>`
    : `<a class="feed-link" href="${postUrl}" target="_blank" rel="noopener noreferrer">Open post</a>`;

  return `<article class="feed-card">${thumbHtml}<div class="feed-body"><div class="feed-top"><span class="platform-pill">${platform}</span><time class="feed-date">${dateLabel}</time></div><p class="feed-author">${author}</p><p class="feed-text">${text || "No preview text available."}</p><div class="feed-actions">${watchAction}<a class="feed-link" href="${postUrl}" target="_blank" rel="noopener noreferrer">Open source</a></div></div></article>`;
}

function ensureVideoModal() {
  let overlay = document.getElementById("video-modal");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "video-modal";
  overlay.className = "video-modal";
  overlay.hidden = true;
  overlay.innerHTML = '<div class="video-modal-backdrop" data-close-modal="true"></div><div class="video-modal-panel" role="dialog" aria-modal="true" aria-label="YouTube video player"><div class="video-modal-header"><p id="video-modal-title" class="video-modal-title">Video</p><button type="button" class="video-modal-close" aria-label="Close video" data-close-modal="true">Close</button></div><div class="video-frame-wrap"><iframe id="video-iframe" class="video-iframe" title="YouTube video" src="" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>';

  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.closeModal === "true") {
      closeVideoModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      closeVideoModal();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

function openVideoModal(videoId, title) {
  const overlay = ensureVideoModal();
  const iframe = document.getElementById("video-iframe");
  const titleEl = document.getElementById("video-modal-title");
  if (!(iframe instanceof HTMLIFrameElement) || !(titleEl instanceof HTMLElement)) return;

  const safeId = encodeURIComponent(videoId);
  iframe.src = `https://www.youtube.com/embed/${safeId}?autoplay=1&rel=0`;
  titleEl.textContent = title || "YouTube video";
  overlay.hidden = false;
  document.body.classList.add("modal-open");
}

function closeVideoModal() {
  const overlay = document.getElementById("video-modal");
  const iframe = document.getElementById("video-iframe");
  if (iframe instanceof HTMLIFrameElement) {
    iframe.src = "";
  }
  if (overlay instanceof HTMLElement) {
    overlay.hidden = true;
  }
  document.body.classList.remove("modal-open");
}

function bindVideoActions() {
  document.querySelectorAll(".feed-watch-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const videoId = button.getAttribute("data-video-id") || "";
      const title = button.getAttribute("data-title") || "YouTube video";
      if (!videoId) return;
      openVideoModal(videoId, title);
    });
  });
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
  root.innerHTML = `<p class="feed-meta">Showing ${items.length} recent posts. Last refreshed: ${escapeHtml(fetchedAt)}.</p><section class="feed-grid">${items.map((item, index) => postCard(item, index)).join("")}</section>`;
  ensureVideoModal();
  bindVideoActions();
}

loadSocialFeed().catch((error) => {
  const root = document.getElementById("content");
  root.innerHTML = '<p class="feed-meta">Unable to load social feed at the moment. Please try again later.</p>';
  console.error(error);
});
