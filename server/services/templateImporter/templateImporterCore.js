const store = require('../../store');
const { getConstraintPresets } = require('../prompts/constraintInjector');
const { detectGenre } = require('../genreConfig');
const { getDataContext } = require('../dataContext');
const { normalizeTargetChapters } = require('../../config/targetChaptersNormalizer');
const { validateTemplate, MATERIAL_TYPES } = require('./templateValidator');
const { _importChapters, _importQuests, _importTimelines, _importMapNodes } = require('./templateImporterHelpers');

async function importTemplate(template, options = {}) {
    const { overwrite = false, projectId: existingProjectId = null } = options;
    const { v4: uuidv4 } = require('uuid');
    const result = { projectId: null, created: {}, skipped: {}, errors: [] };

    const validation = await validateTemplate(template);
    if (!validation.valid) throw new Error('范本校验失败:\n' + validation.errors.join('\n'));

    const projectId = existingProjectId || uuidv4();
    result.projectId = projectId;

    await _importConstraintPresets(template, overwrite, result);
    await _importStyleProfile(template, overwrite, result);
    await _importAgentTemplates(template, overwrite, result);
    await _importProject(template, projectId, existingProjectId, result);
    await _importMaterials(template, projectId, overwrite, uuidv4, result);
    await _importChapters(template, projectId, overwrite, uuidv4, result);
    await _importQuests(template, projectId, overwrite, uuidv4, result);
    await _importTimelines(template, projectId, overwrite, uuidv4, result);
    await _importMapNodes(template, projectId, overwrite, uuidv4, result);

    return result;
}

async function _importConstraintPresets(template, overwrite, result) {
    if (!template.newConstraintPresets || template.newConstraintPresets.length === 0) return;
    let created = 0;
    for (const preset of template.newConstraintPresets) {
        const existing = await store.getItem('constraint-presets', preset.id);
        if (existing && !overwrite) { result.skipped[`constraint-preset:${preset.id}`] = '已存在'; continue; }
        await store.setItem('constraint-presets', preset.id, { id: preset.id, label: preset.label, desc: preset.desc || preset.description || '', rules: preset.rules || '', injection_point: preset.injection_point || preset.injectionPoint || 'writer', department: preset.department || preset.category || '', tier: preset.tier || 'TIER2', createdAt: new Date().toISOString() });
        created++;
    }
    result.created['constraintPresets'] = created;
}

async function _importStyleProfile(template, overwrite, result) {
    if (!template.styleProfile) return;
    const sp = template.styleProfile;
    const spId = sp.id || `profile_${sp.key}`;
    const existing = await store.getItem('style-profiles', spId);
    const detectedGenre = detectGenre(sp);
    const genreBase = detectedGenre?.genreBase || null;

    let mergedBehaviorRule = sp.behaviorRule || '';
    let mergedToneRule = sp.toneRule || '';
    let mergedReviewFocus = Array.isArray(sp.reviewFocus) ? sp.reviewFocus.join('\n') : (sp.reviewFocus || '');
    let mergedConstraintOverrides = [...(sp.constraintOverrides || [])];

    if (genreBase) {
        if (genreBase.BEHAVIOR_APPEND && !mergedBehaviorRule.includes('科技描写降维规则')) mergedBehaviorRule += '\n' + genreBase.BEHAVIOR_APPEND;
        if (genreBase.TONE_APPEND && !mergedToneRule.includes(genreBase.TONE_APPEND)) mergedToneRule += '\n' + genreBase.TONE_APPEND;
        if (genreBase.REVIEW_APPEND && !mergedReviewFocus.includes('科技描写降维检查')) mergedReviewFocus += genreBase.REVIEW_APPEND;
        if (genreBase.REQUIRED_CONSTRAINT_OVERRIDES) for (const rc of genreBase.REQUIRED_CONSTRAINT_OVERRIDES) { if (!mergedConstraintOverrides.includes(rc)) mergedConstraintOverrides.push(rc); }
    }

    if (existing && !overwrite) { result.skipped['styleProfile'] = '已存在'; return; }

    const baseData = { id: spId, key: sp.key, label: sp.label, description: sp.description || sp.desc || '', povRule: sp.povRule || '', dialogueRule: sp.dialogueRule || '', behaviorRule: mergedBehaviorRule, toneRule: mergedToneRule, reviewFocus: mergedReviewFocus, materialFocus: sp.materialFocus || '', constraintOverrides: mergedConstraintOverrides, rules: sp.rules || {}, createdAt: new Date().toISOString() };

    if (existing && overwrite) {
        baseData.povRule = sp.povRule || existing.povRule || '';
        baseData.dialogueRule = sp.dialogueRule || existing.dialogueRule || '';
        baseData.description = sp.description || sp.desc || existing.description || '';
        baseData.materialFocus = sp.materialFocus || existing.materialFocus || '';
        baseData.rules = sp.rules || existing.rules || {};
        if (existing.characterRefRules && !baseData.characterRefRules) baseData.characterRefRules = existing.characterRefRules;
        baseData.createdAt = existing.createdAt || baseData.createdAt;
    }

    await store.setItem('style-profiles', spId, baseData);
    result.created['styleProfile'] = 1;
}

async function _importAgentTemplates(template, overwrite, result) {
    if (!template.agentTemplates || template.agentTemplates.length === 0) return;
    let created = 0;
    for (const tpl of template.agentTemplates) {
        const tplId = tpl.id || `tpl_${tpl.agentType}_${template.project.mode || 'novel'}`;
        const existing = await store.getItem('agent-templates', tplId);
        if (existing && !overwrite) { result.skipped[`agentTemplate:${tpl.agentType}`] = '已存在'; continue; }
        await store.setItem('agent-templates', tplId, { id: tplId, agentType: tpl.agentType, mode: tpl.mode || template.project.mode || 'novel', role: tpl.role || tpl.agentType, tool: tpl.tool || `novel-pipeline-${tpl.agentType}`, system: tpl.system, createdAt: new Date().toISOString() });
        created++;
    }
    result.created['agentTemplates'] = created;
}

async function _importProject(template, projectId, existingProjectId, result) {
    const _tiCtx = existingProjectId ? await getDataContext(existingProjectId) : null;
    const project = _tiCtx ? await _tiCtx.getProject() : null;
    const rawConstraints = template.constraints || [];
    const detectedGenre2 = detectGenre(template.styleProfile);
    const INCOMPATIBLE_CONSTRAINTS = detectedGenre2?.incompatibleConstraints || [];
    const REQUIRED_CONSTRAINTS = detectedGenre2?.requiredConstraints || [];
    let filteredConstraints = rawConstraints;
    if (detectedGenre2 && (INCOMPATIBLE_CONSTRAINTS.length > 0 || REQUIRED_CONSTRAINTS.length > 0)) {
        filteredConstraints = rawConstraints.filter(c => !INCOMPATIBLE_CONSTRAINTS.includes(c));
        for (const rc of REQUIRED_CONSTRAINTS) { if (!filteredConstraints.includes(rc)) filteredConstraints.push(rc); }
    }
    const CONSTRAINT_PRESETS = getConstraintPresets(detectedGenre2);
    const validConstraints = filteredConstraints.filter(c => CONSTRAINT_PRESETS[c]);
    const projectData = { id: projectId, name: template.project.name || 'Untitled', description: template.project.description || '', genre: template.project.genre || '', mode: template.project.mode || 'novel', targetChapters: normalizeTargetChapters(template.project), currentChapter: 0, status: 'outlined', constraints: validConstraints, styleProfile: template.styleProfile?.key || '', styleTemplateId: template.project.styleTemplateId || '', agentOverrides: template.agentOverrides || {}, settings: template.project.settings || { autoPipeline: false, chapterRounds: 3 }, createdAt: project?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    await store.setItem('projects', projectId, projectData);
    result.created['project'] = 1;
}

async function _importMaterials(template, projectId, overwrite, uuidv4, result) {
    if (!template.materials || template.materials.length === 0) return;
    let created = 0, skipped = 0;
    const existingMaterials = await store.queryItems('materials', { projectId });
    const existingKeys = new Set(existingMaterials.map(em => `${em.type}:${em.name}`));
    for (const m of template.materials) {
        const dedupeKey = `${m.type}:${m.name}`;
        if (existingKeys.has(dedupeKey)) { skipped++; continue; }
        const matId = m.id || uuidv4();
        const content = m.content || m.currentContent || '';
        const matData = { id: matId, projectId, type: m.type, name: m.name, initialContent: content, currentContent: content, version: 1, status: 'active', tags: m.tags || [], changeLog: [{ action: 'import', from: 'template', at: new Date().toISOString() }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (m.type === 'character' && m.refNames) matData.refNames = m.refNames;
        else if (m.type === 'character' && !m.refNames) {
            const gender = content.includes('女') || m.name.includes('妈') || m.name.includes('姐') || m.name.includes('妹') ? '她' : '他';
            matData.refNames = { narrator: m.name.split('（')[0].split('(')[0].trim(), pronoun: gender };
        }
        await store.setItem('materials', matId, matData);
        created++;
    }
    result.created['materials'] = created;
    if (skipped > 0) result.skipped['materials'] = `${skipped} duplicates by type:name`;
}

module.exports = { importTemplate };
