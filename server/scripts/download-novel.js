/**
 * 下载完整TXT小说
 */
require('dotenv').config();
process.env.USE_PG = 'false';
process.env.USE_SQLITE = 'false';

const store = require('../store');
const { STATUS_VALUES } = require('../services/chapterStatus');
const fs = require('fs');
const path = require('path');

const projectIdPath = path.join(__dirname, '../../lastProjectId.txt');
const PROJECT_ID = fs.readFileSync(projectIdPath, 'utf-8').trim();

async function downloadNovel() {
    console.log('📖 正在生成完整TXT小说...\n');
    
    const project = await store.getItem('projects', PROJECT_ID);
    if (!project) {
        console.error('❌ 项目不存在！');
        process.exit(1);
    }
    
    const chapters = await store.listItems('chapters');
    const projectChapters = chapters.filter(c => 
        c.projectId === PROJECT_ID && 
        (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED)
    );
    projectChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    if (projectChapters.length === 0) {
        console.error('❌ 没有可下载的章节！');
        process.exit(1);
    }
    
    const lines = [];
    lines.push(`${project.name || 'Untitled'}\n`);
    lines.push(`${project.description || ''}\n`);
    lines.push(`${'='.repeat(60)}\n\n`);
    
    for (const ch of projectChapters) {
        const title = ch.chapterTitle || ch.title || `第${ch.chapterNumber}章`;
        lines.push(`${'='.repeat(60)}`);
        lines.push(`${title}`);
        lines.push(`${'='.repeat(60)}\n`);
        
        const content = ch.polishedContent || ch.content || ch.writerOutput?.content || '';
        if (content) {
            lines.push(content);
        } else {
            lines.push('[内容缺失]');
        }
        lines.push('\n\n');
    }
    
    const novelText = lines.join('\n');
    const filename = `${project.name || 'novel'}_完整${projectChapters.length}章.txt`;
    const filePath = path.join(__dirname, '..', '..', filename);
    
    fs.writeFileSync(filePath, '\ufeff' + novelText, 'utf-8');
    
    console.log(`✅ 小说下载完成！`);
    console.log(`📄 文件名: ${filename}`);
    console.log(`📍 位置: ${filePath}`);
    console.log(`📊 章节数: ${projectChapters.length}章`);
    console.log(`📈 总字数: ${novelText.replace(/\s/g, '').length}字`);
}

downloadNovel().catch(console.error);
