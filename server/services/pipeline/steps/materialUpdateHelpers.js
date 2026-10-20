const logger = require('../../../shared/logger');
const fs = require('fs');
const path = require('path');
const store = require('../../../store');
const { getVolumeOrder } = require('../volumeHelpers');
const entityRegistry = require('../../entityRegistry');
const itemDefinition = require('../../itemDefinition');
const entityCenter = require('../../entityCenter');
const { validateMaterial } = require('../../materialValidator');
const { resolveParentPlane, resolveParentFaction } = require('../../materialIntegrity');
const { FIELD_TRANSLATIONS, KNOWN_FIELDS, extractFieldFromContent, extractRoleLevelFromContent, extractGenreStateFromContent, parseFlavorTag } = require('./materialFieldUtils');

function ensureOutputDir(projectId, subDir) {
    const outputBase = path.join(process.cwd(), 'output', projectId);
    const dir = path.join(outputBase, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function normalizeReferences(update, projectId) {
    if (update.parentPlane) {
        const planeResult = resolveParentPlane(update.parentPlane, projectId);
        if (planeResult.resolved && planeResult.method !== 'direct-id') {
            logger.info('materialUpdateHelp', `update.parentPlane引用标准化: "${update.parentPlane}" → "${planeResult.resolved}"(${planeResult.name})`);
            update.parentPlane = planeResult.resolved;
        } else if (planeResult.method === 'unresolved') {
            logger.warn('materialUpdateHelp', `update.parentPlane引用无法解析: "${update.parentPlane}"，清空`);
            update.parentPlane = null;
        }
    }
    if (update.parentFaction) {
        const factionResult = resolveParentFaction(update.parentFaction, projectId);
        if (factionResult.resolved && factionResult.method !== 'direct-id') {
            logger.info('materialUpdateHelp', `update.parentFaction引用标准化: "${update.parentFaction}" → "${factionResult.resolved}"(${factionResult.name})`);
            update.parentFaction = factionResult.resolved;
        } else if (factionResult.method === 'unresolved') {
            logger.warn('materialUpdateHelp', `update.parentFaction引用无法解析: "${update.parentFaction}"，清空`);
            update.parentFaction = null;
        }
    }
}

function normalizeContent(update) {
    if (!update.content && update.description) {
        update.content = typeof update.description === 'string' ? update.description : Object.entries(update.description).map(([k, v]) => `【${FIELD_TRANSLATIONS[k] || k}】${v}`).join('\n');
        delete update.description;
    }
    if (!update.content && update.fields) {
        if (typeof update.fields === 'object') {
            if (!update.name && update.fields.name) update.name = update.fields.name;
            const parts = [];
            for (const [k, v] of Object.entries(update.fields)) {
                if (k === 'name') continue;
                parts.push(`【${FIELD_TRANSLATIONS[k] || k}】${v}`);
            }
            update.content = parts.join('\n');
        } else if (typeof update.fields === 'string') {
            update.content = update.fields;
        }
        delete update.fields;
    }
    if (!update.name && update.content) {
        const nameMatch = update.content.match(/【名称】(.+)/);
        if (nameMatch) update.name = nameMatch[1].trim();
    }
    if (!update.content) {
        const contentParts = [];
        for (const [key, val] of Object.entries(update)) {
            if (KNOWN_FIELDS.has(key) || val == null) continue;
            const label = FIELD_TRANSLATIONS[key] || key;
            if (typeof val === 'string') { contentParts.push(`【${label}】${val}`); }
            else if (typeof val === 'object') {
                for (const [k, v] of Object.entries(val)) { contentParts.push(`【${FIELD_TRANSLATIONS[k] || k}】${v}`); }
            }
        }
        if (contentParts.length > 0) update.content = contentParts.join('\n');
    }
    if (update.content && typeof update.content === 'object') {
        update.content = Object.entries(update.content).map(([k, v]) => `【${k}】${v}`).join('\n');
    }
}

async function findExistingMaterial(update, projectId, materials) {
    let existing = materials.find(m => m.projectId === projectId && !m.archived && m.type === update.type && m.name === update.name);
    if (!existing) {
        existing = materials.find(m => m.projectId === projectId && m.type === update.type && m.name === update.name);
        if (existing && existing.archived) existing = null;
    }
    if (!existing && update.id) { existing = materials.find(m => m.id === update.id || m.id.endsWith(update.id)); }
    if (!existing && update.name) {
        const updateNameLower = update.name.toLowerCase().replace(/[\s\-_·]/g, '');
        existing = materials.find(m => {
            if (m.projectId !== projectId || m.archived || m.type !== update.type) return false;
            const mNameLower = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
            return mNameLower.includes(updateNameLower) || updateNameLower.includes(mNameLower);
        });
    }
    if (!existing && update.name) {
        const updateNameLower = update.name.toLowerCase().replace(/[\s\-_·]/g, '');
        existing = materials.find(m => {
            if (m.projectId !== projectId || m.archived) return false;
            const mNameLower = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
            if (updateNameLower.length >= 2 && mNameLower.includes(updateNameLower)) {
                logger.info('materialUpdateHelp', `素材跨类型模糊匹配: "${update.name}"(${update.type}) -> "${m.name}"(${m.type})`);
                return true;
            }
            return false;
        });
    }
    if (!existing && update.type === 'character' && update.name) {
        try {
            const storeMats = await store.queryItems('materials', { projectId, type: 'character' });
            const storeMatch = storeMats.find(m => !m.archived && m.name === update.name);
            if (storeMatch) { logger.info('materialUpdateHelp', `findExistingMaterial: 从store查到已有角色 "${update.name}"`); existing = storeMatch; }
            else {
                const updateNameLower = update.name.toLowerCase().replace(/[\s\-_··]/g, '');
                const fuzzyMatch = storeMats.find(m => { if (m.archived) return false; const mName = (m.name || '').toLowerCase().replace(/[\s\-_··]/g, ''); return mName === updateNameLower || mName.includes(updateNameLower) || updateNameLower.includes(mName); });
                if (fuzzyMatch) { logger.info('materialUpdateHelp', `findExistingMaterial: 从store模糊匹配到已有角色 "${update.name}" -> "${fuzzyMatch.name}"`); existing = fuzzyMatch; }
            }
        } catch (_) { logger.warn('materialUpdateHelp', '[material-helpers]', _.message || _); }  // DEGRADE: 影响=store.queryItems 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }
    return existing;
}

function determineAction(update, existing) {
    if (!update.action) { update.action = existing ? 'update' : 'create'; }
    else if (update.action === 'create' && existing) {
        logger.info('materialUpdateHelp', `素材去重: "${update.name}"(${update.type})已存在(id=${existing.id})，强制create→update`);
        update.action = 'update';
    }
    return update.action;
}

async function injectPlaneForCreate(update, chapter, projectId, styleProfile) {
    if (update.action !== 'create' || update.parentPlane) return;
    try {
        const chNum = chapter.chapterNumber || 1;
        const volumeOrder = await getVolumeOrder(projectId);
        const currentVolume = volumeOrder.volumeOrder.find(v => {
            const match = v.chapters.match(/Ch(\d+)-(\d+)/);
            return match ? chNum >= parseInt(match[1]) && chNum <= parseInt(match[2]) : false;
        });
        if (currentVolume && !['worldview', 'power-system', 'craft', 'index'].includes(update.type)) {
            const protagonistName = styleProfile?.protagonistName || '';
            const isMainWorldChar = update.name && (update.name.includes('主角') || (protagonistName && update.name.includes(protagonistName)));
            if (!isMainWorldChar) {
                update.parentPlane = currentVolume.subplaneId;
                logger.info('materialUpdateHelp', `素材归属自动注入: "${update.name}" -> parentPlane=${currentVolume.subplaneId}`);
            } else if (isMainWorldChar && currentVolume.subplaneId) {
                update.currentPlaneId = currentVolume.subplaneId;
            }
        }
    } catch (_) { logger.warn('materialUpdateHelp', _.message || _); }  // DEGRADE: 影响=素材更新落库 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
}

function injectFactionForCharacter(update, projectId, materials) {
    if (update.action !== 'create' || !update.parentPlane || update.parentFaction || update.type !== 'character') return;
    const planeFactions = materials.filter(m => m.type === 'faction' && m.parentPlane === update.parentPlane && !m.archived);
    if (planeFactions.length > 0) {
        update.parentFaction = planeFactions[0].id;
        logger.info('materialUpdateHelp', `素材势力自动注入: "${update.name}" -> parentFaction=${planeFactions[0].name}`);
    }
}

function findExistingForArchive(update, projectId, materials) {
    if (!update.name) return null;
    const updateNameLower = update.name.toLowerCase().replace(/[\s\-_]/g, '');
    return materials.find(m => {
        if (m.projectId !== projectId || m.archived) return false;
        const mNameLower = m.name.toLowerCase().replace(/[\s\-_]/g, '');
        return mNameLower.includes(updateNameLower) || updateNameLower.includes(mNameLower);
    });
}

module.exports = { ensureOutputDir, normalizeReferences, normalizeContent, findExistingMaterial, determineAction, injectPlaneForCreate, injectFactionForCharacter, findExistingForArchive };
