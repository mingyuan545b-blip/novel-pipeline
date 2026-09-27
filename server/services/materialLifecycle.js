'use strict';

/**
 * materialLifecycle.js — 素材/道具生命周期（纯函数）
 *
 * 目的（用户诉求）：某件装备只在第 30–50 章有效、人物牺牲/装备报废后应回收归档，
 * 否则它会被**后续所有章节**继续加载 → token 黑洞。
 *
 * 字段：
 *   archived(boolean)                —— 归档（与既有素材归档语义一致）
 *   state('active'|'suspended'|'retired')
 *   activeFromChapter / activeToChapter（可空；可空表示该端不限）
 */

const STATES = ['active', 'suspended', 'retired'];

function chapterOf(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** 是否应在本章加载：未归档/未报废，且命中章节区间 */
function isMaterialActiveAt(material, chapterNumber) {
    if (!material) return false;
    if (material.archived) return false;
    if (material.state === 'retired') return false;
    const ch = chapterOf(chapterNumber);
    const from = chapterOf(material.activeFromChapter);
    const to = chapterOf(material.activeToChapter);
    if (!ch) return true;                 // 无章节上下文（如建索引）时不裁剪区间，保守处理
    if (from && ch < from) return false;
    if (to && ch > to) return false;
    return true;
}

function lifecycleLabel(material) {
    if (!material) return '—';
    if (material.archived || material.state === 'retired') return '已归档/报废';
    if (material.state === 'suspended') return '暂停';
    const from = chapterOf(material.activeFromChapter);
    const to = chapterOf(material.activeToChapter);
    if (from || to) return `第${from || 1}–${to || '∞'}章`;
    return '常驻';
}

/** 校验并归一生命周期补丁（供 API/脚本复用） */
function normalizeLifecyclePatch(patch = {}) {
    const out = {};
    if (patch.state !== undefined) {
        if (!STATES.includes(patch.state)) throw new Error(`invalid state: ${patch.state}`);
        out.state = patch.state;
    }
    if (patch.archived !== undefined) out.archived = Boolean(patch.archived);
    for (const k of ['activeFromChapter', 'activeToChapter']) {
        if (patch[k] !== undefined) {
            const n = Number(patch[k]);
            out[k] = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        }
    }
    if (out.activeFromChapter && out.activeToChapter && out.activeToChapter < out.activeFromChapter) {
        throw new Error('activeToChapter 不能早于 activeFromChapter');
    }
    return out;
}

module.exports = { STATES, chapterOf, isMaterialActiveAt, lifecycleLabel, normalizeLifecyclePatch };
