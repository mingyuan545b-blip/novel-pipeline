const store = require('../store');
const { STATUS_VALUES } = require('./chapterStatus');

async function getChapter(chapterId) {
    if (!chapterId) return null;
    return await store.getItem('chapters', chapterId);
}

async function getChaptersByProject(projectId, options = {}) {
    if (!projectId) return [];
    let chapters = await store.queryItems('chapters', { projectId });
    if (options.status) chapters = chapters.filter(c => c.status === options.status);
    if (options.hasContent) chapters = chapters.filter(c => c.content);
    if (!options.includeArchived) chapters = chapters.filter(c => !c.archived);
    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    return chapters;
}

async function getPreviousChapter(projectId, chapterNumber) {
    const chapters = await getChaptersByProject(projectId, { hasContent: true });
    return chapters.filter(c => c.chapterNumber < chapterNumber && (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED))
        .sort((a, b) => b.chapterNumber - a.chapterNumber)[0] || null;
}

async function getChapterByNumber(projectId, chapterNumber) {
    const chapters = await getChaptersByProject(projectId);
    return chapters.find(c => c.chapterNumber === chapterNumber) || null;
}

async function getRecentChapters(projectId, count = 3) {
    const chapters = await getChaptersByProject(projectId, { hasContent: true });
    return chapters.sort((a, b) => b.chapterNumber - a.chapterNumber).slice(0, count);
}

async function getChaptersWithReaderOutput(projectId, beforeChapter, count = 3) {
    const chapters = await getChaptersByProject(projectId);
    return chapters
        .filter(c => c.chapterNumber < beforeChapter && c.readerOutput)
        .sort((a, b) => b.chapterNumber - a.chapterNumber)
        .slice(0, count);
}

async function getSkippedChapters(projectId, beforeChapter) {
    const chapters = await getChaptersByProject(projectId);
    return chapters.filter(c => c.status === 'cooldown-waiting' && c.chapterNumber < beforeChapter);
}

async function updateChapter(chapterId, updates) {
    const chapter = await getChapter(chapterId);
    if (!chapter) return null;
    const updated = { ...chapter, ...updates, updatedAt: new Date().toISOString() };
    await store.setItem('chapters', updated.id, updated);
    return updated;
}

module.exports = {
    getChapter,
    getChaptersByProject,
    getPreviousChapter,
    getChapterByNumber,
    getRecentChapters,
    getChaptersWithReaderOutput,
    getSkippedChapters,
    updateChapter,
};
