const store = require('../../store');
const { getVolumeOrder } = require('./volumeHelpers');
const { getGenrePlugin } = require('../genreConfig');

function validateOutlineRhythm(outlines, projectId) {
    const issues = [];
    const subplaneMaterials = store.queryItems('materials', { projectId, type: 'sub-plane' });
    const unlockedSubplaneMaterials = subplaneMaterials.filter(m => !m.isLocked);
    const unlockedSubplaneNames = unlockedSubplaneMaterials.map(m => m.name);
    const allSubplaneNames = subplaneMaterials.map(m => m.name);

    const existingChapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const newOutlineStart = existingChapters.length + 1;
    const newOutlineVolume = Math.floor((newOutlineStart - 1) / 30) + 1;
    const volumeOrder = getVolumeOrder(projectId);
    const currentVolEntry = volumeOrder?.volumeOrder?.find(v => v.volume === newOutlineVolume);
    const currentVolSubplaneName = currentVolEntry?.subplaneName;
    const currentVolSubplaneShortName = currentVolSubplaneName?.replace(/^次位面[···]+/, '');

    const allOutlines = [...existingChapters.map(c => ({
        num: c.chapterNumber,
        outline: c.outline || '',
        title: c.title || '',
        scene: c.scene || ''
    })), ...outlines.map((o, i) => ({
        num: existingChapters.length + i + 1,
        outline: o.outline || '',
        title: o.title || '',
        scene: o.scene || ''
    }))];

    const subplaneChapters = {};
    for (const ch of allOutlines) {
        const text = ch.outline + ch.title;
        let matchedSubplane = null;
        if (ch.scene && ch.scene !== '主世界') {
            for (const name of unlockedSubplaneNames) {
                const shortName = name.replace(/^次位面[···]+/, '');
                if (ch.scene === name || ch.scene === shortName || ch.scene.includes(shortName)) {
                    matchedSubplane = name;
                    break;
                }
            }
            if (!matchedSubplane && currentVolSubplaneName) {
                if (ch.scene === currentVolSubplaneName || ch.scene === currentVolSubplaneShortName || ch.scene.includes(currentVolSubplaneShortName)) {
                    matchedSubplane = currentVolSubplaneName;
                }
            }
        }
        if (!matchedSubplane) {
            for (const name of unlockedSubplaneNames) {
                const shortName = name.replace(/^次位面[···]+/, '');
                if (text.includes(shortName) || text.includes(name)) {
                    matchedSubplane = name;
                    break;
                }
            }
            if (!matchedSubplane && currentVolSubplaneName) {
                if (text.includes(currentVolSubplaneShortName) || text.includes(currentVolSubplaneName)) {
                    matchedSubplane = currentVolSubplaneName;
                }
            }
        }
        if (matchedSubplane) {
            if (!subplaneChapters[matchedSubplane]) subplaneChapters[matchedSubplane] = [];
            subplaneChapters[matchedSubplane].push(ch.num);
        }
    }

    const lockedSubplaneMentions = {};
    for (const ch of allOutlines) {
        if (ch.num <= existingChapters.length) continue;
        if (ch.scene && ch.scene !== '主世界') {
            for (const m of subplaneMaterials) {
                if (m.isLocked) {
                    const shortName = m.name.replace(/^次位面[···]+/, '');
                    if (ch.scene === m.name || ch.scene === shortName || ch.scene.includes(shortName)) {
                        if (currentVolSubplaneName && (m.name === currentVolSubplaneName || shortName === currentVolSubplaneShortName)) {
                            continue;
                        }
                        if (!lockedSubplaneMentions[m.name]) lockedSubplaneMentions[m.name] = [];
                        lockedSubplaneMentions[m.name].push(ch.num);
                    }
                }
            }
        }
    }
    if (Object.keys(lockedSubplaneMentions).length > 0) {
        for (const [name, chs] of Object.entries(lockedSubplaneMentions)) {
            issues.push(`大纲提及了锁定次位面"${name}"(Ch${chs.join(',')})，锁定次位面不可使用！请只使用已解锁的次位面。`);
        }
    }

    const totalChapters = allOutlines.length;
    const volumeCount = Math.ceil(totalChapters / 30);

    for (let v = 0; v < volumeCount; v++) {
        const volStart = v * 30 + 1;
        const volEnd = Math.min((v + 1) * 30, totalChapters);
        const volSubplanes = {};

        if (v + 1 < newOutlineVolume) continue;

        for (const [name, chapters] of Object.entries(subplaneChapters)) {
            const volChapters = chapters.filter(c => c >= volStart && c <= volEnd);
            if (volChapters.length > 0) {
                volSubplanes[name] = volChapters;
            }
        }

        const volSubplaneCount = Object.keys(volSubplanes).length;
        if (volSubplaneCount > 1) {
            const names = Object.keys(volSubplanes).join('、');
            issues.push(`第${v + 1}卷(Ch${volStart}-${volEnd})出现${volSubplaneCount}个次位面(${names})，违反一卷一次位面规则！`);
        }

        const volChapterCount = volEnd - volStart + 1;
        const isPartialVolume = volChapterCount < 30;

        if (!isPartialVolume) {
            for (const [name, chs] of Object.entries(volSubplanes)) {
                if (chs.length < 5) {
                    issues.push(`第${v + 1}卷次位面"${name}"仅有${chs.length}章，几乎无次位面内容！`);
                } else if (chs.length < 15) {
                    console.warn(`[PIPELINE] 第${v + 1}卷次位面"${name}"仅有${chs.length}章（建议15章以上），允许通过但建议优化`);
                }
            }
        } else {
            const minSubplaneChapters = Math.max(3, Math.floor(volChapterCount * 0.3));
            for (const [name, chs] of Object.entries(volSubplanes)) {
                if (chs.length < minSubplaneChapters) {
                    console.warn(`[PIPELINE] 第${v + 1}卷次位面"${name}"仅有${chs.length}章，本卷${volChapterCount}章中次位面偏少`);
                }
            }
        }

        const subplaneChapterCount = Object.values(volSubplanes).reduce((sum, chs) => sum + chs.length, 0);
        const volOutlines = allOutlines.filter(o => o.num >= volStart && o.num <= volEnd);
        const mainWorldChapters = volOutlines.filter(o => o.scene === '主世界' || (!o.scene && !Object.values(subplaneChapters).flat().includes(o.num)));
        const trailingMainWorld = mainWorldChapters.filter(o => {
            const subplaneChsInVol = Object.values(volSubplanes).flat();
            const maxSubplane = subplaneChsInVol.length > 0 ? Math.max(...subplaneChsInVol) : 0;
            return o.num > maxSubplane;
        });
        if (volSubplaneCount > 0 && subplaneChapterCount > 0 && !isPartialVolume && trailingMainWorld.length < 2) {
            console.warn(`[PIPELINE] 第${v + 1}卷主世界回响阶段仅${trailingMainWorld.length}章（建议2章以上），允许通过`);
        }
    }

    return {
        isValid: issues.length === 0,
        issues,
        subplaneChapters,
        volumeCount
    };
}

function buildGenreOutlineInjection(styleProfile) {
    const genre = getGenrePlugin(styleProfile);
    if (!genre) return '';
    const parts = [];
    if (genre.foundation?.additionalFoundationRules?.length) {
        parts.push('【题材铁律 - 必须遵守】\n' + genre.foundation.additionalFoundationRules.join('\n'));
    }
    if (genre.foundation?.additionalConstraints?.length) {
        parts.push('【题材约束】\n' + genre.foundation.additionalConstraints.map(c => `- ${c.label}：${c.desc}`).join('\n'));
    }
    if (genre.styleProfile) {
        const sp = genre.styleProfile;
        const spParts = [];
        if (sp.povRule) spParts.push(`视角规则：${sp.povRule}`);
        if (sp.dialogueRule) spParts.push(`对话规则：${sp.dialogueRule}`);
        if (sp.behaviorRule) spParts.push(`行为规则：${sp.behaviorRule}`);
        if (sp.toneRule) spParts.push(`基调规则：${sp.toneRule}`);
        if (sp.titleRule) spParts.push(`标题规则：${sp.titleRule}`);
        if (spParts.length) parts.push('【风格规范】\n' + spParts.join('\n'));
    }
    if (genre.writerHints?.terminologyDimming) {
        parts.push('【术语与世界观提示】\n' + genre.writerHints.terminologyDimming);
    }
    if (genre.materialTemplates) {
        const mtParts = [];
        for (const [type, tmpl] of Object.entries(genre.materialTemplates)) {
            if (tmpl.namingRules) {
                const nr = tmpl.namingRules;
                const nrParts = [];
                if (nr.style) nrParts.push(`命名风格：${nr.style}`);
                if (nr.forbiddenNames?.length) nrParts.push(`禁用名：${nr.forbiddenNames.join('、')}`);
                if (nr.forbiddenPatterns?.length) nrParts.push(`禁用模式：${nr.forbiddenPatterns.map(p => p.source).join('、')}`);
                if (nr.forbiddenTerms?.length) nrParts.push(`禁用术语：${nr.forbiddenTerms.join('、')}`);
                if (nrParts.length) mtParts.push(`[${type}] ${nrParts.join('；')}`);
            }
        }
        if (mtParts.length) parts.push('【素材命名规范】\n' + mtParts.join('\n'));
    }
    return parts.join('\n\n');
}

module.exports = {
    validateOutlineRhythm,
    buildGenreOutlineInjection
};
