const express = require('express');
const router = express.Router();
const store = require('../../store');
const stateSnapshot = require('../../services/stateSnapshot');
const { buildRelationshipGraph } = require('./relationshipGraphBuilder');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.get('/relationship-graph/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await buildRelationshipGraph(projectId);
        res.json(result);
    } catch (e) { res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/power-tracker/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const characters = materials.filter(m => m.type === 'character');
        const powerSystems = materials.filter(m => m.type === 'power-system');
        const growthHistories = materials.filter(m => m.type === 'growth-history');
        const snapshot = await stateSnapshot.getSnapshot(projectId);

        const powerData = characters.map(c => {
            const charState = snapshot?.characterStates?.[c.id] || {};
            const content = c.currentContent || c.initialContent || '';
            let powerLevel = charState.powerLevel;
            if (!powerLevel || powerLevel === '未知') {
                const charName = c.name.split('（')[0].split('(')[0].trim();
                const growthMat = growthHistories.find(g => g.name.includes(charName));
                const growthContent = growthMat ? (growthMat.currentContent || growthMat.initialContent || '') : '';
                const allText = content + '\n' + growthContent;
                const levelPatterns = [
                    /(?:觉醒度|觉醒等级?|当前等级?|战力等级?|实力等级?)\s*[：:]*\s*([^\n,，。；;]{2,30})/i,
                    /(?:Lv\.?|等级?)\s*(\d+[^\n,，。；;]{0,15})/i,
                    /(?:当前|目前|现阶段?)\s*(?:觉醒度|实力|战力|等级?)\s*[：:]*\s*([^\n,，。；;]{2,30})/i,
                    /第[一二三四五六]阶段?\s*[：:]*\s*([^\n,，。；;]{2,30})/i,
                ];
                for (const pattern of levelPatterns) { const match = allText.match(pattern); if (match && match[1]) { powerLevel = match[1].trim(); break; } }
                if (!powerLevel || powerLevel === '未知') {
                    const percentMatch = allText.match(/(\d+)%/);
                    if (percentMatch) { const pct = parseInt(percentMatch[1]); if (pct <= 100 && pct >= 5) { let stage = pct >= 90 ? '临界觉醒' : pct >= 75 ? '深度觉醒' : pct >= 60 ? '稳定觉醒' : pct >= 45 ? '初觉醒' : pct >= 30 ? '潜能激活' : '觉醒初期'; powerLevel = `觉醒度${pct}% (${stage})`; } }
                }
                if (!powerLevel || powerLevel === '未知') { const stageMatch = allText.match(/(?:阶段|阶段|期)\s*[一二三四五六七八九十\d]+\s*[：:]*\s*([^\n]{2,40})/); if (stageMatch) powerLevel = stageMatch[1].trim().substring(0, 30); }
                if (!powerLevel) powerLevel = '未知';
            }
            return { id: c.id, name: c.name, currentPower: powerLevel, status: charState.status || '活跃', lastAppearance: charState.lastAppearanceChapter || 0, hasGrowthArc: growthHistories.some(g => g.name.includes(c.name.split('（')[0].split('(')[0].trim())) };
        });

        const powerFramework = powerSystems.map(ps => ({ id: ps.id, name: ps.name, content: (ps.currentContent || ps.initialContent || '').substring(0, 800) }));
        const progressionData = {};
        for (const c of characters.slice(0, 10)) { progressionData[c.id] = await stateSnapshot.getPowerProgression(projectId, c.id); }

        res.json({ characters: powerData, powerFramework, progressionData });
    } catch (e) { res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/overview/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const [materials, chapters, snapshots, reports] = await Promise.all([
            store.queryItems('materials', m => m.projectId === projectId),
            store.queryItems('chapters', c => c.projectId === projectId),
            store.queryItems('state-snapshots', s => s.projectId === projectId),
            store.queryItems('consistency-reports', r => r.projectId === projectId)
        ]);
        const activeMaterials = materials.filter(m => !m.archived);
        const latestSnapshot = snapshots.sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
        const latestReport = reports.sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0))[0];
        const materialStats = {};
        const types = ['worldview', 'character', 'relationship', 'power-system', 'equipment', 'foreshadowing', 'growth-history', 'catchphrase', 'famous-scene', 'other'];
        for (const t of types) { materialStats[t] = activeMaterials.filter(m => m.type === t).length; }
        const charStates = latestSnapshot?.characterStates || {};
        const activeChars = Object.values(charStates).filter(c => c.active !== false).length;
        const totalChars = Object.keys(charStates).length;
        const foreshadowingStates = latestSnapshot?.foreshadowingStates || {};
        const plantedForeshadowings = Object.values(foreshadowingStates).filter(f => f.status === 'planted').length;
        const urgentForeshadowings = Object.values(foreshadowingStates).filter(f => f.urgency > 70).length;
        res.json({ projectId, totalChapters: chapters.length, totalMaterials: materials.length, activeMaterials: activeMaterials.length, materialStats, snapshotCount: snapshots.length, latestSnapshotChapter: latestSnapshot?.chapterNumber || 0, characterStats: { total: totalChars, active: activeChars }, foreshadowingStats: { planted: plantedForeshadowings, urgent: urgentForeshadowings }, consistencyStats: { totalReports: reports.length, latestChapter: latestReport?.chapterNumber || 0, latestPassed: latestReport?.passed || true, latestCriticalCount: latestReport?.criticalCount || 0 } });
    } catch (e) { res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
