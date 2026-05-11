import crypto from 'crypto';
import fs from 'fs';

// Migrate users.json — add UUIDs
const usersPath = '/run/media/kai/HDD 500GB/Projects/100_hours_project/data/users.json';
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
const userIdMap = {};
users.forEach((u) => {
    if (!u.id) {
        u.id = crypto.randomUUID();
    }
    userIdMap[u.username] = u.id;
});
fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
console.log('Users migrated:', JSON.stringify(userIdMap, null, 2));

// Migrate existing character files — set player field
const charDir = '/run/media/kai/HDD 500GB/Projects/100_hours_project/data/generated/characters';
if (fs.existsSync(charDir)) {
    const files = fs.readdirSync(charDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
        const filePath = charDir + '/' + file;
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data.player || data.player === '') {
            // Assign to first user as fallback
            data.player = users[0]?.id || '';
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log('Migrated character', data.name, '-> player:', data.player);
        } else if (userIdMap[data.player]) {
            // Convert username to id
            data.player = userIdMap[data.player];
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log('Migrated character', data.name, '(username->id) -> player:', data.player);
        }
    }
}

console.log('Migration complete!');
