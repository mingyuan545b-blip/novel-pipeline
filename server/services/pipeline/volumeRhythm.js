/**
 * volumeRhythm.js — 卷节奏引导构建（从volumeHelpers.js拆出）
 * 包含buildVolumeRhythmGuidance
 */
const store = require('../../store');
const logger = require('../../shared/logger');

async function buildVolumeRhythmGuidance(projectId, targetCount, existingCount = 0) {
    const chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const allOutlines = chapters.map(c => ({
        num: c.chapterNumber,
        outline: c.outline || '',
        title: c.title || ''
    }));

    const subplaneNames = [];
    const subplaneMaterials = await store.queryItems('materials', { projectId, type: 'sub-plane' });
    for (const m of subplaneMaterials) {
        if (m.name) subplaneNames.push(m.name);
    }

    const unlockedSubplanes = subplaneMaterials.filter(m => !m.isLocked).map(m => m.name);
    const lockedSubplanes = subplaneMaterials.filter(m => m.isLocked).map(m => m.name);

    const existingSubplaneRefs = [];
    for (const ch of allOutlines) {
        const text = ch.outline + ch.title;
        for (const name of subplaneNames) {
            const shortName = name.replace(/^小世界[···]+/, '');
            if (text.includes(shortName) || text.includes(name)) {
                if (!existingSubplaneRefs.find(r => r.name === name)) {
                    existingSubplaneRefs.push({ name, firstChapter: ch.num });
                }
            }
        }
    }

    const totalExisting = allOutlines.length;
    const currentVolume = Math.floor(totalExisting / 30) + 1;
    const chapterInVolume = (totalExisting % 30) + 1;

    let guidance = `\n【当前卷节奏状态 - 必须参考】`;
    guidance += `\n- 已有${totalExisting}章，当前处于第${currentVolume}卷，卷内第${chapterInVolume}章`;
    guidance += `\n- 已解锁小世界：${unlockedSubplanes.length > 0 ? unlockedSubplanes.join('、') : '无'}`;
    guidance += `\n- 未解锁小世界：${lockedSubplanes.length > 0 ? lockedSubplanes.join('、') : '无'}`;

    if (existingSubplaneRefs.length > 0) {
        guidance += `\n- 已使用的小世界：${existingSubplaneRefs.map(r => `${r.name}(首次出现Ch${r.firstChapter})`).join('、')}`;
    }

    if (chapterInVolume <= 5) {
        guidance += `\n- 当前应处于：第一阶段·主世界铺垫（Ch1-5），准备进入小世界`;
        guidance += `\n- 本卷应使用的小世界：${unlockedSubplanes.length > 0 ? unlockedSubplanes[0] : '待解锁'}`;
    } else if (chapterInVolume <= 25) {
        guidance += `\n- 当前应处于：第二阶段·深入小世界探索（Ch6-25），专注当前位面`;
        guidance += `\n- 禁止引入新小世界！继续深入当前位面的探索和任务推进`;
    } else {
        guidance += `\n- 当前应处于：第三阶段·主世界回响（Ch26-30），返回主世界消化能力`;
        guidance += `\n- 禁止引入新小世界！专注主世界剧情和配角互动`;
    }

    guidance += `\n- 关键提醒：本卷只能使用一个小世界！如果已有小世界在探索中，绝对不能引入第二个！`;

    return guidance;
}

module.exports = { buildVolumeRhythmGuidance };
