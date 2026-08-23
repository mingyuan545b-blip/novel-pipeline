const logger = require('../../shared/logger');
/**
 * 大纲AI响应解析模块
 * 负责解析AI返回的JSON/Markdown格式数据
 */
const { extractCharacterStateFromContent } = require('./characterStateExtractor');

function parseJsonResponse(responseText) {
    let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/) || cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    const safeJson = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    return JSON.parse(safeJson);
}

function parseMarkdownOutlines(text) {
    const outlines = [];
    const chapterRegex = /(?:第|Chapter\s*)(\d+)\s*章[：:]\s*(.+)/g;
    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
        const chapterNumber = parseInt(match[1]);
        const title = match[2].trim();
        const afterMatch = text.substring(match.index + match[0].length);
        const nextChapter = afterMatch.search(/(?:第|Chapter\s*)\d+\s*章/);
        const outlineText = nextChapter > 0 ? afterMatch.substring(0, nextChapter) : afterMatch;
        const cleanedOutline = outlineText
            .replace(/^[\s\n]*\*{1,2}[^*]+\*{1,2}[\s\n]*/gm, '')
            .replace(/^#{1,4}\s+.+$/gm, '')
            .replace(/^---+$/gm, '')
            .trim();
        if (cleanedOutline.length > 20) {
            outlines.push({ chapterNumber, title, outline: cleanedOutline.substring(0, 800) });
        }
    }
    if (outlines.length === 0) {
        const sectionRegex = /###?\s*(?:第|Chapter\s*)(\d+)\s*章[：:]*\s*(.*)/g;
        while ((match = sectionRegex.exec(text)) !== null) {
            const chapterNumber = parseInt(match[1]);
            const title = match[2].trim() || `第${chapterNumber}章`;
            const afterMatch = text.substring(match.index + match[0].length);
            const nextSection = afterMatch.search(/###?\s*(?:第|Chapter\s*)\d+/);
            const outlineText = nextSection > 0 ? afterMatch.substring(0, nextSection) : afterMatch;
            const cleanedOutline = outlineText.trim();
            if (cleanedOutline.length > 20) {
                outlines.push({ chapterNumber, title, outline: cleanedOutline.substring(0, 800) });
            }
        }
    }
    logger.info('outlineParser', `parseMarkdownOutlines: extracted ${outlines.length} chapters`);
    return outlines;
}

function parseTemplateResponse(responseText) {
    let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in response');
    const safeJson = jsonMatch[0].replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    return JSON.parse(safeJson);
}

module.exports = {
    parseJsonResponse,
    parseMarkdownOutlines,
    parseTemplateResponse,
    extractCharacterStateFromContent,
};
