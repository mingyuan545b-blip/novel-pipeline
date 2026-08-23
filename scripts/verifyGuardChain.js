/**
 * verifyGuardChain.js — 约束工具链红蓝对抗验证脚本
 *
 * 目的：验证所有约束工具能否真正检测到违规代码，而非"纸上谈兵"
 *
 * 验证策略：
 * 1. 红队：故意制造5类违规代码到临时文件
 * 2. 蓝队：运行各个约束工具，验证能否检测到违规
 * 3. 清理：删除所有临时文件
 * 4. 报告：输出详细验证报告
 *
 * 使用场景：
 * - 工具配置完成后验证
 * - 定期回归验证
 * - CI/CD流水线中运行
 *
 * 运行方式：node scripts/verifyGuardChain.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const STEPS_DIR = path.join(PROJECT_ROOT, 'server', 'services', 'pipeline', 'steps');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');

/** 验证结果记录 */
const results = [];

/** 临时文件列表（用于清理） */
const tempFiles = [];

/**
 * 创建临时违规文件
 * @param {string} filename - 文件名
 * @param {string} content - 文件内容
 * @returns {string} 文件绝对路径
 */
function createTempViolationFile(filename, content) {
    const filePath = path.join(STEPS_DIR, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    tempFiles.push(filePath);
    return filePath;
}

/**
 * 清理所有临时文件
 */
function cleanupTempFiles() {
    for (const filePath of tempFiles) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            // 忽略清理失败
        }
    }
}

/**
 * 运行命令并返回结果
 * @param {string} cmd - 命令
 * @param {Array} args - 参数
 * @returns {{success: boolean, stdout: string, stderr: string}}
 */
function runCommand(cmd, args) {
    try {
        const fullCmd = `${cmd} ${args.join(' ')}`;
        const stdout = execSync(fullCmd, {
            cwd: PROJECT_ROOT,
            encoding: 'utf-8',
            timeout: 30000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { success: true, stdout, stderr: '' };
    } catch (e) {
        return {
            success: false,
            stdout: e.stdout || '',
            stderr: e.stderr || e.message,
        };
    }
}

/**
 * 记录验证结果
 * @param {string} testName - 测试名称
 * @param {string} toolName - 工具名称
 * @param {boolean} detected - 是否检测到违规
 * @param {string} detail - 详情
 */
function recordResult(testName, toolName, detected, detail) {
    results.push({ testName, toolName, detected, detail });
    const status = detected ? '✅ 拦截' : '❌ 漏放';
    console.log(`  ${status} ${toolName}: ${detail}`);
}

/**
 * 测试1：R1违规 - store直接调用
 */
function testR1Violation() {
    console.log('\n=== 红队测试1: R1违规 - Agent直接调用store.getItem ===');
    const filename = '_guard_test_r1.js';
    const content = [
        '// 红队测试文件 - R1违规',
        'const store = require("../../db/store");',
        'async function badAgent() {',
        '    const project = await store.getItem("projects", "proj-1");',
        '    return project;',
        '}',
        'module.exports = { badAgent };',
        '',
    ].join('\n');

    createTempViolationFile(filename, content);

    // 验证1: verifyProjectStandards.js
    const verifyResult = runCommand('node', [path.join(SCRIPTS_DIR, 'verifyProjectStandards.js')]);
    const verifyDetected = !verifyResult.success || verifyResult.stdout.includes('R1');
    recordResult('R1违规', 'verifyProjectStandards.js', verifyDetected,
        verifyDetected ? '检测到R1违规' : '未检测到R1违规');

    // 验证2: ESLint
    const eslintResult = runCommand('npx', ['eslint', path.join(STEPS_DIR, filename), '--no-ignore']);
    const eslintDetected = !eslintResult.success && (
        eslintResult.stdout.includes('no-restricted-syntax') ||
        eslintResult.stdout.includes('store.getItem')
    );
    recordResult('R1违规', 'ESLint no-restricted-syntax', eslintDetected,
        eslintDetected ? '检测到store.getItem调用' : '未检测到store.getItem调用');
}

/**
 * 测试2：R3违规 - 硬编码业务规则
 */
function testR3Violation() {
    console.log('\n=== 红队测试2: R3违规 - 硬编码业务规则 ===');
    const filename = '_guard_test_r3.js';
    const content = [
        '// 红队测试文件 - R3违规',
        'const prompt = `',
        '请确保爽点密度达到3次/千字，',
        '打脸质量评分不低于8分，',
        '装逼指数维持在高位，',
        '金手指强度逐步提升。',
        '`;',
        'module.exports = { prompt };',
        '',
    ].join('\n');

    createTempViolationFile(filename, content);

    // 验证: verifyProjectStandards.js
    const verifyResult = runCommand('node', [path.join(SCRIPTS_DIR, 'verifyProjectStandards.js')]);
    const verifyDetected = !verifyResult.success || verifyResult.stdout.includes('R3');
    recordResult('R3违规', 'verifyProjectStandards.js', verifyDetected,
        verifyDetected ? '检测到R3硬编码业务规则' : '未检测到R3硬编码业务规则');
}

/**
 * 测试3：R4违规 - 文件超过200行
 */
function testR4Violation() {
    console.log('\n=== 红队测试3: R4违规 - 文件超过200行 ===');
    const filename = '_guard_test_r4.js';
    const lines = ['// 红队测试文件 - R4违规 文件超200行'];
    for (let i = 0; i < 210; i++) {
        lines.push(`const x${i} = ${i};`);
    }
    lines.push('module.exports = {};');
    lines.push('');

    createTempViolationFile(filename, lines.join('\n'));

    // 验证1: verifyProjectStandards.js
    const verifyResult = runCommand('node', [path.join(SCRIPTS_DIR, 'verifyProjectStandards.js')]);
    const verifyDetected = !verifyResult.success || verifyResult.stdout.includes('R4');
    recordResult('R4违规', 'verifyProjectStandards.js', verifyDetected,
        verifyDetected ? '检测到文件超200行' : '未检测到文件超200行');

    // 验证2: ESLint max-lines
    const eslintResult = runCommand('npx', ['eslint', path.join(STEPS_DIR, filename), '--no-ignore']);
    const eslintDetected = !eslintResult.success && eslintResult.stdout.includes('max-lines');
    recordResult('R4违规', 'ESLint max-lines', eslintDetected,
        eslintDetected ? '检测到文件超200行' : '未检测到文件超200行');
}

/**
 * 测试4：ESLint违规 - no-empty
 */
function testNoEmptyViolation() {
    console.log('\n=== 红队测试4: ESLint违规 - 空catch块 ===');
    const filename = '_guard_test_noempty.js';
    const content = [
        '// 红队测试文件 - no-empty违规',
        'try {',
        '    doSomething();',
        '} catch (e) {}',
        'module.exports = {};',
        '',
    ].join('\n');

    createTempViolationFile(filename, content);

    // 验证: ESLint
    const eslintResult = runCommand('npx', ['eslint', path.join(STEPS_DIR, filename), '--no-ignore']);
    const eslintDetected = !eslintResult.success && eslintResult.stdout.includes('no-empty');
    recordResult('no-empty违规', 'ESLint no-empty', eslintDetected,
        eslintDetected ? '检测到空catch块' : '未检测到空catch块');
}

/**
 * 测试5：白名单文件不误报
 */
function testWhitelistNoFalsePositive() {
    console.log('\n=== 蓝队测试5: 白名单文件不误报 ===');
    const filename = '_guard_test_whitelist.js';
    // 模拟白名单文件名（material前缀）
    const whitelistFile = path.join(STEPS_DIR, 'material_test_whitelist.js');
    const content = [
        '// 蓝队测试文件 - 白名单文件应允许store调用',
        'const store = require("../../db/store");',
        'async function writeMaterial() {',
        '    const items = await store.queryItems("materials", { projectId: "p1" });',
        '    return items;',
        '}',
        'module.exports = { writeMaterial };',
        '',
    ].join('\n');

    fs.writeFileSync(whitelistFile, content, 'utf-8');
    tempFiles.push(whitelistFile);

    // 验证: ESLint不应报错（白名单文件）
    const eslintResult = runCommand('npx', ['eslint', whitelistFile, '--no-ignore']);
    const noFalsePositive = eslintResult.success;
    recordResult('白名单验证', 'ESLint 白名单排除', noFalsePositive,
        noFalsePositive ? '白名单文件未被误报' : '白名单文件被误报');
}

/**
 * 输出验证报告
 */
function printReport() {
    console.log('\n========================================');
    console.log('约束工具链红蓝对抗验证报告');
    console.log('========================================');

    const totalTests = results.length;
    const passedTests = results.filter(r => r.detected).length;
    const failedTests = totalTests - passedTests;

    console.log(`\n总测试项: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);

    if (failedTests > 0) {
        console.log('\n❌ 失败项:');
        results.filter(r => !r.detected).forEach(r => {
            console.log(`  - ${r.testName} / ${r.toolName}: ${r.detail}`);
        });
    }

    console.log('\n========================================');
    if (failedTests === 0) {
        console.log('✅ 所有约束工具验证通过 — 工具链正常工作');
    } else {
        console.log('❌ 存在约束工具失效 — 需要修复');
    }
    console.log('========================================');

    return failedTests === 0;
}

/**
 * 主函数
 */
function main() {
    console.log('========================================');
    console.log('约束工具链红蓝对抗验证');
    console.log('========================================');
    console.log('策略: 故意制造违规代码，验证工具能否检测到');

    try {
        testR1Violation();
        testR3Violation();
        testR4Violation();
        testNoEmptyViolation();
        testWhitelistNoFalsePositive();
    } finally {
        cleanupTempFiles();
        console.log('\n[清理] 所有临时测试文件已删除');
    }

    const allPassed = printReport();
    process.exit(allPassed ? 0 : 1);
}

main();
