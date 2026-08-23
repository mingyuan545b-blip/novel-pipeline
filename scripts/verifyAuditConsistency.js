/**
 * verifyAuditConsistency.js — 总工程师大审查一致性校验
 * 把D1-D6六大审查方向沉淀为可重复执行的CI检查
 * 防止"设定规则"与"实际执行"之间的脱节再次悄然发生
 *
 * 六大审查方向：
 * D1: PROJECT_STANDARDS原则数 vs verifyProjectStandards校验规则数
 * D2: R1白名单文件 vs 实际存在的文件（防止引用不存在的文件）
 * D3: R1违规模式覆盖度（含deps.store防绕过检测）
 * D4: Agent声明数 vs 实际实现文件数
 * D5: 测试文件覆盖健康度（核心模块是否有对应测试）
 * D6: R5检查点路径 vs 实际文件存在性+关键词存在性
 *
 * 用法：node scripts/verifyAuditConsistency.js
 * 退出码：0=通过，1=有脱节
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { R1_WHITELIST, R1_VIOLATION_PATTERNS, R5_REQUIRED_CHECKPOINTS } = require('./projectStandardsRules');

const ROOT = path.resolve(__dirname, '..');

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`[WARN]  ${msg}`); warnCount++; }
function ok(msg) { console.log(`[OK]    ${msg}`); }

function readFileContent(absPath) {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, 'utf8');
}

/** D1: PROJECT_STANDARDS原则数 vs verifyProjectStandards校验规则数
 *  确保每条可机器化的原则都有对应的校验规则
 */
function checkD1StandardsVsVerification() {
    console.log('\n=== D1: PROJECT_STANDARDS原则 vs 校验规则覆盖 ===');
    const standardsPath = path.join(ROOT, 'PROJECT_STANDARDS.md');
    const content = readFileContent(standardsPath);
    if (!content) {
        error('D1失败 — PROJECT_STANDARDS.md不存在');
        return 1;
    }

    // 核心可机器化原则（必须有对应校验）
    // 匹配格式：PROJECT_STANDARDS.md中用"### 1. 禁止硬编码业务规则"格式
    const MACHINE_CHECKABLE_PRINCIPLES = [
        { id: '### 1. 禁止硬编码业务规则', desc: '禁止硬编码业务规则', verifyRule: 'R3', verifyFile: 'scripts/verifyProjectStandards.js' },
        { id: '### 8. 两套系统必须对齐', desc: '两套系统必须对齐', verifyRule: 'R2', verifyFile: 'scripts/verifyProjectStandards.js' },
        { id: '### 9. DataContext统一数据入口', desc: 'DataContext统一数据入口', verifyRule: 'R1', verifyFile: 'scripts/verifyProjectStandards.js' },
        { id: '字数检查必须覆盖所有输出点', desc: '字数检查覆盖所有输出点', verifyRule: 'R5', verifyFile: 'scripts/verifyProjectStandards.js' },
    ];

    let violations = 0;
    for (const principle of MACHINE_CHECKABLE_PRINCIPLES) {
        // 检查原则在文档中存在
        if (!content.includes(principle.id)) {
            error(`D1违规 — ${principle.id}(${principle.desc})在PROJECT_STANDARDS.md中不存在`);
            violations++;
            continue;
        }
        // 检查对应校验规则在脚本中存在
        const verifyContent = readFileContent(path.join(ROOT, principle.verifyFile));
        if (!verifyContent || !verifyContent.includes(principle.verifyRule)) {
            error(`D1违规 — ${principle.id}(${principle.desc})对应的${principle.verifyRule}校验在${principle.verifyFile}中不存在`);
            violations++;
        }
    }
    if (violations === 0) ok(`D1通过 — ${MACHINE_CHECKABLE_PRINCIPLES.length}条可机器化原则全部有对应校验`);
    return violations;
}

/** D2: R1白名单文件 vs 实际存在的文件
 *  防止白名单引用不存在的文件（导致校验形同虚设）
 */
function checkD2WhitelistVsActualFiles() {
    console.log('\n=== D2: R1白名单文件 vs 实际文件存在性 ===');
    const scanDirs = [
        'server/services/pipeline',
        'server/services/pipeline/steps',
        'server/services/pipeline/steps/writer',
        'server/services/pipeline/steps/review',
        'server/services/pipeline/infinite',
        'server/services/pipeline/pipelineHelpers',
    ];
    // 收集所有实际存在的js文件名
    const actualFiles = new Set();
    for (const dir of scanDirs) {
        const absDir = path.join(ROOT, dir);
        if (!fs.existsSync(absDir)) continue;
        const entries = fs.readdirSync(absDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
                actualFiles.add(entry.name);
            }
        }
    }
    // 检查白名单中的每个文件是否实际存在
    let violations = 0;
    for (const whitelistFile of R1_WHITELIST) {
        if (!actualFiles.has(whitelistFile)) {
            warn(`D2警告 — 白名单文件${whitelistFile}在扫描目录中不存在（可能是子目录文件或已删除）`);
        }
    }
    // 白名单文件数 vs 实际文件数对比（信息性，不阻断）
    console.log(`  白名单文件数: ${R1_WHITELIST.size}, 扫描目录实际文件数: ${actualFiles.size}`);
    ok('D2通过 — 白名单文件存在性检查完成（警告不阻断）');
    return violations;
}

/** D3: R1违规模式覆盖度
 *  确保R1违规模式包含deps.store防绕过检测
 */
function checkD3R1PatternCoverage() {
    console.log('\n=== D3: R1违规模式覆盖度（含deps.store防绕过） ===');
    let violations = 0;

    // 必须覆盖的违规模式（检查source字符串包含关键词，注意反斜杠转义）
    const REQUIRED_PATTERNS = [
        { desc: 'store.getItem直接调用', keyword: 'store.getItem' },
        { desc: 'store.queryItems直接调用', keyword: 'store.queryItems' },
        { desc: 'store.listItems直接调用', keyword: 'store.listItems' },
        { desc: 'deps.store防绕过', keyword: 'deps.store' },
    ];

    for (const required of REQUIRED_PATTERNS) {
        // 正则source中"store.getItem"会被表示为"store\.getItem"（含转义反斜杠）
        // 同时检查带转义和不带转义两种形式
        const found = R1_VIOLATION_PATTERNS.some(p =>
            p.source.includes(required.keyword) || p.source.includes(required.keyword.replace('.', '\\.'))
        );
        if (!found) {
            error(`D3违规 — R1违规模式缺少"${required.desc}"检测`);
            violations++;
        }
    }
    if (violations === 0) ok(`D3通过 — R1违规模式覆盖${REQUIRED_PATTERNS.length}种调用模式（含防绕过）`);
    return violations;
}

/** D4: Agent声明 vs 实际实现文件 + 声明结构完整性
 *  确保每个声明的Agent都有对应的实现文件，且声明结构完整
 */
function checkD4AgentDeclarationsVsImpl() {
    console.log('\n=== D4: Agent声明 vs 实际实现文件 + 声明结构完整性 ===');
    const agentDeclarationsPath = path.join(ROOT, 'server/services/pipeline/agentDeclarations.js');
    const supplementPath = path.join(ROOT, 'server/services/pipeline/agentDeclarationsSupplement.js');

    const mainContent = readFileContent(agentDeclarationsPath);
    const suppContent = readFileContent(supplementPath);
    if (!mainContent || !suppContent) {
        error('D4失败 — agentDeclarations.js或agentDeclarationsSupplement.js不存在');
        return 1;
    }

    // 加载实际声明模块进行结构校验
    const { AGENT_DECLARATIONS } = require(agentDeclarationsPath);
    const declaredAgents = Object.keys(AGENT_DECLARATIONS);

    // Agent实现文件映射（声明ID → 实现文件路径）
    const AGENT_IMPL_MAP = {
        'writer': 'server/services/pipeline/steps/writer/writerMaterialBuilder.js',
        'first-review': 'server/services/pipeline/steps/review/firstReview.js',
        'second-review': 'server/services/pipeline/steps/review/secondReview.js',
        'fast-review': 'server/services/pipeline/steps/review/fastReview.js',
        'reviser': 'server/services/pipeline/steps/reviserPrompt.js',
        'polisher': 'server/services/pipeline/steps/polisher.js',
        'final-editor': 'server/services/pipeline/steps/finalEditor.js',
        'reader': 'server/services/pipeline/steps/reader.js',
        'intent-planner': 'server/services/chapterIntent.js',
        'material-manager': 'server/services/pipeline/steps/materialManager.js',
    };

    // material-manager是素材管理Agent，不生成内容，不需要差异配置
    const AGENTS_WITHOUT_DIFF_CONFIG = new Set(['material-manager']);

    let violations = 0;

    // 检查1：实现文件存在性
    for (const agentId of declaredAgents) {
        const implPath = AGENT_IMPL_MAP[agentId];
        if (!implPath) {
            warn(`D4警告 — Agent "${agentId}"无实现文件映射（可能是新Agent，需更新映射）`);
            continue;
        }
        const absPath = path.join(ROOT, implPath);
        if (!fs.existsSync(absPath)) {
            error(`D4违规 — Agent "${agentId}"的实现文件${implPath}不存在`);
            violations++;
        }
    }

    // 检查2：声明结构完整性（每个Agent必须有id/label/materialNeeds）
    for (const agentId of declaredAgents) {
        const decl = AGENT_DECLARATIONS[agentId];
        if (!decl.id || decl.id !== agentId) {
            error(`D4违规 — Agent "${agentId}"的id字段缺失或不一致`);
            violations++;
        }
        if (!decl.label || typeof decl.label !== 'string') {
            error(`D4违规 — Agent "${agentId}"的label字段缺失或非字符串`);
            violations++;
        }
        if (!Array.isArray(decl.materialNeeds) || decl.materialNeeds.length === 0) {
            error(`D4违规 — Agent "${agentId}"的materialNeeds字段缺失或为空`);
            violations++;
        }
    }

    // 检查3：差异配置完整性（非material-manager的Agent必须有characterFormat/foreshadowFilter）
    for (const agentId of declaredAgents) {
        if (AGENTS_WITHOUT_DIFF_CONFIG.has(agentId)) continue;
        const decl = AGENT_DECLARATIONS[agentId];
        if (!decl.characterFormat) {
            error(`D4违规 — Agent "${agentId}"缺少characterFormat差异配置`);
            violations++;
        }
        if (!decl.foreshadowFilter) {
            error(`D4违规 — Agent "${agentId}"缺少foreshadowFilter差异配置`);
            violations++;
        }
    }

    if (violations === 0) ok(`D4通过 — ${declaredAgents.length}个声明Agent全部有实现文件且结构完整`);
    return violations;
}

/** D5: 测试文件覆盖健康度
 *  确保核心校验脚本有对应的测试文件
 */
function checkD5TestCoverageHealth() {
    console.log('\n=== D5: 测试文件覆盖健康度 ===');
    const CORE_SCRIPTS_REQUIRING_TESTS = [
        { script: 'scripts/verifyProjectStandards.js', test: 'tests/unit/verifyProjectStandards.test.js' },
        { script: 'scripts/projectStandardsRules.js', test: 'tests/unit/verifyProjectStandards.test.js' },
        { script: 'scripts/verifyGuardChain.js', test: null }, // 红蓝对抗脚本自身即验证
        { script: 'scripts/verifyConstraintChain.js', test: null },
    ];
    let violations = 0;
    for (const item of CORE_SCRIPTS_REQUIRING_TESTS) {
        const scriptPath = path.join(ROOT, item.script);
        if (!fs.existsSync(scriptPath)) {
            error(`D5违规 — 核心脚本${item.script}不存在`);
            violations++;
            continue;
        }
        if (item.test) {
            const testPath = path.join(ROOT, item.test);
            if (!fs.existsSync(testPath)) {
                error(`D5违规 — 核心脚本${item.script}缺少测试文件${item.test}`);
                violations++;
            }
        }
    }
    if (violations === 0) ok(`D5通过 — 核心校验脚本测试覆盖完整`);
    return violations;
}

/** D6: R5检查点路径 vs 实际文件+关键词
 *  确保R5检查点定义的路径真实存在且包含关键词
 */
function checkD6R5CheckpointsVsActual() {
    console.log('\n=== D6: R5检查点路径 vs 实际文件+关键词 ===');
    let violations = 0;
    for (const cp of R5_REQUIRED_CHECKPOINTS) {
        const absPath = path.join(ROOT, cp.file);
        const content = readFileContent(absPath);
        if (!content) {
            error(`D6违规 — R5检查点${cp.file}不存在`);
            violations++;
            continue;
        }
        if (!content.includes(cp.keyword)) {
            error(`D6违规 — R5检查点${cp.file}不包含关键词"${cp.keyword}"`);
            violations++;
        }
    }
    if (violations === 0) ok(`D6通过 — ${R5_REQUIRED_CHECKPOINTS.length}个R5检查点路径和关键词全部一致`);
    return violations;
}

/** D7: 校验规则 vs 测试覆盖追溯矩阵
 *  确保每个R1-R5校验规则在测试文件中都有对应的测试用例
 *  追溯矩阵：原则 → 校验规则 → 测试用例
 */
function checkD7RuleTestTraceability() {
    console.log('\n=== D7: 校验规则 vs 测试覆盖追溯矩阵 ===');
    const testPath = path.join(ROOT, 'tests/unit/verifyProjectStandards.test.js');
    const testContent = readFileContent(testPath);
    if (!testContent) {
        error('D7失败 — tests/unit/verifyProjectStandards.test.js不存在');
        return 1;
    }

    // 追溯矩阵：每个校验规则必须有关键词出现在测试文件中
    const TRACEABILITY_MATRIX = [
        { rule: 'R1', desc: 'DataContext统一数据入口', testKeywords: ['R1'] },
        { rule: 'R2', desc: '两套系统检测函数对齐', testKeywords: ['R2'] },
        { rule: 'R3', desc: '禁止硬编码业务规则', testKeywords: ['R3'] },
        { rule: 'R4', desc: '单文件200行上限', testKeywords: ['R4'] },
        { rule: 'R5', desc: '字数检查覆盖所有输出点', testKeywords: ['R5'] },
    ];

    let violations = 0;
    for (const item of TRACEABILITY_MATRIX) {
        const hasTest = item.testKeywords.some(kw => testContent.includes(kw));
        if (!hasTest) {
            error(`D7违规 — ${item.rule}(${item.desc})在测试文件中缺少对应测试用例`);
            violations++;
        }
    }
    if (violations === 0) ok(`D7通过 — ${TRACEABILITY_MATRIX.length}个校验规则全部有测试覆盖（追溯矩阵完整）`);
    return violations;
}

/** D8: deps.js死模块审计
 *  deps.js已删除（确认无任何业务代码引用）
 *  保留此检查作为预防性措施：如果有人重新创建deps.js，需要审查其导出是否被用于绕过R1校验
 */
function checkD8DepsDeadModuleAudit() {
    console.log('\n=== D8: deps.js死模块审计 ===');
    const depsPath = path.join(ROOT, 'server/services/pipeline/deps.js');
    if (!fs.existsSync(depsPath)) {
        ok('D8通过 — deps.js已删除（无死模块风险）');
        return 0;
    }

    // 如果deps.js被重新创建，扫描是否有业务代码引用
    const serverDir = path.join(ROOT, 'server');
    const { scanJsFiles } = require('./projectStandardsRules');
    const allFiles = scanJsFiles(serverDir);
    let violations = 0;
    let refCount = 0;

    for (const file of allFiles) {
        const content = readFileContent(file);
        if (!content) continue;
        if (content.includes('deps.js') || content.includes("require('") && content.match(/require\(['"][^'"]*deps['"]\)/)) {
            const fileName = path.basename(file);
            if (fileName === 'deps.js' || fileName === 'verifyAuditConsistency.js') continue;
            const relPath = path.relative(ROOT, file);
            warn(`D8警告 — ${relPath}引用了deps.js，需审查是否用于绕过R1校验`);
            refCount++;
        }
    }

    if (refCount === 0) {
        warn('D8警告 — deps.js存在但无引用，建议删除以避免死模块风险');
    }
    return violations;
}

function main() {
    console.log('========================================');
    console.log('总工程师大审查一致性校验（D1-D8）');
    console.log('========================================');
    const d1 = checkD1StandardsVsVerification();
    const d2 = checkD2WhitelistVsActualFiles();
    const d3 = checkD3R1PatternCoverage();
    const d4 = checkD4AgentDeclarationsVsImpl();
    const d5 = checkD5TestCoverageHealth();
    const d6 = checkD6R5CheckpointsVsActual();
    const d7 = checkD7RuleTestTraceability();
    const d8 = checkD8DepsDeadModuleAudit();
    const total = d1 + d2 + d3 + d4 + d5 + d6 + d7 + d8;

    // CI健康度仪表盘
    const checks = [
        { name: 'D1', desc: '原则vs校验覆盖', passed: d1 === 0 },
        { name: 'D2', desc: '白名单vs实际文件', passed: d2 === 0 },
        { name: 'D3', desc: 'R1模式覆盖度', passed: d3 === 0 },
        { name: 'D4', desc: 'Agent声明vs实现', passed: d4 === 0 },
        { name: 'D5', desc: '测试覆盖健康度', passed: d5 === 0 },
        { name: 'D6', desc: 'R5检查点vs实际', passed: d6 === 0 },
        { name: 'D7', desc: '追溯矩阵完整性', passed: d7 === 0 },
        { name: 'D8', desc: 'deps.js死模块审计', passed: d8 === 0 },
    ];
    const passedCount = checks.filter(c => c.passed).length;
    const healthScore = Math.round((passedCount / checks.length) * 100);

    console.log('========================================');
    console.log('CI健康度仪表盘');
    console.log('========================================');
    for (const c of checks) {
        const status = c.passed ? '✅' : '❌';
        console.log(`  ${status} ${c.name}: ${c.desc}`);
    }
    console.log(`\n  健康度评分: ${healthScore}% (${passedCount}/${checks.length}项通过)`);
    console.log(`  错误数: ${errorCount}, 警告数: ${warnCount}`);
    console.log('========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');
    if (total === 0) {
        console.log('\n✅ 大审查一致性校验通过 — 规则与实现无脱节');
        process.exit(0);
    } else {
        console.log(`\n❌ 大审查一致性校验失败 — 发现${total}处脱节`);
        process.exit(1);
    }
}

main();
