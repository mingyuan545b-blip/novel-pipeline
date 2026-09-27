/**
 * techIndexSearch — 藏经阁BM25检索与分词（纯函数，无IO）
 *
 * 从 techIndex.js 抽出，使 techIndex 只负责数据加载（PG/JSON）与门面，
 * 同时满足单文件≤200行的硬约束。
 * 文件位置：server/services/techIndexSearch.js
 */
const IDF_SMOOTHING = 0.5;
const K1 = 1.5;
const B = 0.75;

/** 中文双字切分 + 英文数字词切分 */
function tokenize(text) {
    if (!text) return [];
    const cleaned = String(text).toLowerCase().replace(/[^\u4e00-\u9fff\w]/g, ' ');
    const tokens = [];
    for (const seg of cleaned.match(/[\u4e00-\u9fff]{2,}/g) || []) {
        for (let i = 0; i < seg.length - 1; i++) tokens.push(seg.substring(i, i + 2));
    }
    tokens.push(...(cleaned.match(/[a-z0-9]+/g) || []));
    return tokens;
}

/** 技法条目的可检索文本 */
function entryText(entry) {
    return [entry.display_name, ...(entry.tags || []), entry.department, entry.subcategory || ''].join(' ');
}

/** 构建BM25统计量（df/idf/平均文档长度） */
function buildStats(entries) {
    let totalLen = 0;
    const df = {};
    for (const entry of entries) {
        const tokens = tokenize(entryText(entry));
        totalLen += tokens.length;
        for (const t of new Set(tokens)) df[t] = (df[t] || 0) + 1;
    }
    const docCount = entries.length;
    const avgDocLen = docCount > 0 ? totalLen / docCount : 1;
    const idf = {};
    for (const [term, freq] of Object.entries(df)) {
        idf[term] = Math.log((docCount - freq + IDF_SMOOTHING) / (freq + IDF_SMOOTHING) + 1);
    }
    return { docCount, avgDocLen, idf };
}

/** 单文档BM25得分 */
function bm25Score(queryTokens, docTokens, stats) {
    const docFreq = {};
    for (const t of docTokens) docFreq[t] = (docFreq[t] || 0) + 1;
    const docLen = docTokens.length;
    let score = 0;
    for (const qt of new Set(queryTokens)) {
        const tf = docFreq[qt] || 0;
        if (tf === 0) continue;
        const idf = stats.idf[qt] || 0;
        score += idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * docLen / stats.avgDocLen));
    }
    return score;
}

/**
 * 检索：可选 mode / injectionPoint / department 过滤
 * @returns {Array} 命中条目（附加 score），按分数降序
 */
function searchEntries(entries, query, stats, { mode, injectionPoint, department, topK = 5, minScore = 0.1 } = {}) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];
    const results = [];
    for (const entry of entries) {
        if (mode && !(entry.modes || []).includes(mode)) continue;
        if (injectionPoint && entry.injection_point !== injectionPoint) continue;
        if (department && entry.department !== department) continue;
        const score = bm25Score(queryTokens, tokenize(entryText(entry)), stats);
        if (score >= minScore) results.push({ ...entry, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
}

module.exports = { tokenize, entryText, buildStats, bm25Score, searchEntries, IDF_SMOOTHING, K1, B };
