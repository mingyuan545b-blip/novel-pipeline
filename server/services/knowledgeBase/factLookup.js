/**
 * factLookup.js — 查找或创建knowledge-facts记录
 * 从factSync.js拆出，用于knowledgeExtractor建立factId关联
 */
const store = require('../../store');
const logger = require('../../shared/logger');

const FACT_TYPE = 'knowledge-facts';

/**
 * 查找或创建knowledge-facts记录
 * @param {string} projectId
 * @param {string} factText - 事实文本描述
 * @param {object} options - { level, category, chapterNumber, importance }
 * @returns {Promise<{id: string, factText: string, isNew: boolean}>}
 */
async function findOrCreateFact(projectId, factText, options = {}) {
    if (!projectId || !factText) {
        throw new Error('projectId and factText are required');
    }

    // 按factText查找已有记录
    const existing = await store.queryItems(FACT_TYPE, { projectId });
    const match = existing.find(f => f.factText === factText);
    if (match) {
        return { id: match.id, factText: match.factText, isNew: false };
    }

    // 模糊匹配：去除空格和标点后比较
    const normalize = s => s.replace(/[\s，。、；：！？""''（）\[\]【】]/g, '');
    const normalized = normalize(factText);
    const fuzzyMatch = existing.find(f => normalize(f.factText) === normalized);
    if (fuzzyMatch) {
        return { id: fuzzyMatch.id, factText: fuzzyMatch.factText, isNew: false };
    }

    // 创建新记录
    const MemoryPyramid = require('./MemoryPyramid');
    const pyramid = new MemoryPyramid();
    const fact = await pyramid.addFact(projectId, options.level || 'M2', options.category || 'knowledge-access', factText, {
        chapterNumber: options.chapterNumber || 0,
        importance: options.importance || 50,
    });

    logger.info('factLookup', `Created new fact: ${factText.substring(0, 40)}... (id=${fact.id})`);
    return { id: fact.id, factText: fact.factText, isNew: true };
}

module.exports = { findOrCreateFact };
