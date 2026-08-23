/**
 * 角色状态摘要路由
 * 从characterStates.js拆分，处理summary端点
 */

const router = require('express').Router();
const store = require('../store');
const stateKVIndex = require('../services/stateKVIndex');
const { getCharacterStateSchema, buildLabelToKeyMap } = require('../config/characterStateSchemas');
const { detectGenre } = require('../services/genreConfig');
const { loadEntityFallback, buildSummaryFromEntities } = require('./characterStatesFallback');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

function resolveGenreId(styleProfile) {
    const genreObj = detectGenre(styleProfile || {});
    return genreObj?.id || null;
}

router.get('/summary/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapter, characterId } = req.query;

        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const genreId = resolveGenreId(project?.styleProfile);
        const chapterNum = chapter ? parseInt(chapter) : await stateKVIndex.getCurrentChapter(projectId);
        const schema = getCharacterStateSchema(genreId);

        if (characterId) {
            const entityState = await stateKVIndex.getEntityState(projectId, 'character', characterId);
            const labelMap = buildLabelToKeyMap(genreId);
            const normalizedData = {};
            if (entityState) {
                for (const [key, value] of Object.entries(entityState)) {
                    const mappedKey = labelMap[key] || key;
                    normalizedData[mappedKey] = value;
                }
            }

            const entityData = await loadEntityFallback(projectId, characterId, normalizedData);

            const name = entityData.name || characterId;
            const importantKeys = ['name', 'hp', 'combatPower', 'combatPowerLevel', 'position', 'factionName', 'speakingTone', 'personality', 'roleLevel'];
            const briefParts = [];
            for (const key of importantKeys) {
                if (entityData[key] !== undefined && key !== 'name' && entityData[key] !== '') {
                    const field = schema.fields[key];
                    const label = field ? field.label : key;
                    briefParts.push(`${label}=${entityData[key]}`);
                }
            }
            const briefSummary = `【${name}】${briefParts.join(', ')}`;
            const detailParts = [];
            for (const [key, value] of Object.entries(entityData)) {
                if (key === '_lastStateId' || key === 'stateChangedFields' || key === '_adapted' || value === '') continue;
                const field = schema.fields[key];
                const label = field ? field.label : key;
                detailParts.push(`${label}: ${value}`);
            }
            const detailedSummary = `【${name}】\n${detailParts.join('\n')}`;

            return res.json({ projectId, chapter: chapterNum, genreId, briefSummary, detailedSummary, source: entityState ? 'kv' : 'entity' });
        }

        let [briefSummary, detailedSummary] = await Promise.all([
            stateKVIndex.generateBriefSummary(projectId, chapterNum || 1, genreId),
            stateKVIndex.generateDetailedSummary(projectId, chapterNum || 1, genreId)
        ]);

        // 回退：KV摘要为空或详细摘要为空时从entity-registry构建
        let source = 'kv';
        const isEmptyDetailed = !detailedSummary || detailedSummary === '无角色状态数据';
        const isEmptyBrief = !briefSummary || briefSummary === '无热点角色状态' ||
            !briefSummary.match(/=[^,\s]/);
        if (isEmptyDetailed || (isEmptyBrief && isEmptyDetailed)) {
            const entitySummary = await buildSummaryFromEntities(projectId, schema);
            briefSummary = entitySummary.brief;
            detailedSummary = entitySummary.detailed;
            source = 'entity';
        }

        res.json({ projectId, chapter: chapterNum, genreId, briefSummary, detailedSummary, source });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
