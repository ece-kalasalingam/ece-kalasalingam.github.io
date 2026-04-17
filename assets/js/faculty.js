function getFacultyFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("faculty") || "").trim();
}

function getLegacyNameFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("name") || "").trim();
}

function getLegacySlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("slug") || "").trim();
}

function setError(message) {
  const container = document.getElementById("content");
  container.textContent = message;
}

function formatMonthYear(rawDate) {
  if (!rawDate || typeof rawDate !== "string") {
    return "Not available";
  }

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    const parts = rawDate.split("-");
    if (parts.length >= 2) {
      const year = parts[0];
      const month = Number(parts[1]);
      if (!Number.isNaN(month) && month >= 1 && month <= 12) {
        const monthName = new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
        return `${monthName} ${year}`;
      }
    }
    return rawDate;
  }

  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function extractYear(rawDate) {
  if (!rawDate || typeof rawDate !== "string") {
    return "";
  }
  const match = rawDate.match(/^(\d{4})/);
  return match ? match[1] : "";
}

function buildPublicationsControls(publications, renderCallback) {
  const controls = document.createElement("div");
  controls.className = "controls";

  const searchLabel = document.createElement("label");
  searchLabel.className = "sr-only";
  searchLabel.textContent = "Search publications";
  searchLabel.setAttribute("for", "pub-search");
  controls.appendChild(searchLabel);

  const searchInput = document.createElement("input");
  searchInput.className = "control";
  searchInput.type = "search";
  searchInput.id = "pub-search";
  searchInput.placeholder = "Search by title, source, or DOI";
  searchInput.setAttribute("aria-label", "Search publications by title, source, or DOI");
  controls.appendChild(searchInput);

  const yearFilter = document.createElement("select");
  yearFilter.className = "control";
  yearFilter.setAttribute("aria-label", "Filter by publication year");
  const allYearsOption = document.createElement("option");
  allYearsOption.value = "";
  allYearsOption.textContent = "All Years";
  yearFilter.appendChild(allYearsOption);
  const yearValues = [...new Set(publications.map(pub => extractYear(pub.date)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  for (const year of yearValues) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  }
  controls.appendChild(yearFilter);

  const sourceFilter = document.createElement("select");
  sourceFilter.className = "control";
  sourceFilter.setAttribute("aria-label", "Filter by publication source");
  const allSourcesOption = document.createElement("option");
  allSourcesOption.value = "";
  allSourcesOption.textContent = "All Sources";
  sourceFilter.appendChild(allSourcesOption);
  const sourceValues = [...new Set(publications.map(pub => (pub.source || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  for (const sourceName of sourceValues) {
    const option = document.createElement("option");
    option.value = sourceName;
    option.textContent = sourceName;
    sourceFilter.appendChild(option);
  }
  controls.appendChild(sourceFilter);

  const pager = document.createElement("div");
  pager.className = "pager";

  const pagerLeft = document.createElement("div");
  pagerLeft.className = "pager-left";
  pager.appendChild(pagerLeft);

  const pageSizeLabel = document.createElement("label");
  pageSizeLabel.textContent = "Per page:";
  pageSizeLabel.setAttribute("for", "page-size");
  pagerLeft.appendChild(pageSizeLabel);

  const pageSizeSelect = document.createElement("select");
  pageSizeSelect.id = "page-size";
  pageSizeSelect.className = "control";
  pageSizeSelect.style.maxWidth = "88px";
  pageSizeSelect.setAttribute("aria-label", "Select number of publications per page");
  [25, 50, 100].forEach(size => {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = String(size);
    pageSizeSelect.appendChild(option);
  });
  pageSizeSelect.value = "25";
  pagerLeft.appendChild(pageSizeSelect);

  const pagerActions = document.createElement("div");
  pagerActions.className = "pager-actions";
  pager.appendChild(pagerActions);

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn";
  prevBtn.type = "button";
  prevBtn.textContent = "Previous";
  prevBtn.setAttribute("aria-label", "Previous page");
  pagerActions.appendChild(prevBtn);

  const pageInfo = document.createElement("span");
  pageInfo.className = "meta";
  pageInfo.style.margin = "0";
  pageInfo.setAttribute("aria-live", "polite");
  pageInfo.setAttribute("aria-atomic", "true");
  pagerActions.appendChild(pageInfo);

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn";
  nextBtn.type = "button";
  nextBtn.textContent = "Next";
  nextBtn.setAttribute("aria-label", "Next page");
  pagerActions.appendChild(nextBtn);

  const resultsMeta = document.createElement("div");
  resultsMeta.className = "results-meta";
  resultsMeta.setAttribute("aria-live", "polite");
  resultsMeta.setAttribute("aria-atomic", "true");

  const pubList = document.createElement("div");
  pubList.className = "pub-list";

  let currentPage = 1;
  let searchDebounceTimer = null;

  const getFilteredPublications = () => {
    const query = searchInput.value.trim().toLowerCase();
    const selectedYear = yearFilter.value;
    const selectedSource = sourceFilter.value;

    return publications.filter(pub => {
      const pubTitleText = (pub.title || "").toLowerCase();
      const pubSourceText = (pub.source || "").toLowerCase();
      const pubDoiText = (pub.doi || "").toLowerCase();
      const year = extractYear(pub.date);

      const matchesSearch = !query || pubTitleText.includes(query) || pubSourceText.includes(query) || pubDoiText.includes(query);
      const matchesYear = !selectedYear || year === selectedYear;
      const matchesSource = !selectedSource || (pub.source || "").trim() === selectedSource;

      return matchesSearch && matchesYear && matchesSource;
    });
  };

  const renderPublicationList = () => {
    pubList.innerHTML = "";
    const filteredPublications = getFilteredPublications();
    const pageSize = Number(pageSizeSelect.value) || 25;
    const totalFiltered = filteredPublications.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalFiltered);
    const visiblePublications = filteredPublications.slice(start, end);

    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    resultsMeta.textContent = totalFiltered === 0 ? "0 results" : `Showing ${start + 1}-${end} of ${totalFiltered} results`;

    if (visiblePublications.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No publications match the current search/filter.";
      pubList.appendChild(empty);
      return;
    }

    visiblePublications.forEach((pub, index) => {
      const serialNumber = start + index + 1;
      const card = document.createElement("article");
      card.className = "pub";

      const pubHeading = document.createElement("h3");
      pubHeading.className = "pub-title";
      const titleText = pub.title || "Untitled";
      const publicationLink = pub.doi ? `https://doi.org/${pub.doi}` : (pub.link || "");
      if (publicationLink) {
        const titleAnchor = document.createElement("a");
        titleAnchor.href = publicationLink;
        titleAnchor.target = "_blank";
        titleAnchor.rel = "noopener noreferrer";
        titleAnchor.textContent = `${serialNumber}. ${titleText}`;
        pubHeading.appendChild(titleAnchor);
      } else {
        pubHeading.textContent = `${serialNumber}. ${titleText}`;
      }
      card.appendChild(pubHeading);

      const source = document.createElement("p");
      source.className = "meta";
      source.textContent = `Source: ${pub.source || "Unknown source"}`;
      card.appendChild(source);

      const published = document.createElement("p");
      published.className = "meta";
      published.textContent = `Published: ${formatMonthYear(pub.date)}`;
      card.appendChild(published);

      const citations = document.createElement("p");
      citations.className = "meta";
      citations.textContent = `Citations: ${pub.citations ?? 0}`;
      card.appendChild(citations);

      if (pub.doi) {
        const doi = document.createElement("p");
        doi.className = "meta";
        doi.textContent = `DOI: ${pub.doi}`;
        card.appendChild(doi);
      }

      pubList.appendChild(card);
    });
  };

  const onFilterChanged = () => {
    currentPage = 1;
    renderPublicationList();
  };

  searchInput.addEventListener("input", () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(onFilterChanged, 220);
  });
  yearFilter.addEventListener("change", onFilterChanged);
  sourceFilter.addEventListener("change", onFilterChanged);
  pageSizeSelect.addEventListener("change", onFilterChanged);
  prevBtn.addEventListener("click", () => {
    currentPage -= 1;
    renderPublicationList();
  });
  nextBtn.addEventListener("click", () => {
    currentPage += 1;
    renderPublicationList();
  });

  renderPublicationList();

  renderCallback(controls, pager, resultsMeta, pubList);
}

async function resolveFacultyMeta(facultyList) {
  const faculty = getFacultyFromQuery();
  const legacyName = getLegacyNameFromQuery();
  const legacySlug = getLegacySlugFromQuery();

  if (!Array.isArray(facultyList)) return null;
  if (faculty) return facultyList.find(f => f.slug === faculty) || null;
  if (legacyName) return facultyList.find(f => f.slug === legacyName || f.name === legacyName) || null;
  if (legacySlug) return facultyList.find(f => f.slug === legacySlug) || null;
  return null;
}

async function resolvePublicationsData(facultyData) {
  if (Array.isArray(facultyData.publications)) {
    return facultyData.publications;
  }
  if (typeof facultyData.publications_file === "string" && facultyData.publications_file.trim()) {
    const pubsRes = await fetch(`../data/${facultyData.publications_file}`);
    if (!pubsRes.ok) {
      throw new Error("Unable to load publications file");
    }
    const pubsPayload = await pubsRes.json();
    if (pubsPayload && Array.isArray(pubsPayload.publications)) {
      return pubsPayload.publications;
    }
  }
  return [];
}

function renderFacultyPage(facultyMeta, facultyData, publications) {
  const container = document.getElementById("content");
  container.innerHTML = "";

  const header = document.createElement("section");
  header.className = "header";

  const headerGrid = document.createElement("div");
  headerGrid.className = "header-grid";
  header.appendChild(headerGrid);

  const headerInfo = document.createElement("div");
  headerInfo.className = "header-info";
  headerGrid.appendChild(headerInfo);

  const title = document.createElement("h1");
  title.textContent = facultyMeta.name || facultyData.name || "Faculty Member";
  headerInfo.appendChild(title);

  const designation = document.createElement("p");
  designation.className = "meta";
  designation.textContent = `Designation: ${facultyMeta.designation || "N/A"}`;
  headerInfo.appendChild(designation);

  const authorId = document.createElement("p");
  authorId.className = "meta";
  const authorIdValue = facultyData.author_id || "";
  authorId.textContent = "Scopus Author ID: ";
  if (authorIdValue) {
    const authorLink = document.createElement("a");
    authorLink.href = `https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(authorIdValue)}`;
    authorLink.target = "_blank";
    authorLink.rel = "noopener noreferrer";
    authorLink.textContent = authorIdValue;
    authorId.appendChild(authorLink);
  } else {
    authorId.appendChild(document.createTextNode("N/A"));
  }
  headerInfo.appendChild(authorId);

  const total = document.createElement("p");
  total.className = "meta";
  total.textContent = `Total Publications: ${facultyData.total_publications ?? publications.length}`;
  headerInfo.appendChild(total);

  const totalCitationsValue = publications.reduce((sum, pub) => {
    const citations = Number(pub.citations ?? 0);
    return sum + (Number.isFinite(citations) ? citations : 0);
  }, 0);
  const totalCitations = document.createElement("p");
  totalCitations.className = "meta";
  totalCitations.textContent = `Total Citations: ${totalCitationsValue}`;
  headerInfo.appendChild(totalCitations);

  const hIndex = document.createElement("p");
  hIndex.className = "meta";
  hIndex.textContent = `h-index: ${facultyData.h_index ?? "N/A"}`;
  headerInfo.appendChild(hIndex);

  const photoWrap = document.createElement("div");
  photoWrap.className = "photo-wrap";

  const photo = document.createElement("img");
  photo.className = "photo";
  photo.alt = `${facultyMeta.name || "Faculty"} photograph`;
  photo.loading = "lazy";

  const fallback = document.createElement("div");
  fallback.className = "photo-fallback";

  attachFacultyPhoto(photo, fallback, facultyMeta.slug || "", facultyMeta.name || "", "../images/faculty");
  photoWrap.appendChild(photo);
  photoWrap.appendChild(fallback);
  headerGrid.appendChild(photoWrap);

  container.appendChild(header);

  const pubTitle = document.createElement("h2");
  pubTitle.className = "section-title";
  pubTitle.textContent = "Scopus Publications";
  container.appendChild(pubTitle);

  buildPublicationsControls(publications, (controls, pager, resultsMeta, pubList) => {
    container.appendChild(controls);
    container.appendChild(pager);
    container.appendChild(resultsMeta);
    container.appendChild(pubList);
  });

  const futureSection = document.createElement("h2");
  futureSection.className = "section-title";
  futureSection.textContent = "More Details";
  container.appendChild(futureSection);

  const futureText = document.createElement("p");
  futureText.className = "meta";
  futureText.textContent = "This page is ready for future additions like profile links, research areas, projects, and contact details.";
  container.appendChild(futureText);
}

async function loadFacultyPage() {
  const facultyRes = await fetch("../faculty.json");
  if (!facultyRes.ok) {
    throw new Error("Unable to load faculty list");
  }

  const facultyList = await facultyRes.json();
  const facultyMeta = await resolveFacultyMeta(facultyList);
  if (!facultyMeta) {
    setError("Faculty not found.");
    return;
  }

  const detailsRes = await fetch(`../data/${facultyMeta.slug}.json`);
  if (!detailsRes.ok) {
    setError("Publication data not found for this faculty.");
    return;
  }

  const facultyData = await detailsRes.json();
  const publications = await resolvePublicationsData(facultyData);
  renderFacultyPage(facultyMeta, facultyData, publications);
}

loadFacultyPage().catch(err => {
  setError("Failed to load faculty details.");
  console.error(err);
});
