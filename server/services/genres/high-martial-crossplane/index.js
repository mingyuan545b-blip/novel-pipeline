/**
 * high-martial-crossplane/index.js — 题材插件入口
 * 所有部分从目录文件加载
 * 阶段2：功能模块化，小世界/修炼/配角深度通过modules组装
 * 阶段3：分支机制，支持三种世界观分支（programmatic/layered/metaverse）
 */
const { assembleGenre } = require('../genrePluginSpec');
const config = require('./config');
const agentMaterialAccess = require('./access');
const schemaConfig = require('./schemaConfig');
const foundation = require('./foundation');
const { styleProfile, genreBase } = require('./styleProfile');
const entitySchema = require('./entitySchema');
const { qualityChecks, dialectConfig } = require('./qualityChecks');
const writerHints = require('./writerHints');
const constraintPresets = require('./constraintPresets');
const materialTemplates = require('./materialTemplates');
const contentValidation = require('./contentValidation');
const dedupRules = require('./dedupRules');
const reviewRules = require('./reviewRules');


const detectors = require('./detectors');
const interceptors = require('./interceptors');
const modules = require('./modules');
const branches = require('./branches');

const parts = {
    foundation,
    styleProfile,
    genreBase,
    entitySchema,
    qualityChecks,
    dialectConfig,
    writerHints,
    constraintPresets,
    materialTemplates,
    contentValidation,
    dedupRules,
    reviewRules,
    detectors,
    interceptors,
};

const genre = assembleGenre({...config, agentMaterialAccess, ...schemaConfig, modules}, parts);

// 阶段3：挂载分支机制到题材对象
// resolveGenreFromProject通过genre.branches.applyBranch注入分支配置
genre.branches = branches;
genre.supportedBranchKeys = branches.ALL_BRANCH_KEYS;
genre.defaultBranchKey = branches.DEFAULT_BRANCH_KEY;

module.exports = genre;
