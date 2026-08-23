/**
 * 角色关系变更处理模块（薄编排层）
 * 处理materialOrganizer输出的relationshipChanges
 * 实现已提取到 materialRelationSync.js（行为不变，保持原导出签名）
 */
const { REL_TYPE_MAP, inferRelType, processOneRelationshipChange } = require('./materialRelationSync');

/**
 * 处理单个角色的关系变更列表
 */
async function processRelationshipChanges(charUpdate, existingMat, chapter, projectId, materials, operations, errors) {
    const relChanges = charUpdate.relationshipChanges;
    if (!Array.isArray(relChanges) || relChanges.length === 0) return;

    const fromId = existingMat ? existingMat.id : null;
    if (!fromId) return;

    const ctx = { fromId, chapter, projectId, materials, operations, errors, charName: charUpdate.name };
    for (const rc of relChanges) {
        await processOneRelationshipChange(rc, ctx);
    }
}

module.exports = { processRelationshipChanges, inferRelType, REL_TYPE_MAP };
