const store = require('../../../store');
const logger = require('../../../shared/logger');
const { saveTimelineEvent } = require('../../timelineAdapter');

function extractKeywords(text) {
    if (!text) return [];
    return text.replace(/[0-9第章整合（）【】、\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
}

async function associateTimelinesToQuests(allTimelines, mainQuests, allQuests) {
    for (const ev of allTimelines) {
        const evKeywords = extractKeywords(ev.title + ' ' + (ev.description || ''));
        let bestQuest = null;
        let bestScore = 0;

        for (const q of mainQuests) {
            let score = 0;
            const qKeywords = extractKeywords(q.title + ' ' + (q.description || ''));
            for (const ek of evKeywords) {
                for (const qk of qKeywords) {
                    if (ek === qk) score += 3;
                    else if (ek.includes(qk) || qk.includes(ek)) score += 1;
                }
            }
            const subQuests = allQuests.filter(sq => sq.parentId === q.id);
            for (const sq of subQuests) {
                const sqKeywords = extractKeywords(sq.title + ' ' + (sq.description || ''));
                for (const ek of evKeywords) {
                    for (const sqk of sqKeywords) {
                        if (ek === sqk) score += 2;
                        else if (ek.includes(sqk) || sqk.includes(ek)) score += 1;
                    }
                }
            }
            if (ev.eventType === 'conflict' && q.priority === 'critical') score += 2;
            if (ev.eventType === 'revelation' && q.priority === 'high') score += 2;
            if (ev.eventType === 'resolution' && q.priority === 'critical') score += 3;
            if (ev.eventType === 'world' && q.priority === 'high') score += 1;
            if (ev.eventType === 'character' && q.priority === 'critical') score += 1;
            if (score > bestScore) { bestScore = score; bestQuest = q; }
        }

        if (bestQuest && bestScore >= 2) {
            if (!ev.questIds) ev.questIds = [];
            if (!ev.questIds.includes(bestQuest.id)) ev.questIds.push(bestQuest.id);
            if (!bestQuest.timelineEventIds) bestQuest.timelineEventIds = [];
            if (!bestQuest.timelineEventIds.includes(ev.id)) bestQuest.timelineEventIds.push(ev.id);
            await saveTimelineEvent(ev.projectId, ev);
            await store.setItem('quests', bestQuest.id, bestQuest);
        }
    }
}

async function distributeTimelinesToChapters(allTimelines, allChapters, chapterQuests) {
    const sortedTimelines = [...allTimelines].sort((a, b) => (a.storyOrder ?? 0) - (b.storyOrder ?? 0));
    for (const ch of allChapters) {
        const chQuest = chapterQuests.find(q => (q.chapterIds || []).includes(ch.id));
        if (!chQuest) continue;
        const totalCh = allChapters.length;
        const totalEv = sortedTimelines.length;
        if (totalEv === 0) continue;
        const evPerCh = totalEv / totalCh;
        const startIdx = Math.floor((ch.chapterNumber - 1) * evPerCh);
        const endIdx = Math.floor(ch.chapterNumber * evPerCh);
        for (let ei = startIdx; ei < endIdx && ei < totalEv; ei++) {
            const ev = sortedTimelines[ei];
            if (!ev) continue;
            if (!chQuest.timelineEventIds) chQuest.timelineEventIds = [];
            if (!chQuest.timelineEventIds.includes(ev.id)) chQuest.timelineEventIds.push(ev.id);
            if (!ev.chapterIds) ev.chapterIds = [];
            if (!ev.chapterIds.includes(ch.id)) ev.chapterIds.push(ch.id);
            await saveTimelineEvent(ev.projectId, ev);
        }
        await store.setItem('quests', chQuest.id, chQuest);
    }
}

async function associateCharactersToTimelines(allTimelines, characterMaterials) {
    for (const ev of allTimelines) {
        if (ev.eventType !== 'character' || characterMaterials.length === 0) continue;
        let bestChar = null;
        let bestScore = 0;
        const evTitleLower = (ev.title || '').toLowerCase();
        const evText = (ev.title + ' ' + (ev.description || '')).toLowerCase();
        for (const c of characterMaterials) {
            const rawName = (c.name || '').toLowerCase();
            if (!rawName) continue;
            const coreName = rawName.replace(/[【].+?[】]/g, '').replace(/\s*[-–—]\s*.+$/, '').trim();
            let score = 0;
            if (evTitleLower.includes(coreName)) score += coreName.length * 4;
            if (evText.includes(coreName)) score += coreName.length * 2;
            if (evText.includes(rawName)) score = Math.max(score, rawName.length * 2);
            const charContent = (c.currentContent || c.initialContent || '').toLowerCase();
            const evKeywords = extractKeywords(ev.title);
            for (const ek of evKeywords) {
                if (charContent.includes(ek.toLowerCase())) score += 1;
            }
            if (score > bestScore) { bestScore = score; bestChar = c; }
        }
        if (bestChar && bestScore >= 2) {
            if (!ev.characterIds) ev.characterIds = [];
            if (!ev.characterIds.includes(bestChar.id)) ev.characterIds.push(bestChar.id);
            if (!ev.materialIds) ev.materialIds = [];
            if (!ev.materialIds.includes(bestChar.id)) ev.materialIds.push(bestChar.id);
            await saveTimelineEvent(ev.projectId, ev);
        }
    }
}

async function associateMaterialsToQuests(mainQuests, allMaterials) {
    for (const q of mainQuests) {
        const relatedMats = allMaterials.filter(m => {
            if (m.type === 'character') return false;
            const mText = (m.name + ' ' + (m.currentContent || m.initialContent || '')).toLowerCase();
            const qKw = extractKeywords(q.title + ' ' + q.description);
            const mKw = new Set(extractKeywords(m.name + ' ' + (m.currentContent || m.initialContent || '')));
            let overlap = 0;
            for (const k of qKw) { if (mKw.has(k)) overlap++; }
            return overlap >= 2 || mText.includes(q.title.toLowerCase());
        });
        if (relatedMats.length > 0) {
            q.materialIds = [...new Set([...(q.materialIds || []), ...relatedMats.map(m => m.id)])];
            await store.setItem('quests', q.id, q);
            for (const m of relatedMats) {
                if (!m.questIds) m.questIds = [];
                if (!m.questIds.includes(q.id)) {
                    m.questIds.push(q.id);
                    await store.setItem('materials', m.id, m);
                }
            }
        }
    }
}

module.exports = {
    extractKeywords,
    associateTimelinesToQuests,
    distributeTimelinesToChapters,
    associateCharactersToTimelines,
    associateMaterialsToQuests
};
