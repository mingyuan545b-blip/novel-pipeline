/**
 * pgExtractorsBasic.js — 核心表字段提取器
 * 所有extractor由fieldRegistry.generateExtractor()自动生成，确保字段默认值单一来源
 * extractKvFields保留手写（不同签名：需要type参数）
 */
const { generateExtractor } = require('./fieldRegistry');

const extractMaterialFields = generateExtractor('materials');
const extractChapterFields = generateExtractor('chapters');
const extractProjectFields = generateExtractor('projects');
const extractApiKeysFields = generateExtractor('api_keys');
const extractAgentBindingsFields = generateExtractor('agent_bindings');
const extractTimelineFields = generateExtractor('timelines');
const extractQuestFields = generateExtractor('quests');

function extractKvFields(type, data) {
    return { type, id: data.id, data: JSON.stringify(data) };
}

module.exports = {
    extractMaterialFields, extractChapterFields, extractProjectFields,
    extractKvFields, extractApiKeysFields, extractAgentBindingsFields,
    extractTimelineFields, extractQuestFields
};
