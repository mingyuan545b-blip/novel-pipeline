/**
 * chronicleExtractor — 角色编年史LLM提取器
 *
 * 负责从章节内容中提取角色立场、语录、事迹等数据
 * 从characterChronicle.js拆分出来，保持主文件在200行以内
 */
const llm = require('./llm');
const logger = require('../shared/logger');
const { normalizeQuote } = require('./validateQuotes');

const CHRONICLE_PROMPTS = {
    minimal: `分析以下章节内容，只提取主角和核心反派（最多2个角色）的立场。

输出JSON数组，每个元素：
{
  "name": "角色名",
  "stance": "当前立场（一句话描述该角色对核心事件的态度/立场）"
}

规则：
1. 只提取主角和直接与主角对抗的核心反派，最多2个角色
2. 忽略配角、路人、NPC
3. 立场必须是具体的，不能是"中立""未知"等模糊描述
4. 如果本章主角和反派无明确立场表现，返回空数组[]
5. 只输出JSON，不要其他内容

章节内容：`,

    basic: `分析以下章节内容，提取每个出场角色的立场和内在矛盾。

输出JSON数组，每个元素：
{
  "name": "角色名",
  "stance": "当前立场（一句话描述该角色对核心事件的态度/立场）",
  "innerConflict": "内在矛盾（一句话描述该角色内心的矛盾或挣扎）"
}

规则：
1. 只提取在章节中有实际出场或被明确提及的角色
2. 立场必须是具体的，不能是"中立""未知"等模糊描述
3. 内在矛盾可以是空字符串（如果该角色本章无内心挣扎）
4. 如果无法提取任何角色信息，返回空数组[]
5. 只输出JSON，不要其他内容

章节内容：`,

    full: `分析以下章节内容，提取每个出场角色的多维编年史数据（日常/心理变化/立场/立场变化/高光时刻/名言/事迹/关系变化）。

输出JSON数组，每个元素：
{
  "name": "角色名",
  "daily": "日常：本章生活化细节/习惯/口头禅（一句话，无则空字符串）",
  "psychology": "心理变化：本章心理状态的变化（如 怕→赌→认命，无则空字符串）",
  "stance": "当前立场（一句话，具体，不能是中立/未知）",
  "innerConflict": "内在矛盾（一句话，无则空字符串）",
  "stanceShiftReason": "立场变化：从什么立场变到什么立场+原因（无变化则空字符串）",
  "highlights": [{"scene": "场景", "what": "做了什么/高光点", "why": "为什么是名场面/驱动了人格或命运的哪一环"}],
  "quotes": [{"scene": "说这句话的处境", "quote": "原文引用，不可改写，最多3句", "why": "为什么记得住/驱动了什么"}],
  "deeds": ["本章关键行为（最多3件，简洁，非流水账）"],
  "relations": [{"target": "对象名", "from": "原关系", "to": "现关系", "reason": "变化原因"}]
}

规则：
1. 只提取在章节中有实际出场或被明确提及的角色
2. quotes 必须是原文引用，并补全"场景(scene)"与"记忆点(why)"；缺场景/记忆点的鸡汤式台词不要收录
3. highlights 只收"名场面/高光时刻"（角色发光、转折、立住人格），没有则空数组
4. 禁止现代网络梗与抽象升华式台词；台词要能反推说话人的身份/处境
5. 立场转变原因要具体，说明从什么立场转变到什么立场
6. 如果无法提取任何角色信息，返回空数组[]
7. 只输出JSON，不要其他内容

章节内容：`
};

const SYSTEM_PROMPT = '你是小说角色分析专家，擅长从文本中提取角色的立场、内心矛盾、语录和事迹。只输出JSON，不要其他内容。';

/**
 * 从章节内容提取chronicle数据
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {string} chapterContent
 * @param {string} level - 'minimal' | 'basic' | 'full'
 * @returns {Promise<Array>} 提取结果数组
 */
async function extractChronicleFromChapter(projectId, chapterNumber, chapterContent, level) {
    if (!chapterContent || chapterContent.length < 100) return [];
    const prompt = CHRONICLE_PROMPTS[level] || CHRONICLE_PROMPTS.basic;
    const truncated = chapterContent.substring(0, 8000);

    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt + '\n\n' + truncated }
        ];
        const result = await llm.chat(messages, {
            maxTokens: 2048,
            temperature: 0.3,
            enableThinking: false
        });
        const text = result?.choices?.[0]?.message?.content || result?.content || result?.response || '';
        logger.info('chronicle', `LLM response for ch${chapterNumber}: length=${text.length}, preview=${text.substring(0, 200)}`);
        return parseChronicleResponse(text);
    } catch (err) {
        logger.warn('chronicle', `LLM extraction failed for ch${chapterNumber}: ${err.message}`);
        return [];
    }
}

/** 归一化单条编年史：兼容旧字段，补齐 8 维结构 */
function _normalizeEntry(item) {
    const quotes = (Array.isArray(item.quotes) ? item.quotes : []).map(normalizeQuote).filter(Boolean);
    const highlights = (Array.isArray(item.highlights) ? item.highlights : [])
        .filter(h => h && (h.scene || h.what));
    const relations = (Array.isArray(item.relations) ? item.relations : [])
        .filter(r => r && (r.target || r.to));
    return {
        ...item,
        name: item.name,
        daily: item.daily || item.dailyLife || '',
        psychology: item.psychology || item.psychChange || '',
        stance: item.stance || '',
        innerConflict: item.innerConflict || '',
        stanceShiftReason: item.stanceShiftReason || '',
        highlights, quotes, relations,
        deeds: Array.isArray(item.deeds) ? item.deeds : []
    };
}

/**
 * 解析LLM返回的chronicle JSON
 */
function parseChronicleResponse(text) {
    try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(_normalizeEntry).filter(e =>
            e.name && (e.stance || e.innerConflict || e.daily || e.psychology ||
                e.quotes.length > 0 || e.highlights.length > 0)
        );
    } catch (err) {
        logger.warn('chronicle', `Failed to parse chronicle response: ${err.message}`);
        return [];
    }
}

module.exports = {
    extractChronicleFromChapter,
    parseChronicleResponse,
    CHRONICLE_PROMPTS
};
