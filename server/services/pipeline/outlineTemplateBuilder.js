/**
 * 大纲模板构建模块
 * 负责构建素材生成和章节大纲生成的AI prompt
 */

const { render, renderWithProject, resolve } = require('../../config/promptFragments');
const { TYPE_LABELS, TYPE_DESCS, TYPE_NAMING_RULES } = require('./outlineConstants');

function buildMaterialTypeList(primaryTypes, secondaryTypes, skipTypes, materialRules) {
    const activeTypes = [...primaryTypes, ...secondaryTypes].filter(t => !skipTypes.includes(t));
    const list = activeTypes.map(t => {
        const label = TYPE_LABELS[t] || t;
        const desc = TYPE_DESCS[t] || '详细描述，至少150字';
        const priority = primaryTypes.includes(t) ? '【必须生成】' : '【按需生成】';
        const rule = materialRules[t] ? `（${materialRules[t]}）` : '';
        const naming = TYPE_NAMING_RULES[t] ? `【命名规则】${TYPE_NAMING_RULES[t]}！` : '';
        return `- ${t}: ${label}——${desc}${rule} ${priority}\n  ${naming}`;
    }).join('\n');
    const skipNote = skipTypes.length > 0
        ? `\n\n【禁止生成的素材类型】${skipTypes.map(t => `${t}(${TYPE_LABELS[t] || t})`).join('、')}——本题材不需要！`
        : '';
    return list + skipNote;
}

const MATERIAL_SYSTEM_TEMPLATE = `你是一个小说素材库生成器。根据用户提供的小说需求和设定，生成完整的素材库。
{{CONSTRAINT_AND_STYLE}}

请生成以下类型的素材，每个素材用JSON数组格式输出：
{{TYPE_LIST}}

重要：content字段必须包含详细的素材内容，不要只写简短描述！

【角色素材分级要求——严格执行！】

⚠️ 格式硬约束：content字段必须使用【标签】格式，每个标签独占一行或一段，格式为"【标签名】内容"。禁止使用自由散文格式！系统会自动解析【标签】提取字段，缺少标签会导致角色数据不完整！

⭐ 主角（isMainCharacter: true）——必须包含以下全部标签，缺一不可，至少{{PROTAGONIST_WORD_COUNT}}字：
{{PROTAGONIST_TAGS}}
✅主角正确示例："{{PROTAGONIST_EXAMPLE}}"

🔷 配角（isMainCharacter: false, roleLevel: "supporting"）——必须包含以下标签，至少{{SUPPORTING_WORD_COUNT}}字：
{{SUPPORTING_TAGS}}
✅配角正确示例："{{SUPPORTING_EXAMPLE}}"

👤 NPC（isMainCharacter: false, roleLevel: "npc"）——只需以下标签，至少{{NPC_WORD_COUNT}}字：
{{NPC_TAGS}}
✅NPC正确示例："{{NPC_EXAMPLE}}"

❌错误示例："李四，配角，忠诚"——信息严重不足，且缺少【标签】格式

{{NAMING_TEMPLATE}}
{{FLAVOR_TEMPLATE}}

输出格式（JSON数组，不要包含其他文字）：
[
  {
    "type": "素材类型",
    "name": "素材名称",
    "content": "详细内容描述",
    "isMainCharacter": false,
    "roleLevel": "supporting"
  }
]`;

function buildMaterialSystemPrompt(genre, typeListStr, constraintAndStyleInjection) {
    const vars = resolve(genre);
    return MATERIAL_SYSTEM_TEMPLATE
        .replace('{{CONSTRAINT_AND_STYLE}}', constraintAndStyleInjection)
        .replace('{{TYPE_LIST}}', typeListStr)
        .replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : `{{${key}}}`);
}

async function buildMaterialSystemPromptWithProject(genre, typeListStr, constraintAndStyleInjection, projectId) {
    const vars = await require('../../config/promptFragments').resolveWithProject(genre, projectId);
    return MATERIAL_SYSTEM_TEMPLATE
        .replace('{{CONSTRAINT_AND_STYLE}}', constraintAndStyleInjection)
        .replace('{{TYPE_LIST}}', typeListStr)
        .replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : `{{${key}}}`);
}

function buildMaterialUserPrompt(project, userPrompt, genre) {
    const vars = require('../../config/promptFragments').resolve(genre);
    return `小说名称：${project.name}\n类型：${project.genre}\n描述：${project.description}\n\n用户需求：${userPrompt}\n\n【重要】character类型素材必须设置以下字段：\n1. isMainCharacter: 甜宠/言情/双强题材男女主都设为true（双主角），其他题材只有1个角色设为true\n2. roleLevel: 主角设为"protagonist"，重要配角设为"supporting"，其他设为"npc"。甜宠/言情题材男女主都设为"protagonist"\n3. 不同roleLevel的角色必须按照上方分级要求填写不同详细程度的内容！主角${vars.PROTAGONIST_WORD_COUNT}字+，配角${vars.SUPPORTING_WORD_COUNT}字+，NPC${vars.NPC_WORD_COUNT}字+${'\n\n'}${vars.NAMING_GUIDANCE}${'\n\n'}${vars.CRAFT_GUIDANCE}`;
}

// P1-4b 远景粗纲约束：规划一次覆盖 N 章时，后续章节的素材还没长出来，
// 写死细节必然与未来素材冲突（用户反馈的"前面设定都不同"根因之一）。
const FAR_OUTLINE_HINT = `【远景粗纲】本批是**远景规划**：只定主线走向、核心冲突、章末钩子，以及出场实体的**名字**；
不要写具体设定细节（数值/机制/专属道具外观/功法招式/独有名词等）——细节留待开写前按最新素材细化为"就近细纲"，以免与后续素材冲突。`;

function buildChapterOutlineSystemPrompt(genreInjection, styleInjection, rhythmGuidance, advisoryStr, targetCount, scope = 'far') {
    const scopeHint = scope === 'detail' ? '' : FAR_OUTLINE_HINT;
    return `你是一个小说章节大纲生成器。根据已有的素材库和已有章节，为小说生成章节大纲。
${genreInjection}
${styleInjection}
${rhythmGuidance}
${advisoryStr}
${scopeHint}
请生成第1章到第${targetCount}章的大纲。每章大纲300-500字，必须按四段节拍写：【场景1·铺垫】【场景2·核心冲突】【场景3·推进/转折】【场景4·章末钩子】；每段至少给出：地点、在场人物、关键动作或交锋、埋下/回收的伏笔。四段节拍合计要能支撑成稿2500-3000字（每段对应一个可展开的场景）。
输出格式（JSON数组）：
[{"chapterNumber": 1, "title": "章节标题", "outline": "章节大纲"}]`;
}

/**
 * P1-4b 素材投放策略：远景只给"名录"（name），细节（content）留到就近细纲再喂。
 * 规划一次覆盖 N 章时后续素材还没长出来，喂内容=逼模型把细节写死→与未来素材冲突。
 * @param {Array} materials 素材数组
 * @param {'far'|'detail'} scope far=名录（默认）；detail=带内容摘要（旧行为）
 */
function buildOutlineMaterialDigest(materials, scope = 'far') {
    const list = materials || [];
    if (scope === 'detail') {
        return list.slice(0, 30).map(m => `[${m.type}] ${m.name}: ${(m.currentContent || '').substring(0, 100)}`).join('\n');
    }
    return list.slice(0, 40).map(m => `[${m.type}] ${m.name}`).join('\n');
}

/** P1-4b 就近细纲：开写前用"此刻已归档的素材"把本章粗纲细化为可开写的计划 */
function buildNearOutlineSystemPrompt(genreInjection, styleInjection, chapterNumber) {
    return `你是一个小说章节**就近细纲**细化器。任务：把第${chapterNumber}章的远景粗纲，按"此刻已归档的最新素材"细化为可直接开写的本章计划。
${genreInjection}
${styleInjection}
要求：
1.【以素材为准】已归档素材是唯一真相；粗纲与素材冲突时**以素材为准**，并在 adjust 字段说明差异。
2.【不改主线】不得改变粗纲的主线走向与章末钩子目标，只补充具体场景与细节。
3.【四段节拍】按【场景1·铺垫】【场景2·核心冲突】【场景3·推进/转折】【场景4·章末钩子】写，合计300-500字；
  每段至少给出：地点、在场人物、关键动作或交锋、埋下/回收的伏笔。
4.【不得凭空造物】只使用已归档素材中出现过的人物/道具/设定；确需新增角色时用职位或称谓描述，不要新造专有名词。
输出格式（JSON对象）：
{"title": "章节标题", "outline": "本章细纲", "adjust": "与粗纲的差异说明（可空）"}`;
}

function buildSupplementOutlineSystemPrompt(genreInjection, styleInjection, startChapter, endChapter) {
    return `你是一个小说章节大纲补充器。根据已有素材和已有大纲，为小说补充新的章节大纲。
${genreInjection}
${styleInjection}
请生成第${startChapter}章到第${endChapter}章的大纲。每章大纲300-500字，必须按四段节拍写：【场景1·铺垫】【场景2·核心冲突】【场景3·推进/转折】【场景4·章末钩子】；每段至少给出：地点、在场人物、关键动作或交锋、埋下/回收的伏笔。四段节拍合计要能支撑成稿2500-3000字（每段对应一个可展开的场景）。
输出格式（JSON数组）：
[{"chapterNumber": ${startChapter}, "title": "章节标题", "outline": "章节大纲"}]`;
}

function buildTemplateSystemPrompt(params) {
    const { name, genre, elementStr, targetWords, targetChapters, style, tone, pov,
        setting, conflict, themes, styleInjection, constraintInjection,
        initGenreMaterialFocus, initGenreMaterialRules, initGenrePlugin } = params;

    const mf = initGenreMaterialFocus;
    const mr = initGenreMaterialRules;
    const DEFAULT_TYPES = ['worldview', 'character', 'relationship', 'foreshadowing', 'famous-scene', 'catchphrase'];
    const active = mf.primary ? [...(mf.primary || []), ...(mf.secondary || [])] : DEFAULT_TYPES;
    const skip = new Set(mf.skip || []);
    let materialLines = '【素材类型说明】\n';
    for (const t of active) {
        if (skip.has(t)) continue;
        const label = TYPE_LABELS[t] || t;
        const rule = mr[t] ? `（${mr[t]}）` : '';
        materialLines += `- ${t}: ${label}${rule}\n`;
    }
    if (skip.size > 0) {
        materialLines += `【禁止生成的素材类型】${[...skip].map(t => TYPE_LABELS[t] || t).join('、')}——本题材不需要！\n`;
    }

    const genreConstraintStr = initGenrePlugin?.foundation?.additionalConstraints?.length
        ? '\n【题材约束 - 必须遵守】\n' + initGenrePlugin.foundation.additionalConstraints.map(c => `- ${c.label}：${c.desc}`).join('\n')
        : '';
    const materialRulePrompt = mr.materialPrompt ? '\n' + mr.materialPrompt : '';
    const targetChapterCount = Math.min(targetChapters ?? 10, 30);

    return `你是一个顶级小说策划师。请根据以下模板信息，生成一套完整的小说设定体系。

【小说名称】${name}
【题材/类型】${genre}
${elementStr ? `【核心元素】${elementStr}` : ''}
${targetWords ? `【目标字数】${targetWords}字` : `【目标章节数】${targetChapters ?? 100}章`}
${style ? `【写作风格】${style}` : ''}${tone ? `【基调】${tone}` : ''}${pov ? `【叙事视角】${pov}` : ''}
${setting ? `【世界设定方向】${setting}` : ''}${conflict ? `【核心冲突】${conflict}` : ''}${themes ? `【主题】${themes}` : ''}
${styleInjection}
${constraintInjection}

请严格按照以下JSON格式输出，包含2个部分：
{"materials":[{"type":"素材类型","name":"素材名称","content":"详细内容（至少200字）","isMainCharacter":false}],"mainQuests":[{"title":"主线任务名","description":"任务描述（至少200字）","priority":"normal|high|critical","subQuests":[{"title":"子任务名","description":"子任务描述"}]}],"timeline":[{"title":"事件名","description":"事件描述","eventType":"plot|character|world|conflict|revelation|foreshadow|resolution","storyTime":"故事内时间","location":"地点","importance":"normal|high|critical","isKeyEvent":true}],"chapterOutlines":[{"chapterNumber":1,"title":"章节标题","outline":"章节大纲：200-500字"}]}

${materialLines}${materialRulePrompt}${genreConstraintStr}

【主线任务说明】设计3-5条主线任务，每条可包含2-4个子任务，任务之间应有逻辑关联。priority: 普通用normal，关键转折用high，核心主线用critical
【时间线说明】按故事发展顺序排列10-20个关键事件。eventType: plot/character/world/conflict/revelation/foreshadow/resolution。isKeyEvent标记重大影响事件
【章节大纲说明】生成${targetChapterCount}章的大纲，章节之间要连贯。每章大纲300-500字，必须按四段节拍写：【场景1·铺垫】【场景2·核心冲突】【场景3·推进/转折】【场景4·章末钩子】；每段至少给出：地点、在场人物、关键动作或交锋、埋下/回收的伏笔。四段节拍合计要能支撑成稿2500-3000字（每段对应一个可展开的场景）。

重要：只输出JSON，不要输出其他任何文字。content字段必须包含详细内容。`;
}

module.exports = {
    buildMaterialTypeList,
    buildMaterialSystemPrompt, buildMaterialSystemPromptWithProject,
    buildMaterialUserPrompt,
    buildChapterOutlineSystemPrompt, buildSupplementOutlineSystemPrompt, buildNearOutlineSystemPrompt,
    buildOutlineMaterialDigest,
    buildTemplateSystemPrompt
};
