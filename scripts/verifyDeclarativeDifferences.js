/**
 * verifyDeclarativeDifferences.js — 声明式差异配置完整性校验
 * 从verifyMaterialMigration.js拆分出来，避免单文件超200行
 *
 * 校验规则：
 * 1. 所有Agent必须配置characterFormat/foreshadowFilter/materialSections三个字段
 * 2. characterFormat值必须在有效枚举内（full/brief/simple/reader/review/none）
 * 3. foreshadowFilter值必须在有效枚举内（active/all/none）
 * 4. buildCharacterByFormat分发器必须覆盖所有characterFormat值
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`[WARN]  ${msg}`); warnCount++; }
function ok(msg) { console.log(`[OK]    ${msg}`); }

function readFile(relPath) {
    const fullPath = path.join(SERVER, relPath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
}

/** 校验7：声明式差异配置完整性
 *  所有Agent必须配置characterFormat/foreshadowFilter/materialSections三个字段
 *  防止差异配置缺失导致Agent行为不确定 */
function checkDeclarativeDifferences() {
    console.log('\n=== 校验7：声明式差异配置完整性 ===');
    try {
        const { AGENT_DECLARATIONS, getMaterialDifferences } = require(path.join(SERVER, 'services/pipeline/agentDeclarations.js'));
        const requiredAgents = ['writer', 'first-review', 'second-review', 'fast-review', 'reader', 'reviser', 'polisher', 'final-editor'];
        const validCharFormats = ['full', 'brief', 'simple', 'reader', 'review', 'none'];
        const validFsFilters = ['active', 'all', 'none'];

        for (const agentType of requiredAgents) {
            const decl = AGENT_DECLARATIONS[agentType];
            if (!decl) {
                error(`Agent ${agentType} 未在AGENT_DECLARATIONS中声明`);
                continue;
            }
            const diff = getMaterialDifferences(agentType);
            if (!validCharFormats.includes(diff.characterFormat)) {
                error(`Agent ${agentType} 的 characterFormat='${diff.characterFormat}' 无效`);
            }
            if (!validFsFilters.includes(diff.foreshadowFilter)) {
                error(`Agent ${agentType} 的 foreshadowFilter='${diff.foreshadowFilter}' 无效`);
            }
            if (typeof diff.materialSections !== 'boolean') {
                error(`Agent ${agentType} 的 materialSections 不是boolean`);
            }
            ok(`Agent ${agentType} 差异配置完整 (char=${diff.characterFormat}, fs=${diff.foreshadowFilter}, mat=${diff.materialSections})`);
        }
    } catch (e) {
        error(`agentDeclarations require 失败: ${e.message}`);
    }
}

/** 校验8：buildCharacterByFormat分发器覆盖所有characterFormat值
 *  防止新增characterFormat值后忘记在分发器添加对应分支 */
function checkCharacterFormatDispatcher() {
    console.log('\n=== 校验8：buildCharacterByFormat分发器覆盖性 ===');
    const content = readFile('services/pipeline/materialInjector.js');
    if (!content) { error('无法读取 materialInjector.js'); return; }

    const requiredFormats = ['full', 'brief', 'simple', 'reader', 'review', 'none'];
    let allCovered = true;
    for (const fmt of requiredFormats) {
        const hasCase = content.includes(`case '${fmt}':`) || content.includes(`'${fmt}'`);
        if (!hasCase) {
            error(`buildCharacterByFormat 未覆盖 characterFormat='${fmt}'`);
            allCovered = false;
        }
    }
    if (allCovered) ok(`buildCharacterByFormat 覆盖所有 ${requiredFormats.length} 种格式`);
}

function run() {
    checkDeclarativeDifferences();
    checkCharacterFormatDispatcher();
    return { errorCount, warnCount };
}

module.exports = { run };
