/**
 * writingGuardSectionBuilder.js — 写作红线约束区统一构建器
 *
 * 解决问题：
 *  - writer/reviser 各自硬编码敏感词列表、方括号标签列表、系统交互UI化列表
 *  - 敏感词与 sensitiveWordGuard.js 重复定义，维护困难
 *  - 方括号标签/系统交互用枚举代替原则，LLM总能写出列表外变体
 *
 * 统一方案（遵循"禁止硬编码、统一来源、靠原则不靠枚举"）：
 *  - 敏感词：从 sensitiveWordGuard.SENSITIVE_WORDS 动态读取，禁止在本文件硬编码词表
 *  - 方括号标签：只讲原则（禁止任何【...】标签）+ 2-3个示例，不枚举
 *  - 系统交互：只讲原则（通过生理反应/感官体验呈现）+ 2-3个示例，不枚举
 */
const { SENSITIVE_WORDS } = require('../sensitiveWordGuard');

/**
 * 构建敏感词红线约束段（从统一来源动态生成）
 * @returns {string} 敏感词约束段
 */
function buildSensitiveWordSection() {
    const categories = [
        { key: 'political', label: '政治类' },
        { key: 'superstition', label: '迷信类' },
        { key: 'drug', label: '毒品类' },
        { key: 'sexual', label: '色情类', filterExplicit: true },
        { key: 'other_banned', label: '暴恐类' }
    ];

    const lines = [];
    for (const cat of categories) {
        const words = SENSITIVE_WORDS[cat.key];
        if (!words || words.length === 0) continue;

        let displayWords = words;
        // 色情类过滤过于露骨的词，只保留几个代表性的
        if (cat.filterExplicit) {
            displayWords = words.filter(w => ['做爱', '性交', '强奸', '猥亵', '淫荡', '淫乱', '色情', '嫖娼', '卖淫', '春药', '迷奸', '下药'].includes(w));
        }

        if (displayWords.length > 0) {
            lines.push(`- ${cat.label}：${displayWords.join('/')}`);
        }
    }

    return `\n【⚠️ 敏感词红线 - 绝对禁止，违反直接退回】
以下词汇在任何语境下（包括比喻、借代、形容）都禁止使用，系统会硬性拦截：
${lines.join('\n')}
写完后必须逐词搜索上述词汇，即使作为比喻也不允许（如"像邪教一样""仿佛吸毒般"），必须改用其他表达。`;
}

/**
 * 构建方括号标签红线约束段（原则引导，非枚举）
 * @returns {string} 方括号标签约束段
 */
function buildBracketTagSection() {
    return `\n【⚠️ 方括号标签红线 - 绝对禁止】
禁止在正文中使用任何【...】方括号标签格式。包括但不限于系统类标签（如【系统提示】）、叙事类标签（如【内心独白】）、游戏类标签（如【获得技能】）。
系统交互必须融入叙事，通过主角视网膜投影/内心独白/感官体验呈现，不得使用方括号标签。
写完后必须搜索"【"字符，如果出现任何【...】标签，必须全部改为叙事性描写。`;
}

/**
 * 构建系统交互叙事化红线约束段（原则引导，非枚举）
 * @returns {string} 系统交互约束段
 */
function buildSystemNarrativeSection() {
    return `\n【⚠️ 系统交互叙事化红线 - 禁止UI化写法】
系统交互必须通过主角的生理反应/感官体验/内心独白呈现，禁止UI化写法。
判定原则：如果展示了系统UI元素（弹出/显示/闪烁/提示音等UI动词+系统内容）或绕过主角感官直接注入信息（如"脑海中强行植入"），即为违规。
正确写法：通过主角的生理感受（头痛/耳鸣/汗毛倒竖/视觉异常）或内心独白呈现，让读者感受到主角的感官体验。
【写完后必须自检】逐句搜索正文中是否有任何计算机/软件/UI操作相关词汇（如"进度条""点击""复制""粘贴""面板""弹窗""按钮""菜单"等），如果出现，必须全部改为感官体验描写（如"罗盘发烫""指针骤停""一股充实感涌入丹田"）。`;
}

/**
 * 构建元叙事章回引用红线约束段（原则引导，非枚举）
 *
 * 背景（2026-10-09 跨界副本博弈建项实测根因）：`contentMetadataDetector` +
 * `firstReviewChecks.runHardBlockChecks` 会用 META_NARRATIVE_PATTERNS 硬拦截正文里的
 * "上一章/前一章/第X章"等元叙事引用（打破第四面墙），但 writer/reviser 提示词**从未声明**该规则
 * ——属于"只查不写"（约束被强制执行却未告知生成端），导致正文极易复现该词并被硬阻断、章节无法收敛。
 * 这里把规则落到唯一构建器，writer/reviser 同时生效。
 * @returns {string} 元叙事章回引用约束段
 */
function buildMetaNarrativeSection() {
    return `\n【⚠️ 元叙事章回引用红线 - 绝对禁止】
禁止在正文中出现任何指代"叙述层级"的元叙事词：上一章、前一章、下一章、本章、第X章、上回书等。
这类表达会打破第四面墙（角色/旁白跳到"章节"层面说话），系统会硬性拦截并直接退回。
需要表达"前情/往事/之前发生的事"时，必须改写为故事内的时间指代（如"此前""那晚""方才""上回在那片废墟里""三天前"），不得使用章节编号。
写完后必须搜索"上一章/前一章/下一章/本章/第X章"，如有必须全部改为故事内时间指代。`;
}

/**
 * 构建完整的写作红线约束区（敏感词+方括号+系统交互+元叙事引用）
 * @returns {string} 完整约束区
 */
function buildWritingGuardSection() {
    return `${buildSensitiveWordSection()}\n${buildBracketTagSection()}\n${buildSystemNarrativeSection()}\n${buildMetaNarrativeSection()}`;
}

module.exports = {
    buildSensitiveWordSection,
    buildBracketTagSection,
    buildSystemNarrativeSection,
    buildMetaNarrativeSection,
    buildWritingGuardSection
};
