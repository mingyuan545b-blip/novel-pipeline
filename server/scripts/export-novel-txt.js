
/**
 * 导出完整TXT小说文件
 */

require('dotenv').config({ override: true });

process.env.USE_PG = 'false';
process.env.USE_SQLITE = 'false';

const store = require('../store');
const fs = require('fs');
const path = require('path');

async function exportNovel() {
    // 读取项目ID
    const projectIdPath = path.join(__dirname, '../../lastProjectId.txt');
    const PROJECT_ID = fs.readFileSync(projectIdPath, 'utf-8').trim();
    
    console.log('📖 导出完整TXT小说...\n');
    
    // 获取项目信息
    const project = await store.getItem('projects', PROJECT_ID);
    if (!project) {
        console.error('❌ 项目不存在');
        process.exit(1);
    }
    
    // 获取所有章节
    const allChapters = await store.listItems('chapters');
    const chapters = allChapters
        .filter(c => c.projectId === PROJECT_ID)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    if (chapters.length === 0) {
        console.error('❌ 没有完成的章节');
        process.exit(1);
    }
    
    console.log(`项目名称: ${project.name}`);
    console.log(`章节数量: ${chapters.length}章\n`);
    
    // 构建小说内容
    const lines = [];
    lines.push(`${project.name}`);
    lines.push(`作者: AI创作`);
    lines.push(`题材: ${project.genre || '都市甜宠'}`);
    lines.push(`\n${'='.repeat(50)}\n`);
    
    let totalWords = 0;
    
    for (const ch of chapters) {