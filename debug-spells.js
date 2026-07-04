import loader from './data/loader.js';
import { Character } from './models/Character.js';

await loader.loadAll();
const character = await Character.load('8882c1b8-b8f6-49c7-b7ff-7afd31264670');

const c = character;
const sbKeys = Object.keys(c.spellbooks || {});
const mainSB = sbKeys.length > 0 ? c.spellbooks[sbKeys[0]] : null;
if (mainSB) {
    const cantrips = mainSB.cantripsKnown || [];
    const allSpells = [...(mainSB.known || []), ...(mainSB.prepared || [])];
    const spellMap = new Map();
    allSpells.forEach((s) => spellMap.set(s.name, s));
    const uniqueSpells = Array.from(spellMap.values());

    for (const s of uniqueSpells) {
        const source = typeof s.source === "string" ? s.source : null;
        const full = loader.getSpell(s.name, source);
        console.log(`Spell: "${s.name}" | Source: "${source}" | Found: ${!!full} | Has time: ${!!full?.time}`);
    }
}
