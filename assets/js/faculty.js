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
    const pubsRes = await fetch(`../data/${facultyData.publications_file}`, { cache: "no-cache" });
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

  const totalCitationsValue = publications.reduce((sum, pub) => {
    const citations = Number(pub.citations ?? 0);
    return sum + (Number.isFinite(citations) ? citations : 0);
  }, 0);

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

  container.appendChild(header);

  const sheetSections = Array.isArray(facultyData.sections) ? [...facultyData.sections] : [];

  const pageSections = [
    ...sheetSections,
    { id: "publications", title: "Publications", type: "publications" }
  ];

  const detailsLayout = document.createElement("section");
  detailsLayout.className = "details-layout";

  const menu = document.createElement("nav");
  menu.className = "details-menu";
  menu.setAttribute("aria-label", "Faculty detail sections");

  const photoCard = document.createElement("div");
  photoCard.className = "menu-photo-card";
  menu.appendChild(photoCard);
  photoCard.appendChild(photoWrap);

  const content = document.createElement("div");
  content.className = "details-content";

  const renderMarkdown = markdownText => {
    const lines = String(markdownText || "").split(/\r?\n/);
    let listElement = null;
    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) {
        listElement = null;
        return;
      }
      if (line.startsWith("- ")) {
        if (!listElement) {
          listElement = document.createElement("ul");
          listElement.className = "detail-list";
          content.appendChild(listElement);
        }
        const li = document.createElement("li");
        li.textContent = line.slice(2).trim();
        listElement.appendChild(li);
        return;
      }
      listElement = null;
      const p = document.createElement("p");
      p.className = "detail-markdown";
      p.textContent = line;
      content.appendChild(p);
    });
  };

  const renderSectionContent = section => {
    content.innerHTML = "";
    const heading = document.createElement("h3");
    heading.className = "detail-title";
    heading.textContent = section.title || "Section";
    content.appendChild(heading);

    if (section.type === "kv" && Array.isArray(section.items)) {
      const table = document.createElement("dl");
      table.className = "detail-kv";
      section.items.forEach(item => {
        const label = document.createElement("dt");
        label.textContent = item.label || "";
        const value = document.createElement("dd");
        value.textContent = item.value || "";
        table.appendChild(label);
        table.appendChild(value);
      });
      content.appendChild(table);
      return;
    }

    if (section.type === "markdown") {
      renderMarkdown(section.markdown || "");
      return;
    }

    if (section.type === "table") {
      const columns = Array.isArray(section.columns) ? section.columns : [];
      const rows = Array.isArray(section.rows) ? section.rows : [];
      if (!columns.length || !rows.length) {
        const empty = document.createElement("p");
        empty.className = "meta";
        empty.textContent = "No table data available.";
        content.appendChild(empty);
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "detail-table-wrap";

      const table = document.createElement("table");
      table.className = "detail-table";

      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      columns.forEach(col => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = col || "";
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      rows.forEach(row => {
        const tr = document.createElement("tr");
        columns.forEach((_, idx) => {
          const td = document.createElement("td");
          td.textContent = (row[idx] ?? "").toString();
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      content.appendChild(wrap);
      return;
    }

    if (section.type === "publications") {
      const pubStats = document.createElement("div");
      pubStats.className = "pub-stats";

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
      pubStats.appendChild(authorId);

      const total = document.createElement("p");
      total.className = "meta";
      total.textContent = `Total Publications: ${facultyData.total_publications ?? publications.length}`;
      pubStats.appendChild(total);

      const totalCitations = document.createElement("p");
      totalCitations.className = "meta";
      totalCitations.textContent = `Total Citations: ${totalCitationsValue}`;
      pubStats.appendChild(totalCitations);

      const hIndex = document.createElement("p");
      hIndex.className = "meta";
      hIndex.textContent = `h-index: ${facultyData.h_index ?? "N/A"}`;
      pubStats.appendChild(hIndex);

      content.appendChild(pubStats);

      buildPublicationsControls(publications, (controls, pager, resultsMeta, pubList) => {
        content.appendChild(controls);
        content.appendChild(pager);
        content.appendChild(resultsMeta);
        content.appendChild(pubList);
      });
      return;
    }

    const fallback = document.createElement("p");
    fallback.className = "meta";
    fallback.textContent = "Section content unavailable.";
    content.appendChild(fallback);
  };

  let activeSectionId = "";
  const buttons = [];

  const setActive = id => {
    activeSectionId = id;
    const target = pageSections.find(s => s.id === id) || pageSections[0];
    renderSectionContent(target);
    buttons.forEach(btn => {
      const isActive = btn.dataset.sectionId === target.id;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  pageSections.forEach((section, index) => {
    if (!section || typeof section !== "object") return;
    const id = (section.id || `section-${index + 1}`).trim();
    if (!id) return;
    const title = (section.title || `Section ${index + 1}`).trim();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "details-menu-item";
    btn.dataset.sectionId = id;
    btn.textContent = title;
    btn.addEventListener("click", () => setActive(id));
    buttons.push(btn);
    menu.appendChild(btn);
  });

  detailsLayout.appendChild(menu);
  detailsLayout.appendChild(content);
  container.appendChild(detailsLayout);

  if (buttons.length === 0) {
    const empty = document.createElement("p");
    empty.className = "meta";
    empty.textContent = "No additional details available.";
    content.appendChild(empty);
    return;
  }

  activeSectionId = buttons[0].dataset.sectionId || "";
  setActive(activeSectionId);
}

async function loadFacultyPage() {
  const facultyRes = await fetch("../faculty.json", { cache: "no-cache" });
  if (!facultyRes.ok) {
    throw new Error("Unable to load faculty list");
  }

  const facultyList = await facultyRes.json();
  const facultyMeta = await resolveFacultyMeta(facultyList);
  if (!facultyMeta) {
    setError("Faculty not found.");
    return;
  }

  const detailsRes = await fetch(`../data/${facultyMeta.slug}.json`, { cache: "no-cache" });
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
