'use strict';

/**
 * 素材深度批量校验与统计
 * 从 materialDepthValidator.js 拆分，职责：批量校验+按类型/深度统计
 */

const { validateMaterialDepth } = require('./materialDepthValidator');

/**
 * 批量校验素材深度
 * @param {Array} materials
 * @returns {{ results: Array, total: number, passed: number, failed: number, summary: object }}
 */
function validateMaterialDepthBatch(materials) {
    const results = [];
    let passed = 0;
    let failed = 0;
    const summary = {
        byType: {},
        byDepth: { basic: { pass: 0, fail: 0 }, standard: { pass: 0, fail: 0 }, deep: { pass: 0, fail: 0 } }
    };

    for (const m of materials) {
        const result = validateMaterialDepth(m);
        results.push({ id: m.id, name: m.name, type: m.type, ...result });
        if (result.valid) passed++; else failed++;

        const type = m.type || 'unknown';
        if (!summary.byType[type]) summary.byType[type] = { pass: 0, fail: 0 };
        if (result.valid) summary.byType[type].pass++; else summary.byType[type].fail++;

        if (summary.byDepth[result.depthLevel]) {
            if (result.valid) summary.byDepth[result.depthLevel].pass++;
            else summary.byDepth[result.depthLevel].fail++;
        }
    }

    return { results, total: materials.length, passed, failed, summary };
}

module.exports = { validateMaterialDepthBatch };
