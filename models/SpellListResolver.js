const FULL_CASTER_SLOTS = [
    [2, 0, 0, 0, 0, 0, 0, 0, 0],
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    [4, 3, 3, 1, 0, 0, 0, 0, 0],
    [4, 3, 3, 2, 0, 0, 0, 0, 0],
    [4, 3, 3, 3, 1, 0, 0, 0, 0],
    [4, 3, 3, 3, 2, 0, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const HALF_CASTER_SLOTS = [
    [0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [4, 2, 0, 0, 0],
    [4, 2, 0, 0, 0],
    [4, 3, 0, 0, 0],
    [4, 3, 0, 0, 0],
    [4, 3, 2, 0, 0],
    [4, 3, 2, 0, 0],
    [4, 3, 3, 0, 0],
    [4, 3, 3, 0, 0],
    [4, 3, 3, 1, 0],
    [4, 3, 3, 1, 0],
    [4, 3, 3, 2, 0],
    [4, 3, 3, 2, 0],
    [4, 3, 3, 3, 1],
    [4, 3, 3, 3, 1],
    [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2],
];

const THIRD_CASTER_SLOTS = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [2, 0, 0, 0],
    [3, 0, 0, 0],
    [3, 0, 0, 0],
    [3, 0, 0, 0],
    [4, 2, 0, 0],
    [4, 2, 0, 0],
    [4, 2, 0, 0],
    [4, 3, 0, 0],
    [4, 3, 0, 0],
    [4, 3, 0, 0],
    [4, 3, 2, 0],
    [4, 3, 2, 0],
    [4, 3, 2, 0],
    [4, 3, 3, 0],
    [4, 3, 3, 0],
    [4, 3, 3, 0],
    [4, 3, 3, 1],
    [4, 3, 3, 1],
];

const ARTIFICER_SLOTS = [
    [2, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [4, 2, 0, 0, 0],
    [4, 2, 0, 0, 0],
    [4, 3, 0, 0, 0],
    [4, 3, 0, 0, 0],
    [4, 3, 2, 0, 0],
    [4, 3, 2, 0, 0],
    [4, 3, 3, 0, 0],
    [4, 3, 3, 0, 0],
    [4, 3, 3, 1, 0],
    [4, 3, 3, 1, 0],
    [4, 3, 3, 2, 0],
    [4, 3, 3, 2, 0],
    [4, 3, 3, 3, 1],
    [4, 3, 3, 3, 1],
    [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2],
];

const SCHOOL_CODE_MAP = {
    abjuration: 'A', conjuration: 'C', divination: 'D',
    enchantment: 'E', evocation: 'V', illusion: 'I',
    necromancy: 'N', transmutation: 'T',
};

export class SpellListResolver {
    constructor(loader) {
        this.loader = loader;
    }

    getFilteredSpells() {
        return this.loader.filteredSpells || [];
    }

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

    getNumCantrips(classData, subclassData, characterLevel) {
        const progression = subclassData?.cantripProgression || classData.cantripProgression;
        if (!progression) return 0;
        const idx = Math.min(Math.max(characterLevel, 1), progression.length) - 1;
        return progression[idx] || 0;
    }

    getNumSpells(classData, subclassData, characterLevel, abilityMod = 0) {
        const knownProg = subclassData?.spellsKnownProgression || classData.spellsKnownProgression;

        if (knownProg) {
            const idx = Math.min(Math.max(characterLevel, 1), knownProg.length) - 1;
            return knownProg[idx] || 0;
        }

        const formula = classData.preparedSpells;
        if (formula) {
            return this._evaluatePreparedFormula(formula, characterLevel, abilityMod);
        }

        return 0;
    }

    _evaluatePreparedFormula(formula, level, abilityMod) {
        const result = formula
            .replace(/<\$level\$>/g, String(level))
            .replace(/<\$(?:int|wis|cha|str|dex|con)_mod\$>/g, String(abilityMod));

        try {
            const num = Function(`"use strict"; return (${result})`)();
            return Math.max(1, Math.floor(num));
        } catch {
            return Math.max(1, level + abilityMod);
        }
    }

    getCasterProgression(classData, subclassData) {
        return subclassData?.casterProgression || classData.casterProgression || null;
    }

    getSpellcastingAbility(classData, subclassData) {
        return subclassData?.spellcastingAbility || classData.spellcastingAbility || null;
    }

    getAvailableCantrips(className, classSource) {
        const filtered = this.getFilteredSpells();
        const results = [];

        for (const fspell of filtered) {
            if (fspell.level !== 'cantrip') continue;
            if (!fspell.classes.includes(className.toLowerCase())) continue;

            const raw = this._findRawSpell(fspell.name);
            if (raw) {
                results.push(this._formatSpell(raw, fspell));
            }
        }

        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    getAvailableSpells(className, classSource, maxSpellLevel, subclassName = null, subclassSource = null) {
        const filtered = this.getFilteredSpells();
        const results = [];

        for (const fspell of filtered) {
            if (fspell.level === 'cantrip') continue;
            const spellLevel = parseInt(fspell.level);
            if (isNaN(spellLevel) || spellLevel > maxSpellLevel) continue;
            if (!fspell.classes.includes(className.toLowerCase())) continue;

            const raw = this._findRawSpell(fspell.name);
            if (raw) {
                results.push(this._formatSpell(raw, fspell));
            }
        }

        return results.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    }

    getSubclassGrantedSpells(subclassData, characterLevel) {
        if (!subclassData?.additionalSpells) return { prepared: [], expanded: [] };

        const prepared = [];
        const expanded = [];

        for (const spellBlock of subclassData.additionalSpells) {
            if (spellBlock.prepared) {
                for (const [levelStr, spells] of Object.entries(spellBlock.prepared)) {
                    const reqLevel = parseInt(levelStr);
                    if (reqLevel > characterLevel) continue;
                    for (const spellEntry of spells) {
                        const name = typeof spellEntry === 'string' ? spellEntry : spellEntry.name;
                        if (name) {
                            const raw = this._findRawSpell(name);
                            const fspell = this._findFilteredSpell(name);
                            if (raw) {
                                prepared.push({ ...this._formatSpell(raw, fspell), alwaysPrepared: true, grantedAtLevel: reqLevel });
                            }
                        }
                    }
                }
            }

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

    getFeatGrantedSpells(featData) {
        if (!featData?.additionalSpells) return { known: [], prepared: [], innate: [] };

        const result = { known: [], prepared: [], innate: [] };

        for (const spellBlock of featData.additionalSpells) {
            for (const category of ['known', 'prepared', 'innate']) {
                const data = spellBlock[category];
                if (!data) continue;

                const processSpellList = (list) => {
                    for (const entry of list) {
                        if (typeof entry === 'string') {
                            const raw = this._findRawSpell(entry);
                            const fspell = this._findFilteredSpell(entry);
                            if (raw) result[category].push(this._formatSpell(raw, fspell));
                        } else if (entry.choose) {
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

    _getSpellsMatchingFilter(filter) {
        const filtered = this.getFilteredSpells();
        const results = [];

        for (const fspell of filtered) {
            if (filter.level !== undefined) {
                const spellLevel = fspell.level === 'cantrip' ? 0 : parseInt(fspell.level);
                if (spellLevel !== filter.level) continue;
            }

            if (filter.className) {
                if (!fspell.classes.includes(filter.className.toLowerCase())) continue;
            }

            const raw = this._findRawSpell(fspell.name);
            if (!raw) continue;

            if (filter.schools && !filter.schools.includes(raw.school || '')) continue;

            results.push(this._formatSpell(raw, fspell));
        }

        return results.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    }

    _findRawSpell(name) {
        const cleanName = name.split('|')[0].replace(/#c$/, '').trim();
        return this.loader.getSpell(cleanName) || null;
    }

    _findFilteredSpell(name) {
        const cleanName = name.split('|')[0].replace(/#c$/, '').trim().toLowerCase();
        return this.getFilteredSpells().find(f => f.name.toLowerCase() === cleanName) || null;
    }

    _formatSpell(rawSpell, fspell = null) {
        let level = rawSpell.level;
        if (level === undefined && fspell) {
            level = fspell.level === 'cantrip' ? 0 : parseInt(fspell.level);
        }
        level = level ?? 0;

        let school = rawSpell.school;
        if (school === undefined && fspell) {
            school = SCHOOL_CODE_MAP[fspell.school] || null;
        }

        return {
            name: rawSpell.name,
            source: rawSpell.source,
            level,
            school,
            time: rawSpell.time || null,
            range: rawSpell.range || null,
            components: rawSpell.components || null,
            duration: rawSpell.duration || null,
            concentration: rawSpell.duration?.some(d => d.concentration) || false,
            ritual: fspell?.ritual || rawSpell.meta?.ritual || false,
        };
    }

    getSpellSelectionContext(className, classSource, characterLevel, subclassName = null, subclassSource = null) {
        const classData = this.loader.getClass(className, classSource);
        if (!classData) return null;

        const subclassData = subclassName
            ? this.loader.getSubclass(className, subclassName, subclassSource)
            : null;

        const casterProg = this.getCasterProgression(classData, subclassData);
        if (!casterProg) return null;

        const spellAbility = this.getSpellcastingAbility(classData, subclassData);
        const maxSpellLevel = this.getMaxSpellLevel(casterProg, characterLevel);
        const slots = this.getSpellSlots(casterProg, characterLevel);
        const numCantrips = this.getNumCantrips(classData, subclassData, characterLevel);
        const numSpells = this.getNumSpells(classData, subclassData, characterLevel, 0);
        const preparedFormula = classData.preparedSpells || null;

        const cantrips = this.getAvailableCantrips(className, classSource);
        const spells = this.getAvailableSpells(className, classSource, maxSpellLevel, subclassName, subclassSource);

        const subclassSpells = subclassData
            ? this.getSubclassGrantedSpells(subclassData, characterLevel)
            : { prepared: [], expanded: [] };

        const acquisitionType = classData.spellsKnownProgression || subclassData?.spellsKnownProgression
            ? 'known'
            : classData.preparedSpells
                ? 'prepared'
                : 'known';

        return {
            isCaster: true,
            casterProgression: casterProg,
            spellcastingAbility: spellAbility,
            acquisitionType,
            maxSpellLevel,
            spellSlots: slots,
            numCantrips,
            numSpells,
            preparedFormula,
            cantrips,
            spells,
            subclassAlwaysPrepared: subclassSpells.prepared,
            subclassExpandedList: subclassSpells.expanded,
        };
    }
}

export default SpellListResolver;
