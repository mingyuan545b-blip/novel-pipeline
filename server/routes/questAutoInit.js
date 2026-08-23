/**
 * questAutoInit - 项目任务/时间线自动初始化
 */
const store = require('../store');
const { ensureMainQuest, createPhaseQuests, createSubplaneQuests, createTimelineEvents, detectEventType, inferStoryTime, extractLocation, isKeyEvent } = require('./questHelpers');

async function autoInitProject(projectId) {
    const project = await store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const chapters = (await store.listItems('chapters')).filter(c => c.projectId === projectId);
    const existingTimelines = (await store.listItems('timelines')).filter(t => t.projectId === projectId);
    const existingQuests = (await store.listItems('quests')).filter(q => q.projectId === projectId);

    if (chapters.length === 0) throw new Error('No chapters found');

    const protagonistName = project.styleProfile?.protagonistName || '主角';

    // 1. Ensure main quest
    const { quest: mainQuest, created: mainCreated } = await ensureMainQuest(projectId, protagonistName, existingQuests);
    let totalQuests = mainCreated ? 1 : 0;

    // 2. Create phase quests
    const sortedChapters = [...chapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    const existingPhaseQuests = existingQuests.filter(q => q.parentId === mainQuest.id && q.tags?.includes('阶段任务'));
    const { phaseMap, created: phaseCreated } = await createPhaseQuests(projectId, mainQuest.id, sortedChapters, existingPhaseQuests);
    totalQuests += phaseCreated;

    // 3. Update main quest chapterIds
    mainQuest.chapterIds = sortedChapters.map(c => c.id);
    mainQuest.timelineEventIds = [];
    await store.setItem('quests', mainQuest.id, mainQuest);

    // 4. Create subplane quests
    totalQuests += await createSubplaneQuests(projectId, mainQuest.id);

    // 5. Create timeline events
    const { created: tlCreated, skipped } = await createTimelineEvents(projectId, sortedChapters, existingTimelines, phaseMap, project);

    // 6. Update phase quests with timeline event IDs
    for (const [, phase] of Object.entries(phaseMap)) {
        const pq = await store.getItem('quests', phase.id);
        if (pq) {
            pq.timelineEventIds = phase.timelineEventIds || [];
            await store.setItem('quests', phase.id, pq);
        }
    }

    // 7. Update main quest timeline IDs
    mainQuest.timelineEventIds = (await store.listItems('timelines')).filter(t => t.projectId === projectId).map(t => t.id);
    await store.setItem('quests', mainQuest.id, mainQuest);

    // 8. Build summary
    const phasesSummary = await Promise.all(Object.values(phaseMap).map(async p => ({
        title: (await store.getItem('quests', p.id))?.title,
        chapters: `${p.startCh}-${p.endCh}`
    })));

    return {
        success: true,
        created: { timelines: tlCreated, quests: totalQuests, skipped },
        summary: { totalChapters: sortedChapters.length, totalTimelines: tlCreated, totalQuests, mainQuest: mainQuest.title, phases: phasesSummary }
    };
}

module.exports = { autoInitProject, detectEventType, inferStoryTime, extractLocation, isKeyEvent };
