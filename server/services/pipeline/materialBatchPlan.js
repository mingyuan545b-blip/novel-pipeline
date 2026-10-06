/**
 * materialBatchPlan.js — 素材生成批次规划（纯函数）
 *
 * 背景（2026-10-05 勘定压测 #12）：
 *   一次性要求 LLM 产出"11 角色 + 全部设定"，输出 JSON 必被 maxTokens 截断
 *   → parseJsonResponse 失败 → created=0。实测拆 3~4 批即成功。
 *   这里把"该生成哪些类型"拆成有界批次：角色先分两批（主角+核心 / 其余），
 *   非角色类型再单独一批（避免单批体积过大）。
 */
'use strict';

const CHARACTER_TYPE = 'character';

/**
 * @param {string[]} activeTypes 项目要生成的素材类型（primary+secondary-skip）
 * @returns {Array<{types:string[], batchKey:string, note:string}>}
 */
function planMaterialBatches(activeTypes = []) {
    const types = [...new Set(activeTypes.filter(Boolean))];
    const batches = [];
    const others = types.filter(t => t !== CHARACTER_TYPE);

    if (types.includes(CHARACTER_TYPE)) {
        batches.push({
            types: [CHARACTER_TYPE],
            batchKey: 'character-lead',
            note: '本批【只生成角色素材】：主角 1 名 + 核心配角 2-3 名（共 3-4 名）。其余素材类型留待后续批次，本批不要生成。',
        });
        batches.push({
            types: [CHARACTER_TYPE],
            batchKey: 'character-rest',
            note: '本批【只生成角色素材】：次要配角 / NPC 3-4 名（保持与主线相关的必要角色）。**不要重复以下已生成角色**：{{AVOID}}。',
        });
    }
    if (others.length > 0) {
        batches.push({ types: others, batchKey: 'non-character', note: '' });
    }
    return batches;
}

module.exports = { planMaterialBatches, CHARACTER_TYPE };
