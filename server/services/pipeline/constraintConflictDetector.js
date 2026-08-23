/**
 * constraintConflictDetector.js — 约束冲突检测
 * 优先级：entity(3) > genre(2) > global(1)
 * 冲突时高优先级覆盖低优先级，记录冲突日志
 *
 * 冲突模式配置已拆分到 constraintConflictPatterns.js（单一数据源，消除硬编码）
 */
const { CONSTRAINT_PRIORITY } = require('./agentDeclarations');
const { CONFLICT_PATTERNS } = require('./constraintConflictPatterns');
const logger = require('../../shared/logger');

/**
 * 检测约束冲突
 * @param {object} params
 * @param {string} params.projectId
 * @param {object} params.entityRules - 实体级行为规则 {name, rules}
 * @param {object} params.genreRules - 题材级规则 {key, content}
 * @param {object} params.globalRules - 全局级规则 {key, content}
 * @returns {object} { conflicts: [], resolved: {}, log: [] }
 */
function detectConflicts({ projectId, entityRules, genreRules, globalRules }) {
    const conflicts = [];
    const resolved = {};
    const log = [];

    const entity = entityRules?.content || '';
    const genre = genreRules?.content || '';
    const global = globalRules?.content || '';

    for (const pattern of CONFLICT_PATTERNS) {
        const entityMatch = pattern.entity.test(entity);
        const genreMatch = pattern.genre.test(genre);
        if (entityMatch && genreMatch) {
            const conflict = {
                tag: pattern.tag,
                entitySnippet: _extractSnippet(entity, pattern.entity),
                genreSnippet: _extractSnippet(genre, pattern.genre),
                resolution: 'entity_wins',
                reason: `实体级约束(优先级3)覆盖题材级约束(优先级2)`,
            };
            conflicts.push(conflict);
            log.push(`[CONFLICT] ${pattern.tag}: entity="${conflict.entitySnippet}" vs genre="${conflict.genreSnippet}" → entity wins`);
        }
        const genreEntityConflict = pattern.entity.test(genre) && pattern.genre.test(entity);
        if (genreEntityConflict) {
            const conflict = {
                tag: pattern.tag + '(反向)',
                entitySnippet: _extractSnippet(entity, pattern.genre),
                genreSnippet: _extractSnippet(genre, pattern.entity),
                resolution: 'entity_wins',
                reason: `实体级约束(优先级3)覆盖题材级约束(优先级2)`,
            };
            conflicts.push(conflict);
            log.push(`[CONFLICT] ${pattern.tag}(反向): entity="${conflict.entitySnippet}" vs genre="${conflict.genreSnippet}" → entity wins`);
        }
    }

    if (global && entity) {
        const globalEntityConflicts = _detectKeywordOverlap(global, entity);
        for (const gc of globalEntityConflicts) {
            conflicts.push({
                tag: '全局vs实体重叠',
                entitySnippet: gc.entityPart,
                globalSnippet: gc.globalPart,
                resolution: 'entity_wins',
                reason: `实体级约束(优先级3)覆盖全局级约束(优先级1)`,
            });
        }
    }

    resolved.behaviorRules = entity || genre || global || '';
    resolved.source = entity ? 'entity' : (genre ? 'genre' : (global ? 'global' : 'none'));

    if (conflicts.length > 0) {
        logger.info('conflictDetector', `Detected ${conflicts.length} constraint conflicts for project ${projectId}`, {
            value1: conflicts.map(c => c.tag).join(', ')
        });
    }

    return { conflicts, resolved, log };
}

/**
 * 构建最终约束文本（已解决冲突）
 * @param {object} params - 同detectConflicts
 * @returns {string} 最终约束文本
 */
function buildResolvedConstraints(params) {
    const { conflicts, resolved } = detectConflicts(params);
    if (!resolved.behaviorRules) return '';
    const prefix = resolved.source === 'entity'
        ? '【角色行为规则（实体级·最高优先级）】'
        : resolved.source === 'genre'
            ? '【题材行为规则（题材级）】'
            : '【全局行为规则（全局级）】';
    return `${prefix}\n${resolved.behaviorRules}`;
}

/**
 * 从文本中提取匹配snippet
 */
function _extractSnippet(text, pattern) {
    const match = text.match(pattern);
    return match ? match[0] : '';
}

/**
 * 检测全局和实体约束的关键词重叠
 */
function _detectKeywordOverlap(globalText, entityText) {
    const overlaps = [];
    const keyPhrases = [
        /禁止[^。\n]{2,20}/g,
        /必须[^。\n]{2,20}/g,
        /不得[^。\n]{2,20}/g,
    ];
    for (const regex of keyPhrases) {
        const globalMatches = globalText.match(regex) || [];
        const entityMatches = entityText.match(regex) || [];
        for (const gm of globalMatches) {
            for (const em of entityMatches) {
                if (_similarity(gm, em) > 0.4 && gm !== em) {
                    overlaps.push({ globalPart: gm, entityPart: em });
                }
            }
        }
    }
    return overlaps;
}

/** 简单文本相似度 */
function _similarity(a, b) {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = [...setA].filter(c => setB.has(c)).length;
    return intersection / Math.max(setA.size, setB.size);
}

module.exports = {
    detectConflicts,
    buildResolvedConstraints,
    CONSTRAINT_PRIORITY,
};
