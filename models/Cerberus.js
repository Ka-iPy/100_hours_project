import { isFeatureSelectable, extractAvailableOptions } from "../utils/featureSelectability.js";
import { categorizeFeature, FEATURE_CATEGORIES } from "../utils/featureCategory.js";
import { Tags } from "../utils/parser.js";

/**
 * Cerberus Tag Parser & Regular Expression Engine for 5etools tags:
 * {@spell Fireball|PHB}, {@feat Sentinel|PHB}, {@filter ...}, {@item ...}, etc.
 *
 * Regex + parsing logic is consolidated in `utils/parser.js` (Tags).
 */
export class CerberusTagParser {
  static TAG_REGEX = Tags.TAG_REGEX;

  /**
   * Parse 5etools markdown tags from text string
   */
  static parseTags(text) {
    return Tags.parseTags(text);
  }

  /**
   * Replace tags in text with readable names or custom HTML/markup
   */
  static renderTags(text, replacer = null) {
    return Tags.renderTags(text, replacer);
  }

  /**
   * Resolve a 5etools tag to a concrete database object using DataLoader
   */
  static resolveTagToEntity(tagObj, loader) {
    if (!tagObj || !loader) return null;
    const { tag, name, source } = tagObj;

    switch (tag) {
      case "spell":
        return loader.getSpell(name, source);
      case "feat":
        return loader.getFeat(name, source);
      case "item":
        return loader.getItem(name, source);
      case "race":
        return loader.getRace(name, source);
      case "background":
        return loader.getBackground(name, source);
      case "class":
        return loader.getClass(name, source);
      case "subclass":
        return loader.getSubclass(source || "", name);
      case "optfeature":
      case "optionalfeature":
        return loader.getOptionalFeatures().find(
          (of) => of.name.toLowerCase() === name.toLowerCase()
        );
      case "skill":
        return loader.getSkill(name);
      default:
        return null;
    }
  }
}

/**
 * Cerberus Watchdog Engine
 */
export class Cerberus {
  /**
   * Recursively watch and analyze any character creation choice or entity.
   */
  static watchChoice(entity, loader, options = {}) {
    const depth = options.depth || 0;
    const maxDepth = options.maxDepth !== undefined ? options.maxDepth : 5;
    const visited = options.visitedEntities || new Set();

    if (!entity) {
      return this.createEmptyReport("Unknown Entity");
    }

    const entityName = entity.name || entity.sourceName || "Unnamed Entity";
    const entityType = this.determineEntityType(entity);
    const entityKey = `${entityType}:${entityName}:${entity.source || ""}:${depth}`;

    if (visited.has(entityKey) || depth > maxDepth) {
      return this.createEmptyReport(entityName, entityType);
    }
    visited.add(entityKey);

    const descriptionText = this.flattenEntries(entity.entries || entity.description || []);

    const report = {
      entityName,
      entityType,
      source: entity.source || null,
      descriptionText,
      tagsParsed: CerberusTagParser.parseTags(descriptionText),
      autoGrants: {
        abilityScores: [],
        proficiencies: [],
        spells: [],
        passiveModifiers: [],
        features: [],
      },
      selectableChoices: [],
      depth,
    };

    // 1. Detect Auto-Grants
    this.detectAutoGrants(entity, descriptionText, report, loader);

    // 2. Detect Selectable Choices
    this.detectSelectableChoices(entity, descriptionText, report, loader);

    // 3. Parse 5etools additionalSpells structure
    this.parseAdditionalSpells(entity, descriptionText, report, loader);

    // 4. Class & Subclass Feature Expansion (retrieve child features up to level)
    if (loader) {
      if (entityType === "Class") {
        const classSrc = entity.source || "PHB";
        const classFeatures = loader.classFeatures.filter(
          (f) => f.className?.toLowerCase() === entity.name.toLowerCase() &&
                 (!f.classSource || f.classSource.toLowerCase() === classSrc.toLowerCase()) &&
                 (f.level <= (options.level || 20))
        );
        classFeatures.forEach((cf) => {
          const cfReport = this.watchChoice(cf, loader, { ...options, depth: depth + 1, visitedEntities: visited });
          this.mergeReportChildResults(report, cfReport);
        });
      } else if (entityType === "Subclass") {
        const scSrc = entity.source || "PHB";
        const scName = entity.shortName || entity.subclassShortName || entity.name;
        const scFeatures = loader.subclassFeatures.filter(
          (f) => f.className?.toLowerCase() === entity.className?.toLowerCase() &&
                 (!f.source || f.source.toLowerCase() === scSrc.toLowerCase()) &&
                 (f.subclassShortName?.toLowerCase() === scName.toLowerCase() || f.subclassName?.toLowerCase() === scName.toLowerCase()) &&
                 (f.level <= (options.level || 20))
        );
        scFeatures.forEach((sf) => {
          const sfReport = this.watchChoice(sf, loader, { ...options, depth: depth + 1, visitedEntities: visited });
          this.mergeReportChildResults(report, sfReport);
        });
      }
    }

    // 4. RECURSIVE WATCHER on nested option choices
    if (depth < maxDepth) {
      this.evaluateRecursively(entity, report, loader, {
        depth: depth + 1,
        maxDepth,
        visitedEntities: visited,
      });
    }

    return report;
  }

  /**
   * Recursively evaluate full character state or entity choices
   */
  static watchCharacter(character, loader) {
    const fullReport = {
      characterName: character.name || "Unnamed Character",
      raceReport: null,
      subraceReport: null,
      backgroundReports: [],
      classReports: [],
      featReports: [],
      aggregatedAutoGrants: {
        abilityScores: [],
        proficiencies: [],
        spells: [],
        passiveModifiers: [],
        features: [],
      },
      aggregatedSelectableChoices: [],
    };

    if (character.race) {
      const raceName = character.race.sourceName || character.race.name;
      const raceSource = (character.race.sourceId && character.race.sourceId.includes("|"))
        ? character.race.sourceId.split("|")[1]
        : (character.race.source || "PHB");
      const raceData = loader.getRace(raceName, raceSource);
      if (raceData) {
        fullReport.raceReport = this.watchChoice(raceData, loader);
      }
    }

    if (character.subrace) {
      const srName = character.subrace.sourceName || character.subrace.name;
      const srSource = (character.subrace.sourceId && character.subrace.sourceId.includes("|"))
        ? character.subrace.sourceId.split("|")[1]
        : (character.subrace.source || "PHB");
      const srData = loader.getSubrace(srName, srSource);
      if (srData) {
        fullReport.subraceReport = this.watchChoice(srData, loader);
      }
    }

    if (character.backgrounds) {
      character.backgrounds.forEach((bg) => {
        const bgName = bg.sourceName || bg.name;
        const bgSource = (bg.sourceId && bg.sourceId.includes("|"))
          ? bg.sourceId.split("|")[1]
          : (bg.source || "PHB");
        const bgData = loader.getBackground(bgName, bgSource);
        if (bgData) {
          fullReport.backgroundReports.push(this.watchChoice(bgData, loader));
        }
      });
    }

    if (character.classes) {
      character.classes.forEach((c) => {
        const cName = c.name || c.className;
        const cSource = c.source || "PHB";
        const cLevel = c.level || 1;
        const cData = loader.getClass(cName, cSource);
        if (cData) {
          fullReport.classReports.push(this.watchChoice(cData, loader, { level: cLevel }));
        }

        if (c.subclass) {
          const scData = loader.getSubclass(cName, c.subclass, c.subclassSource || cSource);
          if (scData) {
            fullReport.classReports.push(this.watchChoice(scData, loader, { level: cLevel }));
          }
        }
      });
    }

    if (character.feats) {
      character.feats.forEach((f) => {
        const fName = typeof f === "string" ? f : (f.name || f.sourceName);
        const fSource = typeof f === "object" ? (f.source || "PHB") : "PHB";
        const fData = loader.getFeat(fName, fSource);
        if (fData) {
          fullReport.featReports.push(this.watchChoice(fData, loader));
        }
      });
    }

    const allReports = [
      fullReport.raceReport,
      fullReport.subraceReport,
      ...fullReport.backgroundReports,
      ...fullReport.classReports,
      ...fullReport.featReports,
    ].filter(Boolean);

    allReports.forEach((rep) => {
      this.mergeReportsIntoCharacter(fullReport, rep);
    });

    return fullReport;
  }

  /**
   * Helper to determine entity type
   */
  static determineEntityType(entity) {
    if (entity.raceName || (entity._copy && entity._copy.raceName)) return "Subrace";
    if (entity.traitTags || (entity.entries && entity.ability && entity.speed)) return "Race";
    if (entity.hd || entity.classFeatures) return "Class";
    if (entity.subclassShortName || entity.subclassFeatures) return "Subclass";
    if (entity.skillProficiencies && entity.startingEquipment) return "Background";
    if (entity.prerequisite || entity.featureType?.includes("FEAT")) return "Feat";
    if (entity.school || entity.level !== undefined && entity.time) return "Spell";
    if (entity.rarity || entity.equipment) return "Item";
    return "Feature";
  }

  /**
   * Create an empty Cerberus report structure
   */
  static createEmptyReport(entityName = "Unknown", entityType = "Feature") {
    return {
      entityName,
      entityType,
      autoGrants: {
        abilityScores: [],
        proficiencies: [],
        spells: [],
        passiveModifiers: [],
        features: [],
      },
      selectableChoices: [],
      depth: 0,
    };
  }

  /**
   * Detect all automatic grants for an entity
   */
  static detectAutoGrants(entity, descText, report, loader) {
    const grants = report.autoGrants;
    const entityType = this.determineEntityType(entity);

    // If entity is a standalone Feature or classFeature/subclassFeature, add itself to autoGrants.features
    if (entityType === "Feature" && entity.name && !report.selectableChoices.some(c => c.name === entity.name)) {
      grants.features.push({
        name: entity.name,
        description: descText,
        source: entity.source || entity.className || "Unknown",
      });
    }

    // A. Ability Scores (fixed JSON array or object)
    if (entity.ability) {
      const abList = Array.isArray(entity.ability) ? entity.ability : [entity.ability];
      abList.forEach((abObj) => {
        if (typeof abObj === "object") {
          Object.entries(abObj).forEach(([stat, val]) => {
            if (stat !== "choose" && typeof val === "number") {
              grants.abilityScores.push({
                stat: stat.toLowerCase(),
                bonus: val,
                source: entity.name,
              });
            }
          });
        }
      });
    }

    // B. Proficiencies & Languages (fixed arrays)
    const profTypes = [
      { key: "skillProficiencies", type: "skill" },
      { key: "languageProficiencies", type: "language" },
      { key: "toolProficiencies", type: "tool" },
      { key: "weaponProficiencies", type: "weapon" },
      { key: "armorProficiencies", type: "armor" },
    ];

    profTypes.forEach(({ key, type }) => {
      if (entity[key] && Array.isArray(entity[key])) {
        entity[key].forEach((prof) => {
          Object.keys(prof).forEach((name) => {
            if (name !== "choose" && typeof prof[name] === "boolean" && prof[name] === true) {
              grants.proficiencies.push({
                type,
                name: name.toLowerCase(),
                source: entity.name,
              });
            }
          });
        });
      }
    });

    // C. Speed & Darkvision
    if (entity.speed) {
      const speedVal = typeof entity.speed === "object" ? entity.speed.walk : entity.speed;
      if (typeof speedVal === "number") {
        grants.passiveModifiers.push({
          type: "SPEED",
          value: speedVal,
          source: entity.name,
        });
      }
    }

    if (entity.darkvision || /darkvision\s+of\s+(\d+)\s+feet/i.test(descText) || /darkvision\s+out\s+to\s+a\s+range\s+of\s+(\d+)\s+feet/i.test(descText)) {
      const match = descText.match(/darkvision[^\d]*(\d+)\s+feet/i);
      const range = entity.darkvision || (match ? parseInt(match[1]) : 60);
      grants.passiveModifiers.push({
        type: "DARKVISION",
        value: range,
        source: entity.name,
      });
    }

    // Passive HP Increases or Feat Features (e.g. Tough feat)
    if (/hit\s+point\s+maximum\s+increases/i.test(descText) || /your\s+hit\s+point\s+maximum\s+increases/i.test(descText)) {
      grants.passiveModifiers.push({
        type: "HP_BONUS",
        value: "PER_LEVEL_BONUS",
        source: entity.name,
      });
    }

    // D. Auto Spells (e.g. Tiefling Thaumaturgy, racial cantrips, granted spells)
    const spellTags = CerberusTagParser.parseTags(descText).filter((t) => t.tag === "spell");
    spellTags.forEach((st) => {
      const isAutoGranted =
        /you\s+(?:know|learn|gain)\s+(?:the\s+)?{@spell/i.test(descText) ||
        /can\s+cast\s+{@spell/i.test(descText) ||
        /is\s+added\s+to\s+your\s+known\s+spells/i.test(descText);

      if (isAutoGranted && !/choose\s+one\s+spell/i.test(descText)) {
        grants.spells.push({
          name: st.name,
          source: st.source || "PHB",
          autoGranted: true,
        });
      }
    });

    // E. Hardcoded Sub-Traits / Features
    if (entity.entries && Array.isArray(entity.entries)) {
      entity.entries.forEach((e) => {
        if (typeof e === "object" && e.name && e.entries && !isFeatureSelectable(e.name, this.flattenEntries(e.entries))) {
          grants.features.push({
            name: e.name,
            description: this.flattenEntries(e.entries),
            source: entity.name,
          });
        }
      });
    }
  }

  /**
   * Parse 5etools additionalSpells structure (innate, known, prepared, expanded)
   */
  static parseAdditionalSpells(entity, descText, report, loader) {
    if (!entity.additionalSpells || !Array.isArray(entity.additionalSpells)) return;

    const grants = report.autoGrants;
    const choices = report.selectableChoices;

    const cleanSpellString = (str) => {
      if (typeof str !== "string") return null;
      let clean = str.replace(/#c$/i, "").trim();
      const parts = clean.split("|");
      const name = parts[0].trim();
      const source = parts[1] ? parts[1].trim().toUpperCase() : "PHB";
      return { name, source };
    };

    const resolveSpellObj = (spellInfo) => {
      if (!spellInfo) return null;
      const dbSpell = loader ? loader.getSpell(spellInfo.name, spellInfo.source) : null;
      return {
        name: dbSpell ? dbSpell.name : spellInfo.name,
        source: dbSpell ? dbSpell.source : spellInfo.source,
        level: dbSpell ? dbSpell.level : 0,
        school: dbSpell ? dbSpell.school : "",
        autoGranted: true,
      };
    };

    const extractSpellsAndChoices = (obj) => {
      if (!obj) return;
      if (typeof obj === "string") {
        const cleaned = cleanSpellString(obj);
        if (cleaned && !grants.spells.some((s) => s.name.toLowerCase() === cleaned.name.toLowerCase())) {
          const resolved = resolveSpellObj(cleaned);
          if (resolved) grants.spells.push(resolved);
        }
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item) => extractSpellsAndChoices(item));
        return;
      }
      if (typeof obj === "object") {
        if (obj.choose) {
          this.processSpellQueryChoice(entity, obj.choose, choices, loader);
        } else {
          Object.values(obj).forEach((val) => extractSpellsAndChoices(val));
        }
      }
    };

    entity.additionalSpells.forEach((addSp) => {
      if (typeof addSp !== "object") return;

      ["innate", "known", "prepared"].forEach((key) => {
        if (addSp[key]) {
          extractSpellsAndChoices(addSp[key]);
        }
      });

      if (addSp.expanded && typeof addSp.expanded === "object") {
        Object.entries(addSp.expanded).forEach(([lvlKey, spellList]) => {
          if (Array.isArray(spellList)) {
            spellList.forEach((spStr) => {
              const cleaned = cleanSpellString(spStr);
              if (cleaned && !grants.spells.some((s) => s.name.toLowerCase() === cleaned.name.toLowerCase())) {
                const resolved = resolveSpellObj(cleaned);
                if (resolved) {
                  resolved.expanded = true;
                  grants.spells.push(resolved);
                }
              }
            });
          }
        });
      }
    });
  }

  /**
   * Helper to parse 5etools choose query string e.g. "level=1|school=D|school=E" or "level=0|class=Sorcerer"
   */
  static processSpellQueryChoice(entity, chooseQuery, choices, loader) {
    if (!chooseQuery || typeof chooseQuery !== "string") return;

    const params = {};
    chooseQuery.split("|").forEach((part) => {
      const [k, v] = part.split("=");
      if (k && v) {
        if (!params[k]) params[k] = [];
        v.split(";").forEach((subVal) => {
          if (subVal.trim()) params[k].push(subVal.trim());
        });
      }
    });

    const targetLevels = params.level ? params.level.map((l) => parseInt(l)) : [0];
    const targetSchools = params.school ? params.school.map((s) => s.toUpperCase()) : null;
    const targetClasses = params.class ? params.class.map((c) => c.toLowerCase()) : null;

    let availableSpells = loader ? loader.getSpells() : [];

    availableSpells = availableSpells.filter((s) => {
      if (s.level === undefined || s.level === null) return false;
      if (targetLevels.length > 0 && !targetLevels.includes(s.level)) {
        return false;
      }
      if (targetSchools && targetSchools.length > 0) {
        const sSchool = (s.school || "").toUpperCase();
        if (!targetSchools.includes(sSchool)) return false;
      }
      if (targetClasses && targetClasses.length > 0 && s.classes?.fromClassList) {
        const classList = (s.classes.fromClassList || []).map((c) => (c.name || "").toLowerCase());
        if (!targetClasses.some((tc) => classList.includes(tc))) return false;
      }
      return true;
    });

    const levelLabel = targetLevels.includes(0) ? "Cantrip" : `Level ${targetLevels.join("/")} Spell`;
    const choiceId = `spell_choice_${entity.name}_${targetLevels.join("_")}`;

    if (!choices.some((c) => c.id === choiceId)) {
      choices.push({
        id: choiceId,
        type: "SPELL",
        name: `${entity.name} ${levelLabel} Selection`,
        description: `Choose 1 ${levelLabel.toLowerCase()} (${chooseQuery}).`,
        count: 1,
        options: availableSpells.map((s) => ({
          name: s.name,
          source: s.source,
          school: s.school,
          level: s.level,
          entity: s,
        })),
      });
    }
  }

  /**
   * Detect selectable choices for an entity
   */
  static detectSelectableChoices(entity, descText, report, loader) {
    const choices = report.selectableChoices;

    // A. Flexible Ability Score Choices (JSON .ability with choose or weighted or text)
    if (entity.ability) {
      const abList = Array.isArray(entity.ability) ? entity.ability : [entity.ability];
      abList.forEach((abObj) => {
        if (typeof abObj === "object" && abObj.choose) {
          if (abObj.choose.weighted) {
            const w = abObj.choose.weighted;
            const from = w.from || ["str", "dex", "con", "int", "wis", "cha"];
            const weights = w.weights || [1, 1];
            const is21Mode = weights.length === 2 && weights[0] === 2 && weights[1] === 1;

            const choiceId = `asi_weighted_${entity.name}_${weights.join("_")}`;
            if (!choices.some((c) => c.id === choiceId)) {
              choices.push({
                id: choiceId,
                type: "ABILITY_SCORE",
                name: is21Mode
                  ? `${entity.name} Ability Score (+2 / +1 Mode)`
                  : `${entity.name} Ability Score (+1 / +1 / +1 Mode)`,
                description: is21Mode
                  ? `Increase one score from [${from.join(", ").toUpperCase()}] by +2, and another by +1.`
                  : `Increase three scores from [${from.join(", ").toUpperCase()}] by +1 each.`,
                count: is21Mode ? 2 : 3,
                amount: is21Mode ? 2 : 1,
                options: from.map((st) => ({
                  name: st.toUpperCase(),
                  value: st,
                })),
              });
            }
          } else {
            const count = abObj.choose.count || 1;
            const amount = abObj.choose.amount || 1;
            const from = abObj.choose.from || ["str", "dex", "con", "int", "wis", "cha"];
            choices.push({
              id: `asi_${entity.name}`,
              type: "ABILITY_SCORE",
              name: `${entity.name} Ability Score Increase`,
              description: `Choose ${count} ability score(s) to increase by ${amount}.`,
              count,
              amount,
              options: from.map((st) => ({
                name: st.toUpperCase(),
                value: st,
              })),
            });
          }
        }
      });
    } else if (/\bincrease\s+(?:your\s+)?(?:one|two|\d+)?\s*(?:ability\s+scores?|different\s+ability\s+scores?|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma).*(?:by\s+1|\+1)/i.test(descText) || /gain\s+\+1\s+to\s+two/i.test(descText)) {
      choices.push({
        id: `asi_${entity.name}`,
        type: "ABILITY_SCORE",
        name: `${entity.name} Ability Score Choice`,
        description: descText,
        count: 1,
        options: ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((st) => ({ name: st, value: st.toLowerCase() })),
      });
    }

    // B. Proficiency Choices (JSON skillProficiencies/languageProficiencies with choose)
    const profTypes = [
      { key: "skillProficiencies", type: "PROFICIENCY_SKILL", label: "Skill" },
      { key: "languageProficiencies", type: "PROFICIENCY_LANGUAGE", label: "Language" },
      { key: "toolProficiencies", type: "PROFICIENCY_TOOL", label: "Tool" },
    ];

    profTypes.forEach(({ key, type, label }) => {
      if (entity[key] && Array.isArray(entity[key])) {
        entity[key].forEach((prof) => {
          if (prof.choose) {
            const ch = prof.choose;
            choices.push({
              id: `prof_${type}_${entity.name}`,
              type,
              name: `${entity.name} ${label} Choice`,
              description: `Choose ${ch.count || 1} ${label.toLowerCase()}(s).`,
              count: ch.count || 1,
              options: (ch.from || []).map((opt) => ({
                name: opt,
                value: opt,
              })),
            });
          }
        });
      }
    });

    // C. Feat Choices (JSON feats array or text)
    if (entity.feats || /gain\s+(?:one\s+)?feat\s+of\s+your\s+choice/i.test(descText) || /choose\s+one\s+feat/i.test(descText)) {
      choices.push({
        id: `feat_${entity.name}`,
        type: "FEAT",
        name: `${entity.name} Feat Selection`,
        description: "Choose 1 feat of your choice.",
        count: 1,
        options: (loader ? loader.getFeats() : []).map((f) => ({
          name: f.name,
          source: f.source,
          description: this.flattenEntries(f.entries || []),
          entity: f,
        })),
      });
    }

    // D. Cantrip Choices from text description (when not handled by additionalSpells)
    if ((/choose\s+(?:one|two|\d+)\s+cantrip/i.test(descText) || /learn\s+(?:one|two|\d+)\s+cantrip/i.test(descText)) && !entity.additionalSpells) {
      const match = descText.match(/(?:choose|learn)\s+(one|two|\d+)\s+cantrip/i);
      const count = match ? (match[1] === "one" ? 1 : match[1] === "two" ? 2 : parseInt(match[1])) : 1;
      choices.push({
        id: `spell_cantrip_${entity.name}`,
        type: "SPELL",
        name: `${entity.name} Cantrip Selection`,
        description: `Choose ${count} cantrip(s).`,
        count,
        options: (loader ? loader.getSpells().filter((s) => s.level === 0) : []).map((s) => ({
          name: s.name,
          source: s.source,
          school: s.school,
          entity: s,
        })),
      });
    }

    // E. Sub-feature / Option List Choices (Fighting Styles, Giant Ancestry, Maneuvers, Invocations)
    const isSelfSelectable = isFeatureSelectable(entity.name, descText);

    if (entity.entries && Array.isArray(entity.entries)) {
      entity.entries.forEach((e) => {
        let featureName = (typeof e === "object" && e.name) ? e.name : entity.name;
        const entryDesc = this.flattenEntries(typeof e === "object" ? (e.entries || e.entry || []) : [e]);
        
        const isEntrySelectable = isFeatureSelectable(featureName, entryDesc) || (typeof e === "object" && e.type === "options") || /choose\s+one\s+of\s+the\s+following/i.test(entryDesc) || /maneuvers/i.test(featureName);

        if (isEntrySelectable || (isSelfSelectable && featureName === entity.name)) {
          const rawOptions = extractAvailableOptions(entryDesc, featureName) || [];
          const filterTags = CerberusTagParser.parseTags(entryDesc).filter((t) => t.tag === "filter");

          let candidateOptions = [];

          // Handle 5etools type: "options" and refOptionalfeature items
          if (typeof e === "object" && e.entries && Array.isArray(e.entries)) {
            e.entries.forEach((optEntry) => {
              if (optEntry.type === "refOptionalfeature" && optEntry.optionalfeature) {
                const optName = optEntry.optionalfeature.split("|")[0];
                const resolvedOpt = loader ? loader.getOptionalFeatures().find(o => o.name.toLowerCase() === optName.toLowerCase()) : null;
                candidateOptions.push({
                  name: resolvedOpt ? resolvedOpt.name : optName,
                  description: resolvedOpt ? this.flattenEntries(resolvedOpt.entries || []) : optName,
                  entity: resolvedOpt,
                });
              }
            });
          }

          // Extract nested list items or entries inside e.entries
          if (candidateOptions.length === 0) {
            const nestedItems = this.extractOptionItemsFromEntries(e.entries || [e]);
            nestedItems.forEach((ni) => {
              candidateOptions.push({
                name: ni.name,
                description: ni.description,
                entity: ni,
              });
            });
          }

          // Extract filter tags e.g. {@filter ... feature type=EI}
          filterTags.forEach((ft) => {
            if (loader && (ft.rawContent.includes("feature type=") || ft.rawContent.includes("optionalfeature"))) {
              const optType = ft.rawContent.match(/feature\s+type=([^|}]+)/i)?.[1];
              if (optType) {
                const opts = loader.getOptionalFeatures(optType);
                opts.forEach((o) => {
                  candidateOptions.push({
                    name: o.name,
                    source: o.source,
                    description: this.flattenEntries(o.entries || []),
                    entity: o,
                  });
                });
              }
            }
          });

          // Fallback to raw extracted bullet/item options
          if (candidateOptions.length === 0 && rawOptions.length > 0) {
            rawOptions.forEach((ro) => {
              candidateOptions.push({
                name: ro.name || ro.filterType || "Option",
                description: ro.raw || "",
              });
            });
          }

          if (candidateOptions.length > 0) {
            choices.push({
              id: `feature_choice_${featureName}`,
              type: "FEATURE",
              name: featureName,
              description: entryDesc,
              count: 1,
              options: candidateOptions,
            });
          }
        }
      });
    }
  }

  /**
   * Helper to recursively extract list items and named sub-entries from entries structure
   */
  static extractOptionItemsFromEntries(entries) {
    if (!entries) return [];
    const results = [];

    const traverse = (items) => {
      if (!items) return;
      if (Array.isArray(items)) {
        items.forEach((item) => traverse(item));
        return;
      }
      if (typeof items === "object") {
        if (items.name && (items.entries || items.entry)) {
          results.push({
            name: items.name,
            description: this.flattenEntries(items.entries || items.entry),
          });
        }
        if (items.items && Array.isArray(items.items)) {
          items.items.forEach((it) => traverse(it));
        }
        if (items.entries && Array.isArray(items.entries)) {
          items.entries.forEach((it) => {
            if (typeof it === "object" && it !== items) traverse(it);
          });
        }
      }
    };

    traverse(entries);
    return results;
  }

  /**
   * Perform RECURSIVE evaluation on choices and candidate options
   */
  static evaluateRecursively(entity, report, loader, options) {
    report.selectableChoices.forEach((choice) => {
      if (choice.type === "FEATURE" || choice.type === "FEAT") {
        choice.recursivelyEvaluatedOptions = [];

        choice.options.forEach((opt) => {
          let targetEntity = opt.entity;

          if (!targetEntity && loader && opt.name) {
            if (choice.type === "FEAT") {
              targetEntity = loader.getFeat(opt.name, opt.source);
            } else {
              targetEntity = loader.getOptionalFeatures().find(
                (of) => of.name.toLowerCase() === opt.name.toLowerCase()
              );
            }
          }

          if (targetEntity) {
            const childReport = this.watchChoice(targetEntity, loader, options);
            choice.recursivelyEvaluatedOptions.push({
              optionName: opt.name,
              childReport,
            });
          }
        });
      }
    });
  }

  /**
   * Merge child feature report into parent report
   */
  static mergeReportChildResults(parentReport, childReport) {
    if (!childReport) return;
    parentReport.autoGrants.abilityScores.push(...childReport.autoGrants.abilityScores);
    parentReport.autoGrants.proficiencies.push(...childReport.autoGrants.proficiencies);
    parentReport.autoGrants.spells.push(...childReport.autoGrants.spells);
    parentReport.autoGrants.passiveModifiers.push(...childReport.autoGrants.passiveModifiers);
    parentReport.autoGrants.features.push(...childReport.autoGrants.features);
    parentReport.selectableChoices.push(...childReport.selectableChoices);
  }

  /**
   * Helper to merge single entity reports into character summary
   */
  static mergeReportsIntoCharacter(characterReport, report) {
    if (!report) return;
    const agg = characterReport.aggregatedAutoGrants;
    agg.abilityScores.push(...report.autoGrants.abilityScores);
    agg.proficiencies.push(...report.autoGrants.proficiencies);
    agg.spells.push(...report.autoGrants.spells);
    agg.passiveModifiers.push(...report.autoGrants.passiveModifiers);
    agg.features.push(...report.autoGrants.features);

    characterReport.aggregatedSelectableChoices.push(...report.selectableChoices);
  }

  /**
   * Helper to flatten 5etools structured entries into plain string
   */
  static flattenEntries(entries) {
    if (!entries) return "";
    if (typeof entries === "string") return entries;

    if (Array.isArray(entries)) {
      return entries.map((e) => this.flattenEntries(e)).join(" ");
    }

    if (typeof entries === "object") {
      const parts = [];
      if (entries.name) parts.push(`${entries.name}.`);
      if (entries.entries) parts.push(this.flattenEntries(entries.entries));
      if (entries.items) parts.push(this.flattenEntries(entries.items));
      if (entries.entry) parts.push(this.flattenEntries(entries.entry));
      return parts.join(" ");
    }

    return String(entries);
  }
}

export default Cerberus;
