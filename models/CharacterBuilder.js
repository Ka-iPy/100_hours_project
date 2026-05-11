import {
  Character,
  ClassLevel,
  TracedFeature,
  AbilityScoreSet,
  ProficiencySet,
  Equipment,
  SpellSlots,
  Spellbook,
} from './Character.js';
import {
  SourceReference,
  TracedModifier,
  TracedValue,
  SOURCE_CATEGORIES,
  STACKING_MODES,
} from './TracedModifier.js';
import {
  isFeatureSelectable,
  extractAvailableOptions,
} from '../utils/featureSelectability.js';
import {
  categorizeFeature,
  FEATURE_CATEGORIES,
} from '../utils/featureCategory.js';

export class CharacterBuilder {
  constructor(loader) {
    this.loader = loader;
  }

  build(options) {
    const {
      name = 'Unnamed Character',
      player = '',
      race,
      raceSource = 'PHB',
      subrace = null,
      subraceSource = null,
      backgrounds = [],
      classes = [],
      feats = [],
      charCreationOptions = [],
      abilityScores = {},
      alignment = 'true neutral',
      startingEquipment = [],
      selectedCantrips = [],
      selectedSpells = [],
      equipmentChoices = [],
    } = options;

    const character = new Character();
    character.name = name;
    character.player = player;
    character.alignment = alignment;

    const raceData = this.loader.getRace(race, raceSource);
    const subraceData = subrace ? this.loader.getSubrace(subrace, subraceSource || raceSource) : null;

    this.applyRace(character, raceData, raceSource, subraceData, subraceSource);
    this.applyBackgrounds(character, backgrounds);
    this.applyClasses(character, classes);
    this.applyFeats(character, feats);
    this.applyCharCreationOptions(character, charCreationOptions);
    this.applyAbilityScores(character, abilityScores);
    this.applyStartingEquipment(character, startingEquipment, raceData, classes);
    this.applyEquipmentChoices(character, equipmentChoices, classes);
    this.applySpellSelections(character, classes, selectedCantrips, selectedSpells);
    this.calculateDerivedStats(character);

    return character;
  }

  applyRace(character, raceData, raceSource, subraceData, subraceSource) {
    if (!raceData) return;

    character.race = SourceReference.race(raceData.name, raceSource, raceData.entries?.[0] || null);

    if (raceData.speed) {
      const speed = typeof raceData.speed === 'object' ? raceData.speed.walk : raceData.speed;
      character.speed.baseValue = speed;
    }

    if (raceData.ability) {
      raceData.ability.forEach(ability => {
        Object.entries(ability).forEach(([score, bonus]) => {
          if (score !== 'choose') {
            character.abilityScores.addModifier(score, new TracedModifier({ value: bonus }).addSource(character.race));
          }
        });
      });
    }

    if (raceData.traitTags) {
      character.features.push(...this.extractTraits(raceData, character.race));
    }

    if (raceData.entries) {
      this.extractFeaturesFromEntries(character, raceData.entries, character.race);
    }

    if (subraceData) {
      this.applySubrace(character, subraceData, subraceSource || raceSource, raceData);
    }
  }

  applySubrace(character, subraceData, subraceSource, parentRace) {
    character.subrace = SourceReference.subrace(subraceData.name, subraceSource, parentRace.name);

    if (subraceData.ability) {
      subraceData.ability.forEach(ability => {
        Object.entries(ability).forEach(([score, bonus]) => {
          if (score !== 'choose') {
            character.abilityScores.addModifier(score, new TracedModifier({ value: bonus }).addSource(character.subrace));
          }
        });
      });
    }

    if (subraceData.entries) {
      this.extractFeaturesFromEntries(character, subraceData.entries, character.subrace);
    }
  }

  applyBackgrounds(character, backgrounds) {
    backgrounds.forEach(({ name, source = 'PHB', skillChoices = [], languageChoices = [], toolChoices = [] }) => {
      const bgData = this.loader.getBackground(name, source);
      if (!bgData) return;

      const bgRef = SourceReference.background(name, source);
      character.backgrounds.push(bgRef);

      if (bgData.skillProficiencies) {
        this.applySkillProficiencies(character, bgData.skillProficiencies, bgRef);
      }

      if (bgData.languageProficiencies) {
        this.applyLanguageProficiencies(character, bgData.languageProficiencies, bgRef);
      }

      if (bgData.toolProficiencies) {
        this.applyToolProficiencies(character, bgData.toolProficiencies, bgRef);
      }

      if (bgData.entries) {
        this.extractFeaturesFromEntries(character, bgData.entries, bgRef);
      }
    });
  }

  applyClasses(character, classSelections) {
    classSelections.forEach(({ name, source = 'PHB', level = 1, subclass = null, subclassSource = null, asiSelections = {} }) => {
      const classData = this.loader.getClass(name, source);
      if (!classData) return;

      const classLevel = new ClassLevel({
        className: name,
        classSource: source,
        level,
        subclassName: subclass,
        subclassSource: subclassSource,
      });

      this.applyClassFeatures(character, classLevel, classData);

      if (subclass) {
        this.applySubclassFeatures(character, classLevel, classData, subclass, subclassSource || source);
      }

      this.applyAsiSelections(character, classLevel, classData, level, asiSelections);

      character.addClass(classLevel);
    });
  }

  applyClassFeatures(character, classLevel, classData) {
    const { className, classSource, level } = classLevel;

    const features = this.loader.getClassFeaturesUpToLevel(className, classSource, level);
    features.forEach(featureData => {
      const featureRef = SourceReference.classFeature(className, classSource, featureData.name, featureData.level);
      const description = this.formatEntries(featureData.entries);
      const selectable = isFeatureSelectable(featureData.name, description);
      const availableOptions = selectable ? extractAvailableOptions(description) : null;
      const category = categorizeFeature(featureData.name, description, featureRef, featureData);

      const feature = new TracedFeature({
        name: featureData.name,
        description,
        source: featureRef,
        selectable,
        availableOptions,
        category,
      });

      this.processFeatureEffects(character, feature, featureData);

      if (selectable) {
        character.addPendingSelection({
          id: `${className}|${classSource}|${featureData.name}|${featureData.level}`,
          featureName: featureData.name,
          source: featureRef,
          description,
          availableOptions,
          effects: [],
        });
      }

      classLevel.addFeature(feature);
      character.features.push(feature);
    });

    const hp = this.calculateHitPointsFromClass(character, classData, level);
    character.maxHitPoints += hp;
    character.currentHitPoints = character.maxHitPoints;

    if (classData.proficiency) {
      classData.proficiency.forEach(prof => {
        character.proficiencies.addSavingThrowProficiency(prof, classLevel.source);
      });
    }
  }

  applySubclassFeatures(character, classLevel, classData, subclassName, subclassSource) {
    const { className, classSource, level } = classLevel;

    const features = this.loader.getSubclassFeaturesUpToLevel(className, classSource, subclassName, subclassSource, level);
    features.forEach(featureData => {
      const featureRef = SourceReference.subclassFeature(className, subclassName, subclassSource, featureData.name, featureData.level);
      const description = this.formatEntries(featureData.entries);
      const selectable = isFeatureSelectable(featureData.name, description);
      const availableOptions = selectable ? extractAvailableOptions(description) : null;
      const category = categorizeFeature(featureData.name, description, featureRef, featureData);

      const feature = new TracedFeature({
        name: featureData.name,
        description,
        source: featureRef,
        selectable,
        availableOptions,
        category,
      });

      this.processFeatureEffects(character, feature, featureData);

      if (selectable) {
        character.addPendingSelection({
          id: `${className}|${subclassName}|${subclassSource}|${featureData.name}|${featureData.level}`,
          featureName: featureData.name,
          source: featureRef,
          description,
          availableOptions,
          effects: [],
        });
      }

      classLevel.addFeature(feature);
    });
  }

  applyAsiSelections(character, classLevel, classData, totalLevel, selections) {
    if (!selections || !Array.isArray(selections)) return;

    const asiLevels = classData.asiLevels || this.getDefaultAsiLevels(classData);

    selections.forEach((selection) => {
      const { level, increases, feats: selectedFeats } = selection;
      if (level > totalLevel) return;

      const asisRef = SourceReference.asi(classData.name, level);

      if (increases && Array.isArray(increases)) {
        increases.forEach(({ ability, amount = 2 }) => {
          character.abilityScores.addModifier(
            ability,
            new TracedModifier({ value: amount }).addSource(asisRef)
          );
        });
      }

      if (selectedFeats && Array.isArray(selectedFeats)) {
        selectedFeats.forEach(featName => {
          this.applyFeatToCharacter(character, featName, asisRef);
        });
      }
    });
  }

  getDefaultAsiLevels(classData) {
    return [4, 8, 12, 16, 19];
  }

  applyFeats(character, feats) {
    feats.forEach(({ name, source = 'PHB' }) => {
      const featRef = SourceReference.feat(name, source);
      this.applyFeatToCharacter(character, name, featRef);
    });
  }

  applyFeatToCharacter(character, featName, sourceRef) {
    const featData = this.loader.getFeat(featName);
    if (!featData) return;

    const feature = new TracedFeature({
      name: featData.name,
      description: this.formatEntries(featData.entries),
      source: sourceRef,
    });

    if (featData.ability) {
      featData.ability.forEach(ability => {
        Object.entries(ability).forEach(([score, bonus]) => {
          if (score !== 'choose') {
            character.abilityScores.addModifier(
              score,
              new TracedModifier({ value: bonus }).addSource(sourceRef)
            );
          }
        });
      });
    }

    this.processFeatureEffects(character, feature, featData);

    character.feats.push(feature);
    character.features.push(feature);
  }

  applyCharCreationOptions(character, options) {
    options.forEach(({ name, source }) => {
      const data = this.loader.getCharCreationOption(name, source);
      if (!data) return;

      const optionRef = SourceReference.charCreationOption(name, source);
      character.charCreationOptions.push(optionRef);

      if (data.entries) {
        this.extractFeaturesFromEntries(character, data.entries, optionRef);
      }
    });
  }

  applyAbilityScores(character, scores) {
    Object.entries(scores).forEach(([ability, value]) => {
      if (typeof value === 'number') {
        character.abilityScores.setBase(ability, value);
      }
    });
  }

  applyStartingEquipment(character, equipment, raceData, classes) {
    const mainClass = classes[0];
    const classData = mainClass ? this.loader.getClass(mainClass.name, mainClass.source) : null;

    if (classData?.startingEquipment) {
      this.applyClassStartingEquipment(character, classData.startingEquipment);
    }

    character.backgrounds.forEach(bg => {
      const bgData = this.loader.getBackground(bg.sourceName, bg.sourceId.split('|')[1]);
      if (bgData?.startingEquipment) {
        this.applyBackgroundStartingEquipment(character, bgData.startingEquipment);
      }
    });

    equipment.forEach(({ item, quantity = 1 }) => {
      const itemData = this.loader.getItem(item);
      if (itemData) {
        character.equipment.push(new Equipment({
          item: itemData,
          quantity,
          source: new SourceReference({ category: SOURCE_CATEGORIES.SPECIAL, sourceName: 'Starting Equipment', sourceId: 'startingEquipment' }),
          equipped: true,
        }));
      }
    });
  }

  applyClassStartingEquipment(character, startingEquipment) {
    const defaultChoice = startingEquipment.default?.[0] || startingEquipment.defaultData?.[0];
    if (defaultChoice) {
      this.parseEquipmentChoice(character, defaultChoice);
    }
  }

  applyBackgroundStartingEquipment(character, startingEquipment) {
    const defaultChoice = startingEquipment._?.[0] || startingEquipment.default?.[0];
    if (defaultChoice && typeof defaultChoice === 'object' && defaultChoice.item) {
      const itemData = this.loader.getItemByName(defaultChoice.item.split('|')[0]);
      if (itemData) {
        character.equipment.push(new Equipment({
          item: itemData,
          quantity: defaultChoice.quantity || 1,
          source: new SourceReference({ category: SOURCE_CATEGORIES.SPECIAL, sourceName: 'Background Equipment', sourceId: 'bgEquipment' }),
          equipped: true,
        }));
      }
    }
  }

  parseEquipmentChoice(character, choice) {
    if (typeof choice === 'string') {
      const itemName = choice.split('|')[0].replace(/[()]/g, '').trim();
      const itemData = this.loader.getItemByName(itemName);
      if (itemData) {
        character.equipment.push(new Equipment({
          item: itemData,
          quantity: 1,
          source: new SourceReference({ category: SOURCE_CATEGORIES.SPECIAL, sourceName: 'Class Equipment', sourceId: 'classEquipment' }),
          equipped: true,
        }));
      }
    } else if (Array.isArray(choice)) {
      choice.forEach(c => this.parseEquipmentChoice(character, c));
    } else if (choice?.item) {
      const itemData = this.loader.getItemByName(choice.item.split('|')[0]);
      if (itemData) {
        character.equipment.push(new Equipment({
          item: itemData,
          quantity: choice.quantity || 1,
          source: new SourceReference({ category: SOURCE_CATEGORIES.SPECIAL, sourceName: 'Class Equipment', sourceId: 'classEquipment' }),
          equipped: true,
        }));
      }
    }
  }

  calculateDerivedStats(character) {
    const totalLevel = character.getTotalLevel();
    character.proficiencyBonus.baseValue = Math.floor((totalLevel - 1) / 4) + 2;

    character.initiative.baseValue = character.abilityScores.getModifier('dexterity');

    // HP is already calculated in applyClassFeatures — don't double-count from hitDice

    if (character.currentHitPoints === 0) {
      character.currentHitPoints = character.maxHitPoints;
    }

    character.passivePerception = 10 + character.abilityScores.getModifier('wisdom');
    if (character.proficiencies.skills['perception']?.proficient) {
      character.passivePerception += character.proficiencyBonus.calculate();
    }

    // Calculate spell save DC and spell attack bonus for each spellbook
    const profBonus = character.proficiencyBonus.calculate();
    Object.values(character.spellbooks).forEach((sb) => {
      if (sb.spellcastingAbility) {
        const abilityMod = character.abilityScores.getModifier(sb.spellcastingAbility);
        sb.spellSaveDC = 8 + profBonus + abilityMod;
        sb.spellAttackBonus = profBonus + abilityMod;
      }
    });
  }

  /**
   * Apply selected cantrips and spells to the character's spellbook.
   */
  applySpellSelections(character, classes, selectedCantrips, selectedSpells) {
    if ((!selectedCantrips || selectedCantrips.length === 0) &&
      (!selectedSpells || selectedSpells.length === 0)) return;

    const mainClass = classes[0];
    if (!mainClass) return;

    const classData = this.loader.getClass(mainClass.name, mainClass.source);
    if (!classData) return;

    const subclassData = mainClass.subclass
      ? this.loader.getSubclass(mainClass.name, mainClass.subclass, mainClass.subclassSource || mainClass.source)
      : null;

    const casterProg = subclassData?.casterProgression || classData.casterProgression;
    if (!casterProg) return;

    const spellAbility = subclassData?.spellcastingAbility || classData.spellcastingAbility;
    const className = mainClass.name;

    // Create or get spellbook for this class
    if (!character.spellbooks[className]) {
      character.spellbooks[className] = new Spellbook();
    }
    const spellbook = character.spellbooks[className];
    spellbook.spellcastingAbility = spellAbility;

    // Set spell slots
    const slots = this._getSpellSlots(casterProg, mainClass.level || 1);
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > 0) {
        const source = SourceReference.classFeature(className, mainClass.source, 'Spellcasting', 1);
        spellbook.slots.setMax(i + 1, slots[i], source);
      }
    }

    // Add cantrips
    if (selectedCantrips && selectedCantrips.length > 0) {
      for (const cantrip of selectedCantrips) {
        const spellData = this.loader.getSpell(cantrip.name, cantrip.source);
        if (spellData) {
          spellbook.cantripsKnown.push({
            name: spellData.name,
            source: spellData.source,
            level: 0,
            school: spellData.school,
          });
        }
      }
    }

    // Add spells
    if (selectedSpells && selectedSpells.length > 0) {
      const spellSource = SourceReference.classFeature(className, mainClass.source, 'Spellcasting', 1);
      for (const spell of selectedSpells) {
        const spellData = this.loader.getSpell(spell.name, spell.source);
        if (spellData) {
          const spellInfo = {
            name: spellData.name,
            source: spellData.source,
            level: spellData.level,
            school: spellData.school,
          };
          spellbook.addKnown(spellInfo, spellSource);
          // For prepared casters, initially prepare all known spells
          if (classData.preparedSpells) {
            spellbook.prepare(spellInfo);
          }
        }
      }
    }
  }

  /**
   * Apply equipment choices from the character creation form.
   * equipmentChoices is an array of { groupIndex, choiceKey } objects
   * where choiceKey is 'a', 'b', etc. from the defaultData.
   */
  applyEquipmentChoices(character, equipmentChoices, classes) {
    if (!equipmentChoices || equipmentChoices.length === 0) return;

    const mainClass = classes[0];
    if (!mainClass) return;

    const classData = this.loader.getClass(mainClass.name, mainClass.source);
    if (!classData?.startingEquipment?.defaultData) return;

    const defaultData = classData.startingEquipment.defaultData;
    const source = new SourceReference({
      category: SOURCE_CATEGORIES.SPECIAL,
      sourceName: 'Starting Equipment',
      sourceId: 'startingEquipment',
    });

    for (const choice of equipmentChoices) {
      const group = defaultData[choice.groupIndex];
      if (!group) continue;

      const items = group[choice.choiceKey];
      if (!items) continue;

      for (const item of items) {
        if (typeof item === 'string') {
          const [itemName] = item.split('|');
          const itemData = this.loader.getItemByName(itemName);
          if (itemData) {
            character.equipment.push(new Equipment({
              item: itemData,
              quantity: 1,
              source,
              equipped: true,
            }));
          }
        } else if (item.item) {
          const [itemName] = item.item.split('|');
          const itemData = this.loader.getItemByName(itemName);
          if (itemData) {
            character.equipment.push(new Equipment({
              item: itemData,
              quantity: item.quantity || 1,
              source,
              equipped: true,
            }));
          }
        }
      }
    }
  }

  /**
   * Get spell slots for a caster progression (inline, no async).
   */
  _getSpellSlots(casterProgression, level) {
    const FULL = [[2, 0, 0, 0, 0, 0, 0, 0, 0], [3, 0, 0, 0, 0, 0, 0, 0, 0], [4, 2, 0, 0, 0, 0, 0, 0, 0], [4, 3, 0, 0, 0, 0, 0, 0, 0], [4, 3, 2, 0, 0, 0, 0, 0, 0], [4, 3, 3, 0, 0, 0, 0, 0, 0], [4, 3, 3, 1, 0, 0, 0, 0, 0], [4, 3, 3, 2, 0, 0, 0, 0, 0], [4, 3, 3, 3, 1, 0, 0, 0, 0], [4, 3, 3, 3, 2, 0, 0, 0, 0], [4, 3, 3, 3, 2, 1, 0, 0, 0], [4, 3, 3, 3, 2, 1, 0, 0, 0], [4, 3, 3, 3, 2, 1, 1, 0, 0], [4, 3, 3, 3, 2, 1, 1, 0, 0], [4, 3, 3, 3, 2, 1, 1, 1, 0], [4, 3, 3, 3, 2, 1, 1, 1, 0], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
    const HALF = [[0, 0, 0, 0, 0], [2, 0, 0, 0, 0], [3, 0, 0, 0, 0], [3, 0, 0, 0, 0], [4, 2, 0, 0, 0], [4, 2, 0, 0, 0], [4, 3, 0, 0, 0], [4, 3, 0, 0, 0], [4, 3, 2, 0, 0], [4, 3, 2, 0, 0], [4, 3, 3, 0, 0], [4, 3, 3, 0, 0], [4, 3, 3, 1, 0], [4, 3, 3, 1, 0], [4, 3, 3, 2, 0], [4, 3, 3, 2, 0], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];
    const THIRD = [[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 0], [3, 0, 0, 0], [3, 0, 0, 0], [4, 2, 0, 0], [4, 2, 0, 0], [4, 2, 0, 0], [4, 3, 0, 0], [4, 3, 0, 0], [4, 3, 0, 0], [4, 3, 2, 0], [4, 3, 2, 0], [4, 3, 2, 0], [4, 3, 3, 0], [4, 3, 3, 0], [4, 3, 3, 0], [4, 3, 3, 1], [4, 3, 3, 1]];
    const ART = [[2, 0, 0, 0, 0], [2, 0, 0, 0, 0], [3, 0, 0, 0, 0], [3, 0, 0, 0, 0], [4, 2, 0, 0, 0], [4, 2, 0, 0, 0], [4, 3, 0, 0, 0], [4, 3, 0, 0, 0], [4, 3, 2, 0, 0], [4, 3, 2, 0, 0], [4, 3, 3, 0, 0], [4, 3, 3, 0, 0], [4, 3, 3, 1, 0], [4, 3, 3, 1, 0], [4, 3, 3, 2, 0], [4, 3, 3, 2, 0], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];
    const idx = Math.min(Math.max(level, 1), 20) - 1;
    switch (casterProgression) {
      case 'full': return FULL[idx] || [];
      case '1/2': return HALF[idx] || [];
      case '1/3': return THIRD[idx] || [];
      case 'artificer': return ART[idx] || [];
      default: return [];
    }
  }

  applySkillProficiencies(character, proficiencies, source) {
    proficiencies.forEach(prof => {
      if (typeof prof === 'object' && !Array.isArray(prof)) {
        Object.entries(prof).forEach(([skill, value]) => {
          if (value === true) {
            character.proficiencies.addSkillProficiency(skill, 'proficient', source);
          }
        });
      } else if (typeof prof === 'string') {
        character.proficiencies.addSkillProficiency(prof, 'proficient', source);
      }
    });
  }

  applyLanguageProficiencies(character, proficiencies, source) {
    proficiencies.forEach(prof => {
      if (typeof prof === 'object') {
        Object.entries(prof).forEach(([lang, value]) => {
          if (value === true) {
            character.proficiencies.addLanguage(lang, source);
          } else if (lang === 'anyStandard' && typeof value === 'number') {
            for (let i = 0; i < value; i++) {
              character.proficiencies.addLanguage(`any${i}`, source);
            }
          }
        });
      }
    });
  }

  applyToolProficiencies(character, proficiencies, source) {
    proficiencies.forEach(prof => {
      if (typeof prof === 'object') {
        Object.entries(prof).forEach(([tool, value]) => {
          if (value === true) {
            character.proficiencies.addToolProficiency(tool, source);
          }
        });
      }
    });
  }

  extractTraits(raceData, source) {
    const traits = [];
    if (raceData.traitTags?.includes('Darkvision')) {
      traits.push(new TracedFeature({
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
        source,
      }));
    }
    if (raceData.traitTags?.includes('Keen Senses')) {
      traits.push(new TracedFeature({
        name: 'Keen Senses',
        description: 'You have proficiency in the Perception skill.',
        source,
      }));
    }
    return traits;
  }

  extractFeaturesFromEntries(character, entries, source) {
    if (!entries) return;

    entries.forEach(entry => {
      if (entry.type === 'entries' && entry.name && entry.entries) {
        const description = this.formatEntries(entry.entries);
        const selectable = isFeatureSelectable(entry.name, description);
        const availableOptions = selectable ? extractAvailableOptions(description) : null;
        const category = categorizeFeature(entry.name, description, source, entry);

        const feature = new TracedFeature({
          name: entry.name,
          description,
          source,
          selectable,
          availableOptions,
          category,
        });

        if (selectable) {
          character.addPendingSelection({
            id: `${source.sourceId}|${entry.name}`,
            featureName: entry.name,
            source,
            description,
            availableOptions,
            effects: [],
          });
        }

        character.features.push(feature);
      }
    });
  }

  processFeatureEffects(character, feature, featureData) {
    if (featureData.entries) {
      const desc = this.formatEntries(featureData.entries);

      if (desc.toLowerCase().includes('darkvision')) {
        const match = desc.match(/(\d+)\s*feet?/);
        if (match) {
          feature.addEffect({
            type: 'sense',
            target: 'darkvision',
            value: parseInt(match[1]),
          });
        }
      }
    }
  }

  calculateHitPointsFromClass(character, classData, level) {
    const hitDie = classData.hd?.faces || 8;
    const conMod = character.abilityScores.getModifier('constitution');
    const averageRoll = Math.floor(hitDie / 2) + 1;

    // Level 1: max hit die + CON mod. Subsequent levels: average + CON mod.
    let total = hitDie + conMod;
    for (let i = 1; i < level; i++) {
      total += Math.max(1, averageRoll + conMod);
    }
    return Math.max(total, level);
  }

  formatEntries(entries) {
    if (!entries) return '';
    if (typeof entries === 'string') return entries;
    if (Array.isArray(entries)) {
      return entries.map(e => this.formatEntry(e)).join('\n');
    }
    return String(entries);
  }

  formatEntry(entry) {
    if (typeof entry === 'string') return entry;
    if (entry.type === 'list') {
      return entry.items?.map(item => {
        if (typeof item === 'string') return `- ${item}`;
        if (item.entry) return `- ${item.entry}`;
        return '';
      }).join('\n') || '';
    }
    if (entry.entries) {
      return this.formatEntries(entry.entries);
    }
    if (entry.name && entry.entry) {
      return `**${entry.name}**: ${entry.entry}`;
    }
    return String(entry);
  }
}

export default CharacterBuilder;
