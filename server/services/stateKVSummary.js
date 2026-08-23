const logger = require('../shared/logger');
const store = require('../store');
const { getCharacterStateSchema, formatStateForPrompt, applyStateDelta, normalizeDeltaKeys, buildLabelToKeyMap } = require('../config/characterStateSchemas');
const { KV_STORE_TYPE, STATE_STORE_TYPE, HOT_WINDOW, _makeKVId, _makeStateId, _inferType, getGenreImportantKeys, _deserializeValue, getCurrentChapter } = require('./stateKVHelpers');

async function generateBriefSummary(projectId, chapterNumber, genreId, maxChars = 2000) {
    const schema = getCharacterStateSchema(genreId);
    const hotIndex = await this.getHotIndex(projectId, chapterNumber, ['character']);
    const lines = [];
    const importantKeys = getGenreImportantKeys(genreId);
    const labelMap = buildLabelToKeyMap(genreId);

    for (const [entityKey, data] of Object.entries(hotIndex.character || {})) {
        const normalizedData = {};
        for (const [key, value] of Object.entries(data)) { normalizedData[labelMap[key] || key] = value; }
        const briefData = {};
        for (const key of importantKeys) {
            if (normalizedData[key] !== undefined) {
                const field = schema.fields[key];
                briefData[field ? field.label : key] = normalizedData[key];
            }
        }
        if (Object.keys(briefData).length > 0) {
            const name = normalizedData.name || await this.get(projectId, 'character', entityKey, 'name') || entityKey;
            delete briefData['名称']; delete briefData['name'];
            lines.push(`【${name}】${Object.entries(briefData).map(([k, v]) => `${k}=${v}`).join(', ')}`);
        }
    }
    const summary = lines.join('\n');
    return summary.length > maxChars ? summary.substring(0, maxChars) + '\n...（更多角色见详细模式）' : (summary || '无热点角色状态');
}

async function generateDetailedSummary(projectId, chapterNumber, genreId) {
    const schema = getCharacterStateSchema(genreId);
    const allChars = await this.getAllEntityStates(projectId, 'character');
    const lines = [];
    const labelMap = buildLabelToKeyMap(genreId);

    for (const [entityKey, data] of Object.entries(allChars)) {
        const normalizedData = {};
        for (const [key, value] of Object.entries(data)) { normalizedData[labelMap[key] || key] = value; }
        const formatted = formatStateForPrompt(normalizedData, schema, 'detailed');
        if (formatted) lines.push(`【${normalizedData.name || data.name || entityKey}】\n${formatted}`);
    }
    return lines.join('\n\n') || '无角色状态数据';
}

async function migrateChineseKeys(projectId, genreId) {
    const labelMap = buildLabelToKeyMap(genreId);
    const allItems = await store.queryItems(KV_STORE_TYPE, { projectId });
    let migrated = 0, deleted = 0;
    const chineseKeyPattern = /[\u4e00-\u9fff]/;

    for (const item of allItems) {
        const hasChineseDataKey = chineseKeyPattern.test(item.dataKey);
        const hasChineseEntityKey = chineseKeyPattern.test(item.entityKey);
        if (!hasChineseDataKey && !hasChineseEntityKey) continue;

        const newDataKey = labelMap[item.dataKey] || item.dataKey;
        if (hasChineseDataKey && !labelMap[item.dataKey]) {
            logger.warn('stateKVIndex', `[MIGRATE] No mapping for dataKey "${item.dataKey}", keeping as-is`);
        }
        const newItem = { ...item, dataKey: newDataKey };
        const newId = _makeKVId(projectId, item.scope, item.entityKey, newDataKey);
        newItem.id = newId;
        await store.setItem(KV_STORE_TYPE, newId, newItem);
        if (item.id !== newId) { await store.deleteItem(KV_STORE_TYPE, item.id); deleted++; }
        migrated++;
    }

    const allStates = await store.queryItems(STATE_STORE_TYPE, { projectId });
    let statesMigrated = 0;
    for (const state of allStates) {
        if (!state.delta || typeof state.delta !== 'object') continue;
        const normalizedDelta = normalizeDeltaKeys(state.delta, genreId);
        if (JSON.stringify(normalizedDelta) !== JSON.stringify(state.delta)) {
            state.delta = normalizedDelta;
            if (Array.isArray(state.stateChangedFields)) state.stateChangedFields = state.stateChangedFields.map(k => labelMap[k] || k);
            await store.setItem(STATE_STORE_TYPE, state.id, state);
            statesMigrated++;
        }
    }
    return { migrated, deleted, statesMigrated };
}

module.exports = { generateBriefSummary, generateDetailedSummary, migrateChineseKeys };
