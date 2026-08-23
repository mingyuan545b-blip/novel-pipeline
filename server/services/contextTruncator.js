/**
 * 动态内容截断工具 - 根据模型context大小动态计算截断长度
 * 替代硬编码的 substring(0, 8000) / substring(0, 6000) / 前500+末500
 */
const { CONTEXT_BUDGETS } = require('./contextBudget');
const { DEFAULT_MODEL } = require('../config/modelResolver');

const MODEL_ENV_KEY = 'ALIYUN_CODING_MODEL';

function _getCurrentModel() {
    return process.env[MODEL_ENV_KEY] || DEFAULT_MODEL;
}

function _resolveModelBudget(model) {
    if (CONTEXT_BUDGETS[model]) return CONTEXT_BUDGETS[model];
    const ml = (model || '').toLowerCase();
    if (ml.includes('qwen3.6-plus')) return 800000;
    if (ml.includes('qwen3.6-35b') || ml.includes('qwen3-30b')) return 256000;
    if (ml.includes('qwen3.5-plus')) return 256000;
    if (ml.includes('qwen3-235b') || ml.includes('qwen3-32b')) return 128000;
    if (ml.includes('qwen-long')) return 80000;
    if (ml.includes('deepseek')) return 24000;
    if (ml.includes('gpt-4o') || ml.includes('gpt-4-turbo')) return 16000;
    if (ml.includes('glm-4')) return 16000;
    if (ml.includes('moonshot-v1-128k')) return 32000;
    return CONTEXT_BUDGETS.default;
}

/**
 * 获取当前模型的审核内容截断长度
 * @param {string} [model] - 模型名称，默认从环境变量读取
 * @returns {{ contentLimit: number, reviewOutputLimit: number, finalEditorHead: number, finalEditorTail: number }}
 */
function getReviewLimits(model) {
    const resolvedModel = model || _getCurrentModel();
    const budget = _resolveModelBudget(resolvedModel);

    if (budget >= 400000) {
        // qwen3.6-plus (800K): 审核看全文，定稿看全文
        return {
            contentLimit: 0,           // 0 = 不截断，传全文
            reviewOutputLimit: 3000,   // 初审/复审输出截断
            finalEditorHead: 0,        // 0 = 不截断
            finalEditorTail: 0         // 0 = 不截断
        };
    }

    if (budget >= 100000) {
        // qwen3.5-plus (256K): 审核看大部分
        return {
            contentLimit: 50000,
            reviewOutputLimit: 2500,
            finalEditorHead: 3000,
            finalEditorTail: 3000
        };
    }

    if (budget <= 40000) {
        // 小模型 (32K-40K): 保守截断
        return {
            contentLimit: 6000,
            reviewOutputLimit: 1500,
            finalEditorHead: 500,
            finalEditorTail: 500
        };
    }

    // 默认 (128K-160K)
    return {
        contentLimit: 12000,
        reviewOutputLimit: 2000,
        finalEditorHead: 1000,
        finalEditorTail: 1000
    };
}

/**
 * 根据模型动态截断审核正文
 * @param {string} content - 章节正文
 * @param {string} [model] - 模型名称
 * @returns {string} 截断后的内容
 */
function truncateForReview(content, model) {
    if (!content) return '';
    const limits = getReviewLimits(model);
    if (limits.contentLimit === 0) return content;
    if (content.length <= limits.contentLimit) return content;
    return content.substring(0, limits.contentLimit) + '\n...(正文过长已截断，系统实际字数见上方标注)';
}

/**
 * 根据模型动态截断定稿正文（首尾模式）
 * @param {string} content - 章节正文
 * @param {string} [model] - 模型名称
 * @returns {string} 截断后的内容描述
 */
function truncateForFinalEditor(content, model) {
    if (!content) return '';
    const limits = getReviewLimits(model);
    const totalLen = content.length;

    if (limits.finalEditorHead === 0) {
        return `全文(${totalLen}字)：\n${content}`;
    }

    const head = content.substring(0, limits.finalEditorHead);
    const tail = content.substring(Math.max(0, totalLen - limits.finalEditorTail));
    return `前${limits.finalEditorHead}字：${head}\n末${limits.finalEditorTail}字：${tail}`;
}

/**
 * 截断审核输出（初审/复审结果引用）
 * @param {string} text - 审核输出文本
 * @param {string} [model] - 模型名称
 * @returns {string}
 */
function truncateReviewOutput(text, model) {
    if (!text) return '';
    const limits = getReviewLimits(model);
    if (text.length <= limits.reviewOutputLimit) return text;
    return text.substring(0, limits.reviewOutputLimit) + '\n...(审核结果过长已截断)';
}

module.exports = { getReviewLimits, truncateForReview, truncateForFinalEditor, truncateReviewOutput };
