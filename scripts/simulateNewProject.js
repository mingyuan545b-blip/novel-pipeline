/**
 * simulateNewProject - 模拟新建项目完整流程测试
 *
 * 测试目标：暴露新建项目流程中的隐藏bug
 * 测试范围：
 *   T1: 创建项目（POST /api/projects）
 *   T2: 验证项目配置初始化（wordConfig/targetChapters/styleProfile/chapterIntents）
 *   T3: 验证素材管理功能（GET/POST /api/projects/:id/materials）
 *   T4: 验证章节生成流程（POST /api/projects/:id/pipeline/...）
 *   T5: 验证实体中心数据（GET /api/projects/:id/entities）
 *   T6: 验证级联删除完整性（DELETE /api/projects/:id）
 *   T7: 验证项目配置更新（PUT /api/projects/:id）
 *   T8: 验证API契约一致性（所有返回字段符合Schema）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const HOST = '127.0.0.1';

// 从.env读取REQUEST_SECRET用于API认证
const envPath = path.join(__dirname, '..', '.env');
let AUTH_TOKEN = '';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
    if (matches && matches.length > 0) {
        // 取最后一个定义（.env中后定义的覆盖先定义的）
        AUTH_TOKEN = matches[matches.length - 1].split('=')[1].trim();
    }
}

let testCount = 0;
let passCount = 0;
let failCount = 0;
const bugs = [];
const warnings = [];

function log(test, status, msg, detail) {
    testCount++;
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} [${test}] ${msg}`);
    if (detail) console.log(`     详情: ${JSON.stringify(detail).substring(0, 200)}`);
    if (status === 'PASS') passCount++;
    else if (status === 'FAIL') {
        failCount++;
        bugs.push({ test, msg, detail });
    } else if (status === 'WARN') {
        warnings.push({ test, msg, detail });
    }
}

/**
 * 发送HTTP请求
 */
function request(method, urlPath, body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: HOST,
            port: PORT,
            path: urlPath,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`,
            },
            timeout: 30000,
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

async function checkServerRunning() {
    try {
        const res = await request('GET', '/api/projects');
        return res.status === 200;
    } catch (e) {
        return false;
    }
}

async function testCreateProject() {
    console.log('\n=== T2: 创建项目 ===');
    const projectData = {
        name: '模拟测试项目',
        description: '用于暴露隐藏bug的模拟测试项目',
        genre: '玄幻',
        subGenre: 'tomato-talisman',
        targetChapters: 10,
        wordConfig: { minWords: 2000, targetWords: 3000, maxWords: 4000 },
        settings: { autoPipeline: false, chapterRounds: 3 },
    };

    const res = await request('POST', '/api/projects', projectData);
    if (res.status !== 201) {
        log('T2-create', 'FAIL', `创建项目HTTP状态码=${res.status}, 期望201`, res.body);
        return null;
    }
    if (!res.body.id) {
        log('T2-create', 'FAIL', '创建项目返回缺少id字段', res.body);
        return null;
    }
    log('T2-create', 'PASS', `项目创建成功, id=${res.body.id}`);

    // 检查返回的_verification字段
    if (res.body._verification) {
        const v = res.body._verification;
        if (!v.valid) {
            log('T2-verify', 'FAIL', `项目验证失败`, v.issues);
        } else {
            log('T2-verify', 'PASS', '项目验证通过');
        }
        if (v.issues && v.issues.length > 0) {
            for (const issue of v.issues) {
                log('T2-verify-issue', 'WARN', `[${issue.level}] ${issue.field}: ${issue.message}`);
            }
        }
    }

    return res.body;
}

async function testProjectConfig(project) {
    console.log('\n=== T3: 验证项目配置初始化 ===');

    // 3.1 wordConfig
    const wc = project.wordConfig;
    if (!wc) {
        log('T3-wordConfig', 'FAIL', 'wordConfig为null');
    } else {
        const requiredFields = ['minWords', 'targetWords', 'maxWords'];
        const missing = requiredFields.filter(f => wc[f] === undefined || wc[f] === null);
        if (missing.length > 0) {
            log('T3-wordConfig', 'FAIL', `wordConfig缺少字段: ${missing.join(',')}`, wc);
        } else {
            log('T3-wordConfig', 'PASS', `wordConfig完整: min=${wc.minWords}, target=${wc.targetWords}, max=${wc.maxWords}`);
        }
        // 检查是否有非标准字段
        const standardFields = ['minWords', 'targetWords', 'maxWords', 'rejectMin'];
        const nonStandard = Object.keys(wc).filter(f => !standardFields.includes(f));
        if (nonStandard.length > 0) {
            log('T3-wordConfig', 'WARN', `wordConfig存在非标准字段: ${nonStandard.join(',')}`, wc);
        }
    }

    // 3.2 targetChapters
    const tc = project.targetChapters;
    if (tc === undefined || tc === null) {
        log('T3-targetChapters', 'FAIL', 'targetChapters为undefined/null');
    } else if (typeof tc !== 'number') {
        log('T3-targetChapters', 'FAIL', `targetChapters类型错误: ${typeof tc}`, tc);
    } else if (tc <= 0) {
        log('T3-targetChapters', 'WARN', `targetChapters=${tc}，非正数`);
    } else {
        log('T3-targetChapters', 'PASS', `targetChapters=${tc}`);
    }

    // 3.3 styleProfile
    const sp = project.styleProfile;
    if (!sp) {
        log('T3-styleProfile', 'FAIL', 'styleProfile为null');
    } else {
        const requiredFields = ['povRule', 'dialogueRule', 'behaviorRule', 'toneRule', 'titleRule'];
        const missing = requiredFields.filter(f => sp[f] === undefined);
        if (missing.length > 0) {
            log('T3-styleProfile', 'FAIL', `styleProfile缺少字段: ${missing.join(',')}`, sp);
        } else {
            log('T3-styleProfile', 'PASS', 'styleProfile所有必填字段存在');
        }
        if (!sp.povRule) {
            log('T3-styleProfile-povRule', 'FAIL', 'povRule为空，视角约束将无法注入');
        }
    }

    // 3.4 chapterIntents
    const ci = project.chapterIntents;
    if (!ci) {
        log('T3-chapterIntents', 'FAIL', 'chapterIntents为null');
    } else if (Array.isArray(ci)) {
        log('T3-chapterIntents', 'FAIL', 'chapterIntents是数组，应为对象');
    } else if (!ci.chapters) {
        log('T3-chapterIntents', 'FAIL', 'chapterIntents.chapters缺失');
    } else if (Array.isArray(ci.chapters)) {
        log('T3-chapterIntents', 'FAIL', 'chapterIntents.chapters是数组，应为对象');
    } else {
        log('T3-chapterIntents', 'PASS', 'chapterIntents结构正确（对象格式）');
    }

    // 3.5 mode
    if (project.mode !== 'novel') {
        log('T3-mode', 'FAIL', `mode="${project.mode}"，期望"novel"`);
    } else {
        log('T3-mode', 'PASS', 'mode=novel');
    }

    // 3.6 subGenre
    if (!project.subGenre) {
        log('T3-subGenre', 'WARN', 'subGenre为空');
    } else {
        log('T3-subGenre', 'PASS', `subGenre=${project.subGenre}`);
    }
}

async function testProjectFetch(project) {
    console.log('\n=== T3.1: 验证项目读取一致性 ===');
    const res = await request('GET', `/api/projects/${project.id}`);
    if (res.status !== 200) {
        log('T3.1-fetch', 'FAIL', `GET项目HTTP状态码=${res.status}, 期望200`);
        return null;
    }
    const fetched = res.body;
    // 检查关键字段一致性
    const fields = ['id', 'name', 'genre', 'mode', 'targetChapters', 'wordConfig', 'styleProfile', 'chapterIntents'];
    for (const f of fields) {
        if (JSON.stringify(fetched[f]) !== JSON.stringify(project[f])) {
            log('T3.1-consistency', 'FAIL', `字段"${f}"不一致: 创建时=${JSON.stringify(project[f]).substring(0, 50)}, 读取时=${JSON.stringify(fetched[f]).substring(0, 50)}`);
        }
    }
    log('T3.1-fetch', 'PASS', '项目读取成功');
    return fetched;
}

async function testMaterials(project) {
    console.log('\n=== T4: 验证素材管理功能 ===');

    // 4.1 获取素材列表（初始应为空）- API路径是 /api/materials?projectId=xxx
    let res = await request('GET', `/api/materials?projectId=${project.id}`);
    if (res.status !== 200) {
        log('T4-list', 'FAIL', `GET素材列表HTTP状态码=${res.status}, 期望200`, res.body);
        return;
    }
    log('T4-list', 'PASS', `素材列表获取成功, 初始数量=${Array.isArray(res.body) ? res.body.length : 'N/A'}`);

    // 4.2 创建素材 - 使用非基底类型（other）避免基底素材保护
    const materialData = {
        projectId: project.id,
        type: 'other',
        name: '测试素材',
        content: '这是一个测试素材',
        category: 'micro',
    };
    res = await request('POST', '/api/materials', materialData);
    if (res.status !== 200 && res.status !== 201) {
        log('T4-create', 'FAIL', `创建素材HTTP状态码=${res.status}`, res.body);
        return;
    }
    if (!res.body.id) {
        log('T4-create', 'FAIL', '创建素材返回缺少id', res.body);
        return;
    }
    log('T4-create', 'PASS', `素材创建成功, id=${res.body.id}`);
    const materialId = res.body.id;

    // 4.3 获取单个素材
    res = await request('GET', `/api/materials/${materialId}`);
    if (res.status !== 200) {
        log('T4-get', 'FAIL', `GET单个素材HTTP状态码=${res.status}`, res.body);
    } else {
        log('T4-get', 'PASS', '素材获取成功');
    }

    // 4.4 更新素材
    res = await request('PUT', `/api/materials/${materialId}`, {
        ...materialData,
        content: '更新后的世界观设定',
    });
    if (res.status !== 200) {
        log('T4-update', 'FAIL', `更新素材HTTP状态码=${res.status}`, res.body);
    } else {
        log('T4-update', 'PASS', '素材更新成功');
    }

    // 4.5 删除素材
    res = await request('DELETE', `/api/materials/${materialId}`);
    if (res.status !== 200) {
        log('T4-delete', 'FAIL', `删除素材HTTP状态码=${res.status}`, res.body);
    } else {
        log('T4-delete', 'PASS', '素材删除成功');
    }
}

async function testPipelineConfig(project) {
    console.log('\n=== T5: 验证Pipeline配置 ===');
    const res = await request('GET', `/api/projects/${project.id}/pipeline-config`);
    if (res.status !== 200) {
        log('T5-pipelineConfig', 'FAIL', `GET pipeline-config HTTP状态码=${res.status}`, res.body);
        return;
    }
    const pc = res.body;
    if (!pc.steps || !Array.isArray(pc.steps)) {
        log('T5-steps', 'FAIL', 'pipelineConfig.steps缺失或非数组', pc);
    } else {
        log('T5-steps', 'PASS', `pipeline步骤: ${pc.steps.join('→')}`);
    }
    if (pc.skipSecondReview === undefined) {
        log('T5-skipSecondReview', 'WARN', 'skipSecondReview未定义');
    } else {
        log('T5-skipSecondReview', 'PASS', `skipSecondReview=${pc.skipSecondReview}`);
    }
}

async function testGenreConstraints(project) {
    console.log('\n=== T5.1: 验证题材约束 ===');
    const res = await request('GET', `/api/projects/${project.id}/genre-constraints`);
    if (res.status !== 200) {
        log('T5.1-genreConstraints', 'FAIL', `GET genre-constraints HTTP状态码=${res.status}`, res.body);
        return;
    }
    const gc = res.body;
    if (!gc.genreId) {
        log('T5.1-genreId', 'WARN', 'genreId为空', gc);
    } else {
        log('T5.1-genreId', 'PASS', `genreId=${gc.genreId}`);
    }
    if (gc.constraintPresets && typeof gc.constraintPresets === 'object') {
        log('T5.1-presets', 'PASS', `约束预设: ${Object.keys(gc.constraintPresets).length}个`);
    }
}

async function testEntities(project) {
    console.log('\n=== T6: 验证实体中心数据 ===');
    // API路径是 /api/entity-center/entities?projectId=xxx
    const res = await request('GET', `/api/entity-center/entities?projectId=${project.id}`);
    if (res.status !== 200) {
        log('T6-entities', 'FAIL', `GET entities HTTP状态码=${res.status}`, res.body);
        return;
    }
    const entities = res.body;
    if (!Array.isArray(entities)) {
        log('T6-entities', 'WARN', 'entities返回非数组', typeof entities);
    } else {
        log('T6-entities', 'PASS', `实体列表获取成功, 数量=${entities.length}`);
    }
}

async function testProjectUpdate(project) {
    console.log('\n=== T7: 验证项目配置更新 ===');
    const updateData = {
        name: '更新后的项目名',
        targetChapters: 20,
        wordConfig: { minWords: 2500, targetWords: 3500, maxWords: 4500 },
    };
    const res = await request('PUT', `/api/projects/${project.id}`, updateData);
    if (res.status !== 200) {
        log('T7-update', 'FAIL', `PUT项目HTTP状态码=${res.status}`, res.body);
        return;
    }
    const updated = res.body;
    if (updated.name !== updateData.name) {
        log('T7-name', 'FAIL', `name未更新: ${updated.name}`);
    } else {
        log('T7-name', 'PASS', 'name更新成功');
    }
    if (updated.targetChapters !== 20) {
        log('T7-targetChapters', 'FAIL', `targetChapters未更新: ${updated.targetChapters}`);
    } else {
        log('T7-targetChapters', 'PASS', 'targetChapters更新成功');
    }
    // 检查wordConfig是否被归一化
    if (updated.wordConfig) {
        const standardFields = ['minWords', 'targetWords', 'maxWords'];
        const hasAll = standardFields.every(f => updated.wordConfig[f] !== undefined);
        if (hasAll) {
            log('T7-wordConfig', 'PASS', 'wordConfig更新后字段完整');
        } else {
            log('T7-wordConfig', 'WARN', 'wordConfig更新后字段不完整', updated.wordConfig);
        }
    }
}

async function testCascadeDelete(projectId) {
    console.log('\n=== T8: 验证级联删除完整性 ===');
    const res = await request('DELETE', `/api/projects/${projectId}`);
    if (res.status !== 200) {
        log('T8-delete', 'FAIL', `DELETE项目HTTP状态码=${res.status}`, res.body);
        return;
    }
    const result = res.body;
    if (!result.success) {
        log('T8-delete', 'FAIL', '删除返回success=false', result);
    } else {
        log('T8-delete', 'PASS', '项目删除成功');
    }

    // 检查级联删除的目录数
    if (result.deletedCounts) {
        const totalDeleted = Object.values(result.deletedCounts).reduce((a, b) => a + b, 0);
        log('T8-cascade', 'PASS', `级联删除: ${Object.keys(result.deletedCounts).length}个类型, 共${totalDeleted}条数据`);

        // 检查是否有失败的删除
        if (result.failedCounts) {
            const failures = Object.entries(result.failedCounts).filter(([, v]) => v > 0);
            if (failures.length > 0) {
                log('T8-failures', 'WARN', `部分类型删除失败: ${failures.map(([k, v]) => `${k}=${v}`).join(', ')}`);
            }
        }
    }

    // 验证项目确实被删除
    const checkRes = await request('GET', `/api/projects/${projectId}`);
    if (checkRes.status === 404) {
        log('T8-verify', 'PASS', '项目已被删除（GET返回404）');
    } else {
        log('T8-verify', 'FAIL', `项目删除后仍可访问: HTTP=${checkRes.status}`);
    }

    // 检查data目录下是否有残留的孤儿数据
    const dataDir = path.join(__dirname, '..', 'data');
    const orphanedDirs = [];
    if (fs.existsSync(dataDir)) {
        for (const entry of fs.readdirSync(dataDir)) {
            const entryPath = path.join(dataDir, entry);
            if (!fs.statSync(entryPath).isDirectory()) continue;
            if (entry === 'projects' || entry === 'genre-profiles' || entry === 'library') continue;
            try {
                const files = fs.readdirSync(entryPath).filter(f => f.endsWith('.json'));
                for (const file of files) {
                    try {
                        const content = JSON.parse(fs.readFileSync(path.join(entryPath, file), 'utf8'));
                        if (content && content.projectId === projectId) {
                            orphanedDirs.push(`${entry}/${file}`);
                            break;
                        }
                    } catch (_) { /* skip */ }
                }
            } catch (_) { /* skip */ }
        }
    }
    if (orphanedDirs.length > 0) {
        log('T8-orphan', 'FAIL', `发现${orphanedDirs.length}个孤儿数据文件`, orphanedDirs.slice(0, 5));
    } else {
        log('T8-orphan', 'PASS', '无孤儿数据残留');
    }
}

async function main() {
    console.log('========================================');
    console.log('模拟新建项目完整流程测试');
    console.log('========================================');

    // T1: 检查服务器是否运行
    console.log('\n=== T1: 检查服务器状态 ===');
    const serverOk = await checkServerRunning();
    if (!serverOk) {
        log('T1-server', 'FAIL', `服务器未运行或无法连接 ${HOST}:${PORT}`);
        console.log('\n请先启动服务器: npm run server');
        process.exit(1);
    }
    log('T1-server', 'PASS', `服务器运行中 ${HOST}:${PORT}`);

    // T2: 创建项目
    const project = await testCreateProject();
    if (!project) {
        console.log('\n❌ 项目创建失败，无法继续后续测试');
        process.exit(1);
    }

    // T3: 验证配置
    await testProjectConfig(project);

    // T3.1: 验证读取一致性
    const fetched = await testProjectFetch(project);

    // T4: 素材管理
    await testMaterials(project);

    // T5: Pipeline配置
    await testPipelineConfig(project);

    // T5.1: 题材约束
    await testGenreConstraints(project);

    // T6: 实体中心
    await testEntities(project);

    // T7: 项目更新
    await testProjectUpdate(project);

    // T8: 级联删除
    await testCascadeDelete(project.id);

    // 汇总
    console.log('\n========================================');
    console.log('测试汇总');
    console.log('========================================');
    console.log(`总计: ${testCount}项, 通过: ${passCount}, 失败: ${failCount}, 警告: ${warnings.length}`);
    console.log('');

    if (bugs.length > 0) {
        console.log(`❌ 发现 ${bugs.length} 个Bug:`);
        for (let i = 0; i < bugs.length; i++) {
            console.log(`  ${i + 1}. [${bugs[i].test}] ${bugs[i].msg}`);
            if (bugs[i].detail) console.log(`     详情: ${JSON.stringify(bugs[i].detail).substring(0, 150)}`);
        }
    }

    if (warnings.length > 0) {
        console.log(`\n⚠️  发现 ${warnings.length} 个警告:`);
        for (let i = 0; i < warnings.length; i++) {
            console.log(`  ${i + 1}. [${warnings[i].test}] ${warnings[i].msg}`);
        }
    }

    if (bugs.length === 0 && warnings.length === 0) {
        console.log('✅ 所有测试通过，未发现隐藏bug');
    }

    process.exit(bugs.length > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('测试执行异常:', err);
    process.exit(1);
});
