'use strict';
/** 34_verify_R5.js <projectId> — 验证 R5：题材不产出的 relationship 是否整类丢弃（不再刷假告警） */
process.env.NODE_PATH = require('path').join(__dirname, '..', '..', 'server');
require('module').Module._initPaths();
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const pid = process.argv[2] || 'c1ad8769-8db8-4987-8f4c-147c92248c9b';
(async () => {
    require('../../server/store');
    const { getDataContext } = require('../../server/services/dataContext');
    const { resolveGenreFromProject } = require('../../server/services/genreConfig');
    const { resolveContext } = require('../../server/services/pipeline/contextCommander');
    const ctx = await getDataContext(pid);
    const project = await ctx.getProject();
    const genre = resolveGenreFromProject(project);
    const materials = await require('../../server/store').queryItems('materials', { projectId: pid });
    const res = await resolveContext('writer', { projectId: pid, chapter: { chapterNumber: 3, outline: '' }, materials, project, genre });
    const byType = {};
    for (const n of res.materialNeeds) byType[n.type] = { dropped: !!n.dropped, reason: n.dropReason || null };
    console.log('writer relationship:', JSON.stringify(byType.relationship));
    console.log('writer institution :', JSON.stringify(byType.institution));
    console.log('writer character   :', JSON.stringify(byType.character));
    const ok = byType.relationship && byType.relationship.dropped && byType.relationship.reason === 'genre-excluded';
    console.log(ok ? 'R5 PASS：relationship 已整类丢弃（genre-excluded），不再产生空需求假告警' : 'R5 FAIL：relationship 仍未丢弃');
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
