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

/**
 * T6：深度缺口检测 —— 出场的角色必须有深度 Field 产出，
 * 否则那条角色的深度键要靠 materialDepthBackfill 从素材正文回填（可见、可统计）。
 * @returns {{gaps:Array<{name:string}>, total:number}}
 */
const DEPTH_NOTE_FIELDS = ['innerConflictNote', 'independentStanceNote', 'fateArcNote', 'protagonistMirrorNote'];

function collectDepthGaps(organizingPlan) {
    const chars = (organizingPlan && Array.isArray(organizingPlan.characters)) ? organizingPlan.characters : [];
    const appeared = chars.filter(c => c && c.appeared !== false && c.name);
    // 显式写「无变化」= 模型尽到了职责（不算缺口）；写「无」/留空 = 缺口
    const declared = (v) => typeof v === 'string' && v.trim().length > 0 && !/^(无|暂无|未知)$/.test(v.trim());
    const gaps = appeared
        .filter(c => !DEPTH_NOTE_FIELDS.some(f => declared(c[f])))
        .map(c => ({ name: c.name, roleLevel: c.roleLevel || 'npc' }));
    return { gaps, total: appeared.length, covered: appeared.length - gaps.length };
}

/** 深度缺口告警（不阻断：回填能兜，但必须留痕） */
function warnOnDepthGaps(organizingPlan, chapterNum) {
    const { gaps, total, covered } = collectDepthGaps(organizingPlan);
    if (gaps.length === 0 || total === 0) return { gaps: [], total, covered };
    logger.warn('materialOrganizer', `[T6] ch${chapterNum}: ${gaps.length}/${total} 名出场角色无深度字段产出（${gaps.slice(0, 8).map(g => g.name).join('、')}），将尝试素材正文回填`);
    return { gaps, total, covered };
}

module.exports = { warnOnEmptyOrganizingPlan, collectDepthGaps, warnOnDepthGaps, DEPTH_NOTE_FIELDS };
