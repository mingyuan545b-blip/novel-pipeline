const logger = require('../../shared/logger');
/**
 * Pipeline前置校验 + 输出校验 + 污染检测 执行器 v2.0
 *
 * 三层防线：
 * 1. preflight() — 步骤执行前的输入契约校验
 * 2. postflight() — 步骤执行后的输出契约校验
 * 3. pollutionCheck() — 步骤执行后的污染检测
 */
const { getStepContract } = require('./pipelineContract');
const { PipelineContractError } = require('./pipelineErrors');
const { validateOutput } = require('./pipelineOutputContract');
const { detectPollution } = require('./pipelinePollutionGuard');

const PREFLIGHT_CONFIG = {
    blockOnCritical: true,
    blockOnHigh: false,
    verbose: true,
};

// ══════════════════════════════════════════════════════════════
// 第一层：输入契约校验（步骤执行前）
// ══════════════════════════════════════════════════════════════

function preflight(step, context) {
    const contracts = getStepContract(step);
    const results = [];
    let blockedBy = null;

    for (const contract of contracts) {
        for (const check of contract.checks) {
            let passed;
            try {
                passed = check.check(context);
            } catch (err) {
                passed = false;
                results.push({
                    code: check.code, label: check.label, severity: check.severity,
                    passed: false, error: err.message
                });
                continue;
            }

            const result = { code: check.code, label: check.label, severity: check.severity, passed };
            results.push(result);

            if (!passed) {
                const logMsg = `[PREFLIGHT] [${check.severity}] [${step}] ${check.code}: ${check.label} — FAILED`;

                if (check.severity === 'CRITICAL' && PREFLIGHT_CONFIG.blockOnCritical) {
                    logger.error('preflight', logMsg);
                    blockedBy = check.code;
                    throw new PipelineContractError(check.code, {
                        step,
                        detail: `步骤=${step}, 检查项=${check.label}, 上下文keys=${Object.keys(context).join(',')}`
                    });
                } else if (check.severity === 'HIGH') {
                    if (PREFLIGHT_CONFIG.blockOnHigh) {
                        logger.error('preflight', logMsg);
                        blockedBy = check.code;
                        throw new PipelineContractError(check.code, { step, detail: `步骤=${step}` });
                    } else {
                        logger.error('preflight', logMsg + ' (继续执行)');
                    }
                } else {
                    logger.warn('preflight', logMsg + ' (继续执行)');
                }
            } else if (PREFLIGHT_CONFIG.verbose) {
                logger.info('preflight', `[PREFLIGHT] [${check.severity}] [${step}] ${check.code}: ${check.label} — OK`);
            }
        }
    }

    const allPassed = results.every(r => r.passed);
    return { passed: allPassed, results, blockedBy };
}

// ══════════════════════════════════════════════════════════════
// 第二层：输出契约校验（步骤执行后）
// ══════════════════════════════════════════════════════════════

function postflight(step, output, context = {}) {
    const result = validateOutput(step, output, context);

    for (const check of result.results) {
        if (!check.passed) {
            const logMsg = `[POSTFLIGHT] [${check.severity}] [${step}] ${check.code}: ${check.label} — FAILED`;
            if (check.severity === 'CRITICAL') {
                logger.error('preflight', logMsg);
            } else if (check.severity === 'HIGH') {
                logger.error('preflight', logMsg);
            } else {
                logger.warn('preflight', logMsg);
            }
        } else if (PREFLIGHT_CONFIG.verbose) {
            logger.info('preflight', `[POSTFLIGHT] [${check.severity}] [${step}] ${check.code}: ${check.label} — OK`);
        }
    }

    return result;
}

// ══════════════════════════════════════════════════════════════
// 第三层：污染检测（步骤执行后）
// ══════════════════════════════════════════════════════════════

function pollutionCheck(step, output, context = {}) {
    const result = detectPollution(step, output, context);

    for (const item of result.results) {
        const logMsg = `[POLLUTION] [${item.severity}] [${step}] ${item.code}: ${item.label} — ${item.detail}`;
        if (item.severity === 'CRITICAL') {
            logger.error('preflight', logMsg);
        } else if (item.severity === 'HIGH') {
            logger.error('preflight', logMsg);
        } else {
            logger.warn('preflight', logMsg);
        }
    }

    return result;
}

// ══════════════════════════════════════════════════════════════
// 诊断模式（不抛错）
// ══════════════════════════════════════════════════════════════

function diagnose(step, context) {
    const contracts = getStepContract(step);
    const results = [];
    const failedChecks = [];

    for (const contract of contracts) {
        for (const check of contract.checks) {
            let passed;
            try { passed = check.check(context); } catch (err) { passed = false; }
            const result = { code: check.code, label: check.label, severity: check.severity, passed };
            results.push(result);
            if (!passed) failedChecks.push(result);
        }
    }

    return { passed: failedChecks.length === 0, results, failedChecks };
}

/**
 * 完整诊断：输入契约 + 输出契约 + 污染检测
 * 用于调试API
 */
function fullDiagnose(step, inputContext, output, pollutionContext) {
    const inputResult = diagnose(step, inputContext);
    const outputResult = output ? validateOutput(step, output, pollutionContext) : null;
    const pollutionResult = output ? detectPollution(step, output, pollutionContext) : null;

    return {
        step,
        input: inputResult,
        output: outputResult,
        pollution: pollutionResult
    };
}

function configure(opts) {
    Object.assign(PREFLIGHT_CONFIG, opts);
}

module.exports = {
    preflight, postflight, pollutionCheck,
    diagnose, fullDiagnose, configure, PREFLIGHT_CONFIG
};
