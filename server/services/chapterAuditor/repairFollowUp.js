const logger = require('../../shared/logger');
const store = require('../../store');
const { auditChapter } = require('./auditMethods');
const { reviewChapter } = require('./reviewMethods');

async function _runFollowUpPipeline(projectId, chapterId, pipelineService, project, onProgress) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) return { success: false, error: '章节不存在' };
    const mode = project?.mode || 'novel';
    const steps = ['first-review', 'second-review', 'final-editor'];
    const results = [];
    let materialGuidance = '';

    for (const step of steps) {
        if (onProgress) onProgress({ phase: 'pipeline-step', step, chapterId });
        const stepResult = await pipelineService.runPipelineStep(projectId, chapterId, step, 1, { mode });
        results.push({ step, passed: stepResult.passed });
        if (!stepResult.passed) return { success: false, failedAt: step, results };
        if (step === 'final-editor') {
            materialGuidance = stepResult.materialGuidance || '';
            const ch = await store.getItem('chapters', chapterId);
            if (ch) { ch.normalContent = ch.content; ch.status = 'approved'; ch.updatedAt = new Date().toISOString(); store.setItem('chapters', chapterId, ch); }
        }
    }

    try {
        if (onProgress) onProgress({ phase: 'pipeline-step', step: 'polisher', chapterId });
        const polishResult = await pipelineService.runPipelineStep(projectId, chapterId, 'polisher', 1, { mode });
        results.push({ step: 'polisher', passed: true });
        if (polishResult.result?.response) {
            const polishedContent = polishResult.result.response;
            const ch = await store.getItem('chapters', chapterId);
            const originalLength = ch?.normalContent?.length || 0;
            const ratio = originalLength > 0 ? polishedContent.length / originalLength : 1;
            if (ratio >= 0.8 && ratio <= 1.2 && polishedContent.length > 500) {
                ch.polishedContent = polishedContent; ch.polisherOutput = polishedContent;
                ch.content = polishedContent; ch.wordCount = polishedContent.length;
                ch.updatedAt = new Date().toISOString(); store.setItem('chapters', chapterId, ch);
            }
        }
    } catch (err) { results.push({ step: 'polisher', passed: false, error: err.message }); }

    try { await pipelineService.runPipelineStep(projectId, chapterId, 'material-manager', 1, { materialGuidance }); results.push({ step: 'material-manager', passed: true }); } catch (err) { results.push({ step: 'material-manager', passed: false, error: err.message }); }

    const finalChapter = await store.getItem('chapters', chapterId);
    return { success: true, results, finalStatus: finalChapter?.status, finalWordCount: (finalChapter?.content || '').replace(/\s/g, '').length };
}

module.exports = { _runFollowUpPipeline };
