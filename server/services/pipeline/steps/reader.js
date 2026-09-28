const store = require('../../../store');
const { saveAgentOutput } = require('../../fileOutput');
const { assembleMaterialState } = require('../materialStateAssembler');
const { injectMaterials, buildCharacterByFormat } = require('../materialInjector');
const { resolveGenreFromProject } = require('../../genreConfig');
const { getDataContext } = require('../../dataContext');

async function handleReader({ projectId, chapter, materials, agentContext, runAgent }) {
    const chapterNum = chapter.chapterNumber;
    const readStart = Math.max(1, chapterNum - 14);
    const readEnd = chapterNum;
    const ctx = await getDataContext(projectId);
    const allChaptersForRead = (await ctx.getChapters())
        .filter(c => !c.archived)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

    const recentChapters = allChaptersForRead.filter(c => c.chapterNumber >= readStart && c.chapterNumber <= readEnd && c.content);
    const nextOutlines = allChaptersForRead.filter(c => c.chapterNumber > readEnd && c.chapterNumber <= readEnd + 5)
        .map(c => `第${c.chapterNumber}章 ${c.title}: ${(c.outline || '').substring(0, 200)}`).join('\n');
    const baseChapters = allChaptersForRead.filter(c => c.chapterNumber >= 1 && c.chapterNumber <= 8 && c.content);

    let readerContent = '【基底章节（第1-8章，不可修改）摘要】\n';
    readerContent += baseChapters.length > 0
        ? baseChapters.map(c => `第${c.chapterNumber}章 ${c.title}: ${(c.normalContent || c.content || '').substring(0, 200)}`).join('\n')
        : '（无基底章节）';

    readerContent += '\n\n【本次阅读章节（近15章已完成正文摘要）】\n';
    readerContent += recentChapters.map(c => `=== 第${c.chapterNumber}章 ${c.title} ===\n${(c.normalContent || c.content || '').substring(0, 800)}`).join('\n\n');

    readerContent += nextOutlines ? `\n\n【后续5章大纲】\n${nextOutlines}` : '\n\n【后续5章大纲暂无]';

    // 通过调度器+materialInjector统一加载素材（声明式配置：characterFormat='reader', foreshadowFilter='active'）
    let materialAgentContext = { content: '' };
    try {
        const ctx = await getDataContext(projectId);
        const project = await ctx.getProject();
        const genre = resolveGenreFromProject(project);
        const scheduled = await assembleMaterialState('reader', {
            projectId, chapter, materials, ctx, project, genre
        });
        // 角色段通过声明式配置自动选择buildCharacterReaderSection（name:content极简格式）
        const charSec = buildCharacterByFormat(scheduled.materials.character, 'reader', '参考');
        // 其余素材（relationship/foreshadowing）通过统一注入层注入
        injectMaterials(scheduled, materialAgentContext, {
            agentType: 'reader',
            totalBudget: 2000,
        });
        if (charSec) readerContent += charSec;
        if (materialAgentContext.content) readerContent += materialAgentContext.content;
    } catch (_) { /* fallback to empty materials */ }

    readerContent += `

【你是真实读者——核心原则】
1. 你是花钱看书的真实读者，只关注跨章节的硬伤问题
2. 你的独特价值是发现单章审核无法发现的问题：前后矛盾、连续比喻重复、行为逻辑跳跃、设定前后不一致
3. 单章内的问题初审/复审已经检查过，你不需要重复报告
4. 必须引用原文作为证据，不能凭空指控
5. 前8章是基底不可修改

【输出格式 - 严格JSON】
{"chapterRange":"第X章-第Y章","hardIssues":[{"type":"contradiction|logic-flaw|character-break|setting-conflict|foreshadow-forgot|repetition-pattern","chapter":0,"location":"","description":"","evidence":"","fixSuggestion":""}],"readerExperience":"","overallScore":0,"wantToContinue":true/false}

【硬伤判断标准——只有以下跨章节情况才算hardIssue】
- 前后矛盾：第A章明确说了X，第B章却说了相反的Y
- 逻辑断裂：事件发生毫无因果，读者无法理解为什么
- 人设崩塌：角色行为严重偏离已建立的性格，且没有合理解释
- 设定冲突：能力体系/世界观规则前后不一致
- 伏笔遗忘：已埋伏笔在应回收时完全未被提及
- 连续重复：连续3章以上使用相同比喻/句式/场景结构

【不算硬伤——不要放进hardIssues】
- 单章内的术语/视角问题 → 初审/复审已检查
- 文笔不够好 → 不是跨章节问题
- 你个人不喜欢的剧情走向 → 不是问题`;

    agentContext.content = readerContent;
    const result = await runAgent('reader', agentContext);
    chapter.readerOutput = result.response;
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapter.id, chapter);
    saveAgentOutput(projectId, chapter, 'reader', result.response);
    return { step: 'reader', result, passed: true, chapter };
}

module.exports = { handleReader };
