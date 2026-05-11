import loader from './data/loader.js';

async function test() {
    await loader.loadAll();

    console.log('\n--- Testing Feat Origins ---');
    const featNames = ['Aberrant Dragonmark', 'Magic Initiate', 'Alert'];
    featNames.forEach(name => {
        const origin = loader.getFeatOrigin(name);
        if (origin) {
            console.log(`Feat "${name}" origin: ${origin.type} - ${origin.name} (${origin.source})`);
        } else {
            console.log(`Feat "${name}" origin not found in races or backgrounds.`);
        }
    });

    console.log('\n--- Testing Subclass Feature Parents ---');
    const features = [
        { name: 'Combat Superiority', class: 'Fighter', subclass: 'Battle Master' },
        { name: 'Improved Critical', class: 'Fighter', subclass: 'Champion' }
    ];
    features.forEach(f => {
        const parent = loader.getSubclassFeatureParent(f.name, f.class, f.subclass);
        if (parent) {
            console.log(`Feature "${f.name}" parent: ${parent.subclassShortName} (${parent.className}) at level ${parent.level}`);
        } else {
            console.log(`Feature "${f.name}" parent not found for ${f.subclass} ${f.class}.`);
        }
    });

    console.log('\n--- Testing Subrace Parents ---');
    if (loader.getSubraces().length > 0) {
        const sr = loader.getSubraces()[0];
        const raceName = sr.raceName || (sr._copy && sr._copy.raceName);
        const raceSource = sr.raceSource || (sr._copy && sr._copy.raceSource);
        const parent = loader.getSubraceParent(sr.name, raceName, raceSource);
        if (parent) {
            console.log(`Subrace "${sr.name}" parent: ${parent.raceName} (${parent.raceSource})`);
        } else {
            console.log(`Subrace "${sr.name}" parent not found.`);
        }
    }

    console.log('\n--- Testing Search ---');
    const searchResults = loader.search('spells', 'Fireball');
    console.log(`Search "Fireball" in spells: found ${searchResults.length} results.`);

    console.log('\n--- General Data Stats ---');
    console.log(`Races: ${loader.getRaces().length}`);
    console.log(`Subraces: ${loader.getSubraces().length}`);
    console.log(`Backgrounds: ${loader.getBackgrounds().length}`);
    console.log(`Feats: ${loader.getFeats().length}`);
    console.log(`Classes: ${loader.getClasses().length}`);
    console.log(`Subclasses: ${loader.getSubclasses().length}`);
    console.log(`Spells: ${loader.getSpells().length}`);
    console.log(`Items: ${loader.getItems().length}`);
}

test().catch(console.error);
