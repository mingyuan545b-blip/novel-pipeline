/* eslint-disable react-refresh/only-export-components */
/**
 * CharSummaryCard.jsx — 角色摘要卡（紧凑折叠）
 *
 * 设计：默认只显示「概要」（非运行态代表字段 + 字段数 + 运行态计数），点击才展开详细字段。
 * 卡底展示「引用地址」，说明摘要只是指向状态库的引用，详细版本按需载入。
 */
import { useMemo, useState } from 'react';
import { classifyFields, previewFields, countRuntime, fieldCount } from './summaryGroups';
import s from './summary.module.css';

function parseCharacterBlock(text) {
    if (!text || text === '暂无数据' || text === '暂无角色数据') return [];
    const blocks = [];
    const lines = text.split('\n').filter(l => l.trim());
    let current = null;
    for (const line of lines) {
        const headerMatch = line.match(/【(.+?)】(.*)/);
        if (headerMatch) {
            if (current) blocks.push(current);
            current = { name: headerMatch[1], fields: {}, inlineParts: headerMatch[2]?.trim() || '' };
            if (current.inlineParts) {
                for (const part of current.inlineParts.split(', ')) {
                    const kv = part.match(/(.+?)=(.+)/);
                    if (kv) current.fields[kv[1].trim()] = kv[2].trim();
                }
            }
        } else if (current) {
            const kv = line.match(/(.+?)[:：]\s*(.+)/);
            if (kv) current.fields[kv[1].trim()] = kv[2].trim();
        }
    }
    if (current) blocks.push(current);
    return blocks;
}

export default function CharSummaryCard({ block, index, chapter, source }) {
    const [open, setOpen] = useState(false);
    const groups = useMemo(() => classifyFields(block.fields), [block.fields]);
    const preview = useMemo(() => previewFields(block.fields, 3), [block.fields]);
    const runtime = countRuntime(block.fields);
    const total = fieldCount(block.fields);
    const refSrc = source === 'entity' ? '实体注册表' : '状态库';

    return (
        <div className={`cyber-card ${s.card}`} style={{ animationDelay: `${index * 40}ms` }}>
            <button type="button" className={s.head} onClick={() => setOpen(o => !o)} aria-expanded={open}>
                <span className={s.name}>{block.name}</span>
                {runtime > 0 && <span className={`ec-badge ec-badge-orange ${s.badge}`}>运行态 {runtime}</span>}
                <span className={s.count}>{total} 项</span>
                <span className={s.chevron} aria-hidden="true">{open ? '收起 ▲' : '展开 ▼'}</span>
            </button>

            {preview.length > 0 ? (
                <div className={s.preview}>
                    {preview.map(([k, v]) => (
                        <span key={k} className={s.chip}><span className={s.chipK}>{k}</span><span className={s.chipV}>{v}</span></span>
                    ))}
                    {total > preview.length && <span className={s.more}>＋{total - preview.length}</span>}
                </div>
            ) : (
                <div className={s.empty}>暂无设定摘要{total > 0 ? '（仅运行态字段）' : ''}</div>
            )}

            {open && (
                <div className={s.detail}>
                    {groups.map(g => (
                        <div key={g.key} className={s.group}>
                            <div className={s.groupHead} style={{ color: g.color }}>
                                {g.label}
                                {g.hint && <span className={s.groupHint}>{g.hint}</span>}
                            </div>
                            <div className={s.fields}>
                                {g.items.map(([k, v]) => (
                                    <div key={k} className={s.field} style={{ borderLeftColor: g.color }}>
                                        <span className={s.fieldK}>{k}</span>
                                        <span className={s.fieldV}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className={s.ref} title="摘要只保存指向状态库的引用地址；详细版本在需要时按密度载入">
                ⤷ 引用 {refSrc}{chapter ? ` · 第${chapter}章` : ''}
            </div>
        </div>
    );
}

export { parseCharacterBlock };
