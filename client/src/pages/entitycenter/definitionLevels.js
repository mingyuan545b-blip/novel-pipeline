/**
 * definitionLevels.js — 定义的「信息密度分级」与「阶段寻址」纯函数
 *
 * 设计意图（用户诉求）：
 *  - 卡片/摘要只提供「概要」，不堆全量数据；需要时按密度载入对应版本，避免不同场景
 *    需要的数据密度不同却被迫全量加载。
 *  - 装备/功法按「阶段」演进：每一阶段属性/特效可能完全不同（如每一层功法新特效）。
 *    概要保存指向「当前阶段」的地址，点击某个阶段才载入该阶段的详细数据。
 * 数据来源：item-definitions 的 brief/summary/detail/lore 四级描述 + propertiesJson.{currentStage,attributes,stages}。
 */

export const DENSITY_LEVELS = [
    { key: 'brief', label: '概要', field: 'briefDesc', tokenField: 'briefTokens', hint: '一句话 · 常规行文引用' },
    { key: 'summary', label: '摘要', field: 'summaryDesc', tokenField: 'summaryTokens', hint: '中等密度 · 交代关键设定' },
    { key: 'detail', label: '详细', field: 'detailDesc', tokenField: 'detailTokens', hint: '完整设定 · 关键剧情' },
    { key: 'lore', label: '设定', field: 'loreDesc', tokenField: 'loreTokens', hint: '背景沿革 · 按需加载' },
];

/** 素材正文本体：双存止血后定义行只留 materialId，内容 SSOT 在素材 description/currentContent */
export function materialBodyText(material) {
    return material?.description || material?.currentContent || material?.initialContent || '';
}

/** 该定义可用的密度层级（含文本与 token 估算）
 *  定义行四级描述为空时（素材托管型装备/功法），「概要」回落到素材正文，
 *  避免详情栏只剩一句"暂无描述 / 暂无分阶段数据"。 */
export function densitiesOf(item, material) {
    const bodyText = materialBodyText(material);
    return DENSITY_LEVELS.map(l => {
        let text = item?.[l.field] || material?.[l.field] || '';
        if (!text && l.key === 'brief') text = bodyText;
        return { key: l.key, label: l.label, hint: l.hint, text, tokens: item?.[l.tokenField] || 0, available: !!text };
    });
}

export const defaultDensityKey = densities => (densities.find(d => d.available) || densities[0] || {}).key || 'brief';

export function densityText(densities, key) {
    const d = densities.find(x => x.key === key) || densities[0];
    return d?.text || '暂无描述';
}

/** propertiesJson.stages → 规范化阶段数组 */
export function stagesOf(item) {
    const raw = item?.propertiesJson?.stages;
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((s, i) => ({
        key: s.key || s.id || `stage-${i}`,
        label: s.label || s.name || `阶段 ${i + 1}`,
        chapter: s.chapter ?? s.sourceChapter ?? null,
        attributes: s.attributes || s.props || s.stats || {},
        effects: Array.isArray(s.effects) ? s.effects : (s.effects ? [s.effects] : []),
        desc: s.desc || s.description || '',
    }));
}

/** propertiesJson.attributes → 当前阶段属性键值对 */
export function attributesOf(item) {
    const a = item?.propertiesJson?.attributes;
    return a && typeof a === 'object' ? a : {};
}

/** 当前阶段：优先显式 currentStage，其次按章节落到最近的阶段 */
export function resolveStageKey(item, stages, currentChapter) {
    if (!stages.length) return null;
    const cur = item?.propertiesJson?.currentStage;
    const hit = stages.find(s => s.key === cur || s.label === cur);
    if (hit) return hit.key;
    const ch = Number(currentChapter);
    if (Number.isFinite(ch) && ch > 0) {
        const passed = stages.filter(s => Number(s.chapter) > 0 && Number(s.chapter) <= ch);
        if (passed.length) return passed[passed.length - 1].key;
    }
    return stages[0].key;
}

export function hasGrowthData(item) {
    return stagesOf(item).length > 0 || Object.keys(attributesOf(item)).length > 0;
}
