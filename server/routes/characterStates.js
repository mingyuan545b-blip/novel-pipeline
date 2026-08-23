const router = require('express').Router();
const store = require('../store');
const stateKVIndex = require('../services/stateKVIndex');
const { getCharacterStateSchema, ROLE_LEVELS, GENRE_ROLE_STRATEGIES, getFieldsForRoleLevel, buildLabelToKeyMap } = require('../config/characterStateSchemas');
const { detectGenre } = require('../services/genreConfig');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

function resolveGenreId(styleProfile) {
    const genreObj = detectGenre(styleProfile || {});
    return genreObj?.id || null;
}

router.get('/states/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapter } = req.query;
        const chapterNum = chapter ? parseInt(chapter) : null;

        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const genreId = resolveGenreId(project?.styleProfile);
        const schema = getCharacterStateSchema(genreId);

        const states = await store.queryItems('character-states', { projectId });
        const sortedStates = states.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

        let filteredStates = sortedStates;
        if (chapterNum) {
            filteredStates = sortedStates.filter(s => s.chapterNumber === chapterNum);
        }

        const result = filteredStates.map(s => {
            let delta = {};
            try { delta = typeof s.delta === 'string' ? JSON.parse(s.delta) : s.delta; } catch { /* use raw */ }
            let changedFields = [];
            try { changedFields = typeof s.stateChangedFields === 'string' ? JSON.parse(s.stateChangedFields) : s.stateChangedFields; } catch { /* use raw */ }

            return {
                ...s,
                delta,
                stateChangedFields: changedFields,
                fieldLabels: Object.fromEntries(changedFields.map(f => [f, schema.fields[f]?.label || f]))
            };
        });

        res.json(result);
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/characters/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapter } = req.query;
        const chapterNum = chapter ? parseInt(chapter) : null;

        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const genreId = resolveGenreId(project?.styleProfile);
        const targetChapter = chapterNum || (await stateKVIndex.getCurrentChapter(projectId)) || 1;
        const schema = getCharacterStateSchema(genreId);

        const hotIndex = await stateKVIndex.getHotIndex(projectId, targetChapter, ['character']);
        const labelMap = buildLabelToKeyMap(genreId);
        const characters = [];

        for (const [entityKey, data] of Object.entries(hotIndex.character || {})) {
            const normalizedData = {};
            for (const [key, value] of Object.entries(data)) {
                const mappedKey = labelMap[key] || key;
                normalizedData[mappedKey] = value;
            }
            const roleLevel = normalizedData.roleLevel || 'npc';
            const trackedFields = getFieldsForRoleLevel(genreId, roleLevel);
            const roleInfo = ROLE_LEVELS[roleLevel] || ROLE_LEVELS.npc;

            const stateValues = {};
            for (const [key, value] of Object.entries(normalizedData)) {
                const field = schema.fields[key];
                stateValues[key] = {
                    label: field ? field.label : key,
                    value,
                    type: field ? field.type : typeof value
                };
            }

            characters.push({
                entityKey,
                name: normalizedData.name || entityKey,
                roleLevel,
                roleLabel: roleInfo.label,
                roleIcon: roleInfo.icon,
                roleColor: roleInfo.color,
                chapterUpdated: normalizedData._chapterUpdated || targetChapter,
                isHot: normalizedData._isHot || false,
                stateValues,
                importantFields: trackedFields
                    .filter(k => normalizedData[k] !== undefined)
                    .map(k => ({ key: k, label: schema.fields[k]?.label || k, value: normalizedData[k] }))
            });
        }

        res.json({ projectId, chapter: targetChapter, characters });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/kv/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { scope, entityKey, isHot } = req.query;

        const project = await store.getItem('projects', projectId);
        const genreId = project ? resolveGenreId(project?.styleProfile) : null;
        const labelMap = genreId ? buildLabelToKeyMap(genreId) : {};

        const filters = { projectId };
        if (scope) filters.scope = scope;
        if (entityKey) filters.entityKey = entityKey;
        if (isHot !== undefined) filters.isHot = parseInt(isHot);

        const items = await store.queryItems('state-kv-index', filters);

        const grouped = {};
        for (const item of items) {
            const key = `${item.scope}:${item.entityKey}`;
            if (!grouped[key]) grouped[key] = { scope: item.scope, entityKey: item.entityKey, fields: {} };
            let dataValue = item.dataValue;
            try {
                if (item.dataType === 'number') dataValue = Number(dataValue);
                else if (item.dataType === 'boolean') dataValue = dataValue === 'true';
                else if (item.dataType === 'object' || item.dataType === 'array') dataValue = JSON.parse(dataValue);
            } catch { /* parse optional */ }
            const displayKey = labelMap[item.dataKey] || item.dataKey;
            grouped[key].fields[displayKey] = {
                value: dataValue,
                dataType: item.dataType,
                chapterUpdated: item.chapterUpdated,
                isHot: item.isHot
            };
        }

        res.json(Object.values(grouped));
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
