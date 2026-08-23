const { cleanChapterContent } = require('../../contentUtils');
const { saveAgentOutput } = require('../../fileOutput');
const { resolveGenreFromProject } = require('../../genreConfig');
const { scheduleMaterials } = require('../agentMaterialScheduler');
const { injectMaterials, buildCharacterByFormat } = require('../materialInjector');
const store = require('../../../store');

async function handlePolisher({ projectId, chapter, agentContext, runAgent, materials, project }) {
    const genre = resolveGenreFromProject(project);
    const scheduled = await scheduleMaterials('polisher', {
        projectId, chapter, materials: materials || [], ctx: {}, project, genre
    });
    const mats = scheduled.materials;

    // 角色简表段：通过声明式配置（characterFormat='simple'）自动选择buildCharacterBriefSection
    const charSec = buildCharacterByFormat(mats.character, 'polisher', '润色时保持一致');

    // 其余素材通过统一注入层注入（foreshadowFilter='none'已从声明读取）
    const materialAgentContext = { content: '' };
    injectMaterials(scheduled, materialAgentContext, {
        agentType: 'polisher',
        totalBudget: 3000,
    });

    agentContext.content = `请润色以下已通过审核的正文。

【规则】
1. 只做文采提升，不改变剧情/人物/设定/字数
2. 只输出润色后的正文，不输出任何分析、注释、说明、比较、思考过程
3. 不要逐段分析原文，不要标注修改了哪里，不要解释为什么这样改
4. 直接输出完整的润色后正文，格式与原文一致
${charSec}${materialAgentContext.content}

【正文】
${(chapter.content || '').substring(0, 8000)}`;

    const result = await runAgent('polisher', agentContext);
    chapter.polisherOutput = cleanChapterContent(result.response);
    saveAgentOutput(projectId, chapter, 'polisher', chapter.polisherOutput);
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapter.id, chapter);
    return { step: 'polisher', result, passed: true, chapter };
}

module.exports = { handlePolisher };
