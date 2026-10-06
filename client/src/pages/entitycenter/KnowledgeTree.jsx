/**
 * KnowledgeTree.jsx — 限知树状视图（一级节点 → 二级分组 → 叶子记录）
 *
 * 两种轴共用同一渲染：entity 轴一级=人物、二级=确信度；event 轴一级=事件、二级=获知渠道。
 * 折叠状态用「全局默认 + 逐节点翻转」表达，避免依赖会失效的 key 集合。
 */
import { useState } from 'react';
import s from './knowledge.module.css';

function Caret({ open }) {
    return <span className={s.caret} aria-hidden="true">{open ? '▾' : '▸'}</span>;
}

export default function KnowledgeTree({ nodes, axis, renderLeaf }) {
    const [defaultOpen, setDefaultOpen] = useState(true);
    const [toggled, setToggled] = useState(() => new Set());

    const isOpen = key => (defaultOpen ? !toggled.has(key) : toggled.has(key));
    const flip = key => setToggled(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });
    const expandAll = () => { setToggled(new Set()); setDefaultOpen(true); };
    const collapseAll = () => { setToggled(new Set()); setDefaultOpen(false); };

    const l1Name = axis === 'entity' ? '人物' : '事件';
    const l2Name = axis === 'entity' ? '确信 / 怀疑' : '获知渠道';

    if (!nodes.length) return null;

    return (
        <div className={s.tree}>
            <div className={s.treeTools}>
                <span className="ec-text-11 ec-text-muted">
                    一级 = {l1Name} · 二级 = {l2Name} · 点击标题展开 / 收起
                </span>
                <span className="ec-ml-auto ec-flex ec-gap-6">
                    <button className="cyber-btn cyber-btn-sm ec-text-11" onClick={expandAll}>展开全部</button>
                    <button className="cyber-btn cyber-btn-sm ec-text-11" onClick={collapseAll}>折叠全部</button>
                </span>
            </div>

            {nodes.map(node => {
                const rootOpen = isOpen(node.key);
                return (
                    <div key={node.key} className={s.treeRoot}>
                        <button className={`${s.treeHead} ${rootOpen ? s.treeHeadOpen : ''}`}
                            onClick={() => flip(node.key)} aria-expanded={rootOpen}>
                            <Caret open={rootOpen} />
                            {node.color && <span className={s.treeDot} style={{ background: node.color }} />}
                            {node.categoryLabel && <span className={s.treeCat}>{node.categoryLabel}</span>}
                            <span className={`ec-text-13 ec-font-600 ec-ellipsis ${s.treeLabel}`}>{node.label}</span>
                            <span className={s.treeCount}>{node.count}</span>
                        </button>

                        {rootOpen && (
                            <div className={s.treeChildren}>
                                {node.children.map(child => {
                                    const childOpen = isOpen(child.key);
                                    return (
                                        <div key={child.key} className={s.treeGroup}>
                                            <button className={s.treeSubHead} onClick={() => flip(child.key)} aria-expanded={childOpen}>
                                                <Caret open={childOpen} />
                                                {child.color && <span className={s.treeDotSm} style={{ background: child.color }} />}
                                                <span className={`ec-text-12 ec-font-600 ${s.treeSubLabel}`}>{child.label}</span>
                                                <span className={s.treeCount}>{child.count}</span>
                                            </button>
                                            {childOpen && (
                                                <div className={s.treeLeaves}>
                                                    {child.records.map(r => renderLeaf(r))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
