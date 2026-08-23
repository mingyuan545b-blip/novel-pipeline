/**
 * foreshadowExtractorHelpers.js — 伏笔提取辅助函数
 * 从timelineExtractorHelpers.js拆分出的伏笔相关纯函数
 */

const FORESHADOW_ADVANCE_KEYWORDS = [
    '再次出现', '又一次', '重新浮现', '终于明白', '恍然大悟',
    '真相大白', '谜底揭开', '回忆起', '想起', '发现原来',
    '终于找到', '再次提及', '又提到', '重提'
];
const FORESHADOW_RESOLVE_KEYWORDS = [
    '真相大白', '谜底揭开', '终于明白', '恍然大悟', '水落石出',
    '一切明了', '终于揭晓', '答案浮出', '尘埃落定'
];

function fuzzyMatchForeshadow(foreshadowName, content) {
    if (content.includes(foreshadowName)) return foreshadowName;
    const coreName = foreshadowName.replace(/[（(].+?[）)]/g, '').trim();
    if (coreName.length >= 2 && content.includes(coreName)) return coreName;
    if (foreshadowName.length >= 4) {
        const prefix = foreshadowName.substring(0, 4);
        if (content.includes(prefix)) return prefix;
    }
    return null;
}

function isNearKeyword(content, foreshadowMatch, keywords, radius) {
    const idx = content.indexOf(foreshadowMatch);
    if (idx === -1) return false;
    const start = Math.max(0, idx - radius);
    const end = Math.min(content.length, idx + foreshadowMatch.length + radius);
    const context = content.substring(start, end);
    return keywords.some(kw => context.includes(kw));
}

function extractForeshadowNamesFromIntent(intentResult) {
    if (!intentResult?.intent) return [];
    const text = typeof intentResult.intent === 'string' ? intentResult.intent : JSON.stringify(intentResult.intent);
    const names = [];
    const hookIdPattern = /伏笔ID_\d+\s*\[([^\]]+)\]/g;
    let match;
    while ((match = hookIdPattern.exec(text)) !== null) names.push(match[1].trim());
    const advancePattern = /推进伏笔[：:]\s*(.+?)(?:\n|$)/g;
    while ((match = advancePattern.exec(text)) !== null) names.push(match[1].trim().substring(0, 50));
    return [...new Set(names)];
}

function detectNewForeshadowSignals(content) {
    const signals = [];
    const patterns = [
        /似乎.*?隐藏着.*?秘密/g, /暗藏.*?玄机/g, /不为人知.*?真相/g,
        /这一切.*?并非.*?简单/g, /隐隐约约.*?感觉/g, /似乎.*?并不.*?简单/g,
        /暗处.*?注视/g, /背后.*?真相/g
    ];
    for (const p of patterns) {
        const matches = content.match(p);
        if (matches) for (const m of matches) signals.push({ name: m.substring(0, 30), description: m });
    }
    return signals.slice(0, 3);
}

module.exports = {
    FORESHADOW_ADVANCE_KEYWORDS,
    FORESHADOW_RESOLVE_KEYWORDS,
    fuzzyMatchForeshadow,
    isNearKeyword,
    extractForeshadowNamesFromIntent,
    detectNewForeshadowSignals
};
