import loader from './data/loader.js';
import { CharacterBuilder } from './models/CharacterBuilder.js';
import { Cerberus, CerberusTagParser } from './models/Cerberus.js';

async function runCerberusTestSuite() {
    console.log('====================================================');
    console.log('      CERBERUS WATCHDOG COMPREHENSIVE TEST SUITE    ');
    console.log('====================================================\n');

    await loader.loadAll();

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, message) {
        if (condition) {
            passedTests++;
            console.log(`  [PASS] ${message}`);
        } else {
            failedTests++;
            console.log(`  [FAIL] ${message}`);
        }
    }

    // ---------------------------------------------------------
    // TEST 1: CerberusTagParser & Regex Checker
    // ---------------------------------------------------------
    console.log('--- SECTION 1: CerberusTagParser Regex & Resolution ---');
    const sampleTagText = "You know the {@spell Fireball|PHB} spell and have the {@feat Sentinel|PHB} feat. Gain proficiency in {@skill Athletics}.";
    const parsedTags = CerberusTagParser.parseTags(sampleTagText);
    
    assert(parsedTags.length === 3, `Parsed ${parsedTags.length} tags from sample string (expected 3)`);
    assert(parsedTags[0].name === "Fireball" && parsedTags[0].tag === "spell", "Tag 1 identified as spell Fireball");
    assert(parsedTags[1].name === "Sentinel" && parsedTags[1].tag === "feat", "Tag 2 identified as feat Sentinel");
    assert(parsedTags[2].name === "Athletics" && parsedTags[2].tag === "skill", "Tag 3 identified as skill Athletics");

    const rendered = CerberusTagParser.renderTags(sampleTagText);
    assert(rendered.includes("Fireball") && !rendered.includes("{@spell"), "Tags successfully rendered into plain text");

    const fireballEntity = CerberusTagParser.resolveTagToEntity(parsedTags[0], loader);
    assert(fireballEntity && fireballEntity.name === "Fireball", "Tag parser resolved Fireball tag to database spell object");
    console.log('');

    // ---------------------------------------------------------
    // TEST 2: Watchdog on Race Data (Goliath XPHB)
    // ---------------------------------------------------------
    console.log('--- SECTION 2: Race Evaluation - Goliath (XPHB) ---');
    const goliathData = loader.getRace('Goliath', 'XPHB');
    assert(!!goliathData, "Found Goliath XPHB race in loader");
    
    if (goliathData) {
        const goliathReport = Cerberus.watchChoice(goliathData, loader);
        console.log(`Entity: ${goliathReport.entityName} (${goliathReport.entityType})`);
        
        assert(goliathReport.autoGrants.passiveModifiers.some(p => p.type === "SPEED" && p.value === 35), "Detected auto-granted base Speed: 35 ft");
        
        const giantAncestryChoice = goliathReport.selectableChoices.find(c => c.name.toLowerCase().includes("giant ancestry"));
        assert(!!giantAncestryChoice, "Cerberus detected selectable choice: Giant Ancestry");

        if (giantAncestryChoice) {
            assert(giantAncestryChoice.options.length >= 6, `Extracted ${giantAncestryChoice.options.length} Giant Ancestry options (expected >= 6)`);
            assert(!!giantAncestryChoice.recursivelyEvaluatedOptions && giantAncestryChoice.recursivelyEvaluatedOptions.length > 0, "Cerberus recursively evaluated Giant Ancestry child options");
            
            const tumbleOpt = giantAncestryChoice.recursivelyEvaluatedOptions.find(o => o.optionName.toLowerCase().includes("hill giant"));
            assert(!!tumbleOpt, "Recursively evaluated option: Hill Giant's Tumble");
        }
    }
    console.log('');

    // ---------------------------------------------------------
    // TEST 3: Watchdog on Race Data (High Elf & Variant Human)
    // ---------------------------------------------------------
    console.log('--- SECTION 3: Race Evaluation - High Elf & Variant Human ---');
    const highElfData = loader.getRace('Elf', 'PHB');
    const highElfSubData = loader.getSubrace('High Elf', 'PHB');
    if (highElfSubData) {
        const elfReport = Cerberus.watchChoice(highElfSubData, loader);
        assert(elfReport.selectableChoices.some(c => c.type === "SPELL"), "High Elf detected cantrip spell choice");
        assert(elfReport.autoGrants.passiveModifiers.some(p => p.type === "DARKVISION"), "High Elf detected auto-granted Darkvision");
    }

    const vHumanData = loader.getSubrace('Variant', 'PHB') || loader.getSubrace('Variant Human', 'PHB') || loader.getRace('Human', 'PHB');
    if (vHumanData) {
        const vHumanReport = Cerberus.watchChoice(vHumanData, loader);
        assert(vHumanReport.selectableChoices.some(c => c.type === "FEAT"), "Variant Human detected selectable Feat choice");
        assert(vHumanReport.selectableChoices.some(c => c.type === "ABILITY_SCORE"), "Variant Human detected flexible ASI choice");
    }
    console.log('');

    // ---------------------------------------------------------
    // TEST 4: Watchdog on Class & Subclass (Fighter + Battle Master)
    // ---------------------------------------------------------
    console.log('--- SECTION 4: Class & Subclass Evaluation - Fighter / Battle Master ---');
    const fighterData = loader.getClass('Fighter', 'PHB');
    const battleMasterData = loader.getSubclass('Fighter', 'Battle Master', 'PHB');

    assert(!!fighterData, "Found Fighter class in loader");
    if (fighterData) {
        const fighterReport = Cerberus.watchChoice(fighterData, loader);
        assert(fighterReport.selectableChoices.some(c => c.name.toLowerCase().includes("fighting style")), "Cerberus detected Fighting Style choice on Fighter");
        assert(fighterReport.autoGrants.features.some(f => f.name.toLowerCase().includes("second wind")), "Cerberus detected auto-granted feature: Second Wind");
    }

    if (battleMasterData) {
        const bmReport = Cerberus.watchChoice(battleMasterData, loader);
        assert(bmReport.selectableChoices.some(c => c.name?.toLowerCase().includes("maneuver") || c.description?.toLowerCase().includes("maneuver") || c.descriptionText?.toLowerCase().includes("maneuver")), "Cerberus detected Maneuver selection on Battle Master");
    }
    console.log('');

    // ---------------------------------------------------------
    // TEST 5: Watchdog on Feats (Magic Initiate, Fey Touched, Tough)
    // ---------------------------------------------------------
    console.log('--- SECTION 5: Feats Evaluation - Magic Initiate & Fey Touched ---');
    const magicInitiate = loader.getFeat('Magic Initiate', 'PHB');
    if (magicInitiate) {
        const miReport = Cerberus.watchChoice(magicInitiate, loader);
        assert(miReport.selectableChoices.some(c => c.type === "SPELL"), "Magic Initiate detected cantrip/spell choice");
    }

    const feyTouched = loader.getFeat('Fey Touched', 'TCoE');
    if (feyTouched) {
        const ftReport = Cerberus.watchChoice(feyTouched, loader);
        assert(ftReport.autoGrants.spells.some(s => s.name.toLowerCase().includes("misty step")), "Fey Touched detected auto-granted spell: Misty Step");
        assert(ftReport.selectableChoices.some(c => c.type === "ABILITY_SCORE"), "Fey Touched detected flexible +1 ASI choice");
    }

    const tough = loader.getFeat('Tough', 'PHB');
    if (tough) {
        const toughReport = Cerberus.watchChoice(tough, loader);
        assert(toughReport.autoGrants.features.some(f => f.name.toLowerCase().includes("tough")), "Tough feat detected auto-granted feature");
    }
    console.log('');

    // ---------------------------------------------------------
    // TEST 6: Watchdog Full Character Watch (CharacterBuilder Integration)
    // ---------------------------------------------------------
    console.log('--- SECTION 6: CharacterBuilder & Full Character Watch ---');
    const builder = new CharacterBuilder(loader);
    const hero = builder.build({
        name: 'Cerberus Test Hero',
        race: 'Goliath',
        raceSource: 'XPHB',
        classes: [{ name: 'Fighter', source: 'PHB', level: 3 }],
        backgrounds: [{ name: 'Soldier', source: 'PHB' }],
        feats: [{ name: 'Tough', source: 'PHB' }]
    });

    assert(!!hero.cerberusReport, "Character object contains populated cerberusReport");
    if (hero.cerberusReport) {
        const report = hero.cerberusReport;
        console.log(`Character Name: ${report.characterName}`);
        console.log(`Aggregated Auto-Grants:`);
        console.log(`  - Ability Scores: ${report.aggregatedAutoGrants.abilityScores.length}`);
        console.log(`  - Proficiencies: ${report.aggregatedAutoGrants.proficiencies.length}`);
        console.log(`  - Spells: ${report.aggregatedAutoGrants.spells.length}`);
        console.log(`  - Passive Modifiers: ${report.aggregatedAutoGrants.passiveModifiers.length}`);
        console.log(`  - Features: ${report.aggregatedAutoGrants.features.length}`);
        console.log(`Aggregated Selectable Choices: ${report.aggregatedSelectableChoices.length}`);
        
        assert(report.aggregatedAutoGrants.passiveModifiers.length > 0, "Character has auto-granted passive modifiers");
        assert(report.aggregatedSelectableChoices.length > 0, "Character has pending selectable choices identified by Cerberus");
    }
    console.log('');

    // ---------------------------------------------------------
    // TEST SUMMARY
    // ---------------------------------------------------------
    console.log('====================================================');
    console.log(`CERBERUS SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runCerberusTestSuite().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
