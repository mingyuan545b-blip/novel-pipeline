'use strict';

/**
 * materialUpdateRepair — 违规条目的**定向修复**（T3）
 *
 * 与"整章重跑"的区别（也回答"怎么省 token"）：
 *   · 只把**违规的 N 条**回喂，合规条目不重复发送、不重复落库；
 *   · 最多 1 次尝试（maxAttempts 默认 1），不允许无限烧 token；
 *   · 修复失败不阻断主流程，但**必须留下 dropped 计数**（绝不静默）。
 */
const logger = require('../../../shared/logger');
const { parseMaterialManagerOutputDetailed } = require('./materialJsonParser');
const { validateMaterialUpdates, buildRepairPrompt } = require('./materialOutputSchema');

/**
 * @param {object} p { invalid, runAgent, agentContext, chapter, maxAttempts }
 * @returns {Promise<{repaired:Array, stillInvalid:Array, attempts:number, reason:string|null}>}
 */
async function repairInvalidUpdates(p) {
    const { invalid = [], runAgent, agentContext, maxAttempts = 1 } = p;
    if (!Array.isArray(invalid) || invalid.length === 0) {
        return { repaired: [], stillInvalid: [], attempts: 0, reason: null };
    }
    if (typeof runAgent !== 'function') {
        return { repaired: [], stillInvalid: invalid, attempts: 0, reason: 'no-runAgent' };
    }

    const prompt = buildRepairPrompt(invalid);
    let lastReason = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await runAgent('material-manager', { ...agentContext, content: prompt });
            const detailed = parseMaterialManagerOutputDetailed(result?.response || '');
            if (!detailed.ok) {
                lastReason = `修复响应不可解析: ${detailed.reason}`;
                continue;
            }
            const validated = validateMaterialUpdates(detailed.updates);
            if (validated.valid.length > 0) {
                logger.info('materialRepair', `定向修复成功 ${validated.valid.length}/${invalid.length} 条（第${attempt}次）`);
                return {
                    repaired: validated.valid,
                    stillInvalid: validated.invalid,
                    attempts: attempt,
                    reason: validated.invalid.length > 0 ? `仍有${validated.invalid.length}条不合规` : null,
                };
            }
            lastReason = `修复后仍无合规条目（${validated.invalid.length}条不合规）`;
        } catch (e) {
            lastReason = `修复调用失败: ${e.message}`;
            logger.warn('materialRepair', lastReason);
        }
    }

    return { repaired: [], stillInvalid: invalid, attempts: maxAttempts, reason: lastReason };
}

module.exports = { repairInvalidUpdates };
