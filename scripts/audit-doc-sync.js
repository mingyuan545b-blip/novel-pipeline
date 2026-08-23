/**
 * audit-doc-sync.js — 文档同步审计脚本
 *
 * 扫描git diff，根据变更文件匹配MAINTENANCE.md同步矩阵，输出需更新的文档清单。
 *
 * 用法：
 *   node scripts/audit-doc-sync.js              # 扫描未提交变更
 *   node scripts/audit-doc-sync.js --last 3     # 扫描最近3次提交
 *   node scripts/audit-doc-sync.js --ci         # CI模式：有"需更新"未处理则exit 1
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── 同步规则：文件路径模式 → 需更新的文档 ──
const RULES = [
    {
        name: 'PG Schema变更',
        pattern: /server\/db\/pgSchemaEntity\.js|server\/db\/pgConstants\.js/,
        docs: [
            { file: 'docs/sop/05-数据库变更.md', reason: '新增表/字段/索引需更新4步操作流程' },
            { file: 'docs/reference/文件地图.md', reason: '第八章数据库Schema映射需同步' },
            { file: 'docs/sop/00-陷阱清单.md', reason: '如遇新坑需追加到数据库类' }
        ]
    },
    {
        name: 'PG写入handler变更',
        pattern: /server\/db\/store-pg-writer.*\.js/,
        docs: [
            { file: 'docs/sop/05-数据库变更.md', reason: 'handler创建流程变更需同步' },
            { file: 'docs/sop/00-陷阱清单.md', reason: '如遇读写表不一致类新坑需追加' }
        ]
    },
    {
        name: 'Pipeline Agent变更',
        pattern: /server\/services\/pipeline\/steps\/|server\/core\/pipeline\/orchestrator/,
        docs: [
            { file: 'docs/sop/07-Pipeline变更.md', reason: 'Agent步骤序列/契约变更需同步' },
            { file: 'docs/sop/00-陷阱清单.md', reason: '如遇契约/污染类新坑需追加' }
        ]
    },
    {
        name: 'Pipeline契约变更',
        pattern: /server\/services\/pipeline\/pipelineContract\.js|pipelineOutputContract\.js|pipelinePollutionGuard\.js|pipelineErrors\.js|dataFlowSpec\.js/,
        docs: [
            { file: 'docs/sop/07-Pipeline变更.md', reason: '契约/数据流/错误码变更需同步' },
            { file: 'docs/sop/00-陷阱清单.md', reason: '契约类陷阱#20-#22相关，如有新坑需追加' }
        ]
    },
    {
        name: '题材插件变更',
        pattern: /server\/services\/genres\/|server\/services\/genreConfig\.js|server\/config\/genreDefaults\.js|server\/config\/genreRegistry\.js/,
        docs: [
            { file: 'docs/sop/06-题材插件.md', reason: '题材Plugin开发流程变更需同步' },
            { file: 'docs/reference/题材插件规范.md', reason: '完整规范需同步' },
            { file: 'docs/sop/00-陷阱清单.md', reason: '题材检测类陷阱#23-#25相关' }
        ]
    },
    {
        name: '配置层变更',
        pattern: /server\/config\/systemConfig\.js|server\/config\/configManifest\.js/,
        docs: [
            { file: 'docs/reference/项目身份与硬约束.md', reason: '硬约束/配置规范变更需同步' },
            { file: 'docs/sop/03-新功能开发.md', reason: '配置统一管理章节需同步' }
        ]
    },
    {
        name: '前端EntityCenter变更',
        pattern: /client\/src\/pages\/entitycenter\/|client\/src\/pages\/EntityCenterPage\.jsx/,
        docs: [
            { file: 'docs/sop/03-新功能开发.md', reason: '新增Tab/组件需更新验收清单' },
            { file: 'docs/reference/文件地图.md', reason: '前端文件结构变更需同步' }
        ]
    },
    {
        name: '前端API方法变更',
        pattern: /client\/src\/services\/api\/pipelineApi\.js/,
        docs: [
            { file: 'docs/sop/03-新功能开发.md', reason: 'API方法新增需更新验收清单' }
        ]
    },
    {
        name: '路由层变更',
        pattern: /server\/routes\/pipeline\/|server\/routes\/.*Routes\.js/,
        docs: [
            { file: 'docs/sop/03-新功能开发.md', reason: '新增API端点需更新验收清单' },
            { file: 'docs/sop/07-Pipeline变更.md', reason: '如涉及Pipeline路由需同步' }
        ]
    },
    {
        name: 'store层变更',
        pattern: /server\/store\.js|server\/db\/store-pg\.js/,
        docs: [
            { file: 'docs/sop/05-数据库变更.md', reason: 'VALIDATED_TYPES/存储层变更需同步' },
            { file: 'docs/sop/00-陷阱清单.md', reason: '存储相关新坑需追加' }
        ]
    },
    {
        name: '陷阱清单自身变更',
        pattern: /docs\/sop\/00-陷阱清单\.md/,
        docs: [
            { file: 'docs/MAINTENANCE.md', reason: '陷阱清单变更后检查同步矩阵是否需更新' }
        ]
    }
];

// ── 解析命令行参数 ──
const args = process.argv.slice(2);
let lastN = 0;
let ciMode = false;
for (const arg of args) {
    if (arg === '--ci') ciMode = true;
    else if (arg.startsWith('--last ')) lastN = parseInt(arg.split(' ')[1], 10) || 0;
    else if (arg === '--last') lastN = parseInt(args[args.indexOf(arg) + 1], 10) || 0;
}

// ── 获取变更文件列表 ──
function getChangedFiles() {
    try {
        let cmd;
        if (lastN > 0) {
            cmd = `git -C "${ROOT}" log --name-only --pretty=format: -${lastN}`;
        } else {
            cmd = `git -C "${ROOT}" diff --name-only HEAD`;
        }
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        return output.split('\n').map(f => f.trim()).filter(Boolean);
    } catch (e) {
        console.error('⚠️  无法获取git diff（可能不是git仓库或无变更）:', e.message);
        return [];
    }
}

// ── 主逻辑 ──
const changedFiles = getChangedFiles();
if (changedFiles.length === 0) {
    console.log('✅ 无文件变更，文档同步检查通过');
    process.exit(0);
}

console.log(`📋 扫描 ${changedFiles.length} 个变更文件，匹配同步矩阵...\n`);

const triggeredRules = new Map(); // docFile → [{ rule, reason, changedFile }]

for (const file of changedFiles) {
    for (const rule of RULES) {
        if (rule.pattern.test(file)) {
            for (const doc of rule.docs) {
                if (!triggeredRules.has(doc.file)) {
                    triggeredRules.set(doc.file, []);
                }
                triggeredRules.get(doc.file).push({
                    rule: rule.name,
                    reason: doc.reason,
                    changedFile: file
                });
            }
        }
    }
}

if (triggeredRules.size === 0) {
    console.log('✅ 本次变更未触发任何文档同步规则');
    process.exit(0);
}

console.log('⚠️  以下文档需检查更新：\n');
let pendingCount = 0;
for (const [docFile, triggers] of triggeredRules) {
    console.log(`[需更新] ${docFile}`);
    const reasons = new Set();
    const changedSet = new Set();
    for (const t of triggers) {
        reasons.add(`  原因: ${t.reason}`);
        changedSet.add(t.changedFile);
    }
    for (const r of reasons) console.log(r);
    console.log(`  变更文件: ${[...changedSet].join(', ')}`);
    console.log(`  验证: 检查 ${docFile} 内容是否已同步\n`);
    pendingCount++;
}

console.log(`📊 共 ${pendingCount} 个文档需检查更新`);
console.log(`📖 详见 docs/MAINTENANCE.md 同步矩阵`);

if (ciMode && pendingCount > 0) {
    console.log('\n❌ CI模式：存在未处理的文档同步项');
    process.exit(1);
}
