import loader from "../data/loader.js";
import SpellListResolver from "../models/SpellListResolver.js";
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

  res.json(context);
}

/**
 * GET /api/equipment/class/:className
 * Query params: classSource
 * Returns structured starting equipment choices.
 */
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
    const text = defaultText[i] || "";
    const options = [];

    for (const [key, items] of Object.entries(group)) {
      const resolvedItems = [];
      for (const item of items) {
        if (typeof item === "string") {
          const [itemName, itemSource] = item.split("|");
          const itemData = loader.getItemByName(itemName);
          resolvedItems.push({
            name: itemName,
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
          resolvedItems.push({
            name: item.equipmentType,
            type: "category",
            equipmentType: item.equipmentType,
          });
        } else if (item.item) {
          const [itemName, itemSource] = item.item.split("|");
          const itemData = loader.getItemByName(itemName);
          resolvedItems.push({
            name: itemName,
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
      text,
      options,
      isAutomatic: Object.keys(group).length === 1 && group._ !== undefined,
    });
  }

  res.json({
    choices,
    goldAlternative: equipment.goldAlternative || null,
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
