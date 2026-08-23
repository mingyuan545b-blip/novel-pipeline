const logger = require('../shared/logger');
const { NOVEL_DEFAULTS } = require('../config/genreDefaults');
const MAX_CHAPTER_WORDS = NOVEL_DEFAULTS.targetMaxWords;

function calcNgramOverlap(a, b, n = 4) {
    if (a.length < n || b.length < n) return 0;
    const ngramsA = new Set();
    for (let i = 0; i <= a.length - n; i++) ngramsA.add(a.substring(i, i + n));
    let overlap = 0;
    let total = 0;
    for (let i = 0; i <= b.length - n; i++) {
        total++;
        if (ngramsA.has(b.substring(i, i + n))) overlap++;
    }
    return total > 0 ? overlap / total : 0;
}

function normalizeForDedup(text) {
    return text
        .replace(/[，。！？、；：""''（）\s]/g, '')
        .replace(/第[一二三四五六七八九十百千万零\d]+[天日周月年]/g, '')
        .replace(/(早上|上午|中午|下午|傍晚|晚上|深夜|凌晨|清晨|黄昏|黎明)/g, '')
        .toLowerCase();
}

function deduplicateContent(content) {
    if (!content || content.length < 100) return { content: content || '', removed: 0, details: [] };
    if (typeof content !== 'string') { logger.error('contentCleaners', '[deduplicateContent] non-string input:', typeof content); return { content: String(content || ''), removed: 0, details: [] }; }

    const details = [];
    let totalRemoved = 0;

    const paragraphs = content.split(/\n\n+/);
    if (paragraphs.length <= 2 && content.length > 500) {
        const sentences = content.split(/(?<=[。！？])/);
        const chunks = [];
        let chunk = '';
        let sentCount = 0;
        for (const s of sentences) {
            chunk += s;
            sentCount++;
            if (sentCount >= 3) { chunks.push(chunk.trim()); chunk = ''; sentCount = 0; }
        }
        if (chunk.trim()) chunks.push(chunk.trim());
        if (chunks.length > 1) {
            const seenChunks = new Map();
            const keptChunks = [];
            for (let i = 0; i < chunks.length; i++) {
                const norm = normalizeForDedup(chunks[i]);
                if (norm.length < 20) { keptChunks.push(chunks[i]); continue; }
                let isDup = false;
                for (const [existingNorm, existingIdx] of seenChunks.entries()) {
                    if (norm === existingNorm) { isDup = true; details.push(`语块${i + 1}与语块${existingIdx + 1}完全重复: "${chunks[i].substring(0, 50)}..."`); break; }
                    const overlap = calcNgramOverlap(norm, existingNorm);
                    if (overlap > 0.5) { isDup = true; details.push(`语块${i + 1}与语块${existingIdx + 1}高度相似(ngram重叠${(overlap * 100).toFixed(0)}%): "${chunks[i].substring(0, 50)}..."`); break; }
                }
                if (isDup) { totalRemoved++; } else { seenChunks.set(norm, i); keptChunks.push(chunks[i]); }
            }
            if (totalRemoved > 0) content = keptChunks.join('');
        }
    } else {
        const seen = new Map();
        const result = [];
        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i].trim();
            if (!para) { result.push(paragraphs[i]); continue; }
            const normalized = normalizeForDedup(para);
            if (normalized.length < 15) { result.push(paragraphs[i]); continue; }
            let isDuplicate = false;
            for (const [existingNorm, existingIdx] of seen.entries()) {
                if (normalized === existingNorm) { isDuplicate = true; details.push(`段落${i + 1}与段落${existingIdx + 1}完全重复: "${para.substring(0, 50)}..."`); break; }
                if (normalized.length > 30) { const overlap = calcNgramOverlap(normalized, existingNorm); if (overlap > 0.5) { isDuplicate = true; details.push(`段落${i + 1}与段落${existingIdx + 1}高度相似(ngram重叠${(overlap * 100).toFixed(0)}%): "${para.substring(0, 50)}..."`); break; } }
            }
            if (!isDuplicate) { seen.set(normalized, i); result.push(paragraphs[i]); } else { totalRemoved++; }
        }
        content = result.join('\n\n');
    }

    const sentences = content.split(/(?<=[。！？])/);
    const sentSeen = new Map();
    const finalSentences = [];
    let sentRemoved = 0;
    for (const sent of sentences) {
        const norm = normalizeForDedup(sent);
        if (norm.length < 15) { finalSentences.push(sent); continue; }
        let isDupSent = false;
        for (const [existingNorm] of sentSeen.entries()) {
            if (norm === existingNorm) { isDupSent = true; break; }
            if (norm.length > 20 && existingNorm.length > 20) { const overlap = calcNgramOverlap(norm, existingNorm); if (overlap > 0.6) { isDupSent = true; break; } }
        }
        if (isDupSent) { sentRemoved++; details.push(`重复/高度相似句子: "${sent.trim().substring(0, 60)}..."`); } else { sentSeen.set(norm, true); finalSentences.push(sent); }
    }

    return { content: finalSentences.join(''), removed: totalRemoved + sentRemoved, details };
}

function truncateChapter(content, maxWords) {
    if (content.length <= maxWords) return { content };
    const paragraphs = content.split(/\n\n+/);
    let result = '';
    let wordCount = 0;
    for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        if (wordCount + para.length + 2 > maxWords) {
            const remaining = maxWords - wordCount;
            if (remaining > 200) {
                const sentences = para.split(/(?<=[。！？])/);
                let partialResult = '';
                for (const sent of sentences) { if (wordCount + partialResult.length + sent.length > maxWords - 50) break; partialResult += sent; }
                if (partialResult.length > 100) result += (result ? '\n\n' : '') + partialResult;
            }
            break;
        }
        result += (result ? '\n\n' : '') + para;
        wordCount = result.length;
    }
    const lastChar = result.trim().slice(-1);
    if (!/[。！？…」』]/.test(lastChar)) result = result.trimEnd() + '……';
    return { content: result };
}

function splitLongParagraphs(content, maxLen = 150) {
    if (!content) return content;
    const paragraphs = content.split(/\n\n+/);
    const result = [];
    for (const para of paragraphs) {
        if (para.trim().length <= maxLen) { result.push(para); continue; }
        const sentences = para.match(/[^。！？…]+[。！？…]+/g) || [para];
        let current = '';
        for (const sentence of sentences) {
            if ((current + sentence).length > maxLen && current.length > 0) { result.push(current.trim()); current = sentence; } else { current += sentence; }
        }
        if (current.trim()) result.push(current.trim());
    }
    return result.join('\n\n');
}

function cleanFinalContent(content) {
    if (!content) return '';
    if (typeof content !== 'string') { logger.error('contentCleaners', '[cleanFinalContent] non-string input:', typeof content, JSON.stringify(content).substring(0, 200)); return String(content || ''); }
    let cleaned = content;
    cleaned = cleaned.replace(/^#\s*第?\d+[章节].*?\n*/i, '');
    cleaned = cleaned.replace(/^第?\d+[章节][、]\s*.*?\n*/m, '');
    cleaned = cleaned.replace(/---\s*\n*/g, '');
    cleaned = cleaned.replace(/【[^】]*(?:钩子|伏笔|悬念|下章预告|hook)[^】]*】[\s\S]*?(?=\n\n|\Z)/gi, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = splitLongParagraphs(cleaned);
    return cleaned.trim();
}

function cleanChapterContent(content) {
    if (!content) return '';
    if (typeof content !== 'string') { logger.error('contentCleaners', '[cleanChapterContent] non-string input:', typeof content, JSON.stringify(content).substring(0, 200)); return String(content || ''); }
    let cleaned = content
        .replace(/【修改后的正文】/g, '').replace(/【修改后正文】/g, '').replace(/【正文】/g, '')
        .replace(/【修改后的正文[\s\S]*?】/g, '').replace(/^[\s]*修改后的正文[\s]*\n*/m, '')
        .replace(/【本章完】/g, '').replace(/【伏笔提醒[^】]*】/g, '').replace(/【作者注[^】]*】/g, '')
        .replace(/【下章预告[^】]*】/g, '').replace(/【思考[^】]*】/g, '').replace(/【IP方向[^】]*】/g, '')
        .replace(/【素材更新指引[^】]*】/g, '').replace(/<think[\s\S]*?<\/think>/g, '')
        .replace(/<thinking[\s\S]*?<\/thinking>/g, '').replace(/```[\s\S]*?```/g, '')
        .replace(/\[权限终端\][^\n]*/g, '').replace(/\[道具[：:]\s*[^\]]+\][^\n]*/g, '')
        .replace(/\[筹码\][^\n]*/g, '').replace(/\[合作约定\][^\n]*/g, '').replace(/\[契约绑定\][^\n]*/g, '')
        .replace(/(?:手册|道具)浮现选项[：:][^\n]*/g, '').replace(/面临抉择[：:][^\n]*/g, '')
        .replace(/认知碎片进度[：:]\s*\d+\/\d+/g, '').replace(/理智锚点[：:]\s*\d+%/g, '')
        .replace(/扣减\d+%理智锚点/g, '').replace(/①.{1,30}②.{1,50}/g, '')
        .replace(/【([^】]+)】/g, '$1')
        .replace(/\n{3,}/g, '\n\n');

    const ANALYSIS_PATTERNS = [
        /^让我.{0,20}(分析|阅读|仔细|逐段|检查|看看|理解|思考).{0,30}[:：]\s*/m,
        /^我需要.{0,30}[:：]\s*/m, /^(一些|几个|以下).{0,20}(可以|需要|值得).{0,20}[:：]\s*/m,
        /^(保持|保留|这个|不错|很好).{0,10}[。！？\n]/m, /^第[一二三四五六七八九十\d]+段[：:]/m,
        /^(可以|能够|应该).{0,15}(更|更加|更生动|更凝练|更流畅).{0,20}[:：]/m,
        /^[""「「].{0,5}[""」」].{0,10}(可以|能够|应该)/m, /^(这个|这段|此处|这里).{0,10}(比喻|描写|表达|表述)/m,
        /^\s*[-*•]\s+(可以|能够|应该|需要|保持|保留)/m, /^(不能|不得|不可|不要|别).{0,20}(改变|修改|删)/m
    ];
    for (const pattern of ANALYSIS_PATTERNS) cleaned = cleaned.replace(pattern, '');
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n').trim();
    cleaned = splitLongParagraphs(cleaned);
    return cleaned;
}

function ensureCliffhanger(content) {
    if (!content) return content;
    const trimmed = content.trimEnd();
    const lastChar = trimmed.slice(-1);
    if (/[。！？…」』]/.test(lastChar)) return trimmed;
    return trimmed + '……';
}

module.exports = { MAX_CHAPTER_WORDS, calcNgramOverlap, normalizeForDedup, deduplicateContent, truncateChapter, splitLongParagraphs, cleanFinalContent, cleanChapterContent, ensureCliffhanger };
