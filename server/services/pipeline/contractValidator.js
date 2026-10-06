/**
 * contractValidator.js — 节点级契约校验器（YAML驱动）
 *
 * 基于contracts/*.contract.yml配置执行pre/post校验
 * 校验维度：字段存在性+类型+格式+真实数据内容
 * 不靠LLM：纯JS字段检查
 *
 * 陷阱#79防护：校验素材注入链路每一跳是否打通
 *
 * 字段校验纯函数：contractFieldChecker.js
 * 落库校验：contractPostMaterialValidator.js
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../shared/logger');
const { getByPath, validateField, isExceptFirstChapter, routeBySeverity } = require('./contractFieldChecker');
const { resolveRef } = require('./contracts/_registry');
const { validatePostMaterial: _validatePostMaterial } = require('./contractPostMaterialValidator');

const CONTRACTS_DIR = path.join(__dirname, 'contracts');
// 阶段1：writer/first-review/material-manager
// 阶段2：reviser/fast-review/second-review/final-editor/polisher/consistency-constraint
// 阶段3：outline-generator（补齐STEP_ORDER全覆盖）
const SUPPORTED_AGENTS = [
    'outline-generator',
    'writer', 'first-review', 'material-manager',
    'reviser', 'fast-review', 'second-review', 'final-editor', 'polisher', 'consistency-constraint'
];
const contractCache = new Map();

/** 加载agent契约配置（带缓存） */
function loadContract(agentName) {
    if (contractCache.has(agentName)) return contractCache.get(agentName);
    const filePath = path.join(CONTRACTS_DIR, `${agentName}.contract.yml`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const doc = yaml.load(fs.readFileSync(filePath, 'utf8'));
        contractCache.set(agentName, doc);
        return doc;
    } catch (e) {
        logger.error('contractValidator', `加载契约${agentName}失败: ${e.message}`);
        return null;
    }
}

/** 校验角色素材深度字段（requireMinCount + stateJson.anyOf） */
function validateCharacterMaterialRules(charRule, materials, isFirstChapter, errors, warnings) {
    if (!charRule) return;
    const charMats = (materials || []).filter(m => m.type === 'character' && !m.archived);

    // requireMinCount：CH2+至少N个未归档角色素材
    const minRule = charRule.requireMinCount;
    if (minRule && !isExceptFirstChapter(minRule, isFirstChapter)) {
        const min = minRule.min || 1;
        if (charMats.length < min) {
            routeBySeverity(errors, warnings, {
                severity: minRule.severity || 'CRITICAL',
                errorCode: minRule.errorCode,
                message: `${minRule.message}（实际${charMats.length}<${min}）`
            });
        }
    }

    // stateJson.anyOf：角色stateJson必须含任一深度字段
    const stateRule = charRule.stateJson;
    if (stateRule && !isExceptFirstChapter(stateRule, isFirstChapter) && charMats.length > 0) {
        // YAML 支持 anyOf: "@characterDepthKeys"（共享注册表，避免 7 份手抄漂移）
        const anyOfFields = resolveRef(stateRule.anyOf) || [];
        const hasDepth = charMats.some(m => {
            const sj = m.stateJson || {};
            return anyOfFields.some(f => sj[f] !== undefined && sj[f] !== null && sj[f] !== '');
        });
        if (!hasDepth) {
            routeBySeverity(errors, warnings, {
                severity: stateRule.severity || 'CRITICAL',
                errorCode: stateRule.errorCode,
                message: stateRule.message
            });
        }
    }
}

/** 校验输入素材契约（pre-execution） */
function validateInput(agentName, ctx, chapterNumber) {
    const contract = loadContract(agentName);
    if (!contract || !contract.input) return { passed: true, errors: [], warnings: [] };

    const errors = [];
    const warnings = [];
    const isFirstChapter = chapterNumber === 1;

    if (contract.input.required) {
        for (const rule of contract.input.required) {
            const value = getByPath(ctx, rule.path);
            if (value === undefined || value === null) {
                routeBySeverity(errors, warnings, {
                    severity: rule.severity || 'CRITICAL',
                    errorCode: rule.errorCode,
                    message: rule.message || `${rule.path}缺失`
                });
                continue;
            }
            for (const e of validateField(value, rule, rule.path)) routeBySeverity(errors, warnings, e);
        }
    }

    if (contract.input.materialFields) {
        validateCharacterMaterialRules(
            contract.input.materialFields.character, ctx.materials, isFirstChapter, errors, warnings
        );
    }

    return { passed: errors.length === 0, errors, warnings };
}

/** 校验输出契约（post-execution） */
function validateOutput(agentName, output) {
    const contract = loadContract(agentName);
    if (!contract || !contract.output) return { passed: true, errors: [], warnings: [] };

    const errors = [];
    const warnings = [];

    if (contract.output.required) {
        for (const rule of contract.output.required) {
            const value = output ? output[rule.field] : undefined;
            if (value === undefined || value === null) {
                routeBySeverity(errors, warnings, {
                    severity: rule.severity || 'CRITICAL',
                    errorCode: rule.errorCode,
                    message: rule.message || `${rule.field}缺失`
                });
                continue;
            }
            for (const e of validateField(value, rule, rule.field)) routeBySeverity(errors, warnings, e);
        }
    }

    return { passed: errors.length === 0, errors, warnings };
}

/** post-material校验（material-manager专属，校验素材已落库） */
async function validatePostMaterial(projectId, chapterNumber) {
    const contract = loadContract('material-manager');
    return _validatePostMaterial(contract, projectId, chapterNumber);
}

/** 获取契约摘要（用于SOP校验） */
function getContractSummary() {
    const summary = {};
    for (const agent of SUPPORTED_AGENTS) {
        const contract = loadContract(agent);
        if (contract) {
            summary[agent] = {
                inputRules: contract.input?.required?.length || 0,
                materialFieldRules: contract.input?.materialFields ? 1 : 0,
                outputRules: contract.output?.required?.length || 0,
                postMaterialRules: contract.postMaterial ? Object.keys(contract.postMaterial).length : 0
            };
        }
    }
    return summary;
}

module.exports = {
    validateInput,
    validateOutput,
    validatePostMaterial,
    getContractSummary,
    loadContract
};
