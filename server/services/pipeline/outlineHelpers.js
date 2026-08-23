/**
 * outlineHelpers - 大纲节奏校验
 */
const store = require('../../store');
const { getVolumeOrder } = require('./volumeHelpers');
const { buildSubplaneChapterMap, detectLockedSubplaneMentions, validateVolumeRhythm } = require('./outlineRhythmMatchers');

async function validateOutlineRhythm(outlines, projectId) {
    const issues = [];
    const subplaneMaterials = await store.queryItems('materials', { projectId, type: 'sub-plane' });
    const unlockedSubplaneNames = subplaneMaterials.filter(m => !m.isLocked).map(m => m.name);

    const existingChapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const newOutlineStart = existingChapters.length + 1;
    const newOutlineVolume = Math.floor((newOutlineStart - 1) / 30) + 1;
    const volumeOrder = await getVolumeOrder(projectId);
    const currentVolEntry = volumeOrder?.volumeOrder?.find(v => v.volume === newOutlineVolume);
    const currentVolSubplaneName = currentVolEntry?.subplaneName;
    const currentVolSubplaneShortName = currentVolSubplaneName?.replace(/^小世界[···]+/, '');

    const allOutlines = [
        ...existingChapters.map(c => ({ num: c.chapterNumber, outline: c.outline || '', title: c.title || '', scene: c.scene || '' })),
        ...outlines.map((o, i) => ({ num: existingChapters.length + i + 1, outline: o.outline || '', title: o.title || '', scene: o.scene || '' }))
    ];

    const subplaneChapters = buildSubplaneChapterMap(allOutlines, unlockedSubplaneNames, currentVolSubplaneName, currentVolSubplaneShortName);

    const lockedMentions = detectLockedSubplaneMentions(allOutlines, existingChapters.length, subplaneMaterials, currentVolSubplaneName, currentVolSubplaneShortName);
    for (const [name, chs] of Object.entries(lockedMentions)) {
        issues.push(`大纲提及了锁定小世界"${name}"(Ch${chs.join(',')})，锁定小世界不可使用！请只使用已解锁的小世界。`);
    }

    const totalChapters = allOutlines.length;
    const volumeCount = Math.ceil(totalChapters / 30);
    for (let v = 0; v < volumeCount; v++) {
        if (v + 1 < newOutlineVolume) continue;
        issues.push(...validateVolumeRhythm(v, totalChapters, allOutlines, subplaneChapters));
    }

    return { isValid: issues.length === 0, issues, subplaneChapters, volumeCount };
}

module.exports = { validateOutlineRhythm };
