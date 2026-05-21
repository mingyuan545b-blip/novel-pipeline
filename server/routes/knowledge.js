const express = require('express');
const router = express.Router();
const memory = require('../services/memory');
const stateSnapshot = require('../services/stateSnapshot');
const consistency = require('../services/consistency');
const store = require('../store');

router.get('/memory/:projectId/layers', async (req, res) => {
    try {
        const { projectId } = req.params;
        const layers = {};
        for (const layer of ['core', 'active', 'recent', 'archive', 'compressed']) {
            layers[layer] = await memory.getLayer(projectId, layer);
        }
        res.json(layers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/memory/:projectId/layer/:layer', async (req, res) => {
    try {
        const { projectId, layer } = req.params;
        const data = await memory.getLayer(projectId, layer);
        res.json(data || null);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/memory/:projectId/build/:layer', async (req, res) => {
    try {
        const { projectId, layer } = req.params;
        const { chapterNumber } = req.body;
        let result;
        switch (layer) {
            case 'core':
                result = await memory.buildL0(projectId);
                break;
            case 'active':
                result = await memory.buildL1(projectId, chapterNumber);
                break;
            case 'recent':
                result = await memory.buildL2(projectId, chapterNumber);
                break;
            case 'archive':
                result = await memory.buildL3(projectId, chapterNumber, req.body.keywords);
                break;
            case 'compressed':
                result = await memory.buildL4(projectId, chapterNumber);
                break;
            default:
                return res.status(400).json({ error: '无效的层级' });
        }
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/memory/:projectId/assemble', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterOutline, model, mentionedCharacters, recentWindowSize, reservedTokens } = req.body;
        const context = await memory.assembleContext(projectId, chapterNumber, chapterOutline, model, {
            mentionedCharacters,
            recentWindowSize,
            reservedTokens
        });
        res.json(context);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/memory/:projectId/formatted-context', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterOutline, model } = req.query;
        const context = await memory.assembleContext(
            projectId,
            parseInt(chapterNumber) || 1,
            chapterOutline || '',
            model || 'default'
        );
        const formatted = memory.formatContextForPrompt(context);
        res.json({ formatted, layersIncluded: context.layersIncluded, budgetUsed: context.budgetUsed, budgetTotal: context.budgetTotal });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/memory/:projectId/volume-summary/:volumeNum', async (req, res) => {
    try {
        const { projectId, volumeNum } = req.params;
        const endChapter = parseInt(volumeNum) * 30;
        const result = await memory.generateVolumeSummary(projectId, endChapter);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/snapshots/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterContent, materialUpdates } = req.body;
        const snapshot = await stateSnapshot.createSnapshot(
            projectId, chapterNumber, chapterContent, materialUpdates
        );
        res.json(snapshot);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/snapshots/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber } = req.query;
        if (chapterNumber) {
            const snapshot = await stateSnapshot.getSnapshot(projectId, parseInt(chapterNumber));
            res.json(snapshot || null);
        } else {
            const history = await stateSnapshot.getSnapshotHistory(projectId);
            res.json(history);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/snapshots/:projectId/latest', async (req, res) => {
    try {
        const { projectId } = req.params;
        const snapshot = await stateSnapshot.getSnapshot(projectId);
        res.json(snapshot || null);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/snapshots/:projectId/character/:characterId/timeline', async (req, res) => {
    try {
        const { projectId, characterId } = req.params;
        const timeline = await stateSnapshot.getCharacterTimeline(projectId, characterId);
        res.json(timeline);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/snapshots/:projectId/relationship/:relationshipId/timeline', async (req, res) => {
    try {
        const { projectId, relationshipId } = req.params;
        const timeline = await stateSnapshot.getRelationshipTimeline(projectId, relationshipId);
        res.json(timeline);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/snapshots/:projectId/power/:characterId', async (req, res) => {
    try {
        const { projectId, characterId } = req.params;
        const progression = await stateSnapshot.getPowerProgression(projectId, characterId);
        res.json(progression);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/snapshots/:projectId/foreshadowing', async (req, res) => {
    try {
        const { projectId } = req.params;
        const tracker = await stateSnapshot.getForeshadowingTracker(projectId);
        res.json(tracker);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/snapshots/:projectId/restore/:chapterNumber', async (req, res) => {
    try {
        const { projectId, chapterNumber } = req.params;
        const result = await stateSnapshot.restoreSnapshot(projectId, parseInt(chapterNumber));
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/snapshots/:projectId/diff', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterA, chapterB } = req.query;
        if (!chapterA || !chapterB) return res.status(400).json({ error: '需要chapterA和chapterB参数' });
        const diff = await stateSnapshot.getDiff(projectId, parseInt(chapterA), parseInt(chapterB));
        res.json(diff);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/consistency/:projectId/check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterContent, chapterOutline } = req.body;
        const report = await consistency.fullCheck(
            projectId, chapterNumber, chapterContent, chapterOutline
        );
        res.json(report);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/consistency/:projectId/quick-check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterContent } = req.body;
        const result = await consistency.quickCheck(projectId, chapterNumber, chapterContent);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/consistency/:projectId/ai-check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterContent, apiConfig } = req.body;
        const result = await consistency.aiAssistedCheck(
            projectId, chapterNumber, chapterContent, apiConfig
        );
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/consistency/:projectId/reports', async (req, res) => {
    try {
        const { projectId } = req.params;
        const reports = await consistency.getReportHistory(projectId);
        res.json(reports);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/relationship-graph/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const characters = materials.filter(m => m.type === 'character');
        const relationships = materials.filter(m => m.type === 'relationship');

        const nodes = characters.map(c => {
            const content = c.currentContent || c.initialContent || '';
            return {
                id: c.id,
                name: c.name,
                type: c.tags?.includes('核心') ? 'core' : 'supporting',
                description: content.substring(0, 100),
                group: c.tags?.[0] || 'default'
            };
        });

        const edges = [];
        for (const r of relationships) {
            const content = r.currentContent || r.initialContent || '';
            const nameParts = r.name.split(/[与和及→←↔\-]/);
            if (nameParts.length >= 2) {
                const source = characters.find(c => nameParts[0].trim().includes(c.name) || c.name.includes(nameParts[0].trim()));
                const target = characters.find(c => nameParts[1].trim().includes(c.name) || c.name.includes(nameParts[1].trim()));
                if (source && target) {
                    edges.push({
                        id: r.id,
                        source: source.id,
                        target: target.id,
                        label: r.tags?.[0] || '关系',
                        type: r.tags?.[0] || 'unknown',
                        strength: 50,
                        description: content.substring(0, 100)
                    });
                }
            }
        }

        const snapshot = await stateSnapshot.getSnapshot(projectId);
        if (snapshot?.relationshipStates) {
            for (const edge of edges) {
                const state = snapshot.relationshipStates[edge.id];
                if (state) {
                    edge.type = state.type || edge.type;
                    edge.strength = state.strength || edge.strength;
                }
            }
        }

        res.json({ nodes, edges });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

                for (const pattern of levelPatterns) {
                    const match = allText.match(pattern);
                    if (match && match[1]) {
                        powerLevel = match[1].trim();
                        break;
                    }
                }

                if (!powerLevel || powerLevel === '未知') {
                    const percentMatch = allText.match(/(\d+)%/);
                    if (percentMatch) {
                        const pct = parseInt(percentMatch[1]);
                        if (pct <= 100 && pct >= 5) {
                            let stage = '';
                            if (pct >= 90) stage = '临界觉醒';
                            else if (pct >= 75) stage = '深度觉醒';
                            else if (pct >= 60) stage = '稳定觉醒';
                            else if (pct >= 45) stage = '初觉醒';
                            else if (pct >= 30) stage = '潜能激活';
                            else stage = '觉醒初期';
                            powerLevel = `觉醒度${pct}% (${stage})`;
                        }
                    }
                }

                if (!powerLevel || powerLevel === '未知') {
                    const stageMatch = allText.match(/(?:阶段|阶段|期)\s*[一二三四五六七八九十\d]+\s*[：:]*\s*([^\n]{2,40})/);
                    if (stageMatch) powerLevel = stageMatch[1].trim().substring(0, 30);
                }

                if (!powerLevel) powerLevel = '未知';
            }

            return {
                id: c.id,
                name: c.name,
                currentPower: powerLevel,
                status: charState.status || '活跃',
                lastAppearance: charState.lastAppearanceChapter || 0,
                hasGrowthArc: growthHistories.some(g => g.name.includes(c.name.split('（')[0].split('(')[0].trim()))
            };
        });

        const powerFramework = powerSystems.map(ps => ({
            id: ps.id,
            name: ps.name,
            content: (ps.currentContent || ps.initialContent || '').substring(0, 800)
        }));

        const progressionData = {};
        for (const c of characters.slice(0, 10)) {
            progressionData[c.id] = await stateSnapshot.getPowerProgression(projectId, c.id);
        }

        res.json({ characters: powerData, powerFramework, progressionData });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
        for (const t of types) {
            materialStats[t] = activeMaterials.filter(m => m.type === t).length;
        }

        const charStates = latestSnapshot?.characterStates || {};
        const activeChars = Object.values(charStates).filter(c => c.active !== false).length;
        const totalChars = Object.keys(charStates).length;

        const foreshadowingStates = latestSnapshot?.foreshadowingStates || {};
        const plantedForeshadowings = Object.values(foreshadowingStates).filter(f => f.status === 'planted').length;
        const urgentForeshadowings = Object.values(foreshadowingStates).filter(f => f.urgency > 70).length;

        res.json({
            projectId,
            totalChapters: chapters.length,
            totalMaterials: materials.length,
            activeMaterials: activeMaterials.length,
            materialStats,
            snapshotCount: snapshots.length,
            latestSnapshotChapter: latestSnapshot?.chapterNumber || 0,
            characterStats: { total: totalChars, active: activeChars },
            foreshadowingStats: { planted: plantedForeshadowings, urgent: urgentForeshadowings },
            consistencyStats: {
                totalReports: reports.length,
                latestChapter: latestReport?.chapterNumber || 0,
                latestPassed: latestReport?.passed || true,
                latestCriticalCount: latestReport?.criticalCount || 0
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
