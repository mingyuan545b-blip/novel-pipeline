/**
 * worldScopeCrud.js — 世界域CRUD + 项目世界配置
 *
 * 职责：世界域scope的增删改查 + 项目settings.worlds配置管理
 * 从worldScopeModule.js拆分，保持re-export完整（陷阱#1）
 */
const store = require('../store');
const { SCOPE_DEFS, buildScopePrompt, detectScopeViolation, resolveEffectiveScope, filterByScope } = require('./worldScopePrompts');
const { buildWorld, validateWorld } = require('./worldConstants');

async function getWorldScopes(projectId) {
    const scopes = await store.queryItems('world-scopes', { projectId });
    return scopes || [];
}

async function setWorldScope(projectId, entityId, scope, metadata = {}) {
    const id = `ws-${projectId}-${entityId}`;
    const existing = await store.getItem('world-scopes', id);
    const record = {
        id, projectId, entityId, scope,
        faction: metadata.faction || null,
        characterId: metadata.characterId || null,
        allowedIds: metadata.allowedIds || [],
        updatedAt: new Date().toISOString(),
        ...(existing ? {} : { createdAt: new Date().toISOString() })
    };
    await store.setItem('world-scopes', id, record);
    return record;
}

async function removeWorldScope(projectId, entityId) {
    const id = `ws-${projectId}-${entityId}`;
    await store.deleteItem('world-scopes', id);
    return { success: true };
}

async function getVisibleEntities(projectId, readerId, readerFaction) {
    const scopes = await getWorldScopes(projectId);
    const visible = filterByScope(scopes, readerId, readerFaction);
    const entities = [];
    for (const scopeRecord of visible) {
        const entity = await store.getItem('materials', scopeRecord.entityId);
        if (entity && !entity.archived) entities.push({ ...entity, scope: scopeRecord.scope });
    }
    return entities;
}

async function buildWorldScopePrompt(projectId, readerId, readerFaction) {
    const scopes = await getWorldScopes(projectId);
    const visible = filterByScope(scopes, readerId, readerFaction);
    if (visible.length === 0) return '';
    const parts = [];
    for (const scopeRecord of visible) {
        const entity = await store.getItem('materials', scopeRecord.entityId);
        if (entity && !entity.archived) {
            parts.push(buildScopePrompt(scopeRecord.scope, entity.name));
        }
    }
    return parts.join('\n');
}

async function batchSetScopes(projectId, scopeAssignments) {
    const results = [];
    for (const assignment of scopeAssignments) {
        try {
            const result = await setWorldScope(projectId, assignment.entityId, assignment.scope, assignment.metadata || {});
            results.push({ entityId: assignment.entityId, success: true, scope: result.scope });
        } catch (e) {
            results.push({ entityId: assignment.entityId, success: false, error: e.message });
        }
    }
    return results;
}

const DEFAULT_WORLDS = [buildWorld()];

async function getProjectWorlds(projectId) {
    const project = await store.getItem('projects', projectId);
    if (!project) return [...DEFAULT_WORLDS];
    if (project.settings?.worlds && project.settings.worlds.length > 0) {
        return project.settings.worlds.map(w => buildWorld(w));
    }
    return [...DEFAULT_WORLDS];
}

async function saveProjectWorlds(projectId, worlds) {
    for (const w of worlds) {
        const errors = validateWorld(w);
        if (errors.length > 0) {
            throw new Error(`世界"${w.name || w.id}"校验失败: ${errors.join('; ')}`);
        }
    }
    const project = await store.getItem('projects', projectId);
    if (!project) return null;
    if (!project.settings) project.settings = {};
    project.settings.worlds = worlds;
    await store.setItem('projects', projectId, project);
    return worlds;
}

module.exports = {
    SCOPE_DEFS, getWorldScopes, setWorldScope, removeWorldScope,
    getVisibleEntities, buildWorldScopePrompt, batchSetScopes,
    buildScopePrompt, detectScopeViolation, resolveEffectiveScope, filterByScope,
    getProjectWorlds, saveProjectWorlds
};
