const { RESOLUTION_PATTERNS, NEW_HOOK_PATTERNS, FALSE_POSITIVE_CONTEXTS, TYPE_ALIASES } = require('./hookBudgetConstants');

function extractHookKeywords(hook) {
    const keywords = [];
    if (hook.notes) {
        const segments = hook.notes.split(/[—\-，。、：；""''（）\[\]【】\s]/);
        for (const seg of segments) {
            const trimmed = seg.trim();
            if (trimmed.length >= 2 && trimmed.length <= 15) keywords.push(trimmed);
        }
        const fullNotes = hook.notes.trim();
        if (fullNotes.length >= 2 && fullNotes.length <= 30) keywords.push(fullNotes);
    }
    if (hook.type) keywords.push(hook.type);
    if (hook.type && TYPE_ALIASES[hook.type]) keywords.push(...TYPE_ALIASES[hook.type]);
    return keywords.filter(k => k.length > 0);
}

function semanticVerifyResolution(hook, content) {
    for (const fp of FALSE_POSITIVE_CONTEXTS) {
        if (fp.test(content)) return false;
    }
    const hookKeywords = extractHookKeywords(hook);
    let keywordNearResolution = false;
    for (const kw of hookKeywords) {
        if (!kw) continue;
        const kwIdx = content.indexOf(kw);
        if (kwIdx === -1) continue;
        const nearby = content.substring(Math.max(0, kwIdx - 50), Math.min(content.length, kwIdx + 50));
        if (/真相|揭露|揭开|识破|破局|坦白|揭晓|大白/.test(nearby)) {
            keywordNearResolution = true;
            break;
        }
    }
    return keywordNearResolution || hookKeywords.length === 0;
}

function detectResolutions(hook, content) {
    const hookKeywords = extractHookKeywords(hook);
    let mentionCount = 0;
    for (const kw of hookKeywords) {
        if (kw && content.includes(kw)) mentionCount++;
    }
    if (mentionCount < 1) return { mentioned: false, resolved: false };

    let isResolved = false;
    for (const pattern of RESOLUTION_PATTERNS) {
        if (pattern.test(content)) { isResolved = true; break; }
    }

    if (isResolved) {
        const semanticOk = semanticVerifyResolution(hook, content);
        return { mentioned: true, resolved: semanticOk };
    }
    return { mentioned: true, resolved: false };
}

function detectNewHooks(content, activeHooks, chapterNumber, budget) {
    const detected = [];
    const AUTO_DETECT_MAX_PER_CHAPTER = 1;
    let autoDetected = 0;
    for (const { pattern, type } of NEW_HOOK_PATTERNS) {
        if (autoDetected >= AUTO_DETECT_MAX_PER_CHAPTER) break;
        if (pattern.test(content) && budget.remaining > 0) {
            const existing = activeHooks.find(h => h.type === type && (chapterNumber - h.startChapter) < 5);
            if (!existing) {
                const match = content.match(pattern);
                const contextSnippet = match ? match[0] : '';
                detected.push({ type, notes: `第${chapterNumber}章自动检测：「${contextSnippet}」` });
                autoDetected++;
            }
        }
    }
    return detected;
}

module.exports = { extractHookKeywords, semanticVerifyResolution, detectResolutions, detectNewHooks };
