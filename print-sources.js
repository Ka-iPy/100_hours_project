import loader from "./data/loader.js";

async function run() {
    await loader.loadAll();

    const featSources = new Set();
    loader.feats.forEach(f => featSources.add(f.source));
    console.log("Feat Sources:", Array.from(featSources));

    const spellSources = new Set();
    loader.spells.forEach(s => spellSources.add(s.source));
    console.log("Spell Sources:", Array.from(spellSources));
}
run();
