/**
 * projectDeleteHandler - 项目级联删除逻辑
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { getCascadableStoreTypes } = require('../../config/dataStoreRegistry');

// 从数据源注册中心读取需要级联删除的所有store type（标准名+别名）
const CASCADE_STORE_TYPES = getCascadableStoreTypes();

async function cascadeDeleteProject(projectId) {
    const deletedCounts = {};
    const failedCounts = {};
    for (const storeType of CASCADE_STORE_TYPES) {
        try {
            const items = (await store.queryItems(storeType, { projectId })).filter(item => item.projectId === projectId);
            if (items.length === 0) continue;

            let deleted = 0;
            let failed = 0;
            for (const item of items) {
                // Bug#7修复：检查item.id是否存在，避免undefined传入deleteItem导致静默失败
                if (!item.id) {
                    logger.warn('projectDelete', `[cascade-delete] ${storeType}项无id字段，跳过: ${JSON.stringify(item).substring(0, 100)}`);
                    failed++;
                    continue;
                }
                // 修复：项目删除时，对materials类型先清除isFoundation标记，绕过基底素材保护
                if (storeType === 'materials' && item.isFoundation !== false) {
                    try {
                        await store.setItem(storeType, item.id, { ...item, isFoundation: false });
                    } catch (_) { /* 忽略更新失败，继续尝试删除 */ }
                }
                const ok = await store.deleteItem(storeType, item.id);
                if (ok) {
                    deleted++;
                } else {
                    failed++;
                    logger.warn('projectDelete', `[cascade-delete] ${storeType}删除失败: id=${item.id}`);
                }
            }
            // Bug#6修复：记录实际删除数而非查询数
            if (deleted > 0) deletedCounts[storeType] = deleted;
            if (failed > 0) failedCounts[storeType] = failed;
        } catch (_) { logger.warn('projectDelete', '[cascade-delete]', _.message || _); }
    }
    await store.deleteItem('projects', projectId);

    if (Object.keys(failedCounts).length > 0) {
        logger.warn('projectDelete', `[cascade-delete] 部分关联数据删除失败: ${JSON.stringify(failedCounts)}`);
    }
    return { deletedCounts, failedCounts };
}

module.exports = { cascadeDeleteProject, CASCADE_STORE_TYPES };
