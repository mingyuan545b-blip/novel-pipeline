const logger = require('../shared/logger');
const store = require('../store');
const { getCharacterStateSchema, formatStateForPrompt, applyStateDelta, normalizeDeltaKeys, buildLabelToKeyMap } = require('../config/characterStateSchemas');
const { KV_STORE_TYPE, STATE_STORE_TYPE, HOT_WINDOW, _makeKVId, _makeStateId, _inferType, getGenreImportantKeys, _deserializeValue, getCurrentChapter } = require('./stateKVHelpers');
const { generateBriefSummary, generateDetailedSummary, migrateChineseKeys } = require('./stateKVSummary');

class StateKVIndex {
    async set(projectId, scope, entityKey, dataKey, value, chapterNumber) {
        const currentChapter = await getCurrentChapter(projectId);
        const id = _makeKVId(projectId, scope, entityKey, dataKey);
        await store.setItem(KV_STORE_TYPE, id, {
            id, projectId, scope, entityKey, dataKey,
            dataValue: typeof value === 'string' ? value : JSON.stringify(value),
            dataType: _inferType(value), chapterUpdated: chapterNumber,
            isHot: chapterNumber >= currentChapter - HOT_WINDOW ? 1 : 0,
            updatedAt: new Date().toISOString()
        });
    }

    async get(projectId, scope, entityKey, dataKey) {
        const id = _makeKVId(projectId, scope, entityKey, dataKey);
        const item = await store.getItem(KV_STORE_TYPE, id);
        if (!item) return undefined;
        return _deserializeValue(item);
    }

    async getEntityState(projectId, scope, entityKey) {
        const items = await store.queryItems(KV_STORE_TYPE, { projectId, scope, entityKey });
        const state = {};
        for (const item of items) { state[item.dataKey] = _deserializeValue(item); }
        return Object.keys(state).length > 0 ? state : null;
    }

    async getAllEntityStates(projectId, scope) {
        const items = await store.queryItems(KV_STORE_TYPE, { projectId, scope });
        const grouped = {};
        for (const item of items) {
            if (!grouped[item.entityKey]) grouped[item.entityKey] = {};
            grouped[item.entityKey][item.dataKey] = _deserializeValue(item);
        }
        return grouped;
    }

    async getHotIndex(projectId, currentChapter, scopes = ['character']) {
        const items = await store.queryItems(KV_STORE_TYPE, { projectId, isHot: 1 });
        const results = {};
        for (const scope of scopes) {
            const scopeItems = items.filter(i => i.scope === scope);
            results[scope] = {};
            for (const item of scopeItems) {
                if (!results[scope][item.entityKey]) results[scope][item.entityKey] = {};
                results[scope][item.entityKey][item.dataKey] = _deserializeValue(item);
            }
        }
        return results;
    }

    async updateCharacterState(projectId, characterId, characterName, chapterNumber, delta, genreId) {
        const schema = getCharacterStateSchema(genreId);
        const baseState = await this.getEntityState(projectId, 'character', characterId) || {};
        const normalizedDelta = {};
        for (const [key, value] of Object.entries(delta)) {
            normalizedDelta[key] = (value && typeof value === 'object' && 'from' in value && 'to' in value) ? value.to : value;
        }
        const newState = applyStateDelta(baseState, normalizedDelta);
        newState.name = characterName;
        for (const [key, value] of Object.entries(newState)) {
            if (key === 'stateChangedFields' || key === '_lastStateId') continue;
            await this.set(projectId, 'character', characterId, key, value, chapterNumber);
        }
        const storedDelta = {};
        for (const key of Object.keys(normalizedDelta)) { storedDelta[key] = { from: baseState[key], to: normalizedDelta[key] }; }
        const stateRecord = {
            id: _makeStateId(characterId, chapterNumber), projectId, characterId, characterName,
            chapterNumber, delta: storedDelta, stateChangedFields: Object.keys(normalizedDelta),
            previousChapterState: baseState._lastStateId || null, updatedAt: new Date().toISOString()
        };
        await store.setItem(STATE_STORE_TYPE, stateRecord.id, stateRecord);
        newState._lastStateId = stateRecord.id;
        await this.set(projectId, 'character', characterId, '_lastStateId', stateRecord.id, chapterNumber);
        return stateRecord;
    }

    async getLatestState(projectId, characterId, upToChapter) {
        const items = await store.queryItems(STATE_STORE_TYPE, { projectId, characterId });
        const states = items.filter(s => s.chapterNumber <= (upToChapter || Infinity)).sort((a, b) => a.chapterNumber - b.chapterNumber);
        let state = {};
        for (const s of states) {
            if (s.delta) {
                const flatDelta = {};
                for (const [key, change] of Object.entries(s.delta)) { if (change?.to !== undefined) flatDelta[key] = change.to; }
                state = applyStateDelta(state, flatDelta);
            }
        }
        state.name = state.name || items[0]?.characterName || '';
        return state;
    }

    async getStateHistory(projectId, characterId, fromChapter, toChapter) {
        const items = await store.queryItems(STATE_STORE_TYPE, { projectId, characterId });
        return items.filter(s => s.chapterNumber >= (fromChapter || 0) && s.chapterNumber <= (toChapter || Infinity)).sort((a, b) => a.chapterNumber - b.chapterNumber);
    }

    async generateBriefSummary(projectId, chapterNumber, genreId, maxChars) { return generateBriefSummary.call(this, projectId, chapterNumber, genreId, maxChars); }
    async generateDetailedSummary(projectId, chapterNumber, genreId) { return generateDetailedSummary.call(this, projectId, chapterNumber, genreId); }

    async updateAfterOperations(projectId, chapterNumber, operations) {
        const handledTypes = new Set(['updateCharacterState', 'updateCharacterTraits']);
        for (const op of operations) {
            if (handledTypes.has(op.type)) continue;
            if (['character', 'worldview', 'equipment'].includes(op.scope) && op.entityKey && op.data) {
                for (const [key, value] of Object.entries(op.data)) { await this.set(projectId, op.scope, op.entityKey, key, value, chapterNumber); }
            }
        }
    }

    /**
     * 陷阱#79防护：检查某章是否有character-states记录
     * 用于contractValidator的post-material校验
     */
    async hasChapterState(projectId, chapterNumber) {
        const items = await store.queryItems(KV_STORE_TYPE, { projectId, chapterUpdated: chapterNumber });
        return items.length > 0;
    }

    /**
     * Bug-2修复：标记某章的KV记录已被处理
     * 初始化时chapterUpdated=0，CH1 pipeline完成后需更新为1
     * 否则hasChapterState(ch1)返回false导致postMaterial校验误判
     */
    async markChapterProcessed(projectId, chapterNumber) {
        if (!chapterNumber || chapterNumber < 1) return;
        try {
            const items = await store.queryItems(KV_STORE_TYPE, { projectId });
            let updated = 0;
            for (const item of items) {
                if (item.chapterUpdated === 0 || item.chapterUpdated === null || item.chapterUpdated === undefined) {
                    item.chapterUpdated = chapterNumber;
                    item.isHot = chapterNumber >= (await getCurrentChapter(projectId)) - HOT_WINDOW ? 1 : 0;
                    await store.setItem(KV_STORE_TYPE, item.id, item);
                    updated++;
                }
            }
            if (updated > 0) {
                logger.info('stateKVIndex', `[Bug-2修复] 标记 ${updated} 条KV记录 chapterUpdated=${chapterNumber}`);
            }
        } catch (e) {
            logger.warn('stateKVIndex', `markChapterProcessed failed: ${e.message}`);
        }
    }

    async clearHotFlags(projectId, currentChapter) {
        const items = await store.queryItems(KV_STORE_TYPE, { projectId, isHot: 1 });
        for (const item of items) {
            if (item.chapterUpdated < currentChapter - HOT_WINDOW) { item.isHot = 0; await store.setItem(KV_STORE_TYPE, item.id, item); }
        }
    }

    async migrateChineseKeys(projectId, genreId) { return migrateChineseKeys(projectId, genreId); }
    async setCurrentChapter(projectId, chapterNumber) { await store.setItem('state-meta', `meta-${projectId}-currentChapter`, { id: `meta-${projectId}-currentChapter`, projectId, currentChapter: chapterNumber }); }
    async getCurrentChapter(projectId) { return getCurrentChapter(projectId); }
    _makeKVId = _makeKVId;
    _makeStateId = _makeStateId;
}

const _instance = new StateKVIndex();
module.exports = _instance;
