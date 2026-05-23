function getInitials(name) {
  if (!name || typeof name !== "string") {
    return "FM";
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "FM";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isSafeImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname) return false;
    if (parsed.username || parsed.password) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function extractDriveFileId(urlText) {
  const url = String(urlText || "").trim();
  if (!url) return "";
  const directId = /^[a-zA-Z0-9_-]{20,}$/.test(url) ? url : "";
  if (directId) return directId;

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/i,
    /[?&]id=([a-zA-Z0-9_-]{20,})/i,
    /\/thumbnail\?id=([a-zA-Z0-9_-]{20,})/i,
    /\/uc\?[^#]*\bid=([a-zA-Z0-9_-]{20,})/i
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return "";
}

function normalizeFacultyPhotoUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (isSafeImageUrl(value)) {
    const hostname = new URL(value).hostname.toLowerCase();
    if (hostname === "drive.google.com" || hostname.endsWith(".googleusercontent.com")) {
      const fileId = extractDriveFileId(value);
      if (fileId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
    }
    return value;
  }
  const fileId = extractDriveFileId(value);
  if (fileId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
  return "";
}

function attachFacultyPhoto(photo, fallback, slug, name, imageRootPath, remotePhotoUrl) {
  fallback.textContent = getInitials(name);
  fallback.style.display = "none";
  photo.style.display = "block";

  const extensions = ["jpg", "jpeg", "png", "webp"];
  const candidateSources = [];
  const normalizedRemote = normalizeFacultyPhotoUrl(remotePhotoUrl);
  if (normalizedRemote) {
    candidateSources.push(normalizedRemote);
  }
  if (slug) {
    for (const ext of extensions) {
      candidateSources.push(`${imageRootPath}/${slug}.${ext}`);
    }
  }
  let extensionIndex = 0;

  const tryNextImage = () => {
    if (extensionIndex < candidateSources.length) {
      const nextSource = candidateSources[extensionIndex];
      extensionIndex += 1;
      photo.src = nextSource;
    } else {
      photo.style.display = "none";
      fallback.style.display = "flex";
    }
  };

  photo.addEventListener("error", tryNextImage);
  photo.addEventListener("load", () => {
    photo.style.display = "block";
    fallback.style.display = "none";
  });
  tryNextImage();
}
