/**
 * audit-config-test-sync.js — 配置变更→测试同步检查
 *
 * 本轮发现35个失败测试，根因是配置变更（术语/字数/类型）未同步到测试。
 * 本脚本扫描git diff，检测配置文件变更，提示需要检查的测试文件。
 *
 * 规则映射：
 * - genreDefaults.js变更 → 检查引用NOVEL_DEFAULTS的测试
 * - systemConfig.js变更 → 检查引用systemConfig的测试
 * - dataStoreRegistry.js变更 → 检查级联删除相关测试
 * - worldConstants.js变更 → 检查世界域相关测试
 * - fieldRegistry变更 → 检查backfill测试
 *
 * 注意：原"术语变更"规则已移除（误报率100%）
 * - subplane/subPlane是高武跨平面题材的有效业务术语，非旧术语
 * - "次位面"在writerHints.js中是术语红线规则（禁止使用），在injectionMapBuilder.js中是向后兼容代码
 * - 术语变更应通过专门的术语映射配置管理，而非grep关键词检测
 *
 * 用法：
 *   node scripts/audit-config-test-sync.js              # 扫描未提交变更
 *   node scripts/audit-config-test-sync.js --last N     # 扫描最近N个commit
 */
const { execSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// 配置文件 → 测试检查规则
const CONFIG_TEST_RULES = [
    {
        name: 'genreDefaults变更',
        filePattern: /server\/config\/genreDefaults\.js$/,
        testFiles: ['tests/unit/systemConfig.test.js', 'tests/unit/genreDefaults.test.js'],
        checkDesc: 'NOVEL_DEFAULTS常量变更（如targetMinWords）需同步测试断言',
        grepHints: ['NOVEL_DEFAULTS', 'targetMinWords', 'targetMaxWords'],
    },
    {
        name: 'systemConfig变更',
        filePattern: /server\/config\/systemConfig.*\.js$/,
        testFiles: ['tests/unit/systemConfig.test.js'],
        checkDesc: '系统配置常量变更需同步测试',
        grepHints: ['PIPELINE_CONTRACT', 'LLM_DEFAULTS', 'SERVER_DEFAULTS'],
    },
    {
        name: 'dataStoreRegistry变更',
        filePattern: /server\/config\/dataStoreRegistry\.js$/,
        testFiles: ['tests/unit/dataStoreRegistry.test.js', 'tests/unit/projectDelete.test.js'],
        checkDesc: '数据存储注册变更（新增表/cascadable标记）需同步级联删除测试',
        grepHints: ['cascadable', 'getCascadableStoreTypes', 'CASCADE_STORE_TYPES'],
    },
    {
        name: 'worldConstants变更',
        filePattern: /server\/services\/worldConstants\.js$/,
        testFiles: ['tests/unit/worldScopeModule.test.js', 'tests/unit/worldConstants.test.js'],
        checkDesc: '世界域常量变更（WORLD_TYPES/POWER_SYSTEMS）需同步测试',
        grepHints: ['WORLD_TYPES', 'validateWorld', 'buildWorld'],
    },
    // 原"术语变更"规则已移除（误报率100%，详见文件头注释）
    {
        name: 'fieldRegistry变更',
        filePattern: /server\/db\/fieldRegistry.*\.js$/,
        testFiles: ['tests/unit/backfill.test.js', 'tests/unit/fieldRegistry.test.js'],
        checkDesc: '字段注册表变更（类型/默认值/transform）需同步backfill测试',
        grepHints: ['extractorDefault', 'extractorTransform', 'timestamptz'],
    },
];

function getGitDiff(lastN) {
    try {
        const cmd = lastN
            ? `git log --name-only --pretty=format: -${lastN}`
            : 'git diff --name-only HEAD';
        const output = execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 10000 });
        return output.split('\n').filter(f => f.trim() && !f.startsWith('docs/') && !f.startsWith('scripts/'));
    } catch (e) {
        console.error('获取git diff失败:', e.message);
        return [];
    }
}

function main() {
    const args = process.argv.slice(2);
    const lastNIdx = args.indexOf('--last');
    const lastN = lastNIdx !== -1 ? parseInt(args[lastNIdx + 1]) || 5 : 0;

    const changedFiles = getGitDiff(lastN);
    if (changedFiles.length === 0) {
        console.log('✅ 无代码文件变更');
        return;
    }

    console.log(`📋 扫描 ${changedFiles.length} 个变更文件，匹配配置-测试同步规则...\n`);

    const issues = [];

    for (const file of changedFiles) {
        for (const rule of CONFIG_TEST_RULES) {
            if (rule.filePattern.test(file)) {
                issues.push({ rule, file });
            }
        }
    }

    if (issues.length === 0) {
        console.log('✅ 无配置变更需检查测试同步');
        return;
    }

    console.log('⚠️  以下配置变更需检查测试同步：\n');

    for (const { rule, file } of issues) {
        console.log(`[需检查] ${rule.name}`);
        console.log(`  变更文件: ${file}`);
        console.log(`  检查说明: ${rule.checkDesc}`);
        console.log(`  需检查测试: ${rule.testFiles.join(', ')}`);
        console.log(`  grep关键词: ${rule.grepHints.join(' | ')}`);
        console.log('');
    }

    console.log(`📊 共 ${issues.length} 项需检查`);
    console.log('📖 详见 docs/MAINTENANCE.md 同步矩阵');
}

main();
