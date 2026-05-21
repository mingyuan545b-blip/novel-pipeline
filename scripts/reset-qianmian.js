const store = require('../server/store');
const pid = 'd4808c1a-3378-4372-b672-9d0a6bd075f8';

console.log('=== 重置千面项目 ===\n');

// 1. Reset all chapters - keep outline, clear everything else
const chapters = store.listItems('chapters').filter(c => c.projectId === pid);
let chapterResetCount = 0;
for (const ch of chapters) {
    const outline = ch.outline;
    const chapterNumber = ch.chapterNumber;
    const title = ch.title;
    const scene = ch.scene;

    ch.status = 'outlined';
    ch.round = 0;
    ch._reviewRounds = 0;
    ch._wordCountRetry = 0;
    ch._pipelineRetries = 0;

    delete ch._skipReason;
    delete ch.skipReason;
    delete ch.skipUntil;
    delete ch.content;
    delete ch.wordCount;
    delete ch.firstReviewOutput;
    delete ch.secondReviewOutput;
    delete ch.finalEditorOutput;
    delete ch.materialManagerOutput;
    delete ch.writerOutput;
    delete ch.reviserOutput;
    delete ch.intentPlannerOutput;
    delete ch.polishedContent;
    delete ch.normalContent;
    delete ch._wordCountRejected;
    delete ch._wordCountDetail;
    delete ch.truncated;
    delete ch.tomatoValidation;
    delete ch.materialManagerFailed;
    delete ch.materialManagerError;
    delete ch._matManagerRetries;
    delete ch._criticalBlocker;
    delete ch.history;
    delete ch._overridden;

    ch.outline = outline;
    ch.chapterNumber = chapterNumber;
    ch.title = title;
    ch.scene = scene;
    ch.updatedAt = new Date().toISOString();

    store.setItem('chapters', ch.id, ch);
    chapterResetCount++;
}
console.log(`[章节] 重置 ${chapterResetCount} 章（保留大纲）`);

// 2. Delete non-foundation materials
const materials = store.listItems('materials').filter(m => m.projectId === pid);
let deletedCount = 0;
let keptCount = 0;
for (const mat of materials) {
    const isFoundation = store.isFoundationMaterial(mat);
    if (isFoundation) {
        keptCount++;
        console.log(`  [保留] ${mat.type}: ${mat.name}`);
    } else {
        store.deleteItem('materials', mat.id);
        deletedCount++;
        console.log(`  [删除] ${mat.type}: ${mat.name} (sourceChapter=${mat.sourceChapter || 'none'})`);
    }
}
console.log(`[素材] 保留 ${keptCount} 基底素材，删除 ${deletedCount} 非基底素材`);

// 3. Reset circuit breaker
const project = store.getItem('projects', pid);
if (project) {
    project._circuitBreaker = {
        consecutiveFailures: 0,
        lastFailureStep: null,
        lastFailureTime: null,
        state: 'closed',
        history: []
    };
    store.setItem('projects', pid, project);
    console.log('[熔断器] 已重置');
}

// 4. Clear infinite pipeline state
const state = store.getItem('infinite-pipeline-state', pid);
if (state) {
    state.running = false;
    state.stopped = true;
    state.currentChapter = 0;
    state.completedChapters = 0;
    state.lastError = null;
    store.setItem('infinite-pipeline-state', pid, state);
    console.log('[Pipeline状态] 已清除');
}

// 5. Verify
const remainingChapters = store.listItems('chapters').filter(c => c.projectId === pid);
const remainingMaterials = store.listItems('materials').filter(m => m.projectId === pid);
console.log('\n=== 验证 ===');
console.log(`章节: ${remainingChapters.length} (全部 outlined)`);
console.log(`素材: ${remainingMaterials.length} (全部基底)`);
remainingChapters.forEach(c => {
    if (c.status !== 'outlined') console.log(`  ⚠️ Ch${c.chapterNumber} status=${c.status}`);
});
console.log('\n重置完成！');
