/**
 * techniqueExtraction — 藏经阁「一键提取」编排器
 *
 * 输入一段（或一整本）小说文本 → 按通用维度逐维调用LLM → 解析去重 → 落库PG → 刷新检索内存。
 *
 * 关键设计：
 *   1) 均匀采样而非全文送入：长篇按全书等距取窗口，保证"开头/中段/结尾"的写法都能被看到，
 *      同时把单次成本锁在 LIBRARY_EXTRACT.CHUNK_CHARS 量级。
 *   2) 一维一次调用：维度之间互不干扰，失败可单维重试，进度可上报。
 *   3) 去重双保险：库内已有技法名 + 本批次已产出名，都参与判定。
 * 文件位置：server/services/techniqueExtraction.js
 */
const llm = require('./llm');
const logger = require('../shared/logger');
const libraryStore = require('./libraryStore');
const techIndex = require('./techIndex');
const { LIBRARY_EXTRACT } = require('../config/systemConfig');
const { CRAFT_DIMENSIONS, getDimension } = require('../config/libraryExtractDimensions');
const { buildSystemPrompt, buildUserPrompt } = require('./libraryExtractPrompt');
const { parseTechniques, normalizeTechnique, makeId } = require('./libraryExtractParse');

const CHAPTER_SPLIT = /(?=第[零一二三四五六七八九十百千0-9]+章)/;

/** 按章节边界切分为块（无章节标记时按长度硬切） */
function splitIntoChunks(text, chunkChars) {
    const normalized = String(text || '').replace(/\r\n/g, '\n');
    const parts = normalized.split(CHAPTER_SPLIT).filter(p => p.trim().length > 0);
    const chunks = [];
    let buf = '';
    for (const part of parts) {
        if (buf.length + part.length > chunkChars && buf.length > 0) {
            chunks.push(buf);
            buf = '';
        }
        buf += part;
    }
    if (buf) chunks.push(buf);
    if (chunks.length > 1 || parts.length > 1) return chunks;

    // 无章节标记：按长度切
    const flat = [];
    for (let i = 0; i < normalized.length; i += chunkChars) flat.push(normalized.slice(i, i + chunkChars));
    return flat;
}

/** 均匀采样：从全书中等距取 windowChars 大小的若干窗口，拼成样本 */
function sampleEvenly(chunks, windowChars, maxWindows) {
    if (chunks.length === 0) return '';
    const take = Math.min(maxWindows, chunks.length);
    // 等距取窗口必须包含首尾块：结尾常是高潮与收束写法所在，漏掉尾部会漏技法来源
    const indices = new Set();
    for (let i = 0; i < take; i++) {
        indices.add(Math.round(i * (chunks.length - 1) / Math.max(1, take - 1)));
    }
    const picked = [...indices].sort((a, b) => a - b).map((idx, i) =>
        `【样本${i + 1}｜第${idx + 1}/${chunks.length}块】\n${chunks[idx].slice(0, windowChars)}`);
    return picked.join('\n\n');
}

/** 单维度提取（一次LLM调用） */
async function extractDimension({ dimension, chunks, novelName, existingNames }) {
    const excerpt = sampleEvenly(chunks, LIBRARY_EXTRACT.CHUNK_CHARS, LIBRARY_EXTRACT.WINDOWS_PER_DIMENSION);
    const messages = [
        { role: 'system', content: buildSystemPrompt(dimension) },
        { role: 'user', content: buildUserPrompt({ dimension, novelName, excerpt, existingNames }) },
    ];
    const baseOptions = {
        temperature: 0.4,
        maxTokens: 4096,
        timeoutMs: LIBRARY_EXTRACT.REQUEST_TIMEOUT_MS,
    };
    const res = await llm.chat(messages, baseOptions);
    const raw = res?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
        parsed = parseTechniques(raw);
    } catch (e) {
        // LLM偶发输出非法JSON（漏逗号/截断）。重试一次并加重"只输出JSON"的约束，避免整维作废
        logger.warn('techniqueExtraction', `维度[${dimension.label}] JSON解析失败，重试一次: ${e.message}`);
        const retry = await llm.chat([
            ...messages,
            { role: 'assistant', content: raw.slice(0, 500) },
            { role: 'user', content: '上面的输出不是合法JSON。请只输出合法JSON，不要任何解释文字、不要markdown代码块、不要注释。' },
        ], { ...baseOptions, temperature: 0.2 });
        parsed = parseTechniques(retry?.choices?.[0]?.message?.content || '');
    }
    const normalized = [];
    for (const item of parsed) {
        const t = normalizeTechnique(item, dimension);
        if (t) normalized.push(t);
    }
    return normalized;
}

/** 去重：库内已有 + 本批已产出（同名或高度同名视为重复） */
function isDuplicate(name, seen) {
    const key = name.replace(/[（）()·\s]/g, '');
    for (const s of seen) {
        const k = s.replace(/[（）()·\s]/g, '');
        if (k === key) return true;
        if (k.length >= 4 && key.length >= 4 && (k.includes(key) || key.includes(k))) return true;
    }
    return false;
}

/**
 * 主流程
 * @param {object} params { text, novelName, dimensions, taskId, onProgress }
 * @returns {object} { inserted, techniques, skipped, dimensions, samples }
 */
async function runExtraction({ text, novelName, dimensions, taskId, onProgress } = {}) {
    const content = String(text || '');
    if (content.length < LIBRARY_EXTRACT.MIN_TEXT_CHARS) {
        throw new Error(`文本过短（${content.length}字），至少需要 ${LIBRARY_EXTRACT.MIN_TEXT_CHARS} 字才能提取`);
    }
    const dims = (dimensions && dimensions.length ? dimensions.map(getDimension).filter(Boolean) : CRAFT_DIMENSIONS)
        .slice(0, LIBRARY_EXTRACT.MAX_DIMENSIONS);
    const chunks = splitIntoChunks(content, LIBRARY_EXTRACT.CHUNK_CHARS);
    const existing = await libraryStore.listNamesWithDept();
    const allIds = existing.map(e => e.id);
    const seenNames = existing.map(e => e.name);
    const produced = [];
    const failed = [];
    let duplicates = 0;

    for (let i = 0; i < dims.length; i++) {
        const dimension = dims[i];
        if (onProgress) onProgress({ step: dimension.label, index: i + 1, total: dims.length });
        try {
            const list = await extractDimension({ dimension, chunks, novelName, existingNames: seenNames.slice(0, 80) });
            const batch = [];
            for (const t of list) {
                if (isDuplicate(t.display_name, seenNames)) { duplicates++; continue; }
                t.id = makeId(t.department, t.subcategory, allIds);
                t.source_novel = novelName || '';
                t.source_type = 'extracted';
                allIds.push(t.id);
                seenNames.push(t.display_name);
                batch.push(t);
                produced.push(t);
            }
            // 逐维增量落库：提取是长任务，进程崩溃/超时也不该丢掉已产出的维度
            if (batch.length) await libraryStore.importTechniques(batch);
            logger.info('techniqueExtraction', `维度[${dimension.label}]产出 ${list.length} 条（入库 ${batch.length}，累计 ${produced.length}）`, { taskId });
        } catch (e) {
            failed.push({ dimension: dimension.label, error: e.message });
            logger.error('techniqueExtraction', `维度[${dimension.label}]提取失败: ${e.message}`, { taskId });
        }
    }

    // 逐维已落库，这里只做内存视图刷新（否则注入链用的仍是旧数据）
    if (produced.length) await techIndex.reload();
    const importResult = { inserted: produced.length, updated: 0 };

    return {
        novelName: novelName || '',
        textChars: content.length,
        chunks: chunks.length,
        dimensions: dims.map(d => d.label),
        inserted: importResult.inserted,
        skippedDuplicates: duplicates,
        techniques: produced.map(t => ({ id: t.id, name: t.display_name, department: t.department, subcategory: t.subcategory })),
        failedDimensions: failed,
        libraryTotal: (await libraryStore.getStats()).total,
    };
}

module.exports = { runExtraction, splitIntoChunks, sampleEvenly, isDuplicate };
