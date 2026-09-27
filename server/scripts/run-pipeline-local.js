require('dotenv').config({ override: true });
process.env.USE_PG = 'false';
process.env.USE_SQLITE = 'false';

const fs = require('fs');
const path = require('path');
const store = require('../store');
const { runPipelineForChapter, CHECKLIST } = require('./pipelineChapterRunner');

const projectIdPath = path.join(__dirname, '../../lastProjectId.txt');
const PROJECT_ID = fs.readFileSync(projectIdPath, 'utf-8').trim();
const TOTAL_CHAPTERS = 20;

console.log('🚀 开始Pipeline执行...\n');
console.log(`项目ID: ${PROJECT_ID}\n`);

async function runFullPipeline() {
    const results = [];
    console.log(`\n📋 开始执行 ${TOTAL_CHAPTERS} 章Pipeline...\n`);

    for (let chapterNum = 1; chapterNum <= TOTAL_CHAPTERS; chapterNum++) {
        const result = await runPipelineForChapter(PROJECT_ID, chapterNum);
        results.push(result);
        if (!result.success) console.error(`\n🚨 第${chapterNum}章失败，继续下一章`);
        if (chapterNum < TOTAL_CHAPTERS) await new Promise(resolve => setTimeout(resolve, 3000));
    }

    CHECKLIST.printReport();
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    if (failedCount === 0) console.log('\n🎉 全部Pipeline执行完成！');
    else console.log(`\n⚠️ ${successCount}章成功，${failedCount}章失败`);
    return results;
}

async function main() { await store.ensureBackend(); await runFullPipeline(); }
main().catch(err => { console.error('❌ Pipeline执行失败:', err); CHECKLIST.printReport(); process.exit(1); });
