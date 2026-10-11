'use strict';
/** monitor_create.js — 触发 initialize 同时每4s 采样 /api/health/deep/memory */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const { api, sleep } = require('./_lib');
(async () => {
    const body = {
        name: '结算宇宙·拾荒者（根源修复验收）',
        genre: '高武', subGenre: 'high-martial-comedy', branchKey: 'metaverse',
        targetChapters: 10,
        description: '【世界观·游戏化元宇宙】众生界是一套仍在运行的"结算宇宙"：天道是一台老旧的结算主机；山门是公会，飞剑是挂件，功法是技能树，境界是等级。世界处处是没修干净的机制BUG。\n【主角】陆行舟（ID：Ferryman_行舟），前航运调度员，冷静克制、话少但毒，觉醒"越界者"日志权限。\n【配角】阿磬（ID：BronzeBell_磬），体修护卫，憨直守信。\n【系统NPC】拂尘（SVC-027），副本引导NPC，偶发越界发言。\n【反派】尚工阁主·裴迟。\n【金手指】越界日志权限：读/过滤/回滚/注释掉一次判定。\n【第一卷10章】1章 觉醒；2章 首副本卡BUG首通；3-4章 小公会+结怨；5-7章 潮汛季博弈；8-9章 拂尘真相；10章 首卷高潮。',
        settings: { chapterRounds: 3, chronicleLevel: 'full', worldScopeLevel: 'full' },
        materialPrompt: '见描述', outlinePrompt: '生成10章大纲，每章含名场面+机制BUG+章末钩子；取名须有画面与身份，禁烂大街名。',
    };
    let done = false, samples = 0, peak = 0;
    const t = setInterval(async () => {
        if (done) return;
        try {
            const r = await api('GET', '/api/health/deep/memory', null, 5000);
            const mb = r.data?.data?.rssMB || 0;
            if (mb > peak) peak = mb;
            if (samples++ % 3 === 0) console.log(`[mem ${samples}] rss=${mb}MB heap=${r.data?.data?.heapUsedMB}MB`);
        } catch (e) { console.log(`[mem] poll fail: ${e.message}`); }
    }, 4000);
    try {
        console.log('>>> 触发 initialize ...');
        const r = await api('POST', '/api/projects/initialize', body, 1800000);
        console.log('<<< HTTP', r.status, 'elapsed steps:', JSON.stringify((r.data?.data || r.data)?.steps || r.data).substring(0, 300));
    } catch (e) { console.log('!!! initialize 失败:', e.code || e.message, '| peak RSS', peak, 'MB'); }
    done = true; clearInterval(t);
    console.log('peak RSS:', peak, 'MB');
    process.exit(0);
})();
