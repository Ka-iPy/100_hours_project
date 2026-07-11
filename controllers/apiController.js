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
      break;
    case "item":
      data = loader.getItem(cleanName, cleanSource);
      break;
    case "feat":
      data = loader.getFeat(cleanName, cleanSource);
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
