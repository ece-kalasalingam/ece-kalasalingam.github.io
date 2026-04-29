async function loadFacultyList() {
  const facultyRes = await fetch("faculty.json", { cache: "no-cache" });
  if (!facultyRes.ok) {
    throw new Error("Unable to load faculty.json");
  }
  const faculty = await facultyRes.json();
  if (!Array.isArray(faculty)) {
    throw new Error("faculty.json must be an array");
  }

  const container = document.getElementById("content");
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";

  for (const person of faculty) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = `faculty/?${encodeURIComponent(person.slug || "")}`;

    const top = document.createElement("div");
    top.className = "card-top";
    card.appendChild(top);

    const info = document.createElement("div");
    info.className = "card-info";
    top.appendChild(info);

    const name = document.createElement("h2");
    name.className = "name";
    name.textContent = person.name || "Faculty Member";
    info.appendChild(name);

    const designation = document.createElement("p");
    designation.className = "meta";
    designation.textContent = person.designation || "Designation not listed";
    info.appendChild(designation);

    const photoWrap = document.createElement("div");
    photoWrap.className = "photo-wrap";

    const photo = document.createElement("img");
    photo.className = "photo";
    photo.alt = `${person.name || "Faculty"} photograph`;
    photo.loading = "lazy";

    const fallback = document.createElement("div");
    fallback.className = "photo-fallback";

    attachFacultyPhoto(photo, fallback, person.slug || "", person.name || "", "images/faculty");
    photoWrap.appendChild(photo);
    photoWrap.appendChild(fallback);
    top.appendChild(photoWrap);

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

loadFacultyList().catch(err => {
  const container = document.getElementById("content");
  container.textContent = "Failed to load faculty list.";
  console.error(err);
});
