/**
 * outlineRhythmMatchers - 大纲节奏校验辅助函数
 */
const logger = require('../../shared/logger');

function matchSubplaneForChapter(ch, unlockedSubplaneNames, currentVolSubplaneName, currentVolSubplaneShortName) {
    const text = ch.outline + ch.title;
    let matched = null;
    if (ch.scene && ch.scene !== '主世界') {
        for (const name of unlockedSubplaneNames) {
            const shortName = name.replace(/^小世界[···]+/, '');
            if (ch.scene === name || ch.scene === shortName || ch.scene.includes(shortName)) return name;
        }
        if (currentVolSubplaneName && (ch.scene === currentVolSubplaneName || ch.scene === currentVolSubplaneShortName || ch.scene.includes(currentVolSubplaneShortName))) return currentVolSubplaneName;
    }
    for (const name of unlockedSubplaneNames) {
        const shortName = name.replace(/^小世界[···]+/, '');
        if (text.includes(shortName) || text.includes(name)) return name;
    }
    if (currentVolSubplaneName && (text.includes(currentVolSubplaneShortName) || text.includes(currentVolSubplaneName))) return currentVolSubplaneName;
    return null;
}

function buildSubplaneChapterMap(allOutlines, unlockedSubplaneNames, currentVolSubplaneName, currentVolSubplaneShortName) {
    const subplaneChapters = {};
    for (const ch of allOutlines) {
        const matched = matchSubplaneForChapter(ch, unlockedSubplaneNames, currentVolSubplaneName, currentVolSubplaneShortName);
        if (matched) {
            if (!subplaneChapters[matched]) subplaneChapters[matched] = [];
            subplaneChapters[matched].push(ch.num);
        }
    }
    return subplaneChapters;
}

function detectLockedSubplaneMentions(allOutlines, existingCount, subplaneMaterials, currentVolSubplaneName, currentVolSubplaneShortName) {
    const mentions = {};
    for (const ch of allOutlines) {
        if (ch.num <= existingCount) continue;
        if (ch.scene && ch.scene !== '主世界') {
            for (const m of subplaneMaterials) {
                if (m.isLocked) {
                    const shortName = m.name.replace(/^小世界[···]+/, '');
                    if (ch.scene === m.name || ch.scene === shortName || ch.scene.includes(shortName)) {
                        if (currentVolSubplaneName && (m.name === currentVolSubplaneName || shortName === currentVolSubplaneShortName)) continue;
                        if (!mentions[m.name]) mentions[m.name] = [];
                        mentions[m.name].push(ch.num);
                    }
                }
            }
        }
    }
    return mentions;
}

function validateVolumeRhythm(v, totalChapters, allOutlines, subplaneChapters) {
    const issues = [];
    const volStart = v * 30 + 1;
    const volEnd = Math.min((v + 1) * 30, totalChapters);
    const volSubplanes = {};

    for (const [name, chapters] of Object.entries(subplaneChapters)) {
        const volChapters = chapters.filter(c => c >= volStart && c <= volEnd);
        if (volChapters.length > 0) volSubplanes[name] = volChapters;
    }

    const volSubplaneCount = Object.keys(volSubplanes).length;
    if (volSubplaneCount > 1) {
        issues.push(`第${v + 1}卷(Ch${volStart}-${volEnd})出现${volSubplaneCount}个小世界(${Object.keys(volSubplanes).join('、')})，违反一卷一小世界规则！`);
    }

    const volChapterCount = volEnd - volStart + 1;
    const isPartialVolume = volChapterCount < 30;

    if (!isPartialVolume) {
        for (const [name, chs] of Object.entries(volSubplanes)) {
            if (chs.length < 5) issues.push(`第${v + 1}卷小世界"${name}"仅有${chs.length}章，几乎无小世界内容！`);
            else if (chs.length < 15) logger.warn('outlineHelpers', `第${v + 1}卷小世界"${name}"仅有${chs.length}章（建议15章以上），允许通过但建议优化`);
        }
    } else {
        const minSubplaneChapters = Math.max(3, Math.floor(volChapterCount * 0.3));
        for (const [name, chs] of Object.entries(volSubplanes)) {
            if (chs.length < minSubplaneChapters) logger.warn('outlineHelpers', `第${v + 1}卷小世界"${name}"仅有${chs.length}章，本卷${volChapterCount}章中小世界偏少`);
        }
    }

    const subplaneChapterCount = Object.values(volSubplanes).reduce((sum, chs) => sum + chs.length, 0);
    const volOutlines = allOutlines.filter(o => o.num >= volStart && o.num <= volEnd);
    const mainWorldChapters = volOutlines.filter(o => o.scene === '主世界' || (!o.scene && !Object.values(subplaneChapters).flat().includes(o.num)));
    const trailingMainWorld = mainWorldChapters.filter(o => {
        const maxSubplane = Object.values(volSubplanes).flat().length > 0 ? Math.max(...Object.values(volSubplanes).flat()) : 0;
        return o.num > maxSubplane;
    });
    if (volSubplaneCount > 0 && subplaneChapterCount > 0 && !isPartialVolume && trailingMainWorld.length < 2) {
        logger.warn('outlineHelpers', `第${v + 1}卷主世界回响阶段仅${trailingMainWorld.length}章（建议2章以上），允许通过`);
    }

    return issues;
}

module.exports = { matchSubplaneForChapter, buildSubplaneChapterMap, detectLockedSubplaneMentions, validateVolumeRhythm };
