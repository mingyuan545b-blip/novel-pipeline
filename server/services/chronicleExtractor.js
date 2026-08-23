/**
 * chronicleExtractor — 角色编年史LLM提取器
 *
 * 负责从章节内容中提取角色立场、语录、事迹等数据
 * 从characterChronicle.js拆分出来，保持主文件在200行以内
 */
const llm = require('./llm');
const logger = require('../shared/logger');

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

    full: `分析以下章节内容，提取每个出场角色的立场、内在矛盾、语录和事迹。

输出JSON数组，每个元素：
{
  "name": "角色名",
  "stance": "当前立场（一句话描述该角色对核心事件的态度/立场）",
  "innerConflict": "内在矛盾（一句话描述该角色内心的矛盾或挣扎）",
  "quotes": ["该角色在本章说过的有代表性的话（最多3句，原文引用）"],
  "deeds": ["该角色在本章做过的关键行为（最多3件，简洁描述）"],
  "stanceShiftReason": "如果立场与之前不同，说明转变原因（无变化则为空字符串）"
}

规则：
1. 只提取在章节中有实际出场或被明确提及的角色
2. 语录必须是原文引用，不能改写
3. 事迹要简洁，突出关键行为而非流水账
4. 立场转变原因要具体，说明从什么立场转变到什么立场
5. 如果无法提取任何角色信息，返回空数组[]
6. 只输出JSON，不要其他内容

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

/**
 * 解析LLM返回的chronicle JSON
 */
function parseChronicleResponse(text) {
    try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(item =>
            item.name && (item.stance || item.innerConflict || (item.quotes && item.quotes.length > 0))
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
