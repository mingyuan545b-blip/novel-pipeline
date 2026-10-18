/**
 * libraryExtractPrompt — 一键提取的提示词构建
 *
 * 提取铁律（用户明确要求）：产出必须是**通用技法**，能用在别的小说上。
 *   因此提示词三重约束：①名字必须是"做法"而非"设定"；②禁止作品专有名词进库；
 *   ③规则必须可执行（含量/顺序/位置），而不是读后感式的形容词。
 * 文件位置：server/services/libraryExtractPrompt.js
 */
const { ALL_DEPARTMENTS, DEPARTMENT_SUBCATEGORIES, getInjectionDefaults } = require('../config/libraryExtractDimensions');

const MAX_RULES = 6;
const MAX_ANTI = 4;
const MAX_TAGS = 5;

function buildSystemPrompt(dimension) {
    const subMap = ALL_DEPARTMENTS
        .filter(d => dimension.departments.includes(d))
        .map(d => `${d} → ${DEPARTMENT_SUBCATEGORIES[d].join(' / ')}`)
        .join('\n');

    return `你是小说写作技法研究员。你的任务不是写读后感，而是把文本里的写法**抽象成可跨作品复用的通用技法**。

【本次提取维度】${dimension.label}
【维度说明】${dimension.hint}

【部门与子类（department/subcategory 必须从这里选，不得自创）】
${subMap}

【硬性要求】
1. 技法名（name）必须是"做法"，6-12字，禁止出现任何作品专有名词（角色名、地名、组织名、金手指名、招式名、关卡名）。
   正例：「压力倒计时可视化」「配角私心先行」「危机感官窄化」
   反例：「死亡高考评分制」「莫瑞干之战」「贺铮式狠人」
2. definition 用一句话说明这个做法是什么，且必须脱离原作也成立。
3. implementation_rules 是操作说明，3-${MAX_RULES}条，每条必须含可执行信息（数量/顺序/位置/阈值/句式要求），
   禁止写"要写得更紧张"这类无法执行的空话。
4. anti_patterns 是"抄错的样子"，2-${MAX_ANTI}条，说明错误用法及其后果。
5. evidence 只作例证，1-2条，每条≤40字，允许出现原作内容，但不得成为定义的一部分。
6. tags 3-${MAX_TAGS}个检索标签，用于后续BM25检索，用中文短词。
7. judgement_test 是「判定这条技法有没有被正确执行」的**可检验标准**，一句话，
   必须给出可观察的信号/阈值（例：「正文该段出现具体数字或倒计时词，且间隔≤3段；否则视为未执行」），
   禁止写"写得好不好"这类无法判定的空话。（B4 源头准入：新条目必须自带判定测试）

【输出格式】只输出JSON，不要任何解释、不要markdown代码块：
{"techniques":[{"name":"","department":"","subcategory":"","definition":"","implementation_rules":[""],"anti_patterns":[""],"judgement_test":"","applicability":"","evidence":[""],"word_count_impact":"+0~+10%","tags":[""]}]}`;
}

function buildUserPrompt({ dimension, novelName, excerpt, existingNames }) {
    const dedupe = existingNames.length
        ? `\n【库中已有技法（避免重复，若确为同义请换个角度或跳过）】\n${existingNames.join('、')}\n`
        : '';
    return `【待分析作品】${novelName || '未知作品'}
【提取维度】${dimension.label}（最多产出 ${dimension.maxTechniques || 4} 条最有价值的通用技法，宁缺毋滥）
${dedupe}
【文本样本（按全书均匀采样，可能跨章节拼接）】
${excerpt}

请输出JSON。再次强调：技法名与定义必须通用化，任何作品专有名词都不允许出现在 name/definition 中。`;
}

/** 提取结果的注入点/槽位/深度建议（供规范化时使用） */
function resolvePlacement(dimension) {
    const defaults = getInjectionDefaults(dimension.injection);
    return {
        injection_point: dimension.injection,
        context_slot: defaults.slot,
        context_priority: defaults.priority,
        worldviewDepth: dimension.depth,
    };
}

module.exports = { buildSystemPrompt, buildUserPrompt, resolvePlacement, MAX_RULES, MAX_ANTI, MAX_TAGS };
