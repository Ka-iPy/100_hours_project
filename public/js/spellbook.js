/**
 * Spellbook — Interactive spell compendium with turn.js page-flip
 * Uses jQuery + turn.js for the book effect, vanilla JS for data/filtering.
 */
(function () {
    "use strict";

    const SPELLS_PER_PAGE = 4;
    let allSpells = [];
    let currentSpells = [];
    let bookBuilt = false;
    let isLoading = false;
    let meta = { sources: [], schools: [], classes: [], levels: [] };

    // ─── DOM Elements ───
    const overlay = document.getElementById("spellbook-overlay");
    const flipbookEl = document.getElementById("spellbook-flipbook");
    const searchInput = document.getElementById("sb-search");
    const schoolFilter = document.getElementById("sb-filter-school");
    const classFilter = document.getElementById("sb-filter-class");
    const levelFilter = document.getElementById("sb-filter-level");
    const sourceFilter = document.getElementById("sb-filter-source");
    const infoSpellCount = document.getElementById("sb-spell-count");
    const infoPageCount = document.getElementById("sb-page-count");
    const loadingEl = document.getElementById("sb-loading");

    // ─── Open / Close ───
    window.openSpellbook = function () {
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";

        if (bookBuilt) {
            setTimeout(resizeBook, 350);
        }

        if (!allSpells.length && !isLoading) {
            loadSpells();
        }
    };

    window.closeSpellbook = function () {
        overlay.classList.remove("active");
        document.body.style.overflow = "";
    };

    // Close on Escape
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && overlay.classList.contains("active")) {
            closeSpellbook();
        }
    });

    // ─── Load spells from API ───
    async function loadSpells() {
        isLoading = true;
        loadingEl.style.display = "block";
        flipbookEl.style.display = "none";

        try {
            const res = await fetch("/api/spellbook");
            const data = await res.json();
            allSpells = data.spells || [];
            meta = data.meta || { sources: [], schools: [], classes: [], levels: [] };
            currentSpells = [...allSpells];

            populateFilters();
            buildBook(currentSpells);
        } catch (err) {
            console.error("Failed to load spellbook:", err);
            loadingEl.textContent = "Failed to load spells. Please try again.";
        } finally {
            isLoading = false;
        }
    }

    // ─── Populate filter dropdowns ───
    function populateFilters() {
        fillSelect(schoolFilter, meta.schools, "All Schools");
        fillSelect(
            classFilter,
            meta.classes.map((c) => capitalize(c)),
            "All Classes"
        );
        fillSelect(
            levelFilter,
            meta.levels.map((l) => (l === 0 ? "Cantrip" : `Level ${l}`)),
            "All Levels",
            meta.levels.map((l) => String(l))
        );
        fillSelect(sourceFilter, meta.sources, "All Sources");
    }

    function fillSelect(el, labels, defaultLabel, values) {
        el.innerHTML = `<option value="">${defaultLabel}</option>`;
        labels.forEach((label, i) => {
            const val = values ? values[i] : label;
            el.innerHTML += `<option value="${val}">${label}</option>`;
        });
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // ─── Filter logic ───
    function getFilteredSpells() {
        let spells = [...allSpells];
        const query = searchInput.value.trim().toLowerCase();
        const school = schoolFilter.value;
        const cls = classFilter.value.toLowerCase();
        const level = levelFilter.value;
        const source = sourceFilter.value;

        if (query) {
            spells = spells.filter((s) => s.name.toLowerCase().includes(query));
        }
        if (school) {
            spells = spells.filter((s) => s.school === school);
        }
        if (cls) {
            spells = spells.filter((s) => s.classes.includes(cls));
        }
        if (level !== "") {
            const lvl = parseInt(level);
            spells = spells.filter((s) => s.level === lvl);
        }
        if (source) {
            spells = spells.filter((s) => s.source === source);
        }

        return spells;
    }

    let filterTimeout;
    function onFilterChange() {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            const filtered = getFilteredSpells();
            currentSpells = filtered;
            rebuildBook(filtered);
        }, 300);
    }

    // Attach filter events
    if (searchInput) searchInput.addEventListener("input", onFilterChange);
    if (schoolFilter) schoolFilter.addEventListener("change", onFilterChange);
    if (classFilter) classFilter.addEventListener("change", onFilterChange);
    if (levelFilter) levelFilter.addEventListener("change", onFilterChange);
    if (sourceFilter) sourceFilter.addEventListener("change", onFilterChange);

    // ─── Build the flipbook ───
    function buildBook(spells) {
        loadingEl.style.display = "none";
        flipbookEl.style.display = "block";
        flipbookEl.innerHTML = "";

        // Front cover (hard)
        const frontCover = doc("div", { className: "hard" });
        frontCover.innerHTML = `
      <div class="sb-arcane-circle"></div>
      <div class="sb-cover-title">Spellbook</div>
    `;
        flipbookEl.appendChild(frontCover);

        // Inside front cover (hard)
        const insideFront = doc("div", { className: "hard" });
        insideFront.innerHTML = `
      <div style="color:#1a0f0a; font-family:'Cinzel',serif; font-size:0.9rem; text-align:center; padding:40px; text-shadow: -1px -1px 1px rgba(0,0,0,0.8), 1px 1px 1px rgba(255,255,255,0.15);">
        <p style="font-size:1.1rem; margin-bottom:12px;">📖 ${spells.length} Spells</p>
        <p style="font-style:italic; font-size:0.8rem;">Turn the pages to browse, or use the filters above to search.</p>
      </div>
    `;
        flipbookEl.appendChild(insideFront);

        // Build spell pages
        const pages = chunkArray(spells, SPELLS_PER_PAGE);
        const totalPages = pages.length;

        pages.forEach((pageSpells, pageIdx) => {
            const page = doc("div", { className: "sb-page" });
            const inner = doc("div", { className: "sb-page-inner" });

            // Page header
            const header = doc("div", { className: "sb-page-header" });
            const firstLetter = pageSpells[0]?.name?.charAt(0)?.toUpperCase() || "";
            const lastLetter =
                pageSpells[pageSpells.length - 1]?.name?.charAt(0)?.toUpperCase() || "";
            header.innerHTML = `
        <span>${firstLetter}${lastLetter !== firstLetter ? " — " + lastLetter : ""}</span>
        <span>Spells</span>
      `;
            inner.appendChild(header);

            // Spell list
            const list = doc("div", { className: "sb-spell-list" });
            pageSpells.forEach((spell) => {
                const card = doc("div", {
                    className: "sb-spell-card",
                    "data-spell-name": spell.name.toLowerCase(),
                });
                const schoolName = spell.school || "Magic";
                card.innerHTML = `
          <div class="sb-school-logo" title="${schoolName} School">${getSchoolLogoSvg(spell.school)}</div>
          <div class="sb-spell-name">${spell.name}</div>
          <div class="sb-spell-meta">${spell.type || ""}${spell.ritual ? " (Ritual)" : ""}${spell.concentration ? " • Concentration" : ""}</div>
          <div class="sb-spell-stats">
            <span><strong>Cast:</strong> ${spell.castingTime || "—"}</span>
            <span><strong>Range:</strong> ${spell.range || "—"}</span>
            <span><strong>Dur:</strong> ${spell.duration || "—"}</span>
            <span><strong>Source:</strong> ${spell.source || "—"}</span>
          </div>
          <div class="sb-spell-desc">${truncate(spell.description, 180)}</div>
        `;

                // Click to see detail
                card.addEventListener("click", function () {
                    showSpellDetail(spell, pageIdx);
                });

                list.appendChild(card);
            });
            inner.appendChild(list);

            // Page number
            const pageNum = doc("div", { className: "sb-page-number" });
            pageNum.textContent = `— ${pageIdx + 1} —`;
            inner.appendChild(pageNum);

            page.appendChild(inner);
            flipbookEl.appendChild(page);
        });

        // Inside back cover (hard)
        const insideBack = doc("div", { className: "hard" });
        insideBack.innerHTML = `
      <div style="color:#1a0f0a; font-family:'Cinzel',serif; font-size:0.85rem; text-align:center; padding:40px; text-shadow: -1px -1px 1px rgba(0,0,0,0.8), 1px 1px 1px rgba(255,255,255,0.15);">
        <p style="font-style:italic;">"Magic is the art of turning knowledge into power."</p>
      </div>
    `;
        flipbookEl.appendChild(insideBack);

        // Back cover (hard)
        const backCover = doc("div", { className: "hard" });
        backCover.innerHTML = `
      <div class="sb-arcane-circle"></div>
      <div class="sb-cover-title" style="font-size:1.5rem;">Finis</div>
    `;
        flipbookEl.appendChild(backCover);

        // Initialize turn.js
        $(flipbookEl).turn({
            width: 1000,
            height: 600,
            autoCenter: true,
            elevation: 0,
            gradients: false,
            turnCorners: "",
            duration: 1000,
        });

        bookBuilt = true;
        updateInfo(spells.length, totalPages);

        // Wait for modal animation to finish before resizing
        setTimeout(resizeBook, 350);
    }

    // ─── Responsive Resize ───
    function resizeBook() {
        if (!bookBuilt || !flipbookEl) return;

        const container = document.querySelector('.spellbook-container');
        if (!container) return;

        const containerWidth = container.clientWidth;
        // If container is hidden or 0 width, don't resize
        if (containerWidth <= 0) return;

        let newWidth = 1000;
        let newHeight = 600;

        if (containerWidth < 1000) {
            newWidth = containerWidth;
            newHeight = (containerWidth / 1000) * 600;
        }

        $(flipbookEl).turn('size', newWidth, newHeight);
    }

    window.addEventListener('resize', () => {
        if (overlay.classList.contains('active')) {
            resizeBook();
        }
    });

    // ─── Rebuild book (on filter change) ───
    function rebuildBook(spells) {
        if (bookBuilt) {
            // Destroy existing turn.js instance
            if ($(flipbookEl).turn) {
                try {
                    $(flipbookEl).turn("destroy");
                } catch (e) {
                    // turn.js may throw if already destroyed
                }
            }
            bookBuilt = false;
        }
        buildBook(spells);
    }

    // ─── Show single spell detail ───
    function showSpellDetail(spell, fromPageIdx) {
        // We'll flip to a dynamically inserted detail page
        // For simplicity, show in a floating overlay on top
        let detailEl = document.getElementById("sb-spell-detail-overlay");
        if (!detailEl) {
            detailEl = doc("div", { id: "sb-spell-detail-overlay" });
            detailEl.style.cssText = `
        position: fixed; inset: 0; z-index: 10001;
        background: rgba(0,0,0,0.7);
        display: flex; align-items: center; justify-content: center;
        animation: sbFadeIn 0.2s ease;
      `;
            document.body.appendChild(detailEl);
        }

        const descParagraphs = (spell.description || "")
            .split("\n")
            .filter((p) => p.trim())
            .map((p) => `<p>${parseDndTags(p)}</p>`)
            .join("");

        const higherHtml = spell.higherLevels
            ? `<div class="sb-detail-higher">
          <div class="sb-detail-higher-title">At Higher Levels</div>
          <p>${parseDndTags(spell.higherLevels)}</p>
        </div>`
            : "";

        const classStr = (spell.classes || []).map(capitalize).join(", ");

        const schoolName = spell.school || "Magic";
        detailEl.innerHTML = `
      <div style="
        width: 480px; max-height: 85vh;
        background: linear-gradient(to bottom, #0f0b25, #070514);
        border: 3px solid #d4af37;
        border-radius: 6px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.85), inset 0 0 20px rgba(212, 175, 55, 0.1);
        overflow-y: auto;
        padding: 0;
        position: relative;
      ">
        <div class="sb-spell-detail">
          <div class="sb-detail-school-logo" title="${schoolName} School">${getSchoolLogoSvg(spell.school)}</div>
          <div class="sb-detail-name">${spell.name}</div>
          <div class="sb-detail-type">${spell.type || ""}${spell.ritual ? " (Ritual)" : ""}</div>
          <dl class="sb-detail-grid">
            <dt>Casting Time</dt><dd>${spell.castingTime || "—"}</dd>
            <dt>Range</dt><dd>${spell.range || "—"}</dd>
            <dt>Components</dt><dd>${spell.components || "—"}</dd>
            <dt>Duration</dt><dd>${spell.duration || "—"}${spell.concentration ? " (Concentration)" : ""}</dd>
            <dt>Source</dt><dd>${spell.source || "—"}</dd>
            ${classStr ? `<dt>Classes</dt><dd>${classStr}</dd>` : ""}
          </dl>
          <hr class="sb-detail-divider">
          <div class="sb-detail-description">
            ${descParagraphs}
            ${higherHtml}
          </div>
        </div>
      </div>
    `;

        detailEl.style.display = "flex";
        detailEl.addEventListener("click", function (e) {
            if (e.target === detailEl) detailEl.remove();
        });
    }

    // ─── Navigate to spell by name ───
    window.navigateToSpell = function (spellName) {
        if (!bookBuilt || !currentSpells.length) return;

        const lowerName = spellName.toLowerCase();
        const idx = currentSpells.findIndex((s) =>
            s.name.toLowerCase().includes(lowerName)
        );
        if (idx === -1) return;

        // Calculate page number (account for 2 hard cover pages at front)
        const spellPage = Math.floor(idx / SPELLS_PER_PAGE);
        // turn.js pages: 1=front cover, 2=inside front, then spell pages start at 3
        const turnPage = spellPage + 3;

        $(flipbookEl).turn("page", turnPage);

        // Highlight the spell after page turn completes
        setTimeout(() => {
            document.querySelectorAll(".sb-spell-card.highlighted").forEach((el) => {
                el.classList.remove("highlighted");
            });
            const card = document.querySelector(
                `.sb-spell-card[data-spell-name="${lowerName}"]`
            );
            if (card) {
                card.classList.add("highlighted");
                // Auto-remove highlight
                setTimeout(() => card.classList.remove("highlighted"), 3000);
            }
        }, 1200);
    };

    // ─── Helpers ───
    const SCHOOL_SVG_MAP = {
        abjuration: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1" stroke-dasharray="2,3"/>
          <circle cx="50" cy="50" r="42" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="37" stroke-width="1" stroke-dasharray="6,3"/>
          <polygon points="50,6 81,19 94,50 81,81 50,94 19,81 6,50 19,19" stroke-width="1" stroke-opacity="0.6"/>
          <path d="M50 14 L78 28 V52 C78 72 50 86 50 86 C50 86 22 72 22 52 V28 Z" stroke-width="2.5"/>
          <path d="M50 19 L73 31 V50 C73 67 50 79 50 79 C50 79 27 67 27 50 V31 Z" stroke-width="1.2" stroke-opacity="0.8"/>
          <line x1="50" y1="19" x2="50" y2="79" stroke-width="1.5"/>
          <line x1="27" y1="42" x2="73" y2="42" stroke-width="1.5"/>
          <polygon points="50,34 54,42 62,42 55,47 58,55 50,50 42,55 45,47 38,42 46,42" fill="currentColor" fill-opacity="0.3" stroke-width="1.5"/>
          <circle cx="50" cy="10" r="2" fill="currentColor"/>
          <circle cx="90" cy="50" r="2" fill="currentColor"/>
          <circle cx="50" cy="90" r="2" fill="currentColor"/>
          <circle cx="10" cy="50" r="2" fill="currentColor"/>
        </svg>`,

        conjuration: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="41" stroke-width="1" stroke-dasharray="2,4"/>
          <path d="M50 4 V10 M50 90 V96 M4 50 H10 M90 50 H96 M17 17 L22 22 M78 78 L83 83 M17 83 L22 78 M78 22 L83 17" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="33" stroke-width="2"/>
          <circle cx="50" cy="50" r="21" stroke-width="1.2"/>
          <polygon points="50,17 58,42 82,30 67,52 80,74 55,70 50,95 45,70 20,74 33,52 18,30 42,42" stroke-width="1.8"/>
          <path d="M50 29 A21 21 0 0 1 71 50 A21 21 0 0 1 50 71 A21 21 0 0 1 29 50 Z" stroke-width="1"/>
          <circle cx="50" cy="50" r="9" stroke-width="1.5" stroke-dasharray="3,2"/>
          <polygon points="50,44 54,50 50,56 46,50" fill="currentColor" fill-opacity="0.4"/>
          <circle cx="50" cy="50" r="3" fill="currentColor"/>
        </svg>`,

        divination: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1" stroke-dasharray="3,3"/>
          <circle cx="50" cy="50" r="42" stroke-width="1.5"/>
          <path d="M50 4 V12 M50 88 V96 M4 50 H12 M88 50 H96 M18 18 L24 24 M76 76 L82 82 M18 82 L24 76 M76 24 L82 18" stroke-width="1.5"/>
          <path d="M22 26 Q50 10 78 26" stroke-width="1.8"/>
          <path d="M22 74 Q50 90 78 74" stroke-width="1.8"/>
          <path d="M10 50 Q50 14 90 50 Q50 86 10 50 Z" stroke-width="2.5"/>
          <path d="M18 50 Q50 22 82 50 Q50 78 18 50 Z" stroke-width="1.2" stroke-opacity="0.7"/>
          <circle cx="50" cy="50" r="22" stroke-width="2"/>
          <circle cx="50" cy="50" r="16" stroke-width="1" stroke-dasharray="4,2"/>
          <circle cx="50" cy="50" r="11" stroke-width="1.8"/>
          <polygon points="50,39 55,50 50,61 45,50" fill="currentColor" fill-opacity="0.5"/>
          <circle cx="50" cy="50" r="4" fill="currentColor"/>
          <line x1="50" y1="28" x2="50" y2="34" stroke-width="1.5"/>
          <line x1="50" y1="66" x2="50" y2="72" stroke-width="1.5"/>
          <line x1="28" y1="50" x2="34" y2="50" stroke-width="1.5"/>
          <line x1="66" y1="50" x2="72" y2="50" stroke-width="1.5"/>
        </svg>`,

        enchantment: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1" stroke-dasharray="2,4"/>
          <circle cx="50" cy="50" r="41" stroke-width="1.5"/>
          <path d="M50 4 L53 10 L50 16 M50 84 L47 90 L50 96 M4 50 L10 53 L16 50 M84 50 L90 47 L96 50" stroke-width="1.2"/>
          <circle cx="50" cy="50" r="32" stroke-width="1.8" stroke-dasharray="8,4"/>
          <path d="M50 84 C20 64 8 42 22 25 C31 14 45 17 50 28 C55 17 69 14 78 25 C92 42 80 64 50 84 Z" stroke-width="2.5"/>
          <path d="M50 77 C25 59 15 40 27 26 C34 18 45 20 50 29 C55 20 66 18 73 26 C85 40 75 59 50 77 Z" stroke-width="1.2" stroke-opacity="0.6"/>
          <path d="M34 24 L38 12 L50 20 L62 12 L66 24 Z" stroke-width="1.8" fill="currentColor" fill-opacity="0.2"/>
          <circle cx="38" cy="11" r="1.5" fill="currentColor"/>
          <circle cx="50" cy="18" r="1.5" fill="currentColor"/>
          <circle cx="62" cy="11" r="1.5" fill="currentColor"/>
          <polygon points="50,38 56,48 50,58 44,48" fill="currentColor" fill-opacity="0.4" stroke-width="1.5"/>
          <circle cx="50" cy="48" r="3" fill="currentColor"/>
        </svg>`,

        evocation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="50,4 61,19 79,9 74,28 92,34 78,48 94,60 76,68 84,86 66,82 60,96 48,84 34,94 36,76 18,78 26,62 8,52 24,44 10,28 28,28 26,8 42,16" stroke-width="1.2" stroke-opacity="0.7"/>
          <circle cx="50" cy="50" r="41" stroke-width="1.8"/>
          <circle cx="50" cy="50" r="34" stroke-width="1" stroke-dasharray="3,3"/>
          <circle cx="50" cy="50" r="26" stroke-width="1.5"/>
          <path d="M48 10 L64 36 L50 36 L62 62 L40 62 L56 90 L44 54 L56 54 Z" stroke-width="2.5" fill="currentColor" fill-opacity="0.25"/>
          <path d="M52 14 L36 40 L50 40 L38 66 L60 66 L44 86" stroke-width="1.2" stroke-opacity="0.8"/>
          <line x1="50" y1="4" x2="50" y2="10" stroke-width="2"/>
          <line x1="50" y1="90" x2="50" y2="96" stroke-width="2"/>
          <line x1="4" y1="50" x2="10" y2="50" stroke-width="2"/>
          <line x1="90" y1="50" x2="96" y2="50" stroke-width="2"/>
          <polygon points="50,44 54,50 50,56 46,50" fill="currentColor"/>
        </svg>`,

        illusion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1" stroke-dasharray="4,4"/>
          <circle cx="48" cy="48" r="42" stroke-width="1" stroke-opacity="0.5"/>
          <circle cx="52" cy="52" r="42" stroke-width="1" stroke-opacity="0.5"/>
          <circle cx="50" cy="50" r="40" stroke-width="1.8"/>
          <polygon points="50,10 86,50 50,90 14,50" stroke-width="2.2"/>
          <polygon points="50,18 78,50 50,82 22,50" stroke-width="1.2" stroke-opacity="0.7"/>
          <line x1="50" y1="10" x2="50" y2="90" stroke-width="1.5"/>
          <line x1="14" y1="50" x2="86" y2="50" stroke-width="1.5"/>
          <path d="M18 50 A 32 32 0 0 0 82 50 A 32 32 0 0 1 18 50 Z" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
          <path d="M82 50 A 32 32 0 0 0 18 50 A 32 32 0 0 1 82 50 Z" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
          <circle cx="50" cy="50" r="14" stroke-width="2"/>
          <circle cx="50" cy="50" r="8" stroke-width="1" stroke-dasharray="2,2"/>
          <circle cx="50" cy="50" r="4" fill="currentColor"/>
        </svg>`,

        necromancy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1.5"/>
          <path d="M50 4 L53 10 L50 14 M50 96 L47 90 L50 86 M4 50 L10 47 L14 50 M96 50 L90 53 L86 50 M17 17 L23 21 M83 83 L77 79 M17 83 L23 79 M83 17 L77 21" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="38" stroke-width="1" stroke-dasharray="3,3"/>
          <path d="M14 70 Q50 96 86 70 Q50 82 14 70 Z" stroke-width="2" fill="currentColor" fill-opacity="0.2"/>
          <path d="M32 32 C32 18 40 12 50 12 C60 12 68 18 68 32 C68 44 64 48 61 56 H39 C36 48 32 44 32 32 Z" stroke-width="2.5"/>
          <path d="M36 32 C36 22 42 16 50 16 C58 16 64 22 64 32 C64 41 61 45 58 52 H42 C39 45 36 41 36 32 Z" stroke-width="1" stroke-opacity="0.6"/>
          <polygon points="37,28 46,31 44,40 37,38" stroke-width="1.8" fill="currentColor" fill-opacity="0.4"/>
          <polygon points="63,28 54,31 56,40 63,38" stroke-width="1.8" fill="currentColor" fill-opacity="0.4"/>
          <circle cx="42" cy="34" r="2" fill="currentColor"/>
          <circle cx="58" cy="34" r="2" fill="currentColor"/>
          <polygon points="50,42 46,49 54,49" fill="currentColor"/>
          <line x1="39" y1="56" x2="61" y2="56" stroke-width="2"/>
          <line x1="39" y1="64" x2="61" y2="64" stroke-width="2"/>
          <line x1="44" y1="56" x2="44" y2="64" stroke-width="1.5"/>
          <line x1="50" y1="56" x2="50" y2="64" stroke-width="1.5"/>
          <line x1="56" y1="56" x2="56" y2="64" stroke-width="1.5"/>
        </svg>`,

        transmutation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="41" stroke-width="1" stroke-dasharray="2,3"/>
          <polygon points="50,6 54,12 46,12" fill="currentColor"/>
          <polygon points="50,94 54,88 46,88" stroke-width="1"/>
          <polygon points="6,50 12,46 12,54" fill="currentColor"/>
          <polygon points="94,50 88,46 88,54" stroke-width="1"/>
          <circle cx="50" cy="50" r="33" stroke-width="2"/>
          <polygon points="50,17 81,71 19,71" stroke-width="2.2"/>
          <polygon points="50,83 81,29 19,29" stroke-width="2.2"/>
          <circle cx="50" cy="50" r="18" stroke-width="1.8"/>
          <circle cx="50" cy="50" r="12" stroke-width="1" stroke-dasharray="3,2"/>
          <polygon points="50,42 57,50 50,58 43,50" fill="currentColor" fill-opacity="0.3" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="3" fill="currentColor"/>
        </svg>`,

        default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="46" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="42" stroke-width="1" stroke-dasharray="3,3"/>
          <circle cx="50" cy="50" r="36" stroke-width="1.8"/>
          <polygon points="50,14 60,34 82,24 72,46 92,50 72,54 82,76 60,66 50,86 40,66 18,76 28,54 8,50 28,46 18,24 40,34" stroke-width="2"/>
          <rect x="29" y="29" width="42" height="42" stroke-width="1.2" stroke-opacity="0.7"/>
          <rect x="29" y="29" width="42" height="42" transform="rotate(45 50 50)" stroke-width="1.2" stroke-opacity="0.7"/>
          <circle cx="50" cy="50" r="14" stroke-width="1.8"/>
          <polygon points="50,40 57,50 50,60 43,50" fill="currentColor" fill-opacity="0.4" stroke-width="1.5"/>
          <circle cx="50" cy="50" r="3" fill="currentColor"/>
        </svg>`
    };

    function getSchoolLogoSvg(schoolName) {
        if (!schoolName) return SCHOOL_SVG_MAP.default;
        const key = schoolName.trim().toLowerCase();
        return SCHOOL_SVG_MAP[key] || SCHOOL_SVG_MAP.default;
    }

    function doc(tag, attrs) {
        const el = document.createElement(tag);
        if (attrs) {
            Object.entries(attrs).forEach(([k, v]) => {
                if (k === "className") el.className = v;
                else el.setAttribute(k, v);
            });
        }
        return el;
    }

    function chunkArray(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    function truncate(str, maxLen) {
        if (!str) return "";
        // Strip {@...} tags from 5e data format
        const clean = str.replace(/{@\w+\s+([^}|]+)[^}]*}/g, "$1");
        if (clean.length <= maxLen) return clean;
        return clean.substring(0, maxLen) + "…";
    }

    function updateInfo(spellCount, pageCount) {
        if (infoSpellCount) infoSpellCount.textContent = `${spellCount} spells`;
        if (infoPageCount) infoPageCount.textContent = `${pageCount} pages`;
    }

    // --- REGEX PARSER AND TOOLTIPS ---
    function parseDndTags(text) {
        if (!text) return "";
        const tagRegex = /\{@([a-zA-Z]+) ([^}]+)\}/g;
        return text.replace(tagRegex, (match, tag, content) => {
            const parts = content.split('|');
            const name = parts[0];
            const source = parts[1] || '';
            const validTags = ['spell', 'item', 'feat', 'condition', 'class', 'race', 'action', 'sense', 'skill'];
            if (validTags.includes(tag.toLowerCase())) {
                return `<span class="rpg-tooltip-trigger" data-type="${tag.toLowerCase()}" data-name="${name}" data-source="${source}">${name}</span>`;
            }
            return name;
        });
    }

    function flattenSpellEntries(entries) {
        if (!entries) return "";
        let html = "";
        for (const e of entries) {
            if (typeof e === "string") {
                html += `<p>${e}</p>`;
            } else if (e.type === "list") {
                html += "<ul>";
                for (const item of e.items) {
                    html += `<li>${item}</li>`;
                }
                html += "</ul>";
            } else if (e.type === "entries") {
                html += `<div class="mt-2 text-gray-200"><strong>${e.name}.</strong> ${flattenSpellEntries(e.entries)}</div>`;
            }
        }
        return html;
    }

    function formatSpellTime(timeArr) {
        if (!timeArr || !timeArr.length) return "—";
        return `${timeArr[0].number} ${timeArr[0].unit}`;
    }

    function formatSpellRange(range) {
        if (!range) return "—";
        if (range.type === "point") {
            const d = range.distance;
            if (d.type === "self") return "Self";
            if (d.type === "touch") return "Touch";
            return `${d.amount} ${d.type}`;
        }
        return "—";
    }

    function formatSpellDuration(durationArr) {
        if (!durationArr || !durationArr.length) return "—";
        const d = durationArr[0];
        if (d.type === "instant") return "Instantaneous";
        if (d.type === "permanent") return "Until dispelled";
        if (d.duration) {
            return `${d.concentration ? "Concentration, up to " : ""}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? "s" : ""}`;
        }
        return "—";
    }

    // Initialize tooltip logic only once globally
    if (!window.rpgTooltipInitialized) {
        window.rpgTooltipInitialized = true;

        const tooltip = document.getElementById('rpg-tooltip') || (() => {
            const el = document.createElement('div');
            el.id = 'rpg-tooltip';
            el.className = 'rpg-tooltip hidden';
            document.body.appendChild(el);
            return el;
        })();

        document.body.addEventListener('mouseover', async (e) => {
            const trigger = e.target.closest('.rpg-tooltip-trigger');
            if (!trigger) return;

            const type = trigger.dataset.type;
            const name = trigger.dataset.name;
            const source = trigger.dataset.source || '';

            if (!name) return;

            tooltip.innerHTML = '<div class="rpg-tooltip-title">Loading...</div>';
            tooltip.classList.remove('hidden');

            // Position the tooltip
            const updatePosition = () => {
                const rect = trigger.getBoundingClientRect();
                const tooltipWidth = tooltip.offsetWidth || 320;
                const tooltipHeight = tooltip.offsetHeight || 100;

                let left = rect.left + window.scrollX;
                let top = rect.bottom + window.scrollY + 8;

                // Smart positioning
                if (left + tooltipWidth > window.innerWidth + window.scrollX) {
                    left = window.innerWidth + window.scrollX - tooltipWidth - 20;
                }
                if (left < window.scrollX + 10) {
                    left = window.scrollX + 10;
                }

                if (top + tooltipHeight > window.innerHeight + window.scrollY) {
                    // Not enough space below, put it above
                    top = rect.top + window.scrollY - tooltipHeight - 8;
                    if (top < window.scrollY + 10) {
                        // Not enough space above either, put it to the right
                        top = rect.top + window.scrollY;
                        left = rect.right + window.scrollX + 8;
                        if (left + tooltipWidth > window.innerWidth + window.scrollX) {
                            // Not enough space to the right, put it to the left
                            left = rect.left + window.scrollX - tooltipWidth - 8;
                        }
                    }
                }

                tooltip.style.left = `${Math.max(10, left)}px`;
                tooltip.style.top = `${Math.max(10, top)}px`;
            };

            updatePosition();

            try {
                const res = await fetch(`/api/lookup?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&source=${encodeURIComponent(source)}`);
                if (!res.ok) throw new Error('Not found');
                const data = await res.json();

                let title = data.name || name;
                let meta = '';
                let desc = '';

                if (type === 'spell') {
                    const levelStr = data.level === 0 ? 'Cantrip' : `Level ${data.level}`;
                    const schoolStr = data.school ? ` (${data.school})` : '';
                    meta = `${levelStr}${schoolStr} | Cast: ${formatSpellTime(data.time)} | Range: ${formatSpellRange(data.range)} | Dur: ${formatSpellDuration(data.duration)}`;
                    desc = flattenSpellEntries(data.entries);
                } else if (type === 'item') {
                    meta = `Item | Value: ${data.value || '—'} | Weight: ${data.weight || '—'}`;
                    desc = flattenSpellEntries(data.entries || [data.detail || '']);
                } else if (type === 'feat') {
                    meta = `Feat | Source: ${data.source || '—'}`;
                    desc = flattenSpellEntries(data.entries);
                } else if (type === 'condition') {
                    meta = `Condition`;
                    desc = flattenSpellEntries(data.entries);
                } else if (type === 'action') {
                    meta = `Action`;
                    desc = flattenSpellEntries(data.entries);
                } else if (type === 'sense') {
                    meta = `Sense`;
                    desc = flattenSpellEntries(data.entries);
                } else {
                    meta = type.charAt(0).toUpperCase() + type.slice(1);
                    desc = data.description || flattenSpellEntries(data.entries) || '';
                }

                tooltip.innerHTML = `
            <div class="rpg-tooltip-title">${title}</div>
            ${meta ? `<div class="rpg-tooltip-meta">${meta}</div>` : ''}
            <div class="rpg-tooltip-desc">${parseDndTags(desc)}</div>
          `;
                updatePosition();
            } catch (err) {
                tooltip.innerHTML = `<div class="rpg-tooltip-title">${name}</div><div class="rpg-tooltip-desc">No additional details found.</div>`;
                updatePosition();
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest('.rpg-tooltip-trigger')) {
                tooltip.classList.add('hidden');
            }
        });
    }
})();
