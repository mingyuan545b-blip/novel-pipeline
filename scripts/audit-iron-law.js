/**
 * 铁律违反检测脚本 - SOP 09 〇节铁律执行引擎的落地实现
 *
 * 三种模式：
 *   --session-start  会话开始时跑，检测环境+配置就绪
 *   --pre-deliver    交付前跑，扫描git diff+静态规则
 *   --pre-commit     git pre-commit hook触发，只扫暂存区
 *
 * 检测项：
 *   P0-4 硬编码敏感信息（sk-/password=/apiKey=xxx）
 *   P1-Q1 硬编码业务值（material-updated/approved/outlined字面量散落）
 *   P2-B1 PowerShell语法痕迹（如果脚本被提交）
 *   P1-Q3 单文件超过200行（仅扫src代码，不扫test/docs/scripts）
 *
 * 用法：
 *   node scripts/audit-iron-law.js --session-start
 *   node scripts/audit-iron-law.js --pre-deliver
 *   node scripts/audit-iron-law.js --pre-commit
 *
 * 违反exit(1)，CI拦截
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');

// ========== 铁律规则定义 ==========

// P0-4 硬编码敏感信息模式
const SENSITIVE_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/,           // API key明文
    /password\s*=\s*['"][^'"]+['"]/,  // 密码明文
    /apiKey\s*=\s*['"][^'"]+['"]/,    // apiKey明文
    /secret\s*=\s*['"][^'"]+['"]/     // secret明文
];

// P1-Q1 硬编码业务值（章节状态字面量散落）
// 允许的位置：chapterStatus.js（定义处）、tests/（测试用）、docs/（文档）
const BUSINESS_VALUE_PATTERNS = [
    {
        pattern: /status\s*===?\s*['"]material-updated['"]/g,
        name: 'material-updated字面量',
        allowPaths: ['server/services/chapterStatus.js', 'client/src/pages/pipeline/pipelineConstants.js', 'tests/', 'docs/']
    },
    {
        pattern: /status\s*===?\s*['"]approved['"]/g,
        name: 'approved字面量',
        allowPaths: ['server/services/chapterStatus.js', 'client/src/pages/pipeline/pipelineConstants.js', 'tests/', 'docs/']
    },
    {
        pattern: /status\s*===?\s*['"]outlined['"]/g,
        name: 'outlined字面量',
        allowPaths: ['server/services/chapterStatus.js', 'client/src/pages/pipeline/pipelineConstants.js', 'tests/', 'docs/']
    }
];

// P2-B1 PowerShell语法痕迹（在JS文件里出现PS管道/变量）
// 注意：$1在JS里是正则替换符号，不检测；只检测明确的PS管道语法
const POWERSHELL_PATTERNS = [
    /\|\s*tail\b/,      // | tail
    /\|\s*head\b/,      // | head
    /\|\s*grep\b/,      // | grep
    /2>&1/,             // 重定向合并
    /\$_\b/,            // PS管道变量（$_在JS里不常见）
    /@\(.*\)/           // PS数组
];

// P1-Q3 文件行数限制（仅扫src代码）
const MAX_LINES = 200;
const LINE_COUNT_SCAN_DIRS = ['server/services', 'server/routes', 'server/middleware'];

// 非源码目录排除（打包产物/依赖/备份不参与铁律扫描）
const EXCLUDE_DIRS = ['node_modules', 'client/dist', 'client/dist_backup', 'client/build'];

function isExcludedPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return EXCLUDE_DIRS.some(dir => normalized.includes(dir));
}

// ========== 工具函数 ==========

function getStagedFiles() {
    try {
        const output = execSync('git diff --cached --name-only', { cwd: PROJECT_ROOT, encoding: 'utf8' });
        return output.split('\n').filter(f => f && f.endsWith('.js') && !isExcludedPath(f));
    } catch (e) {
        return [];
    }
}

function getWorkingTreeFiles() {
    try {
        const output = execSync('git diff --name-only HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' });
        return output.split('\n').filter(f => f && f.endsWith('.js') && !isExcludedPath(f));
    } catch (e) {
        return [];
    }
}

function readFile(filePath) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
}

function isPathAllowed(filePath, allowedPaths) {
    return allowedPaths.some(allowed => filePath.replace(/\\/g, '/').includes(allowed));
}

function countLines(content) {
    return content.split('\n').length;
}

// ========== 检测器 ==========

// P0-4 检测硬编码敏感信息
function checkSensitiveInfo(files) {
    const issues = [];
    for (const file of files) {
        const content = readFile(file);
        if (!content) continue;
        for (const pattern of SENSITIVE_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
                issues.push({
                    rule: 'P0-4',
                    file,
                    matches: matches.length,
                    sample: matches[0].substring(0, 30) + '...'
                });
            }
        }
    }
    return issues;
}

// P1-Q1 检测硬编码业务值
function checkBusinessValues(files) {
    const issues = [];
    for (const file of files) {
        const content = readFile(file);
        if (!content) continue;
        for (const rule of BUSINESS_VALUE_PATTERNS) {
            const matches = content.match(rule.pattern);
            if (matches && !isPathAllowed(file, rule.allowPaths)) {
                issues.push({
                    rule: 'P1-Q1',
                    file,
                    value: rule.name,
                    count: matches.length,
                    fix: '用 chapterStatus.js 的常量替代'
                });
            }
        }
    }
    return issues;
}

// P2-B1 检测PowerShell语法痕迹
// 注意：审计脚本自身定义了POWERSHELL_PATTERNS字符串（如"| tail"），
// 会被自身检测到，因此跳过审计脚本自身
function checkPowerShellSyntax(files) {
    const issues = [];
    const SELF_PATH = 'scripts/audit-iron-law.js';
    for (const file of files) {
        // 跳过审计脚本自身（避免检测器检测自己定义的检测模式字符串）
        if (file.replace(/\\/g, '/').includes(SELF_PATH)) continue;
        const content = readFile(file);
        if (!content) continue;
        for (const pattern of POWERSHELL_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
                issues.push({
                    rule: 'P2-B1',
                    file,
                    sample: matches[0]
                });
            }
        }
    }
    return issues;
}

// P1-Q3 检测文件行数
function checkFileLines(files) {
    const issues = [];
    for (const file of files) {
        const shouldScan = LINE_COUNT_SCAN_DIRS.some(dir =>
            file.replace(/\\/g, '/').includes(dir)
        );
        if (!shouldScan) continue;
        const content = readFile(file);
        if (!content) continue;
        const lines = countLines(content);
        if (lines > MAX_LINES) {
            issues.push({
                rule: 'P1-Q3',
                file,
                lines,
                max: MAX_LINES
            });
        }
    }
    return issues;
}

// ========== 模式入口 ==========

function modeSessionStart() {
    console.log('[IRON-LAW] 会话开始检查');
    console.log('='.repeat(60));

    // 1. 检查环境就绪
    const checks = [
        { name: '.env文件存在', check: () => fs.existsSync(path.join(PROJECT_ROOT, '.env')) },
        { name: 'ALIYUN_CODING_API_KEY已配置', check: () => {
            require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });
            return !!process.env.ALIYUN_CODING_API_KEY;
        }},
        { name: '题材白名单CI脚本存在', check: () => fs.existsSync(path.join(PROJECT_ROOT, 'scripts/audit-genre-whitelist.js')) },
        { name: '路由参数CI脚本存在', check: () => fs.existsSync(path.join(PROJECT_ROOT, 'scripts/audit-route-param-consistency.js')) },
        { name: 'SOP 09存在', check: () => fs.existsSync(path.join(PROJECT_ROOT, 'docs/sop/09-新项目约束词设计SOP.md')) },
        { name: 'project_memory.md存在', check: () => fs.existsSync(path.join(__dirname, '..', '..', '..', '..', '.trae-cn', 'memory', 'projects', '-c-Users-mingy-Desktop-trae-novel-pipeline', 'project_memory.md')) }
    ];

    let allPass = true;
    for (const c of checks) {
        const ok = c.check();
        console.log(`  ${ok ? '✓' : '✗'} ${c.name}`);
        if (!ok) allPass = false;
    }

    // 2. 跑白名单CI
    console.log('\n[IRON-LAW] 题材白名单CI:');
    try {
        execSync('node scripts/audit-genre-whitelist.js', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (e) {
        allPass = false;
    }

    // 3. 跑路由参数CI
    console.log('\n[IRON-LAW] 路由参数一致性CI:');
    try {
        execSync('node scripts/audit-route-param-consistency.js', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (e) {
        allPass = false;
    }

    console.log('\n' + '='.repeat(60));
    if (allPass) {
        console.log('[IRON-LAW] 会话开始检查通过');
        process.exit(0);
    } else {
        console.error('[IRON-LAW] 会话开始检查失败，请修复后再继续');
        process.exit(1);
    }
}

function modePreDeliver() {
    console.log('[IRON-LAW] 交付前检查');
    console.log('='.repeat(60));

    const files = getWorkingTreeFiles();
    if (files.length === 0) {
        console.log('[IRON-LAW] 无修改文件，跳过');
        process.exit(0);
    }

    console.log(`[IRON-LAW] 扫描 ${files.length} 个修改文件\n`);

    const allIssues = [
        ...checkSensitiveInfo(files),
        ...checkBusinessValues(files),
        ...checkPowerShellSyntax(files),
        ...checkFileLines(files)
    ];

    // 按铁律分组输出
    const grouped = {};
    for (const issue of allIssues) {
        if (!grouped[issue.rule]) grouped[issue.rule] = [];
        grouped[issue.rule].push(issue);
    }

    const RULE_NAMES = {
        'P0-4': '硬编码敏感信息',
        'P1-Q1': '硬编码业务值',
        'P2-B1': 'PowerShell语法痕迹',
        'P1-Q3': '文件行数超限'
    };

    let hasViolation = false;
    for (const rule of ['P0-4', 'P1-Q1', 'P2-B1', 'P1-Q3']) {
        const issues = grouped[rule] || [];
        if (issues.length > 0) {
            console.error(`❌ ${rule} ${RULE_NAMES[rule]} (${issues.length}处):`);
            for (const i of issues) {
                console.error(`   ${i.file} - ${i.value || i.sample || i.lines + '行'}`);
                if (i.fix) console.error(`     修复: ${i.fix}`);
            }
            console.error('');
            hasViolation = true;
        } else {
            console.log(`✓ ${rule} ${RULE_NAMES[rule]} 通过`);
        }
    }

    console.log('='.repeat(60));
    if (hasViolation) {
        console.error('[IRON-LAW] 交付前检查失败，请修复违反项');
        process.exit(1);
    } else {
        console.log('[IRON-LAW] 交付前检查全部通过');
        process.exit(0);
    }
}

function modePreCommit() {
    // 只扫暂存区
    const files = getStagedFiles();
    if (files.length === 0) {
        process.exit(0);
    }

    const allIssues = [
        ...checkSensitiveInfo(files),
        ...checkBusinessValues(files),
        ...checkPowerShellSyntax(files)
    ];

    if (allIssues.length > 0) {
        console.error('[IRON-LAW] pre-commit拦截:');
        for (const i of allIssues) {
            console.error(`  ❌ ${i.rule} ${i.file} - ${i.value || i.sample}`);
        }
        console.error(`\n共 ${allIssues.length} 处违反，commit已拦截`);
        process.exit(1);
    }
    console.log('[IRON-LAW] pre-commit检查通过');
    process.exit(0);
}

// ========== 主入口 ==========

const mode = process.argv[2];
switch (mode) {
    case '--session-start':
        modeSessionStart();
        break;
    case '--pre-deliver':
        modePreDeliver();
        break;
    case '--pre-commit':
        modePreCommit();
        break;
    default:
        console.log('用法: node scripts/audit-iron-law.js --session-start|--pre-deliver|--pre-commit');
        process.exit(1);
}
