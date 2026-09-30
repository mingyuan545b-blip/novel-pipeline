/**
 * libraryRoutes — 藏经阁（写作技法库）路由
 *
 * 数据源：PG表 library_techniques（经 libraryStore / techIndex 访问）
 *   2026-09-21 前为 server/data/library/*.json，迁移脚本 scripts/migrateLibraryToPg.js
 * 子路由：libraryMetaRoutes（元数据/反馈）、libraryExtractRoutes（一键提取/写操作）
 * 文件位置：server/routes/library.js
 */
const express = require('express');
const router = express.Router();
const techIndex = require('../services/techIndex');
const libraryStore = require('../services/libraryStore');
const { ValidationEngine } = require('../services/validationEngine');
const { assessCompleteness } = require('../services/libraryCompleteness');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;
const ve = new ValidationEngine();

/**
 * 索引条目（供前端树/筛选，字段与历史JSON结构兼容）
 * 增补：内容完整度（空壳/部分/完整）+ 来源作品 —— 让前端能"优先展示有数据的"，
 * 用户不必逐条点进去才发现是空壳（2026-10-01 需求，见 services/libraryCompleteness.js）。
 */
function toEntry(t) {
    const c = assessCompleteness(t);
    return {
        id: t.id,
        display_name: t.display_name,
        tags: t.retrieval_tags || [],
        modes: t.applicable_modes || [],
        department: t.department,
        subcategory: t.subcategory,
        context_slot: t.context_slot,
        injection_point: t.injection_point,
        worldviewDepth: t.worldviewDepth,
        completeness: c.level,        // full | partial | empty
        rulesCount: c.rulesCount,
        antiCount: c.antiCount,
        contentScore: c.score,        // 前端"有内容优先"排序权重
        sourceNovel: t.source_novel || '',
        sourceType: t.source_type || 'curated',
    };
}

router.get('/index', async (req, res) => {
    try {
        const { mode, injection_point, department, worldviewDepth, completeness } = req.query;
        let entries = techIndex.getAll().map(toEntry);
        if (mode) entries = entries.filter(e => e.modes.includes(mode));
        if (injection_point) entries = entries.filter(e => e.injection_point === injection_point);
        if (department) entries = entries.filter(e => e.department === department);
        if (worldviewDepth) entries = entries.filter(e => e.worldviewDepth === worldviewDepth);
        if (completeness) entries = entries.filter(e => e.completeness === completeness);
        // 默认"有内容优先"：同部门/子类内先展示可真正注入的技法，空壳沉底（前端仍可自行重排）
        entries.sort((a, b) => b.contentScore - a.contentScore ||
            String(a.display_name).localeCompare(String(b.display_name), 'zh'));
        res.json({
            entries,
            total_entries: entries.length,
            source: techIndex.getSource(),
            last_sync: techIndex.getLoadedAt(),
            filtered_count: entries.length,
        });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/departments', async (req, res) => {
    try {
        const depts = {};
        for (const e of techIndex.getAll()) {
            if (!depts[e.department]) depts[e.department] = { name: e.department, subcategories: {}, count: 0 };
            depts[e.department].count++;
            const sub = e.subcategory || e.department;
            if (!depts[e.department].subcategories[sub]) depts[e.department].subcategories[sub] = { name: sub, count: 0 };
            depts[e.department].subcategories[sub].count++;
        }
        res.json(Object.values(depts).map(d => ({ ...d, subcategories: Object.values(d.subcategories) })));
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/technique/:id', async (req, res) => {
    try {
        const leaf = techIndex.getTechnique(req.params.id);
        if (!leaf) return res.apiError(NOT_FOUND.statusCode, 'Technique not found', NOT_FOUND.code);
        res.json({ ...leaf, _meta: { success_rate: leaf.success_rate, attempts: leaf.attempts, auto_disabled: leaf.auto_disabled } });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

/** 编辑技法（前端就地编辑：实施规则/反模式/检索标签） */
router.put('/technique/:id', async (req, res) => {
    try {
        const allowed = ['implementation_rules', 'anti_patterns', 'retrieval_tags', 'description', 'display_name', 'word_count_impact'];
        const patch = {};
        for (const k of allowed) if (req.body?.[k] !== undefined) patch[k] = req.body[k];
        if (Object.keys(patch).length === 0) {
            return res.apiError(VALIDATION_ERROR.statusCode, '无可更新字段', VALIDATION_ERROR.code);
        }
        const existing = await libraryStore.getTechnique(req.params.id);
        if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Technique not found', NOT_FOUND.code);
        const saved = await libraryStore.upsertTechnique({ ...existing, ...patch });
        await techIndex.reload();
        res.json({ success: true, data: saved });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

/** 删除技法（人工清理低质/重复条目） */
router.delete('/technique/:id', async (req, res) => {
    try {
        const existing = await libraryStore.getTechnique(req.params.id);
        if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Technique not found', NOT_FOUND.code);
        await libraryStore.deleteTechnique(req.params.id);
        await techIndex.reload();
        res.json({ success: true, deleted: req.params.id });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/search', async (req, res) => {
    try {
        const { q, mode, injection_point, topK } = req.query;
        if (!q) return res.json([]);
        const hits = techIndex.search(q, { mode, injectionPoint: injection_point, topK: Number(topK) || 10 });
        // 搜索结果补完整度：轻量索引条目不含规则，需按 id 回查全文（topK≤30，成本可忽略）
        res.json(hits.map(h => Object.assign({}, h, toEntry(techIndex.getTechnique(h.id) || h))));
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/stats', async (req, res) => {
    try {
        const stats = await libraryStore.getStats();
        res.json({ ...stats, source: techIndex.getSource(), loadedAt: techIndex.getLoadedAt() });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/validate/platform', (req, res) => {
    try {
        const { content, platform } = req.body;
        if (!content || !platform) return res.apiError(VALIDATION_ERROR.statusCode, 'content and platform required', VALIDATION_ERROR.code);
        res.json(ve.validatePlatformCompliance(content, platform));
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.use('/', require('./libraryMetaRoutes'));
router.use('/', require('./libraryExtractRoutes'));

module.exports = router;
