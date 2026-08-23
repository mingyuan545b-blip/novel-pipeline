const store = require("../../../store");
const { STUCK_STATUSES } = require("../../chapterStatus");

const MAX_CHAPTER_RETRIES = 5;
const COOLDOWN_STEPS = [60000, 300000, 900000, 1800000, 3600000];

function resetCooledChapters(chapters, addLog) {
    const results = [];
    for (const ch of chapters) {
        if ((ch.status === 'failed-skipped' || ch.status === 'timeout-skipped' || ch.status === 'context-error' || ch.status === 'cooldown-waiting') && ch.skipUntil && ch.skipUntil <= Date.now()) {
            const retries = ch._pipelineRetries || 0;
            ch.status = 'outlined';
            delete ch.skipUntil;
            ch._wordCountRetry = 0;
            ch.updatedAt = new Date().toISOString();
            results.push({ chapter: ch, action: 'reset-to-outlined' });
            addLog(`第${ch.chapterNumber}章 冷却完成，重新加入待处理队列(重试${retries}/${MAX_CHAPTER_RETRIES}，永不放弃)`);
        }
    }
    return results;
}

function fixStuckChapters(chapters, addLog) {
    const results = [];
    for (const ch of chapters) {
        if (STUCK_STATUSES.includes(ch.status)) {
            addLog(`第${ch.chapterNumber}章 状态异常(${ch.status})，重置为outlined`);
            ch.status = 'outlined';
            delete ch.skipUntil;
            ch.updatedAt = new Date().toISOString();
            results.push({ chapter: ch, action: 'stuck-reset' });
        }
    }
    for (const ch of chapters) {
        if (ch.status === 'pipeline-failed') {
            ch.status = 'outlined';
            delete ch.skipUntil;
            ch.updatedAt = new Date().toISOString();
            results.push({ chapter: ch, action: 'pipeline-failed-reset' });
            addLog(`第${ch.chapterNumber}章 pipeline-failed状态重置为outlined`);
        }
    }
    return results;
}

function selectNextChapter(chapters, addLog) {
    const outlinedChapters = chapters.filter(ch => {
        if (ch.status !== 'outlined' && ch.status !== 'draft') return false;
        if (ch.skipUntil && ch.skipUntil > Date.now()) return false;
        return true;
    });

    const cooldownChapters = chapters.filter(ch =>
        ch.status === 'cooldown-waiting' && ch.skipUntil && ch.skipUntil > Date.now()
    );
    const failedSkippedChapters = chapters.filter(ch =>
        (ch.status === 'failed-skipped' || ch.status === 'timeout-skipped' || ch.status === 'context-error') &&
        ch.skipUntil && ch.skipUntil > Date.now()
    );

    if (cooldownChapters.length > 0) {
        for (const cch of cooldownChapters) {
            const remainingMs = cch.skipUntil - Date.now();
            addLog(`第${cch.chapterNumber}章 冷却等待中（剩余${Math.round(remainingMs/1000)}秒，永不放弃）`);
        }
    }

    if ((cooldownChapters.length > 0 || failedSkippedChapters.length > 0) && outlinedChapters.length > 0) {
        const earliestCooldown = chapters.find(ch =>
            ch.status === 'cooldown-waiting' && ch.skipUntil && ch.skipUntil > Date.now()
        );
        if (earliestCooldown) {
            const cooldownNum = earliestCooldown.chapterNumber;
            const nextNum = outlinedChapters[0].chapterNumber;
            if (nextNum > cooldownNum) addLog(`第${cooldownNum}章冷却中（不阻塞主循环，允许处理第${nextNum}章）`);
        }
    }

    return { outlinedChapters, failedSkippedChapters, cooldownChapters };
}

module.exports = { resetCooledChapters, fixStuckChapters, selectNextChapter, MAX_CHAPTER_RETRIES, COOLDOWN_STEPS };
