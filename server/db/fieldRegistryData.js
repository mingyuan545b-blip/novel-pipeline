/**
 * fieldRegistryData.js — 字段注册表数据聚合入口
 * 从5个子模块合并所有表定义（30个PG专用表全覆盖）
 */
const coreDefs = require('./fieldRegistryCore');
const entityDefs = require('./fieldRegistryEntity');
const characterDefs = require('./fieldRegistryCharacter');
const narrativeDefs = require('./fieldRegistryNarrative');
const relationDefs = require('./fieldRegistryRelation');

const REGISTRY = {
    ...coreDefs,
    ...entityDefs,
    ...characterDefs,
    ...narrativeDefs,
    ...relationDefs
};

module.exports = { REGISTRY };
