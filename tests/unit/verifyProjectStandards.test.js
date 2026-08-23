/**
 * verifyProjectStandards.test.js — 校验脚本本身的正确性测试
 * 防止校验脚本误报（把合规代码判为违规）或漏报（把违规代码判为合规）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'scripts', 'verifyProjectStandards.js');
const RULES_PATH = path.resolve(__dirname, '..', '..', 'scripts', 'projectStandardsRules.js');

describe('verifyProjectStandards 校验脚本正确性', () => {
    test('R1规则模块正确加载', () => {
        const rules = require(RULES_PATH);
        expect(rules.R1_WHITELIST).toBeInstanceOf(Set);
        expect(rules.R1_SCAN_DIRS).toBeInstanceOf(Array);
        expect(rules.R1_VIOLATION_PATTERNS).toBeInstanceOf(Array);
        expect(rules.R1_VIOLATION_PATTERNS.length).toBeGreaterThan(0);
    });

    test('R1白名单包含基础设施文件', () => {
        const rules = require(RULES_PATH);
        expect(rules.R1_WHITELIST.has('stepContextBuilder.js')).toBe(true);
        expect(rules.R1_WHITELIST.has('pipelineContract.js')).toBe(true);
    });

    test('R1违规模式能匹配store读取调用', () => {
        const rules = require(RULES_PATH);
        const testCode = 'const project = await store.getItem("projects", projectId);';
        let matched = false;
        for (const pattern of rules.R1_VIOLATION_PATTERNS) {
            const re = new RegExp(pattern.source);
            if (re.test(testCode)) { matched = true; break; }
        }
        expect(matched).toBe(true);
    });

    test('R1违规模式不匹配store.setItem写入操作（第9条只禁止读取）', () => {
        const rules = require(RULES_PATH);
        const testCode = 'await store.setItem("reviews", revId, reviewRecord);';
        let matched = false;
        for (const pattern of rules.R1_VIOLATION_PATTERNS) {
            const re = new RegExp(pattern.source);
            if (re.test(testCode)) { matched = true; break; }
        }
        expect(matched).toBe(false);
    });

    test('R1违规模式不误报纯文字注释（无括号调用）', () => {
        // 注释中提到store.getItem但无括号，不会被误报
        const rules = require(RULES_PATH);
        const testCode = '// 这里说明为什么不直接调用store.getItem';
        let matched = false;
        for (const pattern of rules.R1_VIOLATION_PATTERNS) {
            const re = new RegExp(pattern.source);
            if (re.test(testCode)) { matched = true; break; }
        }
        expect(matched).toBe(false);
    });

    test('R1违规模式已知限制：注释中带括号的store调用会被匹配', () => {
        // 已知限制：注释中如果写了store.getItem()带括号，会被匹配
        // 校验脚本会显示行号，人工复核时可快速识别是否为注释
        const rules = require(RULES_PATH);
        const testCode = '// 示例：store.getItem("projects", id)';
        let matched = false;
        for (const pattern of rules.R1_VIOLATION_PATTERNS) {
            const re = new RegExp(pattern.source);
            if (re.test(testCode)) { matched = true; break; }
        }
        expect(matched).toBe(true);
    });

    test('R1违规模式匹配deps.store间接调用（防绕过）', () => {
        // D3审查发现：deps.js第35行导出store，需检测deps.store.*调用模式
        const rules = require(RULES_PATH);
        const testCases = [
            'const project = await deps.store.getItem("projects", id);',
            'const items = await deps.store.queryItems("chapters", query);',
            'const list = await deps.store.listItems("materials");',
        ];
        for (const testCode of testCases) {
            let matched = false;
            for (const pattern of rules.R1_VIOLATION_PATTERNS) {
                const re = new RegExp(pattern.source);
                if (re.test(testCode)) { matched = true; break; }
            }
            expect(matched).toBe(true);
        }
    });

    test('R2两套系统对齐校验配置存在', () => {
        // R2校验在verifyProjectStandards.js中定义HARD_BLOCK_DETECTS
        // 追溯矩阵：第8条原则 → R2校验 → 本测试
        const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
        expect(scriptContent).toContain('R2');
        expect(scriptContent).toContain('HARD_BLOCK_DETECTS');
        expect(scriptContent).toContain('detectModernSlang');
        expect(scriptContent).toContain('detectAdultPerspective');
        expect(scriptContent).toContain('detectTechJargon');
        expect(scriptContent).toContain('detectPipelineMetadataLeak');
        expect(scriptContent).toContain('detectCrossChapterRepetition');
    });

    test('R3禁止业务关键词列表非空', () => {
        const rules = require(RULES_PATH);
        expect(rules.R3_FORBIDDEN_BUSINESS_TERMS).toBeInstanceOf(Array);
        expect(rules.R3_FORBIDDEN_BUSINESS_TERMS.length).toBeGreaterThan(0);
        expect(rules.R3_FORBIDDEN_BUSINESS_TERMS).toContain('爽点密度');
    });

    test('R4文件行数上限为200', () => {
        const rules = require(RULES_PATH);
        expect(rules.R4_MAX_LINES).toBe(200);
    });

    test('R5字数检查点覆盖5个输出点（D6审查修正后路径）', () => {
        const rules = require(RULES_PATH);
        expect(rules.R5_REQUIRED_CHECKPOINTS).toBeInstanceOf(Array);
        expect(rules.R5_REQUIRED_CHECKPOINTS.length).toBe(5);
        const files = rules.R5_REQUIRED_CHECKPOINTS.map(c => path.basename(c.file));
        // D6审查确认的实际字数检查位置（非Agent主文件，而是后处理/守卫/编排层）
        expect(files).toContain('writerPostProcess.js');
        expect(files).toContain('reviserWordGuard.js');
        expect(files).toContain('finalEditor.js');
        expect(files).toContain('pipelinePostApproval.js');
        expect(files).toContain('wordCountGate.js');
    });

    test('R5检查点每个都有file/keyword/label字段', () => {
        const rules = require(RULES_PATH);
        for (const cp of rules.R5_REQUIRED_CHECKPOINTS) {
            expect(cp).toHaveProperty('file');
            expect(cp).toHaveProperty('keyword');
            expect(cp).toHaveProperty('label');
            expect(typeof cp.file).toBe('string');
            expect(typeof cp.keyword).toBe('string');
            expect(typeof cp.label).toBe('string');
        }
    });

    test('scanJsFiles能递归扫描js文件', () => {
        const rules = require(RULES_PATH);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-scan-'));
        fs.mkdirSync(path.join(tmpDir, 'subdir'));
        fs.writeFileSync(path.join(tmpDir, 'a.js'), 'module.exports={};');
        fs.writeFileSync(path.join(tmpDir, 'subdir', 'b.js'), 'module.exports={};');
        fs.writeFileSync(path.join(tmpDir, 'c.txt'), 'not js');
        const results = rules.scanJsFiles(tmpDir);
        expect(results.length).toBe(2);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('校验脚本能正常执行（退出码0或1）', () => {
        let exitCode;
        try {
            execSync(`node "${SCRIPT_PATH}"`, { encoding: 'utf8', stdio: 'pipe' });
            exitCode = 0;
        } catch (e) {
            exitCode = e.status;
        }
        expect([0, 1]).toContain(exitCode);
    });

    test('校验脚本输出包含所有5个规则标识', () => {
        let output;
        try {
            output = execSync(`node "${SCRIPT_PATH}"`, { encoding: 'utf8', stdio: 'pipe' });
        } catch (e) {
            output = e.stdout || e.stderr || '';
        }
        expect(output).toContain('R1:');
        expect(output).toContain('R2:');
        expect(output).toContain('R3:');
        expect(output).toContain('R4:');
        expect(output).toContain('R5:');
    });
});
