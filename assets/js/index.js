async function loadFacultyList() {
  const facultyRes = await fetch("faculty.json", { cache: "no-cache" });
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
        const detailsRes = await fetch(`data/${encodeURIComponent(slug)}.json`, { cache: "no-cache" });
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

  const container = document.getElementById("content");
  container.innerHTML = "";

  const intro = document.createElement("p");
  intro.className = "subtext";
  intro.textContent = `${faculty.length} faculty members`;
  container.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "grid";

  for (const person of faculty) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = `faculty/?${encodeURIComponent(person.slug || "")}`;

    const photoWrap = document.createElement("div");
    photoWrap.className = "photo-wrap card-photo";
    card.appendChild(photoWrap);

    const photo = document.createElement("img");
    photo.className = "photo";
    photo.alt = `${person.name || "Faculty"} photograph`;
    photo.loading = "lazy";

    const fallback = document.createElement("div");
    fallback.className = "photo-fallback";

    const remotePhotoUrl = photoUrlMap[person.slug] || person.photo_url || "";
    attachFacultyPhoto(photo, fallback, person.slug || "", person.name || "", "images/faculty", remotePhotoUrl);
    photoWrap.appendChild(photo);
    photoWrap.appendChild(fallback);

    const name = document.createElement("h2");
    name.className = "name";
    name.textContent = person.name || "Faculty Member";
    card.appendChild(name);

    const designation = document.createElement("p");
    designation.className = "designation";
    designation.textContent = person.designation || "Faculty";
    card.appendChild(designation);

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

loadFacultyList().catch(err => {
  const container = document.getElementById("content");
  container.textContent = "Failed to load faculty list.";
  console.error(err);
});
