import { useState } from 'react';
import { TAB_GROUPS } from './constants';
import './treeSidebar.css';

/**
 * 思维导图式层级侧边栏
 * 一级分支：4个实体分组（角色世界/物品装备/世界关系/追踪系统）
 * 二级分支：具体Tab项
 */
export default function TreeSidebar({ activeTab, onTabChange }) {
    // 默认展开包含activeTab的分组
    const initialExpanded = new Set();
    for (const g of TAB_GROUPS) {
        if (g.children.some(c => c.key === activeTab)) initialExpanded.add(g.id);
    }
    const [expanded, setExpanded] = useState(initialExpanded);

    const toggleGroup = (groupId) => {
        const next = new Set(expanded);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        setExpanded(next);
    };

    return (
        <nav className="ec-tree-sidebar" aria-label="实体分类导航">
            {TAB_GROUPS.map(group => {
                const isExpanded = expanded.has(group.id);
                const hasActive = group.children.some(c => c.key === activeTab);
                return (
                    <div key={group.id} className={`ec-tree-group ${hasActive ? 'ec-tree-group-active' : ''}`}>
                        <button
                            className="ec-tree-group-header"
                            onClick={() => toggleGroup(group.id)}
                            style={{ borderLeftColor: group.color }}
                            aria-expanded={isExpanded}
                        >
                            <span className="ec-tree-group-icon" aria-hidden="true">{group.icon}</span>
                            <span className="ec-tree-group-label">{group.label}</span>
                            <span className={`ec-tree-arrow ${isExpanded ? 'ec-tree-arrow-open' : ''}`} aria-hidden="true">▸</span>
                        </button>
                        {isExpanded && (
                            <ul className="ec-tree-children" role="group">
                                {group.children.map(child => (
                                    <li key={child.key}>
                                        <button
                                            className={`ec-tree-leaf ${activeTab === child.key ? 'ec-tree-leaf-active' : ''}`}
                                            onClick={() => onTabChange(child.key)}
                                            aria-selected={activeTab === child.key}
                                            role="tab"
                                        >
                                            <span className="ec-tree-leaf-icon" aria-hidden="true">{child.icon}</span>
                                            <span className="ec-tree-leaf-label">{child.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
