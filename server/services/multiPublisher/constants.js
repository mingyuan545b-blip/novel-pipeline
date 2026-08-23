const logger = require('../../shared/logger');
const PLATFORMS = {
    fanqie: {
        name: '番茄小说',
        writerUrl: 'https://fanqienovel.com/main/writer/book-manage',
        loginIndicators: ['工作台', '作品管理', '我的作品', '码字日历', '章节管理', '创建章节', '创建作品', '新建章节'],
        loginUrlKeywords: ['login', 'passport'],
        minWordCount: 1000
    },
    qimao: {
        name: '七猫小说',
        writerUrl: 'https://zuozhe.qimao.com',
        loginIndicators: ['作家中心', '作品管理', '我的作品', '创作中心', '章节管理'],
        loginUrlKeywords: ['login', 'passport', 'sign-in'],
        minWordCount: 1000
    },
    douyin: {
        name: '抖音小说',
        writerUrl: 'https://creator.douyin.com/creator-micro/content/publish',
        loginIndicators: ['创作服务平台', '创作者中心', '发布作品'],
        loginUrlKeywords: ['login', 'passport', 'sso'],
        minWordCount: 1000
    },
    zhangyue: {
        name: '掌阅 iReader',
        writerUrl: 'https://writer.zhangyue.com',
        loginIndicators: ['作者中心', '作品管理', '我的作品'],
        loginUrlKeywords: ['login', 'passport', 'auth'],
        minWordCount: 1000
    },
    shuqi: {
        name: '书旗小说',
        writerUrl: 'https://writer.shuqi.com',
        loginIndicators: ['作者中心', '作品管理', '我的作品', '创作中心'],
        loginUrlKeywords: ['login', 'passport', 'auth'],
        minWordCount: 1000
    }
};

const publishStates = {};

function getPlatformState(platform) {
    if (!publishStates[platform]) {
        publishStates[platform] = { running: false, logs: [], currentChapter: null, totalChapters: 0, completedChapters: 0, failedChapters: 0, browser: null, context: null, page: null, stopped: false, loginStatus: null };
    }
    const s = publishStates[platform];
    return { running: s.running, currentChapter: s.currentChapter, totalChapters: s.totalChapters, completedChapters: s.completedChapters, failedChapters: s.failedChapters, stopped: s.stopped, loginStatus: s.loginStatus, logs: s.logs.slice(-100) };
}

function getAllStates() {
    const result = {};
    for (const platform of Object.keys(PLATFORMS)) result[platform] = getPlatformState(platform);
    return result;
}

function addLog(platform, msg) {
    if (!publishStates[platform]) publishStates[platform] = { running: false, logs: [], stopped: false, completedChapters: 0, failedChapters: 0, totalChapters: 0, currentChapter: null, loginStatus: null };
    const s = publishStates[platform];
    const time = new Date().toISOString();
    s.logs.push({ time, msg });
    logger.info('constants', `[${platform.toUpperCase()}-PUBLISH] ${msg}`);
    if (s.logs.length > 500) s.logs = s.logs.slice(-300);
}

module.exports = { PLATFORMS, publishStates, getPlatformState, getAllStates, addLog };
