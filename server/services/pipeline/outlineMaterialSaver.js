// 素材保存与关联创建：写 store、幂等 upsert、角色关系/装备绑定
const store = require('../../store');
const { v4: uuidv4 } = require('uuid');
const { getDataContext } = require('../dataContext');
const { getDefaultsForGenre } = require('../../config/genreDefaults');
const { createCharacterRelations } = require('./outlineRelationCreator');
const { saveTimelineEvent } = require('../timelineAdapter');
const { normalizeStyleProfile } = require('../../config/styleProfileNormalizer');
const { createEquipmentBinds } = require('./outlineEquipmentBinds');
const { getGenrePlugin } = require('../genreConfig');
const genreProfileRegistry = require('../genreProfileRegistry');
const { resolveMaterialName } = require('./materialNameResolver');
const { STATUS_VALUES } = require('../chapterStatus');

function buildCharTags(isChar, mat) {
    if (!isChar) return [];
    return [
        ...(mat.isMainCharacter ? ['主角'] : []),
        ...(mat.roleLevel === 'supporting' ? ['配角'] : []),
        ...((!mat.roleLevel || mat.roleLevel === 'npc') && !mat.isMainCharacter ? ['NPC'] : [])
    ];
}

async function saveMaterial(projectId, mat) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const isChar = mat.type === 'character';
    const roleLevel = isChar ? (mat.isMainCharacter ? 'protagonist' : (mat.roleLevel || 'npc')) : undefined;
    const item = {
        id, projectId, type: mat.type || 'other', name: resolveMaterialName(mat),
        description: '', initialContent: mat.content || '', currentContent: mat.content || '',
        tags: buildCharTags(isChar, mat), roleLevel,
        isMainCharacter: isChar ? !!mat.isMainCharacter : undefined,
        isLocked: mat.type === 'worldview', version: 1,
        changeLog: [{ from: '', to: mat.content || '', reason: 'Initial creation', timestamp: now }],
        createdAt: now, updatedAt: now
    };
    await store.setItem('materials', id, item);
    return item;
}

async function findExistingMaterial(projectId, type, name) {
    if (!name) return null;
    const existing = await store.queryItems('materials', { projectId, type });
    return existing.find(m => !m.archived && m.name === name) || null;
}

async function findExistingCharacterMaterial(projectId, name) {
    return findExistingMaterial(projectId, 'character', name);
}

async function updateExistingMaterial(existingMat, newContent) {
    const updated = {
        ...existingMat, currentContent: newContent || existingMat.currentContent,
        version: (existingMat.version || 1) + 1, updatedAt: new Date().toISOString()
    };
    await store.setItem('materials', existingMat.id, updated);
    return updated;
}

async function saveTemplateOutlines(projectId, chapterOutlines) {
    let count = 0;
    const now = new Date().toISOString();
    for (const ol of chapterOutlines) {
        const id = uuidv4();
        await store.setItem('chapter-outlines', id, { id, projectId, chapterNumber: ol.chapterNumber, title: ol.title || '', outline: ol.outline || '', createdAt: now });

        // 同步创建chapters记录，与saveChapterOutlines保持一致
        const chapterId = uuidv4();
        await store.setItem('chapters', chapterId, {
            id: chapterId,
            projectId,
            chapterNumber: ol.chapterNumber,
            title: ol.title || '',
            outline: ol.outline || '',
            status: STATUS_VALUES.OUTLINED,
            round: 0,
            wordCount: 0,
            createdAt: now,
            updatedAt: now
        });

        count++;
    }
    return { count };
}

async function saveMainQuests(projectId, quests) {
    for (const q of quests) {
        const id = uuidv4();
        await store.setItem('quests', id, { id, projectId, title: q.title, description: q.description, priority: q.priority || 'normal', subQuests: q.subQuests || [], createdAt: new Date().toISOString() });
    }
}

async function saveTimeline(projectId, events) {
    // 统一写入 timeline-events 表（SOP: 时间轴数据源统一，禁止写 timelines 表）
    for (const ev of events) {
        const id = ev.id || uuidv4();
        await saveTimelineEvent(projectId, {
            id, projectId, title: ev.title, description: ev.description,
            eventType: ev.eventType, storyTime: ev.storyTime, location: ev.location,
            importance: ev.importance || 'normal', isKeyEvent: !!ev.isKeyEvent,
            createdAt: new Date().toISOString()
        });
    }
}

async function saveChapterOutlines(projectId, outlines) {
    const saved = [];
    const now = new Date().toISOString();
    for (const ol of outlines) {
        const id = uuidv4();
        const item = { id, projectId, chapterNumber: ol.chapterNumber, title: ol.title || '', outline: ol.outline || '', createdAt: now };
        await store.setItem('chapter-outlines', id, item);

        // 同步创建chapters记录，与outlineSupplementer保持一致
        const chapterId = uuidv4();
        const chapter = {
            id: chapterId,
            projectId,
            chapterNumber: ol.chapterNumber,
            title: ol.title || '',
            outline: ol.outline || '',
            status: STATUS_VALUES.OUTLINED,
            round: 0,
            wordCount: 0,
            createdAt: now,
            updatedAt: now
        };
        await store.setItem('chapters', chapterId, chapter);

        saved.push(item);
    }
    return saved;
}

async function saveProjectFromTemplate(template) {
    const { name, genre: genreStr, elements, targetChapters, style, tone, pov, setting, conflict, themes, constraints, wordConfig, subGenre, genreProfile } = template;
    const projectId = uuidv4();
    const elementStr = Array.isArray(elements) ? elements.join('、') : (elements || '');

    // Resolve genre plugin ID for reliable detection
    const genrePlugin = getGenrePlugin({ genre: genreStr });
    const resolvedGenreId = genrePlugin?.id || subGenre || genreProfile || '';
    const resolvedSubGenre = subGenre || resolvedGenreId || '';

    // Build full styleProfile from genreProfileRegistry
    const resolvedProfile = genreProfileRegistry.resolve(genreStr) || genreProfileRegistry.resolve(resolvedGenreId);
    const profileId = resolvedProfile?.id || genreStr;
    const fullConfig = genreProfileRegistry.buildFullConfig(profileId, { style, tone, pov });

    let styleProfile;
    if (fullConfig) {
        styleProfile = {
            key: fullConfig.genreProfile || profileId,
            genre: genreStr,
            genreProfile: fullConfig.genreProfile || genreStr,
            style: fullConfig.styleHints?.style || style || '',
            tone: fullConfig.styleHints?.tone || tone || '',
            pov: fullConfig.styleHints?.pov || pov || '',
            namingStyle: fullConfig.namingStyle || '',
            namingStyleIntensity: fullConfig.namingStyleIntensity || 'medium',
            worldviewTemplate: fullConfig.worldviewTemplate || '',
            systemPersona: fullConfig.defaultSystemPersona || '',
            reviewFocus: (fullConfig.reviewFocus || []).join('；'),
            materialFocus: (fullConfig.materialFocus || []).join('、'),
            constraintOverrides: fullConfig.constraintOverrides || []
        };
    } else {
        styleProfile = { key: resolvedGenreId, genre: genreStr, style, tone, pov, genreProfile: genreProfile || resolvedGenreId };
    }
    // Schema-First：归一化styleProfile，补齐缺失的约束字段（povRule等7个字段）
    styleProfile = normalizeStyleProfile(styleProfile);

    const resolvedWordConfig = wordConfig || fullConfig?.wordConfig || {};

    const project = {
        id: projectId, name, genre: genreStr, description: setting || '',
        mode: 'novel', subGenre: resolvedSubGenre, targetChapters: targetChapters ?? 100, currentChapter: 0,
        status: 'template-generated',
        settings: { autoPipeline: false, chapterRounds: 3, chronicleLevel: 'basic', worldScopeLevel: 'basic' },
        styleTemplateId: '', constraints: constraints || getDefaultsForGenre(null, null).defaultConstraints,
        template: { elements: elementStr, style, tone, pov, conflict, themes },
        wordConfig: resolvedWordConfig,
        styleProfile,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    await store.setItem('projects', projectId, project);
    return projectId;
}

module.exports = {
    saveMaterial, findExistingMaterial, findExistingCharacterMaterial, updateExistingMaterial,
    createCharacterRelations, createEquipmentBinds,
    saveTemplateOutlines, saveMainQuests, saveTimeline, saveChapterOutlines,
    saveProjectFromTemplate
};
