const path = require('path');
const fs = require('fs');
const store = require('../store');
const { runAgent } = require('../services/pipeline/agentRunner');
const CHECKLIST = require('./pipelineChecklist');

async function runPipelineForChapter(projectId, chapterNum) {
    CHECKLIST.initChapter(chapterNum);
    const chapterStartTime = Date.now();
    console.log(`\n\n${'='.repeat(60)}\n📖 第${chapterNum}章 Pipeline执行\n${'='.repeat(60)}`);

    try {
        const outlineKey = `${projectId}-ch${chapterNum}`;
        const outline = await store.getItem('chapter-outlines', outlineKey);
        if (!outline) throw new Error(`第${chapterNum}章大纲不存在`);

        const allMaterials = await store.listItems('materials');
        const projectMaterials = allMaterials.filter(m => m.projectId === projectId);

        let previousChapterContent = null;
        if (chapterNum > 1) {
            try {
                const prevChapter = await store.getItem('chapters', `chapter-${chapterNum - 1}`);
                if (prevChapter?.content) previousChapterContent = prevChapter.content;
            } catch (_) { console.warn(`[WARN] 无法加载第${chapterNum - 1}章内容`); }
        }

        console.log(`\n[Writer] 开始写作第${chapterNum}章...`);
        const writerStart = Date.now();
        const writerResult = await runAgent('writer', { mode: 'novel', projectId, chapterNumber: chapterNum, chapterOutline: outline.content, materials: projectMaterials, previousChapterContent });
        const writerTime = Date.now() - writerStart;
        CHECKLIST.updateStep(chapterNum, 'writer', 'completed', { wordCount: writerResult.response.length, time: writerTime });
        console.log(`[Writer] 完成，字数: ${writerResult.response.length}字，耗时: ${writerTime}ms`);

        console.log(`\n[Reviewer] 开始审核第${chapterNum}章...`);
        const reviewerStart = Date.now();
        const reviewerResult = await runAgent('first-review', { mode: 'novel', projectId, chapterContent: writerResult.response, chapterOutline: outline.content, materials: projectMaterials });
        const reviewerTime = Date.now() - reviewerStart;
        let reviewerIssues = 0;
        try { const m = reviewerResult.response.match(/"issue"/g); reviewerIssues = m ? m.length : 0; } catch (_) {}
        CHECKLIST.updateStep(chapterNum, 'reviewer', 'completed', { issues: reviewerIssues, time: reviewerTime });
        console.log(`[Reviewer] 完成，问题: ${reviewerIssues}个，耗时: ${reviewerTime}ms`);

        console.log(`\n[Reviser] 开始修改第${chapterNum}章...`);
        const reviserStart = Date.now();
        const reviserResult = await runAgent('reviser', { mode: 'novel', projectId, chapterContent: writerResult.response, reviewContext: reviewerResult.response, chapterOutline: outline.content });
        const reviserTime = Date.now() - reviserStart;
        CHECKLIST.updateStep(chapterNum, 'reviser', 'completed', { wordCount: reviserResult.response.length, time: reviserTime });
        console.log(`[Reviser] 完成，字数: ${reviserResult.response.length}字，耗时: ${reviserTime}ms`);

        console.log(`\n[FinalEditor] 开始定稿第${chapterNum}章...`);
        const finalStart = Date.now();
        const finalResult = await runAgent('final-editor', { mode: 'novel', projectId, chapterContent: reviserResult.response, reviewContext: reviewerResult.response });
        const finalTime = Date.now() - finalStart;
        CHECKLIST.updateStep(chapterNum, 'finalEditor', 'completed', { time: finalTime });

        const chapterKey = `${projectId}-ch${chapterNum}`;
        await store.setItem('chapters', chapterKey, {
            id: chapterKey, projectId, chapterNumber: chapterNum,
            chapterTitle: outline.chapterTitle || `第${chapterNum}章`,
            content: finalResult.response, status: 'completed', wordCount: finalResult.response.length,
            writerOutput: { content: writerResult.response }, reviewerOutput: { content: reviewerResult.response },
            reviserOutput: { content: reviserResult.response }, finalEditorOutput: { content: finalResult.response },
            pipelineLogs: [
                { step: 'writer', output: writerResult.response, timestamp: new Date().toISOString() },
                { step: 'first-review', output: reviewerResult.response, timestamp: new Date().toISOString() },
                { step: 'reviser', output: reviserResult.response, timestamp: new Date().toISOString() },
                { step: 'final-editor', output: finalResult.response, timestamp: new Date().toISOString() }
            ],
            versions: [
                { content: writerResult.response, version: 1, timestamp: new Date().toISOString() },
                { content: reviserResult.response, version: 2, timestamp: new Date().toISOString() },
                { content: finalResult.response, version: 3, timestamp: new Date().toISOString() }
            ],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });

        const qualityChecks = {
            wordCount: reviserResult.response.length >= 2000 && reviserResult.response.length <= 3000,
            hasDialogue: reviserResult.response.includes('「') || reviserResult.response.includes('"'),
            hasDescription: reviserResult.response.length > 500,
            noForbiddenFormats: !['系统面板', '等级提示', '进度条', '面临抉择'].some(f => reviserResult.response.includes(f)),
            noTimeDescriptions: !/0\.[0-9]秒/.test(reviserResult.response),
        };
        const passedChecks = Object.values(qualityChecks).filter(v => v).length;
        CHECKLIST.updateStep(chapterNum, 'quality', 'completed', { checks: qualityChecks, passed: passedChecks, total: Object.keys(qualityChecks).length });

        const chapterTotalTime = Date.now() - chapterStartTime;
        CHECKLIST.chapters[chapterNum - 1].endTime = Date.now();
        CHECKLIST.chapters[chapterNum - 1].totalTime = chapterTotalTime;
        console.log(`\n✅ 第${chapterNum}章全部完成！字数: ${reviserResult.response.length} 质量: ${passedChecks}/${Object.keys(qualityChecks).length}通过 耗时: ${chapterTotalTime}ms`);
        CHECKLIST.printProgress();
        return { success: true, chapterNum, wordCount: reviserResult.response.length };
    } catch (err) {
        console.error(`\n❌ 第${chapterNum}章失败: ${err.message}`);
        CHECKLIST.chapters[chapterNum - 1].endTime = Date.now();
        CHECKLIST.chapters[chapterNum - 1].totalTime = Date.now() - chapterStartTime;
        return { success: false, chapterNum, error: err.message };
    }
}

module.exports = { runPipelineForChapter, CHECKLIST };
