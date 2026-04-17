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

function attachFacultyPhoto(photo, fallback, slug, name, imageRootPath) {
  fallback.textContent = getInitials(name);
  const extensions = ["jpg", "jpeg", "png", "webp"];
  let extensionIndex = 0;

  const tryNextImage = () => {
    if (extensionIndex < extensions.length) {
      const ext = extensions[extensionIndex];
      extensionIndex += 1;
      photo.src = `${imageRootPath}/${slug}.${ext}`;
    } else {
      photo.style.display = "none";
      fallback.style.display = "flex";
    }
  };

  photo.addEventListener("error", tryNextImage);
  tryNextImage();
}
