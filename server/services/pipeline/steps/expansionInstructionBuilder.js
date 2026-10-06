/**
 * expansionInstructionBuilder.js — 扩写指令统一构建器（唯一判定源）
 *
 * 根因背景（2026-09-06云端E2E实测 + 08-27本地RUN3同症状）：
 * 字数退回后，writer/reviser收到的扩写指令含糊（"扩展每个场景"/"必须扩充"），
 * flash/27B级模型不会自主扩足，出现三轮退回平台期（2157→2170→2170）。
 * 对策：显式数学量（差多少字/至少新增多少字）+ 结构化扩写清单 + 输出前自查。
 *
 * 消费方（两套系统对齐原则，禁止各自硬编码扩写话术）：
 * - writerPromptBuilder._appendRoundContext（writer重试轮）
 * - reviserPrompt.buildReviserContext（reviser返修轮）
 */

/** 统一字数统计口径：去空白字符（与门禁/审核一致） */
function countWords(text) {
    return (text || '').replace(/\s/g, '').length;
}

// 结构化扩写手法（唯一源）：首轮指令与扩写指令共用，保证"第1轮就按可救区的结构写满"
const EXPANSION_METHODS = Object.freeze([
    '1. 对话扩写：选正文中2处关键对话，各增加1-2轮往返，配动作、表情与符合人设的内心活动',
    '2. 感官补全：每个主要场景至少补2处感官细节（视觉/听觉/嗅觉/触觉）',
    '3. 情节利用：使用本章大纲中尚未写透的细节，补1个动作小节或环境反应，不得引入大纲外的新设定',
]);

/** 是否需要扩写：有正文且低于目标下限 */
function needsExpansion(wordCount, wordConfig) {
    return wordCount > 0 && wordCount < wordConfig.targetMin;
}

/**
 * 抢救区判定：缺口≤20%时，在现有稿上扩写（reviser）远比整章重生成（writer）可靠。
 * 根因（2026-09-06实测）：项目wordConfig常见rejectMin==minWords，可救区宽度为0，
 * <下限的章节永远走writer重生成，而重生成有长度先验（flash实测3轮2264字不变）。
 */
const SALVAGE_RATIO = 0.8;
function needsSalvageExpansion(wordCount, wordConfig) {
    return needsExpansion(wordCount, wordConfig)
        && wordCount >= Math.round(wordConfig.targetMin * SALVAGE_RATIO);
}

/**
 * 严重不足区判定（2026-09-21新增）：
 * 缺口 > 20% 时原逻辑直接重跑 writer，但 writer 有"长度先验"——实测同一章 3 轮产出
 * 1615/1615/1607 字几乎不变（20章E2E ch3 因此整章作废，ch4 2198 字同样卡死）。
 * 只要有成稿（≥30% 目标下限）就应改走 reviser 的结构化扩写，而不是整章重生成。
 */
const SALVAGE_FLOOR_RATIO = 0.3;
function needsShortfallSalvage(wordCount, wordConfig) {
    return needsExpansion(wordCount, wordConfig)
        && wordCount >= Math.round(wordConfig.targetMin * SALVAGE_FLOOR_RATIO);
}

/**
 * 构建扩写指令段
 * @param {number} wordCount 当前正文字数（去空白）
 * @param {object} wordConfig { targetMin, targetMax, rejectMin }
 * @param {object} opts { mode: 'revise'|'rewrite', attempt: 第几次退回(0起) }
 *   mode: revise=在原稿上扩写(reviser)；rewrite=参考原稿重写完整章节(writer)
 *   attempt: ≥2时指令带轮次标记与升级警告——同时保证每轮prompt不同，
 *            打破"同prompt→网关同补全"的重试死循环（2026-09-06实测round5/6输出逐字节相同）
 * @returns {string} 指令文本；不需要扩写时返回空串
 */
function buildExpansionInstruction(wordCount, wordConfig, opts = {}) {
    if (!needsExpansion(wordCount, wordConfig)) return '';
    const gap = wordConfig.targetMin - wordCount;
    // 留30%余量（且至少100字）：防止贴着下限写又差几十字被退
    const addTarget = gap + Math.max(100, Math.round(gap * 0.3));
    const mode = opts.mode === 'rewrite' ? 'rewrite' : 'revise';
    const attempt = opts.attempt || 0;
    const modeRule = mode === 'rewrite'
        ? '4. 以原稿为基础重写完整章节，原稿的有效情节必须保留并加厚，禁止另起炉灶写更短的版本'
        : '4. 只做加法与充实：禁止删除或压缩现有正文，禁止输出比原文更短的版本';
    const header = attempt >= 2
        ? `【扩写任务·第${attempt}次退回 — 本轮最高优先级】`
        : '【扩写任务 — 本轮最高优先级】';
    const escalation = attempt >= 2
        ? `警告：已连续${attempt}轮字数不达标，本轮若仍低于${wordConfig.targetMin}字，整章将作废重生成。`
        : '';
    return [
        header,
        `当前正文${wordCount}字，审核下限${wordConfig.targetMin}字（目标区间${wordConfig.targetMin}-${wordConfig.targetMax}字），缺口${gap}字。`,
        `本轮必须新增至少${addTarget}字的有效正文内容。逐项执行以下扩写手法（每项都要落实为实际文字）：`,
        ...EXPANSION_METHODS,
        modeRule,
        `输出前自查：统计总字数，低于${wordConfig.targetMin}字必须继续扩写，达标后才允许输出完整正文。`,
        escalation
    ].filter(Boolean).join('\n');
}

/**
 * 步内升级重试判定：扩写任务下发后输出仍低于下限（2026-09-06实测flash首轮扩写+0字，
 * 若不在步内重试而等下游first-review拒绝，会白烧一整轮）
 */
function needsExpansionRetry(expansionTask, wordCount) {
    return !!expansionTask && wordCount < expansionTask.targetMin;
}

/** 步内重试的升级指令：明示上轮失败事实+数学量（比常规指令更强的服从性压力） */
function buildEscalationNote(wordCount, targetMin) {
    const gap = targetMin - wordCount;
    const addMin = gap + Math.max(100, Math.round(gap * 0.3));
    return `\n\n【上轮扩写未生效·步内最后重试】你上轮输出仅${wordCount}字，距下限${targetMin}字仍差${gap}字，扩写任务未被执行。本轮输出必须比上轮至少多${addMin}字：给2处对话各补1-2轮往返、每个场景补2处感官细节、用大纲补1个情节小节。禁止删除现有正文，禁止复述上轮输出。本轮仍不达标将整章作废重生成。`;
}

module.exports = { countWords, EXPANSION_METHODS, needsExpansion, needsSalvageExpansion, needsShortfallSalvage, buildExpansionInstruction, needsExpansionRetry, buildEscalationNote, SALVAGE_RATIO, SALVAGE_FLOOR_RATIO };
