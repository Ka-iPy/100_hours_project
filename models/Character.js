import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  SourceReference,
  TracedModifier,
  TracedValue,
  TracedResource,
  SOURCE_CATEGORIES,
  STACKING_MODES,
} from "./TracedModifier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ABILITY_SCORES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];
export const ABILITY_ABBREVS = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export const SAVING_THROW_PROFICIENCIES = {
  barbarian: ["strength", "constitution"],
  fighter: ["strength", "constitution"],
  paladin: ["wisdom", "charisma"],
  ranger: ["strength", "dexterity"],
  rogue: ["dexterity", "intelligence"],
  monk: ["strength", "dexterity"],
  cleric: ["wisdom", "charisma"],
  druid: ["intelligence", "wisdom"],
  wizard: ["intelligence", "wisdom"],
  warlock: ["wisdom", "charisma"],
  sorcerer: ["constitution", "charisma"],
  bard: ["dexterity", "charisma"],
};

export class AbilityScoreSet {
  constructor() {
    this.scores = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    this.tracedScores = Object.fromEntries(
      ABILITY_SCORES.map((score) => [score, new TracedValue(10)]),
    );
  }

  setBase(ability, value) {
    if (this.scores.hasOwnProperty(ability)) {
      this.scores[ability] = value;
      this.tracedScores[ability].baseValue = value;
    }
  }

  addModifier(ability, modifier) {
    if (!this.tracedScores[ability]) return;
    if (modifier instanceof TracedModifier) {
      this.tracedScores[ability].add(modifier);
    } else {
      this.tracedScores[ability].add(new TracedModifier({ value: modifier }));
    }
  }

  getModifier(ability) {
    return Math.floor((this.getTotal(ability) - 10) / 2);
  }

  getTotal(ability) {
    return this.tracedScores[ability]?.calculate() || 10;
  }

  getModifierBreakdown(ability) {
    return this.tracedScores[ability]?.getModifierBreakdown() || [];
  }

  getAllSources(ability) {
    return this.tracedScores[ability]?.getAllSources() || [];
  }

  toJSON() {
    return {
      scores: { ...this.scores },
      tracedScores: Object.fromEntries(
        Object.entries(this.tracedScores).map(([k, v]) => [k, v.toJSON()]),
      ),
    };
  }

  static fromJSON(json) {
    const ass = new AbilityScoreSet();
    ass.scores = json.scores;
    Object.keys(ass.tracedScores).forEach((key) => {
      if (json.tracedScores[key]) {
        ass.tracedScores[key] = TracedValue.fromJSON(json.tracedScores[key]);
      }
    });
    return ass;
  }
}

export class ClassLevel {
  constructor({
    className,
    classSource = "PHB",
    level,
    subclassName = null,
    subclassSource = null,
  }) {
    this.className = className;
    this.classSource = classSource;
    this.level = level;
    this.subclassName = subclassName;
    this.subclassSource = subclassSource;
    this.features = [];
    this.source = new SourceReference({
      category: SOURCE_CATEGORIES.CLASS,
      sourceName: className,
      sourceId: `${className}|${classSource}`,
      level,
    });
  }

  addFeature(feature) {
    this.features.push(feature);
  }

  getSource() {
    return this.source;
  }

  toJSON() {
    return {
      className: this.className,
      classSource: this.classSource,
      level: this.level,
      subclassName: this.subclassName,
      subclassSource: this.subclassSource,
      features: this.features.map((f) => f.toJSON()),
    };
  }

  static fromJSON(json) {
    const cl = new ClassLevel({
      className: json.className,
      classSource: json.classSource,
      level: json.level,
      subclassName: json.subclassName,
      subclassSource: json.subclassSource,
    });
    cl.features = (json.features || []).map((f) => TracedFeature.fromJSON(f));
    return cl;
  }
}

import { FEATURE_CATEGORIES } from "../utils/featureCategory.js";

export class TracedFeature {
  constructor({
    name,
    description = "",
    source,
    active = true,
    selectable = false,
    availableOptions = null,
    category = FEATURE_CATEGORIES.REAL_FEATURE,
  }) {
    this.name = name;
    this.description = description;
    this.source = source;
    this.active = active;
    this.selectable = selectable;
    this.availableOptions = availableOptions;
    this.selectedOption = null;
    this.effects = [];
    this.prerequisites = [];
    this.category = category;
  }

  addEffect(effect) {
    this.effects.push(effect);
    return this;
  }

  addPrerequisite(prereq) {
    this.prerequisites.push(prereq);
    return this;
  }

  isActive() {
    return this.active && this.prerequisites.every((p) => p.satisfied);
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      source: this.source ? this.source.toJSON() : null,
      active: this.active,
      selectable: this.selectable,
      availableOptions: this.availableOptions,
      selectedOption: this.selectedOption,
      effects: this.effects,
      prerequisites: this.prerequisites,
      category: this.category,
    };
  }

  static fromJSON(json) {
    const tf = new TracedFeature({
      name: json.name,
      description: json.description,
      source: json.source ? SourceReference.fromJSON(json.source) : null,
      active: json.active,
      selectable: json.selectable ?? false,
      availableOptions: json.availableOptions ?? null,
      category: json.category ?? FEATURE_CATEGORIES.REAL_FEATURE,
    });
    tf.selectedOption = json.selectedOption ?? null;
    tf.effects = json.effects || [];
    tf.prerequisites = json.prerequisites || [];
    return tf;
  }
}

export class ProficiencySet {
  constructor() {
    this.savingThrows = {
      strength: false,
      dexterity: false,
      constitution: false,
      intelligence: false,
      wisdom: false,
      charisma: false,
    };
    this.skills = {};
    this.armor = [];
    this.weapons = [];
    this.tools = [];
    this.languages = [];

    this.skillSources = {};
    this.armorSources = [];
    this.weaponSources = [];
    this.toolSources = [];
    this.languageSources = [];
  }

  addSavingThrowProficiency(ability, source) {
    if (this.savingThrows.hasOwnProperty(ability)) {
      this.savingThrows[ability] = true;
    }
    return this;
  }

  addSkillProficiency(skill, level = "proficient", source) {
    if (!this.skills[skill]) {
      this.skills[skill] = { proficient: false, expertise: false };
    }
    if (level === "expertise") {
      this.skills[skill].expertise = true;
      this.skills[skill].proficient = true;
    } else if (level === "proficient") {
      this.skills[skill].proficient = true;
    }
    this.skillSources[skill] = this.skillSources[skill] || [];
    if (source) this.skillSources[skill].push(source);
  }

  addArmorProficiency(armor, source) {
    if (!this.armor.includes(armor)) {
      this.armor.push(armor);
      if (source) this.armorSources.push(source);
    }
  }

  addWeaponProficiency(weapon, source) {
    if (!this.weapons.includes(weapon)) {
      this.weapons.push(weapon);
      if (source) this.weaponSources.push(source);
    }
  }

  addToolProficiency(tool, source) {
    if (!this.tools.includes(tool)) {
      this.tools.push(tool);
      if (source) this.toolSources.push(source);
    }
  }

  addLanguage(language, source) {
    if (!this.languages.includes(language)) {
      this.languages.push(language);
      if (source) this.languageSources.push(source);
    }
  }

  isProficient(ability) {
    return !!this.savingThrows[ability];
  }

  getSkillModifier(skill, abilityModifier, proficiencyBonus = 0) {
    const skillData = this.skills[skill];
    if (!skillData || !skillData.proficient) return abilityModifier;
    let bonus = abilityModifier + proficiencyBonus;
    if (skillData.expertise) bonus += proficiencyBonus;
    return bonus;
  }

  getSkillSources(skill) {
    return this.skillSources[skill] || [];
  }

  toJSON() {
    return {
      savingThrows: { ...this.savingThrows },
      skills: { ...this.skills },
      armor: [...this.armor],
      weapons: [...this.weapons],
      tools: [...this.tools],
      languages: [...this.languages],
      skillSources: Object.fromEntries(
        Object.entries(this.skillSources).map(([k, v]) => [
          k,
          v.map((s) => s.toJSON()),
        ]),
      ),
      armorSources: this.armorSources.map((s) => s.toJSON()),
      weaponSources: this.weaponSources.map((s) => s.toJSON()),
      toolSources: this.toolSources.map((s) => s.toJSON()),
      languageSources: this.languageSources.map((s) => s.toJSON()),
    };
  }

  static fromJSON(json) {
    const ps = new ProficiencySet();
    ps.savingThrows = json.savingThrows || ps.savingThrows;
    ps.skills = json.skills || {};
    ps.armor = json.armor || [];
    ps.weapons = json.weapons || [];
    ps.tools = json.tools || [];
    ps.languages = json.languages || [];
    ps.skillSources = Object.fromEntries(
      Object.entries(json.skillSources || {}).map(([k, v]) => [
        k,
        v.map((s) => SourceReference.fromJSON(s)),
      ]),
    );
    ps.armorSources = (json.armorSources || []).map((s) =>
      SourceReference.fromJSON(s),
    );
    ps.weaponSources = (json.weaponSources || []).map((s) =>
      SourceReference.fromJSON(s),
    );
    ps.toolSources = (json.toolSources || []).map((s) =>
      SourceReference.fromJSON(s),
    );
    ps.languageSources = (json.languageSources || []).map((s) =>
      SourceReference.fromJSON(s),
    );
    return ps;
  }
}

export class SpellSlots {
  constructor() {
    this.slots = {
      1: { max: 0, used: 0 },
      2: { max: 0, used: 0 },
      3: { max: 0, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    };
    this.sources = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
    };
  }

  setMax(level, max, source) {
    if (this.slots[level]) {
      this.slots[level].max = max;
      if (source) this.sources[level].push(source);
    }
  }

  getAvailable(level) {
    return this.slots[level]
      ? this.slots[level].max - this.slots[level].used
      : 0;
  }

  use(level) {
    if (this.slots[level] && this.slots[level].used < this.slots[level].max) {
      this.slots[level].used++;
      return true;
    }
    return false;
  }

  longRest() {
    Object.keys(this.slots).forEach((level) => {
      this.slots[level].used = 0;
    });
  }

  toJSON() {
    return {
      slots: { ...this.slots },
      sources: Object.fromEntries(
        Object.entries(this.sources).map(([k, v]) => [
          k,
          v.map((s) => s.toJSON()),
        ]),
      ),
    };
  }

  static fromJSON(json) {
    const ss = new SpellSlots();
    ss.slots = json.slots || ss.slots;
    ss.sources = Object.fromEntries(
      Object.entries(json.sources || {}).map(([k, v]) => [
        k,
        v.map((s) => SourceReference.fromJSON(s)),
      ]),
    );
    return ss;
  }
}

export class Spellbook {
  constructor() {
    this.known = [];
    this.prepared = [];
    this.slots = new SpellSlots();
    this.cantripsKnown = [];
    this.spellcastingAbility = null;
    this.spellSaveDC = 0;
    this.spellAttackBonus = 0;
  }

  addKnown(spell, source) {
    if (!this.known.find((s) => s.name === spell.name)) {
      this.known.push({ ...spell, source });
    }
  }

  prepare(spell) {
    if (!this.prepared.find((s) => s.name === spell.name)) {
      this.prepared.push(spell);
    }
  }

  unprepare(spell) {
    this.prepared = this.prepared.filter((s) => s.name !== spell.name);
  }

  toJSON() {
    return {
      known: this.known,
      prepared: this.prepared,
      slots: this.slots.toJSON(),
      cantripsKnown: this.cantripsKnown,
      spellcastingAbility: this.spellcastingAbility,
      spellSaveDC: this.spellSaveDC,
      spellAttackBonus: this.spellAttackBonus,
    };
  }

  static fromJSON(json) {
    const sb = new Spellbook();
    sb.known = json.known || [];
    sb.prepared = json.prepared || [];
    sb.slots = SpellSlots.fromJSON(json.slots || {});
    sb.cantripsKnown = json.cantripsKnown || [];
    sb.spellcastingAbility = json.spellcastingAbility;
    sb.spellSaveDC = json.spellSaveDC || 0;
    sb.spellAttackBonus = json.spellAttackBonus || 0;
    return sb;
  }
}

export class Equipment {
  constructor({
    item,
    quantity = 1,
    source,
    attuned = false,
    equipped = false,
    wielded = false,
  }) {
    this.item = item;
    this.quantity = quantity;
    this.source = source;
    this.attuned = attuned;
    this.equipped = equipped;
    this.wielded = wielded;
  }

  toJSON() {
    return {
      item: this.item,
      quantity: this.quantity,
      source: this.source ? this.source.toJSON() : null,
      attuned: this.attuned,
      equipped: this.equipped,
      wielded: this.wielded,
    };
  }

  static fromJSON(json) {
    return new Equipment({
      item: json.item,
      quantity: json.quantity,
      source: json.source ? SourceReference.fromJSON(json.source) : null,
      attuned: json.attuned,
      equipped: json.equipped,
      wielded: json.wielded,
    });
  }
}

export class Character {
  constructor() {
    this.id = crypto.randomUUID();
    this.player = "";
    this.playerID = "";
    this.name = "";
    this.alignment = "";
    this.experience = 0;

    this.race = null;
    this.subrace = null;
    this.backgrounds = [];
    this.charCreationOptions = [];

    this.classes = [];
    this.feats = [];

    this.abilityScores = new AbilityScoreSet();
    this.proficiencies = new ProficiencySet();

    this.equipment = [];
    this.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

    this.maxHitPoints = 0;
    this.currentHitPoints = 0;
    this.tempHitPoints = 0;
    this.hitDice = {}; // e.g., { 'd12': 1 }
    this.usedHitDice = {};

    this.armorClass = new TracedValue(10);
    this.initiative = new TracedValue(0);
    this.speed = new TracedValue(30);
    this.proficiencyBonus = new TracedValue(2);

    this.passivePerception = 10;
    this.features = [];
    this.spellbooks = {};
    this.resources = {};
    this.inspiration = false;
    this.traits = { personalityTrait: "", ideal: "", bond: "", flaw: "" };
    this.conditions = [];
    this.exhaustion = 0;
    this.pendingFeatureSelections = [];
    this.deathSaveSuccess1 = false;
    this.deathSaveSuccess2 = false;
    this.deathSaveSuccess3 = false;
    this.deathSaveFail1 = false;
    this.deathSaveFail2 = false;
    this.deathSaveFail3 = false;
    this.otherProficiencies = [];
    this.portrait = "";
  }

  getTotalLevel() {
    return this.classes.reduce((sum, cl) => sum + cl.level, 0);
  }

  getClassLevel(className) {
    const cls = this.classes.find(
      (c) => c.className.toLowerCase() === className.toLowerCase(),
    );
    return cls ? cls.level : 0;
  }

  getPrimaryClass() {
    return this.classes[0] || null;
  }

  addClass(classLevel) {
    const existing = this.classes.find(
      (c) => c.className === classLevel.className,
    );
    if (existing) {
      existing.level += classLevel.level;
    } else {
      this.classes.push(classLevel);
    }
    this.recalculateDerivedStats();
  }

  addFeature(feature) {
    this.features.push(feature);
  }

  addPendingSelection(pendingSelection) {
    this.pendingFeatureSelections.push(pendingSelection);
  }

  completeFeatureSelection(selectionId, selectedOption) {
    const pendingIndex = this.pendingFeatureSelections.findIndex(
      (p) => p.id === selectionId,
    );
    if (pendingIndex === -1) return false;

    const pending = this.pendingFeatureSelections[pendingIndex];

    const newFeature = new TracedFeature({
      name: pending.featureName,
      description: selectedOption.description || pending.featureName,
      source: pending.source,
      selectable: false,
    });
    newFeature.selectedOption = selectedOption;
    newFeature.effects = pending.effects || [];

    this.features.push(newFeature);
    this.pendingFeatureSelections.splice(pendingIndex, 1);
    return true;
  }

  getPendingSelections() {
    return [...this.pendingFeatureSelections];
  }

  hasPendingSelections() {
    return this.pendingFeatureSelections.length > 0;
  }

  getFeature(name) {
    return this.getAllFeatures().find(
      (f) => f.name.toLowerCase() === name.toLowerCase(),
    );
  }

  getAllFeatures() {
    const allFeatures = [...this.features];
    this.classes.forEach((cls) => {
      allFeatures.push(...cls.features);
    });
    return allFeatures;
  }

  calculateArmorClass() {
    return this.armorClass.calculate();
  }

  calculateInitiative() {
    return this.initiative.calculate();
  }

  calculateSpeed() {
    return this.speed.calculate();
  }

  calculateProficiencyBonus() {
    return this.proficiencyBonus.calculate();
  }

  getACBreakdown() {
    return this.armorClass.getModifierBreakdown();
  }

  getInitiativeBreakdown() {
    return this.initiative.getModifierBreakdown();
  }

  getSpeedBreakdown() {
    return this.speed.getModifierBreakdown();
  }

  recalculateDerivedStats() {
    const level = this.getTotalLevel();
    // PB: 2 at level 1, +1 every 4 levels (5, 9, 13, 17)
    this.proficiencyBonus.baseValue = Math.floor((level - 1) / 4) + 2;
    this.initiative.baseValue = this.abilityScores.getModifier("dexterity");

    // Passive Perception = 10 + Wis Mod + (Proficiency if applicable)
    const wisMod = this.abilityScores.getModifier("wisdom");
    const pb = this.calculateProficiencyBonus();
    const perceptionProf = this.proficiencies.skills["perception"];
    let passive = 10 + wisMod;
    if (perceptionProf?.proficient) passive += pb;
    if (perceptionProf?.expertise) passive += pb;
    this.passivePerception = passive;
  }

  addResource(name, resource) {
    this.resources[name] = resource;
  }

  getResource(name) {
    return this.resources[name] || null;
  }

  longRest() {
    this.currentHitPoints = this.maxHitPoints;
    this.tempHitPoints = 0;
    this.exhaustion = Math.max(0, this.exhaustion - 1);

    // Recover half hit dice
    Object.keys(this.hitDice).forEach((die) => {
      const total = this.hitDice[die];
      const recovered = Math.max(1, Math.floor(total / 2));
      this.usedHitDice[die] = Math.max(
        0,
        (this.usedHitDice[die] || 0) - recovered,
      );
    });

    Object.values(this.resources).forEach((res) => {
      if (["longRest", "dawn", "shortRest"].includes(res.rechargeType)) {
        res.currentUses = res.maxUses?.calculate() ?? res.currentUses;
      }
    });

    Object.values(this.spellbooks).forEach((sb) => {
      sb.slots.longRest();
    });
  }

  shortRest() {
    Object.values(this.resources).forEach((res) => {
      if (res.rechargeType === "shortRest") {
        res.currentUses = res.maxUses?.calculate() ?? res.currentUses;
      }
    });
  }

  useHitDice(dieType, quantity = 1) {
    const available =
      (this.hitDice[dieType] || 0) - (this.usedHitDice[dieType] || 0);
    if (available >= quantity) {
      this.usedHitDice[dieType] = (this.usedHitDice[dieType] || 0) + quantity;
      return true;
    }
    return false;
  }

  toJSON() {
    return {
      id: this.id,
      player: this.player,
      playerID: this.playerID,
      name: this.name,
      alignment: this.alignment,
      experience: this.experience,
      race: this.race?.toJSON() ?? null,
      subrace: this.subrace?.toJSON() ?? null,
      backgrounds: this.backgrounds.map((b) => b.toJSON()),
      charCreationOptions: this.charCreationOptions.map((o) => o.toJSON()),
      classes: this.classes.map((c) => c.toJSON()),
      feats: this.feats.map((f) => f.toJSON()),
      abilityScores: this.abilityScores.toJSON(),
      proficiencies: this.proficiencies.toJSON(),
      equipment: this.equipment.map((e) => e.toJSON()),
      currency: { ...this.currency },
      maxHitPoints: this.maxHitPoints,
      currentHitPoints: this.currentHitPoints,
      tempHitPoints: this.tempHitPoints,
      hitDice: { ...this.hitDice },
      usedHitDice: { ...this.usedHitDice },
      armorClass: this.armorClass?.toJSON
        ? this.armorClass.toJSON()
        : { baseValue: this.armorClass ?? 10, modifiers: [] },
      initiative: this.initiative?.toJSON
        ? this.initiative.toJSON()
        : { baseValue: this.initiative ?? 0, modifiers: [] },
      speed: this.speed?.toJSON
        ? this.speed.toJSON()
        : { baseValue: this.speed ?? 30, modifiers: [] },
      proficiencyBonus: this.proficiencyBonus?.toJSON
        ? this.proficiencyBonus.toJSON()
        : { baseValue: this.proficiencyBonus ?? 2, modifiers: [] },
      passivePerception: this.passivePerception,
      features: this.features.map((f) => f.toJSON()),
      spellbooks: Object.fromEntries(
        Object.entries(this.spellbooks).map(([k, v]) => [k, v.toJSON()]),
      ),
      resources: Object.fromEntries(
        Object.entries(this.resources).map(([k, v]) => [k, v.toJSON()]),
      ),
      inspiration: this.inspiration,
      traits: { ...this.traits },
      conditions: [...this.conditions],
      exhaustion: this.exhaustion,
      pendingFeatureSelections: this.pendingFeatureSelections,
      deathSaveSuccess1: this.deathSaveSuccess1,
      deathSaveSuccess2: this.deathSaveSuccess2,
      deathSaveSuccess3: this.deathSaveSuccess3,
      deathSaveFail1: this.deathSaveFail1,
      deathSaveFail2: this.deathSaveFail2,
      deathSaveFail3: this.deathSaveFail3,
      otherProficiencies: [...this.otherProficiencies],
      portrait: this.portrait,
    };
  }

  static fromJSON(json) {
    const char = new Character();
    char.id = json.id || crypto.randomUUID();
    char.player = json.player || "";
    char.playerID = json.playerID || "";
    char.name = json.name || "";
    char.alignment = json.alignment || "";
    char.experience = json.experience || 0;
    char.race = json.race ? SourceReference.fromJSON(json.race) : null;
    char.subrace = json.subrace ? SourceReference.fromJSON(json.subrace) : null;
    char.backgrounds = (json.backgrounds || []).map((b) =>
      SourceReference.fromJSON(b),
    );
    char.charCreationOptions = (json.charCreationOptions || []).map((o) =>
      SourceReference.fromJSON(o),
    );
    char.classes = (json.classes || []).map((c) => ClassLevel.fromJSON(c));
    char.feats = (json.feats || []).map((f) => TracedFeature.fromJSON(f));
    char.abilityScores = AbilityScoreSet.fromJSON(json.abilityScores);
    char.proficiencies = ProficiencySet.fromJSON(json.proficiencies);
    char.equipment = (json.equipment || []).map((e) => Equipment.fromJSON(e));
    char.currency = json.currency || char.currency;
    char.maxHitPoints = json.maxHitPoints || 0;
    char.currentHitPoints = json.currentHitPoints || 0;
    char.tempHitPoints = json.tempHitPoints || 0;
    char.hitDice = json.hitDice || {};
    char.usedHitDice = json.usedHitDice || {};
    char.armorClass = TracedValue.fromJSON(json.armorClass);
    char.initiative = TracedValue.fromJSON(json.initiative);
    char.speed = TracedValue.fromJSON(json.speed);
    char.proficiencyBonus = TracedValue.fromJSON(json.proficiencyBonus);
    char.passivePerception = json.passivePerception || 10;
    char.features = (json.features || []).map((f) => TracedFeature.fromJSON(f));
    char.spellbooks = Object.fromEntries(
      Object.entries(json.spellbooks || {}).map(([k, v]) => [
        k,
        Spellbook.fromJSON(v),
      ]),
    );
    char.resources = Object.fromEntries(
      Object.entries(json.resources || {}).map(([k, v]) => [
        k,
        TracedResource.fromJSON(v),
      ]),
    );
    char.inspiration = !!json.inspiration;
    char.traits = json.traits || char.traits;
    char.conditions = json.conditions || [];
    char.exhaustion = json.exhaustion || 0;
    char.pendingFeatureSelections = json.pendingFeatureSelections || [];
    char.deathSaveSuccess1 = !!json.deathSaveSuccess1;
    char.deathSaveSuccess2 = !!json.deathSaveSuccess2;
    char.deathSaveSuccess3 = !!json.deathSaveSuccess3;
    char.deathSaveFail1 = !!json.deathSaveFail1;
    char.deathSaveFail2 = !!json.deathSaveFail2;
    char.deathSaveFail3 = !!json.deathSaveFail3;
    char.otherProficiencies = json.otherProficiencies || [];
    char.portrait = json.portrait || "";
    return char;
  }

  async save(filepath = null) {
    const savePath =
      filepath ||
      path.join(
        __dirname,
        "..",
        "data",
        "generated",
        "characters",
        `${this.id}.json`,
      );
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(savePath, JSON.stringify(this.toJSON(), null, 2));
    return savePath;
  }

  static async load(id) {
    const filepath = path.join(
      __dirname,
      "..",
      "data",
      "generated",
      "characters",
      `${id}.json`,
    );
    if (!fs.existsSync(filepath)) return null;
    const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
    return Character.fromJSON(data);
  }

  static async loadAllForPlayer(playerId) {
    const dir = path.join(__dirname, "..", "data", "generated", "characters");
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    const characters = [];
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (data.playerID === playerId || data.player === playerId) {
        characters.push(Character.fromJSON(data));
      }
    }
    return characters;
  }

  async delete() {
    const filepath = path.join(
      __dirname,
      "..",
      "data",
      "generated",
      "characters",
      `${this.id}.json`,
    );
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}

export default Character;
