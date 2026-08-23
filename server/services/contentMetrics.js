const { NOVEL_DEFAULTS } = require('../config/genreDefaults');

/**
 * 子题材配置注册表（仅保留通过质量门禁的题材）
 * 8个低俗题材（tomato-revenge/sweet/mystery/system/talisman、urban-fantasy、rule-horror、infinite-dungeon）已于2026-06-29删除
 * 详见 SOP 09 Step1 题材质量门禁
 */
const TOMATO_SUBGENRE_CONFIGS = {};

function getTomatoSubgenreConfig(subGenre) {
    return TOMATO_SUBGENRE_CONFIGS[subGenre] || null;
}

function detectReversalDensity(content) {
    if (!content) return { count: 0, density: 0, instances: [], per2000: 0 };
    const REVERSAL_PATTERNS = [
        { pattern: /然而|但是|却|不料|谁知|岂料|孰料|没想到|想不到|竟[然]?|居然/g, type: '转折' },
        { pattern: /反转|逆转|翻盘|逆袭|打脸|揭穿|真相[是大]|原来[是竟]/g, type: '反转' },
        { pattern: /不是[他她我]!?|竟然是[他她我]|居然是[他她我]|出[人乎]意料/g, type: '意外' },
        { pattern: /突然|忽然|猛然|骤然|霎时|瞬间/g, type: '突变' }
    ];
    const instances = [];
    for (const { pattern, type } of REVERSAL_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            const start = Math.max(0, match.index - 10);
            const end = Math.min(content.length, match.index + match[0].length + 10);
            instances.push({ match: match[0], type, position: match.index, context: content.substring(start, end) });
        }
    }
    const words = content.replace(/\s/g, '').length || 1;
    const per2000 = (instances.length / words) * 2000;
    return { count: instances.length, density: (instances.length / (words / 1000)).toFixed(2), instances: instances.slice(0, 20), per2000: Math.round(per2000 * 10) / 10 };
}

function detectOpeningHook(content, subGenre, hookRange) {
    if (!content) return { hasHook: false, reason: 'EMPTY_CONTENT' };
    const config = getTomatoSubgenreConfig(subGenre);
    const range = hookRange || config?.openingHookRange || 100;
    const keywords = config?.openingKeywords || /危机|异常|反常|警告|倒计时|冻结|撕裂|坍塌|崩塌|警报|红灯|闪|碎|裂|震/;
    const opening = content.slice(0, range);
    if (!keywords.test(opening)) return { hasHook: false, reason: 'OPENING_HOOK_MISSING', detail: `前${range}字无${config?.label || '通用'}钩子关键词`, range };
    return { hasHook: true, range };
}

function validateTomatoMetrics(content, pipelineConfig) {
    if (!content) return { pass: false, reason: 'EMPTY_CONTENT' };
    const text = content.replace(/\s/g, '');
    const words = text.length;
    const val = pipelineConfig?.validation || {};
    const rejectMin = pipelineConfig?.rejectMinWords || NOVEL_DEFAULTS.rejectMinWords;
    const maxChapterWords = pipelineConfig?.maxChapterWords || NOVEL_DEFAULTS.maxChapterWords;
    if (words < rejectMin) return { pass: false, reason: 'WORD_COUNT_BELOW_MIN', detail: `${words} < ${rejectMin}` };
    if (words > maxChapterWords) return { pass: false, reason: 'WORD_COUNT_ABOVE_MAX', detail: `${words} > ${maxChapterWords}` };
    const dialogueMax = val.dialogueRatioMax || 0.28;
    const dialoguePattern = /[\u201c\u201d\u0022\u300c\u300e]([^\u201c\u201d\u0022\u300d\u300f]*?)[\u201c\u201d\u0022\u300d\u300f]/g;
    let dialogueChars = 0;
    let match;
    while ((match = dialoguePattern.exec(content)) !== null) dialogueChars += match[0].length;
    if (content.length > 0 && dialogueChars / content.length > dialogueMax) return { pass: false, reason: 'DIALOGUE_RATIO_HIGH', detail: `${(dialogueChars / content.length * 100).toFixed(1)}% > ${(dialogueMax * 100).toFixed(0)}%` };
    const bannedPhrases = ["账本该翻页了", "疼就对了", "总比当个干净的空白强", "至少咱们还能活着记账"];
    for (const p of bannedPhrases) { const count = (content.match(new RegExp(p, 'g')) || []).length; if (count >= 2) return { pass: false, reason: 'REPETITION_PENALTY', detail: `"${p}" 出现${count}次` }; }
    const hookSubGenre = pipelineConfig?.genre?.id || val.subGenre || null;
    const subGenreConfig = getTomatoSubgenreConfig(hookSubGenre);
    const hookRange = subGenreConfig?.openingHookRange || val.openingHookRange || 100;
    const hookResult = detectOpeningHook(content, hookSubGenre, hookRange);
    if (!hookResult.hasHook) return { pass: false, reason: hookResult.reason, detail: hookResult.detail };
    if (val.reversalRequired) { const reversalResult = detectReversalDensity(content); if (reversalResult.per2000 < 1) return { pass: false, reason: 'REVERSAL_DENSITY_LOW', detail: `每2000字反转数${reversalResult.per2000} < 1` }; }
    return { pass: true };
}

module.exports = { TOMATO_SUBGENRE_CONFIGS, getTomatoSubgenreConfig, detectReversalDensity, detectOpeningHook, validateTomatoMetrics };
