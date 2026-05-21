const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('./platformConfig');

const publishStates = {};

function getPlatformState(platform) {
    if (!publishStates[platform]) {
        publishStates[platform] = {
            running: false, logs: [], currentChapter: null,
            totalChapters: 0, completedChapters: 0, failedChapters: 0,
            browser: null, context: null, page: null, stopped: false,
            loginStatus: null
        };
    }
    const s = publishStates[platform];
    return {
        running: s.running, currentChapter: s.currentChapter,
        totalChapters: s.totalChapters, completedChapters: s.completedChapters,
        failedChapters: s.failedChapters, stopped: s.stopped,
        loginStatus: s.loginStatus,
        logs: s.logs.slice(-100)
    };
}

function getAllStates() {
    const result = {};
    for (const platform of Object.keys(PLATFORMS)) {
        result[platform] = getPlatformState(platform);
    }
    return result;
}

function addLog(platform, msg) {
    if (!publishStates[platform]) publishStates[platform] = { running: false, logs: [], stopped: false, completedChapters: 0, failedChapters: 0, totalChapters: 0, currentChapter: null, loginStatus: null };
    const s = publishStates[platform];
    const time = new Date().toISOString();
    s.logs.push({ time, msg });
    console.log(`[${platform.toUpperCase()}-PUBLISH] ${msg}`);
    if (s.logs.length > 500) s.logs = s.logs.slice(-300);
}

async function takeScreenshot(page, platform, label) {
    try {
        const screenshotDir = path.join(__dirname, '..', '..', 'output', 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({ path: path.join(screenshotDir, `${platform}-${label}-${Date.now()}.png`), fullPage: true });
    } catch (e) {}
}

function getRawState(platform) {
    return publishStates[platform];
}

function ensureState(platform) {
    if (!publishStates[platform]) {
        publishStates[platform] = {
            running: false, logs: [], currentChapter: null,
            totalChapters: 0, completedChapters: 0, failedChapters: 0,
            browser: null, context: null, page: null, stopped: false,
            loginStatus: null
        };
    }
    return publishStates[platform];
}

module.exports = {
    publishStates,
    getPlatformState,
    getAllStates,
    addLog,
    takeScreenshot,
    getRawState,
    ensureState
};
