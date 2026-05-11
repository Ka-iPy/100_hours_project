/**
 * SpellListResolver – determines what spells a character can pick
 * during creation based on class, subclass, feats, and level.
 */

// Standard full-caster spell slot table (index 0 = level 1)
const FULL_CASTER_SLOTS = [
    [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
    [3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
    [4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
    [4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
    [4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
    [4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
    [4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
    [4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
    [4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
    [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
    [4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
    [4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
    [4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
    [4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
    [4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
    [4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
    [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
    [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
    [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
    [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
];

const HALF_CASTER_SLOTS = [
    [0, 0, 0, 0, 0], // 1
    [2, 0, 0, 0, 0], // 2
    [3, 0, 0, 0, 0], // 3
    [3, 0, 0, 0, 0], // 4
    [4, 2, 0, 0, 0], // 5
    [4, 2, 0, 0, 0], // 6
    [4, 3, 0, 0, 0], // 7
    [4, 3, 0, 0, 0], // 8
    [4, 3, 2, 0, 0], // 9
    [4, 3, 2, 0, 0], // 10
    [4, 3, 3, 0, 0], // 11
    [4, 3, 3, 0, 0], // 12
    [4, 3, 3, 1, 0], // 13
    [4, 3, 3, 1, 0], // 14
    [4, 3, 3, 2, 0], // 15
    [4, 3, 3, 2, 0], // 16
    [4, 3, 3, 3, 1], // 17
    [4, 3, 3, 3, 1], // 18
    [4, 3, 3, 3, 2], // 19
    [4, 3, 3, 3, 2], // 20
];

const THIRD_CASTER_SLOTS = [
    [0, 0, 0, 0], // 1
    [0, 0, 0, 0], // 2
    [2, 0, 0, 0], // 3
    [3, 0, 0, 0], // 4
    [3, 0, 0, 0], // 5
    [3, 0, 0, 0], // 6
    [4, 2, 0, 0], // 7
    [4, 2, 0, 0], // 8
    [4, 2, 0, 0], // 9
    [4, 3, 0, 0], // 10
    [4, 3, 0, 0], // 11
    [4, 3, 0, 0], // 12
    [4, 3, 2, 0], // 13
    [4, 3, 2, 0], // 14
    [4, 3, 2, 0], // 15
    [4, 3, 3, 0], // 16
    [4, 3, 3, 0], // 17
    [4, 3, 3, 0], // 18
    [4, 3, 3, 1], // 19
    [4, 3, 3, 1], // 20
];

// Artificer uses a unique progression (rounds up instead of down)
const ARTIFICER_SLOTS = [
    [2, 0, 0, 0, 0], // 1
    [2, 0, 0, 0, 0], // 2
    [3, 0, 0, 0, 0], // 3
    [3, 0, 0, 0, 0], // 4
    [4, 2, 0, 0, 0], // 5
    [4, 2, 0, 0, 0], // 6
    [4, 3, 0, 0, 0], // 7
    [4, 3, 0, 0, 0], // 8
    [4, 3, 2, 0, 0], // 9
    [4, 3, 2, 0, 0], // 10
    [4, 3, 3, 0, 0], // 11
    [4, 3, 3, 0, 0], // 12
    [4, 3, 3, 1, 0], // 13
    [4, 3, 3, 1, 0], // 14
    [4, 3, 3, 2, 0], // 15
    [4, 3, 3, 2, 0], // 16
    [4, 3, 3, 3, 1], // 17
    [4, 3, 3, 3, 1], // 18
    [4, 3, 3, 3, 2], // 19
    [4, 3, 3, 3, 2], // 20
];

export class SpellListResolver {
    constructor(loader) {
        this.loader = loader;
        this._spellLookup = null;
    }

    /**
     * Lazily load and cache the spell source lookup.
     */
    getSpellLookup() {
        if (this._spellLookup) return this._spellLookup;

        // Build a flat map: lowercaseName -> { spell, classes: Set<"ClassName|Source"> }
        const lookup = new Map();
        const allSpells = this.loader.getSpells();

        // Index all spells by name
        for (const spell of allSpells) {
            const key = spell.name.toLowerCase();
            if (!lookup.has(key)) {
                lookup.set(key, { spell, classes: new Set(), subclasses: new Set() });
            }
        }

        // Load class assignments from sources.json data
        const sourcesData = this.loader.spellSourceLookup;
        if (sourcesData) {
            for (const [sourceBook, spells] of Object.entries(sourcesData)) {
                for (const [spellName, info] of Object.entries(spells)) {
                    const key = spellName.toLowerCase();
                    const entry = lookup.get(key);
                    if (!entry) continue;

                    if (info.class) {
                        for (const [classSource, classNames] of Object.entries(info.class)) {
                            for (const className of Object.keys(classNames)) {
                                entry.classes.add(`${className}|${classSource}`);
                            }
                        }
                    }
                    if (info.subclass) {
                        for (const [classSource, classEntries] of Object.entries(info.subclass)) {
                            for (const [className, subclassSources] of Object.entries(classEntries)) {
                                for (const [scSource, subclasses] of Object.entries(subclassSources)) {
                                    for (const [scName, scInfo] of Object.entries(subclasses)) {
                                        entry.subclasses.add(`${className}|${classSource}|${scName}|${scSource}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        this._spellLookup = lookup;
        return lookup;
    }

    /**
     * Get spell slot progression for a caster type.
     */
    getSpellSlots(casterProgression, characterLevel) {
        const lvl = Math.min(Math.max(characterLevel, 1), 20);
        const idx = lvl - 1;

        switch (casterProgression) {
            case 'full': return FULL_CASTER_SLOTS[idx] || [];
            case '1/2': return HALF_CASTER_SLOTS[idx] || [];
            case '1/3': return THIRD_CASTER_SLOTS[idx] || [];
            case 'artificer': return ARTIFICER_SLOTS[idx] || [];
            default: return [];
        }
    }

    /**
     * Get the maximum spell level available for a given caster type and level.
     */
    getMaxSpellLevel(casterProgression, characterLevel) {
        const slots = this.getSpellSlots(casterProgression, characterLevel);
        let maxLevel = 0;
        for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i] > 0) {
                maxLevel = i + 1;
                break;
            }
        }
        return maxLevel;
    }

    /**
     * Get number of cantrips known at a given level.
     */
    getNumCantrips(classData, subclassData, characterLevel) {
        // Subclass cantripProgression overrides class (e.g. Eldritch Knight)
        const progression = subclassData?.cantripProgression || classData.cantripProgression;
        if (!progression) return 0;
        const idx = Math.min(Math.max(characterLevel, 1), progression.length) - 1;
        return progression[idx] || 0;
    }

    /**
     * Get number of spells known/prepared at a given level.
     */
    getNumSpells(classData, subclassData, characterLevel, abilityMod = 0) {
        // Check subclass first (e.g. Eldritch Knight has its own spellsKnownProgression)
        const knownProg = subclassData?.spellsKnownProgression || classData.spellsKnownProgression;

        if (knownProg) {
            const idx = Math.min(Math.max(characterLevel, 1), knownProg.length) - 1;
            return knownProg[idx] || 0;
        }

        // Prepared casters use a formula
        const formula = classData.preparedSpells;
        if (formula) {
            return this._evaluatePreparedFormula(formula, characterLevel, abilityMod);
        }

        return 0;
    }

    /**
     * Evaluate a preparedSpells formula like "<$level$> + <$int_mod$>"
     */
    _evaluatePreparedFormula(formula, level, abilityMod) {
        const result = formula
            .replace(/<\$level\$>/g, String(level))
            .replace(/<\$(?:int|wis|cha|str|dex|con)_mod\$>/g, String(abilityMod));

        try {
            // Safe eval for simple arithmetic
            const num = Function(`"use strict"; return (${result})`)();
            return Math.max(1, Math.floor(num));
        } catch {
            return Math.max(1, level + abilityMod);
        }
    }

    /**
     * Get the caster progression, checking both class and subclass.
     */
    getCasterProgression(classData, subclassData) {
        return subclassData?.casterProgression || classData.casterProgression || null;
    }

    /**
     * Get the spellcasting ability, checking both class and subclass.
     */
    getSpellcastingAbility(classData, subclassData) {
        return subclassData?.spellcastingAbility || classData.spellcastingAbility || null;
    }

    /**
     * Get all available cantrips for a class/subclass.
     */
    getAvailableCantrips(className, classSource) {
        const lookup = this.getSpellLookup();
        const results = [];

        for (const [, entry] of lookup) {
            if (entry.spell.level !== 0) continue;
            if (entry.classes.has(`${className}|${classSource}`)) {
                results.push(this._formatSpell(entry.spell));
            }
        }

        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get all available leveled spells for a class/subclass up to a max spell level.
     */
    getAvailableSpells(className, classSource, maxSpellLevel, subclassName = null, subclassSource = null) {
        const lookup = this.getSpellLookup();
        const results = [];

        for (const [, entry] of lookup) {
            if (entry.spell.level === 0) continue; // skip cantrips
            if (entry.spell.level > maxSpellLevel) continue;

            let available = false;

            // Check class spell list
            if (entry.classes.has(`${className}|${classSource}`)) {
                available = true;
            }

            // Check subclass expanded spells
            if (!available && subclassName && subclassSource) {
                if (entry.subclasses.has(`${className}|${classSource}|${subclassName}|${subclassSource}`)) {
                    available = true;
                }
            }

            if (available) {
                results.push(this._formatSpell(entry.spell));
            }
        }

        return results.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    }

    /**
     * Get spells granted by a subclass's additionalSpells (always prepared / expanded).
     */
    getSubclassGrantedSpells(subclassData, characterLevel) {
        if (!subclassData?.additionalSpells) return { prepared: [], expanded: [] };

        const prepared = [];
        const expanded = [];

        for (const spellBlock of subclassData.additionalSpells) {
            // Always-prepared spells (e.g. Armorer Spells)
            if (spellBlock.prepared) {
                for (const [levelStr, spells] of Object.entries(spellBlock.prepared)) {
                    const reqLevel = parseInt(levelStr);
                    if (reqLevel > characterLevel) continue;
                    for (const spellEntry of spells) {
                        const name = typeof spellEntry === 'string' ? spellEntry : spellEntry.name;
                        if (name) {
                            const spell = this._findSpellByName(name);
                            if (spell) prepared.push({ ...this._formatSpell(spell), alwaysPrepared: true, grantedAtLevel: reqLevel });
                        }
                    }
                }
            }

            // Expanded spell list (e.g. Eldritch Knight gets Wizard spells)
            if (spellBlock.expanded) {
                for (const [levelStr, filters] of Object.entries(spellBlock.expanded)) {
                    const reqLevel = parseInt(levelStr);
                    if (reqLevel > characterLevel) continue;
                    for (const filter of filters) {
                        if (filter.all) {
                            const parsed = this._parseFilterString(filter.all);
                            const matching = this._getSpellsMatchingFilter(parsed);
                            expanded.push(...matching);
                        }
                    }
                }
            }
        }

        return { prepared, expanded };
    }

    /**
     * Get spells granted by a feat.
     */
    getFeatGrantedSpells(featData) {
        if (!featData?.additionalSpells) return { known: [], prepared: [], innate: [] };

        const result = { known: [], prepared: [], innate: [] };

        for (const spellBlock of featData.additionalSpells) {
            for (const category of ['known', 'prepared', 'innate']) {
                const data = spellBlock[category];
                if (!data) continue;

                // Handle direct spell lists and filter-based selections
                const processSpellList = (list) => {
                    for (const entry of list) {
                        if (typeof entry === 'string') {
                            const spell = this._findSpellByName(entry);
                            if (spell) result[category].push(this._formatSpell(spell));
                        } else if (entry.choose) {
                            // Filter-based: "level=0|class=Sorcerer"
                            const parsed = this._parseFilterString(entry.choose);
                            result[category].push({
                                type: 'choice',
                                filter: entry.choose,
                                options: this._getSpellsMatchingFilter(parsed),
                                count: entry.count || 1,
                            });
                        }
                    }
                };

                if (data._) {
                    if (Array.isArray(data._)) {
                        processSpellList(data._);
                    } else if (typeof data._ === 'object') {
                        // Nested: { rest: { 1: [...] } } or { daily: { 1e: [...] } }
                        for (const freq of Object.values(data._)) {
                            for (const spellList of Object.values(freq)) {
                                if (Array.isArray(spellList)) processSpellList(spellList);
                            }
                        }
                    }
                }
            }
        }

        return result;
    }

    /**
     * Parse a 5etools filter string like "level=1|class=Wizard" or "level=2|school=E;N".
     */
    _parseFilterString(filterStr) {
        const parts = filterStr.split('|');
        const filter = {};

        for (const part of parts) {
            const [key, value] = part.split('=');
            if (key === 'level') {
                filter.level = parseInt(value);
            } else if (key === 'class') {
                filter.className = value;
            } else if (key === 'school') {
                filter.schools = value.split(';');
            }
        }

        return filter;
    }

    /**
     * Get spells matching a parsed filter.
     */
    _getSpellsMatchingFilter(filter) {
        const lookup = this.getSpellLookup();
        const results = [];

        for (const [, entry] of lookup) {
            // Level filter
            if (filter.level !== undefined && entry.spell.level !== filter.level) continue;

            // Class filter
            if (filter.className) {
                let matchesClass = false;
                for (const classKey of entry.classes) {
                    if (classKey.startsWith(filter.className + '|')) {
                        matchesClass = true;
                        break;
                    }
                }
                if (!matchesClass) continue;
            }

            // School filter
            if (filter.schools && !filter.schools.includes(entry.spell.school)) continue;

            results.push(this._formatSpell(entry.spell));
        }

        return results.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    }

    /**
     * Find a spell by name (case-insensitive).
     */
    _findSpellByName(name) {
        // Strip source suffixes like "Magic Missile|XPHB"
        const cleanName = name.split('|')[0].replace(/#c$/, '').trim();
        const key = cleanName.toLowerCase();

        const lookup = this.getSpellLookup();
        const entry = lookup.get(key);
        return entry?.spell || null;
    }

    /**
     * Format a spell for API output.
     */
    _formatSpell(spell) {
        return {
            name: spell.name,
            source: spell.source,
            level: spell.level,
            school: spell.school,
            time: spell.time,
            range: spell.range,
            components: spell.components,
            duration: spell.duration,
            concentration: spell.duration?.some(d => d.concentration) || false,
            ritual: spell.meta?.ritual || false,
        };
    }

    /**
     * Get a full spell selection context for a character being created.
     * This is the main entry point for the character creator.
     */
    getSpellSelectionContext(className, classSource, characterLevel, subclassName = null, subclassSource = null) {
        const classData = this.loader.getClass(className, classSource);
        if (!classData) return null;

        const subclassData = subclassName
            ? this.loader.getSubclass(className, subclassName, subclassSource)
            : null;

        const casterProg = this.getCasterProgression(classData, subclassData);
        if (!casterProg) return null; // non-caster

        const spellAbility = this.getSpellcastingAbility(classData, subclassData);
        const maxSpellLevel = this.getMaxSpellLevel(casterProg, characterLevel);
        const slots = this.getSpellSlots(casterProg, characterLevel);
        const numCantrips = this.getNumCantrips(classData, subclassData, characterLevel);

        // For numSpells, we need the ability mod — use 0 as placeholder;
        // the client can recalculate with actual ability scores
        const numSpells = this.getNumSpells(classData, subclassData, characterLevel, 0);
        const preparedFormula = classData.preparedSpells || null;

        const cantrips = this.getAvailableCantrips(className, classSource);
        const spells = this.getAvailableSpells(className, classSource, maxSpellLevel, subclassName, subclassSource);

        // Subclass always-prepared / expanded
        const subclassSpells = subclassData
            ? this.getSubclassGrantedSpells(subclassData, characterLevel)
            : { prepared: [], expanded: [] };

        // Determine spell acquisition type
        const acquisitionType = classData.spellsKnownProgression || subclassData?.spellsKnownProgression
            ? 'known'
            : classData.preparedSpells
                ? 'prepared'
                : 'known';

        return {
            isCaster: true,
            casterProgression: casterProg,
            spellcastingAbility: spellAbility,
            acquisitionType, // 'known' or 'prepared'
            maxSpellLevel,
            spellSlots: slots,
            numCantrips,
            numSpells,
            preparedFormula, // null for known casters, formula string for prepared
            cantrips,
            spells,
            subclassAlwaysPrepared: subclassSpells.prepared,
            subclassExpandedList: subclassSpells.expanded,
        };
    }
}

export default SpellListResolver;
