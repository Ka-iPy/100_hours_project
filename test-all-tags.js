import loader from "./data/loader.js";
import { lookupEntity } from "./controllers/apiController.js";

async function run() {
    await loader.loadAll();

    const tagRegex = /\{@([a-zA-Z]+) ([^}]+)\}/g;
    const failedLookups = [];
    let totalTags = 0;

    const checkLookup = (type, name, source) => {
        const cleanName = name.trim();
        const cleanSource = source ? source.trim() : null;

        let data = null;
        switch (type.toLowerCase()) {
            case "spell":
                data = loader.getSpell(cleanName, cleanSource);
                break;
            case "item":
                data = loader.getItem(cleanName, cleanSource);
                break;
            case "feat":
                data = loader.getFeat(cleanName, cleanSource);
                break;
            case "race":
                data = loader.getRace(cleanName, cleanSource);
                break;
            case "background":
                data = loader.getBackground(cleanName, cleanSource);
                break;
            case "class":
                data = loader.getClass(cleanName, cleanSource);
                break;
        }
        return data;
    };

    const processText = (text, location) => {
        if (!text) return;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            totalTags++;
            const [_, tag, content] = match;
            const parts = content.split('|');
            const name = parts[0];
            const source = parts[1] || '';
            const validTags = ['spell', 'item', 'feat', 'condition', 'class', 'race', 'action', 'sense', 'skill'];
            if (validTags.includes(tag.toLowerCase())) {
                const found = checkLookup(tag, name, source);
                if (!found && !['condition', 'action', 'sense', 'skill'].includes(tag.toLowerCase())) {
                    failedLookups.push({ tag, name, source, location });
                }
            }
        }
    };

    // Check feats
    loader.feats.forEach(f => {
        if (f.entries) {
            processText(JSON.stringify(f.entries), `Feat: ${f.name}`);
        }
    });

    // Check class features
    loader.classFeatures.forEach(cf => {
        if (cf.entries) {
            processText(JSON.stringify(cf.entries), `ClassFeature: ${cf.name} (${cf.className})`);
        }
    });

    // Check subclass features
    loader.subclassFeatures.forEach(sf => {
        if (sf.entries) {
            processText(JSON.stringify(sf.entries), `SubclassFeature: ${sf.name} (${sf.className} - ${sf.subclassShortName})`);
        }
    });

    console.log(`Total tags checked: ${totalTags}`);
    console.log(`Failed lookups: ${failedLookups.length}`);
    if (failedLookups.length > 0) {
        console.log("Sample failures:");
        failedLookups.slice(0, 20).forEach(f => {
            console.log(`- [${f.tag}] "${f.name}" (source: "${f.source}") in ${f.location}`);
        });
    }
}
run();
