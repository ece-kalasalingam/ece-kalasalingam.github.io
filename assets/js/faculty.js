function getFacultyFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("faculty") || "").trim();
}

function getFacultyFromBareQuery() {
  const raw = window.location.search || "";
  if (!raw.startsWith("?")) return "";
  const stripped = raw.slice(1).trim();
  if (!stripped || stripped.includes("=") || stripped.includes("&")) return "";
  return decodeURIComponent(stripped).trim();
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

function normalizeLabel(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getProfileItems(facultyData) {
  const sections = Array.isArray(facultyData?.sections) ? facultyData.sections : [];
  const profileSection = sections.find(section => section && section.type === "kv" && normalizeLabel(section.title) === "profile");
  return Array.isArray(profileSection?.items) ? profileSection.items : [];
}

function getProfileValueByLabel(items, candidateLabels) {
  const labelSet = new Set(candidateLabels.map(normalizeLabel));
  const matched = items.find(item => labelSet.has(normalizeLabel(item?.label)));
  return String(matched?.value || "").trim();
}

function parseEmails(rawValue) {
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const matches = String(rawValue || "").match(emailPattern) || [];
  return [...new Set(matches.map(email => email.toLowerCase()))];
}

function parsePhones(rawValue) {
  const parts = String(rawValue || "")
    .split(/[,/|]/)
    .map(part => part.trim())
    .filter(Boolean);
  const phones = parts.filter(part => /[\d]{6,}/.test(part.replace(/[^\d+]/g, "")));
  return [...new Set(phones)];
}

function vcardEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function cleanFileName(value) {
  return String(value || "faculty")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildCanonicalFacultyProfileUrl(facultyMeta, facultyData) {
  const slug = String(facultyMeta?.slug || facultyData?.slug || "").trim();
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  if (!slug) return baseUrl;
  return `${baseUrl}?faculty=${encodeURIComponent(slug)}`;
}

function buildFacultyVcard(facultyMeta, facultyData) {
  const profileItems = getProfileItems(facultyData);
  const fullName = String(facultyData?.name || facultyMeta?.name || "Faculty Member").trim();
  const designationFromProfile = getProfileValueByLabel(profileItems, ["designation", "role", "position"]);
  const designation = designationFromProfile || String(facultyMeta?.designation || "").trim();
  const emailRaw = getProfileValueByLabel(profileItems, ["email", "e-mail", "mail"]);
  const phoneRaw = getProfileValueByLabel(profileItems, ["phone", "mobile", "contact", "telephone", "tel"]);
  const department = getProfileValueByLabel(profileItems, ["department", "dept"]);
  const office = getProfileValueByLabel(profileItems, ["office", "address", "location"]);
  const emails = parseEmails(emailRaw);
  const phones = parsePhones(phoneRaw);
  const profileUrl = buildCanonicalFacultyProfileUrl(facultyMeta, facultyData);
  const scopusId = String(facultyData?.scopus_id || facultyMeta?.scopus_id || "").trim();

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vcardEscape(fullName)}`,
    `ORG:${vcardEscape(
      department
        ? `Kalasalingam Academy of Research and Education;${department}`
        : "Kalasalingam Academy of Research and Education"
    )}`
  ];

  if (designation) lines.push(`TITLE:${vcardEscape(designation)}`);
  emails.forEach(email => lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(email)}`));
  phones.forEach(phone => lines.push(`TEL;TYPE=WORK,VOICE:${vcardEscape(phone)}`));
  if (office) lines.push(`ADR;TYPE=WORK:;;${vcardEscape(office)};;;;`);
  lines.push(`URL:${vcardEscape(profileUrl)}`);
  if (scopusId) {
    lines.push(`URL;TYPE=SCOPUS:${vcardEscape(`https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(scopusId)}`)}`);
  }
  lines.push("END:VCARD");

  return `${lines.join("\r\n")}\r\n`;
}

function triggerVcardDownload(facultyMeta, facultyData) {
  const vcardText = buildFacultyVcard(facultyMeta, facultyData);
  const blob = new Blob([vcardText], { type: "text/vcard;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const fallbackName = facultyMeta?.slug || facultyData?.slug || facultyData?.name || facultyMeta?.name || "faculty";
  anchor.href = objectUrl;
  anchor.download = `${cleanFileName(fallbackName)}.vcf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildVcardQrUrl(facultyMeta, facultyData) {
  const vcardText = buildFacultyVcard(facultyMeta, facultyData);
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(vcardText)}`;
}

function createQrModal(facultyMeta, facultyData) {
  const fullName = facultyMeta.name || facultyData.name || "Faculty";
  const designation = String(facultyMeta.designation || "").trim();
  const profileItems = getProfileItems(facultyData);
  const department = getProfileValueByLabel(profileItems, ["department", "dept"]);
  const email = parseEmails(getProfileValueByLabel(profileItems, ["email", "e-mail", "mail"]))[0] || "";
  const phone = parsePhones(getProfileValueByLabel(profileItems, ["phone", "mobile", "contact", "telephone", "tel"]))[0] || "";
  const overlay = document.createElement("div");
  overlay.className = "qr-modal-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  const dialog = document.createElement("section");
  dialog.className = "qr-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", `Contact QR for ${fullName}`);
  overlay.appendChild(dialog);

  const title = document.createElement("h2");
  title.className = "qr-title";
  title.textContent = "Scan to Add Contact";
  dialog.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "meta";
  subtitle.textContent = fullName;
  dialog.appendChild(subtitle);

  const helper = document.createElement("p");
  helper.className = "meta";
  helper.textContent = "Open your phone camera and scan. Most phones will show Add Contact directly.";
  dialog.appendChild(helper);

  const qrCard = document.createElement("div");
  qrCard.className = "qr-card";
  dialog.appendChild(qrCard);

  const qrCardLeft = document.createElement("div");
  qrCardLeft.className = "qr-card-left";
  qrCard.appendChild(qrCardLeft);

  const qrCardPhotoWrap = document.createElement("div");
  qrCardPhotoWrap.className = "qr-card-photo-wrap";
  qrCardLeft.appendChild(qrCardPhotoWrap);

  const qrCardPhoto = document.createElement("img");
  qrCardPhoto.className = "qr-card-photo";
  qrCardPhoto.alt = `${fullName} photograph`;
  qrCardPhoto.loading = "lazy";
  qrCardPhotoWrap.appendChild(qrCardPhoto);

  const qrCardPhotoFallback = document.createElement("div");
  qrCardPhotoFallback.className = "qr-card-photo-fallback";
  qrCardPhotoWrap.appendChild(qrCardPhotoFallback);

  attachFacultyPhoto(qrCardPhoto, qrCardPhotoFallback, facultyMeta.slug || "", fullName, "../images/faculty");

  const qrCardName = document.createElement("p");
  qrCardName.className = "qr-card-name";
  qrCardName.textContent = fullName;
  qrCardLeft.appendChild(qrCardName);

  if (designation) {
    const qrCardDesignation = document.createElement("p");
    qrCardDesignation.className = "qr-card-designation";
    qrCardDesignation.textContent = designation;
    qrCardLeft.appendChild(qrCardDesignation);
  }

  if (department) {
    const qrCardDepartment = document.createElement("p");
    qrCardDepartment.className = "qr-card-department";
    qrCardDepartment.textContent = department;
    qrCardLeft.appendChild(qrCardDepartment);
  }

  const qrCardInstitute = document.createElement("p");
  qrCardInstitute.className = "qr-card-institute";
  qrCardInstitute.textContent = "Kalasalingam Academy of Research and Education";
  qrCardLeft.appendChild(qrCardInstitute);

  if (email || phone) {
    const qrCardContact = document.createElement("div");
    qrCardContact.className = "qr-card-contact";
    if (email) {
      const emailLine = document.createElement("p");
      emailLine.className = "qr-card-contact-line";
      emailLine.textContent = email;
      qrCardContact.appendChild(emailLine);
    }
    if (phone) {
      const phoneLine = document.createElement("p");
      phoneLine.className = "qr-card-contact-line";
      phoneLine.textContent = phone;
      qrCardContact.appendChild(phoneLine);
    }
    qrCardLeft.appendChild(qrCardContact);
  }

  const qrCardRight = document.createElement("div");
  qrCardRight.className = "qr-card-right";
  qrCard.appendChild(qrCardRight);

  const qrCardRightLabel = document.createElement("p");
  qrCardRightLabel.className = "qr-card-qr-label";
  qrCardRightLabel.textContent = "SCAN TO SAVE CONTACT";
  qrCardRight.appendChild(qrCardRightLabel);

  const qrImage = document.createElement("img");
  qrImage.className = "qr-image";
  qrImage.loading = "lazy";
  qrImage.alt = `QR code to add ${fullName} as a contact`;
  qrImage.src = buildVcardQrUrl(facultyMeta, facultyData);
  qrCardRight.appendChild(qrImage);

  const actions = document.createElement("div");
  actions.className = "qr-modal-actions";
  dialog.appendChild(actions);

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "btn";
  downloadBtn.textContent = "Download vCard";
  downloadBtn.addEventListener("click", () => triggerVcardDownload(facultyMeta, facultyData));
  actions.appendChild(downloadBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn";
  closeBtn.textContent = "Close";
  actions.appendChild(closeBtn);

  function closeModal() {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function openModal() {
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) {
      closeModal();
    }
  });

  return { overlay, openModal, closeModal };
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

function isSafeExternalUrl(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return false;
  const value = rawValue.trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname) return false;
    if (parsed.username || parsed.password) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function normalizeCandidateUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (/^www\./i.test(value)) {
    return `https://${value}`;
  }
  return value;
}

function appendSafeLinkedText(container, rawText) {
  const text = String(rawText ?? "");
  const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let lastIndex = 0;
  let match = urlPattern.exec(text);

  while (match) {
    const urlText = match[0];
    const start = match.index;
    if (start > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }

    const normalizedUrl = normalizeCandidateUrl(urlText);
    if (isSafeExternalUrl(normalizedUrl)) {
      const link = document.createElement("a");
      link.href = normalizedUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer nofollow";
      link.textContent = urlText;
      container.appendChild(link);
    } else {
      container.appendChild(document.createTextNode(urlText));
    }

    lastIndex = start + urlText.length;
    match = urlPattern.exec(text);
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function buildPublicationsControls(publications, renderCallback) {
  const root = document.createElement("div");
  const pubList = document.createElement("div");
  pubList.className = "pub-list";
  const yearValues = [...new Set(publications.map(pub => extractYear(pub.date)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const sourceValues = [...new Set(publications.map(pub => (pub.source || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  let currentPage = 1;
  const state = { query: "", year: "", source: "", pageSize: 25 };
  const sets = [];

  function createControlSet(position) {
    const controls = document.createElement("div");
    controls.className = "controls";

    const searchLabel = document.createElement("label");
    searchLabel.className = "sr-only";
    searchLabel.textContent = "Search publications";
    searchLabel.setAttribute("for", `pub-search-${position}`);
    controls.appendChild(searchLabel);

    const searchInput = document.createElement("input");
    searchInput.className = "control";
    searchInput.type = "search";
    searchInput.id = `pub-search-${position}`;
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
    pageSizeLabel.setAttribute("for", `page-size-${position}`);
    pagerLeft.appendChild(pageSizeLabel);

    const pageSizeSelect = document.createElement("select");
    pageSizeSelect.id = `page-size-${position}`;
    pageSizeSelect.className = "control";
    pageSizeSelect.style.maxWidth = "88px";
    pageSizeSelect.setAttribute("aria-label", "Select number of publications per page");
    [25, 50, 100].forEach(size => {
      const option = document.createElement("option");
      option.value = String(size);
      option.textContent = String(size);
      pageSizeSelect.appendChild(option);
    });
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

    return { controls, searchInput, yearFilter, sourceFilter, pager, pageSizeSelect, prevBtn, pageInfo, nextBtn, resultsMeta };
  }

  function syncAllControls() {
    for (const set of sets) {
      set.searchInput.value = state.query;
      set.yearFilter.value = state.year;
      set.sourceFilter.value = state.source;
      set.pageSizeSelect.value = String(state.pageSize);
    }
  }

  const getFilteredPublications = () => {
    return publications.filter(pub => {
      const pubTitleText = (pub.title || "").toLowerCase();
      const pubSourceText = (pub.source || "").toLowerCase();
      const pubDoiText = (pub.doi || "").toLowerCase();
      const year = extractYear(pub.date);

      const matchesSearch = !state.query || pubTitleText.includes(state.query) || pubSourceText.includes(state.query) || pubDoiText.includes(state.query);
      const matchesYear = !state.year || year === state.year;
      const matchesSource = !state.source || (pub.source || "").trim() === state.source;
      return matchesSearch && matchesYear && matchesSource;
    });
  };

  const renderPublicationList = () => {
    pubList.innerHTML = "";
    const filteredPublications = getFilteredPublications();
    const pageSize = state.pageSize;
    const totalFiltered = filteredPublications.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalFiltered);
    const visiblePublications = filteredPublications.slice(start, end);

    for (const set of sets) {
      set.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      set.prevBtn.disabled = currentPage <= 1;
      set.nextBtn.disabled = currentPage >= totalPages;
      set.resultsMeta.textContent = totalFiltered === 0 ? "0 results" : `Showing ${start + 1}-${end} of ${totalFiltered} results`;
    }

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
    syncAllControls();
    renderPublicationList();
  };

  function bindControlSet(set) {
    let searchDebounceTimer = null;
    set.searchInput.addEventListener("input", () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        state.query = set.searchInput.value.trim().toLowerCase();
        onFilterChanged();
      }, 220);
    });
    set.yearFilter.addEventListener("change", () => {
      state.year = set.yearFilter.value;
      onFilterChanged();
    });
    set.sourceFilter.addEventListener("change", () => {
      state.source = set.sourceFilter.value;
      onFilterChanged();
    });
    set.pageSizeSelect.addEventListener("change", () => {
      state.pageSize = Number(set.pageSizeSelect.value) || 25;
      onFilterChanged();
    });
    set.prevBtn.addEventListener("click", () => {
      currentPage -= 1;
      syncAllControls();
      renderPublicationList();
    });
    set.nextBtn.addEventListener("click", () => {
      currentPage += 1;
      syncAllControls();
      renderPublicationList();
    });
  }

  const topSet = createControlSet("top");
  const bottomSet = createControlSet("bottom");
  sets.push(topSet, bottomSet);
  bindControlSet(topSet);
  bindControlSet(bottomSet);
  syncAllControls();

  root.appendChild(topSet.controls);
  root.appendChild(topSet.pager);
  root.appendChild(topSet.resultsMeta);
  root.appendChild(pubList);
  root.appendChild(bottomSet.controls);
  root.appendChild(bottomSet.pager);
  root.appendChild(bottomSet.resultsMeta);

  renderPublicationList();
  renderCallback(root);
}

async function resolveFacultyMeta(facultyList) {
  const faculty = getFacultyFromQuery();
  const bareFaculty = getFacultyFromBareQuery();
  const legacyName = getLegacyNameFromQuery();
  const legacySlug = getLegacySlugFromQuery();

  if (!Array.isArray(facultyList)) return null;
  if (faculty) return facultyList.find(f => f.slug === faculty) || null;
  if (bareFaculty) return facultyList.find(f => f.slug === bareFaculty) || null;
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
    if (pubsRes.ok) {
      const pubsPayload = await pubsRes.json();
      if (pubsPayload && Array.isArray(pubsPayload.publications)) {
        return pubsPayload.publications;
      }
    }
  }
  return [];
}

function renderFacultyPage(facultyMeta, facultyData, publications) {
  document.title = "Faculty Profile";
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

  const headerActions = document.createElement("div");
  headerActions.className = "header-actions";
  const vcardButton = document.createElement("button");
  vcardButton.type = "button";
  vcardButton.className = "btn";
  vcardButton.textContent = "Download vCard";
  vcardButton.setAttribute("aria-label", "Download this faculty contact as a vCard");
  headerActions.appendChild(vcardButton);

  const qrButton = document.createElement("button");
  qrButton.type = "button";
  qrButton.className = "btn";
  qrButton.textContent = "Show Contact QR";
  qrButton.setAttribute("aria-label", "Show QR code to add this faculty contact");
  headerActions.appendChild(qrButton);

  const pdfButton = document.createElement("button");
  pdfButton.type = "button";
  pdfButton.className = "btn";
  pdfButton.textContent = "Download Profile as PDF";
  pdfButton.setAttribute("aria-label", "Download this faculty profile as PDF");
  headerActions.appendChild(pdfButton);
  headerInfo.appendChild(headerActions);

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
  const qrModal = createQrModal(facultyMeta, facultyData);
  container.appendChild(qrModal.overlay);

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
  const printAllSections = document.createElement("section");
  printAllSections.className = "print-all-sections";

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
        appendSafeLinkedText(li, line.slice(2).trim());
        listElement.appendChild(li);
        return;
      }
      listElement = null;
      const p = document.createElement("p");
      p.className = "detail-markdown";
      appendSafeLinkedText(p, line);
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
        appendSafeLinkedText(value, item.value || "");
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
          appendSafeLinkedText(td, (row[idx] ?? "").toString());
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
      const authorIdValue = facultyData.scopus_id || facultyData.author_id || "";
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

      buildPublicationsControls(publications, (publicationsBlock) => {
        content.appendChild(publicationsBlock);
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
  container.appendChild(printAllSections);

  if (buttons.length === 0) {
    const empty = document.createElement("p");
    empty.className = "meta";
    empty.textContent = "No additional details available.";
    content.appendChild(empty);
    return;
  }

  activeSectionId = buttons[0].dataset.sectionId || "";
  setActive(activeSectionId);

  const buildAllSectionsForPrint = () => {
    printAllSections.innerHTML = "";
    const originalActiveSectionId = activeSectionId;

    buttons.forEach(btn => {
      const sectionId = btn.dataset.sectionId || "";
      const section = pageSections.find(s => s.id === sectionId);
      if (!section) return;

      const wrapper = document.createElement("section");
      wrapper.className = "print-section";

      const heading = document.createElement("h3");
      heading.className = "detail-title";
      heading.textContent = section.title || "Section";
      wrapper.appendChild(heading);

      if (section.type === "publications") {
        const pubStats = document.createElement("div");
        pubStats.className = "pub-stats";

        const authorId = document.createElement("p");
        authorId.className = "meta";
        authorId.textContent = `Scopus Author ID: ${facultyData.scopus_id || facultyData.author_id || "N/A"}`;
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

        wrapper.appendChild(pubStats);

        if (!publications.length) {
          const empty = document.createElement("p");
          empty.className = "empty";
          empty.textContent = "No publications available.";
          wrapper.appendChild(empty);
        } else {
          const pubList = document.createElement("div");
          pubList.className = "pub-list";
          publications.forEach((pub, index) => {
            const serialNumber = index + 1;
            const card = document.createElement("article");
            card.className = "pub";

            const pubHeading = document.createElement("h3");
            pubHeading.className = "pub-title";
            pubHeading.textContent = `${serialNumber}. ${pub.title || "Untitled"}`;
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
          wrapper.appendChild(pubList);
        }
      } else {
        setActive(sectionId);
        Array.from(content.children).forEach(node => {
          if (!node.classList || !node.classList.contains("detail-title")) {
            wrapper.appendChild(node.cloneNode(true));
          }
        });
      }

      printAllSections.appendChild(wrapper);
    });

    setActive(originalActiveSectionId);
  };

  pdfButton.addEventListener("click", () => {
    buildAllSectionsForPrint();
    window.print();
  });

  vcardButton.addEventListener("click", () => {
    triggerVcardDownload(facultyMeta, facultyData);
  });

  qrButton.addEventListener("click", () => {
    qrModal.openModal();
  });

  // Show the QR modal on initial page load for quick contact sharing.
  qrModal.openModal();
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
  let facultyData;
  if (!detailsRes.ok) {
    facultyData = {
      name: facultyMeta.name || "Faculty Member",
      slug: facultyMeta.slug || "",
      scopus_id: facultyMeta.scopus_id || "NA",
      total_publications: 0,
      h_index: null,
      sections: []
    };
  } else {
    facultyData = await detailsRes.json();
  }

  const publications = await resolvePublicationsData(facultyData);
  renderFacultyPage(facultyMeta, facultyData, publications);
}

loadFacultyPage().catch(err => {
  setError("Failed to load faculty details.");
  console.error(err);
});
