/**
 * intentPromptBuilder.js — 意图规划器Prompt构建
 * 从chapterIntent.js提取，负责组装LLM输入
 */
const { getHookBudgetForProject } = require('./hookBudget');
const { getRuleStackForProject } = require('./ruleStack');
const { extractProhibitionRules } = require('./ruleStackExtractors');
const { getContextTraceForProject } = require('./contextTrace');
const { getDataContext } = require('./dataContext');
const { extractJSON } = require('./jsonUtils');
const { getReaderAdvisory, formatAdvisoryForIntent } = require('./pipeline/readerAdvisory');
const logger = require('../shared/logger');

function getVolumeSubplaneForChapter(projectId, chapterNumber) {
    const volume = Math.floor((chapterNumber - 1) / 30) + 1;
    try {
        const fs = require('fs');
        const path = require('path');
        const orderPath = path.join(__dirname, '..', '..', 'data', 'subplanes', 'volume-order.json');
        const order = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
        if (order && order.volumeOrder) {
            const entry = order.volumeOrder.find(v => v.volume === volume);
            if (entry) return entry;
        }
    } catch (e) { logger.warn('intentPromptBuilder', '[chapter-intent]', e.message || e); }
    return null;
}

async function buildMustKeepItems(ctx, chapterNumber, chapterScene, currentSubplaneId, isInSubplane) {
    const activeMaterials = (await ctx.getActiveMaterials()).filter(m => !m.isLocked);
    const coreCharacters = activeMaterials.filter(m => m.type === 'character').filter(m => {
        if (!m.parentPlane || m.parentPlane === '主世界') return true;
        if (isInSubplane) return m.parentPlane === currentSubplaneId;
        return false;
    });

    const mustKeepItems = [];
    const INTENT_BUDGET = 5000;
    let intentBudgetUsed = 0;
    const intentAppend = (text) => {
        if (intentBudgetUsed + text.length > INTENT_BUDGET) return false;
        mustKeepItems.push(text);
        intentBudgetUsed += text.length;
        return true;
    };

    for (const char of coreCharacters.slice(0, 6)) {
        try {
            let cacheStates = [];
            try { cacheStates = await ctx.getEntitiesForIntentPlanner(chapterNumber); } catch (_) { logger.warn('intentPromptBuilder', '[chapter-intent]', _.message || _); }
            const cached = cacheStates.find(cs => (cs.entityId || cs.characterId) === char.id);
            if (cached && (cached.text || cached.briefText)) {
                if (!intentAppend(`- ${char.name}: ${cached.text || cached.briefText}`)) break;
            } else {
                const content = (char.currentContent || char.initialContent || '').substring(0, 300);
                if (!intentAppend(`- ${char.name}: ${content}`)) break;
            }
        } catch (_) {
            const content = (char.currentContent || char.initialContent || '').substring(0, 300);
            if (!intentAppend(`- ${char.name}: ${content}`)) break;
        }
    }

    const ruleStack = getRuleStackForProject(ctx.projectId);
    const worldviewMats = activeMaterials.filter(m => m.type === 'worldview');
    for (const wv of worldviewMats.slice(0, 2)) {
        // 陷阱#24: 不能调用 ruleStack._extractProhibitionRules（不存在该方法）
        // 应直接使用 extractProhibitionRules 从 ruleStackExtractors 导入
        const rules = extractProhibitionRules(wv.currentContent || '', wv.name);
        for (const r of rules.slice(0, 2)) { if (!intentAppend(`- ${r.content}`)) break; }
    }

    const foreshadowMats = activeMaterials.filter(m => m.type === 'foreshadowing').filter(m => {
        if (!m.parentPlane || m.parentPlane === '主世界') return true;
        if (isInSubplane) return m.parentPlane === currentSubplaneId;
        return false;
    });
    for (const fs of foreshadowMats.slice(0, 3)) {
        const content = (fs.currentContent || fs.initialContent || '');
        if (content.includes('未回收') || content.includes('挂起') || content.includes('待回收')) {
            if (!intentAppend(`- 伏笔[${fs.name}]: ${content.substring(0, 150)}`)) break;
        }
    }

    const recentChapters = (await ctx.getChapters())
        .filter(c => c.chapterNumber < chapterNumber && c.readerOutput)
        .sort((a, b) => b.chapterNumber - a.chapterNumber).slice(0, 2);
    for (const rc of recentChapters) {
        try {
            const readerParsed = extractJSON(rc.readerOutput);
            if (readerParsed?.hardIssues?.length > 0) {
                const issueSummaries = readerParsed.hardIssues.slice(0, 3).map(i => `${i.type}: ${i.description}`).join('; ');
                if (!intentAppend(`- 阅读者反馈[Ch${rc.chapterNumber}]: ${issueSummaries.substring(0, 200)}`)) break;
            }
            if (readerParsed?.readerExperience && readerParsed.wantToContinue === false) {
                if (!intentAppend(`- 阅读者警告[Ch${rc.chapterNumber}]: ${readerParsed.readerExperience.substring(0, 150)}`)) break;
            }
        } catch (_) { logger.warn('intentPromptBuilder', '[chapter-intent]', _.message || _); }
    }

    const equipMats = activeMaterials.filter(m => m.type === 'equipment').filter(m => {
        if (!m.parentPlane || m.parentPlane === '主世界') return true;
        if (isInSubplane) return m.parentPlane === currentSubplaneId;
        return false;
    });
    for (const eq of equipMats.slice(0, 2)) {
        const content = (eq.currentContent || eq.initialContent || '').substring(0, 150);
        if (!intentAppend(`- 装备[${eq.name}]: ${content}`)) break;
    }

    return mustKeepItems;
}

function buildIntentPrompt(chapterOutline, prevChapterSummary, mustKeepItems, ruleStackText, hookAgendaText, readerAdvisoryText, povRule) {
    const povRuleSection = povRule ? `\n\n## 视角规则（意图规划必须遵守）\n${povRule}\n⚠️ mustAvoid中必须包含视角违规的防范项，如"禁止上帝视角解说他人心理""禁止数值化内心独白"\n` : '';
    return `你是一个小说章节意图规划器。根据以下信息，为本章生成结构化的写作意图。

## 本章大纲
${chapterOutline || '无大纲'}

## 上一章结尾摘要
${prevChapterSummary}

## Must Keep（必须保持的核心要素）
${mustKeepItems.join('\n') || '无特殊要求'}

## 规则栈
${ruleStackText}

## 伏笔预算与Hook Agenda
${hookAgendaText}

${readerAdvisoryText ? `## 阅读者建议（优先级规则见下方）\n${readerAdvisoryText}` : ''}${povRuleSection}

【三层优先级规则——必须遵守】
- L0 大纲层：主线走向、卷节奏、伏笔埋设/回收规划 → 不可轻易修改
- L1 阅读者硬伤约束：前后矛盾、逻辑断裂、人设崩塌、设定冲突、伏笔遗忘 → 强制避免，优先级高于L0细节
- L1 阅读者体验建议：节奏/风格/重复模式 → 尽量采纳，可覆盖L0细节但不可覆盖L0主线走向
- L2 意图执行层：goal/mustKeep/mustAvoid → 具体落地执行

冲突仲裁：
- 大纲说"推进剧情A" + 阅读者说"剧情A重复无聊" → 推进剧情A但换一种方式/角度/节奏，不是放弃A
- 大纲说"角色做X" + 阅读者说"角色OOC" → 角色仍然做X但补充合理动机，不是放弃X
- 阅读者说"wantToContinue=false" → 必须在本章做出明显改变，可以微调大纲走向

请生成JSON格式的章节意图，包含以下字段：
{
    "goal": "本章核心目标（1-2句话，必须具体可执行）",
    "mustKeep": ["必须保持的要素1", "必须保持的要素2"],
    "mustAvoid": ["必须避免的问题1", "必须避免的问题2"],
    "hookAdvance": ["必须推进的伏笔ID或描述"],
    "hookResolve": ["可以回收的伏笔ID或描述"],
    "styleEmphasis": "风格强调（如无特殊则为null）",
    "conflictDesign": "本章冲突设计（冲突类型+对立双方+赌注）",
    "chapterEndHook": "章末钩子设计（悬念/反转/新威胁）",
    "readerConcerns": "基于阅读者反馈的注意事项（如无阅读者反馈则为null）",
    "outlineAdjustment": "是否需要微调大纲走向及原因（如不需要则为null）"
}

要求：
1. goal必须具体，不能是"推进剧情"这种空话
2. mustKeep至少包含2条核心角色/设定约束
3. mustAvoid必须包含阅读者hardIssues对应的问题（如果有）
4. hookAdvance必须包含至少1条（如果有mustAdvance的伏笔）
5. conflictDesign必须明确冲突的对立双方和赌注
6. chapterEndHook必须设计具体的章末悬念
7. 如果阅读者有hardIssues，readerConcerns必须总结并给出应对策略
8. 如果阅读者wantToContinue=false，outlineAdjustment必须说明如何微调大纲走向`;
}

module.exports = { getVolumeSubplaneForChapter, buildMustKeepItems, buildIntentPrompt };
