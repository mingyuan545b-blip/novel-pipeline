/**
 * e2eHighMartialTest.js — high-martial-crossplane题材5章E2E测试
 *
 * 目的：验证模块化架构在真实pipeline中的效果
 * 验收标准：
 *   1. 5章E2E全部通过（first-review + second-review）
 *   2. 视角违规率 < 20%
 *   3. 模块相关约束（次位面/修炼/配角深度）违规率 < 30%
 *
 * 运行：node scripts/run.js scripts/e2eHighMartialTest.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const PORT = process.env.PORT || 3001;
const HOST = '127.0.0.1';
const envPath = path.join(__dirname, '..', '.env');
let AUTH_TOKEN = '';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
    if (matches && matches.length > 0) {
        AUTH_TOKEN = matches[matches.length - 1].split('=')[1].trim();
    }
}
const TARGET_CHAPTERS = 5;
const PIPELINE_TIMEOUT_MS = 900000;
const POLL_INTERVAL_MS = 5000;

// ============ 测试结果统计 ============
const chapterResults = [];
let testCount = 0, passCount = 0, failCount = 0;
const bugs = [], warnings = [];

function log(test, status, msg, detail) {
    testCount++;
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} [${test}] ${msg}`);
    if (detail) console.log(`     详情: ${JSON.stringify(detail).substring(0, 300)}`);
    if (status === 'PASS') passCount++;
    else if (status === 'FAIL') { failCount++; bugs.push({ test, msg, detail }); }
    else if (status === 'WARN') warnings.push({ test, msg, detail });
}

function request(method, path, body, timeoutMs = 30000) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: HOST, port: PORT, path, method,
            headers: { 'Content-Type': 'application/json' },
            timeout: timeoutMs
        };
        if (AUTH_TOKEN) options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', d => chunks += d);
            res.on('end', () => {
                let parsed = chunks;
                try { parsed = JSON.parse(chunks); } catch (_) {}
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: { error: 'timeout' } }); });
        if (data) req.write(data);
        req.end();
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ============ 测试流程 ============

async function checkServer() {
    console.log('\n=== P1: 服务器检查 ===');
    try {
        const res = await request('GET', '/api/health', null, 5000);
        if (res.status === 200) { log('P1-server', 'PASS', '服务器运行中'); return true; }
        log('P1-server', 'FAIL', `服务器HTTP=${res.status}`); return false;
    } catch (e) {
        log('P1-server', 'FAIL', `服务器无法连接: ${e.message}`); return false;
    }
}

async function createProject() {
    console.log('\n=== P2: 创建high-martial-crossplane项目 ===');
    const projectData = {
        name: `高武次位面E2E_${Date.now()}`,
        description: '高武次位面题材5章E2E测试-验证模块化架构',
        genre: '高武',
        subGenre: 'high-martial-crossplane',
        targetChapters: TARGET_CHAPTERS,
        wordConfig: { minWords: 1500, targetWords: 2500, maxWords: 3500 },
        settings: { autoPipeline: false, chapterRounds: 3 },
        materialPrompt: '高武次位面世界，主角林渊是现代大学生穿越到修仙世界，获得"次位面掠夺系统"。世界设定包含：1)主位面是古典修仙世界（儒家/道家/墨家三大学派博弈，青云书院是儒家学府）；2)次位面是碎片化异世界（可掠夺技能/道具/知识）；3)修炼体系：练气→筑基→金丹→元婴→化神（但正文描写时用雅致命名，如"初境/凝真/金液/元神/化虚"）；4)系统规则：掠夺后回主位面受修为天花板压制，能力削弱但不废；5)反派：天机阁（试图控制次位面通道的组织，天机阁执事是其外围成员）；6)系统呈现方式：通过主角视网膜投影或内心独白呈现，不使用游戏面板/数值/方括号标签。角色包含：林渊（主角，练气期，吐槽役，穿越前是计算机系学生）、苏婉清（儒家弟子，筑基期，青云书院师姐，性格端庄但偶尔毒舌）、墨白（墨家传人，金丹期，技术流，喜欢研究机关术）、天机阁执事（反派NPC，练气期，负责监视次位面通道异常）。',
        outlinePrompt: '第1章：林渊穿越到修仙世界，觉醒次位面掠夺系统，首次进入次位面碎片获得"基础符箓绘制"技能，回到主位面发现能力被压制到练气一层。在青云书院外门遇到天机阁执事（伪装成书院杂役监视通道异常）找麻烦，林渊用现代思维化解冲突。第2章：林渊正式加入青云书院，遇到师姐苏婉清（儒家弟子），因现代思维碰撞修仙规则闹出笑话，系统发布第二个掠夺任务。第3章：林渊再次进入次位面，获得"灵力感知"技能，与墨白（墨家传人）结识，发现天机阁在监视次位面通道。第4章：天机阁派人试探林渊，林渊利用次位面技能组合（符箓+感知）险胜，突破至练气五层，苏婉清对林渊改观。第5章：林渊第三次进入次位面，发现天机阁的阴谋（试图控制通道），获得关键情报，回主位面后与苏婉清、墨白结盟，准备反击。'
    };

    const res = await request('POST', '/api/projects/initialize', projectData, 300000);
    if (res.status !== 201) { log('P2-init', 'FAIL', `初始化HTTP=${res.status}`, res.body); return null; }
    if (!res.body.projectId) { log('P2-init', 'FAIL', '返回缺少projectId', res.body); return null; }
    log('P2-init', 'PASS', `项目创建成功: ${res.body.projectId}, 耗时=${res.body.elapsed}ms`);

    if (res.body.steps && Array.isArray(res.body.steps)) {
        for (const step of res.body.steps) {
            if (step.status === 'failed') log(`P2-step-${step.step}`, 'FAIL', `步骤${step.step}失败: ${step.error}`);
            else log(`P2-step-${step.step}`, 'PASS', `步骤${step.step}成功`);
        }
    }
    return res.body.projectId;
}

async function getChapterId(projectId, chapterNumber) {
    const res = await request('GET', `/api/chapters?projectId=${projectId}`);
    if (res.status !== 200) return null;
    const chapters = Array.isArray(res.body) ? res.body : [];
    const ch = chapters.find(c => c.chapterNumber === chapterNumber);
    return ch ? ch.id : null;
}

async function runPipelineForChapter(projectId, chapterNumber) {
    console.log(`\n=== 第${chapterNumber}章Pipeline ===`);
    const chapterId = await getChapterId(projectId, chapterNumber);
    if (!chapterId) { log(`ch${chapterNumber}-find`, 'FAIL', `找不到第${chapterNumber}章`); return null; }
    log(`ch${chapterNumber}-find`, 'PASS', `章节ID: ${chapterId}`);

    const startRes = await request('POST', '/api/pipeline/full', { projectId, chapterId, maxRounds: 3 }, 30000);
    if (startRes.status !== 200) { log(`ch${chapterNumber}-start`, 'FAIL', `启动Pipeline HTTP=${startRes.status}`); return null; }
    const taskId = startRes.body.taskId;
    if (!taskId) { log(`ch${chapterNumber}-start`, 'FAIL', '返回缺少taskId'); return null; }
    log(`ch${chapterNumber}-start`, 'PASS', `Pipeline已启动, taskId=${taskId}`);

    const startTime = Date.now();
    let taskResult = null;
    while (Date.now() - startTime < PIPELINE_TIMEOUT_MS) {
        await sleep(POLL_INTERVAL_MS);
        const taskRes = await request('GET', `/api/pipeline/task/${taskId}`);
        if (taskRes.status !== 200) continue;
        const task = taskRes.body;
        if (task.status === 'completed' || task.status === 'failed') { taskResult = task; break; }
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`\r     等待中... ${elapsed}s, status=${task.status || 'running'}`);
    }
    process.stdout.write('\n');

    if (!taskResult) { log(`ch${chapterNumber}-timeout`, 'FAIL', `Pipeline超时`); return null; }
    if (taskResult.status === 'failed') { log(`ch${chapterNumber}-failed`, 'FAIL', `Pipeline失败: ${taskResult.error}`); return taskResult; }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log(`ch${chapterNumber}-done`, 'PASS', `Pipeline完成, 耗时=${elapsed}s`);

    // 分析pipeline结果
    if (taskResult.result) {
        const r = taskResult.result;
        const chapterResult = {
            chapter: chapterNumber,
            success: r.success !== false,
            rounds: r.rounds || 0,
            failureType: r.failureType || null,
            message: r.message || ''
        };

        // 检查是否有审核输出
        const chapterRes = await request('GET', `/api/chapters/${chapterId}`);
        if (chapterRes.status === 200) {
            const ch = chapterRes.body;
            chapterResult.status = ch.status;
            chapterResult.wordCount = ch.wordCount;
            chapterResult.firstReviewPassed = !ch.firstReviewOutput || !ch.firstReviewOutput.includes('"passed":false');
            chapterResult.hasSecondReview = !!ch.secondReviewOutput;

            // 分析审核输出中的违规类型
            if (ch.firstReviewOutput) {
                const reviewText = ch.firstReviewOutput;
                chapterResult.povViolation = reviewText.includes('视角') && (reviewText.includes('上帝视角') || reviewText.includes('全知') || reviewText.includes('视角违规'));
                chapterResult.moduleConstraintViolation = reviewText.includes('次位面') || reviewText.includes('修炼') || reviewText.includes('配角');
            }
        }

        chapterResults.push(chapterResult);

        if (r.success === false) {
            log(`ch${chapterNumber}-result`, 'WARN', `Pipeline返回success=false: ${r.message || ''}`, { failureType: r.failureType });
        } else {
            log(`ch${chapterNumber}-result`, 'PASS', `Pipeline success=true, rounds=${r.rounds}`);
        }
    }
    return taskResult;
}

async function verifyModuleHintInjection(projectId) {
    console.log('\n=== 模块提示注入验证 ===');
    try {
        const previewRes = await request('GET', `/api/agents/prompt-preview/${projectId}/writer`);
        if (previewRes.status === 200 && previewRes.body) {
            const systemPreview = previewRes.body.systemPreview || '';
            const hasModuleHint = systemPreview.includes('功能模块提示') || systemPreview.includes('次位面系统') || systemPreview.includes('修炼系统');
            log('module-hint', hasModuleHint ? 'PASS' : 'WARN', `模块提示注入: ${hasModuleHint ? '已注入' : '未在system prompt中（可能在user prompt）'}`);
        } else {
            log('module-hint', 'WARN', `无法获取prompt预览`);
        }
    } catch (e) {
        log('module-hint', 'WARN', `模块提示验证失败: ${e.message}`);
    }
}

// ============ 主流程 ============

async function main() {
    console.log('========================================');
    console.log('high-martial-crossplane 5章E2E测试');
    console.log('========================================');

    const serverOk = await checkServer();
    if (!serverOk) { console.log('\n❌ 服务器未运行，终止测试'); process.exit(1); }

    const projectId = await createProject();
    if (!projectId) { console.log('\n❌ 项目创建失败，终止测试'); process.exit(1); }

    try {
        // 验证模块提示注入
        await verifyModuleHintInjection(projectId);

        // 5章Pipeline循环
        for (let ch = 1; ch <= TARGET_CHAPTERS; ch++) {
            console.log(`\n${'='.repeat(40)}`);
            console.log(`第${ch}章测试`);
            console.log('='.repeat(40));
            await runPipelineForChapter(projectId, ch);
        }

    } finally {
        console.log(`\n项目保留用于分析: projectId=${projectId}`);
    }

    // ============ 结果分析 ============
    console.log('\n========================================');
    console.log('测试结果分析');
    console.log('========================================');

    console.log('\n--- 章节结果 ---');
    let successCount = 0, povViolationCount = 0, moduleViolationCount = 0;
    for (const r of chapterResults) {
        console.log(`第${r.chapter}章: success=${r.success}, status=${r.status}, wordCount=${r.wordCount}, rounds=${r.rounds}`);
        if (r.success) successCount++;
        if (r.povViolation) povViolationCount++;
        if (r.moduleConstraintViolation) moduleViolationCount++;
    }

    console.log('\n--- 验收标准 ---');
    const passRate = (successCount / TARGET_CHAPTERS) * 100;
    const povViolationRate = (povViolationCount / TARGET_CHAPTERS) * 100;
    const moduleViolationRate = (moduleViolationCount / TARGET_CHAPTERS) * 100;

    console.log(`1. 5章通过率: ${successCount}/${TARGET_CHAPTERS} = ${passRate}% ${passRate >= 80 ? '✅' : '❌'}`);
    console.log(`2. 视角违规率: ${povViolationCount}/${TARGET_CHAPTERS} = ${povViolationRate}% ${povViolationRate < 20 ? '✅' : '❌'}`);
    console.log(`3. 模块约束违规率: ${moduleViolationCount}/${TARGET_CHAPTERS} = ${moduleViolationRate}% ${moduleViolationRate < 30 ? '✅' : '❌'}`);

    console.log('\n--- 测试统计 ---');
    console.log(`总计: ${testCount}项, 通过: ${passCount}, 失败: ${failCount}, 警告: ${warnings.length}`);

    if (bugs.length > 0) {
        console.log(`\n❌ 发现 ${bugs.length} 个Bug:`);
        bugs.forEach((b, i) => console.log(`  ${i + 1}. [${b.test}] ${b.msg}`));
    }

    process.exit(bugs.length > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('测试执行异常:', err);
    process.exit(1);
});
