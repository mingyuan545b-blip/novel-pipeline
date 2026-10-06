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

        // 人物工艺字段：素材正文里已有【人格魅力】【哲学观】【金句库】【出场设计】【高光场景】
        // 等标签，旧代码只映射 3 个浅字段 → 全部丢失。此处统一映射，空值不覆盖已有数据。
        const craft = {
            charisma: mat.charisma || parsed.charisma || '',
            philosophy: mat.philosophy || parsed.philosophy || '',
            entranceDesign: mat.entranceDesign || parsed.entranceDesign || '',
            highlightScenes: mat.highlightScenes || parsed.highlightScenes || [],
            craftStyle: mat.craftStyle || parsed.craftStyle || '',
            quoteLibrary: mat.quoteLibrary || parsed.quoteLibrary || [],
        };

        await entityCenter.getOrCreateEntity(projectId, 'character', resolveMaterialName(mat), {
            roleLevel, sourceChapter: null,
            position: mat.position || parsed.position || '',
            factionName: mat.factionName || parsed.factionName || '',
            personality: mat.personality || parsed.personality || '',
            speakingTone: mat.speakingTone || parsed.speakingTone || '',
            signatureDetail: mat.signatureDetail || parsed.signatureDetail || '',
            ...craft,
            tags: Array.isArray(mat.tags) ? mat.tags : undefined,
            sourceContent: content.substring(0, 2000),
            profile: {
                appearance: mat.appearance || parsed.appearance || '',
                background: mat.background || parsed.background || '',
                motivation: mat.motivation || parsed.motivation || '',
                desire: parsed.desire || '',
                fear: parsed.fear || '',
                lie: parsed.lie || '',
                trauma: parsed.trauma || '',
                innerConflict: parsed.innerConflict || '',
                fateArc: parsed.fateArc || '',
            }
        });
    } catch (err) {
        logger.warn('outlineEntitySync', '[OUTLINE] EntityCenter sync failed for', mat.name, ':', err.message);
    }
}

async function initCharacterKVState(projectId, materialId, mat) {
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
            await stateKVIndex.set(projectId, 'character', materialId, key, value, 0);
        }
        await stateKVIndex.set(projectId, 'character', materialId, '_lastStateId', `cs-${materialId}-ch0`, 0);
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
