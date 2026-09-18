'use strict';

/**
 * materialOrganizerGuards.js — 素材整理师产出质量守卫（从 materialOrganizer.js 拆出，2026-09-18）
 *
 * 陷阱#90防护：空 organizingPlan 会连锁导致
 *   - material-registrar 无操作 → character_states 表 0 条
 *   - knowledgeChanges 为空 → 限知数据不生成
 *   - 角色素材无深度字段
 * 另：relationshipChanges 是人物关系网的唯一生产端，为空则关系网永远建不起来（长篇必崩项）。
 * 一律只告警不阻断（某些章节确实无角色变化）。
 */
const logger = require('../../../shared/logger');

function warnOnEmptyOrganizingPlan(organizingPlan, chapterNum) {
    if (!organizingPlan) {
        logger.error('materialOrganizer', `[trap#90] ch${chapterNum}: organizingPlan为null（JSON解析失败或LLM未输出有效JSON）`);
        return;
    }
    const charCount = Array.isArray(organizingPlan.characters) ? organizingPlan.characters.length : 0;
    const kcCount = Array.isArray(organizingPlan.knowledgeChanges) ? organizingPlan.knowledgeChanges.length : 0;
    const relCount = (organizingPlan.characters || [])
        .reduce((sum, c) => sum + (Array.isArray(c.relationshipChanges) ? c.relationshipChanges.length : 0), 0);

    if (charCount >= 2 && relCount === 0) {
        logger.warn('materialOrganizer', `[relation] ch${chapterNum}: 本章有${charCount}名角色但relationshipChanges为空，人物关系网将无法建立`);
    }
    if (charCount === 0 && kcCount === 0) {
        logger.warn('materialOrganizer', `[trap#90] ch${chapterNum}: organizingPlan为空（characters=0, knowledgeChanges=0），可能导致下游character_states/knowledge_access无数据`);
    } else if (charCount === 0) {
        logger.warn('materialOrganizer', `[trap#90] ch${chapterNum}: characters为空，可能遗漏角色状态更新`);
    } else if (kcCount === 0) {
        logger.warn('materialOrganizer', `[trap#90] ch${chapterNum}: knowledgeChanges为空，可能遗漏限知认知变化记录`);
    }
}

module.exports = { warnOnEmptyOrganizingPlan };
