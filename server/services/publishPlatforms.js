const { v4: uuidv4 } = require('uuid');
const store = require('../store');

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

async function addPlatformAccount(projectId, accountData) {
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
    await store.setItem('platform-accounts', id, account);
    return account;
}

async function getPlatformAccounts(projectId) {
    return await store.queryItems('platform-accounts', { projectId });
}

async function updatePlatformAccount(id, data) {
    const account = await store.getItem('platform-accounts', id);
    if (!account) return null;
    const updated = { ...account, ...data, updatedAt: new Date().toISOString() };
    await store.setItem('platform-accounts', id, updated);
    return updated;
}

function deletePlatformAccount(id) {
    return store.deleteItem('platform-accounts', id);
}

async function verifyPlatformAccount(id) {
    const account = await store.getItem('platform-accounts', id);
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

module.exports = {
    PLATFORMS,
    getPlatforms,
    getPlatform,
    addPlatformAccount,
    getPlatformAccounts,
    updatePlatformAccount,
    deletePlatformAccount,
    verifyPlatformAccount
};
