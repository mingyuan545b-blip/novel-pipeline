const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const fs = require('fs');
const path = require('path');
const { cleanChapterContent } = require('./contentUtils');

const PLATFORMS = {
    fanqie: {
        name: '番茄小说',
        url: 'https://fanqienovel.com',
        color: '#FF6B35',
        maxWordsPerChapter: 20000,
        minWordsPerChapter: 1000,
        features: ['free-read', 'ad-revenue', 'signed-author'],
        chapterNaming: '第{n}章 {title}',
        requiresReview: true
    },
    qidian: {
        name: '起点中文网',
        url: 'https://www.qidian.com',
        color: '#C4A44A',
        maxWordsPerChapter: 10000,
        minWordsPerChapter: 2000,
        features: ['vip', 'subscription', 'monthly-ticket', 'recommendation'],
        chapterNaming: '第{n}章 {title}',
        requiresReview: true
    },
    feilu: {
        name: '飞卢小说',
        url: 'https://www.faloo.com',
        color: '#4A90D9',
        maxWordsPerChapter: 15000,
        minWordsPerChapter: 1000,
        features: ['vip', 'fast-update', 'reward'],
        chapterNaming: '第{n}章 {title}',
        requiresReview: false
    },
    zongheng: {
        name: '纵横中文网',
        url: 'https://www.zongheng.com',
        color: '#E23131',
        maxWordsPerChapter: 10000,
        minWordsPerChapter: 2000,
        features: ['vip', 'subscription', 'contract'],
        chapterNaming: '第{n}章 {title}',
        requiresReview: true
    },
    seventeenk: {
        name: '17K小说',
        url: 'https://www.17k.com',
        color: '#FF8C00',
        maxWordsPerChapter: 10000,
        minWordsPerChapter: 2000,
        features: ['vip', 'subscription'],
        chapterNaming: '第{n}章 {title}',
        requiresReview: true
    },
    custom: {
        name: '自定义平台',
        url: '',
        color: '#888888',
        maxWordsPerChapter: 50000,
        minWordsPerChapter: 500,
        features: [],
        chapterNaming: '第{n}章 {title}',
        requiresReview: false
    }
};

function getPlatforms() {
    return Object.entries(PLATFORMS).map(([key, value]) => ({
        id: key,
        ...value
    }));
}

function getPlatform(id) {
    return PLATFORMS[id] ? { id, ...PLATFORMS[id] } : null;
}

function addPlatformAccount(projectId, accountData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const account = {
        id,
        projectId,
        platformId: accountData.platformId,
        platformName: PLATFORMS[accountData.platformId]?.name || accountData.platformId,
        penName: accountData.penName || '',
        bookId: accountData.bookId || '',
        bookTitle: accountData.bookTitle || '',
        bookUrl: accountData.bookUrl || '',
        apiKey: accountData.apiKey || '',
        cookie: accountData.cookie || '',
        autoPublish: accountData.autoPublish || false,
        defaultSchedule: accountData.defaultSchedule || '09:00',
        status: 'active',
        notes: accountData.notes || '',
        createdAt: now,
        updatedAt: now
    };
    store.setItem('platform-accounts', id, account);
    return account;
}

function getPlatformAccounts(projectId) {
    return store.queryItems('platform-accounts', { projectId });
}

function updatePlatformAccount(id, data) {
    const account = store.getItem('platform-accounts', id);
    if (!account) return null;
    const updated = { ...account, ...data, updatedAt: new Date().toISOString() };
    store.setItem('platform-accounts', id, updated);
    return updated;
}

function deletePlatformAccount(id) {
    return store.deleteItem('platform-accounts', id);
}

async function verifyPlatformAccount(id) {
    const account = store.getItem('platform-accounts', id);
    if (!account) return { valid: false, message: 'Account not found' };

    const platform = PLATFORMS[account.platformId];
    if (!platform) return { valid: false, message: 'Unknown platform' };

    if (account.cookie) {
        try {
            const axios = require('axios');
            const res = await axios.get(platform.url, {
                headers: { Cookie: account.cookie },
                timeout: 15000,
                maxRedirects: 3
            });
            const html = res.data || '';
            const hasLogin = html.includes(account.penName || '') ||
                html.includes('logout') || html.includes('退出') ||
                html.includes('write') || html.includes('写作') ||
                html.includes('author') || html.includes('作者');
            if (hasLogin || res.status === 200) {
                store.setItem('platform-accounts', id, { ...account, status: 'active', lastVerified: new Date().toISOString() });
                return { valid: true, penName: account.penName, message: 'Cookie验证成功' };
            }
            store.setItem('platform-accounts', id, { ...account, status: 'inactive' });
            return { valid: false, message: 'Cookie可能已过期，页面未检测到登录状态' };
        } catch (e) {
            if (e.response?.status === 302 || e.response?.status === 301) {
                store.setItem('platform-accounts', id, { ...account, status: 'inactive' });
                return { valid: false, message: 'Cookie已过期，被重定向到登录页' };
            }
            return { valid: false, message: `验证请求失败: ${e.message}` };
        }
    }

    if (account.apiKey) {
        store.setItem('platform-accounts', id, { ...account, status: 'active', lastVerified: new Date().toISOString() });
        return { valid: true, penName: account.penName, message: 'API Key已配置（需实际调用时验证）' };
    }

    return { valid: false, message: '请先配置Cookie或API Key' };
}

function addToPublishQueue(projectId, queueData) {
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
    store.setItem('publish-queue', id, item);
    return item;
}

function getPublishQueue(projectId) {
    return store.queryItems('publish-queue', { projectId })
        .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
}

function updatePublishQueueItem(id, data) {
    const item = store.getItem('publish-queue', id);
    if (!item) return null;
    const updated = { ...item, ...data, updatedAt: new Date().toISOString() };
    store.setItem('publish-queue', id, updated);
    return updated;
}

function deletePublishQueueItem(id) {
    return store.deleteItem('publish-queue', id);
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

function addInteraction(projectId, interactionData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const interaction = {
        id,
        projectId,
        platformName: interactionData.platformName || '',
        chapterNumber: interactionData.chapterNumber || 0,
        type: interactionData.type || 'comment',
        author: interactionData.author || 'anonymous',
        content: interactionData.content || '',
        rating: interactionData.rating || null,
        reply: interactionData.reply || '',
        repliedAt: interactionData.repliedAt || null,
        isRead: false,
        needsReply: interactionData.needsReply || false,
        tags: interactionData.tags || [],
        createdAt: now,
        updatedAt: now
    };
    store.setItem('interactions', id, interaction);
    return interaction;
}

function getInteractions(projectId, filter) {
    let items = store.queryItems('interactions', { projectId });
    if (filter?.type) items = items.filter(i => i.type === filter.type);
    if (filter?.isRead !== undefined) items = items.filter(i => i.isRead === filter.isRead);
    if (filter?.needsReply) items = items.filter(i => i.needsReply);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function updateInteraction(id, data) {
    const item = store.getItem('interactions', id);
    if (!item) return null;
    const updated = { ...item, ...data, updatedAt: new Date().toISOString() };
    store.setItem('interactions', id, updated);
    return updated;
}

function deleteInteraction(id) {
    return store.deleteItem('interactions', id);
}

function getInteractionStats(projectId) {
    const interactions = store.queryItems('interactions', { projectId });
    const stats = {
        total: interactions.length,
        comments: interactions.filter(i => i.type === 'comment').length,
        reviews: interactions.filter(i => i.type === 'review').length,
        tips: interactions.filter(i => i.type === 'tip').length,
        questions: interactions.filter(i => i.type === 'question').length,
        unread: interactions.filter(i => !i.isRead).length,
        needsReply: interactions.filter(i => i.needsReply && !i.reply).length,
        avgRating: 0
    };
    const rated = interactions.filter(i => i.rating);
    if (rated.length > 0) {
        stats.avgRating = (rated.reduce((sum, i) => sum + i.rating, 0) / rated.length).toFixed(1);
    }
    return stats;
}

function getPublishStats(projectId) {
    const queue = store.queryItems('publish-queue', { projectId });
    const accounts = store.queryItems('platform-accounts', { projectId });
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
    getPlatforms,
    getPlatform,
    addPlatformAccount,
    getPlatformAccounts,
    updatePlatformAccount,
    deletePlatformAccount,
    verifyPlatformAccount,
    addToPublishQueue,
    getPublishQueue,
    updatePublishQueueItem,
    deletePublishQueueItem,
    formatContentForPlatform,
    batchAddToQueue,
    addInteraction,
    getInteractions,
    updateInteraction,
    deleteInteraction,
    getInteractionStats,
    getPublishStats
};

module.exports = {
    getPlatforms,
    getPlatform,
    addPlatformAccount,
    getPlatformAccounts,
    updatePlatformAccount,
    deletePlatformAccount,
    verifyPlatformAccount,
    addToPublishQueue,
    getPublishQueue,
    updatePublishQueueItem,
    deletePublishQueueItem,
    formatContentForPlatform,
    batchAddToQueue,
    addInteraction,
    getInteractions,
    updateInteraction,
    deleteInteraction,
    getInteractionStats,
    getPublishStats,
    cleanChapterContent
};
