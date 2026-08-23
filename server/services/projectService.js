const store = require('../store');
const { getDataContext } = require('./dataContext');
const { STATUS_VALUES } = require('./chapterStatus');

async function getProject(projectId) {
    if (!projectId) return null;
    const ctx = await getDataContext(projectId);
    return await ctx.getProject();
}

async function getStyleConfig(projectId) {
    const project = await getProject(projectId);
    if (!project) return { mode: 'novel', styleProfile: null, wordConfig: {}, genre: null, subGenre: null, season: null, parentProjectId: null };
    const styleTemplate = project.styleTemplateId
        ? await store.getItem('style-templates', project.styleTemplateId)
        : null;
    // Schema-First：通过归一化函数读取targetChapters，兼容targetChapterCount历史字段名
    const { normalizeTargetChapters } = require("../config/targetChaptersNormalizer");
    return {
        mode: project.mode || 'novel',
        styleProfile: project.styleProfile || null,
        styleTemplate,
        wordConfig: project.wordConfig || {},
        genre: project.genre || null,
        subGenre: project.subGenre || null,
        season: project.season || null,
        parentProjectId: project.parentProjectId || null,
        // 统一输出标准字段名targetChapters，同时保留targetChapterCount兼容旧前端
        targetChapters: normalizeTargetChapters(project),
        targetChapterCount: normalizeTargetChapters(project),
        targetWordCount: project.targetWordCount,
    };
}

async function getSubGenre(projectId) {
    const project = await getProject(projectId);
    return project?.subGenre || null;
}

async function getSeason(projectId) {
    const project = await getProject(projectId);
    return project?.season || null;
}

async function getParentProjectId(projectId) {
    const project = await getProject(projectId);
    return project?.parentProjectId || null;
}

async function getPreviousSeasonFinale(projectId) {
    const project = await getProject(projectId);
    if (!project?.parentProjectId) return null;
    const parentProject = await getProject(project.parentProjectId);
    if (!parentProject) return null;
    const seasons = await getSeasonsOfProject(project.parentProjectId);
    const currentSeason = project.season || 1;
    const prevSeason = seasons.find(s => s.season === currentSeason - 1);
    if (!prevSeason) return null;
    const chapters = await store.listItems('chapters');
    const seasonChapters = chapters.filter(c => c.projectId === prevSeason.id && c.status === STATUS_VALUES.APPROVED);
    if (seasonChapters.length === 0) return null;
    seasonChapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    const lastChapter = seasonChapters[seasonChapters.length - 1];
    return {
        seasonNumber: currentSeason - 1,
        projectName: prevSeason.name,
        lastChapterNumber: lastChapter.chapterNumber,
        lastChapterContent: lastChapter.content,
        lastChapterTitle: lastChapter.title,
    };
}

async function getSeasonsOfProject(parentProjectId) {
    if (!parentProjectId) return [];
    const projects = await store.listItems('projects');
    return projects.filter(p => p.parentProjectId === parentProjectId)
        .sort((a, b) => (a.season || 0) - (b.season || 0));
}

async function createNextSeason(parentProjectId, seasonOverrides) {
    const parentProject = await getProject(parentProjectId);
    if (!parentProject) return null;
    const existingSeasons = await getSeasonsOfProject(parentProjectId);
    const nextSeason = (existingSeasons.length > 0 ? Math.max(...existingSeasons.map(s => s.season || 0)) : 0) + 1;
    const newProject = {
        ...parentProject,
        ...seasonOverrides,
        id: undefined,
        parentProjectId,
        season: nextSeason,
        name: seasonOverrides?.name || `${parentProject.name}·第${nextSeason}季`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    delete newProject.id;
    const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    newProject.id = id;
    await store.setItem('projects', id, newProject);
    return { id, season: nextSeason, project: newProject };
}

async function inheritMaterialsFromPreviousSeason(targetProjectId, sourceProjectId) {
    if (!sourceProjectId) return { inherited: 0 };
    const sourceMaterials = await store.listItems('materials');
    const sourceMats = sourceMaterials.filter(m => m.projectId === sourceProjectId);
    let inherited = 0;
    for (const mat of sourceMats) {
        const existing = await store.getItem('materials', mat.id);
        if (existing) continue;
        const newMat = {
            ...mat,
            id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${inherited}`,
            projectId: targetProjectId,
            inheritedFrom: sourceProjectId,
        };
        await store.setItem('materials', newMat.id, newMat);
        inherited++;
    }
    return { inherited };
}

async function getRuleStack(projectId) {
    const project = await getProject(projectId);
    return project?.ruleStack || null;
}

async function getHookBudget(projectId) {
    const project = await getProject(projectId);
    return project?.hookBudget || null;
}

async function getMode(projectId) {
    const project = await getProject(projectId);
    return project?.mode || 'novel';
}

async function getWordConfig(projectId) {
    const project = await getProject(projectId);
    return project?.wordConfig || {};
}

async function updateProject(projectId, updates) {
    const project = await getProject(projectId);
    if (!project) return null;
    const updated = { ...project, ...updates, updatedAt: new Date().toISOString() };
    await store.setItem('projects', projectId, updated);
    return updated;
}

module.exports = {
    getProject, getStyleConfig, getRuleStack, getHookBudget, getMode,
    getSubGenre, getSeason, getParentProjectId, getPreviousSeasonFinale,
    getSeasonsOfProject, createNextSeason, inheritMaterialsFromPreviousSeason,
    getWordConfig, updateProject
};
