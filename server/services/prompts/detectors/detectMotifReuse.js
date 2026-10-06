'use strict';

/**
 * M9检测器：意象/比喻跨章复用
 *
 * 价值：AI倾向复用"已成功过的句子"。第一次惊艳的比喻，第二次就是廉价——本书"算盘声像暴雨前蝉鸣"
 *       在相邻两章逐字复用即为典型。本检测器只抓"比喻意象的跨章重复"，避免误伤普通词汇。
 */

const { getConfig } = require('../constraintDetectionConfig');

/** 抽取比喻意象短语：去掉喻词，保留喻体（含标点前的全部内容） */
function extractSimileImages(text) {
    const config = getConfig('M9');
    const images = new Set();
    const re = new RegExp(config.similePattern.source, config.similePattern.flags);
    let m;
    while ((m = re.exec(String(text || ''))) !== null) {
        let img = m[0].replace(/^(?:像|好像|如同|仿佛|宛如|犹如|好似|恰似|恍若)/, '').trim();
        img = img.replace(/[的了着过]$/, '');
        if (img.length >= config.minImageLength) images.add(img);
    }
    return images;
}

function detectMotifReuse({ content, recentChapterContents = [] }) {
    const config = getConfig('M9');
    const threshold = config.threshold;
    if (!content || !recentChapterContents.length) return { violations: [], actual: 0, threshold };

    const current = extractSimileImages(content);
    if (!current.size) return { violations: [], actual: 0, threshold };

    const violations = [];
    recentChapterContents.forEach((prev, idx) => {
        if (!prev) return;
        const prevImages = extractSimileImages(prev);
        for (const img of current) {
            if (prevImages.has(img)) {
                violations.push({
                    type: 'motif-reuse',
                    snippet: `"${img}"`,
                    reason: `比喻意象"${img}"与前第${idx + 1}个近章逐字重复`,
                });
            }
        }
    });

    const actual = violations.length;
    if (actual < threshold) return { violations: [], actual, threshold };
    return { violations, actual, threshold };
}

module.exports = { detectMotifReuse, extractSimileImages };
