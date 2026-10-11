const logger = require('../../shared/logger');
/**
 * 大纲AI响应解析模块
 * 负责解析AI返回的JSON/Markdown格式数据
 */
const { extractCharacterStateFromContent } = require('./characterStateExtractor');

/**
 * 括号配平提取：从第一个 [ 或 { 起，扫描到与之配平的收尾括号（字符串内的括号不计）。
 *
 * 【根因修复 2026-10-11】此前用贪婪正则 /\[[\s\S]*\]/ 取"第一个[到最后一个]"，
 * 当 LLM 在 JSON 之后再补一段解释（或又跟了第二个数组）时会把尾随文本一起截进来，
 * JSON.parse 报 "Unexpected non-whitespace character after JSON" → 大纲解析失败
 * → fallback 的 parseMarkdownOutlines 抽 0 章 → 项目静默变成 0 章。
 * 配平提取只取"第一个完整 JSON 值"，尾随文本被正确丢弃。
 */
function _extractBalanced(text) {
    const start = text.search(/[\[{]/);
    if (start < 0) return null;
    const open = text[start];
    const close = open === '[' ? ']' : '}';
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
            if (esc) esc = false;
            else if (ch === '\\') esc = true;
            else if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === open) depth++;
        else if (ch === close) { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
    return null;
}

function parseJsonResponse(responseText) {
    let cleaned = String(responseText || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const balanced = _extractBalanced(cleaned);
    if (balanced) cleaned = balanced;
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
