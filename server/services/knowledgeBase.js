'use strict';

/**
 * 知识库统一入口
 * 模块拆分：ForeshadowLedger / MemoryPyramid / ConsistencyChecker / factSync
 */

const ForeshadowLedger = require('./knowledgeBase/ForeshadowLedger');
const MemoryPyramid = require('./knowledgeBase/MemoryPyramid');
const ConsistencyChecker = require('./knowledgeBase/ConsistencyChecker');
const { syncFactsFromMaterials: _syncFacts } = require('./knowledgeBase/factSync');

const foreshadowLedger = new ForeshadowLedger();
const memoryPyramid = new MemoryPyramid();
const consistencyChecker = new ConsistencyChecker();

async function syncFactsFromMaterials(projectId, materials) {
    return _syncFacts(projectId, materials, memoryPyramid);
}

module.exports = {
    foreshadowLedger,
    memoryPyramid,
    consistencyChecker,
    syncFactsFromMaterials,
    ForeshadowLedger,
    MemoryPyramid,
    ConsistencyChecker
};
