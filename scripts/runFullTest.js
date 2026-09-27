/**
 * 完整测试脚本：新项目全流程测试
 * 1. 生成素材（主角+配角+世界观+装备+功法）
 * 2. 生成大纲（3章）
 * 3. 逐章执行流水线
 * 4. 验证各模块数据
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const PROJECT_ID = '1397512a-9f09-41fd-ac1e-7d68dd5b722f';

function fetchApi(method, path, body, timeoutMs = 300000) {
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
        console.log('========================================');
        console.log('=== 步骤1: 生成素材 ===');
        console.log('========================================');
        const matStart = Date.now();
        const matResp = await fetchApi('POST', '/api/pipeline/generate-materials', {
            projectId: PROJECT_ID,
            prompt: ''
        }, 600000);
        console.log(`HTTP状态: ${matResp.status}`);
        console.log(`耗时: ${((Date.now() - matStart) / 1000).toFixed(1)}秒`);
        if (matResp.data.materials) {
            console.log(`生成素材数: ${matResp.data.materials.length}`);
            for (const m of matResp.data.materials) {
                console.log(`  - ${m.type || m.category || '未知'}: ${m.name || m.title || '(无名)'} (${(m.content || '').length}字符)`);
            }
        } else {
            console.log('响应:', JSON.stringify(matResp.data).substring(0, 500));
        }

        console.log('\n========================================');
        console.log('=== 步骤2: 生成大纲 ===');
        console.log('========================================');
        const outStart = Date.now();
        const outResp = await fetchApi('POST', '/api/pipeline/generate-outlines', {
            projectId: PROJECT_ID,
            prompt: '',
            targetChapters: 3
        }, 600000);
        console.log(`HTTP状态: ${outResp.status}`);
        console.log(`耗时: ${((Date.now() - outStart) / 1000).toFixed(1)}秒`);
        if (outResp.data.chapters) {
            console.log(`生成大纲数: ${outResp.data.chapters.length}`);
            for (const c of outResp.data.chapters) {
                console.log(`  - 第${c.chapterNumber}章: ${c.title || '(无标题)'} (id=${c.id})`);
            }
        } else {
            console.log('响应:', JSON.stringify(outResp.data).substring(0, 500));
        }

        console.log('\n========================================');
        console.log('=== 步骤3: 逐章执行流水线 ===');
        console.log('========================================');

        // 获取章节列表
        const chaptersResp = await fetchApi('GET', `/api/chapters?projectId=${PROJECT_ID}`);
        const chapters = Array.isArray(chaptersResp.data) ? chaptersResp.data : (chaptersResp.data.chapters || []);
        console.log(`章节列表: ${chapters.length}章`);
        for (const c of chapters) {
            console.log(`  - 第${c.chapterNumber}章: ${c.title} (id=${c.id})`);
        }

        // 逐章执行
        for (const chapter of chapters) {
            console.log(`\n--- 执行第${chapter.chapterNumber}章流水线 ---`);
            const chStart = Date.now();
            try {
                const chResp = await fetchApi('POST', '/api/pipeline/full', {
                    projectId: PROJECT_ID,
                    chapterId: chapter.id,
                    maxRounds: 3
                }, 600000);
                console.log(`HTTP状态: ${chResp.status}`);
                console.log(`耗时: ${((Date.now() - chStart) / 1000).toFixed(1)}秒`);
                if (chResp.data.taskId) {
                    console.log(`任务ID: ${chResp.data.taskId}`);
                    // 等待任务完成
                    console.log('等待任务完成...');
                    let completed = false;
                    for (let i = 0; i < 60; i++) {
                        await sleep(10000);
                        const statusResp = await fetchApi('GET', `/api/async-tasks/${chResp.data.taskId}`);
                        if (statusResp.data.status === 'completed' || statusResp.data.status === 'done') {
                            completed = true;
                            console.log(`任务完成! 耗时: ${((Date.now() - chStart) / 1000).toFixed(1)}秒`);
                            if (statusResp.data.result) {
                                console.log(`结果: ${JSON.stringify(statusResp.data.result).substring(0, 300)}`);
                            }
                            break;
                        } else if (statusResp.data.status === 'failed') {
                            console.log(`任务失败: ${statusResp.data.error || JSON.stringify(statusResp.data).substring(0, 300)}`);
                            break;
                        }
                        console.log(`  等待中... (${i + 1}/60)`);
                    }
                    if (!completed) console.log('任务未在超时时间内完成');
                } else {
                    console.log('响应:', JSON.stringify(chResp.data).substring(0, 500));
                }
            } catch (chErr) {
                console.log(`章节流水线错误: ${chErr.message}`);
            }
        }

        console.log('\n========================================');
        console.log('=== 步骤4: 验证各模块数据 ===');
        console.log('========================================');

        // 验证实体中心数据
        console.log('\n--- 4.1 实体中心角色 ---');
        const entResp = await fetchApi('GET', `/api/entity-center/entities?projectId=${PROJECT_ID}&entityType=character`);
        const entities = Array.isArray(entResp.data) ? entResp.data : [];
        console.log(`角色数: ${entities.length}`);
        for (const e of entities) {
            console.log(`  - ${e.name} (${e.roleLevel})`);
            console.log(`    charisma: ${e.charisma ? '✅有' : '❌无'}`);
            console.log(`    philosophy: ${e.philosophy ? '✅有' : '❌无'}`);
            console.log(`    quoteLibrary: ${Array.isArray(e.quoteLibrary) && e.quoteLibrary.length > 0 ? `✅有(${e.quoteLibrary.length}条)` : '❌无'}`);
            console.log(`    entranceDesign: ${e.entranceDesign ? '✅有' : '❌无'}`);
        }

        // 验证装备
        console.log('\n--- 4.2 装备 ---');
        const equipResp = await fetchApi('GET', `/api/entity-center/item-definitions?projectId=${PROJECT_ID}`);
        const equips = Array.isArray(equipResp.data) ? equipResp.data : [];
        console.log(`装备数: ${equips.length}`);
        for (const e of equips.slice(0, 5)) {
            console.log(`  - ${e.name} (${e.defType || e.rarity || '未知'})`);
        }

        // 验证世界域
        console.log('\n--- 4.3 世界域 ---');
        const wsResp = await fetchApi('GET', `/api/worldscope?projectId=${PROJECT_ID}`);
        console.log(`世界域HTTP状态: ${wsResp.status}`);
        if (wsResp.data) {
            const wsData = wsResp.data;
            if (wsData.worldEntities) {
                console.log(`世界实体数: ${wsData.worldEntities.length}`);
            }
            if (wsData.events) {
                console.log(`世界事件数: ${wsData.events.length}`);
            }
        }

        // 验证编年史
        console.log('\n--- 4.4 编年史 ---');
        const chronResp = await fetchApi('GET', `/api/entity-center/character-chronicle?projectId=${PROJECT_ID}`);
        const chronicles = Array.isArray(chronResp.data) ? chronResp.data : [];
        console.log(`编年史记录数: ${chronicles.length}`);
        for (const c of chronicles.slice(0, 5)) {
            console.log(`  - 第${c.chapterNumber}章 ${c.entityName}: ${(c.deeds || '').substring(0, 80)}`);
        }

        console.log('\n========================================');
        console.log('=== 测试完成 ===');
        console.log('========================================');

    } catch (err) {
        console.error('测试失败:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
})();
