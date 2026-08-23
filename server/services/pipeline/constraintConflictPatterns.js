'use strict';

/**
 * constraintConflictPatterns.js — 运行时约束冲突模式配置（单一数据源）
 *
 * 从 constraintConflictDetector.js 拆分，职责：定义 entity/genre/global 三级冲突模式
 * 消除硬编码（陷阱：禁止硬编码业务关键词）
 *
 * 冲突优先级：entity(3) > genre(2) > global(1)
 * 冲突时高优先级覆盖低优先级
 */

const CONFLICT_PATTERNS = Object.freeze([
    {
        entity: /对外冷酷|对外疏离|对外强势/,
        genre: /对外沉稳|对外有距离感|对外有原则/,
        tag: '角色行为风格',
    },
    {
        entity: /霸道|强势|冷酷/,
        genre: /沉稳|温和|有原则/,
        tag: '霸总vs非霸总',
    },
    {
        entity: /第一人称|我视角/,
        genre: /第三人称|上帝视角/,
        tag: '视角冲突',
    },
    {
        entity: /禁止.*幽默|严肃/,
        genre: /幽默|搞笑|喜剧/,
        tag: '基调冲突',
    },
]);

module.exports = { CONFLICT_PATTERNS };
