/**
 * 临时调试脚本：查询chapter content，检测管线元数据泄露和敏感词
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const chapterId = process.argv[2];

if (!chapterId) {
    console.log('用法: node debugCheckChapterContent.js <chapterId>');
    process.exit(1);
}

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/chapters/${chapterId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(d);
            const chapter = j.chapter || j;
            const content = chapter.content || '';
            console.log(`chapter ${chapter.chapterNumber}: wordCount=${chapter.wordCount}, content.length=${content.length}`);
            console.log(`status: ${chapter.status}`);

            // 检测管线元数据泄露
            const { detectPipelineMetadataLeak } = require('../server/services/contentMetadataDetector');
            const metadataLeak = detectPipelineMetadataLeak(content, chapter.styleProfile || {});
            console.log(`\n=== 管线元数据泄露检测 ===`);
            console.log(`count: ${metadataLeak.count}`);
            metadataLeak.instances.forEach((inst, i) => {
                console.log(`  [${i}] match="${inst.match}", type=${inst.type}, allowable=${inst.allowable}, suggestion=${inst.suggestion}`);
                // 显示上下文
                const start = Math.max(0, inst.position - 40);
                const end = Math.min(content.length, inst.position + inst.match.length + 40);
                console.log(`       context: ...${content.substring(start, end)}...`);
            });

            // 检测敏感词
            const { scanContent } = require('../server/services/sensitiveWordGuard');
            const scanResult = scanContent(content);
            console.log(`\n=== 敏感词检测 ===`);
            console.log(`clean: ${scanResult.clean}, hasWarnings: ${scanResult.hasWarnings}`);
            scanResult.hits.forEach((h, i) => {
                console.log(`  [${i}] word="${h.word}", category=${h.category}, severity=${h.severity}, count=${h.count}`);
                // 显示敏感词上下文
                const regex = new RegExp(h.word, 'g');
                let m;
                let ctxCount = 0;
                while ((m = regex.exec(content)) !== null && ctxCount < 3) {
                    const start = Math.max(0, m.index - 50);
                    const end = Math.min(content.length, m.index + h.word.length + 50);
                    console.log(`       context[${ctxCount}]: ...${content.substring(start, end)}...`);
                    ctxCount++;
                }
            });

            // 输出前2000字内容用于人工检查
            console.log(`\n=== 内容前2000字 ===`);
            console.log(content.substring(0, 2000));
        } catch (e) {
            console.log('Error:', e.message);
            console.log('response:', d.substring(0, 500));
        }
    });
});

req.on('error', e => console.log('Error:', e.message));
req.end();
