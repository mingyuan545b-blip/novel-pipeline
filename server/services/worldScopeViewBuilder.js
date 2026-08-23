/**
 * worldScopeViewBuilder.js — 世界域视图数据组装
 *
 * 将 world-scopes 表的扁平记录组装成前端期望的结构：
 * - worldEntities: { worldId: [{ entityName, entityType, status, chapterNumber }] }
 * - events: [{ id, chapterNumber, transitions: [{ character, from, to, chapterNumber }] }]
 *
 * 字段映射（后端 → 前端）：
 * - record.name        → entity.entityName
 * - record.isVisitor   → entity.status ('visitor' | 'resident')
 * - record.fromWorld   → transition.from
 * - record.toWorld     → transition.to
 */
const logger = require('../shared/logger');

/**
 * 组装世界域视图数据
 * @param {Array} records - world-scopes 表的扁平记录数组
 * @returns {{ worldEntities: object, events: Array }}
 */
function buildWorldScopeView(records) {
    const worldEntities = {};
    const eventsByChapter = {};

    if (!Array.isArray(records)) {
        return { worldEntities, events: [] };
    }

    for (const record of records) {
        if (!record || !record.type) continue;

        if (record.type === 'entity-scope') {
            const worldId = record.worldId || 'main-world';
            if (!worldEntities[worldId]) worldEntities[worldId] = [];
            worldEntities[worldId].push({
                entityName: record.name || record.entityName || 'unknown',
                entityType: record.entityType || 'character',
                status: record.isVisitor ? 'visitor' : (record.status || 'resident'),
                chapterNumber: record.chapterNumber || 0
            });
        } else if (record.type === 'transition') {
            const chNum = record.chapterNumber || 0;
            if (!eventsByChapter[chNum]) {
                eventsByChapter[chNum] = {
                    id: `event-ch${chNum}`,
                    chapterNumber: chNum,
                    transitions: []
                };
            }
            eventsByChapter[chNum].transitions.push({
                character: record.character || 'unknown',
                from: record.fromWorld || record.from || '',
                to: record.toWorld || record.to || '',
                chapterNumber: chNum
            });
        }
    }

    const events = Object.values(eventsByChapter).sort((a, b) => a.chapterNumber - b.chapterNumber);
    logger.debug('worldScopeView', `buildView: ${records.length} records → ${Object.keys(worldEntities).length} worlds, ${events.length} events`);
    return { worldEntities, events };
}

module.exports = { buildWorldScopeView };
