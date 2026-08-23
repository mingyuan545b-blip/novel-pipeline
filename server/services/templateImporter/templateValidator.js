const store = require('../../store');

const REQUIRED_SECTIONS = ['project', 'constraints', 'styleProfile', 'agentTemplates'];
const OPTIONAL_SECTIONS = ['materials', 'chapters', 'quests', 'timelines', 'mapNodes', 'agentOverrides'];
const MATERIAL_TYPES = ['worldview', 'character', 'relationship', 'power-system', 'equipment', 'location', 'catchphrase', 'famous-scene', 'growth-history', 'foreshadowing', 'index'];

async function validateTemplate(template) {
    const errors = [];
    const warnings = [];

    if (!template || typeof template !== 'object') {
        return { valid: false, errors: ['范本格式错误：必须为JSON对象'], warnings: [] };
    }

    if (!template.version) errors.push('缺少 version 字段（推荐值: "1.0"）');

    _validateProject(template, errors);
    await _validateConstraints(template, errors, warnings);
    _validateStyleProfile(template, errors);
    _validateAgentTemplates(template, errors, warnings);
    _validateMaterials(template, errors, warnings);
    _validateChapters(template, errors, warnings);
    _validateConstraintPresets(template, errors);

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
            hasProject: !!template.project,
            constraintCount: Array.isArray(template.constraints) ? template.constraints.length : 0,
            newConstraintCount: Array.isArray(template.newConstraintPresets) ? template.newConstraintPresets.length : 0,
            hasStyleProfile: !!template.styleProfile,
            agentTemplateCount: Array.isArray(template.agentTemplates) ? template.agentTemplates.length : 0,
            materialCount: Array.isArray(template.materials) ? template.materials.length : 0,
            chapterCount: Array.isArray(template.chapters) ? template.chapters.length : 0,
            questCount: Array.isArray(template.quests) ? template.quests.length : 0,
            timelineCount: Array.isArray(template.timelines) ? template.timelines.length : 0,
            mapNodeCount: Array.isArray(template.mapNodes) ? template.mapNodes.length : 0,
            hasAgentOverrides: !!template.agentOverrides && Object.keys(template.agentOverrides).length > 0
        }
    };
}

function _validateProject(template, errors) {
    if (!template.project) {
        errors.push('缺少 project 配置节');
    } else {
        if (!template.project.name) errors.push('project.name 缺失');
        if (!template.project.mode) errors.push('project.mode 缺失（可选值: novel）');
        else if (template.project.mode !== 'novel') errors.push(`project.mode 无效: ${template.project.mode}（可选值: novel）`);
    }
}

async function _validateConstraints(template, errors, warnings) {
    if (!template.constraints) {
        errors.push('缺少 constraints 配置节（写作约束，至少需要空数组）');
    } else if (!Array.isArray(template.constraints)) {
        errors.push('constraints 必须为数组');
    } else {
        const storePresets = await store.listItems('constraint-presets');
        const presetIds = new Set(storePresets.map(p => p.id));
        const unknown = template.constraints.filter(id => !presetIds.has(id));
        if (unknown.length > 0) warnings.push(`约束预设不存在于store，需随范本创建: ${unknown.join(', ')}`);
    }
}

function _validateStyleProfile(template, errors) {
    if (!template.styleProfile) {
        errors.push('缺少 styleProfile 配置节（风格配置，至少需要 key 和 label）');
    } else {
        if (!template.styleProfile.key) errors.push('styleProfile.key 缺失');
        if (!template.styleProfile.label) errors.push('styleProfile.label 缺失');
    }
}

function _validateAgentTemplates(template, errors, warnings) {
    if (!template.agentTemplates) {
        errors.push('缺少 agentTemplates 配置节（Agent模板列表）');
    } else if (!Array.isArray(template.agentTemplates)) {
        errors.push('agentTemplates 必须为数组');
    } else {
        const requiredAgents = ['writer', 'first-review', 'final-editor', 'material-manager'];
        const templateTypes = new Set(template.agentTemplates.map(t => t.agentType));
        for (const req of requiredAgents) {
            if (!templateTypes.has(req)) warnings.push(`缺少核心Agent模板: ${req}`);
        }
        template.agentTemplates.forEach((t, i) => {
            if (!t.agentType) errors.push(`agentTemplates[${i}].agentType 缺失`);
            if (!t.system) errors.push(`agentTemplates[${i}].system 缺失（${t.agentType || i}）`);
        });
    }
}

function _validateMaterials(template, errors, warnings) {
    if (template.materials) {
        if (!Array.isArray(template.materials)) errors.push('materials 必须为数组');
        else template.materials.forEach((m, i) => {
            if (!m.type) errors.push(`materials[${i}].type 缺失`);
            else if (!MATERIAL_TYPES.includes(m.type)) warnings.push(`materials[${i}].type 非标准: ${m.type}`);
            if (!m.name) errors.push(`materials[${i}].name 缺失`);
            if (!m.content && !m.currentContent) warnings.push(`materials[${i}] 缺少内容`);
        });
    } else {
        warnings.push('缺少 materials 配置节（素材数据），导入后需手动创建');
    }
}

function _validateChapters(template, errors, warnings) {
    if (template.chapters) {
        if (!Array.isArray(template.chapters)) errors.push('chapters 必须为数组');
        else template.chapters.forEach((c, i) => {
            if (c.chapterNumber === undefined) errors.push(`chapters[${i}].chapterNumber 缺失`);
            if (!c.outline) warnings.push(`chapters[${i}] 缺少大纲`);
        });
    } else {
        warnings.push('缺少 chapters 配置节（章节大纲），导入后需手动生成');
    }
}

function _validateConstraintPresets(template, errors) {
    if (template.newConstraintPresets) {
        if (!Array.isArray(template.newConstraintPresets)) errors.push('newConstraintPresets 必须为数组');
        else template.newConstraintPresets.forEach((p, i) => {
            if (!p.id) errors.push(`newConstraintPresets[${i}].id 缺失`);
            if (!p.label) errors.push(`newConstraintPresets[${i}].label 缺失`);
            if (!p.desc && !p.description) errors.push(`newConstraintPresets[${i}].desc 缺失`);
        });
    }
}

module.exports = { validateTemplate, REQUIRED_SECTIONS, OPTIONAL_SECTIONS, MATERIAL_TYPES };
