/**
 * 角色状态管理路由（history/meta/sync/migrate）
 * 从characterStates.js拆分
 */

const router = require('express').Router();
const store = require('../store');
const stateKVIndex = require('../services/stateKVIndex');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;
const { getCharacterStateSchema, ROLE_LEVELS, GENRE_ROLE_STRATEGIES } = require('../config/characterStateSchemas');
const { detectGenre } = require('../services/genreConfig');

function resolveGenreId(styleProfile) {
    const genreObj = detectGenre(styleProfile || {});
    return genreObj?.id || null;
}

router.get('/history/:projectId/:characterId', async (req, res) => {
    try {
        const { projectId, characterId } = req.params;
        const { limit } = req.query;
        const states = await store.queryItems('character-states', { projectId, characterId });
        const sorted = states.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
        const limited = limit ? sorted.slice(-parseInt(limit)) : sorted;
        const result = limited.map(s => {
            let delta = {};
            try { delta = typeof s.delta === 'string' ? JSON.parse(s.delta) : s.delta; } catch { /* use raw */ }
            return { ...s, delta };
        });
        res.json(result);
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/meta/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const currentChapter = await stateKVIndex.getCurrentChapter(projectId);
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const genreId = resolveGenreId(project?.styleProfile);
        const schema = getCharacterStateSchema(genreId);
        const allKV = await store.queryItems('state-kv-index', { projectId });
        const allStates = await store.queryItems('character-states', { projectId });
        const chapters = await store.queryItems('chapters', { projectId });
        const maxChapter = chapters.length > 0
            ? Math.max(...chapters.map(c => c.chapterNumber || 0))
            : (project.currentChapter || 0);
        const chapterOptions = [];
        for (let i = 1; i <= maxChapter; i++) chapterOptions.push(i);
        const uniqueCharacters = new Set(allKV.filter(k => k.scope === 'character').map(k => k.entityKey));
        const uniqueWorldviews = new Set(allKV.filter(k => k.scope === 'worldview').map(k => k.entityKey));

        res.json({
            projectId, currentChapter, maxChapter, chapterOptions, genreId,
            genreLabel: schema.genre?.label || null,
            roleLevels: Object.values(ROLE_LEVELS).map(r => ({ key: r.key, label: r.label, icon: r.icon, color: r.color })),
            roleStrategies: GENRE_ROLE_STRATEGIES[genreId] || null,
            schemaFields: Object.entries(schema.fields).map(([key, f]) => ({ key, label: f.label, type: f.type, defaultValue: f.defaultValue, unit: f.unit || null })),
            stats: {
                totalKVEntries: allKV.length, totalStateRecords: allStates.length,
                uniqueCharacters: uniqueCharacters.size, uniqueWorldviewEntries: uniqueWorldviews.size,
                hotEntries: allKV.filter(k => k.isHot).length, totalChapters: chapters.length
            }
        });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/sync/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { fromChapter, toChapter } = req.body;
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const chapters = (await store.queryItems('chapters', { projectId }))
            .filter(ch => {
                if (fromChapter && ch.chapterNumber < parseInt(fromChapter)) return false;
                if (toChapter && ch.chapterNumber > parseInt(toChapter)) return false;
                return !!ch.materialManagerOutput;
            })
            .sort((a, b) => a.chapterNumber - b.chapterNumber);

        const results = [];
        for (const chapter of chapters) {
            try {
                await stateKVIndex.setCurrentChapter(projectId, chapter.chapterNumber);
                results.push({ chapter: chapter.chapterNumber, success: true });
            } catch (e) {
                results.push({ chapter: chapter.chapterNumber, success: false, error: e.message });
            }
        }
        res.json({ success: true, synced: results.filter(r => r.success).length, total: results.length, details: results });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/migrate-chinese-keys/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const genreId = resolveGenreId(project?.styleProfile);
        const result = await stateKVIndex.migrateChineseKeys(projectId, genreId);
        res.json({ success: true, genreId, ...result });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
