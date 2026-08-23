/**
 * 章节片段工具 - 陷阱#47/#50防御
 *
 * 根因：stepContextBuilder.js和chapterIntent.js曾各自写 substring(0, N) 取上一章开头，
 * 导致writer把开头当模板复制。本模块统一章节片段取法，禁止业务代码自己写substring。
 *
 * 规则：
 * - 传给writer/agent的"上一章参考"必须用 getChapterTail() 取结尾
 * - 取章节摘要/预览用 getChapterHead() 取开头
 * - 标签必须用 PREV_CHAPTER_LABEL 语义化标识
 */

/**
 * 取章节结尾片段（用于传给writer推断承接）
 * @param {string} content - 章节正文
 * @param {number} len - 取多少字，默认1500
 * @returns {string} 章节结尾片段
 */
function getChapterTail(content, len = 1500) {
    if (!content || typeof content !== 'string') return '';
    return content.slice(-len);
}

/**
 * 取章节开头片段（用于摘要/预览，不传给writer）
 * @param {string} content - 章节正文
 * @param {number} len - 取多少字，默认500
 * @returns {string} 章节开头片段
 */
function getChapterHead(content, len = 500) {
    if (!content || typeof content !== 'string') return '';
    return content.substring(0, len);
}

/**
 * 上一章参考标签（语义化，防writer逐字复制）
 * 必须配合 getChapterTail() 使用
 */
const PREV_CHAPTER_LABEL = '【上章结尾参考 - 用于推断承接，禁止逐字复制任何段落】';

module.exports = {
    getChapterTail,
    getChapterHead,
    PREV_CHAPTER_LABEL
};
