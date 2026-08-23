const fs = require('fs');
const path = require('path');

const LIBRARY_DIR = path.join(__dirname, '..', 'data', 'library');
const IDF_SMOOTHING = 0.5;
const K1 = 1.5;
const B = 0.75;

class TechIndex {
    constructor() {
        this._index = null;
        this._leaves = {};
        this._avgDocLen = 0;
        this._docCount = 0;
        this._idfCache = {};
        this._injectionCache = {};
        this._watcher = null;
        this._watchDebounce = null;
        this._startWatcher();
    }

    _startWatcher() {
        const idxPath = path.join(LIBRARY_DIR, 'index.json');
        if (!fs.existsSync(idxPath)) return;
        try {
            this._watcher = fs.watch(idxPath, { persistent: false }, () => {
                clearTimeout(this._watchDebounce);
                this._watchDebounce = setTimeout(() => this.refreshIndex(), 300);
            });
            this._watcher.on('error', () => { /* ignore watch errors */ });
        } catch (_) { /* fs.watch not available */ }
    }

    _loadIndex() {
        if (this._index) return this._index;
        const idxPath = path.join(LIBRARY_DIR, 'index.json');
        if (!fs.existsSync(idxPath)) { this._index = { entries: [], total_entries: 0 }; return this._index; }
        this._index = JSON.parse(fs.readFileSync(idxPath, 'utf-8').replace(/^\uFEFF/, ''));
        return this._index;
    }

    _loadLeaf(techId) {
        if (this._leaves[techId]) return this._leaves[techId];
        const index = this._loadIndex();
        const entry = index.entries.find(e => e.id === techId);
        if (!entry) return null;
        const leafPath = path.join(LIBRARY_DIR, entry.path);
        if (!fs.existsSync(leafPath)) return null;
        this._leaves[techId] = JSON.parse(fs.readFileSync(leafPath, 'utf-8').replace(/^\uFEFF/, ''));
        return this._leaves[techId];
    }

    _tokenize(text) {
        if (!text) return [];
        const cleaned = text.toLowerCase().replace(/[^\u4e00-\u9fff\w]/g, ' ');
        const tokens = [];
        const chineseChars = cleaned.match(/[\u4e00-\u9fff]{2,}/g) || [];
        for (const seg of chineseChars) {
            for (let i = 0; i < seg.length - 1; i++) {
                tokens.push(seg.substring(i, i + 2));
            }
        }
        const words = cleaned.match(/[a-z0-9]+/g) || [];
        tokens.push(...words);
        return tokens;
    }

    _buildStats() {
        const index = this._loadIndex();
        this._docCount = index.entries.length;
        let totalLen = 0;
        const df = {};

        for (const entry of index.entries) {
            const allText = [entry.display_name, ...(entry.tags || []), entry.department, entry.subcategory || ''].join(' ');
            const tokens = this._tokenize(allText);
            totalLen += tokens.length;
            const seen = new Set(tokens);
            for (const t of seen) {
                df[t] = (df[t] || 0) + 1;
            }
        }

        this._avgDocLen = this._docCount > 0 ? totalLen / this._docCount : 1;
        this._idfCache = {};
        for (const [term, freq] of Object.entries(df)) {
            this._idfCache[term] = Math.log((this._docCount - freq + IDF_SMOOTHING) / (freq + IDF_SMOOTHING) + 1);
        }
    }

    _bm25Score(queryTokens, docTokens) {
        if (!this._docCount) this._buildStats();
        const docFreq = {};
        for (const t of docTokens) docFreq[t] = (docFreq[t] || 0) + 1;
        const docLen = docTokens.length;

        let score = 0;
        const seen = new Set();
        for (const qt of queryTokens) {
            if (seen.has(qt)) continue;
            seen.add(qt);
            const tf = docFreq[qt] || 0;
            if (tf === 0) continue;
            const idf = this._idfCache[qt] || 0;
            const numerator = tf * (K1 + 1);
            const denominator = tf + K1 * (1 - B + B * docLen / this._avgDocLen);
            score += idf * numerator / denominator;
        }
        return score;
    }

    search(query, options = {}) {
        const { mode, injectionPoint, topK = 5, minScore = 0.1 } = options;
        const index = this._loadIndex();
        if (!index.entries.length) return [];

        if (!this._docCount) this._buildStats();

        const queryTokens = this._tokenize(query);
        if (queryTokens.length === 0) return [];

        const results = [];
        for (const entry of index.entries) {
            if (mode && !entry.modes.includes(mode)) continue;
            if (injectionPoint && entry.injection_point !== injectionPoint) continue;

            const docText = [entry.display_name, ...(entry.tags || []), entry.department].join(' ');
            const docTokens = this._tokenize(docText);
            const score = this._bm25Score(queryTokens, docTokens);

            if (score >= minScore) {
                results.push({ ...entry, score });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }

    getTechnique(techId) {
        return this._loadLeaf(techId);
    }

    getTechniquesByInjectionPoint(injectionPoint, mode) {
        const cacheKey = `${injectionPoint}:${mode || '*'}`;
        if (this._injectionCache[cacheKey]) return this._injectionCache[cacheKey];
        const index = this._loadIndex();
        const result = index.entries
            .filter(e => {
                if (e.injection_point !== injectionPoint) return false;
                if (mode && !e.modes.includes(mode)) return false;
                return true;
            })
            .map(e => this._loadLeaf(e.id))
            .filter(Boolean);
        this._injectionCache[cacheKey] = result;
        return result;
    }

    formatTechniquesForPrompt(techniques, maxTokens = 800) {
        if (!techniques.length) return '';
        const lines = ['\n[写作技法参考 - 仅供内部参考，严禁在正文中输出本节标题或技法名称]'];
        let usedTokens = 0;
        const estimateTokens = (t) => Math.ceil(t.length * 1.5);

        for (const tech of techniques) {
            const line = `- ${tech.display_name} (${tech.department.replace(/^\d+_/, '')}/${tech.subcategory.replace(/^\d+_/, '')})`;
            const tokens = estimateTokens(line);
            if (usedTokens + tokens > maxTokens) break;
            lines.push(line);
            usedTokens += tokens;
        }

        lines.push('（按场景自然融入，不得在正文中提及技法名或本节标记）');
        return lines.join('\n');
    }

    refreshIndex() {
        this._index = null;
        this._leaves = {};
        this._idfCache = {};
        this._docCount = 0;
        this._avgDocLen = 0;
        this._injectionCache = {};
        this._loadIndex();
    }
}

module.exports = new TechIndex();
