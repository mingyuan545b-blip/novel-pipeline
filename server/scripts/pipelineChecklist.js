const CHECKLIST = {
    chapters: [],

    initChapter(chapterNum) {
        this.chapters.push({
            chapter: chapterNum,
            steps: {
                writer: { status: 'pending', wordCount: 0, time: 0 },
                reviewer: { status: 'pending', issues: 0, time: 0 },
                reviser: { status: 'pending', wordCount: 0, time: 0 },
                finalEditor: { status: 'pending', time: 0 },
                quality: { status: 'pending', checks: {}, passed: 0, total: 0 }
            },
            startTime: null, endTime: null, totalTime: 0
        });
    },

    updateStep(chapterNum, step, status, data = {}) {
        const chapter = this.chapters.find(c => c.chapter === chapterNum);
        if (chapter && chapter.steps[step]) {
            chapter.steps[step].status = status;
            Object.assign(chapter.steps[step], data);
        }
    },

    printProgress() {
        const completed = this.chapters.filter(c => c.steps.finalEditor.status === 'completed').length;
        const total = this.chapters.length;
        const percentage = ((completed / total) * 100).toFixed(1);
        process.stdout.write(`\r📖 进度: ${completed}/${total}章完成 (${percentage}%)`);
    },

    printReport() {
        console.log('\n\n' + '='.repeat(80));
        console.log('📋 完整Pipeline执行报告');
        console.log('='.repeat(80));
        let totalWords = 0, totalIssues = 0, allQualityPassed = true;
        this.chapters.forEach(ch => {
            const s = ch.steps;
            const isComplete = s.finalEditor.status === 'completed';
            const icon = isComplete ? '✅' : '❌';
            console.log(`\n${icon} 第${ch.chapter}章:`);
            console.log(`   Writer: ${s.writer.wordCount}字 (${s.writer.status})`);
            console.log(`   Reviewer: ${s.reviewer.issues}个问题 (${s.reviewer.status})`);
            console.log(`   Reviser: ${s.reviser.wordCount}字 (${s.reviser.status})`);
            console.log(`   FinalEditor: ${s.finalEditor.status} (${s.finalEditor.time}ms)`);
            console.log(`   质量检查: ${s.quality.passed}/${s.quality.total}通过`);
            console.log(`   耗时: ${ch.totalTime}ms`);
            if (isComplete) {
                totalWords += s.reviser.wordCount;
                totalIssues += s.reviewer.issues;
                if (s.quality.passed < s.quality.total) allQualityPassed = false;
            }
        });
        console.log('\n' + '-'.repeat(80));
        console.log(`📊 总计:`);
        console.log(`   完成章节: ${this.chapters.filter(c => c.steps.finalEditor.status === 'completed').length}/${this.chapters.length}`);
        console.log(`   总字数: ${totalWords}字`);
        console.log(`   平均每章: ${this.chapters.length > 0 ? Math.round(totalWords / this.chapters.length) : 0}字`);
        console.log(`   总审核问题: ${totalIssues}个`);
        console.log(`   质量通过率: ${allQualityPassed ? '100%' : '部分未通过'}`);
        const totalTime = this.chapters.reduce((sum, ch) => sum + ch.totalTime, 0);
        console.log(`   总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}秒)`);
        console.log('='.repeat(80));
    }
};

module.exports = CHECKLIST;
