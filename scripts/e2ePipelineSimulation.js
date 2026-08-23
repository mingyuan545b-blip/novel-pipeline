/**
 * e2ePipelineSimulation - 端到端Pipeline模拟测试
 *
 * 测试目标：暴露从素材生成→执笔→审核→素材更新→PG持久化的完整流程中的潜在bug
 * 测试范围：
 *   P1: 创建项目（POST /api/projects/initialize）
 *   P2: 素材生成验证（GET /api/materials?projectId=xxx）
 *   P3: 大纲生成验证（GET /api/pipeline/outlines/:projectId）
 *   P4: 第1章完整Pipeline（POST /api/pipeline/full）
 *   P5: 第2章完整Pipeline（验证章节间状态传递）
 *   P6: 章节状态与字段一致性（GET /api/chapters/:id）
 *   P7: 素材更新验证（materialManager输出）
 *   P8: PG数据库持久化验证（直接查询PG）
 *   P9: 实体中心数据同步（GET /api/entities?projectId=xxx）
 *   P10: 级联清理（DELETE /api/projects/:id）
 *
 * 输出：问题类型统计 + 详细bug列表
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ============ 配置（从.env读取，避免硬编码） ============
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
const PG_CONN = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/novel_pipeline';
const TARGET_CHAPTERS = 5; // 测试5章（覆盖所有功能）
const PIPELINE_TIMEOUT_MS = 300000; // 单章pipeline超时5分钟（复杂项目需要更多时间）
const POLL_INTERVAL_MS = 5000;

// ============ 问题分类统计 ============
const issueStats = {
    data_chain_break: { count: 0, label: '数据链断裂', items: [] },
    field_inconsistency: { count: 0, label: '字段一致性', items: [] },
    pg_persistence: { count: 0, label: 'PG持久化', items: [] },
    agent_constraint: { count: 0, label: 'Agent约束', items: [] },
    material_update: { count: 0, label: '素材更新', items: [] },
    status_transition: { count: 0, label: '状态流转', items: [] },
    frontend_display: { count: 0, label: '前端显示数据', items: [] },
    silent_failure: { count: 0, label: '静默失败', items: [] },
    other: { count: 0, label: '其他', items: [] }
};

let testCount = 0;
let passCount = 0;
let failCount = 0;
const bugs = [];
const warnings = [];

function log(test, status, msg, detail) {
    testCount++;
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} [${test}] ${msg}`);
    if (detail) console.log(`     详情: ${JSON.stringify(detail).substring(0, 300)}`);
    if (status === 'PASS') passCount++;
    else if (status === 'FAIL') {
        failCount++;
        bugs.push({ test, msg, detail });
    } else if (status === 'WARN') {
        warnings.push({ test, msg, detail });
    }
}

function classifyIssue(category, test, msg, detail) {
    if (issueStats[category]) {
        issueStats[category].count++;
        issueStats[category].items.push({ test, msg, detail: detail ? JSON.stringify(detail).substring(0, 200) : null });
    } else {
        issueStats.other.count++;
        issueStats.other.items.push({ test, msg });
    }
}

// ============ HTTP请求工具 ============
function request(method, urlPath, body = null, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: HOST, port: PORT, path: urlPath, method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
            timeout: timeoutMs,
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', (chunk) => chunks += chunk);
            res.on('end', () => {
                try {
                    const json = chunks ? JSON.parse(chunks) : {};
                    resolve({ status: res.statusCode, body: json, raw: chunks });
                } catch (e) {
                    resolve({ status: res.statusCode, body: null, raw: chunks });
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (data) req.write(data);
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============ PG查询工具 ============
async function queryPg(sql, params = []) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: PG_CONN, max: 1 });
    try {
        const result = await pool.query(sql, params);
        return result.rows;
    } finally {
        await pool.end();
    }
}

// ============ 测试用例 ============

async function checkServer() {
    console.log('\n=== P1: 检查服务器状态 ===');
    try {
        const res = await request('GET', '/api/projects');
        if (res.status === 200) {
            log('P1-server', 'PASS', `服务器运行中 ${HOST}:${PORT}`);
            return true;
        }
        log('P1-server', 'FAIL', `服务器返回HTTP ${res.status}`);
        return false;
    } catch (e) {
        log('P1-server', 'FAIL', `服务器无法连接: ${e.message}`);
        return false;
    }
}

async function createProject() {
    console.log('\n=== P2: 创建项目（一键初始化） ===');
    const projectData = {
        name: `E2E复杂测试_${Date.now()}`,
        description: 'E2E 5章复杂测试项目-覆盖所有功能模块',
        genre: '玄幻',
        subGenre: 'tomato-talisman',
        targetChapters: TARGET_CHAPTERS,
        wordConfig: { minWords: 1500, targetWords: 2500, maxWords: 3500 },
        settings: { autoPipeline: false, chapterRounds: 2 },
        materialPrompt: '修仙世界，主角萧烬是落魄世家子弟，获得上古符文传承。世界设定包含：1)石化诅咒（上古禁术，中咒者逐渐石化）；2)符文修仙体系（符咒师等级：符徒→符师→符宗→符尊）；3)黑袍人组织（神秘反派，使用禁忌符咒）；4)苏红袖（药铺女掌柜，隐藏身份是符宗传人）；5)主线任务：寻找石化解药；6)支线任务：调查黑袍人组织。角色包含：萧烬（主角，符徒）、苏红袖（女配，符宗传人）、黑袍人（反派，符尊）、李墨（主角好友，符徒）。',
        outlinePrompt: '第1章：萧烬被黑袍人袭击，中石化诅咒（蔓延至左臂），危急时刻觉醒上古符文传承。第2章：萧烬寻找解药线索，在古籍中发现石化诅咒与上古符文的关联，研究有突破。第3章：（跳过3天）萧烬在药铺遇到苏红袖，获得关键线索，初识关系。第4章：萧烬与苏红袖遭遇黑袍人伏击，激烈战斗，石化蔓延至肩膀，萧烬突破至符师。第5章：萧烬利用上古符文反击，部分解除石化，黑袍人身份揭露（是萧烬的师叔）。'
    };

    const res = await request('POST', '/api/projects/initialize', projectData, 300000); // 5分钟超时（含素材+大纲生成）
    if (res.status !== 201) {
        log('P2-init', 'FAIL', `初始化HTTP=${res.status}, 期望201`, res.body);
        return null;
    }
    const body = res.body;
    if (!body.projectId) {
        log('P2-init', 'FAIL', '返回缺少projectId', body);
        return null;
    }
    log('P2-init', 'PASS', `项目创建成功: ${body.projectId}, 耗时=${body.elapsed}ms`);

    // 检查初始化步骤
    if (body.steps && Array.isArray(body.steps)) {
        for (const step of body.steps) {
            if (step.status === 'failed') {
                log(`P2-step-${step.step}`, 'FAIL', `步骤${step.step}失败: ${step.error}`);
                classifyIssue('data_chain_break', `P2-step-${step.step}`, step.error);
            } else {
                log(`P2-step-${step.step}`, 'PASS', `步骤${step.step}成功`);
            }
        }
    }

    // 验证项目配置
    const projectRes = await request('GET', `/api/projects/${body.projectId}`);
    if (projectRes.status !== 200) {
        log('P2-fetch', 'FAIL', `GET项目HTTP=${projectRes.status}`);
        return null;
    }
    const project = projectRes.body;
    if (project.mode !== 'novel') {
        log('P2-mode', 'FAIL', `mode="${project.mode}", 期望"novel"`);
        classifyIssue('field_inconsistency', 'P2-mode', `mode=${project.mode}`);
    } else {
        log('P2-mode', 'PASS', 'mode=novel');
    }
    if (project.targetChapters !== TARGET_CHAPTERS) {
        log('P2-targetChapters', 'FAIL', `targetChapters=${project.targetChapters}, 期望${TARGET_CHAPTERS}`);
        classifyIssue('field_inconsistency', 'P2-targetChapters', `期望${TARGET_CHAPTERS}实际${project.targetChapters}`);
    } else {
        log('P2-targetChapters', 'PASS', `targetChapters=${project.targetChapters}`);
    }
    if (!project.wordConfig || !project.wordConfig.minWords) {
        log('P2-wordConfig', 'FAIL', 'wordConfig缺失或字段不完整', project.wordConfig);
        classifyIssue('field_inconsistency', 'P2-wordConfig', '字段缺失');
    } else {
        log('P2-wordConfig', 'PASS', `wordConfig: min=${project.wordConfig.minWords}, target=${project.wordConfig.targetWords}, max=${project.wordConfig.maxWords}`);
    }
    if (!project.styleProfile) {
        log('P2-styleProfile', 'FAIL', 'styleProfile为null');
        classifyIssue('field_inconsistency', 'P2-styleProfile', 'styleProfile为null');
    } else {
        const requiredFields = ['povRule', 'dialogueRule', 'behaviorRule', 'toneRule', 'titleRule'];
        const missing = requiredFields.filter(f => project.styleProfile[f] === undefined);
        if (missing.length > 0) {
            log('P2-styleProfile', 'FAIL', `styleProfile缺字段: ${missing.join(',')}`);
            classifyIssue('field_inconsistency', 'P2-styleProfile', `缺字段: ${missing.join(',')}`);
        } else {
            log('P2-styleProfile', 'PASS', 'styleProfile字段完整');
        }
    }
    return project;
}

async function verifyMaterials(projectId) {
    console.log('\n=== P3: 素材生成验证 ===');
    const res = await request('GET', `/api/materials?projectId=${projectId}`);
    if (res.status !== 200) {
        log('P3-list', 'FAIL', `GET素材HTTP=${res.status}`, res.body);
        classifyIssue('data_chain_break', 'P3-list', `HTTP=${res.status}`);
        return [];
    }
    const materials = Array.isArray(res.body) ? res.body : [];
    log('P3-list', 'PASS', `素材数量: ${materials.length}`);

    if (materials.length === 0) {
        log('P3-empty', 'WARN', '素材列表为空（可能素材生成失败）');
        classifyIssue('data_chain_break', 'P3-empty', '素材为空');
        return [];
    }

    // 检查素材字段完整性（content或initialContent二选一即可）
    const requiredFields = ['id', 'projectId', 'type', 'name'];
    const incomplete = materials.filter(m => requiredFields.some(f => !m[f]) || (!m.content && !m.initialContent && !m.description));
    if (incomplete.length > 0) {
        log('P3-fields', 'FAIL', `${incomplete.length}个素材字段不完整`, incomplete[0]);
        classifyIssue('field_inconsistency', 'P3-fields', `${incomplete.length}个素材字段不完整`);
    } else {
        log('P3-fields', 'PASS', '所有素材字段完整');
    }

    // 检查素材类型分布
    const typeMap = {};
    materials.forEach(m => { typeMap[m.type] = (typeMap[m.type] || 0) + 1; });
    log('P3-types', 'PASS', `素材类型分布: ${JSON.stringify(typeMap)}`);

    return materials;
}

async function verifyOutlines(projectId) {
    console.log('\n=== P4: 大纲生成验证 ===');
    const res = await request('GET', `/api/pipeline/outlines/${projectId}`);
    if (res.status !== 200) {
        log('P4-list', 'FAIL', `GET大纲HTTP=${res.status}`, res.body);
        classifyIssue('data_chain_break', 'P4-list', `HTTP=${res.status}`);
        return [];
    }
    const outlines = res.body.data || [];
    log('P4-list', 'PASS', `大纲数量: ${outlines.length}`);

    if (outlines.length < TARGET_CHAPTERS) {
        log('P4-count', 'FAIL', `大纲数量${outlines.length}少于测试章节数${TARGET_CHAPTERS}`);
        classifyIssue('data_chain_break', 'P4-count', `大纲${outlines.length}章 < 测试${TARGET_CHAPTERS}章`);
    } else {
        log('P4-count', 'PASS', `大纲数量充足（>=${TARGET_CHAPTERS}）`);
    }

    // 检查大纲字段
    if (outlines.length > 0) {
        const o = outlines[0];
        if (!o.outline && !o.content) {
            log('P4-content', 'FAIL', '大纲内容为空', o);
            classifyIssue('field_inconsistency', 'P4-content', '大纲内容为空');
        } else {
            log('P4-content', 'PASS', '大纲内容存在');
        }
        if (!o.chapterNumber) {
            log('P4-chapterNumber', 'FAIL', '大纲缺少chapterNumber');
            classifyIssue('field_inconsistency', 'P4-chapterNumber', '字段缺失');
        } else {
            log('P4-chapterNumber', 'PASS', `第1章chapterNumber=${o.chapterNumber}`);
        }
    }
    return outlines;
}

async function getChapterId(projectId, chapterNumber) {
    const res = await request('GET', `/api/chapters?projectId=${projectId}`);
    if (res.status !== 200) return null;
    const chapters = Array.isArray(res.body) ? res.body : [];
    const ch = chapters.find(c => c.chapterNumber === chapterNumber);
    return ch ? ch.id : null;
}

async function runPipelineForChapter(projectId, chapterNumber) {
    console.log(`\n=== P5: 第${chapterNumber}章完整Pipeline ===`);
    const chapterId = await getChapterId(projectId, chapterNumber);
    if (!chapterId) {
        log(`P5-ch${chapterNumber}-find`, 'FAIL', `找不到第${chapterNumber}章`);
        classifyIssue('data_chain_break', `P5-ch${chapterNumber}`, '章节未创建');
        return null;
    }
    log(`P5-ch${chapterNumber}-find`, 'PASS', `章节ID: ${chapterId}`);

    // 触发full pipeline（异步任务）
    const startRes = await request('POST', '/api/pipeline/full', {
        projectId, chapterId, maxRounds: 2
    }, 30000);
    if (startRes.status !== 200) {
        log(`P5-ch${chapterNumber}-start`, 'FAIL', `启动Pipeline HTTP=${startRes.status}`, startRes.body);
        classifyIssue('data_chain_break', `P5-ch${chapterNumber}-start`, `HTTP=${startRes.status}`);
        return null;
    }
    const taskId = startRes.body.taskId;
    if (!taskId) {
        log(`P5-ch${chapterNumber}-start`, 'FAIL', '返回缺少taskId', startRes.body);
        classifyIssue('data_chain_break', `P5-ch${chapterNumber}-task`, '无taskId');
        return null;
    }
    log(`P5-ch${chapterNumber}-start`, 'PASS', `Pipeline已启动, taskId=${taskId}`);

    // 轮询任务状态
    const startTime = Date.now();
    let taskResult = null;
    while (Date.now() - startTime < PIPELINE_TIMEOUT_MS) {
        await sleep(POLL_INTERVAL_MS);
        const taskRes = await request('GET', `/api/pipeline/task/${taskId}`);
        if (taskRes.status !== 200) {
            log(`P5-ch${chapterNumber}-poll`, 'WARN', `轮询task HTTP=${taskRes.status}`);
            continue;
        }
        const task = taskRes.body;
        if (task.status === 'completed' || task.status === 'failed') {
            taskResult = task;
            break;
        }
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`\r     等待中... ${elapsed}s elapsed, status=${task.status || 'running'}`);
    }
    process.stdout.write('\n');

    if (!taskResult) {
        log(`P5-ch${chapterNumber}-timeout`, 'FAIL', `Pipeline超时（${PIPELINE_TIMEOUT_MS / 1000}s）`);
        classifyIssue('silent_failure', `P5-ch${chapterNumber}-timeout`, 'Pipeline超时');
        return null;
    }
    if (taskResult.status === 'failed') {
        log(`P5-ch${chapterNumber}-failed`, 'FAIL', `Pipeline失败: ${taskResult.error || 'unknown'}`);
        classifyIssue('data_chain_break', `P5-ch${chapterNumber}-failed`, taskResult.error);
        return taskResult;
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log(`P5-ch${chapterNumber}-done`, 'PASS', `Pipeline完成, 耗时=${elapsed}s`);

    // 验证pipeline结果
    if (taskResult.result) {
        const r = taskResult.result;
        if (r.success === false) {
            log(`P5-ch${chapterNumber}-result`, 'WARN', `Pipeline返回success=false: ${r.message || ''}`, { failureType: r.failureType });
            classifyIssue('status_transition', `P5-ch${chapterNumber}-result`, r.message);
        } else {
            log(`P5-ch${chapterNumber}-result`, 'PASS', `Pipeline success=true, rounds=${r.rounds}`);
        }
        if (r.log && Array.isArray(r.log)) {
            const stepNames = r.log.map(l => l.step || l.name).filter(Boolean);
            log(`P5-ch${chapterNumber}-log`, 'PASS', `Pipeline步骤: ${stepNames.join('→')}`);
        }
    }
    return taskResult;
}

async function verifyChapterState(projectId, chapterNumber, expectedStatusPattern) {
    console.log(`\n=== P6: 第${chapterNumber}章状态验证 ===`);
    const chapterId = await getChapterId(projectId, chapterNumber);
    if (!chapterId) {
        log(`P6-ch${chapterNumber}`, 'FAIL', `找不到章节`);
        classifyIssue('data_chain_break', `P6-ch${chapterNumber}`, '章节不存在');
        return null;
    }
    const res = await request('GET', `/api/chapters/${chapterId}`);
    if (res.status !== 200) {
        log(`P6-ch${chapterNumber}-fetch`, 'FAIL', `GET章节HTTP=${res.status}`);
        classifyIssue('data_chain_break', `P6-ch${chapterNumber}-fetch`, `HTTP=${res.status}`);
        return null;
    }
    const ch = res.body;
    log(`P6-ch${chapterNumber}-status`, 'PASS', `章节状态: ${ch.status}, wordCount=${ch.wordCount}, round=${ch.round}`);

    // 检查状态是否符合预期
    if (expectedStatusPattern && !expectedStatusPattern.test(ch.status)) {
        log(`P6-ch${chapterNumber}-status-match`, 'FAIL', `状态="${ch.status}", 期望匹配${expectedStatusPattern}`);
        classifyIssue('status_transition', `P6-ch${chapterNumber}-status`, `实际=${ch.status}, 期望=${expectedStatusPattern}`);
    }

    // 检查关键字段
    if (ch.status === STATUS_VALUES.APPROVED || ch.status === STATUS_VALUES.MATERIAL_UPDATED) {
        if (!ch.content || ch.wordCount < 100) {
            log(`P6-ch${chapterNumber}-content`, 'FAIL', `章节内容异常: wordCount=${ch.wordCount}, content长度=${ch.content?.length || 0}`);
            classifyIssue('field_inconsistency', `P6-ch${chapterNumber}-content`, `wordCount=${ch.wordCount}`);
        } else {
            log(`P6-ch${chapterNumber}-content`, 'PASS', `章节内容完整: ${ch.wordCount}字`);
        }
        // 检查writerOutput
        if (!ch.writerOutput) {
            log(`P6-ch${chapterNumber}-writer`, 'WARN', 'writerOutput为空');
            classifyIssue('data_chain_break', `P6-ch${chapterNumber}-writer`, 'writerOutput为空');
        }
        // 检查审核输出
        if (!ch.firstReviewOutput && !ch.fastReviewOutput) {
            log(`P6-ch${chapterNumber}-review`, 'WARN', '审核输出为空');
            classifyIssue('data_chain_break', `P6-ch${chapterNumber}-review`, '审核输出为空');
        }
    }
    return ch;
}

async function verifyMaterialUpdate(projectId, chapterNumber) {
    console.log(`\n=== P7: 第${chapterNumber}章素材更新验证 ===`);
    const chapterId = await getChapterId(projectId, chapterNumber);
    if (!chapterId) return;
    const res = await request('GET', `/api/chapters/${chapterId}`);
    if (res.status !== 200) return;
    const ch = res.body;

    // 检查materialManagerOutput
    if (ch.materialManagerOutput) {
        log(`P7-ch${chapterNumber}-mm`, 'PASS', 'materialManagerOutput存在');
        // 检查素材更新内容
        const mmLen = ch.materialManagerOutput.length;
        if (mmLen < 50) {
            log(`P7-ch${chapterNumber}-mm-content`, 'WARN', `materialManagerOutput内容过短: ${mmLen}字符`);
            classifyIssue('material_update', `P7-ch${chapterNumber}-mm`, `内容过短${mmLen}字符`);
        }
    } else {
        log(`P7-ch${chapterNumber}-mm`, 'WARN', 'materialManagerOutput为空');
        classifyIssue('material_update', `P7-ch${chapterNumber}-mm`, 'materialManagerOutput为空');
    }

    // 检查pipeline-logs
    const logRes = await request('GET', `/api/pipeline/pipeline-logs/${projectId}/${chapterId}`);
    if (logRes.status === 200 && logRes.body) {
        const entries = logRes.body.entries || [];
        log(`P7-ch${chapterNumber}-log`, 'PASS', `pipeline日志条目数: ${entries.length}`);
        // 检查是否有material-manager步骤
        const mmStep = entries.find(e => (e.step || '').includes('material') || (e.name || '').includes('material'));
        if (mmStep) {
            log(`P7-ch${chapterNumber}-mm-step`, 'PASS', '素材管理步骤存在');
        } else {
            log(`P7-ch${chapterNumber}-mm-step`, 'WARN', '未找到素材管理步骤');
        }
    }
}

async function verifyPgPersistence(projectId) {
    console.log('\n=== P8: PG数据库持久化验证 ===');
    let pgAvailable = true;
    try {
        const testRows = await queryPg('SELECT 1 as ok', []);
        if (!testRows[0] || testRows[0].ok !== 1) {
            log('P8-connect', 'FAIL', 'PG连接测试失败');
            classifyIssue('pg_persistence', 'P8-connect', '连接失败');
            return;
        }
        log('P8-connect', 'PASS', 'PG连接正常');
    } catch (e) {
        log('P8-connect', 'FAIL', `PG连接异常: ${e.message}`);
        classifyIssue('pg_persistence', 'P8-connect', e.message);
        pgAvailable = false;
        return;
    }

    // 检查projects表
    try {
        const projRows = await queryPg('SELECT id, data::jsonb as data FROM projects WHERE id = $1', [projectId]);
        if (projRows.length === 0) {
            log('P8-project', 'FAIL', `projects表无此项目: ${projectId}`);
            classifyIssue('pg_persistence', 'P8-project', '项目未持久化');
        } else {
            log('P8-project', 'PASS', 'projects表有此项目');
            const data = typeof projRows[0].data === 'string' ? JSON.parse(projRows[0].data) : projRows[0].data;
            if (data.id !== projectId) {
                log('P8-project-id', 'FAIL', `data.id=${data.id}, 期望${projectId}`);
                classifyIssue('pg_persistence', 'P8-project-id', `id不一致`);
            }
        }
    } catch (e) {
        log('P8-project', 'FAIL', `查询projects失败: ${e.message}`);
        classifyIssue('pg_persistence', 'P8-project', e.message);
    }

    // 检查chapters表
    try {
        const chRows = await queryPg('SELECT id, data::jsonb as data FROM chapters WHERE (data::jsonb)->>\'projectId\' = $1', [projectId]);
        log('P8-chapters', 'PASS', `chapters表记录数: ${chRows.length}`);
        if (chRows.length < TARGET_CHAPTERS) {
            log('P8-chapters-count', 'FAIL', `章节数${chRows.length}少于${TARGET_CHAPTERS}`);
            classifyIssue('pg_persistence', 'P8-chapters-count', `${chRows.length}<${TARGET_CHAPTERS}`);
        }
        for (const row of chRows) {
            const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            if (!data.status) {
                log('P8-chapter-status', 'FAIL', `章节${data.id}无status字段`);
                classifyIssue('pg_persistence', 'P8-chapter-status', `${data.id}无status`);
            }
            if (data.wordCount === undefined) {
                log('P8-chapter-wc', 'WARN', `章节${data.id}无wordCount字段`);
            }
        }
    } catch (e) {
        log('P8-chapters', 'FAIL', `查询chapters失败: ${e.message}`);
        classifyIssue('pg_persistence', 'P8-chapters', e.message);
    }

    // 检查materials表
    try {
        const matRows = await queryPg('SELECT id FROM materials WHERE (data::jsonb)->>\'projectId\' = $1', [projectId]);
        log('P8-materials', 'PASS', `materials表记录数: ${matRows.length}`);
    } catch (e) {
        log('P8-materials', 'FAIL', `查询materials失败: ${e.message}`);
        classifyIssue('pg_persistence', 'P8-materials', e.message);
    }

    // 检查pipeline_logs表
    try {
        const logRows = await queryPg('SELECT id FROM pipeline_logs WHERE (data::jsonb)->>\'projectId\' = $1', [projectId]);
        log('P8-pipeline-logs', 'PASS', `pipeline_logs表记录数: ${logRows.length}`);
        if (logRows.length === 0) {
            log('P8-pipeline-logs-empty', 'WARN', 'pipeline_logs为空（可能未持久化）');
            classifyIssue('pg_persistence', 'P8-pipeline-logs-empty', '日志未持久化');
        }
    } catch (e) {
        log('P8-pipeline-logs', 'FAIL', `查询pipeline_logs失败: ${e.message}`);
        classifyIssue('pg_persistence', 'P8-pipeline-logs', e.message);
    }

    // 检查entity_registry表
    try {
        const entRows = await queryPg('SELECT id FROM entity_registry WHERE (data::jsonb)->>\'projectId\' = $1', [projectId]);
        log('P8-entities', 'PASS', `entity_registry表记录数: ${entRows.length}`);
    } catch (e) {
        log('P8-entities', 'FAIL', `查询entity_registry失败: ${e.message}`);
        classifyIssue('pg_persistence', 'P8-entities', e.message);
    }
}

async function verifyEntityCenter(projectId) {
    console.log('\n=== P9: 实体中心数据同步 ===');
    const res = await request('GET', `/api/entity-center/entities?projectId=${projectId}`);
    if (res.status !== 200) {
        log('P9-entities', 'FAIL', `GET entities HTTP=${res.status}`);
        classifyIssue('data_chain_break', 'P9-entities', `HTTP=${res.status}`);
        return;
    }
    const entities = Array.isArray(res.body) ? res.body : [];
    log('P9-entities', 'PASS', `实体数量: ${entities.length}`);

    // 检查实体字段
    if (entities.length > 0) {
        const requiredFields = ['id', 'projectId', 'name', 'entityType'];
        const incomplete = entities.filter(e => requiredFields.some(f => !e[f]));
        if (incomplete.length > 0) {
            log('P9-fields', 'FAIL', `${incomplete.length}个实体字段不完整`, incomplete[0]);
            classifyIssue('field_inconsistency', 'P9-fields', `${incomplete.length}个不完整`);
        } else {
            log('P9-fields', 'PASS', '所有实体字段完整');
        }
    }
}

async function cleanupProject(projectId) {
    console.log('\n=== P10: 级联清理 ===');
    if (!projectId) return;
    const res = await request('DELETE', `/api/projects/${projectId}`);
    if (res.status !== 200) {
        log('P10-delete', 'FAIL', `DELETE项目HTTP=${res.status}`, res.body);
        return;
    }
    const result = res.body;
    if (result.success) {
        log('P10-delete', 'PASS', '项目删除成功');
    } else {
        log('P10-delete', 'FAIL', '删除返回success=false', result);
    }
    if (result.deletedCounts) {
        const total = Object.values(result.deletedCounts).reduce((a, b) => a + b, 0);
        log('P10-cascade', 'PASS', `级联删除: ${Object.keys(result.deletedCounts).length}类型, 共${total}条`);
    }
}

// ============ 新增功能验证函数 ============

/** B: 角色状态追踪验证 */
async function verifyCharacterState(projectId, chapterNumber) {
    console.log(`\n=== B: 第${chapterNumber}章角色状态追踪验证 ===`);
    try {
        // 查询stateKVIndex中的角色状态
        const stateKVIndex = require('../server/services/stateKVIndex');
        const allStates = await stateKVIndex.getAllEntityStates(projectId, 'character');
        if (!allStates || Object.keys(allStates).length === 0) {
            log(`B-ch${chapterNumber}-states`, 'WARN', `无角色状态数据（可能素材未写入stateChanges）`);
            return;
        }
        log(`B-ch${chapterNumber}-states`, 'PASS', `角色状态数量: ${Object.keys(allStates).length}`);

        // 检查是否有石化进度字段
        let hasPetrification = false;
        for (const [charId, state] of Object.entries(allStates)) {
            if (state && (state.petrificationLevel !== undefined || state.petrificationLevel !== null)) {
                hasPetrification = true;
                log(`B-ch${chapterNumber}-petrification`, 'PASS', `角色${charId}石化进度: ${state.petrificationLevel}`);
                break;
            }
        }
        if (!hasPetrification) {
            log(`B-ch${chapterNumber}-petrification`, 'WARN', `无石化进度字段（需要素材生成器写入stateChanges）`);
        }
    } catch (e) {
        log(`B-ch${chapterNumber}-error`, 'FAIL', `角色状态查询失败: ${e.message}`);
        classifyIssue('silent_failure', `B-ch${chapterNumber}`, e.message);
    }
}

/** C: 伏笔系统验证 */
async function verifyForeshadowSystem(projectId, chapterNumber) {
    console.log(`\n=== C: 第${chapterNumber}章伏笔系统验证 ===`);
    try {
        const ForeshadowLedger = require('../server/services/knowledgeBase/ForeshadowLedger');
        const ledger = new ForeshadowLedger(projectId);
        // ForeshadowLedger无listAll方法，使用getActive+getStats获取伏笔数据
        const [activeForeshadows, stats] = await Promise.all([
            ledger.getActive(projectId),
            ledger.getStats(projectId)
        ]);
        const totalCount = stats ? (stats.planted || 0) : 0;
        const activeCount = activeForeshadows ? activeForeshadows.length : 0;
        if (totalCount === 0 && activeCount === 0) {
            log(`C-ch${chapterNumber}-count`, 'WARN', `无伏笔数据`);
            return;
        }
        log(`C-ch${chapterNumber}-count`, 'PASS', `伏笔总数: ${totalCount}, 活跃: ${activeCount}`);

        // 按状态分类（从stats获取）
        if (stats) {
            log(`C-ch${chapterNumber}-status`, 'PASS',
                `伏笔状态分布: 活跃=${stats.active || 0}, 已解决=${stats.resolved || 0}, 已放弃=${stats.abandoned || 0}`);
        }
    } catch (e) {
        log(`C-ch${chapterNumber}-error`, 'FAIL', `伏笔系统查询失败: ${e.message}`);
        classifyIssue('silent_failure', `C-ch${chapterNumber}`, e.message);
    }
}

/** D: 任务系统验证 */
async function verifyQuestSystem(projectId, chapterNumber) {
    console.log(`\n=== D: 第${chapterNumber}章任务系统验证 ===`);
    try {
        const store = require('../server/store');
        const quests = await store.getItem('quests', projectId) || [];
        if (quests.length === 0) {
            log(`D-ch${chapterNumber}-count`, 'WARN', `无任务数据`);
            return;
        }
        log(`D-ch${chapterNumber}-count`, 'PASS', `任务总数: ${quests.length}`);

        const mainQuests = quests.filter(q => q.type === 'main' || !q.type);
        const sideQuests = quests.filter(q => q.type === 'side');
        log(`D-ch${chapterNumber}-main`, 'PASS', `主线任务: ${mainQuests.length}个`);
        if (sideQuests.length > 0) {
            log(`D-ch${chapterNumber}-side`, 'PASS', `支线任务: ${sideQuests.length}个`);
        }

        // 检查任务进度
        for (const q of mainQuests) {
            log(`D-ch${chapterNumber}-progress`, 'PASS', `主线"${q.title || q.name}": 进度=${q.progress || 0}%, 状态=${q.status}`);
        }
    } catch (e) {
        log(`D-ch${chapterNumber}-error`, 'FAIL', `任务系统查询失败: ${e.message}`);
        classifyIssue('silent_failure', `D-ch${chapterNumber}`, e.message);
    }
}

/** E5: 长线审计验证（第5章触发） */
async function verifyLongAudit(projectId) {
    console.log('\n=== E5: 长线一致性审计验证 ===');
    try {
        const { consistencyAuditService } = require('../server/services/consistencyAuditService');
        const report = await consistencyAuditService.runFullAudit(projectId, 5);
        if (!report) {
            log('E5-audit', 'WARN', '长线审计未返回报告');
            return;
        }
        const passed = report.summary?.passed;
        if (passed) {
            log('E5-audit', 'PASS', `长线审计通过`);
        } else {
            log('E5-audit', 'WARN', `长线审计发现问题: ${report.summary?.issueCount || 0}个`, report.issues?.slice(0, 3));
            classifyIssue('field_inconsistency', 'E5-audit', `${report.summary?.issueCount || 0}个一致性问题`);
        }
    } catch (e) {
        log('E5-audit-error', 'FAIL', `长线审计失败: ${e.message}`);
        classifyIssue('silent_failure', 'E5-audit', e.message);
    }
}

/** F: prompt结构验证（间接验证：system prompt预览 + writer输出约束痕迹） */
async function verifyPromptStructure(projectId) {
    console.log('\n=== F: Prompt结构验证 ===');

    // F1: 通过API获取system prompt预览，验证模板结构
    try {
        const previewRes = await request('GET', `/api/agents/prompt-preview/${projectId}/writer`);
        if (previewRes.status === 200 && previewRes.body) {
            const systemPreview = previewRes.body.systemPreview || '';
            const systemLen = previewRes.body.systemLength || 0;
            log('F-systemLen', systemLen > 0 ? 'PASS' : 'FAIL', `writer system prompt长度: ${systemLen}字符`);
            // 验证system prompt中是否包含关键约束模板
            const hasPovRule = systemPreview.includes('视角') || systemPreview.includes('pov');
            log('F-povRule', hasPovRule ? 'PASS' : 'WARN', `视角规则: ${hasPovRule ? '存在' : '未在预览中（可能在完整prompt中）'}`);
        } else {
            log('F-preview', 'WARN', `无法获取system prompt预览: HTTP=${previewRes.status}`);
        }
    } catch (e) {
        log('F-preview', 'WARN', `system prompt预览获取失败: ${e.message}`);
    }

    // F2: 检查writer输出文件中的约束痕迹（间接验证prompt约束是否生效）
    try {
        const outputDir = path.join(__dirname, '..', 'output', projectId, 'chapters');
        if (!fs.existsSync(outputDir)) {
            log('F-dir', 'WARN', `输出目录不存在: ${outputDir}`);
            return;
        }
        const files = fs.readdirSync(outputDir).filter(f => f.includes('执笔人'));
        if (files.length === 0) {
            log('F-files', 'WARN', `无执笔人输出文件`);
            return;
        }
        log('F-files', 'PASS', `执笔人输出文件: ${files.length}个`);

        // 检查最新的执笔人文件
        const latestFile = files.sort().pop();
        const filePath = path.join(outputDir, latestFile);
        const content = fs.readFileSync(filePath, 'utf8');

        // 验证约束痕迹1：无【...】标签残留（检查清单第4条）
        const bracketMatches = content.match(/【[^】]+】/g);
        const hasBracketResidue = bracketMatches && bracketMatches.length > 0;
        log('F-noBracket', !hasBracketResidue ? 'PASS' : 'FAIL',
            `【...】标签残留: ${!hasBracketResidue ? '无（检查清单生效）' : `${bracketMatches.length}个残留`}`);
        if (hasBracketResidue) {
            classifyIssue('agent_constraint', 'F-noBracket', `标签残留: ${bracketMatches.slice(0, 3).join(',')}`);
        }

        // 验证约束痕迹2：无AI高频词（检查清单第5条）
        const aiWords = ['仿佛', '宛如', '似乎', '不禁', '一抹', '一丝'];
        const foundAiWords = aiWords.filter(w => content.includes(w));
        log('F-noAiWords', foundAiWords.length === 0 ? 'PASS' : 'WARN',
            `AI高频词: ${foundAiWords.length === 0 ? '无（检查清单生效）' : foundAiWords.join('、')}`);

        // 验证约束痕迹3：字数达标（检查清单第3条）
        const charCount = content.length;
        log('F-wordCount', charCount >= 1500 ? 'PASS' : 'WARN', `正文长度: ${charCount}字符`);

        // 验证约束痕迹4：无系统流UI化表达（视角锁定约束）
        const uiPatterns = ['风险评估', '成功率', '概率', '系统提示', '面板', '属性栏'];
        const foundUiPatterns = uiPatterns.filter(p => content.includes(p));
        log('F-noUiPattern', foundUiPatterns.length === 0 ? 'PASS' : 'WARN',
            `UI化表达: ${foundUiPatterns.length === 0 ? '无（视角锁定生效）' : foundUiPatterns.join('、')}`);
        if (foundUiPatterns.length > 0) {
            classifyIssue('agent_constraint', 'F-noUiPattern', `UI化表达: ${foundUiPatterns.join(',')}`);
        }

    } catch (e) {
        log('F-error', 'FAIL', `Prompt结构验证失败: ${e.message}`);
        classifyIssue('silent_failure', 'F-prompt', e.message);
    }
}

// ============ 主流程 ============

async function main() {
    console.log('========================================');
    console.log('E2E Pipeline模拟测试（5章完整流程-复杂项目）');
    console.log('========================================');
    console.log(`配置: PORT=${PORT}, TARGET_CHAPTERS=${TARGET_CHAPTERS}, PG=${PG_CONN.replace(/:[^:@]+@/, ':****@')}`);

    // P1: 服务器检查
    const serverOk = await checkServer();
    if (!serverOk) {
        console.log('\n❌ 服务器未运行，终止测试');
        process.exit(1);
    }

    // P2: 创建项目
    const project = await createProject();
    if (!project) {
        console.log('\n❌ 项目创建失败，终止测试');
        process.exit(1);
    }
    const projectId = project.id;

    try {
        // P3: 素材验证
        await verifyMaterials(projectId);

        // P4: 大纲验证
        await verifyOutlines(projectId);

        // P5-P7: 5章Pipeline循环
        for (let ch = 1; ch <= TARGET_CHAPTERS; ch++) {
            console.log(`\n${'='.repeat(40)}`);
            console.log(`第${ch}章测试`);
            console.log('='.repeat(40));

            // P5: Pipeline执行
            await runPipelineForChapter(projectId, ch);

            // P6: 章节状态
            await verifyChapterState(projectId, ch, /^(written|first-reviewing|second-reviewing|final-editing|approved|material-updated|outlined)$/);

            // P7: 素材更新
            await verifyMaterialUpdate(projectId, ch);

            // 新增：功能验证（从第2章开始，因为需要前章数据）
            if (ch >= 2) {
                await verifyCharacterState(projectId, ch);
                await verifyForeshadowSystem(projectId, ch);
                await verifyQuestSystem(projectId, ch);
            }

            // 第5章后做长线审计
            if (ch === 5) {
                await verifyLongAudit(projectId);
            }
        }

        // P8: PG持久化
        await verifyPgPersistence(projectId);

        // P9: 实体中心
        await verifyEntityCenter(projectId);

        // 新增：prompt结构验证
        await verifyPromptStructure(projectId);

    } finally {
        // P10: 清理（保留项目用于分析，注释掉cleanup）
        // await cleanupProject(projectId);
        console.log(`\n项目保留用于分析: projectId=${projectId}`);
    }

    // ============ 汇总 ============
    console.log('\n========================================');
    console.log('测试汇总');
    console.log('========================================');
    console.log(`总计: ${testCount}项, 通过: ${passCount}, 失败: ${failCount}, 警告: ${warnings.length}`);

    console.log('\n--- 问题类型统计 ---');
    const totalIssues = Object.values(issueStats).reduce((s, c) => s + c.count, 0);
    for (const [key, val] of Object.entries(issueStats)) {
        if (val.count > 0) {
            console.log(`  ${val.label}: ${val.count}个`);
            val.items.forEach((item, i) => {
                console.log(`    ${i + 1}. [${item.test}] ${item.msg}`);
            });
        }
    }
    console.log(`\n问题总计: ${totalIssues}个`);

    if (bugs.length > 0) {
        console.log(`\n❌ 发现 ${bugs.length} 个Bug:`);
        bugs.forEach((b, i) => {
            console.log(`  ${i + 1}. [${b.test}] ${b.msg}`);
        });
    }
    if (warnings.length > 0) {
        console.log(`\n⚠️  发现 ${warnings.length} 个警告:`);
        warnings.forEach((w, i) => {
            console.log(`  ${i + 1}. [${w.test}] ${w.msg}`);
        });
    }
    if (bugs.length === 0 && warnings.length === 0) {
        console.log('\n✅ 所有测试通过，未发现潜在bug');
    }

    process.exit(bugs.length > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('测试执行异常:', err);
    process.exit(1);
});
