const { getGenrePlugin } = require('../../services/genreConfig');
const { getInitialMaterialTemplate } = require('../../config/characterFieldSpec');

const TYPE_LABELS = {
    'worldview': '世界观设定',
    'character': '人物卡',
    'equipment': '重要物品/工具',
    'relationship': '人物关系',
    'power-system': '力量/能力体系',
    'catchphrase': '金句/热梗',
    'famous-scene': '名场面',
    'growth-history': '成长史',
    'foreshadowing': '伏笔设计',
    'faction': '阵营/势力',
    'institution': '机构/组织',
    'character-combat': '角色战斗设定'
};

const DEFAULT_TYPES = ['worldview', 'character', 'relationship', 'famous-scene', 'catchphrase', 'foreshadowing'];

function buildTypeList(enrichedProfile) {
    const genrePlugin = getGenrePlugin(enrichedProfile);
    const mf = genrePlugin?.styleProfile?.materialFocus || {};
    const mr = genrePlugin?.materialRules || {};

    const activeTypes = mf.primary ? [...(mf.primary || []), ...(mf.secondary || [])] : DEFAULT_TYPES;
    const skipTypes = new Set(mf.skip || []);

    let typeListStr = '';
    for (const t of activeTypes) {
        if (skipTypes.has(t)) continue;
        const label = TYPE_LABELS[t] || t;
        const rule = mr[t] ? `（${mr[t]}）` : '';
        typeListStr += `- ${t}: ${label}${rule}\n`;
    }

    let skipNote = '';
    if (skipTypes.size > 0) {
        skipNote = `\n\n【禁止生成的素材类型】${[...skipTypes].map(t => `${t}(${TYPE_LABELS[t] || t})`).join('、')}——本题材不需要这些类型，不要生成！`;
    }

    return { typeListStr, skipNote, skipTypes, genreId: enrichedProfile?.genre };
}

function buildInitialMaterialSystemPrompt(typeListStr, skipNote, constraintInjection, styleInjection, genreId) {
    const characterTemplate = getInitialMaterialTemplate(genreId);

    return `你是一个小说素材库生成器。根据用户提供的小说需求和设定，生成完整的素材库。
${constraintInjection}${styleInjection}

请生成以下类型的素材，每个素材用JSON数组格式输出：
${typeListStr}
${skipNote}

重要规则：
1. content字段必须包含详细的素材内容，不要只写简短描述！
2. 角色类型(character)的content必须使用【标签】格式包含结构化字段，格式如下：
${characterTemplate}
3. 非角色类型的content自由发挥，但至少150字

输出格式（JSON数组，不要包含其他文字）：
[
  {
    "type": "素材类型",
    "name": "素材名称",
    "roleLevel": "protagonist|supporting|npc",
    "content": "详细内容描述（角色必须包含上述标签字段）"
  }
]`;
}

function parseMaterialResponse(responseText) {
    let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }
    const safeJson = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    return JSON.parse(safeJson);
}

module.exports = {
    TYPE_LABELS,
    DEFAULT_TYPES,
    buildTypeList,
    buildInitialMaterialSystemPrompt,
    parseMaterialResponse
};
