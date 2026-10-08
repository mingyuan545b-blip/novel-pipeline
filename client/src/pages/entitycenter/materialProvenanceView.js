/**
 * materialProvenanceView — 素材出身展示（纯函数，可测）
 *
 * 回答用户问题："这条素材什么时间、第几章、由什么生成的？"
 * 数据源：material.provenance（T2 新增的不可变出身）+ sourceChapter/lastUpdatedChapter 回落。
 * 注意：provenance.source === 'inferred-from-legacy' 表示该出身是**存量推断**，UI 必须标注。
 */
export const ORIGIN_LABELS = {
    outline: '建项生成',
    chapter: '正文提取',
    import: '导入/继承',
    manual: '手工新增',
    unknown: '未知',
};

const pad = (n) => String(n).padStart(2, '0');

export function formatProvenanceTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 章节号 → 展示文本；0 表示"建项时生成，不属于任何章节" */
export function chapterLabel(chapter) {
    if (chapter === null || chapter === undefined || chapter === '') return '';
    const n = Number(chapter);
    if (!Number.isFinite(n)) return '';
    return n > 0 ? `第${n}章` : '建项时';
}

/**
 * 构建元数据行：[标签, 值]
 * @returns {Array<[string,string]>} 已过滤空值
 */
export function buildProvenanceRows(item, material) {
    const prov = material?.provenance || {};
    const createdChapter = prov.createdChapter ?? material?.sourceChapter ?? item?.sourceChapter;
    const lastChapter = material?.lastUpdatedChapter ?? material?.lastAppearChapter;
    const inferred = prov.source === 'inferred-from-legacy';
    const suffix = inferred ? '（推断）' : '';

    const rows = [
        ['创建', chapterLabel(createdChapter) ? chapterLabel(createdChapter) + suffix : ''],
        ['最近更新', chapterLabel(lastChapter)],
        ['出身', ORIGIN_LABELS[prov.origin] || ''],
        ['创建时间', formatProvenanceTime(prov.createdAt)],
    ];
    return rows.filter(([, v]) => v);
}
