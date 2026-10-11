'use strict';
const { api, sleep } = require('./_lib');
(async () => {
    const pid = process.argv[2], n = parseInt(process.argv[3], 10);
    const cl = await api('GET', '/api/chapters?projectId=' + pid);
    const chapters = Array.isArray(cl.data) ? cl.data : (cl.data.chapters || []);
    const ch = chapters.find(c => c.chapterNumber === n);
    const r = await api('POST', '/api/pipeline/full', { projectId: pid, chapterId: ch.id, maxRounds: 3 }, 60000);
    console.log('launch', r.status, 'task', r.data && r.data.taskId);
    const t = r.data && r.data.taskId; if (!t) return process.exit(1);
    for (let i = 0; i < 30; i++) { await sleep(10000); const s = await api('GET', '/api/pipeline/task/' + t); const st = s.data && s.data.status; console.log(i, st, s.data && s.data.error || ''); if (['completed','failed','done','timeout'].includes(st)) break; }
    process.exit(0);
})();
