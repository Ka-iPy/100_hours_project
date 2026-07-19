import { CharacterBuilder } from "../models/CharacterBuilder.js";
import { Character, Equipment, TracedFeature, Spellbook } from "../models/Character.js";
import loader from "../data/loader.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = join(__dirname, "..", "templates", "character-sheet.pdf");

export default {
  getCharacterCreator: async (req, res) => {
    await loader.loadAll();
    const races = loader
      .getRaces()
      .filter((r) => !r.lineage && !r.traitTags?.includes("NPC Race"))
      .map((race) => {
        return JSON.stringify({ name: race.name, source: race.source });
      });

    const subraces = loader.getSubraces().map((sr) => {
      return JSON.stringify({
        name: sr.name || sr.raceName || "Standard",
        source: sr.source,
        raceName: sr.raceName || sr._copy?.raceName,
        raceSource: sr.raceSource || sr._copy?.raceSource,
      });
    });

    const classes = loader.getClasses().map((cls) => {
      return JSON.stringify({ name: cls.name, source: cls.source });
    });

    const subclasses = loader.getSubclasses().map((sc) => {
      return JSON.stringify({
        name: sc.name,
        shortName: sc.subclassShortName,
        className: sc.className,
        source: sc.source,
      });
    });

    const backgrounds = loader.getBackgrounds().map((bg) => {
      return JSON.stringify({ name: bg.name, source: bg.source });
    });

    const feats = loader.getFeats().map((feat) => {
      return JSON.stringify({
        name: feat.name,
        source: feat.source,
        category: feat.category || null,
      });
    });

    const alignments = [
      "Lawful Good",
      "Neutral Good",
      "Chaotic Good",
      "Lawful Neutral",
      "True Neutral",
      "Chaotic Neutral",
      "Lawful Evil",
      "Neutral Evil",
      "Chaotic Evil",
    ];

    const abilities = [
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ];

    res.render("characterCreator", {
      races,
      subraces,
      classes,
      subclasses,
      backgrounds,
      feats,
      alignments,
      abilities,
    });
  },

  createCharacter: async (req, res) => {
    try {
      await loader.loadAll();

      const {
        name,
        race,
        raceSource = "PHB",
        subrace,
        subraceSource,
        className,
        classSource = "PHB",
        level = 1,
        subclass,
        subclassSource,
        background,
        backgroundSource = "PHB",
        alignment = "true neutral",
        experience = 0,
        stats = {},
        feats = [],
        charCreationOptions = [],
        selectedCantrips = [],
        selectedSpells = [],
        equipmentChoices = [],
      } = req.body;

      const builder = new CharacterBuilder(loader);
      const character = builder.build({
        name,
        player: req.session.user.username,
        playerID: req.session.user.id,
        race,
        raceSource,
        subrace,
        subraceSource,
        backgrounds: [{ name: background, source: backgroundSource }],
        classes: [
          {
            name: className,
            source: classSource,
            level: parseInt(level),
            subclass,
            subclassSource,
          },
        ],
        feats: feats.map((f) => (typeof f === "string" ? JSON.parse(f) : f)),
        charCreationOptions,
        abilityScores: stats,
        alignment,
        selectedCantrips,
        selectedSpells,
        equipmentChoices,
      });
      await character.save();
      res.status(201).json(character);
    } catch (err) {
      console.log(err);
      console.error("Error creating character:", err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  },

  getCharacter: async (req, res) => {
    try {
      const { id } = req.params;
      const character = await Character.load(id);
      if (!character) {
        return res
          .status(404)
          .render("error", { message: "Character not found" });
      }

      // Pre-compute data for the view so EJS stays simple
      const helpers = buildCharacterViewHelpers(character);
      res.render("character", { character, ...helpers });
    } catch (err) {
      res.status(500).render("error", { message: err.message });
    }
  },

  updateCharacter: async (req, res) => {
    try {
      const { id } = req.params;
      const character = await Character.load(id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const updates = req.body;

      const simpleFields = [
        "name",
        "player",
        "alignment",
        "experience",
        "maxHitPoints",
        "currentHitPoints",
        "tempHitPoints",
        "passivePerception",
        "spellSaveDC",
        "spellAttackBonus",
        "portrait",
      ];
      simpleFields.forEach((field) => {
        if (updates.hasOwnProperty(field)) {
          if (["inspiration"].includes(field)) {
            character[field] = !!updates[field];
          } else if (
            [
              "maxHitPoints",
              "currentHitPoints",
              "tempHitPoints",
              "experience",
              "passivePerception",
              "spellSaveDC",
              "spellAttackBonus",
            ].includes(field)
          ) {
            character[field] = parseInt(updates[field], 10) || 0;
          } else {
            character[field] = updates[field];
          }
        }
      });
      // I really don't like using topeof here
      if (typeof updates.armorClass !== "undefined") {
        const val = parseInt(updates.armorClass, 10);
        if (!isNaN(val)) character.armorClass.baseValue = val;
      }
      if (typeof updates.initiative !== "undefined") {
        const val = parseInt(updates.initiative, 10);
        if (!isNaN(val)) character.initiative.baseValue = val;
      }
      if (typeof updates.speed !== "undefined") {
        const val = parseInt(updates.speed, 10);
        if (!isNaN(val)) character.speed.baseValue = val;
      }

      if (typeof updates.inspiration !== "undefined") {
        character.inspiration = !!updates.inspiration;
      }

      if (updates.traits) {
        character.traits = {
          ...character.traits,
          ...updates.traits,
        };
      }

      if (updates.currency) {
        character.currency = {
          cp: parseInt(updates.currency.cp, 10) || 0,
          sp: parseInt(updates.currency.sp, 10) || 0,
          ep: parseInt(updates.currency.ep, 10) || 0,
          gp: parseInt(updates.currency.gp, 10) || 0,
          pp: parseInt(updates.currency.pp, 10) || 0,
        };
      }

      if (updates.abilityScores) {
        Object.keys(updates.abilityScores).forEach((ability) => {
          const value = parseInt(updates.abilityScores[ability], 10);
          if (!isNaN(value) && value >= 1 && value <= 30) {
            character.abilityScores.setBase(ability, value);
          }
        });
      }

      if (updates.savingThrows) {
        Object.keys(updates.savingThrows).forEach((ability) => {
          character.proficiencies.savingThrows[ability] =
            !!updates.savingThrows[ability];
        });
      }

      if (updates.skills) {
        Object.keys(updates.skills).forEach((skill) => {
          if (!character.proficiencies.skills[skill]) {
            character.proficiencies.skills[skill] = {
              proficient: false,
              expertise: false,
            };
          }
          character.proficiencies.skills[skill].proficient =
            !!updates.skills[skill];
        });
      }

      if (updates.skillExpertise) {
        Object.keys(updates.skillExpertise).forEach((skill) => {
          if (!character.proficiencies.skills[skill]) {
            character.proficiencies.skills[skill] = {
              proficient: false,
              expertise: false,
            };
          }
          character.proficiencies.skills[skill].expertise =
            !!updates.skillExpertise[skill];
        });
      }

      if (updates.equipment) {
        character.equipment = updates.equipment.map((e) => {
          const existing = character.equipment.find(
            (eq) => eq.item?.name === e.name,
          );
          if (existing) {
            existing.quantity =
              parseInt(e.quantity, 10) || existing.quantity || 1;
            return existing;
          }
          return new Equipment({
            item: { name: e.name || "Unknown Item" },
            quantity: parseInt(e.quantity, 10) || 1,
          });
        });
      }

      if (updates.spellSlots) {
        const sbKeys = Object.keys(character.spellbooks || {});
        if (sbKeys.length > 0) {
          const mainSB = character.spellbooks[sbKeys[0]];
          if (mainSB && mainSB.slots && mainSB.slots.slots) {
            Object.keys(updates.spellSlots).forEach((lvl) => {
              const slotData = updates.spellSlots[lvl];
              if (mainSB.slots.slots[lvl]) {
                if (typeof slotData.max === "number") {
                  mainSB.slots.slots[lvl].max = slotData.max;
                }
                if (typeof slotData.used === "number") {
                  mainSB.slots.slots[lvl].used = slotData.used;
                }
              }
            });
          }
        }
      }

      if (updates.cantrips || updates.spells) {
        let sbKeys = Object.keys(character.spellbooks || {});
        if (sbKeys.length === 0) {
          character.spellbooks["Custom"] = new Spellbook();
          sbKeys = ["Custom"];
        }
        const mainSB = character.spellbooks[sbKeys[0]];

        if (updates.cantrips) {
          mainSB.cantripsKnown = [];
          updates.cantrips.forEach(c => {
            if (c.name) {
              const spellData = loader.getSpell(c.name);
              mainSB.cantripsKnown.push({
                name: c.name,
                source: spellData ? spellData.source : null,
                level: 0,
                school: spellData ? spellData.school : null,
              });
            }
          });
        }

        if (updates.spells) {
          mainSB.known = [];
          mainSB.prepared = [];
          updates.spells.forEach(s => {
            if (s.name) {
              const spellData = loader.getSpell(s.name);
              const spellInfo = {
                name: s.name,
                source: spellData ? spellData.source : null,
                level: spellData ? spellData.level : (parseInt(s.level) || 1),
                school: spellData ? spellData.school : null,
              };
              mainSB.known.push(spellInfo);
              mainSB.prepared.push(spellInfo);
            }
          });
        }
      }

      if (typeof updates.deathSaveSuccess1 !== "undefined")
        character.deathSaveSuccess1 = updates.deathSaveSuccess1;
      if (typeof updates.deathSaveSuccess2 !== "undefined")
        character.deathSaveSuccess2 = updates.deathSaveSuccess2;
      if (typeof updates.deathSaveSuccess3 !== "undefined")
        character.deathSaveSuccess3 = updates.deathSaveSuccess3;
      if (typeof updates.deathSaveFail1 !== "undefined")
        character.deathSaveFail1 = updates.deathSaveFail1;
      if (typeof updates.deathSaveFail2 !== "undefined")
        character.deathSaveFail2 = updates.deathSaveFail2;
      if (typeof updates.deathSaveFail3 !== "undefined")
        character.deathSaveFail3 = updates.deathSaveFail3;

      if (
        updates.otherProficiencies &&
        Array.isArray(updates.otherProficiencies)
      ) {
        character.otherProficiencies = updates.otherProficiencies;
      }

      if (updates.features && Array.isArray(updates.features)) {
        character.features = updates.features.map((f, idx) => {
          const existing = character.features.find((ex) => ex.name === f.name);
          if (existing) {
            existing.description = f.description || existing.description;
            return existing;
          }
          return new TracedFeature({
            name: f.name || `Custom Feature ${idx + 1}`,
            description: f.description || "",
            source: null,
            active: true,
            selectable: false,
            category: "CUSTOM",
          });
        });
      }

      await character.save();
      res.json(character);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getCharacterSources: async (req, res) => {
    try {
      await loader.loadAll();

      const { id, attribute } = req.params;
      const character = await Character.load(id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const sources = getAttributeSources(character, attribute);
      res.json(sources);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  deleteCharacter: async (req, res) => {
    try {
      const { id } = req.params;
      const character = await Character.load(id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      await character.delete();
      res.redirect("/hall");
    } catch (err) {
      console.error("Error deleting character:", err);
      res.status(500).json({ error: err.message });
    }
  },

  downloadMarkdown: async (req, res) => {
    try {
      await loader.loadAll();
      const { id } = req.params;
      const character = await Character.load(id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const helpers = buildCharacterViewHelpers(character);

      let portraitBase64 = character.portrait;
      if (!portraitBase64) {
        try {
          const defaultPortraitPath = join(__dirname, "..", "public", "images", "aasimar_artificer.png");
          const imageBuffer = readFileSync(defaultPortraitPath);
          portraitBase64 = `data:image/png;base64,${imageBuffer.toString("base64")}`;
        } catch (err) {
          console.error("Error reading default portrait:", err);
        }
      }

      // Format ability scores table
      const abilityRows = helpers.abilityData.map(a =>
        `| **${a.name.charAt(0).toUpperCase() + a.name.slice(1)} (${a.abbr})** | ${a.score} | ${a.modStr} |`
      ).join("\n");

      // Format saving throws list
      const savingThrowsList = helpers.savingThrows.map(st =>
        `- [${st.proficient ? "x" : " "}] ${st.label}: ${st.modStr}`
      ).join("\n");

      // Format skills list
      const skillsList = helpers.skills.map(sk =>
        `- [${sk.proficient ? "x" : " "}] ${sk.label} (${sk.ability}): ${sk.modStr}`
      ).join("\n");

      // Format weapons table
      const weaponRows = helpers.weapons.map(w =>
        `| ${w.name} | ${w.atkBonusStr} | ${w.damage} |`
      ).join("\n");

      // Format equipment list
      const equipmentList = helpers.equipment.map(e =>
        `- ${e.name} (Qty: ${e.quantity})`
      ).join("\n");

      // Format currency
      const cur = character.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
      const currencyStr = `**CP:** ${cur.cp} | **SP:** ${cur.sp} | **EP:** ${cur.ep} | **GP:** ${cur.gp} | **PP:** ${cur.pp}`;

      // Format features list
      const featuresList = helpers.features.map(f =>
        `### ${f.name}\n${f.description || "*No description.*"}`
      ).join("\n\n");

      // Format spellbook
      let spellbookStr = "*This character does not have a spellbook.*";
      if (helpers.spellData) {
        const sd = helpers.spellData;
        const cantripsList = sd.cantrips.map(c => `- ${c.name}`).join("\n") || "*No cantrips known.*";

        let leveledSpellsStr = "";
        for (let lvl = 1; lvl <= 9; lvl++) {
          const spells = sd.spellsByLevel[lvl] || [];
          const slot = sd.slots[lvl] || { max: 0, used: 0 };
          if (spells.length > 0 || slot.max > 0) {
            const spellList = spells.map(s => `- ${s.name}`).join("\n") || "*No spells known.*";
            leveledSpellsStr += `#### Level ${lvl} Spells (Slots: ${slot.max - slot.used} / ${slot.max} available)\n${spellList}\n\n`;
          }
        }

        spellbookStr = `
### Spellcasting Stats
- **Spellcasting Class:** ${sd.className}
- **Spellcasting Ability:** ${sd.ability}
- **Spell Save DC:** ${sd.saveDC}
- **Spell Attack Bonus:** ${sd.attackBonusStr}

### Cantrips
${cantripsList}

${leveledSpellsStr}
        `.trim();
      }

      const markdownContent = `
# ${character.name}

## Core Information
- **Player:** ${character.player || "Unknown"}
- **Class & Level:** ${helpers.classStr}
- **Race:** ${helpers.raceDisplay}
- **Background:** ${helpers.bgStr}
- **Alignment:** ${character.alignment || "True Neutral"}
- **Experience:** ${character.experience || 0} XP

---

## Portrait
${portraitBase64 ? `![Character Portrait](${portraitBase64})` : "*No portrait available.*"}

---

## Ability Scores
| Ability | Score | Modifier |
| --- | --- | --- |
${abilityRows}

---

## Combat Attributes
- **Armor Class (AC):** ${character.armorClass?.baseValue || 10}
- **Initiative:** ${helpers.fmt(character.initiative?.baseValue || 0)}
- **Speed:** ${character.speed?.baseValue || 30} ft
- **Hit Points:** ${character.currentHitPoints ?? character.maxHitPoints ?? 0} / ${character.maxHitPoints || 0} HP (Temp HP: ${character.tempHitPoints || 0})
- **Hit Dice:** ${helpers.hitDieStr || "—"}
- **Passive Perception:** ${character.passivePerception || 10}

### Death Saves
- **Successes:** ${[character.deathSaveSuccess1, character.deathSaveSuccess2, character.deathSaveSuccess3].filter(Boolean).length} / 3
- **Failures:** ${[character.deathSaveFail1, character.deathSaveFail2, character.deathSaveFail3].filter(Boolean).length} / 3

---

## Saving Throws
${savingThrowsList}

---

## Skills
${skillsList}

---

## Weapons & Attacks
| Weapon Name | Attack Bonus | Damage / Type |
| --- | --- | --- |
${weaponRows || "| — | — | — |"}

---

## Equipment & Gear
${equipmentList || "*No equipment.*"}

### Currency
${currencyStr}

---

## Features & Traits
${featuresList || "*No features.*"}

### Other Proficiencies & Languages
${helpers.otherProfs.join("\n") || "*None.*"}

---

## Personality & Biography
- **Personality Traits:** ${character.traits?.personalityTrait || "—"}
- **Ideals:** ${character.traits?.ideal || "—"}
- **Bonds:** ${character.traits?.bond || "—"}
- **Flaws:** ${character.traits?.flaw || "—"}

---

## Spellbook
${spellbookStr}
      `.trim();

      res.setHeader("Content-Type", "text/markdown");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${character.name.replace(/[^a-z0-9]/gi, "_")}_Character_Sheet.md"`,
      );
      res.send(markdownContent);
    } catch (err) {
      console.error("Error generating Markdown:", err);
      res.status(500).json({ error: err.message });
    }
  },
  //Up is the pdf generation section
};

function getAttributeSources(character, attribute) {
  const sources = [];

  switch (attribute) {
    case "abilityScores":
      Object.keys(character.abilityScores.scores).forEach((score) => {
        sources.push({
          ability: score,
          base: character.abilityScores.scores[score],
          breakdown: character.abilityScores.getModifierBreakdown(score),
        });
      });
      break;

    case "ac":
      sources.push({
        value: character.calculateArmorClass(),
        breakdown: character.getACBreakdown(),
      });
      break;

    case "initiative":
      sources.push({
        value: character.calculateInitiative(),
        breakdown: character.getInitiativeBreakdown(),
      });
      break;

    case "speed":
      sources.push({
        value: character.calculateSpeed(),
        breakdown: character.getSpeedBreakdown(),
      });
      break;

    case "proficiency":
      sources.push({
        value: character.calculateProficiencyBonus(),
        sources: character.proficiencyBonus.getAllSources(),
      });
      break;

    case "features":
      character.getAllFeatures().forEach((feature) => {
        sources.push({
          name: feature.name,
          source: feature.source.toJSON(),
          description: feature.description,
          active: feature.isActive(),
        });
      });
      break;

    case "skills":
      Object.entries(character.proficiencies.skills).forEach(
        ([skill, data]) => {
          sources.push({
            skill,
            ...data,
            sources: character.proficiencies.getSkillSources(skill),
          });
        },
      );
      break;

    case "savingThrows":
      Object.entries(character.proficiencies.savingThrows).forEach(
        ([ability, proficient]) => {
          if (proficient) {
            sources.push({ ability, proficient });
          }
        },
      );
      break;

    default:
      return { error: "Unknown attribute" };
  }

  return sources;
}

function stripHtmlTags(str) {
  if (!str) return "";
  let out = "",
    inTag = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "<") inTag = true;
    else if (str[i] === ">") inTag = false;
    else if (!inTag) out += str[i];
  }
  return out;
}

// ── Spell school names ──
const SCHOOL_NAMES = {
  A: "Abjuration", C: "Conjuration", D: "Divination", EN: "Enchantment",
  EV: "Evocation", I: "Illusion", N: "Necromancy", T: "Transmutation",
};

/**
 * Flatten 5etools structured entries into plain text.
 */
function flattenEntries(entries) {
  if (!entries) return "";
  const parts = [];
  for (const e of entries) {
    if (typeof e === "string") {
      // Strip 5etools tags like {@damage 1d6}, {@spell Alarm|PHB}, etc.
      parts.push(e.replace(/\{@[a-zA-Z]+ ([^|}]+)[^}]*\}/g, "$1"));
    } else if (e.entries) {
      parts.push(flattenEntries(e.entries));
    } else if (e.items) {
      parts.push(flattenEntries(e.items));
    } else if (e.name && e.entries) {
      parts.push(`${e.name}: ${flattenEntries(e.entries)}`);
    } else if (e.name && e.entry) {
      const txt = typeof e.entry === "string"
        ? e.entry.replace(/\{@[a-zA-Z]+ ([^|}]+)[^}]*\}/g, "$1")
        : flattenEntries([e.entry]);
      parts.push(`${e.name}. ${txt}`);
    }
  }
  return parts.join(" ");
}

/**
 * Format a 5etools time array into a readable string.
 */
function formatTime(timeArr) {
  if (!timeArr || !timeArr.length) return "—";
  const t = timeArr[0];
  return `${t.number} ${t.unit}`;
}

/**
 * Format a 5etools range object.
 */
function formatRange(range) {
  if (!range) return "—";
  if (range.type === "point") {
    const d = range.distance;
    if (d.type === "self") return "Self";
    if (d.type === "touch") return "Touch";
    if (d.type === "sight") return "Sight";
    return `${d.amount} ${d.type}`;
  }
  if (range.type === "special") return "Special";
  return "—";
}

/**
 * Format components object.
 */
function formatComponents(comp) {
  if (!comp) return "—";
  const parts = [];
  if (comp.v) parts.push("V");
  if (comp.s) parts.push("S");
  if (comp.m) {
    const matStr = typeof comp.m === "string" ? comp.m : comp.m.text || "";
    parts.push(`M (${matStr})`);
  }
  return parts.join(", ") || "—";
}

/**
 * Format duration array.
 */
function formatDuration(durArr) {
  if (!durArr || !durArr.length) return "—";
  const d = durArr[0];
  if (d.type === "instant") return "Instantaneous";
  if (d.type === "permanent") return "Until dispelled";
  if (d.type === "special") return "Special";
  if (d.type === "timed") {
    const conc = d.concentration ? "Conc. " : "";
    return `${conc}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? "s" : ""}`;
  }
  return "—";
}

/**
 * Draw multi-line text with word wrap, returns the Y position after drawing.
 */
function drawWrappedText(page, text, x, y, maxWidth, fontSize, font, color) {
  const words = text.split(/\s+/);
  let line = "";
  let curY = y;
  const lineHeight = fontSize + 2;

  for (const word of words) {
    const testLine = line ? line + " " + word : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: curY, size: fontSize, font, color });
      curY -= lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x, y: curY, size: fontSize, font, color });
    curY -= lineHeight;
  }
  return curY;
}

/**
 * Robust spell lookup that avoids skeleton foundry.json duplicates.
 */
function getSpellDetails(dataLoader, name, source) {
  const key = `${name}|${source || ""}`.toLowerCase();
  const matches = dataLoader.spells.filter((s) => {
    if (source) {
      return `${s.name}|${s.source}`.toLowerCase() === key;
    }
    return s.name.toLowerCase() === name.toLowerCase();
  });
  return matches.find((s) => s.entries || s.time) || matches[0] || {};
}

/**
 * Append spell card pages to the PDF document.
 * Layout: 2 columns × 4 rows per page (8 cards per page).
 */
async function appendSpellCardPages(pdfDoc, spellData, dataLoader) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Collect all spells (cantrips + leveled) with full data
  const allSpells = [];

  for (const cantrip of (spellData.cantrips || [])) {
    const full = getSpellDetails(dataLoader, cantrip.name, cantrip.source);
    allSpells.push({
      name: cantrip.name,
      level: 0,
      school: cantrip.school || full.school || "",
      ...full,
    });
  }

  const leveledSpells = Object.entries(spellData.spellsByLevel || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([lvl, spells]) =>
      spells.map(s => {
        const full = getSpellDetails(dataLoader, s.name, typeof s.source === "string" ? s.source : null);
        return {
          name: s.name,
          level: Number(lvl),
          school: s.school || full.school || "",
          ...full,
        };
      })
    );
  allSpells.push(...leveledSpells);

  if (allSpells.length === 0) return;

  // Match the template's page dimensions
  const firstPage = pdfDoc.getPages()[0];
  const pageW = firstPage.getWidth();
  const pageH = firstPage.getHeight();
  const margin = 30;
  const cols = 2;
  const rows = 4;
  const gap = 10;
  const cardW = (pageW - 2 * margin - (cols - 1) * gap) / cols;
  const cardH = (pageH - 2 * margin - (rows - 1) * gap) / rows;
  const cardsPerPage = cols * rows;

  // Colors
  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const headerBg = rgb(0.15, 0.15, 0.25);
  const headerText = rgb(1, 1, 1);
  const borderColor = rgb(0.4, 0.4, 0.5);
  const metaColor = rgb(0.2, 0.2, 0.4);

  for (let i = 0; i < allSpells.length; i++) {
    if (i % cardsPerPage === 0) {
      // Add a new page
      pdfDoc.addPage([pageW, pageH]);
    }

    const pageIndex = Math.floor(i / cardsPerPage);
    const pages = pdfDoc.getPages();
    const page = pages[pages.length - 1];

    const posInPage = i % cardsPerPage;
    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);

    const x = margin + col * (cardW + gap);
    const y = pageH - margin - row * (cardH + gap);

    const spell = allSpells[i];

    // --- Card border ---
    page.drawRectangle({
      x, y: y - cardH, width: cardW, height: cardH,
      borderColor, borderWidth: 1,
    });

    // --- Header bar ---
    const headerH = 20;
    page.drawRectangle({
      x: x + 1, y: y - headerH, width: cardW - 2, height: headerH,
      color: headerBg,
    });

    // Spell name in header
    const displayName = spell.name.length > 28
      ? spell.name.substring(0, 26) + "…"
      : spell.name;
    page.drawText(displayName, {
      x: x + 6, y: y - headerH + 5,
      size: 10, font: boldFont, color: headerText,
    });

    // Level & school on right of header
    const schoolName = SCHOOL_NAMES[spell.school] || spell.school || "";
    const levelStr = spell.level === 0
      ? `Cantrip`
      : `Lvl ${spell.level}`;
    const tagStr = `${levelStr} ${schoolName}`;
    const tagWidth = font.widthOfTextAtSize(tagStr, 7);
    page.drawText(tagStr, {
      x: x + cardW - tagWidth - 6, y: y - headerH + 6,
      size: 7, font, color: rgb(0.75, 0.75, 0.85),
    });

    // --- Meta info ---
    const metaStartY = y - headerH - 12;
    const metaFontSize = 7;
    const metaLineH = 10;
    const metaX = x + 6;
    const metaValX = x + 72;

    const metaFields = [
      ["Casting Time:", formatTime(spell.time)],
      ["Range:", formatRange(spell.range)],
      ["Components:", formatComponents(spell.components)],
      ["Duration:", formatDuration(spell.duration)],
    ];

    let curY = metaStartY;
    for (const [label, value] of metaFields) {
      page.drawText(label, {
        x: metaX, y: curY, size: metaFontSize, font: boldFont, color: metaColor,
      });
      // Wrap long component lines
      const valMaxW = cardW - (metaValX - x) - 8;
      const valWidth = font.widthOfTextAtSize(value, metaFontSize);
      if (valWidth > valMaxW) {
        curY = drawWrappedText(page, value, metaValX, curY, valMaxW, metaFontSize, font, darkGray);
      } else {
        page.drawText(value, {
          x: metaValX, y: curY, size: metaFontSize, font, color: darkGray,
        });
        curY -= metaLineH;
      }
    }

    // --- Separator line ---
    curY -= 3;
    page.drawLine({
      start: { x: x + 6, y: curY },
      end: { x: x + cardW - 6, y: curY },
      thickness: 0.5, color: borderColor,
    });
    curY -= 8;

    // --- Description ---
    const descText = flattenEntries(spell.entries);
    if (descText) {
      const descMaxW = cardW - 16;
      const descFontSize = 6.5;
      const bottomLimit = y - cardH + 6;
      const availableHeight = curY - bottomLimit;
      const linesAvailable = Math.floor(availableHeight / (descFontSize + 2));
      // Truncate description to fit
      const words = descText.split(/\s+/);
      let lines = [];
      let line = "";
      for (const word of words) {
        const testLine = line ? line + " " + word : word;
        const w = font.widthOfTextAtSize(testLine, descFontSize);
        if (w > descMaxW && line) {
          lines.push(line);
          if (lines.length >= linesAvailable) break;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line && lines.length < linesAvailable) lines.push(line);
      if (lines.length >= linesAvailable && lines.length > 0) {
        lines[lines.length - 1] = lines[lines.length - 1].substring(0, lines[lines.length - 1].length - 3) + "...";
      }

      for (const ln of lines) {
        page.drawText(ln, {
          x: x + 8, y: curY, size: descFontSize, font, color: black,
        });
        curY -= descFontSize + 2;
      }
    }

    // Ritual tag if applicable
    if (spell.meta?.ritual) {
      page.drawText("(Ritual)", {
        x: x + cardW - 40, y: y - cardH + 4,
        size: 6, font: boldFont, color: metaColor,
      });
    }
  }
}

const SKILL_ABILITIES = {
  acrobatics: "dexterity",
  "animal handling": "wisdom",
  arcana: "intelligence",
  athletics: "strength",
  deception: "charisma",
  history: "intelligence",
  insight: "wisdom",
  intimidation: "charisma",
  investigation: "intelligence",
  medicine: "wisdom",
  nature: "intelligence",
  perception: "wisdom",
  performance: "charisma",
  persuasion: "charisma",
  religion: "intelligence",
  "sleight of hand": "dexterity",
  stealth: "dexterity",
  survival: "wisdom",
};

const ABB = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};
const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

function buildCharacterViewHelpers(c) {
  const abs = c.abilityScores;
  const prof = c.proficiencies;
  const profBonus = c.proficiencyBonus?.calculate
    ? c.proficiencyBonus.calculate()
    : c.proficiencyBonus?.baseValue || 2;

  function getScore(ability) {
    return abs.getTotal ? abs.getTotal(ability) : abs.scores?.[ability] || 10;
  }
  function getMod(ability) {
    return abs.getModifier
      ? abs.getModifier(ability)
      : Math.floor((getScore(ability) - 10) / 2);
  }
  function fmt(n) {
    return n >= 0 ? "+" + n : String(n);
  }

  // Ability scores
  const abilityData = ABILITIES.map((a) => ({
    name: a,
    abbr: ABB[a],
    score: getScore(a),
    mod: getMod(a),
    modStr: fmt(getMod(a)),
  }));

  // Saving throws
  const savingThrows = ABILITIES.map((a) => {
    const isProficient = !!prof.savingThrows?.[a];
    const base = getMod(a);
    const total = isProficient ? base + profBonus : base;
    return {
      name: a,
      label: a.charAt(0).toUpperCase() + a.slice(1),
      proficient: isProficient,
      mod: total,
      modStr: fmt(total),
    };
  });

  // Skills
  const skills = Object.entries(SKILL_ABILITIES).map(([skill, ability]) => {
    const abilityMod = getMod(ability);
    const s = prof.skills?.[skill];
    const isProficient = !!s?.proficient;
    let total = abilityMod;
    if (isProficient) total += profBonus;
    if (s?.expertise) total += profBonus;
    return {
      name: skill,
      label: skill
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      ability: ABB[ability],
      proficient: isProficient,
      mod: total,
      modStr: fmt(total),
    };
  });

  // Combat
  const classStr = (c.classes || [])
    .map(
      (cl) =>
        cl.className +
        " " +
        cl.level +
        (cl.subclassName ? " (" + cl.subclassName + ")" : ""),
    )
    .join(" / ");
  const bgStr = (c.backgrounds || []).map((b) => b.sourceName).join(", ");
  const raceDisplay =
    (c.subrace?.sourceName ? c.subrace.sourceName + " " : "") +
    (c.race?.sourceName || "Unknown Race");
  const totalLevel = c.getTotalLevel
    ? c.getTotalLevel()
    : (c.classes || []).reduce((s, cl) => s + cl.level, 0);
  const hitDieStr = Object.entries(c.hitDice || {})
    .map(([d, n]) => n + d)
    .join(" + ");

  // Proficiency strings
  const otherProfs = [];
  if (prof.armor?.length) otherProfs.push("Armor: " + prof.armor.join(", "));
  if (prof.weapons?.length)
    otherProfs.push("Weapons: " + prof.weapons.join(", "));
  if (prof.tools?.length) otherProfs.push("Tools: " + prof.tools.join(", "));
  if (prof.languages?.length)
    otherProfs.push("Languages: " + prof.languages.join(", "));

  // Features - include REAL_FEATURE and CUSTOM category
  const features = (c.features || [])
    .filter((f) => f.category === "REAL_FEATURE" || f.category === "CUSTOM")
    .map((f, idx) => ({
      id: f.id || idx,
      name: f.name,
      description: f.description ? stripHtmlTags(String(f.description)) : "",
      selectable: f.selectable,
      category: f.category,
    }));

  // Equipment
  const equipment = (c.equipment || []).map((e) => ({
    name: e.item?.name || e.name || "?",
    quantity: e.quantity || 1,
    type: e.item?.type || "",
    weaponCategory: e.item?.weaponCategory || "",
    dmg1: e.item?.dmg1 || "",
    dmgType: e.item?.dmgType || "",
    properties: e.item?.property || [],
  }));

  // Spellbook
  const sbKeys = Object.keys(c.spellbooks || {});
  const mainSB = sbKeys.length > 0 ? c.spellbooks[sbKeys[0]] : null;
  let spellData = null;
  if (mainSB) {
    const cantrips = mainSB.cantripsKnown || [];
    const allSpells = [...(mainSB.known || []), ...(mainSB.prepared || [])];
    const spellMap = new Map();
    allSpells.forEach((s) => spellMap.set(s.name, s));
    const uniqueSpells = Array.from(spellMap.values());
    const spellsByLevel = {};
    uniqueSpells.forEach((s) => {
      const lvl = s.level || 1;
      if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
      spellsByLevel[lvl].push(s);
    });
    const slots = mainSB.slots?.slots || {};

    spellData = {
      className: sbKeys[0],
      ability: mainSB.spellcastingAbility
        ? ABB[mainSB.spellcastingAbility] || mainSB.spellcastingAbility
        : "",
      saveDC: mainSB.spellSaveDC || 0,
      attackBonus: mainSB.spellAttackBonus || 0,
      attackBonusStr: fmt(mainSB.spellAttackBonus || 0),
      cantrips,
      spellsByLevel,
      slots,
    };
  } else {
    // Provide empty spellData so the Spellbook tab is always available for manual additions
    spellData = {
      className: "Custom",
      ability: "",
      saveDC: 0,
      attackBonus: 0,
      attackBonusStr: "+0",
      cantrips: [],
      spellsByLevel: {},
      slots: {
        1: { max: 0, used: 0 },
        2: { max: 0, used: 0 },
        3: { max: 0, used: 0 },
        4: { max: 0, used: 0 },
        5: { max: 0, used: 0 },
        6: { max: 0, used: 0 },
        7: { max: 0, used: 0 },
        8: { max: 0, used: 0 },
        9: { max: 0, used: 0 },
      },
    };
  }

  // Weapon attacks
  const strMod = getMod("strength");
  const dexMod = getMod("dexterity");
  const weapons = equipment
    .filter((e) => e.type === "M" || e.type === "R" || e.weaponCategory)
    .slice(0, 3)
    .map((w) => {
      const finesse = w.properties?.includes?.("F");
      const atkMod =
        w.type === "R" ? dexMod : finesse ? Math.max(strMod, dexMod) : strMod;
      return {
        name: w.name,
        atkBonusStr: fmt(atkMod + profBonus),
        damage: (w.dmg1 || "") + " " + (w.dmgType || ""),
      };
    });

  return {
    abilityData,
    savingThrows,
    skills,
    classStr,
    bgStr,
    raceDisplay,
    totalLevel,
    hitDieStr,
    profBonusStr: fmt(profBonus),
    profBonus,
    otherProfs,
    features,
    equipment,
    spellData,
    weapons,
    fmt,
  };
}
