/**
 * high-martial-crossplane/modules/index.js — 模块入口
 *
 * 汇总所有功能模块，供题材index.js装配
 */
const subPlaneSystem = require('./subPlaneSystem');
const cultivationSystem = require('./cultivationSystem');
const supportingDepth = require('./supportingDepth');

module.exports = [
    subPlaneSystem,
    cultivationSystem,
    supportingDepth
];
