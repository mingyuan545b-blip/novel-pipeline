'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const { api } = require('./_lib');
(async () => {
    const body = {
        name: '结算宇宙·拾荒者（根源修复验收）',
        genre: '高武', subGenre: 'high-martial-comedy', branchKey: 'metaverse',
        targetChapters: 10,
        description: '【世界观·游戏化元宇宙】众生界是仍在运行的"结算宇宙"，天道是老旧结算主机。主角陆行舟觉醒越界者日志权限；配角阿磬；NPC拂尘；反派裴迟。10章：觉醒→首副本→结怨→潮汛季→真相→首卷高潮。',
        settings: { chapterRounds: 3, chronicleLevel: 'full', worldScopeLevel: 'full' },
        materialPrompt: '见描述', outlinePrompt: '生成10章大纲，每章含名场面+机制BUG+章末钩子；取名须有画面与身份，禁烂大街名。',
    };
    try { const r = await api('POST', '/api/projects/initialize', body, 1800000); console.log('HTTP', r.status, JSON.stringify((r.data?.data||r.data)).substring(0,300)); }
    catch (e) { console.log('FAILED', e.code||e.message); }
    process.exit(0);
})();
