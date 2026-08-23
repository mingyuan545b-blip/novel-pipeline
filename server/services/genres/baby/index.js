/**
 * baby/index.js — 题材插件入口
 * 所有部分从目录文件加载
 */
const { assembleGenre } = require('../genrePluginSpec');
const perspectiveConfig = require("./perspectiveConfig");
const config = require('./config');
const agentMaterialAccess = require('./access');
const schemaConfig = require('./schemaConfig');
const foundation = require('./foundation');
const { styleProfile, genreBase } = require('./styleProfile');
const entitySchema = require('./entitySchema');
const { qualityChecks, dialectConfig } = require('./qualityChecks');
const writerHints = require('./writerHints');
const constraintPresets = require('./constraintPresets');
const dedupRules = require('./dedupRules');
const reviewRules = require('./reviewRules');


const detectors = require('./detectors');
const interceptors = require('./interceptors');
const parts = {
    foundation,
    styleProfile,
    genreBase,
    entitySchema,
    qualityChecks,
    dialectConfig,
    writerHints,
    constraintPresets,
    dedupRules,
    reviewRules,
    detectors,
    interceptors,
};

module.exports = assembleGenre({...config, perspective: perspectiveConfig, agentMaterialAccess, ...schemaConfig}, parts);
