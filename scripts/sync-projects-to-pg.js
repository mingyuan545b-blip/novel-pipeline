/**
 * 同步JSON项目数据到PG projects表
 */
process.env.USE_PG = 'true';
const store = require('../server/store');
const fs = require('fs');
const path = require('path');

async function run() {
    await store.ensureBackend();

    const projDir = path.join(process.cwd(), 'data', 'projects');
    const files = fs.readdirSync(projDir).filter(f => f.endsWith('.json'));

    console.log(`Found ${files.length} JSON project files`);

    for (const f of files) {
        const data = JSON.parse(fs.readFileSync(path.join(projDir, f), 'utf-8'));
        const projId = f.replace('.json', '');

        // Check if already exists in PG
        const existing = await store.getItem('projects', projId);
        if (existing) {
            console.log(`  Skip (exists): ${projId.substring(0,8)} "${data.name}"`);
            continue;
        }

        data.id = projId;
        await store.setItem('projects', projId, data);
        console.log(`  Synced: ${projId.substring(0,8)} "${data.name}" genre=${data.styleProfile?.genre || '?'} key=${data.styleProfile?.key || '?'}`);
    }

    // Verify
    const projects = await store.queryItems('projects', () => true);
    console.log(`\nPG projects now has: ${projects.length} records`);
    projects.forEach(p => console.log(`  ${p.id?.substring(0,8)} "${p.name}" key=${p.styleProfile?.key || '?'}`));
}

run().catch(e => console.error(e));
