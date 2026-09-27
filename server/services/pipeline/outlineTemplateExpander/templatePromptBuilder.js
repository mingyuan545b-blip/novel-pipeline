const { getGenrePlugin } = require('../../genreConfig');

const ALL_MATERIAL_DESCRIPTIONS = {
    'worldview': '世界观设定（详细描述世界背景、规则、历史、势力分布，至少500字）',
    'character': '主要人物卡（每个角色详细描述外貌、性格、能力、背景、动机，至少300字/角色，生成5-8个主要角色）',
    'equipment': '重要装备/道具（描述名称、品级、能力、来源，至少200字/件，生成3-5件）',
    'relationship': '人物关系网（描述角色间的关系和羁绊，至少300字，生成2-3组关系）',
    'power-system': '战力体系（详细描述等级划分、突破条件、能力特征、修炼方式，至少500字）',
    'catchphrase': '金句/热梗（创造5-8个经典台词或网络梗）',
    'famous-scene': '名场面（描述3-5个高光剧情场景，至少200字/场景）',
    'growth-history': '主角成长史（描述主角从弱到强的完整成长路线，至少400字）',
    'foreshadowing': '伏笔设计（设计5-8个伏笔，描述埋设时机和回收计划，至少150字/个）',
    'faction': '阵营/势力（描述势力特征、目标、关系，至少200字）',
    'character-combat': '角色战斗设定（描述角色战斗能力、招式、风格，至少150字）',
};

function buildMaterialSection(descriptions, allowedTypes, skipSet) {
    const entries = Object.entries(descriptions).filter(([type]) => {
        if (skipSet.has(type)) return false;
        if (allowedTypes && !allowedTypes.includes(type)) return false;
        return true;
    });
    if (entries.length === 0) {
        return Object.entries(descriptions).filter(([type]) => !skipSet.has(type)).map(([type, desc]) => `- ${type}: ${desc}`).join('\n');
    }
    return entries.map(([type, desc]) => `- ${type}: ${desc}`).join('\n');
}

function buildTemplatePrompt(config) {
    const { name, genre, elements, targetChapters, targetWords, style, tone, pov, setting, conflict, themes, styleInjection, constraintInjection, projectMode, genrePlugin } = config;
    const elementList = elements ? elements.split(/[,，、\s]+/).filter(Boolean) : [];
    const elementStr = elementList.length > 0 ? elementList.map(e => `"${e}"`).join('、') : '';

    const mf = genrePlugin?.styleProfile?.materialFocus;
    const genreMaterialTypes = mf ? [...(mf.primary || []), ...(mf.secondary || [])] : null;
    const skipTypes = new Set(mf?.skip || []);
    const materialSection = buildMaterialSection(ALL_MATERIAL_DESCRIPTIONS, genreMaterialTypes, skipTypes);

    return `你是一个顶级小说策划师。请根据以下模板信息，生成一套完整的小说设定体系。

【小说名称】${name}
【题材/类型】${genre}
${elementStr ? `【核心元素】${elementStr}` : ''}
${targetWords ? `【目标字数】${targetWords}字` : `【目标章节数】${targetChapters ?? 100}章`}
${style ? `【写作风格】${style}` : ''}
${tone ? `【基调】${tone}` : ''}
${pov ? `【叙事视角】${pov}` : ''}
${setting ? `【世界设定方向】${setting}` : ''}
${conflict ? `【核心冲突】${conflict}` : ''}
${themes ? `【主题】${themes}` : ''}
${styleInjection}
${constraintInjection}

请严格按照以下JSON格式输出，包含2个部分：

{
  "materials": [
    {"type": "素材类型", "name": "素材名称", "content": "详细内容（至少200字）"}
  ],
  "mainQuests": [
    {"title": "主线任务名", "description": "任务描述（至少200字）", "priority": "normal|high|critical", "subQuests": [
      {"title": "子任务名", "description": "子任务描述"}
    ]}
  ],
  "timeline": [
    {"title": "事件名", "description": "事件描述", "eventType": "plot|character|world|conflict|revelation|foreshadow|resolution", "storyTime": "故事内时间", "location": "地点", "importance": "normal|high|critical", "isKeyEvent": true/false}
  ],
  "chapterOutlines": [
    {"chapterNumber": 1, "title": "章节标题", "outline": "章节大纲：200-500字"}
  ]
}

【素材类型说明】
${materialSection}
${genrePlugin?.foundation?.additionalConstraints?.length ? '\n【题材约束 - 必须遵守】\n' + genrePlugin.foundation.additionalConstraints.map(c => `- ${c.label}：${c.desc}`).join('\n') : ''}

【主线任务说明】
- 设计3-5条主线任务，每条可包含2-4个子任务
- 任务之间应有逻辑关联，形成完整的剧情推进链
- priority: 普通任务用normal，关键转折用high，核心主线用critical

【时间线说明】
- 按故事发展顺序排列10-20个关键事件
- eventType: plot(剧情转折)、character(人物变化)、world(世界观揭示)、conflict(冲突爆发)、revelation(真相揭示)、foreshadow(伏笔埋设)、resolution(冲突解决)
- isKeyEvent: 对剧情走向有重大影响的事件标记为true
- storyTime: 用故事内的时间描述，如"故事开始"、"修炼第三天"、"大战前夕"

【章节大纲说明】
- 生成${Math.min(targetChapters ?? 10, 30)}章的大纲
- 每章大纲300-500字，必须按四段节拍写：【场景1·铺垫】【场景2·核心冲突】【场景3·推进/转折】【场景4·章末钩子】；每段至少给出：地点、在场人物、关键动作或交锋、埋下/回收的伏笔。四段节拍合计要能支撑成稿2500-3000字（每段对应一个可展开的场景）。
- 章节之间要连贯，推动剧情发展

重要：只输出JSON，不要输出其他任何文字。content字段必须包含详细内容。`;
}

module.exports = { buildTemplatePrompt, ALL_MATERIAL_DESCRIPTIONS };
