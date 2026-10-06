/**
 * 大纲实体同步模块
 * 负责将AI生成的角色素材同步到entityCenter和stateKVIndex
 */

const logger = require('../../shared/logger');
const store = require('../../store');
const entityCenter = require('../entityCenter');
const stateKVIndex = require('../../services/stateKVIndex');
const { getCharacterStateSchema } = require('../../config/characterStateSchemas');
const { resolveGenreFromProject } = require('../../services/genreConfig');
const { getDataContext } = require('../dataContext');
const { extractCharacterStateFromContent } = require('./outlineResponseParser');
const { resolveMaterialName } = require('./materialNameResolver');
const { buildCharacterEntityPatch } = require('./entityProjection');

async function syncCharacterToEntityCenter(projectId, mat, materialId) {
    try {
        const ctx = await getDataContext(projectId);
        const proj = await ctx.getProject();
        const pName = proj?.styleProfile?.protagonistName || '';
        const isProtag = mat.isMainCharacter || (pName && mat.name === pName);
        const roleLevel = isProtag ? 'protagonist' : (mat.roleLevel || 'npc');

        // 从素材content中解析结构化字段
        // 陷阱：素材对象把正文存在 currentContent/initialContent，旧代码只读 mat.content
        // → 补全后的素材/回填路径解析到空字符串，实体工艺字段全空（用户反馈"角色卡空壳"）。
        const content = mat.content || mat.currentContent || mat.initialContent || '';
        const parsed = extractCharacterStateFromContent(content, {});

        // 单一投影（P1-D）：字段清单集中在 entityProjection，占位/空值不覆盖已有好数据。
        // 人物工艺字段/深层字段此前各写一份清单，任一漏项 → 实体字段空。
        const patch = buildCharacterEntityPatch(mat, parsed);
        patch.roleLevel = roleLevel;
        patch.sourceChapter = null;
        patch.sourceContent = content.substring(0, 2000);
        if (Array.isArray(mat.tags)) patch.tags = mat.tags;

        const entity = await entityCenter.getOrCreateEntity(projectId, 'character', resolveMaterialName(mat), patch);
        // 返回实体 id：KV 状态（含深度字段）统一以实体 id 为键，与全部读取路径一致
        return entity?.id || null;
    } catch (err) {
        logger.warn('outlineEntitySync', '[OUTLINE] EntityCenter sync failed for', mat.name, ':', err.message);
        return null;
    }
}

async function initCharacterKVState(projectId, entityId, mat) {
    try {
        const ctx = await getDataContext(projectId);
        const proj = await ctx.getProject();
        const genre = resolveGenreFromProject(proj);
        const schema = getCharacterStateSchema(genre?.id || null);
        const pName = proj?.styleProfile?.protagonistName || '';
        const isProtag = mat.isMainCharacter || (pName && mat.name === pName);
        const roleLevel = isProtag ? 'protagonist' : (mat.roleLevel || 'npc');
        const initialState = { name: resolveMaterialName(mat), roleLevel, ...extractCharacterStateFromContent(mat.content || '', schema) };
        for (const [key, value] of Object.entries(initialState)) {
            if (key === 'stateChangedFields' || key === '_lastStateId') continue;
            await stateKVIndex.set(projectId, 'character', entityId, key, value, 0);
        }
        await stateKVIndex.set(projectId, 'character', entityId, '_lastStateId', `cs-${entityId}-ch0`, 0);
        logger.info('outlineEntitySync', `[OUTLINE] Initialized KV state for "${mat.name}" (${Object.keys(initialState).length} fields)`);
    } catch (err) {
        logger.warn('outlineEntitySync', '[OUTLINE] KV state init failed for', mat.name, ':', err.message);
    }
}

async function autoSetProtagonistName(projectId, materials) {
    const protagonist = materials.find(m => m.type === 'character' && m.isMainCharacter);
    if (!protagonist?.name) return;
    try {
        const ctx = await getDataContext(projectId);
        const proj = await ctx.getProject();
        if (!proj) return;
        if (!proj.styleProfile) proj.styleProfile = {};
        if (!proj.styleProfile.protagonistName || proj.styleProfile.protagonistName === '主角') {
            proj.styleProfile.protagonistName = protagonist.name;
            await store.setItem('projects', projectId, proj);
            logger.info('outlineEntitySync', `[OUTLINE] Auto-set protagonistName="${protagonist.name}"`);
        }
    } catch (e) {
        logger.warn('outlineEntitySync', '[OUTLINE] Failed to auto-set protagonistName:', e.message);
    }
}

module.exports = { syncCharacterToEntityCenter, initCharacterKVState, autoSetProtagonistName };
