/**
 * worldContractUtils.js — 世界通行契约的合并/落库辅助（纯函数）
 *
 * 世界列表（含归属）来自 world-info 抽取，契约存在 project.settings.worlds；
 * 这里把两者按"归一 id"合并，保证"每个世界都有且只有一份契约"。
 * 依据：docs/design/实体中心-副本归属与带出机制.md
 */
import { WORLD_TYPES, POWER_SYSTEMS } from './worldConstants';

const baseName = (n) => String(n || '').split(/[（(/／]/)[0].trim();

/** 归一世界 id：主世界（任意叫法）统一为 main-world */
export function normalizeWorldId(w) {
    if (w.id === 'main-world' || baseName(w.name) === '主世界') return 'main-world';
    return w.id || baseName(w.name) || 'world';
}

/** 转成后端可校验的世界对象（字段全部合法化，避免 saveProjectWorlds 报错） */
export function toProjectWorld(w, overrides = {}) {
    const id = normalizeWorldId(w);
    const rawType = w.type || w.worldType || (id === 'main-world' ? 'main' : 'sub');
    const type = WORLD_TYPES[rawType] ? rawType : 'sub';
    const powerSystem = Array.isArray(w.powerSystem) ? w.powerSystem.filter(p => POWER_SYSTEMS[p]) : [];
    return {
        id, name: w.name || id, color: w.color || '#888', type, isDefault: id === 'main-world',
        powerSystem, culture: w.culture || '', techLevel: w.techLevel || '', rules: w.rules || '',
        dangerLevel: w.dangerLevel || '', description: w.description || '',
        entryMethod: w.entryMethod || '', exitMethod: w.exitMethod || '自然离开',
        carryOutPolicy: w.carryOutPolicy || 'native', channelTag: w.channelTag || '',
        ...overrides
    };
}

/** 由"项目世界配置 + 派生世界列表"合并出完整世界名单（归一 id 去重，项目配置优先） */
export function mergeWorldsWithContracts(projectWorlds = [], derivedWorlds = []) {
    const map = new Map();
    for (const w of projectWorlds) map.set(normalizeWorldId(w), toProjectWorld(w));
    for (const d of derivedWorlds) {
        const id = normalizeWorldId(d);
        if (!map.has(id)) map.set(id, toProjectWorld(d));
    }
    return [...map.values()];
}

/** 取某世界当前契约（用于展示），缺省主世界/native */
export function contractOf(projectWorlds = [], world) {
    const id = normalizeWorldId(world);
    const hit = projectWorlds.find(w => normalizeWorldId(w) === id);
    return hit
        ? { carryOutPolicy: hit.carryOutPolicy || 'native', channelTag: hit.channelTag || '', exitMethod: hit.exitMethod || '自然离开' }
        : { carryOutPolicy: 'native', channelTag: '', exitMethod: '自然离开' };
}
