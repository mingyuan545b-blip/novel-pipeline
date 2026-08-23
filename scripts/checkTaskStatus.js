/**
 * 检查异步任务状态
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const TASK_ID = 'task_1782496922242_kpwu4r';

function fetchApi(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3001,
            path: path,
            headers: { 'Authorization': `Bearer ${REQUEST_SECRET}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve(data); }
            });
        }).on('error', reject);
    });
}

(async () => {
    try {
        console.log('=== 检查任务状态 ===');
        const status = await fetchApi(`/api/async-tasks/${TASK_ID}`);
        console.log('任务状态:', JSON.stringify(status, null, 2).substring(0, 1000));

        // 也检查章节状态
        console.log('\n=== 检查章节状态 ===');
        const chapters = await fetchApi(`/api/chapters?projectId=1397512a-9f09-41fd-ac1e-7d68dd5b722f`);
        const chArr = Array.isArray(chapters) ? chapters : (chapters.chapters || []);
        for (const c of chArr) {
            console.log(`第${c.chapterNumber}章: ${c.title}`);
            console.log(`  status: ${c.status || '(无)'}`);
            console.log(`  wordCount: ${c.wordCount || 0}`);
            console.log(`  content length: ${(c.content || '').length}`);
        }
    } catch (err) {
        console.error('检查失败:', err.message);
    } finally {
        process.exit(0);
    }
})();
