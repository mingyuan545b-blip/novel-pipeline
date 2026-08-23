const logger = require('../../shared/logger');

function validateTemplateInput(template) {
    const { name, genre } = template;
    if (!name || !genre) throw new Error('name and genre are required');
}

function repairAndParseJson(text) {
    text = text.replace(/,\s*([}\]])/g, '$1');
    text = text.replace(/[\x00-\x1f]/g, c => c === '\n' || c === '\r' || c === '\t' ? c : '');
    try { return JSON.parse(text); } catch(_) { logger.warn('outlineTemplateValidator', '[SILENT-CATCH]', { value1: _.message || _ }); }
    try { return require('json5').parse(text); } catch(_) { logger.warn('outlineTemplateValidator', '[SILENT-CATCH]', { value1: _.message || _ }); }
    let fixed = text.replace(/\\"/g, '"');
    const openB = (fixed.match(/\[/g) || []).length;
    const closeB = (fixed.match(/\]/g) || []).length;
    const openBr = (fixed.match(/\{/g) || []).length;
    const closeBr = (fixed.match(/\}/g) || []).length;
    if (closeB < openB) fixed += ']'.repeat(openB - closeB);
    if (closeBr < openBr) fixed += '}'.repeat(openBr - closeBr);
    try { return JSON.parse(fixed); } catch(_) { logger.warn('outlineTemplateValidator', '[SILENT-CATCH]', { value1: _.message || _ }); }
    return null;
}

function parseTemplateResponse(responseText) {
    let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        const openBraces = (cleaned.match(/\{/g) || []).length;
        const closeBraces = (cleaned.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
            cleaned = cleaned + '}'.repeat(openBraces - closeBraces);
        }
        const retryMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!retryMatch) throw new Error('No JSON object found in response');
        cleaned = retryMatch[0];
    } else {
        cleaned = jsonMatch[0];
    }

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (parseErr) {
        logger.info('outlineTemplateValidator', '[PIPELINE] Initial JSON parse failed, attempting repair...');
        logger.info('outlineTemplateValidator', '[PIPELINE] First 200 chars:', { value1: cleaned.substring(0, 200) });
        logger.info('outlineTemplateValidator', '[PIPELINE] Around error pos:', { value1: cleaned.substring(Math.max(0, 900), 1050) });

        parsed = repairAndParseJson(cleaned);
        if (!parsed) {
            const lines = cleaned.split('\n');
            let partial = '';
            let depth = 0;
            for (const line of lines) {
                for (const ch of line) {
                    if (ch === '{' || ch === '[') depth++;
                    if (ch === '}' || ch === ']') depth--;
                }
                partial += line + '\n';
                if (depth <= 0 && partial.includes('{')) {
                    try {
                        const testParsed = JSON.parse(partial.trim().replace(/,\s*$/, ''));
                        if (testParsed.materials || testParsed.mainQuests || testParsed.timeline || testParsed.chapterOutlines) {
                            parsed = testParsed;
                            logger.info('outlineTemplateValidator', '[PIPELINE] Partial JSON recovery successful');
                            break;
                        }
                    } catch(_) { logger.warn('outlineTemplateValidator', '[SILENT-CATCH]', { value1: _.message || _ }); }
                }
            }
        }
        if (!parsed) {
            throw new Error('JSON parse failed after all repair attempts: ' + parseErr.message);
        }
    }
    return parsed;
}

module.exports = { validateTemplateInput, parseTemplateResponse };
