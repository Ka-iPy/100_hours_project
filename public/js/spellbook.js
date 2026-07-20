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
                card.innerHTML = `
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
        <button onclick="document.getElementById('sb-spell-detail-overlay').remove()" style="
          position: absolute; top: 8px; right: 10px;
          background: none; border: none; cursor: pointer;
          font-size: 1.3rem; color: #d4af37; font-weight: bold;
        ">✕</button>
        <div class="sb-spell-detail">
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
