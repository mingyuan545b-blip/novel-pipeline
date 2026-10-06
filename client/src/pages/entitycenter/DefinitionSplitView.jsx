/**
 * DefinitionSplitView.jsx — 定义「列表 + 详情」双栏（仿素材库 树+编辑 布局）
 * 左：分类浏览器；右：选中条目的统一详情（描述 / 元数据 / 绑定 / 生命周期编辑）。
 */
import { useState } from 'react';
import s from './definitionMeta.module.css';

export default function DefinitionSplitView({ items, browserOf, detailOf, emptyIcon = '📄' }) {
    const [selectedId, setSelectedId] = useState(null);
    const selected = items.find(i => i.id === selectedId) || null;
    return (
        <div className={s.split}>
            <div className={s.splitList}>{browserOf({ selectedId, onSelect: setSelectedId })}</div>
            <aside className={s.splitPane}>
                {selected ? <div key={selected.id}>{detailOf(selected)}</div> : (
                    <div className="cyber-card cyber-empty">
                        <div className="cyber-empty-icon" aria-hidden="true">{emptyIcon}</div>
                        <div>点左侧卡片查看定义详情</div>
                    </div>
                )}
            </aside>
        </div>
    );
}
