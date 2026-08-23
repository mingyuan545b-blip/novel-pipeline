const logger = require('../../../shared/logger');
const { extractJSON } = require('../../jsonUtils');

function parseMaterialManagerOutput(rawResponse) {
    const jsonBlocks = extractJsonBlocks(rawResponse);
    const allUpdates = [];

    for (const block of jsonBlocks) {
        const parsed = tryParseJson(block);
        if (parsed && parsed.updates && Array.isArray(parsed.updates)) {
            allUpdates.push(...parsed.updates);
        }
    }

    if (allUpdates.length === 0) {
        const parsed = extractJSON(rawResponse);
        if (parsed && parsed.updates) {
            allUpdates.push(...parsed.updates);
        }
    }

    if (allUpdates.length === 0) {
        throw new Error('JSON extraction failed');
    }

    logger.info('materialJsonParse', `material-manager解析出${allUpdates.length}条素材更新指令`);
    return allUpdates;
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
    parseForeshadowTracking,
    extractJsonBlocks,
    tryParseJson
};
