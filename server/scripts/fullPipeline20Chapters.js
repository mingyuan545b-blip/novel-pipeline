const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), override: true });
process.env.USE_PG = 'false';
process.env.USE_SQLITE = 'false';

const fs = require('fs');
const store = require('../store');
const { runPipelineForChapter, CHECKLIST } = require('./pipelineChapterRunner');

const projectIdPath = path.join(__dirname, '../../lastProjectId.txt');
const PROJECT_ID = fs.readFileSync(projectIdPath, 'utf-8').trim();
const TOTAL_CHAPTERS = 20;

console.log('🚀 开始完整Pipeline执行（20章全量）...\n');
console.log(`项目ID: ${PROJECT_ID}\n`);

async function runFullPipeline() {
    const results = [];
    console.log(`\n📋 开始执行 ${TOTAL_CHAPTERS} 章完整Pipeline...\n`);

    for (let chapterNum = 1; chapterNum <= TOTAL_CHAPTERS; chapterNum++) {
        const result = await runPipelineForChapter(PROJECT_ID, chapterNum);
        results.push(result);
        if (!result.success) { console.error(`\n🚨 第${chapterNum}章失败，停止执行`); break; }
        if (chapterNum < TOTAL_CHAPTERS) await new Promise(resolve => setTimeout(resolve, 2000));
    }

    CHECKLIST.printReport();
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    if (failedCount === 0) console.log('\n🎉 全部20章Pipeline执行完成！');
    else console.log(`\n⚠️ ${successCount}章成功，${failedCount}章失败`);

    console.log('\n📖 正在生成完整小说...');
    const project = await store.getItem('projects', PROJECT_ID);
    let fullText = project.name + '\n==================================================\n\n' + project.description + '\n\n==================================================\n\n';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        const chapter = await store.getItem('chapters', PROJECT_ID + '-ch' + i);
        if (chapter) fullText += '\n' + chapter.chapterTitle + '\n----------------------------------------\n\n' + chapter.content + '\n\n';
    }
    const outputPath = path.join(__dirname, '../../番茄短故事-破笼之鸟-完整20章.txt');
    fs.writeFileSync(outputPath, fullText, 'utf8');
    console.log('✅ 完整小说生成成功！');
    console.log('📄 文件路径: ' + outputPath);
    console.log('📊 总字数: ' + fullText.length + '字');
    return results;
}

runFullPipeline().catch(err => { console.error('❌ Pipeline执行失败:', err); CHECKLIST.printReport(); process.exit(1); });
