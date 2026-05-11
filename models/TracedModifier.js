export const SOURCE_CATEGORIES = {
  RACE: 'race',
  SUBRACE: 'subrace',
  BACKGROUND: 'background',
  CLASS: 'class',
  SUBCLASS: 'subclass',
  FEAT: 'feat',
  MAGIC_ITEM: 'magicItem',
  ASI: 'asi',
  CHAR_CREATION_OPTION: 'charCreationOption',
  VARIANT_RULE: 'variantRule',
  SPECIAL: 'special',
};

export const STACKING_MODES = {
  REPLACE: 'replace',
  STACK: 'stack',
  MAX: 'max',
  MIN: 'min',
};

export class SourceReference {
  constructor({ category, sourceName, sourceId, level, description }) {
    this.category = category;
    this.sourceName = sourceName;
    this.sourceId = sourceId;
    this.level = level ?? null;
    this.description = description ?? null;
  }

  static race(name, source, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.RACE,
      sourceName: name,
      sourceId: `${name}|${source}`,
      description,
    });
  }

  static subrace(name, source, parentRace, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.SUBRACE,
      sourceName: name,
      sourceId: `${name}|${source}`,
      description: description ?? `Subrace of ${parentRace}`,
    });
  }

  static background(name, source, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.BACKGROUND,
      sourceName: name,
      sourceId: `${name}|${source}`,
      description,
    });
  }

  static classFeature(className, source, featureName, level, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.CLASS,
      sourceName: `${featureName} (${className})`,
      sourceId: `${featureName}|${className}|${source}`,
      level,
      description,
    });
  }

  static subclassFeature(className, subclassName, source, featureName, level, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.SUBCLASS,
      sourceName: `${featureName} (${subclassName} ${className})`,
      sourceId: `${featureName}|${className}|${subclassName}|${source}`,
      level,
      description,
    });
  }

  static feat(name, source, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.FEAT,
      sourceName: name,
      sourceId: `${name}|${source}`,
      description,
    });
  }

  static asi(className = null, level, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.ASI,
      sourceName: 'Ability Score Improvement',
      sourceId: `asi|${className ?? 'general'}|${level}`,
      level,
      description,
    });
  }

  static item(name, source, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.MAGIC_ITEM,
      sourceName: name,
      sourceId: `${name}|${source}`,
      description,
    });
  }

  static charCreationOption(name, source, description = null) {
    return new SourceReference({
      category: SOURCE_CATEGORIES.CHAR_CREATION_OPTION,
      sourceName: name,
      sourceId: `${name}|${source}`,
      description,
    });
  }

  toJSON() {
    return {
      category: this.category,
      sourceName: this.sourceName,
      sourceId: this.sourceId,
      level: this.level,
      description: this.description,
    };
  }

  static fromJSON(json) {
    return new SourceReference(json);
  }

  equals(other) {
    if (!(other instanceof SourceReference)) return false;
    return this.sourceId.toLowerCase() === other.sourceId.toLowerCase() &&
           this.category === other.category;
  }

  toString() {
    let str = `[${this.category.toUpperCase()}] ${this.sourceName}`;
    if (this.level) str += ` (Level ${this.level})`;
    return str;
  }
}

export class TracedModifier {
  constructor({ value, stacking = STACKING_MODES.STACK, conditions = null }) {
    this.value = value;
    this.stacking = stacking;
    this.conditions = conditions ?? [];
    this.sources = [];
  }

  addSource(source) {
    if (source instanceof SourceReference) {
      this.sources.push(source);
    }
    return this;
  }

  addCondition(condition) {
    if (!this.conditions.includes(condition)) {
      this.conditions.push(condition);
    }
    return this;
  }

  setStacking(mode) {
    this.stacking = mode;
    return this;
  }

  combine(other) {
    const result = new TracedModifier({
      value: this.value,
      stacking: this.stacking,
      conditions: [...this.conditions],
    });
    result.sources = [...this.sources];
    
    if (other instanceof TracedModifier) {
      result.sources.push(...other.sources);
      result.conditions.push(...other.conditions);
    }
    
    return result;
  }

  getPrimarySource() {
    return this.sources[0] || null;
  }

  toJSON() {
    return {
      value: this.value,
      stacking: this.stacking,
      conditions: this.conditions,
      sources: this.sources.map(s => s.toJSON()),
    };
  }

  static fromJSON(json) {
    const mod = new TracedModifier({
      value: json.value,
      stacking: json.stacking,
      conditions: json.conditions,
    });
    mod.sources = json.sources.map(s => SourceReference.fromJSON(s));
    return mod;
  }

  toString() {
    const sourceStr = this.sources.map(s => s.sourceName).join(', ') || 'unknown';
    const condStr = this.conditions.length ? ` (${this.conditions.join(', ')})` : '';
    return `${this.value}${condStr} from ${sourceStr}`;
  }
}

export class TracedValue {
  constructor(baseValue = 0) {
    this.baseValue = baseValue;
    this.modifiers = [];
  }

  add(modifier) {
    if (modifier instanceof TracedModifier) {
      this.modifiers.push(modifier);
    } else {
      this.modifiers.push(new TracedModifier({ value: modifier }));
    }
    return this;
  }

  calculate() {
    let replaceValue = this.baseValue;
    let stackValue = 0;
    let maxValue = null;
    let minValue = null;

    for (const mod of this.modifiers) {
      switch (mod.stacking) {
        case STACKING_MODES.REPLACE:
          replaceValue += mod.value;
          break;
        case STACKING_MODES.STACK:
          stackValue += mod.value;
          break;
        case STACKING_MODES.MAX:
          if (maxValue === null || mod.value > maxValue) {
            maxValue = mod.value;
          }
          break;
        case STACKING_MODES.MIN:
          if (minValue === null || mod.value < minValue) {
            minValue = mod.value;
          }
          break;
      }
    }

    let total = replaceValue + stackValue;
    if (maxValue !== null && total > maxValue) total = maxValue;
    if (minValue !== null && total < minValue) total = minValue;

    return total;
  }

  getAllSources() {
    const sources = [];
    for (const mod of this.modifiers) {
      sources.push(...mod.sources);
    }
    return sources;
  }

  getModifierBreakdown() {
    const breakdown = [];
    
    if (this.baseValue !== 0) {
      breakdown.push({
        value: this.baseValue,
        sources: [new SourceReference({
          category: SOURCE_CATEGORIES.SPECIAL,
          sourceName: 'Base Value',
          sourceId: 'base',
        })],
        conditions: [],
      });
    }

    for (const mod of this.modifiers) {
      breakdown.push({
        value: mod.value,
        sources: mod.sources,
        conditions: mod.conditions,
        stacking: mod.stacking,
      });
    }

    return breakdown;
  }

  toJSON() {
    return {
      baseValue: this.baseValue,
      modifiers: this.modifiers.map(m => m.toJSON()),
    };
  }

  static fromJSON(json) {
    if (json === null || json === undefined) {
      return new TracedValue(0);
    }
    if (typeof json === 'number') {
      return new TracedValue(json);
    }
    const tv = new TracedValue(json.baseValue ?? 0);
    tv.modifiers = (json.modifiers || []).map(m => TracedModifier.fromJSON(m));
    return tv;
  }
}

export class TracedResource {
  constructor({ name, maxUses = null, currentUses = null, rechargeType = 'longRest' }) {
    this.name = name;
    this.maxUses = maxUses !== null ? new TracedValue(maxUses) : null;
    this.currentUses = currentUses ?? maxUses;
    this.rechargeType = rechargeType;
    this.sources = [];
  }

  addSource(source) {
    this.sources.push(source);
    return this;
  }

  setMax(uses) {
    this.maxUses = uses instanceof TracedValue ? uses : new TracedValue(uses);
    return this;
  }

  calculateMax() {
    return this.maxUses ? this.maxUses.calculate() : null;
  }

  toJSON() {
    return {
      name: this.name,
      maxUses: this.maxUses?.toJSON() ?? null,
      currentUses: this.currentUses,
      rechargeType: this.rechargeType,
      sources: this.sources.map(s => s.toJSON()),
    };
  }

  static fromJSON(json) {
    const tr = new TracedResource({
      name: json.name,
      maxUses: json.maxUses?.baseValue ?? null,
      currentUses: json.currentUses,
      rechargeType: json.rechargeType,
    });
    if (json.maxUses) {
      tr.maxUses = TracedValue.fromJSON(json.maxUses);
    }
    tr.sources = json.sources.map(s => SourceReference.fromJSON(s));
    return tr;
  }
}
