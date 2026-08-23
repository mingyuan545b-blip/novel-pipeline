/**
 * verifyAgentConstraints.js — 验证agent约束组装问题
 * 创建项目→组装writer/first-review的prompt→检查约束是否丢失
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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

function request(method, urlPath, body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: HOST, port: PORT, path: urlPath, method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
            timeout: 30000,
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', (chunk) => chunks += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(chunks), raw: chunks }); }
                catch (e) { resolve({ status: res.statusCode, body: null, raw: chunks }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (data) req.write(data);
        req.end();
    });
}

async function main() {
    console.log('========================================');
    console.log('Agent约束组装验证');
    console.log('========================================');

    // 1. 创建项目
    console.log('\n=== 1. 创建项目 ===');
    const createRes = await request('POST', '/api/projects', {
        name: 'Agent约束测试',
        genre: '玄幻',
        subGenre: 'tomato-talisman',
        targetChapters: 10,
        wordConfig: { minWords: 2000, targetWords: 3000, maxWords: 4000 },
    });
    if (createRes.status !== 201) {
        console.log('❌ 创建失败:', createRes.status, createRes.body);
        process.exit(1);
    }
    const project = createRes.body;
    console.log(`✅ 项目创建成功: id=${project.id}`);

    // 2. 直接调用assembleAgentPrompt验证约束组装
    console.log('\n=== 2. 验证agent约束组装 ===');
    const serverRoot = path.join(__dirname, '..', 'server');
    const { assembleAgentPrompt } = require(path.join(serverRoot, 'services/prompts/agentPromptAssembler'));
    const { SLOT_DEFINITIONS, resolveModulesSlot } = require(path.join(serverRoot, 'services/prompts/agentSlotRegistry'));
    const { CONSTRAINT_MODULES } = require(path.join(serverRoot, 'services/prompts/constraintModuleDefs'));

    // 2.1 检查CONSTRAINT_MODULES定义的ID
    console.log('\n--- 2.1 CONSTRAINT_MODULES定义的ID ---');
    const definedIds = Object.keys(CONSTRAINT_MODULES);
    console.log(`   定义: ${definedIds.join(', ')}`);

    // 2.2 检查SLOT_DEFINITIONS引用的moduleIds
    console.log('\n--- 2.2 SLOT_DEFINITIONS引用的moduleIds ---');
    const referencedIds = new Set();
    for (const [slotId, slotDef] of Object.entries(SLOT_DEFINITIONS)) {
        if (slotDef.moduleIds) {
            for (const id of slotDef.moduleIds) {
                referencedIds.add(id);
                const exists = CONSTRAINT_MODULES[id] !== undefined;
                console.log(`   ${slotId} → ${id}: ${exists ? '✅存在' : '❌缺失'}`);
            }
        }
    }

    const missing = [...referencedIds].filter(id => !CONSTRAINT_MODULES[id]);
    if (missing.length > 0) {
        console.log(`\n   ❌ 缺失的moduleIds: ${missing.join(', ')}`);
        console.log('   影响: role-boundary/redlines-writer/quality-check/craft-rules等slot返回null');
    }

    // 2.3 实际组装writer的prompt
    console.log('\n--- 2.3 组装writer prompt ---');
    try {
        const result = await assembleAgentPrompt('writer', 'novel', project.id, { chapterNumber: 1 });
        console.log(`   ✅ 组装成功, 总字符数: ${result.system.length}`);
        console.log(`   加载的slots: ${result.buildLog.map(s => s.slot).join(', ')}`);

        // 检查关键约束是否存在
        const system = result.system;
        const checks = [
            { name: '角色边界', keyword: '角色边界' },
            { name: '写作红线', keyword: '红线' },
            { name: '质量自检', keyword: '质量自检' },
            { name: '写作技法', keyword: '展示代替告知' },
            { name: '约束词', keyword: '写作约束' },
            { name: '风格配置', keyword: 'povRule' },
            { name: '题材铁律', keyword: '题材' },
        ];
        for (const c of checks) {
            const found = system.includes(c.keyword);
            console.log(`   ${found ? '✅' : '❌'} ${c.name}: ${found ? '存在' : '缺失'}`);
        }
    } catch (err) {
        console.log(`   ❌ 组装失败: ${err.message}`);
        if (err.code === 'PROMPT_INCOMPLETE') {
            console.log(`   缺失slots: ${err.missingSlots.map(s => s.slotId).join(', ')}`);
        }
    }

    // 2.4 组装first-review的prompt
    console.log('\n--- 2.4 组装first-review prompt ---');
    try {
        const result = await assembleAgentPrompt('first-review', 'novel', project.id, { chapterNumber: 1 });
        console.log(`   ✅ 组装成功, 总字符数: ${result.system.length}`);
        console.log(`   加载的slots: ${result.buildLog.map(s => s.slot).join(', ')}`);
    } catch (err) {
        console.log(`   ❌ 组装失败: ${err.message}`);
    }

    // 3. 清理
    console.log('\n=== 3. 清理 ===');
    const delRes = await request('DELETE', `/api/projects/${project.id}`);
    if (delRes.status === 200) {
        console.log('✅ 项目已删除');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('执行异常:', err);
    process.exit(1);
});
