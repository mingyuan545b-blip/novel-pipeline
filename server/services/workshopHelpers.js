const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const llm = require('../services/llm');
const { LLM_DEFAULTS } = require('../config/systemConfig');

const WORKSHOP_DIR = path.join(__dirname, '..', '..', 'output', 'workshop');

function ensureWorkshopDir(subDir) {
    const dir = path.join(WORKSHOP_DIR, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function callWithRetry(messages, options, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await llm.chat(messages, options);
        } catch (error) {
            const isTimeout = error.message.includes('超时') || error.message.includes('timeout');
            const isServerError = error.message.includes('500') || error.message.includes('502') || error.message.includes('503');
            if ((isTimeout || isServerError) && attempt < retries) {
                logger.info('workshop', `[WORKSHOP] Retry attempt ${attempt + 1}/${retries} after error: ${error.message}`);
                await new Promise(r => setTimeout(r, LLM_DEFAULTS.workshopRetryDelayMs));
                continue;
            }
            throw error;
        }
    }
}

function stripThinkTags(text) {
    if (!text) return text;
    const thinkEnd = text.indexOf('</think');
    if (thinkEnd !== -1) {
        const afterThink = text.substring(thinkEnd);
        const closeTag = afterThink.indexOf('>');
        if (closeTag !== -1) return afterThink.substring(closeTag + 1).trim();
    }
    return text;
}

function parseJsonFromResponse(responseText) {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error('No JSON found in response');
}

module.exports = { ensureWorkshopDir, callWithRetry, stripThinkTags, parseJsonFromResponse };
