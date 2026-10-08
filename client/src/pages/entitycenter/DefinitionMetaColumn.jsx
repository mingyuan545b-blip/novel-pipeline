/**
 * DefinitionMetaColumn.jsx — 定义详情的「元数据块」（装备/功法/线索共用）
 * 稀有度 · 来源章节 · 素材类型 · 标签（英文标签统一翻译为中文）。
 * 值优先取定义行，缺失时回落同名素材（合并过程中的过渡态）。
 */
import { RARITY_LABELS, MATERIAL_TYPE_LABELS, tagLabel } from './constants';
import { buildProvenanceRows } from './materialProvenanceView';
import s from './definitionMeta.module.css';

export default function DefinitionMetaColumn({ item, material }) {
    const rarity = item.rarity || material?.rarity;
    const matType = material?.type ? MATERIAL_TYPE_LABELS[material.type] : null;
    const tags = (Array.isArray(item.tags) && item.tags.length ? item.tags : material?.tags) || [];
    // T2：定位信息改为"创建/最近更新/出身/创建时间"（含存量推断标注）
    const provRows = buildProvenanceRows(item, material);
    const rows = [
        ['稀有度', RARITY_LABELS[rarity]],
        ...provRows,
        ['素材类型', matType],
    ].filter(([, v]) => v);

    if (rows.length === 0 && tags.length === 0) return null;
    return (
        <div className={s.metaCol}>
            <div className={s.metaHead}>元数据</div>
            <div className={s.metaWrap}>
                {rows.map(([k, v]) => (
                    <span key={k} className={s.metaChip}>
                        <span className={s.metaKey}>{k}</span>
                        <span className={s.metaVal}>{v}</span>
                    </span>
                ))}
                {tags.map(t => <span key={t} className={s.tag}>{tagLabel(t)}</span>)}
            </div>
        </div>
    );
}
