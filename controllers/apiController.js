import loader from "../data/loader.js";
import SpellListResolver from "../models/SpellListResolver.js";
import { CerberusTagParser } from "../models/Cerberus.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const validCollections = [
  "races",
  "subraces",
  "backgrounds",
  "feats",
  "classes",
  "subclasses",
  "spells",
  "items",
  "optionalFeatures",
];

export function getCollection(req, res) {
  const { collection } = req.params;
  const { q } = req.query;

  if (!validCollections.includes(collection)) {
    return res.status(404).json({ error: "Collection not found" });
  }

  let data;
  if (collection === "subclasses") {
    data = loader.getSubclasses(req.query.className);
  } else if (collection === "optionalFeatures") {
    data = loader.getOptionalFeatures(req.query.type);
  } else {
    data = loader[collection];
  }

  if (q) {
    data = loader.search(collection, q);
  }

  res.json(data);
}

const SCHOOL_NAMES = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

/**
 * Helper to flatten complex spell entries into a string
 */
function flattenEntriesToString(entries) {
  if (!entries || !Array.isArray(entries)) return "";
  let text = "";
  for (const e of entries) {
    if (typeof e === "string") {
      text += e + "\n\n";
    } else if (e.type === "list") {
      for (const item of e.items) {
        if (typeof item === "string") {
          text += "• " + item + "\n";
        } else if (item.name) {
          text += "• " + item.name + ". " + flattenEntriesToString(item.entries || [item.entry]) + "\n";
        }
      }
      text += "\n";
    } else if (e.type === "entries") {
      text += (e.name ? e.name + ". " : "") + flattenEntriesToString(e.entries) + "\n\n";
    }
  }
  return text.trim();
}

/**
 * GET /api/spellbook
 * Returns all spells formatted for the spellbook viewer.
 * Merges filteredSpells (class membership + descriptions) with raw spells (source).
 * Query params: name, source, school, class, level
 */
export function getSpellbook(req, res) {
  const { name, source, school, class: className, level } = req.query;

  // Build a lookup from filteredSpells for class membership and descriptions
  const filteredMap = new Map();
  for (const fs of loader.filteredSpells || []) {
    filteredMap.set(fs.name.toLowerCase(), fs);
  }

  // Deduplicate raw spells by name (prefer entries-rich versions)
  const spellMap = new Map();
  for (const s of loader.spells) {
    const key = s.name.toLowerCase();
    const existing = spellMap.get(key);
    if (!existing || (!existing.entries && s.entries)) {
      spellMap.set(key, s);
    }
  }

  let spells = [];
  for (const [key, raw] of spellMap) {
    const filtered = filteredMap.get(key);

    // Build a clean spell entry
    const schoolCode = raw.school || "";
    const schoolName = SCHOOL_NAMES[schoolCode] || schoolCode;
    const lvl = raw.level ?? (filtered ? (filtered.level === "cantrip" ? 0 : parseInt(filtered.level)) : 0);
    const classes = filtered ? filtered.classes : [];

    // Extract description from raw entries or filtered description
    let description = "";
    if (raw.entries && raw.entries.length > 0) {
      description = flattenEntriesToString(raw.entries);
    } else if (filtered && filtered.description) {
      description = filtered.description;
    }

    let higherLevels = "";
    if (filtered && filtered.higher_levels) {
      higherLevels = filtered.higher_levels;
    } else if (raw.entriesHigherLevel) {
      for (const hl of raw.entriesHigherLevel) {
        if (hl.entries) {
          higherLevels += hl.entries.filter((e) => typeof e === "string").join("\n");
        }
      }
    }

    // Build casting time
    let castingTime = "";
    if (filtered && filtered.casting_time) {
      castingTime = filtered.casting_time;
    } else if (raw.time && raw.time.length > 0) {
      const t = raw.time[0];
      castingTime = `${t.number} ${t.unit}`;
    }

    // Build range
    let range = "";
    if (filtered && filtered.range) {
      range = filtered.range;
    } else if (raw.range) {
      if (raw.range.distance) {
        if (raw.range.distance.type === "self") range = "Self";
        else if (raw.range.distance.type === "touch") range = "Touch";
        else range = `${raw.range.distance.amount} ${raw.range.distance.type}`;
      }
    }

    // Build duration
    let duration = "";
    if (filtered && filtered.duration) {
      duration = filtered.duration;
    } else if (raw.duration && raw.duration.length > 0) {
      const d = raw.duration[0];
      if (d.type === "instant") duration = "Instantaneous";
      else if (d.type === "permanent") duration = "Until dispelled";
      else if (d.duration) {
        duration = `${d.concentration ? "Concentration, up to " : ""}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? "s" : ""}`;
      }
    }

    // Build components
    let components = "";
    if (filtered && filtered.components && filtered.components.raw) {
      components = filtered.components.raw;
    } else if (raw.components) {
      const parts = [];
      if (raw.components.v) parts.push("V");
      if (raw.components.s) parts.push("S");
      if (raw.components.m) {
        const mat = typeof raw.components.m === "string" ? raw.components.m : raw.components.m.text || "";
        parts.push(mat ? `M (${mat})` : "M");
      }
      components = parts.join(", ");
    }

    const isRitual = filtered ? filtered.ritual : (raw.meta && raw.meta.ritual) || false;
    const isConcentration = raw.duration ? raw.duration.some((d) => d.concentration) : false;

    spells.push({
      name: raw.name,
      source: raw.source || "Unknown",
      level: lvl,
      school: schoolName,
      classes,
      castingTime,
      range,
      duration,
      components,
      description,
      higherLevels,
      ritual: isRitual,
      concentration: isConcentration,
      type: filtered ? filtered.type : `${lvl === 0 ? schoolName + " cantrip" : `${ordinal(lvl)}-level ${schoolName.toLowerCase()}`}`,
    });
  }

  // Apply filters
  if (name) {
    const q = name.toLowerCase();
    spells = spells.filter((s) => s.name.toLowerCase().includes(q));
  }
  if (source) {
    spells = spells.filter((s) => s.source === source);
  }
  if (school) {
    const q = school.toLowerCase();
    spells = spells.filter((s) => s.school.toLowerCase() === q);
  }
  if (className) {
    const q = className.toLowerCase();
    spells = spells.filter((s) => s.classes.includes(q));
  }
  if (level !== undefined && level !== "") {
    const lvlNum = level === "cantrip" ? 0 : parseInt(level);
    if (!isNaN(lvlNum)) {
      spells = spells.filter((s) => s.level === lvlNum);
    }
  }

  // Sort alphabetically
  spells.sort((a, b) => a.name.localeCompare(b.name));

  // Collect unique filter values for dropdowns
  const allSources = [...new Set(spells.map((s) => s.source))].sort();
  const allSchools = [...new Set(spells.map((s) => s.school))].sort();
  const allClasses = [...new Set(spells.flatMap((s) => s.classes))].sort();
  const allLevels = [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b);

  res.json({
    spells,
    meta: { sources: allSources, schools: allSchools, classes: allClasses, levels: allLevels },
  });
}

function ordinal(n) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function getFeatOrigin(req, res) {
  const origin = loader.getFeatOrigin(req.params.name);
  if (!origin) return res.status(404).json({ error: "Origin not found" });
  res.json(origin);
}

export function getSubclassFeatureParent(req, res) {
  const { name, className, subclassShortName } = req.query;
  const parent = loader.getSubclassFeatureParent(
    name,
    className,
    subclassShortName,
  );
  if (!parent) return res.status(404).json({ error: "Parent not found" });
  res.json(parent);
}

export function getSubraceParent(req, res) {
  const { name, raceName, raceSource } = req.query;
  const parent = loader.getSubraceParent(name, raceName, raceSource);
  if (!parent) return res.status(404).json({ error: "Parent not found" });
  res.json(parent);
}

/**
 * GET /api/spells/context/:className/:level
 * Query params: classSource, subclassName, subclassSource
 * Returns the full spell selection context for character creation.
 */
export function getSpellContext(req, res) {
  const { className, level } = req.params;
  const { classSource = "PHB", subclassName, subclassSource } = req.query;
  const charLevel = parseInt(level);

  if (!className || isNaN(charLevel) || charLevel < 1 || charLevel > 20) {
    return res.status(400).json({ error: "Invalid class name or level" });
  }

  const resolver = new SpellListResolver(loader);
  const context = resolver.getSpellSelectionContext(
    className,
    classSource,
    charLevel,
    subclassName || null,
    subclassSource || null,
  );

  if (!context) {
    return res.json({ isCaster: false });
  }

  // Build spellList grouped by level (UI expects { "1": [...], "2": [...], ... })
  const spellList = {};
  if (context.spells && context.spells.length > 0) {
    for (const spell of context.spells) {
      const lvl = spell.level || 1;
      if (!spellList[lvl]) spellList[lvl] = [];
      spellList[lvl].push(spell);
    }
  }

  // Build slot map for UI
  const slots = {};
  if (context.spellSlots) {
    for (let i = 0; i < context.spellSlots.length; i++) {
      if (context.spellSlots[i] > 0) {
        slots[i + 1] = { max: context.spellSlots[i], used: 0 };
      }
    }
  }

  // Calculate DC and attack bonus with a default ability mod of 0
  // (actual mod depends on character stats, but we provide the base formula context)
  const abilityAbbr = (context.spellcastingAbility || "int").toUpperCase();
  const profBonus = Math.ceil(charLevel / 4) + 1;

  res.json({
    isCaster: true,
    casterProgression: context.casterProgression,
    ability: abilityAbbr,
    rawAbility: context.spellcastingAbility,
    acquisitionType: context.acquisitionType,
    maxSpellLevel: context.maxSpellLevel,
    slots,
    maxCantrips: context.numCantrips,
    maxSpells: context.numSpells,
    preparedFormula: context.preparedFormula,
    cantripList: context.cantrips,
    spellList,
    dc: 8 + profBonus,
    attackBonus: profBonus,
    subclassAlwaysPrepared: context.subclassAlwaysPrepared || [],
    subclassExpandedList: context.subclassExpandedList || [],
  });
}

/**
 * GET /api/equipment/class/:className
 * Query params: classSource
 * Returns structured starting equipment choices.
 */
const GENERIC_EQUIPMENT_MAP = {
  "weaponSimple": "Simple Weapon",
  "weaponMartial": "Martial Weapon",
  "armorLight": "Light Armor",
  "armorMedium": "Medium Armor",
  "armorHeavy": "Heavy Armor",
  "toolThieves": "Thieves' Tools",
  "toolArtisan": "Artisan's Tools",
  "instrumentMusical": "Musical Instrument",
  "packDungeoneer": "Dungeoneer's Pack",
  "packExplorer": "Explorer's Pack",
  "packPriest": "Priest's Pack",
  "packScholar": "Scholar's Pack",
  "packDiplomat": "Diplomat's Pack",
  "packEntertainer": "Entertainer's Pack",
  "packBurglar": "Burglar's Pack",
};

function formatEquipmentName(name) {
  if (!name || typeof name !== "string") return name || "";
  const rendered = CerberusTagParser.renderTags(name);
  if (GENERIC_EQUIPMENT_MAP[rendered]) {
    return GENERIC_EQUIPMENT_MAP[rendered];
  }
  return rendered;
}

export function getStartingEquipment(req, res) {
  const { className } = req.params;
  const { classSource = "PHB" } = req.query;

  const classData = loader.getClass(className, classSource);
  if (!classData) {
    return res.status(404).json({ error: "Class not found" });
  }

  const equipment = classData.startingEquipment;
  if (!equipment) {
    return res.json({ choices: [], goldAlternative: null });
  }

  const choices = [];
  const defaultData = equipment.defaultData || [];
  const defaultText = equipment.default || [];

  for (let i = 0; i < defaultData.length; i++) {
    const group = defaultData[i];
    const rawText = defaultText[i] || "";
    const cleanText = CerberusTagParser.renderTags(rawText);
    const options = [];

    for (const [key, items] of Object.entries(group)) {
      const resolvedItems = [];
      for (const item of items) {
        if (typeof item === "string") {
          const [itemName, itemSource] = item.split("|");
          const itemData = loader.getItemByName(itemName);
          const cleanName = formatEquipmentName(itemName);
          resolvedItems.push({
            name: cleanName,
            source: itemSource || null,
            data: itemData
              ? {
                name: itemData.name,
                type: itemData.type,
                weight: itemData.weight,
                value: itemData.value,
              }
              : null,
          });
        } else if (item.equipmentType) {
          const cleanName = formatEquipmentName(item.equipmentType);
          resolvedItems.push({
            name: cleanName,
            type: "category",
            equipmentType: item.equipmentType,
          });
        } else if (item.item) {
          const [itemName, itemSource] = item.item.split("|");
          const itemData = loader.getItemByName(itemName);
          const cleanName = formatEquipmentName(itemName);
          resolvedItems.push({
            name: cleanName,
            source: itemSource || null,
            quantity: item.quantity || 1,
            data: itemData
              ? {
                name: itemData.name,
                type: itemData.type,
                weight: itemData.weight,
                value: itemData.value,
              }
              : null,
          });
        }
      }

      options.push({
        key, // 'a', 'b', or '_' (automatic)
        items: resolvedItems,
      });
    }

    choices.push({
      text: cleanText,
      options,
      isAutomatic: Object.keys(group).length === 1 && group._ !== undefined,
    });
  }

  const goldAltRaw = equipment.goldAlternative || null;
  const goldAltClean = goldAltRaw ? CerberusTagParser.renderTags(goldAltRaw) : null;

  res.json({
    choices,
    goldAlternative: goldAltClean,
    additionalFromBackground: equipment.additionalFromBackground || false,
  });
}

export function lookupEntity(req, res) {
  const { type, name, source } = req.query;
  if (!type || !name) {
    return res.status(400).json({ error: "Missing type or name" });
  }

  const cleanName = name.trim();
  const cleanSource = source ? source.trim() : null;

  let data = null;

  switch (type.toLowerCase()) {
    case "spell":
      data = loader.getSpell(cleanName, cleanSource);
      // XPHB spells are Foundry stubs without entries/level/school — fall back to a content-rich version
      if (data && !data.entries) {
        const lowerName = cleanName.toLowerCase();
        const richVersion = loader.spells.find(
          (s) => s.name.toLowerCase() === lowerName && s.entries && s.source !== data.source,
        );
        if (richVersion) data = richVersion;
      }
      break;
    case "item":
      data = loader.getItem(cleanName, cleanSource);
      break;
    case "feat":
      data = loader.getFeat(cleanName, cleanSource);
      // Same stub-detection for feats
      if (data && !data.entries) {
        const lowerName = cleanName.toLowerCase();
        const richVersion = loader.feats.find(
          (f) => f.name.toLowerCase() === lowerName && f.entries && f.source !== data.source,
        );
        if (richVersion) data = richVersion;
      }
      break;
    case "race":
      data = loader.getRace(cleanName, cleanSource);
      break;
    case "background":
      data = loader.getBackground(cleanName, cleanSource);
      break;
    case "class":
      data = loader.getClass(cleanName, cleanSource);
      break;
    case "skill":
      data = loader.getSkill(cleanName);
      break;
    case "condition":
      try {
        const filePath = path.join(__dirname, "..", "data", "conditionsdiseases.json");
        if (fs.existsSync(filePath)) {
          const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const list = fileData.condition || [];
          data = list.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
        }
      } catch (err) {
        console.error("Error loading conditions:", err);
      }
      break;
    case "action":
      try {
        const filePath = path.join(__dirname, "..", "data", "actions.json");
        if (fs.existsSync(filePath)) {
          const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const list = fileData.action || [];
          data = list.find(a => a.name.toLowerCase() === cleanName.toLowerCase());
        }
      } catch (err) {
        console.error("Error loading actions:", err);
      }
      break;
    case "sense":
      try {
        const filePath = path.join(__dirname, "..", "data", "senses.json");
        if (fs.existsSync(filePath)) {
          const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const list = fileData.sense || [];
          data = list.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
        }
      } catch (err) {
        console.error("Error loading senses:", err);
      }
      break;
  }

  if (!data) {
    return res.status(404).json({ error: `${type} not found` });
  }

  res.json(data);
}
