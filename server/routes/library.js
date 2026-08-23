const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const techIndex = require('../services/techIndex');
const { ValidationEngine } = require('../services/validationEngine');
const { getBatchSuccessRates, deleteFeedbackByProject } = require('../services/pipeline/techniqueFeedback');
const store = require('../store');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const LIBRARY_DIR = path.join(__dirname, '..', 'data', 'library');
const LEAF_DIR = path.join(LIBRARY_DIR, 'leaf');
const META_DIR = path.join(LIBRARY_DIR, 'metadata');
const ve = new ValidationEngine();

function readJson(fp) { if (!fs.existsSync(fp)) return null; return JSON.parse(fs.readFileSync(fp, 'utf-8').replace(/^\uFEFF/, '')); }
function writeJson(fp, data) { const d = path.dirname(fp); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8'); }

router.get('/index', (req, res) => {
    try {
        const index = readJson(path.join(LIBRARY_DIR, 'index.json'));
        if (!index) return res.json({ entries: [], total_entries: 0 });
        const { mode, injection_point, department, worldviewDepth } = req.query;
        let entries = index.entries;
        if (mode) entries = entries.filter(e => e.modes.includes(mode));
        if (injection_point) entries = entries.filter(e => e.injection_point === injection_point);
        if (department) entries = entries.filter(e => e.department === department);
        if (worldviewDepth) entries = entries.filter(e => e.worldviewDepth === worldviewDepth);
        res.json({ ...index, entries, filtered_count: entries.length });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/departments', (req, res) => {
    try {
        const index = readJson(path.join(LIBRARY_DIR, 'index.json'));
        if (!index) return res.json([]);
        const depts = {};
        for (const e of index.entries) {
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

router.get('/technique/:id', (req, res) => {
    try {
        const { id } = req.params;
        const index = readJson(path.join(LIBRARY_DIR, 'index.json'));
        const entry = index?.entries?.find(e => e.id === id);
        if (!entry) return res.apiError(NOT_FOUND.statusCode, 'Technique not found', NOT_FOUND.code);

        const leaf = readJson(path.join(LIBRARY_DIR, entry.path));
        const meta = readJson(path.join(META_DIR, `${id}.json`));
        res.json({ ...leaf, _meta: meta || { id, success_rate: 50, attempts: 0, auto_disabled: false } });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.put('/technique/:id', (req, res) => {
    try {
        const { id } = req.params;
        const index = readJson(path.join(LIBRARY_DIR, 'index.json'));
        const entry = index?.entries?.find(e => e.id === id);
        if (!entry) return res.apiError(NOT_FOUND.statusCode, 'Technique not found', NOT_FOUND.code);

        const leafPath = path.join(LIBRARY_DIR, entry.path);
        const existing = readJson(leafPath) || {};
        const updates = req.body;

        const allowed = ['display_name', 'implementation_rules', 'anti_patterns', 'trigger_condition', 'retrieval_tags', 'word_count_impact'];
        for (const key of allowed) {
            if (updates[key] !== undefined) existing[key] = updates[key];
        }
        existing.last_updated = new Date().toISOString();

        writeJson(leafPath, existing);
        techIndex.refreshIndex();
        res.json({ success: true, technique: existing });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/search', (req, res) => {
    try {
        const { q, mode, injection_point, topK } = req.query;
        if (!q) return res.json([]);
        const results = techIndex.search(q, {
            mode: mode || undefined,
            injectionPoint: injection_point || undefined,
            topK: parseInt(topK) || 10
        });
        res.json(results);
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.put('/meta/:id', (req, res) => {
    try {
        const { id } = req.params;
        const metaPath = path.join(META_DIR, `${id}.json`);
        const existing = readJson(metaPath) || { id, success_rate: 50, attempts: 0, auto_disabled: false };
        const updates = req.body;

        if (updates.auto_disabled !== undefined) existing.auto_disabled = updates.auto_disabled;
        if (updates.success_rate !== undefined) existing.success_rate = updates.success_rate;
        if (updates.applicable_modes !== undefined) existing.applicable_modes = updates.applicable_modes;

        writeJson(metaPath, existing);
        res.json({ success: true, meta: existing });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/meta/:id/reset', (req, res) => {
    try {
        const { id } = req.params;
        const metaPath = path.join(META_DIR, `${id}.json`);
        const reset = { id, success_rate: 50, attempts: 0, auto_disabled: false };
        writeJson(metaPath, reset);
        res.json({ success: true, meta: reset });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/stats', (req, res) => {
    try {
        const index = readJson(path.join(LIBRARY_DIR, 'index.json'));
        if (!index) return res.json({ total: 0, departments: 0, disabled: 0 });

        let disabled = 0;
        const byDept = {};
        for (const e of index.entries) {
            const meta = readJson(path.join(META_DIR, `${e.id}.json`));
            if (meta?.auto_disabled) disabled++;
            if (!byDept[e.department]) byDept[e.department] = 0;
            byDept[e.department]++;
        }

        res.json({
            total: index.total_entries,
            departments: Object.keys(byDept).length,
            disabled,
            byDepartment: byDept
        });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/validate/platform', (req, res) => {
    try {
        const { content, platform } = req.body;
        if (!content || !platform) return res.apiError(VALIDATION_ERROR.statusCode, 'content and platform required', VALIDATION_ERROR.code);
        const result = ve.validatePlatformCompliance(content, platform);
        res.json(result);
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
        const summary = Object.entries(rates).map(([id, r]) => ({ techniqueId: id, ...r, successRate: r.total > 0 ? (r.passed / r.total * 100).toFixed(1) : '0.0' }));
        summary.sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));
        res.json({ projectId: req.params.projectId, totalRecords: items.length, techniques: summary });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.delete('/technique-feedback/:projectId', async (req, res) => {
    try { const count = await deleteFeedbackByProject(req.params.projectId); res.json({ success: true, deletedCount: count }); }
    catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
