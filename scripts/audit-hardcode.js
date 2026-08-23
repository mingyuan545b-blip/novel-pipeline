const fs = require('fs');
const path = require('path');

// 规则来源：scripts/lib/ironLawRules.js（唯一定义源），禁止在本文件私自定义阈值/密钥模式
const { MAX_LINES, SENSITIVE_PATTERNS, maskSample } = require('./lib/ironLawRules');

const SCAN_DIRS = ['server/services', 'server/routes', 'server/core', 'server/config', 'server/middleware'];
const SKIP_PATTERNS = ['.test.', '.spec.', 'Legacy', 'legacy', '__tests__'];

const HARDCODE_RULES = [
    {
        name: 'magic-number-timeout',
        pattern: /setTimeout\s*\(\s*\w+\s*,\s*(\d{4,})\s*\)/g,
        extract: (m) => m[1],
        reason: '超时值应提取到systemConfig常量'
    },
    {
        name: 'magic-number-skipUntil',
        pattern: /skipUntil\s*=\s*Date\.now\(\)\s*\+\s*(\d{4,})/g,
        extract: (m) => m[1],
        reason: '冷却时间应使用LLM_DEFAULTS常量'
    },
    {
        name: 'hardcoded-uuid',
        pattern: /['"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]/gi,
        extract: (m) => m[0],
        reason: '项目ID不应硬编码，应从参数/配置获取'
    },
    {
        name: 'hardcoded-port',
        pattern: /localhost:(\d{4})/g,
        extract: (m) => m[1],
        reason: '端口号应从环境变量读取'
    },
    {
        name: 'hardcoded-api-key',
        pattern: SENSITIVE_PATTERNS[0].pattern,
        extract: (m) => maskSample(m[0]),
        reason: 'API Key绝对不能硬编码'
    }
];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const lineCount = lines.length;
    const issues = [];

    if (lineCount > MAX_LINES) {
        issues.push({
            type: 'file-too-long',
            line: 0,
            value: `${lineCount} lines (max ${MAX_LINES})`,
            reason: '单文件超过200行必须拆分'
        });
    }

    for (const rule of HARDCODE_RULES) {
        const matches = [...content.matchAll(rule.pattern)];
        for (const m of matches) {
            const line = content.substring(0, m.index).split('\n').length;
            issues.push({
                type: rule.name,
                line,
                value: rule.extract(m),
                reason: rule.reason
            });
        }
    }

    return { filePath, lineCount, issues };
}

function scanDirectory(dir) {
    const results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        const fp = path.join(dir, item.name);
        if (item.isDirectory()) {
            results.push(...scanDirectory(fp));
        } else if (/\.(js|jsx)$/.test(item.name)) {
            if (SKIP_PATTERNS.some(p => item.name.includes(p) || fp.includes(p))) continue;
            results.push(scanFile(fp));
        }
    }
    return results;
}

function run() {
    let totalIssues = 0;
    let totalFiles = 0;
    let filesOverLimit = 0;
    const issuesByType = {};

    for (const dir of SCAN_DIRS) {
        const fullDir = path.join(process.cwd(), dir);
        if (!fs.existsSync(fullDir)) continue;
        const results = scanDirectory(fullDir);
        for (const r of results) {
            totalFiles++;
            if (r.issues.length > 0) {
                for (const issue of r.issues) {
                    totalIssues++;
                    if (!issuesByType[issue.type]) issuesByType[issue.type] = [];
                    issuesByType[issue.type].push({
                        file: r.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/'),
                        line: issue.line,
                        value: issue.value
                    });
                    if (issue.type === 'file-too-long') filesOverLimit++;
                }
            }
        }
    }

    console.log('=== HARDCODE & QUALITY AUDIT ===');
    console.log(`Files scanned: ${totalFiles}`);
    console.log(`Files over ${MAX_LINES} lines: ${filesOverLimit}`);
    console.log(`Total issues: ${totalIssues}`);
    console.log('');

    for (const [type, items] of Object.entries(issuesByType)) {
        console.log(`[${type}] ${items.length} issues:`);
        for (const item of items.slice(0, 15)) {
            console.log(`  ${item.file}:${item.line} → ${item.value}`);
        }
        if (items.length > 15) {
            console.log(`  ... and ${items.length - 15} more`);
        }
        console.log('');
    }

    const exitCode = totalIssues > 0 ? 1 : 0;
    process.exit(exitCode);
}

run();
