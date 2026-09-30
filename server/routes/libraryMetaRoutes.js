/**
 * libraryMetaRoutes — 藏经阁技法元数据与反馈路由
 *
 * 挂载点：/api/library（由 routes/library.js 以 router.use 方式挂载）
 * 端点：PUT /meta/:id、POST /meta/:id/reset、GET /sources（提取来源清单）、GET|DELETE /technique-feedback/:projectId
 * 数据源：PG（libraryStore / techniqueFeedback），不再读写 data/library/*.json
 * 文件位置：server/routes/libraryMetaRoutes.js
 */
const express = require('express');
const router = express.Router();
const libraryStore = require('../services/libraryStore');
const { assessCompleteness } = require('../services/libraryCompleteness');
const techIndex = require('../services/techIndex');
const store = require('../store');
const { deleteFeedbackByProject } = require('../services/pipeline/techniqueFeedback');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, INTERNAL_ERROR } = ERROR_CODES;
const DEFAULT_SUCCESS_RATE = 50;
const RESET_ATTEMPTS = 0;

router.put('/meta/:id', async (req, res) => {
    try {
        const { success_rate, attempts, auto_disabled } = req.body || {};
        const patch = {};
        if (success_rate !== undefined) patch.success_rate = success_rate;
        if (attempts !== undefined) patch.attempts = attempts;
        if (auto_disabled !== undefined) patch.auto_disabled = Boolean(auto_disabled);
        const saved = await libraryStore.updateMeta(req.params.id, patch);
        if (!saved) return res.json({ success: false, error: '技法不存在' });
        await techIndex.reload();
        res.json({ success: true, data: { success_rate: saved.success_rate, attempts: saved.attempts, auto_disabled: saved.auto_disabled } });
    } catch (e) {
        return res.apiError(VALIDATION_ERROR.statusCode, e.message, VALIDATION_ERROR.code);
    }
});

router.post('/meta/:id/reset', async (req, res) => {
    try {
        const saved = await libraryStore.updateMeta(req.params.id, {
            success_rate: DEFAULT_SUCCESS_RATE, attempts: RESET_ATTEMPTS, auto_disabled: false,
        });
        if (!saved) return res.json({ success: false, error: '技法不存在' });
        await techIndex.reload();
        res.json({ success: true, data: { success_rate: saved.success_rate, attempts: saved.attempts, auto_disabled: saved.auto_disabled } });
    } catch (e) {
        return res.apiError(VALIDATION_ERROR.statusCode, e.message, VALIDATION_ERROR.code);
    }
});

/**
 * 提取来源清单：按"从哪本书提的"聚合，回答"前面那本提取过什么"。
 * 数据源：libraryStore.listTechniquesWithTimestamps（带 createdAt/updatedAt，用于展示提取时间）
 */
router.get('/sources', async (req, res) => {
    try {
        const all = await libraryStore.listTechniquesWithTimestamps();
        const map = new Map();
        for (const t of all) {
            const key = t.source_novel || '（未标注来源）';
            if (!map.has(key)) {
                map.set(key, {
                    novel: key, total: 0, full: 0, partial: 0, empty: 0,
                    sourceType: t.source_type || 'curated', lastAt: null, departments: {},
                });
            }
            const item = map.get(key);
            const c = assessCompleteness(t);
            item.total += 1;
            item[c.level] += 1;
            item.departments[t.department] = (item.departments[t.department] || 0) + 1;
            const at = t.updatedAt || t.createdAt || null;
            if (at && (!item.lastAt || at > item.lastAt)) item.lastAt = at;
        }
        const sources = [...map.values()].map(item => Object.assign({}, item, {
            departments: Object.entries(item.departments)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count),
        })).sort((a, b) => b.total - a.total);
        res.json({ sources, total: all.length });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/technique-feedback/:projectId', async (req, res) => {
    try {
        const items = await store.queryItems('technique-feedback', { projectId: req.params.projectId });
        const rates = {};
        for (const item of items) {
            if (!rates[item.techniqueId]) rates[item.techniqueId] = { passed: 0, failed: 0, total: 0 };
            rates[item.techniqueId].total++;
            item.passed ? rates[item.techniqueId].passed++ : rates[item.techniqueId].failed++;
        }
        const summary = Object.entries(rates).map(([id, r]) => {
            // 回填技法名/部门：前端此前只能显示裸ID，用户无法阅读（见 worklog 2026-09-30）
            const tech = techIndex.getTechnique(id);
            return {
                techniqueId: id,
                name: tech?.display_name || '',
                department: tech?.department || '',
                subcategory: tech?.subcategory || '',
                ...r,
                successRate: r.total > 0 ? (r.passed / r.total * 100).toFixed(1) : '0.0',
            };
        });
        summary.sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));
        res.json({ projectId: req.params.projectId, totalRecords: items.length, techniques: summary });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.delete('/technique-feedback/:projectId', async (req, res) => {
    try { const count = await deleteFeedbackByProject(req.params.projectId); res.json({ success: true, deletedCount: count }); }
    catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
