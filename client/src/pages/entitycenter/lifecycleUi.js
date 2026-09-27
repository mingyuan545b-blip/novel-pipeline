/**
 * lifecycleUi.js — 素材生命周期的前端展示（与后端 materialLifecycle 语义一致）
 */
export const chapterOf = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };

export function isRetired(m) { return !m ? false : (m.archived === true || m.state === 'retired'); }

export function lifecycleLabel(m) {
    if (!m) return '—';
    if (isRetired(m)) return '已归档/报废';
    if (m.state === 'suspended') return '暂停';
    const from = chapterOf(m.activeFromChapter), to = chapterOf(m.activeToChapter);
    if (from || to) return `第${from || 1}–${to || '∞'}章`;
    return '常驻';
}
