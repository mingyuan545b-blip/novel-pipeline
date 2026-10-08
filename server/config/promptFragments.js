const { detectGenre, getGenreById } = require('../services/genreConfig');
const namingQualitySpec = require('../services/namingQualitySpec');
const { buildCraftGuidance } = require('../services/craftQualitySpec');

const CREATION_STANDARDS_TEMPLATE = `【素材创作标准（新建素材必须满足）——按角色等级差异化！】
- ⭐ 主角(character + roleLevel:"protagonist"): 必须包含以下全部标签，至少{{PROTAGONIST_WORD_COUNT}}字：
  {{PROTAGONIST_TAGS}}
- 🔷 配角(character + roleLevel:"supporting"): 必须包含以下标签，至少{{SUPPORTING_WORD_COUNT}}字：
  {{SUPPORTING_TAGS}}
- 👤 NPC(character + roleLevel:"npc"): 只需以下标签，至少{{NPC_WORD_COUNT}}字：
  {{NPC_TAGS}}
- 世界观(worldview): {{WORLDVIEW_RULE}}
{{WORLDVIEW_TEMPLATE}}
- 战力体系(power-system): {{POWER_SYSTEM_RULE}}
- 伏笔(foreshadowing): {{FORESHADOWING_RULE}}
不满足标准的素材将在日志中标记为校验未通过。
{{NAMING_TEMPLATE}}
{{FLAVOR_TEMPLATE}}
{{SUPPORTING_WRITER_PRINCIPLES}}`;

/**
 * R1：把注册表要求的字段标签并入题材标签，保证"校验端要什么、生成端 prompt 就说什么"。
 * 此前题材 tags 缺【标志性细节/人格魅力/…】→ 校验端永远判缺失（P0-B）。
 */
function mergeRequiredTags(existingTags, requiredTags) {
    const out = [...(existingTags || [])];
    const seen = new Set(out.map(t => (String(t).match(/【([^】]+)】/) || [])[1]).filter(Boolean));
    for (const t of requiredTags || []) {
        const label = (String(t).match(/【([^】]+)】/) || [])[1];
        if (label && !seen.has(label)) { out.push(t); seen.add(label); }
    }
    return out;
}

function resolve(genreId) {
    const genre = getGenreById(genreId);
    const cp = genre?.characterProfile || {};
    const mr = genre?.materialRules || {};
    const { promptFieldTags } = require('./fieldRegistry');

    return {
        PROTAGONIST_TAGS: mergeRequiredTags(cp.protagonistTags, promptFieldTags('protagonist')).join('\n'),
        PROTAGONIST_WORD_COUNT: cp.protagonistWordCount || 400,
        PROTAGONIST_EXAMPLE: cp.protagonistExample || '',
        SUPPORTING_TAGS: mergeRequiredTags(cp.supportingTags, promptFieldTags('supporting')).join('\n'),
        SUPPORTING_WORD_COUNT: cp.supportingWordCount || 250,
        SUPPORTING_EXAMPLE: cp.supportingExample || '',
        NPC_TAGS: mergeRequiredTags(cp.npcTags, promptFieldTags('npc')).join('\n'),
        NPC_WORD_COUNT: cp.npcWordCount || 80,
        NPC_EXAMPLE: cp.npcExample || '',
        WORLDVIEW_RULE: mr.worldview || '必须包含 边界条件 + 违反后果',
        POWER_SYSTEM_RULE: mr['power-system'] || '必须包含 升级条件 + 代价/限制',
        FORESHADOWING_RULE: mr.foreshadowing || '必须包含 预期回收窗口 + 关联角色',
        SUPPORTING_WRITER_PRINCIPLES: cp.supportingWriterPrinciples || '',
        SUPPORTING_ORGANIZER_DIMENSIONS: cp.supportingOrganizerDimensions || '',
        SUPPORTING_TRACKING_FIELDS: cp.supportingTrackingFields || [],
        SUPPORTING_REGISTRAR_NOTE_FIELDS: cp.supportingRegistrarNoteFields || [],
        IS_DEPTH_PROFILE: !!(cp.supportingWriterPrinciples),
        WORLDVIEW_TEMPLATE: cp.worldviewTemplate || '',
        NAMING_TEMPLATE: cp.namingTemplate || '',
        FLAVOR_TEMPLATE: cp.flavorTemplate || '',
        // 2026-10-08：命名与人物工艺的判定标准（单一源在 namingQualitySpec / craftQualitySpec）
        NAMING_GUIDANCE: namingQualitySpec.buildNamingGuidance(namingQualitySpec.inferEraKey(genreId)),
        CRAFT_GUIDANCE: buildCraftGuidance(),
    };
}

/**
 * 从项目实体中心提取角色素材内容，用作示例替代
 * 核心防污染机制：用项目实际角色数据替代题材插件的硬编码示例
 * 避免LLM将模板示例当作"标准答案"导致review误判
 */
async function resolveWithProject(genreId, projectId) {
    const baseVars = resolve(genreId);

    if (!projectId) return baseVars;

    try {
        const store = require('../store');
        const entities = await store.queryItems('entity-registry', { projectId });
        if (!entities || entities.length === 0) return baseVars;

        const protagonist = entities.find(e => e.roleLevel === 'protagonist' || e.isMainCharacter);
        const supporting = entities.find(e => e.roleLevel === 'supporting' && !e.isMainCharacter);

        if (protagonist && protagonist.content && protagonist.content.length > 50) {
            baseVars.PROTAGONIST_EXAMPLE = protagonist.content;
        }
        if (supporting && supporting.content && supporting.content.length > 30) {
            baseVars.SUPPORTING_EXAMPLE = supporting.content;
        }
    } catch (_) {
        // 静默失败，回退到格式骨架
    }

    return baseVars;
}

function render(template, genreId) {
    const vars = resolve(genreId);
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
    });
}

async function renderWithProject(template, genreId, projectId) {
    const vars = await resolveWithProject(genreId, projectId);
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
    });
}

function renderForStyleProfile(template, styleProfile) {
    const genreId = detectGenre(styleProfile || {});
    return render(template, genreId);
}

function buildCreationStandards(genreId) {
    return render(CREATION_STANDARDS_TEMPLATE, genreId);
}

async function buildCreationStandardsWithProject(genreId, projectId) {
    return renderWithProject(CREATION_STANDARDS_TEMPLATE, genreId, projectId);
}

module.exports = {
    CREATION_STANDARDS_TEMPLATE,
    resolve,
    resolveWithProject,
    render,
    renderWithProject,
    renderForStyleProfile,
    buildCreationStandards,
    buildCreationStandardsWithProject
};
