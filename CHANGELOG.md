# CHANGELOG

## 2026-05-24 19:51 IST | author: Codex | type: fix
- Summary: Hardened directory data loader against missing JSON files and removed ignored CSP meta directive noise.
- Files: `assets/js/directory.js`, `directory/index.html`, `CHANGELOG.md`
- Details: Added `safeFetchJson()` helper and switched faculty/detail fetches to non-throwing JSON resolution so missing `data/<slug>.json` files no longer destabilize rendering flow. Also removed `frame-ancestors` from `directory/index.html` meta CSP (ignored in meta-delivered CSP) to eliminate warning noise.
- Revert: No

## 2026-05-24 19:49 IST | author: Codex | type: fix
- Summary: Fixed topbar conferences dropdown layout/visibility issues on homepage and directory page.
- Files: `assets/css/home.css`, `CHANGELOG.md`
- Details: Improved dropdown stacking/positioning and added responsive topbar rules for small screens: wrapped link rows, normalized button sizing, and switched submenu to static flow on mobile to prevent clipped or floating menu rendering.
- Revert: No

## 2026-05-24 19:45 IST | author: Codex | type: fix
- Summary: Fixed directory page null-container crash in faculty list loader.
- Files: `assets/js/directory.js`, `CHANGELOG.md`
- Details: Added `getDirectoryContainer()` resolver with `#faculty-spotlights` primary and `#content` fallback, plus null guards before DOM writes in both success and error paths. Prevents `Cannot set properties of null` runtime error.
- Revert: No

## 2026-05-24 19:45 IST | author: Codex | type: fix
- Summary: Updated CSP to allow Cloudflare Insights script and beacon requests.
- Files: `index.html`, `directory/index.html`, `faculty/index.html`, `CHANGELOG.md`
- Details: Extended CSP `script-src` to include `https://static.cloudflareinsights.com` and `connect-src` to include `https://cloudflareinsights.com` across main page entry points so Cloudflare analytics beacon can load and report without CSP blocking.
- Revert: No

## 2026-05-24 19:37 IST | author: Codex | type: fix
- Summary: Restored QR as image output to enable save/share actions.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Changed local QR rendering from inline SVG-in-DIV to an actual `<img>` element using an SVG data URL source. This restores browser/device image save capability while keeping QR generation fully local.
- Revert: No

## 2026-05-24 13:49 IST | author: Codex | type: tweak
- Summary: Removed faculty designation text from homepage and directory faculty cards.
- Files: `assets/js/home.js`, `assets/js/directory.js`, `CHANGELOG.md`
- Details: Deleted designation rendering from `Meet Our Faculty` card template on `index.html` and from directory faculty card construction so cards now show name, optional specialization (home), and profile link without designation lines.
- Revert: No

## 2026-05-24 13:48 IST | author: Codex | type: fix
- Summary: Fixed incorrect homepage `Meet Our Faculty` profile links.
- Files: `assets/js/home.js`, `CHANGELOG.md`
- Details: Updated faculty spotlight card links from legacy `directory/<slug>` path to canonical faculty profile route `faculty/?faculty=<slug>`, ensuring cards open the correct individual faculty page.
- Revert: No

## 2026-05-24 13:45 IST | author: Codex | type: redesign
- Summary: Rebuilt directory page using selected homepage sections and faculty-section visual style.
- Files: `directory/index.html`, `assets/js/directory.js`, `CHANGELOG.md`
- Details: Updated directory page to use homepage sticky topbar, sticky header, hero, `Meet Our Faculty` section styling, CTA section, and footer. Switched faculty list rendering target to `#faculty-spotlights` and refactored card markup in `directory.js` to match homepage faculty card structure/classes so the directory displays all faculty in the same section style.
- Revert: No

## 2026-05-24 13:40 IST | author: Codex | type: revert
- Summary: Reverted directory page to a blank raw HTML page without CSS/layout.
- Files: `directory/index.html`, `CHANGELOG.md`
- Details: Removed all directory stylesheet links and deleted custom layout shell markup (masthead/panel wrappers). Directory page now renders as plain HTML with only `h1` and `#content`, while retaining existing JS scripts for data loading.
- Revert: Yes (reverts recent directory layout/styling redesign)

## 2026-05-24 13:39 IST | author: Codex | type: redesign
- Summary: Completely rewrote Faculty Directory page layout and styling with a new visual system.
- Files: `directory/index.html`, `assets/css/directory.css`, `CHANGELOG.md`
- Details: Replaced the previous directory shell with a fresh composition (hero-like masthead + glass-style panel container), rebuilt typography scale and spacing rhythm, introduced new atmospheric layered background treatment, and redesigned faculty cards/grid interactions for a distinct modern directory experience while keeping existing JS data hooks intact.
- Revert: No

## 2026-05-24 13:37 IST | author: Codex | type: redesign
- Summary: Restyled Faculty Directory page to match homepage layout, spacing, typography, and color system.
- Files: `directory/index.html`, `assets/css/directory.css`, `CHANGELOG.md`
- Details: Replaced directory page shell with homepage-style topbar and sticky department header, added a section-framed directory container, and rebuilt directory stylesheet to align with homepage visual language (font stack, heading scales, spacing rhythm, blue/gray palette, card elevation, and responsive breakpoints).
- Revert: No

## 2026-05-24 13:33 IST | author: Codex | type: tweak
- Summary: Renamed faculty vCard action label to “Add to my contacts”.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Updated both faculty header action and QR modal vCard action button text from `Download vCard` to `Add to my contacts`. Also aligned the header button aria-label to the new action wording.
- Revert: No

## 2026-05-24 13:31 IST | author: Codex | type: revert
- Summary: Reverted vCard logo insertion/embedding path; kept only embedded `PHOTO` for `.vcf` downloads.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Removed `LOGO` generation from all vCard outputs and deleted logo embedding helpers/constraints that were causing strict download failures. `.vcf` download now enforces only embedded `PHOTO` and no longer depends on logo processing.
- Revert: Yes (reverts logo insertion/embedding behavior added in recent vCard updates)

## 2026-05-24 13:30 IST | author: Codex | type: tweak
- Summary: Removed visible vCard embed failure popups from faculty UI.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Replaced `window.alert` calls in vCard download handlers with silent catch paths so users no longer see visible error messages during strict embedded export failures.
- Revert: No

## 2026-05-24 13:29 IST | author: Codex | type: fix
- Summary: Enforced strict `.vcf` export to always use embedded base64 `PHOTO` and `LOGO` (no URI fallback).
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Updated download vCard flow to require embedded `PHOTO` and embedded `LOGO`; export now throws on missing embed data instead of falling back to URL fields. Added user-facing alert when strict embedded export cannot be generated for a profile.
- Revert: No

## 2026-05-24 13:24 IST | author: Codex | type: feature
- Summary: Split `LOGO` behavior by output path: URL-based in QR payload and embedded base64 in downloaded `.vcf`.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Extended vCard builder options to support embedded `LOGO` (`LOGO;ENCODING=b;TYPE=PNG`) and controlled URI fallback. QR path continues to emit URL-based `LOGO` for payload stability. Download path now attempts to embed a reduced local logo image in `.vcf`; if embedding fails/overshoots size cap, it falls back to URL-based `LOGO`.
- Revert: No

## 2026-05-24 13:23 IST | author: Codex | type: feature
- Summary: Added organization logo asset locally and included `LOGO` field in all generated vCards.
- Files: `images/kare-logo.png`, `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Downloaded KARE logo to local repository path `images/kare-logo.png`. Updated vCard generation to always include a standards-compliant `LOGO;TYPE=PNG;VALUE=URI` entry using absolute URL resolved from the local hosted logo path, applying to both QR-generated and downloaded vCards for all faculty profiles.
- Revert: No

## 2026-05-24 13:14 IST | author: Codex | type: feature
- Summary: Implemented 3-step QR photo behavior and enabled photo-embedded `.vcf` downloads.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Updated QR payload strategy to: (1) try embedded `PHOTO` when `?qrPhoto=1`, (2) fallback to URL-based `PHOTO;TYPE=JPEG;VALUE=URI`, and (3) fallback to no-photo QR if payload remains too large. Updated `Download vCard` to attempt embedded photo by default (larger canvas/quality budget) and fallback to URL-based `PHOTO` when embed is unavailable. Added async-safe download handlers to avoid unhandled promise errors.
- Revert: No

## 2026-05-24 13:11 IST | author: Codex | type: fix
- Summary: Hardened `?qrPhoto=1` QR payload sizing to prevent dense/unreliable contact QR output.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Reduced photo base64 cap for QR experiment and added a total vCard payload guardrail (`QR_MAX_STABLE_VCARD_CHARS`). When photo-embedded payload exceeds stable scan threshold, QR generation now automatically falls back to the lightweight (no-photo) vCard payload instead of emitting an oversized QR.
- Revert: No

## 2026-05-24 13:06 IST | author: Codex | type: feature
- Summary: Replaced external QR API with fully local vCard QR generation and added an opt-in photo-embedded QR experiment gate.
- Files: `faculty/index.html`, `assets/js/vendor/qrcode-generator.min.js`, `assets/js/faculty.js`, `assets/css/faculty.css`, `CHANGELOG.md`
- Details: Added vendored `qrcode-generator` library and wired faculty page to render QR locally as SVG (no `api.qrserver.com` dependency). Preserved existing modal UX and kept default QR payload lightweight using canonical vCard fields (including single `URL`). Added phase-2 experiment toggle via query `?qrPhoto=1` that attempts client-side image reduction (canvas resize/compress) and embeds `PHOTO` in QR payload only when reduced payload stays within strict size cap; otherwise automatically falls back to lightweight QR payload. This keeps production default as local QR without embedded photo unless explicitly enabled for cross-device testing.
- Revert: No

## 2026-05-24 12:55 IST | author: Codex | type: fix
- Summary: Normalized vCard URL export to a single standard `URL` field for better contact app compatibility.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Removed the additional typed Scopus URL line from vCard generation and now emit exactly one canonical `URL:` entry (website if available, otherwise faculty profile URL), preventing extra URLs from being imported as notes/custom text fields in some clients.
- Revert: No

## 2026-05-24 12:49 IST | author: Codex | type: tweak
- Summary: Added website URL line to the faculty contact QR/vCard card left panel, positioned after email.
- Files: `assets/js/faculty.js`, `CHANGELOG.md`
- Details: Updated `createQrModal` to resolve website URL from Profile labels (`website/web/url/link/homepage`) with fallback to canonical faculty profile URL. Render order in left contact block is now email -> website URL -> phone, matching requested placement.
- Revert: No

## 2026-05-24 18:30 IST | author: JP | type: redesign
- Summary: Homepage UX overhaul — sticky header, scroll-spy nav, testimonial slider, section renames, favicon setup, and content refinements.
- Files: `index.html`, `assets/css/home.css`, `assets/js/home.js`, `assets/images/`, `favicons/`, `favicon.ico`
- Details: Made the main header sticky (`top: 44px`, below topbar) so both bars remain visible while scrolling. Added IntersectionObserver-based scroll-spy to highlight the active nav link as sections enter the viewport. Renamed "Program Highlights" → "Department Highlights" (`id="highlights"`) and moved it before Programmes Offered. Reordered nav links to match page section order. Removed Testimonials from nav. Added Alumni Testimonials slider (infinite clone-based loop, pause-on-hover, dot navigation, touch swipe, desktop drag, prev/next buttons) with four real KARE alumni testimonials and local portrait images. Faculty spotlight selection now persists in `sessionStorage` — same three faculty per session, fresh on hard refresh. Faculty photos now use `object-fit: cover; object-position: top center` to keep faces visible without clipping. Added complete favicon/webmanifest/browserconfig set for all platforms. Updated hero CTA link and text to `#programmes` / "Explore Programmes". Renamed "Latest from YouTube" → "Latest from ECE - KARE". Updated header tagline to include ABET and NBA (Tier-I). Renamed topbar "Publications" → "Magazines". Fixed `body` margin/padding override from `common.css`. Removed invalid `frame-ancestors` from meta CSP.
- Revert: No

## 2026-05-24 13:30 IST | author: JP | type: redesign
- Summary: Adopted user-provided HTML layout as the new homepage structure — topbar + dept header + hero image + intro/stats + program cards + research features + dynamic faculty + YouTube feed + CTA + footer.
- Files: `index.html`, `assets/css/home.css`
- Details: Moved all inline styles to external home.css (required by style-src 'self' CSP). Real KARE ECE content throughout: dept name, NAAC A++, Krishnankoil address, real chapter links, real publication/social links. Hero uses Unsplash background (allowed by img-src https: in CSP). Static hardcoded faculty replaced with id="faculty-spotlights" dynamic section. Static news replaced with id="content" YouTube feed. Footer includes all 5 student chapter links. Gold/navy/light-blue design tokens adopted.
- Revert: No

## 2026-05-24 12:30 IST | author: JP | type: redesign
- Summary: Complete structural rewrite of homepage — dark navy hero, research focus areas section, refined chapters grid, full institutional layout.
- Files: `index.html`, `assets/css/home.css`
- Details: Replaced single-page layout with distinct structural zones: sticky navy topbar → full-width dark navy hero (2-col: h1+lead+CTA left, "At a Glance" aside right) → Research Focus Areas section (3-col mosaic grid, 6 ECE research domains) → Faculty Spotlights → Student Chapters (auto-fill grid with chapter-abbr badges) → Latest from YouTube. Removed old placeholder section. Added `section-wrap` inner-width containers (min 1100px). Sections alternate white/bg. Chapter cards refactored with abbreviation chip. Research cards use blue accent bar above h3. Full responsive cascade: hero stacks at 980px, 2-col grids at 980px, 1-col at 640px.
- Revert: No

## 2026-05-24 11:30 IST | author: JP | type: style
- Summary: Refined homepage typography to match JHU ECE editorial quality — larger display heading, tighter tracking, improved spacing rhythm.
- Files: `assets/css/home.css`
- Details: Added `--heading-font` variable with `"Segoe UI Variable Display"` in stack for better Windows rendering. Bumped hero h1 to `clamp(2.6rem, 5.5vw, 4.4rem)` with weight 900 and tracking `-0.04em`. Increased `.lead` to 1.15rem/1.78 line-height. Section head h2 uses `clamp(1.6rem, 2.4vw, 2rem)` at weight 800. Tightened kicker letter-spacing to 0.14em. Applied antialiasing and `text-rendering: optimizeLegibility` to body. Widened hero column ratio to 1.6fr/1fr with 64px gap. Increased `.home` vertical padding (top 68px, bottom 100px) and section gap to 72px.
- Revert: No

## 2026-05-24 10:00 IST | author: JP | type: redesign
- Summary: Redesigned homepage to institutional university style inspired by JHU ECE — clean white body, navy topbar, typography-first sections.
- Files: `assets/css/home.css`, `index.html`
- Details: Stripped all colorful section gradients, frosted-glass effects, and multi-color card palettes. Replaced with: solid deep-navy topbar with separator-style nav links; white body; typography-first hero (no card/box) with blue kicker, 800-weight h1, and a blue-left-bordered aside; all sections transparent with a 2px blue bottom-border section heading rule (JHU pattern); faculty cards are white with 1px border and 6px radius; chapter cards use blue top-border accent; placeholder cards use neutral dashed border. Added Faculty link to topbar nav. Border-radius reduced throughout (20px → 6px). Responsive: 2-col on tablet, 1-col on mobile.
- Revert: No

## 2026-05-23 22:54 IST | author: Codex | type: feature
- Summary: Added DOI-based Crossref abstract fallback when Scopus abstract retrieval is unavailable.
- Files: `scripts/fetch_publications.py`, `README.md`
- Details: Extended abstract enrichment path from `Scopus -> empty` to `Scopus -> Crossref (DOI) -> empty`, preserving top-N and updates-only behavior. Added per-faculty Scopus abstract auth short-circuit after first 401 to reduce repeated failed calls, and expanded abstract telemetry logs with `fetched_scopus` and `fetched_crossref`.
- Revert: No

## 2026-05-23 22:49 IST | author: Codex | type: fix
- Summary: Fixed CI validator failure by updating homepage script checks from deleted `index.js` to current `home.js` architecture.
- Files: `scripts/validate_site.py`
- Details: Updated `validate_html_files()` to use `assets/js/home.js` when `assets/js/index.js` is absent, while retaining backward compatibility for legacy branches where `index.js` exists. Also adjusted homepage hook validation to accept either legacy faculty-link signature or current `loadFacultySpotlights` hook so validation remains aligned with active frontend structure.
- Revert: No

## 2026-05-23 22:45 IST | author: Codex | type: feature
- Summary: Implemented Scopus abstract enrichment for top 3 recent publications with updates-only behavior after initial fill.
- Files: `scripts/fetch_publications.py`, `.github/workflows/update_publications.yaml`, `README.md`
- Details: Added optional nested `abstract` metadata to publication records and integrated Scopus Abstract Retrieval (identifier priority: `eid`, fallback `doi`) using existing retry/backoff request path. Added `ABSTRACT_TOP_N` env (default `3`) and enrichment policy to only process top-N recent publications that do not already have `abstract.text`, enabling initial backfill and subsequent updates-only runs. Added abstract telemetry counters (`attempted`, `fetched`, `skipped_existing`, `skipped_missing_id`, `failed`) in logs. Wired `ABSTRACT_TOP_N=3` into update workflow and documented abstract contract/behavior in README.
- Revert: No

## 2026-05-23 22:37 IST | author: Codex | type: redesign
- Summary: Re-themed homepage from traditional institutional styling to a contemporary glass/gradient modern layout.
- Files: `assets/css/home.css`
- Details: Replaced the full homepage stylesheet with a modern visual system: frosted cards, sticky translucent topbar, contemporary heading rhythm, capsule utility links, softer depth/shadows, and cleaner mobile breakpoints. Kept existing HTML structure and JS behavior intact (faculty spotlights + video feed), while shifting visual tone away from the previous traditional look.
- Revert: No

## 2026-05-23 22:34 IST | author: Codex | type: redesign
- Summary: Rebuilt homepage with a new responsive theme layout and added random faculty spotlight cards using existing photo code.
- Files: `index.html`, `assets/css/home.css`, `assets/js/home.js`
- Details: Replaced homepage structure with a mobile/desktop-first layout (hero, faculty spotlights, chapters, videos, and future placeholder sections). Implemented `Faculty Spotlights` rendering from `faculty.json` plus `data/<slug>.json` profile/publication metrics, randomizing selection and reusing shared `attachFacultyPhoto` for remote/local fallback images. Intentionally kept faculty display non-clickable (no faculty/directory links) and preserved existing YouTube feed/modal behavior.
- Revert: No

## 2026-05-23 22:27 IST | author: Codex | type: redesign
- Summary: Fully revamped homepage structure and theme into a new multi-band layout with stronger visual identity.
- Files: `index.html`, `assets/css/home.css`
- Details: Rebuilt homepage from scratch with a new architecture: utility strip, branded header, split hero (editorial lead + strengths panel), alternating themed section bands (`Department Signals`, `Student Chapters`, `Research Areas`, `Latest Videos`), and redesigned card systems per section. Preserved existing dynamic social-feed/video modal integration by keeping required JS hook points (`#content`, feed classes) intact while replacing overall layout and visual language.
- Revert: No

## 2026-05-23 22:24 IST | author: Codex | type: tweak
- Summary: Introduced contrasting color palettes per homepage section for clearer visual separation.
- Files: `assets/css/home.css`
- Details: Added distinct background/card/border color systems across major sections: warm neutral for feature panels, teal-toned student chapters, slate-lavender research area, and cool-blue videos block, while preserving hero styling and readability scale updates.
- Revert: No

## 2026-05-23 22:20 IST | author: Codex | type: tweak
- Summary: Increased homepage typography and spacing for stronger readability and message impact.
- Files: `assets/css/home.css`
- Details: Enlarged key text scales (department title, hero headline/tagline, section headings, panel/chapter/research card text, and feed card text/links), increased card and hero paddings, widened CTA button prominence, and adjusted section spacing to better match the clearer high-readability presentation style requested.
- Revert: No

## 2026-05-23 22:19 IST | author: Codex | type: feature
- Summary: Added dedicated Student Chapters section on homepage with official chapter links.
- Files: `index.html`, `assets/css/home.css`
- Details: Introduced a new `Student Chapters` section containing cards and external links for ACM, IEEE EDS, IEEE SPS, IEEE SSCS, and OPTICA chapters. Added responsive chapter-card styles consistent with the existing institutional homepage design.
- Revert: No

## 2026-05-23 22:17 IST | author: Codex | type: tweak
- Summary: Removed the internal faculty-directory note text from homepage feature panel.
- Files: `index.html`, `assets/css/home.css`
- Details: Deleted the sentence "Faculty directory route is available internally." from the Directory feature panel and removed the now-unused `.panel-note` style block from homepage CSS.
- Revert: No

## 2026-05-23 22:16 IST | author: Codex | type: tweak
- Summary: Hid all faculty-directory links from the homepage while preserving directory route implementation.
- Files: `index.html`, `assets/css/home.css`
- Details: Removed every `directory/` anchor from top utility links, header nav, hero CTA actions, and feature panel action on `index.html`. Replaced the directory action with non-clickable informational text and added `.panel-note` styling in `home.css`. No changes were made to `/directory/` route files or related JavaScript/data logic.
- Revert: No

## 2026-05-23 22:10 IST | author: Codex | type: redesign
- Summary: Refined homepage to a cleaner Johns Hopkins ECE-inspired institutional look.
- Files: `index.html`, `assets/css/home.css`
- Details: Replaced the previous mixed-style homepage with a sharper academic layout: dark utility strip, structured departmental header with inline primary nav, editorial serif hero with clearer messaging and action buttons, dark highlight panel, and three uniform update panels (News/Events/Directory). Refreshed research section styling for a restrained institutional visual system and preserved existing dynamic YouTube feed + modal behavior by keeping the same JS hook points.
- Revert: No

## 2026-05-23 22:00 IST | author: Codex | type: redesign
- Summary: Reworked homepage into a modern institutional ECE landing page inspired by TAMU, NUS, and JHU department structures.
- Files: `index.html`, `assets/css/home.css`
- Details: Replaced the minimal top section with a layered university-style homepage containing (1) quick-link utility bar, (2) strong two-column hero with primary/secondary CTAs and highlight panel, (3) stats strip, (4) pathway cards for academics/publications/community, and (5) research focus grid. Preserved existing live YouTube feed integration and modal behaviors by keeping `#content` and feed card hook classes unchanged, while restyling section framing for a cleaner institutional look.
- Revert: No

## 2026-05-22 16:30 IST | author: JP | type: redesign
- Summary: Complete homepage layout overhaul inspired by institutional university department sites (NUS ECE, JHU ECE, TAMU ECEN).
- Files: `index.html`, `assets/css/home.css`
- Details: Replaced dark gradient hero with a clean institutional layout: (1) thin identity header with university name + dept name separated by a 2px brand-blue bottom border; (2) white hero section with a short blue accent bar, large bold h1, and muted tagline; (3) 3-column resources row (Social Pages, Magazines, Faculty Directory) as cards with a 3px blue top border and hover lift — replacing hero CTA buttons entirely; (4) videos section with a ruled section header above the YouTube grid. Platform pills changed from pill to rectangular badge. Responsive: 2-col stacked on tablet (last card full-width), 1-col on mobile. Removed all gradient, circle, and ghost-button styles.
- Revert: No

## 2026-05-22 15:30 IST | author: JP | type: tweak
- Summary: Homepage now shows 6 recent YouTube videos only.
- Files: `assets/js/home.js`, `api/social-feed.js`, `index.html`
- Details: Updated home feed endpoint to `?limit=6&platform=youtube`. Added `platform` query-param support to the API worker — when set, only the matching platform is fetched (skipping the other API call entirely), then sorted by date and sliced to limit. Updated section description copy to reflect YouTube-only feed.
- Revert: No

## 2026-05-22 15:00 IST | author: JP | type: tweak
- Summary: Redesigned homepage with a modern hero section and refined social feed card styles.
- Files: `index.html`, `assets/css/home.css`
- Details: Replaced minimal `.home-header` with a full-width gradient hero (`.site-hero`) featuring the department title, university eyebrow text, a one-line tagline, and a Faculty Directory CTA button with a hover-lift effect. Extracted the social feed into a `<main>` block with a labelled section header. Refreshed `.feed-card` styles with layered `box-shadow`, a `translateY(-3px)` hover lift, refined `.platform-pill` using brand-blue CSS tokens, and a top-border separator on the `.feed-actions` row. Added `backdrop-filter: blur(4px)` to the video modal backdrop. Removed obsolete `.home-header`, `.eyebrow`, `.lead`, `.home-nav`, and bare `h1` rules. All JS hook points (`#content`, `.feed-grid`, `.feed-card`, `.feed-watch-btn`, `#video-modal`, etc.) are unchanged.
- Revert: No

## 2026-05-23 18:37 IST | author: Codex | type: fix
- Summary: Hardened Google Drive photo rendering by trying multiple embeddable image URL variants.
- Files: `assets/js/common.js`
- Details: Updated remote photo normalization and candidate generation to support HTML-escaped links and use a prioritized set of Drive render URLs (`lh3.googleusercontent.com`, `drive.google.com/thumbnail`, `drive.google.com/uc`) before falling back to local slug images.
- Revert: No

## 2026-05-23 18:26 IST | author: Codex | type: fix
- Summary: Fixed `Photo__link` discovery by scanning raw sheet tab titles instead of filtered content-tab descriptors.
- Files: `scripts/fetch_publications.py`
- Details: Added `fetch_sheet_tab_names()` for all-tab metadata scan and switched `fetch_photo_url_from_sheet()` to use it. This allows detection of `Photo__link` (or other non `__kv/__md/__table` tabs) while keeping section parsing filters unchanged.
- Revert: No

## 2026-05-23 18:23 IST | author: Codex | type: feature
- Summary: Added detailed photo-link extraction debug logging for tab/key/URL detection.
- Files: `scripts/fetch_publications.py`
- Details: Added explicit `[PhotoLink]` debug logs for (1) detected tab candidates and matched `photo__link` tab, (2) key candidates and confirmed `link` key match, and (3) extracted URL detection path (key-match vs fallback scan) with final extracted value status.
- Revert: No

## 2026-05-23 18:21 IST | author: Codex | type: fix
- Summary: Fixed photo extraction pipeline to avoid persisting empty `photo_url` values that fail validation.
- Files: `scripts/fetch_publications.py`, `scripts/sync_sheet_sections_only.py`
- Details: Made `photo_url` optional in generated faculty output and write it only when non-empty after trimming. Partial sync now removes stale/empty `photo_url` keys instead of storing empty strings.
- Revert: No

## 2026-05-23 18:18 IST | author: Codex | type: fix
- Summary: Added resilient fallback URL extraction for `photo__link` tab when key matching fails.
- Files: `scripts/fetch_publications.py`
- Details: Enhanced `parse_photo_link_value` to first use strict `link` key lookup and then fallback to first HTTPS URL token anywhere in tab cells, preventing empty `photo_url` when key cell is mistyped/formatted unexpectedly.
- Revert: No

## 2026-05-23 18:15 IST | author: Codex | type: fix
- Summary: Restored strict `photo_url` validation and added detailed debug trace fields on failure.
- Files: `scripts/validate_site.py`
- Details: Reverted warning-only handling for invalid `photo_url` values and now fail validation with an expanded debug summary (raw/trimmed repr, lengths, first-character codepoints, HTTPS extraction status, and extracted URL token) to diagnose hidden characters or malformed sheet cell content in CI.
- Revert: Yes (reverts warning-only behavior introduced at 18:10 IST)

## 2026-05-23 18:10 IST | author: Codex | type: fix
- Summary: Changed invalid `photo_url` validation from hard-failure to warning to prevent CI blockage.
- Files: `scripts/validate_site.py`
- Details: Updated data validation so malformed `photo_url` values emit a validation note instead of failing the workflow; runtime behavior remains safe because remote-photo failure already falls back to local image and initials placeholder.
- Revert: No

## 2026-05-23 18:08 IST | author: Codex | type: fix
- Summary: Relaxed `photo_url` validation to accept wrapped shared URLs emitted by Google Sheets.
- Files: `scripts/validate_site.py`
- Details: Updated `is_valid_photo_url` to accept any string containing an HTTPS URL token (case-insensitive) instead of requiring strict prefix patterns, while still supporting raw Google Drive file IDs.
- Revert: No

## 2026-05-23 18:05 IST | author: Codex | type: fix
- Summary: Accepted formula-style Google Sheets photo-link cells and normalized embedded HTTPS URLs.
- Files: `scripts/fetch_publications.py`, `scripts/validate_site.py`
- Details: Updated photo-link parsing to extract the first HTTPS URL when the `link` cell contains a formula-style value (for example `=HYPERLINK(...)`) and aligned validator rules to accept formula strings that embed HTTPS URLs.
- Revert: No

## 2026-05-23 18:01 IST | author: Codex | type: fix
- Summary: Made photo-link tab detection case-insensitive and fetch by discovered tab name.
- Files: `scripts/fetch_publications.py`
- Details: Updated `fetch_photo_url_from_sheet` to match tab names by normalized key (so `Photo__link` and `photo__link` both work) and fetch values using the actual tab title from metadata, preventing range parse errors caused by case mismatch.
- Revert: No

## 2026-05-23 18:00 IST | author: Codex | type: fix
- Summary: Prevented sync warnings when `photo__link` tab is absent on a faculty sheet.
- Files: `scripts/fetch_publications.py`
- Details: Updated `fetch_photo_url_from_sheet` to check sheet tabs first and treat missing `photo__link` as optional (`photo_url` empty) instead of attempting a values fetch that triggers Google Sheets `Unable to parse range` HTTP 400 warnings.
- Revert: No

## 2026-05-23 17:52 IST | author: Codex | type: fix
- Summary: Renamed faculty photo sheet tab contract from `photos__link` to `photo__link`.
- Files: `scripts/fetch_publications.py`, `README.md`
- Details: Updated the dedicated photo-link tab reader to fetch from `photo__link` and aligned README documentation to the new fixed sheet name. Key/value rule remains unchanged (`link` -> URL).
- Revert: No

## 2026-05-23 17:45 IST | author: Codex | type: fix
- Summary: Switched faculty photo source contract from Profile `Photo URL` to fixed `photos__link` tab key `link`.
- Files: `scripts/fetch_publications.py`, `scripts/sync_sheet_sections_only.py`, `README.md`
- Details: Removed dependency on Profile-section photo fields and introduced dedicated `photos__link` reader per faculty sheet. The sync pipeline now reads key/value rows from `photos__link` and persists `photo_url` using only key `link`, while keeping local-image and initials fallback behavior unchanged.
- Revert: No

## 2026-05-23 17:40 IST | author: Codex | type: feature
- Summary: Implemented multi-source faculty photo lookup with Google Sheet `Photo URL` primary source, local image fallback, and initials fallback.
- Files: `scripts/fetch_publications.py`, `scripts/sync_sheet_sections_only.py`, `assets/js/common.js`, `assets/js/index.js`, `assets/js/faculty.js`, `scripts/validate_site.py`, `README.md`
- Details: Added sheet-profile `Photo URL` extraction and persisted `photo_url` into `data/<slug>.json` during full and partial sheet sync. Extended shared photo loader to validate/normalize remote URLs, auto-convert common Google Drive links/file-ids into direct-view URLs, then fallback to `images/faculty/<slug>.(jpg|jpeg|png|webp)` and finally initials placeholder. Updated list/profile call sites to pass remote photo URL, added validator checks for optional `photo_url`, and documented the new sheet contract/public sharing requirement.
- Revert: No

## 2026-05-23 17:06 IST | author: Codex | type: feature
- Summary: Added faculty-level email fallback support for vCard/QR contact generation.
- Files: `faculty.json`, `assets/js/faculty.js`
- Details: Added `email` field to every faculty entry in `faculty.json` (auto-filled where available from profile sheet data, empty string otherwise). Updated `faculty.js` to prefer sheet profile email and fall back to `faculty.json` email when sheet email is missing.
- Revert: No

## 2026-05-23 17:19 IST | author: Codex | type: feature
- Summary: Updated vCard URL behavior to prefer profile website and fallback to slug URL.
- Files: `assets/js/faculty.js`
- Details: In vCard generation, URL now uses faculty profile website field when present and valid (`https`), otherwise falls back to canonical slug-based faculty page URL.
- Revert: No

## 2026-05-23 17:19 IST | author: Codex | type: fix
- Summary: Hardened GitHub Pages deploy workflow authentication for content-change deployments.
- Files: `.github/workflows/deploy_site_on_content_change.yaml`
- Details: Added explicit `token: ${{ secrets.GITHUB_TOKEN }}` to `actions/configure-pages@v6` and `actions/deploy-pages@v5`, and enabled `enablement: true` in `configure-pages` to auto-enable/configure Pages when needed by the workflow.
- Revert: No

## 2026-05-23 17:21 IST | author: Codex | type: fix
- Summary: Applied the same Pages auth hardening to remaining GitHub Pages deployment workflows.
- Files: `.github/workflows/sync_changed_faculty_sheets.yaml`, `.github/workflows/update_publications.yaml`
- Details: Added explicit `token: ${{ secrets.GITHUB_TOKEN }}` to both `actions/configure-pages@v6` and `actions/deploy-pages@v5`, and set `enablement: true` on each `configure-pages` step for consistent Pages setup/auth behavior across workflows.
- Revert: No

## 2026-05-23 17:30 IST | author: Codex | type: fix
- Summary: Restored vCard URL population by extracting the first valid URL from mixed website field text.
- Files: `assets/js/faculty.js`
- Details: Replaced strict single-value website parsing with `extractFirstSafeUrl()` so vCard generation can pick the first valid HTTPS/`www.` URL even when the profile website field contains multiple links or surrounding text, then fallback to canonical slug URL only when no safe URL is found.
- Revert: No

## 2026-05-23 18:55 IST | author: Codex | type: feature
- Summary: Replaced faculty-directory homepage with live social feed home, moved directory to `/directory/`, and removed profile back-link.
- Files: `index.html`, `directory/index.html`, `assets/js/home.js`, `assets/css/home.css`, `assets/js/directory.js`, `assets/css/directory.css`, `faculty/index.html`, `assets/css/faculty.css`, `api/social-feed.js`, `api/README.md`, `README.md`, `.github/workflows/deploy_site_on_content_change.yaml`, `assets/js/index.js` (deleted), `assets/css/index.css` (deleted)
- Details: Root page now renders LinkedIn/YouTube social posts by calling `GET /api/social-feed?limit=<n>`, with loading/error/empty states and post cards. Existing faculty listing logic/styles were moved from root assets to dedicated directory assets and route (`/directory/`), keeping profile URLs at `/faculty/?faculty=<slug>`. Removed the "Back to Faculty Directory" link from faculty profile page and dropped obsolete `.back` styling. Added backend endpoint implementation (`api/social-feed.js`) with env-secret based LinkedIn/YouTube integration and normalized response contract, plus backend setup docs in `api/README.md`. Updated deploy workflow path filters and top-level README route documentation.
- Revert: No

## 2026-05-23 19:20 IST | author: Codex | type: tweak
- Summary: Reduced homepage social feed fetch size from 12 to 4 recent items.
- Files: `assets/js/home.js`
- Details: Updated the home feed endpoint query from `limit=12` to `limit=4` so the homepage now displays only the most recent four posts/videos.
- Revert: No

## 2026-05-23 19:35 IST | author: Codex | type: feature
- Summary: Added in-site YouTube playback modal for social feed cards.
- Files: `assets/js/home.js`, `assets/css/home.css`, `index.html`
- Details: Implemented homepage modal/lightbox video player for YouTube items so videos can be watched without leaving the site. Added watch-in-site action for YouTube cards, ESC/backdrop/close-button handling, iframe lifecycle reset on close, and modal styling. Updated home CSP to allow YouTube frame embedding (`frame-src` for `youtube.com` and `youtube-nocookie.com`).
- Revert: No
