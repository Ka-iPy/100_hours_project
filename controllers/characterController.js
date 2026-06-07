import { CharacterBuilder } from "../models/CharacterBuilder.js";
import { Character, Equipment, TracedFeature } from "../models/Character.js";
import loader from "../data/loader.js";
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
        name: sr.name,
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
      return JSON.stringify({ name: feat.name, source: feat.source });
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

  printPDF: async (req, res) => {
    try {
      const { id } = req.params;
      const character = await Character.load(id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const helpers = buildCharacterViewHelpers(character);
      const html = await new Promise((resolve, reject) => {
        res.app.render("character", { character, ...helpers }, (err, html) => {
          if (err) reject(err);
          else resolve(html);
        });
      });

      const browser = await puppeteer.launch({
        executablePath: "/usr/bin/chromium",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.emulateMediaType("print");

      await page.evaluate(() => {
        document.querySelectorAll(".no-print, .fixed").forEach((el) => {
          el.style.display = "none !important";
        });
      });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: "0.4in",
          right: "0.4in",
          bottom: "0.4in",
          left: "0.4in",
        },
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${character.name.replace(/[^a-z0-9]/gi, "_")}_Character_Sheet.pdf"`,
      );
      res.send(pdf);
    } catch (err) {
      console.error("Error generating PDF:", err);
      res.status(500).json({ error: err.message });
    }
  },
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
    (c.race?.sourceName || "");
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
