/**
 * projectStandardsRules.js — PROJECT_STANDARDS校验规则定义
 * 每条规则对应PROJECT_STANDARDS.md的一条原则，可机器执行校验
 *
 * 规则与原则对应关系：
 * R1 → 第9条 DataContext统一数据入口（强制）
 * R2 → 第8条 两套系统必须对齐（流水线 vs 审计系统）
 * R3 → 第1条 禁止硬编码业务规则
 * R4 → 第10条(隐含) 单文件不超过200行
 * R5 → 第16条 字数检查覆盖所有输出点
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** R1白名单：允许直接调用store的基础设施文件（非Agent业务逻辑）
 *  分类说明：
 *  - 编排层：流水线编排基础设施，管理流水线状态本身
 *  - 数据写入层：素材管理处理器，写入数据而非读取业务数据
 *  - 契约/错误：契约校验和错误信息定义
 */
const R1_WHITELIST = new Set([
    // 编排层（管理流水线状态，非Agent读取业务数据）
    'stepContextBuilder.js',      // 数据组装基础设施
    'pipelineContract.js',        // 契约校验基础设施
    'pipelinePostApproval.js',    // 流水线后处理（已通过审核的数据操作）
    'pipelineErrors.js',          // 错误信息定义（仅字符串引用）
    'fullPipeline.js',            // 流水线主入口（编排层）
    'infinitePipeline.js',        // 无限流水线编排层
    'pipelineStepRunner.js',      // 步骤运行器（编排层）
    // infinite目录全部文件（流水线编排基础设施）
    'batchExecutor.js',
    'chapterErrorHandler.js',
    'chapterExecutor.js',
    'chapterScheduler.js',
    'heartbeat.js',
    'pipelineInit.js',
    'stateManager.js',
    'stopConditions.js',
    'index.js',
    // 素材管理处理器（数据写入层，非Agent读取业务数据）
    'materialActions.js',
    'materialArchive.js',
    'materialBindProcessor.js',
    'materialCreateAction.js',
    'materialItemProcessor.js',
    'materialLifecycle.js',
    'materialMarkdownExtractor.js',
    'materialPostProcessor.js',
    'materialRelationProcessor.js',
    'materialUpdateHelpers.js',
    'materialCreateHelpers.js',
    'materialFieldUtils.js',
    'materialFinder.js',
    'materialJsonParser.js',
    'materialRegistrar.js',
    'materialManager.js',
    'materialOrganizer.js',
    'materialPromptBuilder.js',
    'materialNameResolver.js',
    'materialCharacterProcessor.js',
    'materialSectionBuilder.js',
    'materialManagerCatchup.js',
]);

/** R1扫描目录：Agent业务逻辑所在目录 */
const R1_SCAN_DIRS = [
    'server/services/pipeline/steps',
    'server/services/pipeline/infinite',
];

/** R1违规模式：Agent直接调用store读取数据（第9条只禁止读取，写入允许）
 *  PROJECT_STANDARDS第9条原文："所有Agent必须通过DataContext读取数据，禁止直接调用store.getItem/queryItems"
 *  setItem是写入操作，不在禁止范围内
 *
 *  防绕过：deps.js已删除，但保留deps.store.*检测模式作为预防性措施
 *  （如果有人重新创建类似的聚合模块导出store，此检测仍能拦截）
 */
const R1_VIOLATION_PATTERNS = [
    /store\.getItem\s*\(/g,
    /store\.queryItems\s*\(/g,
    /store\.listItems\s*\(/g,
    // 防绕过：检测通过deps.store间接调用store读取方法
    /deps\.store\.(getItem|queryItems|listItems)\s*\(/g,
];

/** R3禁止的业务关键词（Agent模板中不得硬编码） */
const R3_FORBIDDEN_BUSINESS_TERMS = [
    '爽点密度',
    '打脸质量',
    '装逼指数',
    '金手指强度',
];

/** R4文件行数上限 */
const R4_MAX_LINES = 200;

/** R5字数检查必须覆盖的输出点
 *  路径已通过D6审查修正（原路径指向writer.js/reviser.js等，但实际字数检查在以下位置）：
 *  - writer → writerPostProcess.js（writer后处理）
 *  - reviser → reviserWordGuard.js（reviser字数守卫）
 *  - final-editor → finalEditor.js（终审编辑器）
 *  - polisher → pipelinePostApproval.js（编排层，非polisher.js本身）
 *  - review前 → wordCountGate.js（审核前字数门控）
 */
const R5_REQUIRED_CHECKPOINTS = [
    { file: 'server/services/pipeline/steps/writer/writerPostProcess.js', keyword: 'wordCount', label: 'writer输出' },
    { file: 'server/services/pipeline/steps/reviserWordGuard.js', keyword: 'wordCount', label: 'reviser输出' },
    { file: 'server/services/pipeline/steps/finalEditor.js', keyword: 'wordCount', label: 'finalEditor输出' },
    { file: 'server/services/pipeline/pipelineHelpers/pipelinePostApproval.js', keyword: 'polishMaxWords', label: 'polisher输出(编排层)' },
    { file: 'server/services/pipeline/steps/review/wordCountGate.js', keyword: 'maxWords', label: 'review审核前' },
];

/**
 * 递归扫描目录下所有.js文件
 * @param {string} dir - 绝对路径
 * @param {Array} results - 累积结果
 * @returns {Array} 文件绝对路径列表
 */
function scanJsFiles(dir, results = []) {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanJsFiles(fullPath, results);
        } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

module.exports = {
    R1_WHITELIST,
    R1_SCAN_DIRS,
    R1_VIOLATION_PATTERNS,
    R3_FORBIDDEN_BUSINESS_TERMS,
    R4_MAX_LINES,
    R5_REQUIRED_CHECKPOINTS,
    scanJsFiles,
};
