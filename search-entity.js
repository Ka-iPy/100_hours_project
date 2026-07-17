import loader from "./data/loader.js";

async function run() {
    await loader.loadAll();

    console.log("Searching for Alert feat:");
    const alertFeats = loader.feats.filter(f => f.name.toLowerCase() === "alert");
    alertFeats.forEach(f => console.log(`- Name: ${f.name}, Source: ${f.source}`));

    console.log("\nSearching for Fireball spell:");
    const fireballSpells = loader.spells.filter(s => s.name.toLowerCase() === "fireball");
    fireballSpells.forEach(s => console.log(`- Name: ${s.name}, Source: ${s.source}`));
}
run();
