const logger = require('../shared/logger');
const router = require('express').Router();
const { buildFoundationPrompt } = require('../services/prompts/promptBuilder');
const { AGENT_META, ALL_AGENT_TYPES, resolveGenre } = require('./genreDebugHelpers');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.get('/constraint-modules', (req, res) => {
    try {
        const { listConstraintModules, AGENT_CONSTRAINT_MAP } = require('../services/prompts/constraintModules');
        res.json({ success: true, data: { modules: listConstraintModules(), agentMap: AGENT_CONSTRAINT_MAP } });
    } catch (err) { res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.get('/constraint-modules/:agentType', (req, res) => {
    try {
        const { getAgentConstraintIds, CONSTRAINT_MODULES } = require('../services/prompts/constraintModules');
        const ids = getAgentConstraintIds(req.params.agentType);
        const modules = ids.map(id => ({ id, label: CONSTRAINT_MODULES[id]?.label || CONSTRAINT_MODULES[id]?.name, scope: CONSTRAINT_MODULES[id]?.scope || CONSTRAINT_MODULES[id]?.priority, charCount: (CONSTRAINT_MODULES[id]?.text || CONSTRAINT_MODULES[id]?.rules?.join('\n') || '').length }));
        res.json({ success: true, data: { agentType: req.params.agentType, moduleIds: ids, modules } });
    } catch (err) { res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.get('/list', (req, res) => {
    try {
        const { GENRE_REGISTRY } = require('../services/genreConfig');
        const genres = GENRE_REGISTRY.map(g => ({ id: g.id, label: g.label, genreProfileIds: g.genreProfileIds || [], requiredConstraints: g.requiredConstraints || [], incompatibleConstraints: g.incompatibleConstraints || [] }));
        res.json({ success: true, data: genres });
    } catch (err) { res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.get('/:genreId/agents', (req, res) => {
    try {
        const genre = resolveGenre(req.params.genreId);
        if (!genre) return res.apiError(NOT_FOUND.statusCode, 'Genre not found', NOT_FOUND.code, { genreId: req.params.genreId });
        const materialFocus = genre.styleProfile?.materialFocus || { primary: [], secondary: [], skip: [] };
        const agentMaterialAccess = genre.agentMaterialAccess || {};
        const incompatibleConstraints = genre.incompatibleConstraints || [];
        const requiredConstraints = genre.requiredConstraints || [];
        const constraintPresets = genre.constraintPresets || {};
        const agentsList = [];
        for (const agentType of ALL_AGENT_TYPES) {
            const access = agentMaterialAccess[agentType] || {};
            const meta = AGENT_META[agentType] || {};
            const needs = access.needs || [];
            const skipTypes = materialFocus.skip || [];
            agentsList.push({ type: agentType, agentType, name: meta.name || agentType, icon: meta.icon || '🤖', needs, detail: access.detail || 'index', loadedTypes: needs.filter(t => !skipTypes.includes(t)), skippedTypes: needs.filter(t => skipTypes.includes(t)), incompatibleConstraints, requiredConstraints });
        }
        res.json({ success: true, data: { genreId: genre.id, genreLabel: genre.label, genre: { id: genre.id, label: genre.label, name: genre.label, mode: genre.patterns?.join(' / ') || '', description: genre.foundation?.additionalFoundationRules?.slice(0, 3).join('；') || '' }, materialFocus, incompatibleConstraints, requiredConstraints, constraintPresets, agents: agentsList } });
    } catch (err) { res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.get('/:genreId/:agentType/prompt', async (req, res) => {
    try {
        const { genreId, agentType } = req.params;
        const genre = resolveGenre(genreId);
        if (!genre) return res.apiError(NOT_FOUND.statusCode, 'Genre not found', NOT_FOUND.code, { genreId });
        const meta = AGENT_META[agentType] || {};
        let foundation = '';
        try { foundation = await buildFoundationPrompt(agentType, 'novel', genre); } catch (e) { foundation = `[Error building foundation: ${e.message}]`; }
        const { BASE_CONSTRAINT_PRESETS } = require('../services/prompts/constraintInjector');
        const allPresets = { ...BASE_CONSTRAINT_PRESETS, ...(genre.constraintPresets || {}) };
        const requiredConstraints = genre.requiredConstraints || [];
        const incompatibleConstraints = genre.incompatibleConstraints || [];
        const effectiveConstraints = requiredConstraints.filter(c => !incompatibleConstraints.includes(c));
        let constraints = '';
        if (effectiveConstraints.length > 0) { const items = effectiveConstraints.map(id => allPresets[id]).filter(Boolean).map(c => `${c.label}：${c.desc}`); if (items.length) constraints = `\n【写作约束（必须遵守）】\n${items.join('\n')}`; }
        const parts = [];
        if (genre.foundation?.additionalConstraints?.length) parts.push('【题材约束】\n' + genre.foundation.additionalConstraints.map(c => `- ${c.label}：${c.desc}`).join('\n'));
        if (genre.styleProfile) { const sp = genre.styleProfile; const spParts = []; if (sp.povRule) spParts.push(`视角规则：${sp.povRule}`); if (sp.dialogueRule) spParts.push(`对话规则：${sp.dialogueRule}`); if (sp.behaviorRule) spParts.push(`行为规则：${sp.behaviorRule}`); if (sp.toneRule) spParts.push(`基调规则：${sp.toneRule}`); if (sp.titleRule) spParts.push(`标题规则：${sp.titleRule}`); if (spParts.length) parts.push('【风格规范】\n' + spParts.join('\n')); }
        if (genre.writerHints?.terminologyDimming) parts.push('【术语与世界观提示】\n' + genre.writerHints.terminologyDimming);
        if (genre.genreBase?.BEHAVIOR_APPEND) parts.push('【题材行为追加】\n' + genre.genreBase.BEHAVIOR_APPEND);
        if (genre.genreBase?.TONE_APPEND) parts.push('【题材基调追加】\n' + genre.genreBase.TONE_APPEND);
        const genreInjection = parts.join('\n\n');
        const fullPreview = [foundation, constraints, genreInjection].filter(Boolean).join('\n\n');
        res.json({ success: true, data: { genreId, agentType, agentName: meta.name || agentType, foundationLength: foundation.length, constraintLength: constraints.length, genreInjectionLength: genreInjection.length, totalLength: fullPreview.length, foundation, constraints, genreInjection, fullPreview } });
    } catch (err) { res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.get('/:genreId/constraints', (req, res) => {
    try {
        const genre = resolveGenre(req.params.genreId);
        if (!genre) return res.apiError(NOT_FOUND.statusCode, 'Genre not found', NOT_FOUND.code);
        const constraints = (genre.foundation?.additionalConstraints || []).map(c => ({ id: c.id, label: c.label, desc: c.desc }));
        const foundationRules = genre.foundation?.additionalFoundationRules || [];
        const styleProfile = {};
        if (genre.styleProfile) { const sp = genre.styleProfile; if (sp.povRule) styleProfile.povRule = sp.povRule; if (sp.dialogueRule) styleProfile.dialogueRule = sp.dialogueRule; if (sp.behaviorRule) styleProfile.behaviorRule = sp.behaviorRule; if (sp.toneRule) styleProfile.toneRule = sp.toneRule; if (sp.titleRule) styleProfile.titleRule = sp.titleRule; }
        res.json({ success: true, data: { genreId: genre.id, genreLabel: genre.label, constraints, foundationRules, styleProfile, pacingConfig: genre.pacingConfig || {}, requiredConstraints: genre.requiredConstraints || [], incompatibleConstraints: genre.incompatibleConstraints || [] } });
    } catch (err) { res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.put('/:genreId/constraints', (req, res) => {
    try {
        const genre = resolveGenre(req.params.genreId);
        if (!genre) return res.apiError(NOT_FOUND.statusCode, 'Genre not found', NOT_FOUND.code);
        const { constraints, foundationRules, styleProfile } = req.body || {};
        if (constraints && Array.isArray(constraints)) genre.foundation.additionalConstraints = constraints.map(c => ({ id: c.id, label: c.label, desc: c.desc }));
        if (foundationRules && Array.isArray(foundationRules)) genre.foundation.additionalFoundationRules = foundationRules;
        if (styleProfile && typeof styleProfile === 'object') { if (styleProfile.povRule !== undefined) genre.styleProfile.povRule = styleProfile.povRule; if (styleProfile.dialogueRule !== undefined) genre.styleProfile.dialogueRule = styleProfile.dialogueRule; if (styleProfile.behaviorRule !== undefined) genre.styleProfile.behaviorRule = styleProfile.behaviorRule; if (styleProfile.toneRule !== undefined) genre.styleProfile.toneRule = styleProfile.toneRule; if (styleProfile.titleRule !== undefined) genre.styleProfile.titleRule = styleProfile.titleRule; }
        res.json({ success: true, data: { genreId: genre.id, constraintsCount: genre.foundation.additionalConstraints.length, foundationRulesCount: genre.foundation.additionalFoundationRules.length } });
    } catch (err) { res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

module.exports = router;
