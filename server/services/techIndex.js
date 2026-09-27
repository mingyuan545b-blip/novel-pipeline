/**
 * techIndex — 藏经阁技法检索门面
 *
 * 数据源（2026-09-21 起）：PG表 library_techniques，经 libraryStore 读取；
 *   PG为空/不可用时自动兜底读取 server/data/library/*.json（techIndexJsonSeed）。
 * 设计取舍：Pipeline侧（techniqueScheduler）是**同步调用**，而PG是异步IO，
 *   因此启动时把全库载入内存（一百余条，内存成本可忽略），对外保持同步API。
 *   提取/编辑后由 libraryStore 触发 reload() 刷新内存。
 * 文件位置：server/services/techIndex.js
 */
const search = require('./techIndexSearch');
const jsonSeed = require('./techIndexJsonSeed');
const logger = require('../shared/logger');

class TechIndex {
    constructor() {
        this._entries = [];      // 轻量条目（检索/过滤用）
        this._leaves = {};       // id -> 技法全文
        this._stats = null;      // BM25统计量
        this._source = 'none';   // 'pg' | 'json' | 'none'
        this._loadedAt = null;
    }

    _toEntry(t) {
        return {
            id: t.id,
            display_name: t.display_name,
            tags: t.retrieval_tags || t.tags || [],
            modes: t.applicable_modes || t.modes || [],
            department: t.department,
            subcategory: t.subcategory || '',
            context_slot: t.context_slot,
            injection_point: t.injection_point,
            worldviewDepth: t.worldviewDepth || t.worldview_depth || 'meso',
        };
    }

    _setAll(records, source) {
        this._leaves = {};
        this._entries = [];
        for (const t of records) {
            if (!t || !t.id) continue;
            this._leaves[t.id] = t;
            this._entries.push(this._toEntry(t));
        }
        this._stats = search.buildStats(this._entries);
        this._source = source;
        this._loadedAt = new Date().toISOString();
    }

    /** 从PG装载（启动时调用；PG不可用则回落JSON） */
    async initFromPg() {
        try {
            const libraryStore = require('./libraryStore');
            const records = await libraryStore.listTechniques();
            if (records.length > 0) {
                this._setAll(records, 'pg');
                logger.info('techIndex', `[TECH-INDEX] 已从PG装载 ${records.length} 条技法`);
                return { source: 'pg', count: records.length };
            }
            logger.warn('techIndex', '[TECH-INDEX] PG技法库为空，回落JSON种子');
        } catch (e) {
            logger.warn('techIndex', `[TECH-INDEX] PG装载失败(${e.message})，回落JSON种子`);
        }
        return this._loadJsonFallback();
    }

    /** 兜底：读JSON种子 */
    _loadJsonFallback() {
        try {
            const records = jsonSeed.loadAll();
            this._setAll(records, records.length ? 'json' : 'none');
            logger.warn('techIndex', `[TECH-INDEX] 使用JSON兜底，${records.length} 条技法（数据可能与PG不一致）`);
            return { source: this._source, count: records.length };
        } catch (e) {
            logger.error('techIndex', `[TECH-INDEX] JSON兜底失败: ${e.message}`);
            this._setAll([], 'none');
            return { source: 'none', count: 0 };
        }
    }

    /** 保证已装载（惰性兜底，供未走启动初始化的脚本/测试使用） */
    _ensureLoaded() {
        if (this._entries.length === 0 && this._source === 'none') this._loadJsonFallback();
    }

    /** 重新装载（提取入库/编辑后调用） */
    async reload() {
        return await this.initFromPg();
    }

    getSource() { return this._source; }
    getLoadedAt() { return this._loadedAt; }
    count() { this._ensureLoaded(); return this._entries.length; }

    search(query, options = {}) {
        this._ensureLoaded();
        return search.searchEntries(this._entries, query, this._stats, options);
    }

    getTechnique(techId) {
        this._ensureLoaded();
        return this._leaves[techId] || null;
    }

    getTechniquesByInjectionPoint(injectionPoint, mode) {
        this._ensureLoaded();
        return this._entries
            .filter(e => e.injection_point === injectionPoint && (!mode || e.modes.includes(mode)))
            .map(e => this._leaves[e.id])
            .filter(Boolean);
    }

    /** 全部技法全文（前端/统计用） */
    getAll() {
        this._ensureLoaded();
        return Object.values(this._leaves);
    }

    formatTechniquesForPrompt(techniques, maxTokens = 800) {
        if (!techniques.length) return '';
        const lines = ['\n[写作技法参考 - 仅供内部参考，严禁在正文中输出本节标题或技法名称]'];
        let usedTokens = 0;
        const estimateTokens = (t) => Math.ceil(t.length * 1.5);
        for (const tech of techniques) {
            const line = `- ${tech.display_name} (${(tech.department || '').replace(/^\d+_/, '')}/${(tech.subcategory || '').replace(/^\d+_/, '')})`;
            const tokens = estimateTokens(line);
            if (usedTokens + tokens > maxTokens) break;
            lines.push(line);
            usedTokens += tokens;
        }
        lines.push('（按场景自然融入，不得在正文中提及技法名或本节标记）');
        return lines.join('\n');
    }
}

module.exports = new TechIndex();
