import loader from './data/loader.js';
import { CharacterBuilder } from './models/CharacterBuilder.js';
import { isFeatureSelectable, extractAvailableOptions } from './utils/featureSelectability.js';

async function test() {
    await loader.loadAll();
    
    console.log('=== Testing Feature Selectability Detection ===\n');

    console.log('--- Testing isFeatureSelectable patterns ---\n');
    
    const testCases = [
        {
            name: 'Giant Ancestry',
            description: 'You are descended from Giants. Choose one of the following benefits—a supernatural boon from your ancestry; you can use the chosen benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest:',
            expected: true,
        },
        {
            name: 'Stone\'s Endurance',
            description: 'You can focus yourself to occasionally shrug off injury. When you take damage, you can use your reaction to roll a d12. Add your Constitution modifier to the number rolled, and reduce the damage by that total. After you use this trait, you can\'t use it again until you finish a short or long rest.',
            expected: false,
        },
        {
            name: 'Fighting Style',
            description: 'You adopt a particular style of fighting as your specialty. Choose one of the following options. You can\'t take a Fighting Style option more than once, even if you later get to choose again.',
            expected: true,
        },
        {
            name: 'Second Wind',
            description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you can\'t use it again until you finish a short or long rest.',
            expected: false,
        },
        {
            name: 'Darkvision',
            description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
            expected: false,
        },
        {
            name: 'Skill Versatility',
            description: 'You gain proficiency in one skill of your choice.',
            expected: true,
        },
        {
            name: 'Expertise',
            description: 'Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
            expected: false,
        },
        {
            name: 'Maneuvers',
            description: 'You learn one maneuver of your choice from among those available to the Battle Master archetype. If a maneuver you use requires a target to make a saving throw, the saving throw DC equals 8 + your proficiency bonus + your Strength or Dexterity modifier.',
            expected: true,
        },
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(tc => {
        const result = isFeatureSelectable(tc.name, tc.description);
        const status = result === tc.expected ? 'PASS' : 'FAIL';
        if (result === tc.expected) {
            passed++;
        } else {
            failed++;
        }
        console.log(`[${status}] "${tc.name}"`);
        console.log(`  Expected: ${tc.expected}, Got: ${result}`);
        console.log(`  Description: ${tc.description.substring(0, 80)}...`);
        console.log('');
    });

    console.log(`--- Pattern Test Results: ${passed} passed, ${failed} failed ---\n`);

    console.log('--- Testing CharacterBuilder with Goliath Race ---\n');
    
    const raceData = loader.getRace('Goliath', 'XPHB');
    console.log('Race data entries:');
    if (raceData?.entries) {
        raceData.entries.forEach(e => {
            if (e.type === 'entries' && e.name) {
                console.log(`  - ${e.name} (type: ${e.type})`);
                if (e.entries && typeof e.entries[0] === 'string') {
                    console.log(`    First entry: ${e.entries[0].substring(0, 100)}...`);
                }
            }
        });
    }
    
    console.log('\n--- Building Character ---\n');
    
    const builder = new CharacterBuilder(loader);
    const character = builder.build({
        name: 'Test Character',
        race: 'Goliath',
        raceSource: 'XPHB',
        classes: [
            { name: 'Fighter', level: 1, asiSelections: [] }
        ]
    });

    console.log(`Character created: ${character.name}`);
    console.log(`Race: ${character.race?.sourceName}`);
    console.log(`Total features: ${character.features.length}`);
    console.log(`Pending selections: ${character.pendingFeatureSelections.length}`);
    
    if (character.pendingFeatureSelections.length > 0) {
        console.log('\nPending Feature Selections:');
        character.pendingFeatureSelections.forEach(ps => {
            console.log(`  - ${ps.featureName}`);
            console.log(`    Description: ${ps.description.substring(0, 100)}...`);
        });
    }

    console.log('\nFeatures marked as selectable:');
    character.features
        .filter(f => f.selectable)
        .forEach(f => {
            console.log(`  - ${f.name} (hasOptions: ${!!f.availableOptions})`);
            console.log(`    Description: ${f.description.substring(0, 100)}...`);
        });
    
    console.log('\nAll Features:');
    character.features.forEach(f => {
        console.log(`  - ${f.name} (selectable: ${f.selectable})`);
    });

    console.log('\n=== Test Complete ===');
}

test().catch(console.error);
