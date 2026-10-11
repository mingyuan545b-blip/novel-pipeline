'use strict';

/**
 * dataFlowSpecSupplement — 数据流规范补充条目（从 dataFlowSpec.js 拆出，守单文件 ≤200 行）
 *
 * 背景（2026-10-11 根因修复）：intent-planner / consistency-constraint 是 KNOWN_STEP_KEYS 与
 * 契约 STEP_ORDER 里的真实步骤，但 dataFlowSpec 缺条目（S8「与真实步骤对齐」遗漏）。
 * 一致性闸门 checkDataFlowSpec 此前只遍历 StepRegistry 已迁移步骤 → 未迁移步骤漏检。
 */
const SUPPLEMENT_SPEC = {
    'intent-planner': {
        label: '意图规划', description: '规划本章写作意图（目标/冲突/情绪曲线），作为执笔的上游输入（P1-4 就近细纲）',
        inputs: [
            { name: 'projectId', source: 'PUSH', from: 'API调用', required: true, format: 'string' },
            { name: 'chapter', source: 'PUSH', from: 'store.getItem("chapters")', required: true, format: 'object' },
            { name: 'materials', source: 'PUSH', from: 'materialIndex', required: true, format: 'array' },
            { name: 'project', source: 'PULL', from: 'DataContext.getProject()', required: true, format: 'object' },
            { name: 'genre', source: 'PULL', from: 'DataContext.getGenre()', required: true, format: 'object|null' },
        ],
        outputs: [{ name: 'chapter.intent', format: 'object', description: '章节意图（goal/conflict/emotionalArc/sceneBeats）' }],
        downstream: ['writer'], pollutionRisk: '意图与大纲/素材脱节，或把后续章细节提前写死（规划超前）', missingDataAction: '规划失败时 writer 回退按大纲直接创作'
    },
    'consistency-constraint': {
        label: '一致性约束', description: '检查整章与项目约束、前后章事实的一致性（STEP_ORDER 末位）',
        inputs: [
            { name: 'chapter', source: 'PUSH', from: 'store.getItem("chapters")', required: true, format: 'object' },
            { name: 'chapter.content', source: 'PUSH', from: 'writer/polisher输出', required: true, format: 'string' },
            { name: 'project', source: 'PULL', from: 'DataContext.getProject()', required: true, format: 'object' },
            { name: 'constraints', source: 'PULL', from: 'consistencyStore.getConstraints()', required: false, format: 'array' },
        ],
        outputs: [
            { name: 'chapter.consistencyOutput', format: 'string', description: '一致性检查结果' },
            { name: 'constraints', format: 'array', description: '命中的一致性约束列表' },
        ],
        downstream: [], pollutionRisk: '凭幻觉报出跨章矛盾', missingDataAction: 'chapter.content为空时跳过检查'
    }
};

module.exports = { SUPPLEMENT_SPEC };
