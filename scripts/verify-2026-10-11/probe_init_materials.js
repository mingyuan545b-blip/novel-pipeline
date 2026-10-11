'use strict';
/** probe_init_materials.js <projectId> — 隔离复现 generateInitialMaterials 全路径，内存遥测写文件 */
process.env.NODE_PATH = require('path').join(__dirname, '..', '..', 'server');
require('module').Module._initPaths();
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, 'probe_mem.log');
fs.writeFileSync(LOG, '');
const pid = process.argv[2] || '1c467b8f-3375-4aeb-a193-678fb003817a';
function w(s) { fs.appendFileSync(LOG, `[${((Date.now()-t0)/1000).toFixed(0)}s] ${s}\n`); }
const t0 = Date.now();
let last = '';
const timer = setInterval(() => {
    const m = process.memoryUsage();
    const line = `rss=${(m.rss/1048576).toFixed(0)}MB heap=${(m.heapUsed/1048576).toFixed(0)}MB ext=${(m.external/1048576).toFixed(0)}MB`;
    if (line !== last) { w(line); last = line; }
}, 2000);
(async () => {
    w('start pid=' + pid);
    const store = require('../../server/store');
    const { getDataContext } = require('../../server/services/dataContext');
    const { resolveGenreFromProject, detectGenre } = require('../../server/services/genreConfig');
    const ctx = await getDataContext(pid);
    const project = await ctx.getProject();
    const genre = resolveGenreFromProject(project) || detectGenre(project?.styleProfile || {});
    w('genre=' + (genre && genre.id));

    const steps = [
        ['autoSetProtagonistName', () => require('../../server/services/pipeline/outlineEntitySync').autoSetProtagonistName(pid, [])],
        ['createCharacterRelations', () => require('../../server/services/pipeline/outlineRelationCreator').createCharacterRelations(pid, [], [])],
        ['createEquipmentBinds', () => require('../../server/services/pipeline/outlineEquipmentBinds').createEquipmentBinds(pid, [], [])],
        ['enforceMaterialDepth', () => require('../../server/services/pipeline/materialDepthEnforcer').enforceMaterialDepth(pid, { apiConfig: undefined })],
        ['designCharacterCraft', () => require('../../server/services/craftDesigner').designCharacterCraft(pid, { apply: false })],
        ['designNarrativePromise', () => require('../../server/services/narrativePromiseDesigner').designNarrativePromise(pid, { apply: false })],
    ];
    for (const [name, fn] of steps) {
        w('>>> ' + name);
        try { const r = await fn(); w('<<< ' + name + ' ok: ' + JSON.stringify(r).substring(0, 200)); }
        catch (e) { w('!!! ' + name + ' err: ' + e.message); }
    }
    w('ALL DONE');
    clearInterval(timer);
    process.exit(0);
})().catch(e => { w('FATAL ' + e.stack); clearInterval(timer); process.exit(1); });
