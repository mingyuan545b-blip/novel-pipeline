const store = require('../store');
const logger = require('../shared/logger');

/** 已有实体更新时，从extra合并到existing的字段（仅当extra有值且existing为空时覆盖） */
const MERGEABLE_FIELDS = [
    'position', 'personality', 'speakingTone', 'signatureDetail',
    'craftStyle', 'factionName', 'genreId', 'description', 'lifecycleState',
    // 人物魅力系统4维度
    'charisma', 'philosophy', 'quoteLibrary', 'entranceDesign',
];

class EntityRegistry {
    async registerEntity(projectId, entityType, name, extra = {}, options = {}) {
        // 去重检查：精确匹配 + 模糊匹配
        const existing = await this._findExistingEntity(projectId, entityType, name);
        if (existing) {
            const updates = {
                updatedAt: new Date().toISOString()
            };
            // 只在新章节出现时递增appearCount
            const extraChapter = extra.lastAppearChapter || extra.sourceChapter || null;
            if (extraChapter && extraChapter > (existing.lastAppearChapter || 0)) {
                updates.appearCount = (existing.appearCount || 0) + 1;
                updates.lastAppearChapter = extraChapter;
            } else if (extraChapter && extraChapter === (existing.lastAppearChapter || 0)) {
                // 同一章重复注册，不递增
            } else {
                // 没有章节信息时也不递增（避免同步操作虚增）
            }
            // roleLevel升级
            const roleLevelPriority = { protagonist: 3, supporting: 2, npc: 1 };
            if ((roleLevelPriority[extra.roleLevel] || 0) > (roleLevelPriority[existing.roleLevel] || 0)) {
                updates.roleLevel = extra.roleLevel;
            }
            // behaviorRules同步
            if (extra.behaviorRules && extra.behaviorRules !== existing.behaviorRules) {
                updates.behaviorRules = extra.behaviorRules;
            }
            // 合并展示字段：extra有值且existing为空时覆盖（force=true时强制覆盖包括空值清空，用于PUT路由用户主动修改）
            for (const field of MERGEABLE_FIELDS) {
                if (field === 'lifecycleState') {
                    if (extra[field]) updates[field] = extra[field];
                } else if (options.force && extra[field] !== undefined) {
                    updates[field] = extra[field];
                } else if (extra[field] && !existing[field]) {
                    updates[field] = extra[field];
                }
            }
            // genreState深度合并
            if (extra.genreState && typeof extra.genreState === 'object') {
                updates.genreState = { ...(existing.genreState || {}), ...extra.genreState };
            }
            // profile深度合并
            if (extra.profile && typeof extra.profile === 'object') {
                updates.profile = { ...(existing.profile || {}), ...extra.profile };
            }
            await store.setItem('entity-registry', existing.id, { ...existing, ...updates });
            logger.info('entityRegistry', `Dedup: "${name}" -> existing ${existing.id} (appearCount: ${updates.appearCount || existing.appearCount})`);
            return { ...existing, ...updates };
        }

        const id = extra.id || `reg-${entityType}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const entry = {
            id,
            projectId,
            entityType,
            name,
            briefName: extra.briefName || name.substring(0, 4),
            roleLevel: extra.roleLevel || 'npc',
            isActive: extra.isActive !== false,
            firstAppearChapter: extra.firstAppearChapter || null,
            lastAppearChapter: extra.lastAppearChapter || null,
            appearCount: extra.appearCount || 0,
            parentPlane: extra.parentPlane || null,
            parentFaction: extra.parentFaction || null,
            tags: extra.tags || [],
            description: extra.description || '',
            ...extra
        };
        entry.id = id;
        entry.projectId = projectId;
        entry.entityType = entityType;
        entry.name = name;
        await store.setItem('entity-registry', id, entry);
        return entry;
    }

    async _findExistingEntity(projectId, entityType, name) {
        const all = await store.queryItems('entity-registry', { projectId, entityType });
        // 排除archived，但包含injured/comatose/missing/departed等
        const active = all.filter(e => e.isActive !== false && e.lifecycleState !== 'archived');
        // 精确匹配
        const exact = active.find(e => e.name === name);
        if (exact) return exact;
        // 模糊匹配：去除空格/分隔符后比较
        if (name && entityType === 'character') {
            const normalized = name.toLowerCase().replace(/[\s\-_··]/g, '');
            return active.find(e => {
                const eName = (e.name || '').toLowerCase().replace(/[\s\-_··]/g, '');
                return eName === normalized || eName.includes(normalized) || normalized.includes(eName);
            });
        }
        return null;
    }

    async getEntity(id) {
        return await store.getItem('entity-registry', id);
    }

    async queryEntities(projectId, options = {}) {
        return await store.queryItems('entity-registry', { projectId, ...options });
    }

    async updateAppearCount(id, chapterNumber) {
        const entity = await store.getItem('entity-registry', id);
        if (!entity) return null;
        entity.appearCount = (entity.appearCount || 0) + 1;
        if (chapterNumber > (entity.lastAppearChapter || 0)) {
            entity.lastAppearChapter = chapterNumber;
        }
        await store.setItem('entity-registry', id, entity);
        return entity;
    }

    async deactivateEntity(id) {
        const entity = await store.getItem('entity-registry', id);
        if (!entity) return null;
        entity.isActive = false;
        await store.setItem('entity-registry', id, entity);
        return entity;
    }

    async cleanupDuplicates(projectId) {
        const all = await store.queryItems('entity-registry', { projectId });
        const active = all.filter(e => e.lifecycleState !== 'archived' && e.isActive !== false);
        const byName = {};
        for (const e of active) {
            const key = `${e.entityType}:${e.name}`;
            if (!byName[key]) byName[key] = [];
            byName[key].push(e);
        }
        let cleaned = 0;
        for (const [key, entities] of Object.entries(byName)) {
            if (entities.length <= 1) continue;
            // 保留roleLevel最高的，其余标记为inactive
            const roleLevelPriority = { protagonist: 3, supporting: 2, npc: 1 };
            entities.sort((a, b) => (roleLevelPriority[b.roleLevel] || 0) - (roleLevelPriority[a.roleLevel] || 0));
            const keep = entities[0];
            for (let i = 1; i < entities.length; i++) {
                await this.deactivateEntity(entities[i].id);
                cleaned++;
                logger.info('entityRegistry', `Cleanup duplicate: "${entities[i].name}" (${entities[i].id}) -> keeping ${keep.id}`);
            }
        }
        return cleaned;
    }
}

const entityRegistry = new EntityRegistry();
module.exports = entityRegistry;
