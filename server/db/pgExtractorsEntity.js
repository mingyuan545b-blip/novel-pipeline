/**
 * pgExtractorsEntity.js — 实体表字段提取器
 * 所有extractor由fieldRegistry.generateExtractor()自动生成，确保字段默认值单一来源
 */
const { generateExtractor } = require('./fieldRegistry');

const extractCharStateFields = generateExtractor('character_states');
const extractStateKvFields = generateExtractor('state_kv_index');
const extractCacheFields = generateExtractor('character_state_cache');
const extractRegistryFields = generateExtractor('entity_registry');
const extractItemDefFields = generateExtractor('item_definitions');
const extractCharBindFields = generateExtractor('character_binds');
const extractCharRelationFields = generateExtractor('character_relations');
const extractPetFields = generateExtractor('pet_entities');
const extractServantFields = generateExtractor('servant_entities');
const extractChronicleFields = generateExtractor('character_chronicle');
const extractKnowledgeAccessFields = generateExtractor('knowledge_access');
const extractKnowledgeFactFields = generateExtractor('knowledge_facts');

module.exports = {
    extractCharStateFields, extractStateKvFields, extractCacheFields,
    extractRegistryFields, extractItemDefFields, extractCharBindFields,
    extractCharRelationFields, extractPetFields, extractServantFields,
    extractChronicleFields, extractKnowledgeAccessFields, extractKnowledgeFactFields
};
