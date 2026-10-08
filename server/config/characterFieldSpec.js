/**
 * characterFieldSpec.js — 角色字段统一规范
 * 定义：每个角色需要什么字段、什么题材要什么额外字段、谁生产、谁消费
 *
 * 设计原则：
 * 1. 字段分三层：基础层(所有角色) → 角色等级层(主角/配角/NPC) → 题材层(题材特有)
 * 2. 每个字段有明确的生产者(谁写入)和消费者(谁读取)
 * 3. 素材源头(initialMaterialGenerator)必须输出结构化字段，不能只写纯文本
 */

const { GENRE_FIELD_OVERRIDES } = require('./characterFieldGenreOverrides');

// ═══════════════════════════════════════════════════════════
// 第一层：基础字段 — 所有角色都必须有
// ═══════════════════════════════════════════════════════════
const BASE_FIELDS = {
    name: {
        label: '角色名', type: 'string', required: true,
        producers: ['initial-material', 'material-organizer'],
        consumers: ['all-agents', 'entity-center', 'frontend']
    },
    roleLevel: {
        label: '角色等级', type: 'enum', enum: ['protagonist', 'supporting', 'npc'],
        required: true, defaultValue: 'npc',
        producers: ['initial-material', 'material-organizer'],
        consumers: ['all-agents', 'entity-center', 'frontend']
    },
    position: {
        label: '职位/身份', type: 'string', required: true,
        producers: ['initial-material', 'material-organizer'],
        consumers: ['writer', 'reviser', 'reviewer', 'frontend']
    },
    personality: {
        label: '性格', type: 'string', required: true,
        producers: ['initial-material', 'material-organizer'],
        consumers: ['writer', 'reviser', 'reviewer', 'frontend']
    },
    speakingTone: {
        label: '说话语气', type: 'string', required: true,
        producers: ['initial-material', 'material-organizer'],
        consumers: ['writer', 'reviser', 'frontend']
    },
    signatureDetail: {
        label: '标志性细节', type: 'string', required: true,
        producers: ['initial-material', 'material-organizer'],
        consumers: ['writer', 'reviser', 'frontend']
    },
    factionName: {
        label: '阵营/所属', type: 'string', required: false,
        producers: ['initial-material', 'material-organizer'],
        consumers: ['writer', 'frontend']
    },
    briefText: {
        label: '一句话简介', type: 'string', required: false,
        producers: ['initial-material', 'material-organizer'],
        consumers: ['frontend']
    },
    summaryText: {
        label: '摘要', type: 'string', required: false,
        producers: ['material-organizer'],
        consumers: ['writer', 'reviewer', 'frontend']
    },
};

// ═══════════════════════════════════════════════════════════
// 第二层：角色等级字段 — 主角/配角额外字段
// ═══════════════════════════════════════════════════════════
const ROLE_LEVEL_FIELDS = {
    protagonist: {
        catchphrases: { label: '口头禅', type: 'array', required: false, producers: ['material-organizer'], consumers: ['writer'] },
        motivation: { label: '核心动机', type: 'string', required: true, producers: ['initial-material'], consumers: ['writer', 'reviser', 'intent-planner'] },
        innerConflict: { label: '内在矛盾', type: 'string', required: false, producers: ['material-organizer'], consumers: ['writer', 'reviser'] },
        background: { label: '身世/背景', type: 'string', required: true, producers: ['initial-material'], consumers: ['writer', 'intent-planner'] },
        behaviorRules: { label: '行为规则', type: 'string', required: true, producers: ['genre-plugin', 'entity-center'], consumers: ['writer', 'reviser', 'reviewer', 'final-editor'] },
    },
    supporting: {
        protagonistMirror: { label: '主角镜像', type: 'string', required: false, producers: ['material-organizer'], consumers: ['writer', 'reviser'] },
        independentStance: { label: '独立立场', type: 'string', required: false, producers: ['material-organizer'], consumers: ['writer', 'reviser'] },
        fateArc: { label: '命运弧光', type: 'string', required: false, producers: ['material-organizer'], consumers: ['writer', 'intent-planner'] },
        catchphrases: { label: '口头禅', type: 'array', required: false, producers: ['material-organizer'], consumers: ['writer'] },
    },
    npc: {}
};

// ═══════════════════════════════════════════════════════════
// 生产者-消费者映射
// ═══════════════════════════════════════════════════════════
const PRODUCERS = {
    'initial-material': { label: '初始素材生成器', description: '大纲阶段创建角色时，必须输出结构化字段', produces: ['name', 'roleLevel', 'position', 'personality', 'speakingTone', 'signatureDetail', 'factionName', 'briefText', 'motivation', 'background'] },
    'material-organizer': { label: '素材整理归类师', description: '每章素材整理时，补充和更新角色字段', produces: ['personalityNote', 'speakingToneNote', 'signatureDetailNote', 'catchphraseNote', 'protagonistMirrorNote', 'independentStanceNote', 'fateArcNote', 'innerConflictNote', 'summaryText'] },
    'genre-plugin': { label: '题材插件', description: '根据题材注入行为规则和题材特有字段', produces: ['behaviorRules', 'genreState'] },
    'entity-center': { label: '实体中心', description: '统一管理实体CRUD，同步字段到registry', produces: ['behaviorRules', 'roleLevel', 'lifecycleState'] },
};

const CONSUMERS = {
    'writer': { label: '执笔', needs: ['name', 'roleLevel', 'position', 'personality', 'speakingTone', 'signatureDetail', 'behaviorRules', 'genreState', 'factionName', 'catchphrases'] },
    'reviser': { label: '返修', needs: ['name', 'roleLevel', 'position', 'personality', 'speakingTone', 'signatureDetail', 'behaviorRules'] },
    'reviewer': { label: '审核', needs: ['name', 'roleLevel', 'position', 'personality', 'speakingTone', 'behaviorRules'] },
    'intent-planner': { label: '意图规划', needs: ['name', 'roleLevel', 'position', 'personality', 'motivation', 'background', 'fateArc'] },
    'final-editor': { label: '定稿', needs: ['name', 'roleLevel', 'position', 'personality', 'speakingTone', 'behaviorRules'] },
    'frontend': { label: '前端UI', needs: ['name', 'roleLevel', 'position', 'personality', 'speakingTone', 'signatureDetail', 'factionName', 'appearCount', 'lastAppearChapter', 'lifecycleState'] },
};

// ═══════════════════════════════════════════════════════════
// 查询函数
// ═══════════════════════════════════════════════════════════

function getRequiredFields(roleLevel, genreId) {
    const fields = { ...BASE_FIELDS };
    if (ROLE_LEVEL_FIELDS[roleLevel]) {
        for (const [key, spec] of Object.entries(ROLE_LEVEL_FIELDS[roleLevel])) {
            if (spec.required) fields[key] = spec;
        }
    }
    const override = GENRE_FIELD_OVERRIDES[genreId];
    if (override) {
        for (const f of override.extraPromptFields || []) {
            if (f.required) fields[f.key] = { label: f.label, type: 'string', required: true };
        }
    }
    return Object.fromEntries(Object.entries(fields).filter(([, s]) => s.required));
}

function getInitialMaterialTemplate(genreId) {
    const override = GENRE_FIELD_OVERRIDES[genreId];
    const note = override?.characterPromptNote || '';
    const extraFields = (override?.extraPromptFields || []).map(f =>
        `    【${f.label}】${f.required ? '（必填）' : '（如有）'}`
    ).join('\n');
    return `角色素材content必须包含以下结构化字段（用【标签】格式）：
    【身份/职位】（必填）
    【性格】（必填，至少一个关键词）
    【说话语气】（必填，如：冷淡/温柔/尖刻/犹豫等）
    【标志性细节】（必填，如：习惯动作/随身物品/外貌特征等）
    【阵营/所属】（如有）
    【核心动机】（主角必填，配角如有）
    【身世/背景】（主角必填，配角如有）
${extraFields ? extraFields + '\n' : ''}${note ? '    题材要求：' + note + '\n' : ''}    其余自由发挥，但上述标签字段必须出现且不能为空`;
}

function getOrganizerFieldHints(roleLevel) {
    const base = [
        '"personalityNote": "本章表现出的性格特征（必填，至少一个关键词）"',
        '"speakingToneNote": "说话语气特征（必填，如：冷淡/温柔/尖刻/犹豫等）"',
        '"signatureDetailNote": "标志性细节（必填，如：习惯动作/随身物品/外貌特征等）"',
    ];
    if (roleLevel === 'protagonist') {
        // T6：主角的深度字段由"（如有）"改为**必填**（空着才是例外，必须显式写"无变化"）
        base.push('"catchphraseNote": "口头禅/标志性语句（如有）"', '"innerConflictNote": "本章内在矛盾（必填；确实无变化则写「无变化」）"');
    } else if (roleLevel === 'supporting') {
        // T6：配角三个深度字段同样改为必填（契约 anyOf 深度键依赖它们）
        base.push('"protagonistMirrorNote": "与主角的镜像对比（必填；确实无变化则写「无变化」）"', '"independentStanceNote": "独立立场表达（必填；确实无变化则写「无变化」）"', '"fateArcNote": "命运弧光推进（必填；确实无变化则写「无变化」）"');
    } else {
        base.push('"catchphraseNote": "口头禅（如有）"');
    }
    return base;
}

function getFieldValidationRules(roleLevel, genreId) {
    const required = getRequiredFields(roleLevel, genreId);
    return Object.entries(required).map(([key, spec]) => ({
        field: key, label: spec.label, required: true, emptyAllowed: false,
    }));
}

module.exports = {
    BASE_FIELDS, ROLE_LEVEL_FIELDS, GENRE_FIELD_OVERRIDES,
    PRODUCERS, CONSUMERS,
    getRequiredFields, getInitialMaterialTemplate,
    getOrganizerFieldHints, getFieldValidationRules,
};
