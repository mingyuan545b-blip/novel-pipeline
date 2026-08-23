const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { PLATFORMS } = require('./publishPlatforms');

async function addToPublishQueue(projectId, queueData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const item = {
        id,
        projectId,
        chapterId: queueData.chapterId || '',
        chapterNumber: queueData.chapterNumber || 0,
        chapterTitle: queueData.chapterTitle || '',
        content: queueData.content || '',
        platformAccountId: queueData.platformAccountId || '',
        platformName: queueData.platformName || '',
        scheduledTime: queueData.scheduledTime || now,
        status: 'pending',
        publishedAt: null,
        publishedUrl: '',
        errorMessage: '',
        retryCount: 0,
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('publish-queue', id, item);
    return item;
}

async function getPublishQueue(projectId) {
    return (await store.queryItems('publish-queue', { projectId }))
        .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
}

async function updatePublishQueueItem(id, data) {
    const item = await store.getItem('publish-queue', id);
    if (!item) return null;
    const updated = { ...item, ...data, updatedAt: new Date().toISOString() };
    await store.setItem('publish-queue', id, updated);
    return updated;
}

async function deletePublishQueueItem(id) {
    return await store.deleteItem('publish-queue', id);
}

function formatContentForPlatform(content, platformId, chapterNumber, chapterTitle) {
    const platform = PLATFORMS[platformId] || PLATFORMS.custom;
    const naming = platform.chapterNaming
        .replace('{n}', chapterNumber)
        .replace('{title}', chapterTitle);

    let formatted = `${naming}\n\n${content}`;

    if (content.length > platform.maxWordsPerChapter) {
        formatted = formatted.substring(0, platform.maxWordsPerChapter);
        formatted += '\n\n(本章字数超出平台限制，已自动截断)';
    }

    return {
        title: naming,
        content: formatted,
        wordCount: formatted.length,
        platformId,
        platformName: platform.name,
        withinLimit: content.length <= platform.maxWordsPerChapter,
        maxWords: platform.maxWordsPerChapter
    };
}

function batchAddToQueue(projectId, chapters, platformAccountId, platformName, scheduleInterval) {
    const created = [];
    const now = new Date();
    const intervalMs = (scheduleInterval || 30) * 60 * 1000;

    for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        if (!ch.content) continue;
        const scheduledTime = new Date(now.getTime() + i * intervalMs).toISOString();
        const item = addToPublishQueue(projectId, {
            chapterId: ch.id,
            chapterNumber: ch.chapterNumber,
            chapterTitle: ch.title,
            content: ch.content,
            platformAccountId,
            platformName,
            scheduledTime
        });
        created.push(item);
    }
    return created;
}

async function getPublishStats(projectId) {
    const queue = await store.queryItems('publish-queue', { projectId });
    const accounts = await store.queryItems('platform-accounts', { projectId });
    return {
        totalQueued: queue.filter(i => i.status === 'pending').length,
        totalPublished: queue.filter(i => i.status === 'published').length,
        totalFailed: queue.filter(i => i.status === 'failed').length,
        platformCount: accounts.length,
        byPlatform: accounts.map(a => ({
            platformName: a.platformName,
            published: queue.filter(q => q.platformAccountId === a.id && q.status === 'published').length,
            pending: queue.filter(q => q.platformAccountId === a.id && q.status === 'pending').length
        }))
    };
}

module.exports = {
    addToPublishQueue,
    getPublishQueue,
    updatePublishQueueItem,
    deletePublishQueueItem,
    formatContentForPlatform,
    batchAddToQueue,
    getPublishStats
};
