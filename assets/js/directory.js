function getDirectoryContainer() {
  const primary = document.getElementById("faculty-spotlights");
  if (primary instanceof HTMLElement) return primary;
  const fallback = document.getElementById("content");
  if (fallback instanceof HTMLElement) return fallback;
  return null;
}

async function loadFacultyList() {
  const facultyRes = await fetch("../faculty.json", { cache: "no-cache" });
  if (!facultyRes.ok) {
    throw new Error("Unable to load faculty.json");
  }
  const faculty = await facultyRes.json();
  if (!Array.isArray(faculty)) {
    throw new Error("faculty.json must be an array");
  }
  const photoUrlMap = {};
  await Promise.all(
    faculty.map(async person => {
      const slug = String(person?.slug || "").trim();
      if (!slug) return;
      try {
        const detailsRes = await fetch(`../data/${encodeURIComponent(slug)}.json`, { cache: "no-cache" });
        if (!detailsRes.ok) return;
        const details = await detailsRes.json();
        const photoUrl = String(details?.photo_url || "").trim();
        if (photoUrl) {
          photoUrlMap[slug] = photoUrl;
        }
      } catch (error) {
        // Ignore per-person photo lookup failures; fallback chain will handle rendering.
      }
    })
  );

  const container = getDirectoryContainer();
  if (!container) return;
  container.innerHTML = "";

  if (!faculty.length) {
    container.innerHTML = '<article class="faculty-card faculty-loading">Faculty data is currently unavailable.</article>';
    return;
  }

  for (const person of faculty) {
    const card = document.createElement("article");
    card.className = "faculty-card";

    const photoWrap = document.createElement("div");
    photoWrap.className = "faculty-photo-wrap";
    card.appendChild(photoWrap);

    const photoFrame = document.createElement("div");
    photoFrame.className = "photo-wrap";
    photoWrap.appendChild(photoFrame);

    const photo = document.createElement("img");
    photo.className = "photo";
    photo.alt = `${person.name || "Faculty"} photograph`;
    photo.loading = "lazy";

    const fallback = document.createElement("div");
    fallback.className = "photo-fallback";

    const remotePhotoUrl = photoUrlMap[person.slug] || person.photo_url || "";
    attachFacultyPhoto(photo, fallback, person.slug || "", person.name || "", "../images/faculty", remotePhotoUrl);
    photoFrame.appendChild(photo);
    photoFrame.appendChild(fallback);

    const content = document.createElement("div");
    content.className = "faculty-content";
    card.appendChild(content);

    const name = document.createElement("h3");
    name.textContent = person.name || "Faculty Member";
    content.appendChild(name);

    const profileLink = document.createElement("a");
    profileLink.href = `../faculty/?faculty=${encodeURIComponent(person.slug || "")}`;
    profileLink.textContent = "View Profile →";
    content.appendChild(profileLink);

    container.appendChild(card);
  }
}

loadFacultyList().catch(err => {
  const container = getDirectoryContainer();
  if (container) {
    container.innerHTML = '<article class="faculty-card faculty-loading">Failed to load faculty directory.</article>';
  }
  console.error(err);
});


