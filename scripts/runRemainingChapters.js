/**
 * 执行第2、3章流水线 + 验证所有模块
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const PROJECT_ID = '1397512a-9f09-41fd-ac1e-7d68dd5b722f';

function fetchApi(method, path, body, timeoutMs = 600000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${REQUEST_SECRET}`,
                'Content-Type': 'application/json'
            },
            timeout: timeoutMs
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

        const req = http.request(options, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(respData) }); }
                catch (e) { resolve({ status: res.statusCode, data: respData }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`请求超时(${timeoutMs}ms)`));
        });
        if (data) req.write(data);
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    try {
        // 获取章节列表
        const chaptersResp = await fetchApi('GET', `/api/chapters?projectId=${PROJECT_ID}`);
        const chapters = Array.isArray(chaptersResp.data) ? chaptersResp.data : (chaptersResp.data.chapters || []);

        // 执行未完成的章节
        for (const chapter of chapters) {
            if (chapter.wordCount > 0 || (chapter.content || '').length > 100) {
                console.log(`第${chapter.chapterNumber}章已完成 (${chapter.wordCount}字)，跳过`);
                continue;
            }

            console.log(`\n=== 执行第${chapter.chapterNumber}章流水线 ===`);
            const chStart = Date.now();
            try {
                const chResp = await fetchApi('POST', '/api/pipeline/full', {
                    projectId: PROJECT_ID,
                    chapterId: chapter.id,
                    maxRounds: 3
                });
                console.log(`HTTP状态: ${chResp.status}, 耗时: ${((Date.now() - chStart) / 1000).toFixed(1)}秒`);

                if (chResp.data.taskId) {
                    console.log(`任务ID: ${chResp.data.taskId}，等待章节生成完成...`);
                    // 轮询章节状态而不是异步任务
                    let completed = false;
                    for (let i = 0; i < 90; i++) {
                        await sleep(10000);
                        const chStatusResp = await fetchApi('GET', `/api/chapters/${chapter.id}`);
                        const ch = chStatusResp.data;
                        if (ch && (ch.wordCount > 0 || (ch.content || '').length > 500)) {
                            completed = true;
                            console.log(`✅ 第${chapter.chapterNumber}章完成! 字数: ${ch.wordCount}, 内容长度: ${(ch.content || '').length}`);
                            break;
                        }
                        if (i % 6 === 5) console.log(`  等待中... (${i + 1}/90)`);
                    }
                    if (!completed) console.log(`⚠️ 第${chapter.chapterNumber}章未在超时时间内完成`);
                }
            } catch (chErr) {
                console.log(`章节流水线错误: ${chErr.message}`);
            }
        }

        console.log('\n========================================');
        console.log('=== 验证各模块数据 ===');
        console.log('========================================');

        // 验证实体中心角色
        console.log('\n--- 1. 实体中心角色（含4维度字段）---');
        const entResp = await fetchApi('GET', `/api/entity-center/entities?projectId=${PROJECT_ID}&entityType=character`);
        const entities = Array.isArray(entResp.data) ? entResp.data : [];
        console.log(`角色数: ${entities.length}`);
        for (const e of entities) {
            console.log(`\n  ${e.name} (${e.roleLevel})`);
            console.log(`    charisma: ${e.charisma ? '✅ ' + e.charisma.substring(0, 50) : '❌无'}`);
            console.log(`    philosophy: ${e.philosophy ? '✅ ' + e.philosophy.substring(0, 50) : '❌无'}`);
            console.log(`    quoteLibrary: ${Array.isArray(e.quoteLibrary) && e.quoteLibrary.length > 0 ? `✅有(${e.quoteLibrary.length}条)` : '❌无'}`);
            console.log(`    entranceDesign: ${e.entranceDesign ? '✅ ' + e.entranceDesign.substring(0, 50) : '❌无'}`);
        }

        // 验证装备
        console.log('\n--- 2. 装备 ---');
        const equipResp = await fetchApi('GET', `/api/entity-center/item-definitions?projectId=${PROJECT_ID}`);
        const equips = Array.isArray(equipResp.data) ? equipResp.data : [];
        console.log(`装备数: ${equips.length}`);
        for (const e of equips.slice(0, 5)) {
            console.log(`  - ${e.name} (${e.defType || e.rarity || '未知'})`);
        }

        // 验证世界域
        console.log('\n--- 3. 世界域 ---');
        const wsResp = await fetchApi('GET', `/api/worldscope?projectId=${PROJECT_ID}`);
        console.log(`世界域HTTP状态: ${wsResp.status}`);
        if (wsResp.data && typeof wsResp.data === 'object') {
            const wsData = wsResp.data;
            console.log(`worldEntities: ${wsData.worldEntities ? wsData.worldEntities.length : 0}`);
            console.log(`events: ${wsData.events ? wsData.events.length : 0}`);
        }

        // 验证编年史
        console.log('\n--- 4. 编年史 ---');
        const chronResp = await fetchApi('GET', `/api/entity-center/character-chronicle?projectId=${PROJECT_ID}`);
        const chronicles = Array.isArray(chronResp.data) ? chronResp.data : [];
        console.log(`编年史记录数: ${chronicles.length}`);
        for (const c of chronicles.slice(0, 10)) {
            console.log(`  - 第${c.chapterNumber}章 ${c.entityName}: ${(c.deeds || c.stance || '').substring(0, 80)}`);
        }

        // 验证章节字数
        console.log('\n--- 5. 章节完成状态 ---');
        const chaptersFinal = await fetchApi('GET', `/api/chapters?projectId=${PROJECT_ID}`);
        const chFinal = Array.isArray(chaptersFinal.data) ? chaptersFinal.data : (chaptersFinal.data.chapters || []);
        for (const c of chFinal) {
            console.log(`  第${c.chapterNumber}章: ${c.title} | ${c.wordCount}字 | status=${c.status}`);
        }

        console.log('\n=== 测试完成 ===');
    } catch (err) {
        console.error('测试失败:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
})();
