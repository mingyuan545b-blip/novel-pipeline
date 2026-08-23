const store = require('../../store');
const { getDataContext } = require('../dataContext');
const { normalizeTargetChapters } = require('../../config/targetChaptersNormalizer');

async function exportProjectAsTemplate(projectId) {
    const _ti2Ctx = await getDataContext(projectId);
    const project = await _ti2Ctx.getProject();
    if (!project) throw new Error('Project not found');

    const template = {
        version: '1.0',
        project: {
            name: project.name,
            description: project.description || '',
            genre: project.genre || '',
            mode: project.mode || 'novel',
            targetChapters: normalizeTargetChapters(project),
            styleTemplateId: project.styleTemplateId || '',
            settings: project.settings || {}
        },
        constraints: project.constraints || [],
        styleProfile: null,
        newConstraintPresets: [],
        agentTemplates: [],
        agentOverrides: project.agentOverrides || {},
        materials: [],
        chapters: [],
        quests: [],
        timelines: [],
        mapNodes: []
    };

    template.styleProfile = await _exportStyleProfile(project);
    template.newConstraintPresets = await _exportConstraintPresets(project);
    template.agentTemplates = await _exportAgentTemplates(project);

    const materials = await store.queryItems('materials', { projectId });
    template.materials = materials.map(m => ({ type: m.type, name: m.name, content: m.currentContent || m.initialContent || '', tags: m.tags || [] }));

    const chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    template.chapters = chapters.map(c => ({ chapterNumber: c.chapterNumber, title: c.title || '', outline: c.outline || '' }));

    const quests = await store.queryItems('quests', { projectId });
    template.quests = quests.map(q => ({ name: q.name || q.title || '', type: q.type || 'main', description: q.description || '', relatedChapters: q.relatedChapters || [], subQuests: q.subQuests || [] }));

    const timelines = await store.queryItems('timelines', { projectId });
    template.timelines = timelines.map(t => ({ name: t.name || t.title || '', events: t.events || [] }));

    const mapNodes = await store.queryItems('map-nodes', { projectId });
    template.mapNodes = mapNodes.map(n => ({ name: n.name || '', type: n.type || 'location', description: n.description || '', parentId: n.parentId || null, x: n.x || 0, y: n.y || 0 }));

    return template;
}

async function _exportStyleProfile(project) {
    if (!project.styleProfile) return null;
    const profiles = await store.listItems('style-profiles');
    const profile = profiles.find(p => p.key === project.styleProfile);
    if (!profile) return null;
    return {
        id: profile.id, key: profile.key, label: profile.label,
        description: profile.description || '', povRule: profile.povRule || '',
        dialogueRule: profile.dialogueRule || '', behaviorRule: profile.behaviorRule || '',
        toneRule: profile.toneRule || '', reviewFocus: profile.reviewFocus || '',
        materialFocus: profile.materialFocus || '', constraintOverrides: profile.constraintOverrides || [],
        rules: profile.rules || {}
    };
}

async function _exportConstraintPresets(project) {
    const constraintIds = project.constraints || [];
    const storePresets = await store.listItems('constraint-presets');
    const existingIds = new Set(storePresets.map(p => p.id));
    const newPresets = constraintIds.filter(id => !existingIds.has(id));
    if (newPresets.length === 0) return [];
    return newPresets.map(id => {
        const preset = storePresets.find(p => p.id === id);
        return preset
            ? { id: preset.id, label: preset.label, desc: preset.desc || preset.description || '', rules: preset.rules || '', injection_point: preset.injection_point || '', department: preset.department || '', tier: preset.tier || 'TIER2' }
            : { id, label: id, desc: '' };
    });
}

async function _exportAgentTemplates(project) {
    const agentTemplates = await store.listItems('agent-templates');
    const mode = project.mode || 'novel';
    const relevantTemplates = agentTemplates.filter(t => t.agentType && (t.mode === mode || t.mode === 'novel'));
    const seen = new Set();
    const result = [];
    for (const t of relevantTemplates) {
        if (!seen.has(t.agentType)) {
            seen.add(t.agentType);
            result.push({ agentType: t.agentType, mode: t.mode || mode, role: t.role || '', tool: t.tool || '', system: t.system || '' });
        }
    }
    return result;
}

module.exports = { exportProjectAsTemplate };
