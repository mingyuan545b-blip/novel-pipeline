const store = require('../store');
const { getConstraintPresets } = require('./agentPrompts');
const { detectGenre, getGenreById } = require('./genreConfig');

const REQUIRED_SECTIONS = ['project', 'constraints', 'styleProfile', 'agentTemplates'];
const OPTIONAL_SECTIONS = ['materials', 'chapters', 'quests', 'timelines', 'mapNodes', 'agentOverrides'];

const MATERIAL_TYPES = ['worldview', 'character', 'relationship', 'power-system', 'equipment', 'location', 'catchphrase', 'famous-scene', 'growth-history', 'foreshadowing', 'index'];

function validateTemplate(template) {
    const errors = [];
    const warnings = [];

    if (!template || typeof template !== 'object') {
        return { valid: false, errors: ['范本格式错误：必须为JSON对象'], warnings: [] };
    }

    if (!template.version) {
        errors.push('缺少 version 字段（推荐值: "1.0"）');
    }

    if (!template.project) {
        errors.push('缺少 project 配置节');
    } else {
        if (!template.project.name) errors.push('project.name 缺失');
        if (!template.project.mode) {
            errors.push('project.mode 缺失（可选值: novel/shuangwen/tomato-short）');
        } else if (!['novel', 'shuangwen', 'tomato-short'].includes(template.project.mode)) {
            errors.push(`project.mode 无效: ${template.project.mode}（可选值: novel/shuangwen/tomato-short）`);
        }
    }

    if (!template.constraints) {
        errors.push('缺少 constraints 配置节（写作约束，至少需要空数组）');
    } else {
        if (!Array.isArray(template.constraints)) {
            errors.push('constraints 必须为数组');
        } else {
            const storePresets = store.listItems('constraint-presets');
            const presetIds = new Set(storePresets.map(p => p.id));
            const unknown = template.constraints.filter(id => !presetIds.has(id));
            if (unknown.length > 0) {
                warnings.push(`约束预设不存在于store，需随范本创建: ${unknown.join(', ')}`);
            }
        }
    }

    if (!template.styleProfile) {
        errors.push('缺少 styleProfile 配置节（风格配置，至少需要 key 和 label）');
    } else {
        if (!template.styleProfile.key) errors.push('styleProfile.key 缺失');
        if (!template.styleProfile.label) errors.push('styleProfile.label 缺失');
    }

    if (!template.agentTemplates) {
        errors.push('缺少 agentTemplates 配置节（Agent模板列表）');
    } else if (!Array.isArray(template.agentTemplates)) {
        errors.push('agentTemplates 必须为数组');
    } else {
        const requiredAgents = ['writer', 'first-review', 'final-editor', 'material-manager'];
        const templateTypes = new Set(template.agentTemplates.map(t => t.agentType));
        for (const req of requiredAgents) {
            if (!templateTypes.has(req)) {
                warnings.push(`缺少核心Agent模板: ${req}`);
            }
        }
        template.agentTemplates.forEach((t, i) => {
            if (!t.agentType) errors.push(`agentTemplates[${i}].agentType 缺失`);
            if (!t.system) errors.push(`agentTemplates[${i}].system 缺失（${t.agentType || i}）`);
        });
    }

    if (template.materials) {
        if (!Array.isArray(template.materials)) {
            errors.push('materials 必须为数组');
        } else {
            template.materials.forEach((m, i) => {
                if (!m.type) errors.push(`materials[${i}].type 缺失`);
                else if (!MATERIAL_TYPES.includes(m.type)) warnings.push(`materials[${i}].type 非标准: ${m.type}`);
                if (!m.name) errors.push(`materials[${i}].name 缺失`);
                if (!m.content && !m.currentContent) warnings.push(`materials[${i}] 缺少内容`);
            });
        }
    } else {
        warnings.push('缺少 materials 配置节（素材数据），导入后需手动创建');
    }

    if (template.chapters) {
        if (!Array.isArray(template.chapters)) {
            errors.push('chapters 必须为数组');
        } else {
            template.chapters.forEach((c, i) => {
                if (c.chapterNumber === undefined) errors.push(`chapters[${i}].chapterNumber 缺失`);
                if (!c.outline) warnings.push(`chapters[${i}] 缺少大纲`);
            });
        }
    } else {
        warnings.push('缺少 chapters 配置节（章节大纲），导入后需手动生成');
    }

    if (template.newConstraintPresets) {
        if (!Array.isArray(template.newConstraintPresets)) {
            errors.push('newConstraintPresets 必须为数组');
        } else {
            template.newConstraintPresets.forEach((p, i) => {
                if (!p.id) errors.push(`newConstraintPresets[${i}].id 缺失`);
                if (!p.label) errors.push(`newConstraintPresets[${i}].label 缺失`);
                if (!p.desc && !p.description) errors.push(`newConstraintPresets[${i}].desc 缺失`);
            });
        }
    }

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

async function importTemplate(template, options = {}) {
    const { overwrite = false, projectId: existingProjectId = null } = options;
    const { v4: uuidv4 } = require('uuid');
    const result = { projectId: null, created: {}, skipped: {}, errors: [] };

    const validation = validateTemplate(template);
    if (!validation.valid) {
        throw new Error('范本校验失败:\n' + validation.errors.join('\n'));
    }

    const projectId = existingProjectId || uuidv4();
    result.projectId = projectId;

    if (template.newConstraintPresets && template.newConstraintPresets.length > 0) {
        let created = 0;
        for (const preset of template.newConstraintPresets) {
            const existing = store.getItem('constraint-presets', preset.id);
            if (existing && !overwrite) {
                result.skipped[`constraint-preset:${preset.id}`] = '已存在';
                continue;
            }
            await store.setItem('constraint-presets', preset.id, {
                id: preset.id,
                label: preset.label,
                desc: preset.desc || preset.description || '',
                rules: preset.rules || '',
                injection_point: preset.injection_point || preset.injectionPoint || 'writer',
                department: preset.department || preset.category || '',
                tier: preset.tier || 'TIER2',
                createdAt: new Date().toISOString()
            });
            created++;
        }
        result.created['constraintPresets'] = created;
    }

    if (template.styleProfile) {
        const sp = template.styleProfile;
        const spId = sp.id || `profile_${sp.key}`;
        const existing = store.getItem('style-profiles', spId);

        const detectedGenre = detectGenre(sp);
        const genreBase = detectedGenre?.genreBase || null;

        let mergedBehaviorRule = sp.behaviorRule || '';
        let mergedToneRule = sp.toneRule || '';
        let mergedReviewFocus = Array.isArray(sp.reviewFocus) ? sp.reviewFocus.join('\n') : (sp.reviewFocus || '');
        let mergedConstraintOverrides = [...(sp.constraintOverrides || [])];

        if (genreBase) {
            if (genreBase.BEHAVIOR_APPEND && !mergedBehaviorRule.includes('科技描写降维规则')) {
                mergedBehaviorRule += '\n' + genreBase.BEHAVIOR_APPEND;
            }
            if (genreBase.TONE_APPEND && !mergedToneRule.includes('禁用恐怖/克苏鲁意象')) {
                mergedToneRule += '\n' + genreBase.TONE_APPEND;
            }
            if (genreBase.REVIEW_APPEND && !mergedReviewFocus.includes('科技描写降维检查')) {
                mergedReviewFocus += genreBase.REVIEW_APPEND;
            }
            if (genreBase.REQUIRED_CONSTRAINT_OVERRIDES) {
                for (const rc of genreBase.REQUIRED_CONSTRAINT_OVERRIDES) {
                    if (!mergedConstraintOverrides.includes(rc)) {
                        mergedConstraintOverrides.push(rc);
                    }
                }
            }
        }

        if (existing && !overwrite) {
            result.skipped['styleProfile'] = '已存在';
        } else {
            const baseData = {
                id: spId,
                key: sp.key,
                label: sp.label,
                description: sp.description || sp.desc || '',
                povRule: sp.povRule || '',
                dialogueRule: sp.dialogueRule || '',
                behaviorRule: mergedBehaviorRule,
                toneRule: mergedToneRule,
                reviewFocus: mergedReviewFocus,
                materialFocus: sp.materialFocus || '',
                constraintOverrides: mergedConstraintOverrides,
                rules: sp.rules || {},
                createdAt: new Date().toISOString()
            };

            if (existing && overwrite) {
                baseData.povRule = sp.povRule || existing.povRule || '';
                baseData.dialogueRule = sp.dialogueRule || existing.dialogueRule || '';
                baseData.description = sp.description || sp.desc || existing.description || '';
                baseData.materialFocus = sp.materialFocus || existing.materialFocus || '';
                baseData.rules = sp.rules || existing.rules || {};
                if (existing.characterRefRules && !baseData.characterRefRules) {
                    baseData.characterRefRules = existing.characterRefRules;
                }
                baseData.createdAt = existing.createdAt || baseData.createdAt;
            }

            await store.setItem('style-profiles', spId, baseData);
            result.created['styleProfile'] = 1;
        }
    }

    if (template.agentTemplates && template.agentTemplates.length > 0) {
        let created = 0;
        for (const tpl of template.agentTemplates) {
            const tplId = tpl.id || `tpl_${tpl.agentType}_${template.project.mode || 'novel'}`;
            const existing = store.getItem('agent-templates', tplId);
            if (existing && !overwrite) {
                result.skipped[`agentTemplate:${tpl.agentType}`] = '已存在';
                continue;
            }
            await store.setItem('agent-templates', tplId, {
                id: tplId,
                agentType: tpl.agentType,
                mode: tpl.mode || template.project.mode || 'novel',
                role: tpl.role || tpl.agentType,
                tool: tpl.tool || `novel-pipeline-${tpl.agentType}`,
                system: tpl.system,
                createdAt: new Date().toISOString()
            });
            created++;
        }
        result.created['agentTemplates'] = created;
    }

    const project = existingProjectId ? store.getItem('projects', existingProjectId) : null;

    const rawConstraints = template.constraints || [];
    const styleProfileKey = template.styleProfile?.key || '';
    const detectedGenre2 = detectGenre(template.styleProfile);
    const isGenreDetected = !!detectedGenre2;
    const INCOMPATIBLE_CONSTRAINTS = detectedGenre2?.incompatibleConstraints || [];
    const REQUIRED_CONSTRAINTS = detectedGenre2?.requiredConstraints || [];
    let filteredConstraints = rawConstraints;
    if (isGenreDetected && (INCOMPATIBLE_CONSTRAINTS.length > 0 || REQUIRED_CONSTRAINTS.length > 0)) {
        filteredConstraints = rawConstraints.filter(c => !INCOMPATIBLE_CONSTRAINTS.includes(c));
        for (const rc of REQUIRED_CONSTRAINTS) {
            if (!filteredConstraints.includes(rc)) filteredConstraints.push(rc);
        }
        if (filteredConstraints.length !== rawConstraints.length) {
            const removed = rawConstraints.filter(c => !filteredConstraints.includes(c));
            result.warnings = result.warnings || [];
            result.warnings.push(`${detectedGenre2.label || detectedGenre2.id}题材自动移除不兼容约束: ${removed.join(', ')}`);
        }
    }
    const CONSTRAINT_PRESETS = getConstraintPresets(detectedGenre2);
    const validConstraints = filteredConstraints.filter(c => CONSTRAINT_PRESETS[c]);

    const projectData = {
        id: projectId,
        name: template.project.name || 'Untitled',
        description: template.project.description || '',
        genre: template.project.genre || '',
        mode: template.project.mode || 'novel',
        targetChapters: template.project.targetChapters || 100,
        currentChapter: 0,
        status: 'outlined',
        constraints: validConstraints,
        styleProfile: styleProfileKey,
        styleTemplateId: template.project.styleTemplateId || '',
        agentOverrides: template.agentOverrides || {},
        settings: template.project.settings || { autoPipeline: false, chapterRounds: 3 },
        createdAt: project?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await store.setItem('projects', projectId, projectData);
    result.created['project'] = 1;

    if (template.materials && template.materials.length > 0) {
        let created = 0;
        let skipped = 0;
        const existingMaterials = store.queryItems('materials', { projectId });
        const existingKeys = new Set(existingMaterials.map(em => `${em.type}:${em.name}`));
        for (const m of template.materials) {
            const dedupeKey = `${m.type}:${m.name}`;
            if (existingKeys.has(dedupeKey)) {
                skipped++;
                continue;
            }
            const matId = m.id || uuidv4();
            const content = m.content || m.currentContent || '';
            const matData = {
                id: matId,
                projectId,
                type: m.type,
                name: m.name,
                initialContent: content,
                currentContent: content,
                version: 1,
                status: 'active',
                tags: m.tags || [],
                changeLog: [{ action: 'import', from: 'template', at: new Date().toISOString() }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            if (m.type === 'character' && m.refNames) {
                matData.refNames = m.refNames;
            } else if (m.type === 'character' && !m.refNames) {
                const gender = content.includes('女') || m.name.includes('妈') || m.name.includes('姐') || m.name.includes('妹') || m.name.includes('姑') || m.name.includes('姨') ? '她' : '他';
                matData.refNames = { narrator: m.name.split('（')[0].split('(')[0].trim(), pronoun: gender };
            }
            await store.setItem('materials', matId, matData);
            created++;
        }
        result.created['materials'] = created;
        if (skipped > 0) {
            result.skipped['materials'] = `${skipped} duplicates by type:name`;
        }
    }

    if (template.chapters && template.chapters.length > 0) {
        let created = 0;
        let chSkipped = 0;
        const existingChapters = store.queryItems('chapters', { projectId });
        const existingChNums = new Set(existingChapters.map(ec => ec.chapterNumber));
        for (const c of template.chapters) {
            if (existingChNums.has(c.chapterNumber)) {
                chSkipped++;
                continue;
            }
            const chId = c.id || uuidv4();
            await store.setItem('chapters', chId, {
                id: chId,
                projectId,
                chapterNumber: c.chapterNumber,
                title: c.title || `第${c.chapterNumber}章`,
                outline: c.outline || '',
                status: 'outlined',
                round: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            created++;
        }
        result.created['chapters'] = created;
        if (chSkipped > 0) {
            result.skipped['chapters'] = `${chSkipped} duplicates by chapterNumber`;
        }
    }

    if (template.quests && template.quests.length > 0) {
        let created = 0;
        let qSkipped = 0;
        const existingQuests = store.queryItems('quests', { projectId });
        const existingQNames = new Set(existingQuests.map(eq => eq.name));
        for (const q of template.quests) {
            const qName = q.name || q.title || '';
            if (existingQNames.has(qName)) { qSkipped++; continue; }
            const qId = q.id || uuidv4();
            await store.setItem('quests', qId, {
                id: qId,
                projectId,
                name: qName,
                type: q.type || 'main',
                description: q.description || '',
                status: q.status || 'pending',
                relatedChapters: q.relatedChapters || [],
                subQuests: q.subQuests || [],
                createdAt: new Date().toISOString()
            });
            created++;
        }
        result.created['quests'] = created;
        if (qSkipped > 0) result.skipped['quests'] = `${qSkipped} duplicates by name`;
    }

    if (template.timelines && template.timelines.length > 0) {
        let created = 0;
        let tSkipped = 0;
        const existingTimelines = store.queryItems('timelines', { projectId });
        const existingTNames = new Set(existingTimelines.map(et => et.name));
        for (const t of template.timelines) {
            const tName = t.name || t.title || '';
            if (existingTNames.has(tName)) { tSkipped++; continue; }
            const tId = t.id || uuidv4();
            await store.setItem('timelines', tId, {
                id: tId,
                projectId,
                name: tName,
                events: t.events || [],
                createdAt: new Date().toISOString()
            });
            created++;
        }
        result.created['timelines'] = created;
        if (tSkipped > 0) result.skipped['timelines'] = `${tSkipped} duplicates by name`;
    }

    if (template.mapNodes && template.mapNodes.length > 0) {
        let created = 0;
        let nSkipped = 0;
        const existingNodes = store.queryItems('map-nodes', { projectId });
        const existingNNames = new Set(existingNodes.map(en => en.name));
        for (const n of template.mapNodes) {
            if (existingNNames.has(n.name || '')) { nSkipped++; continue; }
            const nId = n.id || uuidv4();
            await store.setItem('map-nodes', nId, {
                id: nId,
                projectId,
                name: n.name || '',
                type: n.type || 'location',
                description: n.description || '',
                parentId: n.parentId || null,
                children: n.children || [],
                x: n.x || 0,
                y: n.y || 0,
                createdAt: new Date().toISOString()
            });
            created++;
        }
        result.created['mapNodes'] = created;
        if (nSkipped > 0) result.skipped['mapNodes'] = `${nSkipped} duplicates by name`;
    }

    return result;
}

function exportProjectAsTemplate(projectId) {
    const project = store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const template = {
        version: '1.0',
        project: {
            name: project.name,
            description: project.description || '',
            genre: project.genre || '',
            mode: project.mode || 'novel',
            targetChapters: project.targetChapters || 100,
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

    if (project.styleProfile) {
        const profiles = store.listItems('style-profiles');
        const profile = profiles.find(p => p.key === project.styleProfile);
        if (profile) {
            template.styleProfile = {
                id: profile.id,
                key: profile.key,
                label: profile.label,
                description: profile.description || '',
                povRule: profile.povRule || '',
                dialogueRule: profile.dialogueRule || '',
                behaviorRule: profile.behaviorRule || '',
                toneRule: profile.toneRule || '',
                reviewFocus: profile.reviewFocus || '',
                materialFocus: profile.materialFocus || '',
                constraintOverrides: profile.constraintOverrides || [],
                rules: profile.rules || {}
            };
        }
    }

    const constraintIds = project.constraints || [];
    const storePresets = store.listItems('constraint-presets');
    const existingIds = new Set(storePresets.map(p => p.id));
    const newPresets = constraintIds.filter(id => !existingIds.has(id));
    if (newPresets.length > 0) {
        template.newConstraintPresets = newPresets.map(id => {
            const preset = storePresets.find(p => p.id === id);
            return preset ? { id: preset.id, label: preset.label, desc: preset.desc || preset.description || '', rules: preset.rules || '', injection_point: preset.injection_point || '', department: preset.department || '', tier: preset.tier || 'TIER2' } : { id, label: id, desc: '' };
        });
    }

    const agentTemplates = store.listItems('agent-templates');
    const mode = project.mode || 'novel';
    const relevantTemplates = agentTemplates.filter(t => t.agentType && (t.mode === mode || t.mode === 'novel'));
    const seen = new Set();
    for (const t of relevantTemplates) {
        if (!seen.has(t.agentType)) {
            seen.add(t.agentType);
            template.agentTemplates.push({
                agentType: t.agentType,
                mode: t.mode || mode,
                role: t.role || '',
                tool: t.tool || '',
                system: t.system || ''
            });
        }
    }

    const materials = store.queryItems('materials', { projectId });
    template.materials = materials.map(m => ({
        type: m.type,
        name: m.name,
        content: m.currentContent || m.initialContent || '',
        tags: m.tags || []
    }));

    const chapters = store.queryItems('chapters', { projectId }).sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    template.chapters = chapters.map(c => ({
        chapterNumber: c.chapterNumber,
        title: c.title || '',
        outline: c.outline || ''
    }));

    const quests = store.queryItems('quests', { projectId });
    template.quests = quests.map(q => ({
        name: q.name || q.title || '',
        type: q.type || 'main',
        description: q.description || '',
        relatedChapters: q.relatedChapters || [],
        subQuests: q.subQuests || []
    }));

    const timelines = store.queryItems('timelines', { projectId });
    template.timelines = timelines.map(t => ({
        name: t.name || t.title || '',
        events: t.events || []
    }));

    const mapNodes = store.queryItems('map-nodes', { projectId });
    template.mapNodes = mapNodes.map(n => ({
        name: n.name || '',
        type: n.type || 'location',
        description: n.description || '',
        parentId: n.parentId || null,
        x: n.x || 0,
        y: n.y || 0
    }));

    return template;
}

module.exports = { validateTemplate, importTemplate, exportProjectAsTemplate, REQUIRED_SECTIONS, OPTIONAL_SECTIONS, MATERIAL_TYPES };
