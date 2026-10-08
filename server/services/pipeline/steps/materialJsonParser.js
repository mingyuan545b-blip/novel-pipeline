const logger = require('../../../shared/logger');
const { extractJSON } = require('../../jsonUtils');

/**
 * 可判定版本：返回 { ok, updates, reason }，**不再抛异常**。
 *
 * T1 修复点：原实现把 `{"updates": []}`（模型正确回答"本章无素材变更"）
 * 与"完全无法解析"混为一谈，两者都抛 'JSON extraction failed'
 * → 合法空更新被下游当成失败（或反之被静默吞掉）。
 * 现在：**只要拿到 updates 数组（哪怕为空）就算 ok=true**。
 */
function parseMaterialManagerOutputDetailed(rawResponse) {
    const raw = typeof rawResponse === 'string' ? rawResponse : '';
    const jsonBlocks = extractJsonBlocks(raw);
    const allUpdates = [];

    for (const block of jsonBlocks) {
        const parsed = tryParseJson(block);
        if (parsed && Array.isArray(parsed.updates)) {
            allUpdates.push(...parsed.updates);
        }
    }

    if (allUpdates.length > 0) {
        logger.info('materialJsonParse', `material-manager解析出${allUpdates.length}条素材更新指令(block)`);
        return { ok: true, updates: allUpdates, reason: 'json-block' };
    }

    let root = null;
    try { root = extractJSON(raw); } catch (_) { root = null; }
    if (root && Array.isArray(root.updates)) {
        logger.info('materialJsonParse', `material-manager解析出${root.updates.length}条素材更新指令(root)`);
        return { ok: true, updates: root.updates, reason: 'json-root' };
    }

    return { ok: false, updates: [], reason: '响应中找不到 updates 数组' };
}

/** 兼容旧调用方：解析失败（含完全无 updates 数组）抛异常 */
function parseMaterialManagerOutput(rawResponse) {
    const detailed = parseMaterialManagerOutputDetailed(rawResponse);
    if (!detailed.ok) throw new Error('JSON extraction failed');
    return detailed.updates;
}

function extractJsonBlocks(rawResponse) {
    const blocks = [];
    let searchStart = 0;

    while (searchStart < rawResponse.length) {
        const braceIdx = rawResponse.indexOf('{', searchStart);
        if (braceIdx === -1) break;

        let depth = 0;
        let endIdx = -1;
        for (let i = braceIdx; i < rawResponse.length; i++) {
            if (rawResponse[i] === '{') depth++;
            if (rawResponse[i] === '}') depth--;
            if (depth === 0) {
                endIdx = i;
                break;
            }
        }

        if (endIdx === -1) break;

        const block = rawResponse.substring(braceIdx, endIdx + 1);
        blocks.push(block);
        searchStart = endIdx + 1;
    }

    return blocks;
}

function tryParseJson(block) {
    try {
        return JSON.parse(block);
    } catch (_) {
        logger.warn('materialJsonParse', _.message || _);
    }

    const cleaned = block.replace(/,\s*([}\]])/g, '$1');
    try {
        return JSON.parse(cleaned);
    } catch (__) {
        logger.warn('materialJsonParse', __.message || __);
    }

    return null;
}

function parseForeshadowTracking(response) {
    try {
        const parsed = extractJSON(response);
        if (parsed?.foreshadowTracking && Array.isArray(parsed.foreshadowTracking)) {
            return parsed.foreshadowTracking;
        }
    } catch (ftErr) {
        logger.warn('materialJsonParse', 'Foreshadowtracking hook sync failed:', ftErr.message);
    }
    return [];
}

module.exports = {
    parseMaterialManagerOutput,
    parseMaterialManagerOutputDetailed,
    parseForeshadowTracking,
    extractJsonBlocks,
    tryParseJson
};
