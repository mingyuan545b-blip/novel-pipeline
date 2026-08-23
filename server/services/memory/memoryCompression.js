const logger = require('../../shared/logger');
const { CONTEXT_BUDGETS, MEMORY_LAYERS } = require('./memoryConstants');
const { _estimateTokens, _extractSummary, _calcForeshadowingUrgency } = require('./memoryLayerBuilder');

function _extractKeywords(text) {
    if (!text) return [];
    const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
    const words = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    const freq = {};
    words.forEach(w => {
        if (!stopWords.has(w)) {
            freq[w] = (freq[w] || 0) + 1;
        }
    });
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([w]) => w);
}

function _relevanceScore(text, keywords) {
    if (!text || !keywords.length) return 0;
    let score = 0;
    for (const kw of keywords) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            const regex = new RegExp(escaped, 'g');
            const matches = text.match(regex);
            if (matches) score += matches.length;
        } catch (_) { logger.warn('memoryCompression', _.message || _); }
    }
    return score;
}

function _filterRelevantL1(l1, keywords, mentionedCharacters) {
    if (!l1) return l1;
    const filtered = {
        ...l1,
        characterStates: { ...l1.characterStates },
        relationshipStates: { ...l1.relationshipStates }
    };

    if (mentionedCharacters.length > 0 || keywords.length > 0) {
        const relevantCharIds = new Set();
        for (const [id, state] of Object.entries(l1.characterStates || {})) {
            const nameMatch = mentionedCharacters.some(mc => state.name?.includes(mc));
            const keywordMatch = keywords.some(kw =>
                (state.currentContent || '').includes(kw) || (state.name || '').includes(kw)
            );
            if (nameMatch || keywordMatch) {
                relevantCharIds.add(id);
            }
        }

        for (const [id, state] of Object.entries(l1.characterStates || {})) {
            if (!relevantCharIds.has(id) && !state.name?.includes('主角')) {
                filtered.characterStates[id] = { ...state, active: false };
            }
        }
    }

    return filtered;
}

function _compressL0(l0, budget) {
    const compressed = { worldRules: [], powerFramework: [], coreCharacters: [] };
    let used = 0;

    for (const r of (l0.worldRules || [])) {
        const tokens = _estimateTokens(r.content);
        if (used + tokens <= budget * 0.4) {
            compressed.worldRules.push({ ...r, content: r.content.substring(0, 200) });
            used += tokens;
        }
    }

    for (const p of (l0.powerFramework || [])) {
        const tokens = _estimateTokens(p.content);
        if (used + tokens <= budget * 0.7) {
            compressed.powerFramework.push({ ...p, content: p.content.substring(0, 200) });
            used += tokens;
        }
    }

    for (const c of (l0.coreCharacters || [])) {
        const tokens = _estimateTokens(c.content);
        if (used + tokens <= budget) {
            compressed.coreCharacters.push({ ...c, content: c.content.substring(0, 150) });
            used += tokens;
        }
    }

    return compressed;
}

function _compressL1(l1, budget) {
    const compressed = { characterStates: {}, relationshipStates: {}, equipmentStates: {}, growthStates: {} };
    let used = 0;

    for (const [id, state] of Object.entries(l1.characterStates || {})) {
        const line = `${state.name}|位置:${state.location}|战力:${state.powerLevel}|状态:${state.status}`;
        const tokens = _estimateTokens(line);
        if (used + tokens <= budget * 0.6) {
            compressed.characterStates[id] = { ...state, currentContent: line };
            used += tokens;
        }
    }

    for (const [id, rel] of Object.entries(l1.relationshipStates || {})) {
        const line = `${rel.name}: ${rel.type}(强度:${rel.strength})`;
        const tokens = _estimateTokens(line);
        if (used + tokens <= budget * 0.8) {
            compressed.relationshipStates[id] = { ...rel, content: line };
            used += tokens;
        }
    }

    return compressed;
}

function _compressL2(l2, budget) {
    const compressed = { ...l2, recentSummaries: [], activeForeshadowings: [] };
    let used = 0;

    for (const s of (l2.recentSummaries || [])) {
        const summary = s.summary?.substring(0, 100) || '';
        const tokens = _estimateTokens(summary);
        if (used + tokens <= budget * 0.5) {
            compressed.recentSummaries.push({ ...s, summary });
            used += tokens;
        }
    }

    for (const f of (l2.activeForeshadowings || [])) {
        const content = f.content?.substring(0, 80) || '';
        const tokens = _estimateTokens(content);
        if (used + tokens <= budget) {
            compressed.activeForeshadowings.push({ ...f, content });
            used += tokens;
        }
    }

    return compressed;
}

function _compressL3(l3, budget) {
    const compressed = { ...l3, relevantHistory: [], archivedMaterials: [] };
    let used = 0;

    for (const h of (l3.relevantHistory || []).slice(0, 5)) {
        const tokens = _estimateTokens(h.summary);
        if (used + tokens <= budget) {
            compressed.relevantHistory.push(h);
            used += tokens;
        }
    }

    return compressed;
}

module.exports = {
    _extractKeywords, _relevanceScore, _filterRelevantL1,
    _compressL0, _compressL1, _compressL2, _compressL3
};
