/**
 * MapNode.jsx — 思维导图节点渲染
 * 根节点/超级分组/二级分支/叶子节点 四种类型
 * 分支节点点击展开/收起，深度开关集成在节点内
 */
import { useState } from 'react';
import n from './MindMapNodes.module.css';

const STATUS_CLASSES = { healthy: n.statusLightHealthy, warning: n.statusLightWarning, error: n.statusLightError, empty: n.statusLightEmpty };
const GROUP_STATUS = { healthy: n.groupNodeHealthy, warning: n.groupNodeWarning, error: n.groupNodeError, empty: n.groupNodeEmpty };
const DEPTH_CLASSES = { L0: n.depthL0, L1: n.depthL1, L2: n.depthL2, L3: n.depthL3, L4: n.depthL4 };

export default function MapNode({ node, isSelected, isExpanded, onSelect, onToggle, onSetDepth }) {
    const statusClass = STATUS_CLASSES[node.status] || n.statusLightEmpty;

    if (node.type === 'root') {
        return (
            <div className={n.rootNode} style={{ left: node.x, top: node.y - 30 }} onClick={onSelect}>
                <div className={n.rootLabel}>{node.icon} {node.label}</div>
            </div>
        );
    }

    if (node.type === 'super-group') {
        return (
            <div className={`${n.groupNode} ${GROUP_STATUS[node.status] || ''}`}
                style={{ left: node.x, top: node.y - 28 }} onClick={onSelect}>
                <div className={n.groupHeader}>
                    <span className={`${n.statusLight} ${statusClass}`} />
                    <span className={n.groupIcon}>{node.icon}</span>
                    <span className={n.groupLabel}>{node.label}</span>
                </div>
                {node.tagClass && <span className={`${n.groupTag} ${n[node.tagClass]}`}>{node.childCount}个子类</span>}
            </div>
        );
    }

    if (node.type === 'group') {
        return (
            <div className={`${n.groupNode} ${GROUP_STATUS[node.status] || ''} ${isSelected ? n.groupNodeSelected : ''}`}
                style={{ left: node.x, top: node.y - 28 }} onClick={onToggle}>
                <div className={n.groupHeader}>
                    <span className={`${n.statusLight} ${statusClass}`} />
                    <span className={n.groupIcon}>{node.icon}</span>
                    <span className={n.groupLabel}>{node.label}</span>
                </div>
                {node.description && <div className={n.groupDesc}>{node.description}</div>}
                <div className={n.groupMeta}>
                    {node.itemCount !== undefined && <span className={n.groupCount}>{node.itemCount}项</span>}
                    {node.depth && <span className={`${n.groupDepth} ${DEPTH_CLASSES[node.depth] || n.depthL0}`}
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}>{node.depth}</span>}
                    <span className={`${n.expandHint} ${isExpanded ? n.expandHintExpanded : ''}`}>
                        {isExpanded ? '▾ 收起' : '▸ 展开'}
                    </span>
                </div>
                {isSelected && onSetDepth && (
                    <InlineDepthSelector currentDepth={node.depth} onSetDepth={(d) => onSetDepth(node.id, d)} />
                )}
            </div>
        );
    }

    // leaf
    return (
        <div className={`${n.leafNode} ${isSelected ? n.leafNodeSelected : ''}`}
            style={{ left: node.x, top: node.y - 14 }} onClick={onSelect}>
            <div className={n.leafContent}>
                <span className={`${n.statusLight} ${statusClass}`} style={{ width: 8, height: 8 }} />
                <span className={n.leafIcon}>{node.icon}</span>
                <span className={n.leafName}>{node.label}</span>
                {node.hasOverride && <span className={n.leafOverride}>覆盖</span>}
                {node.depth && <span className={`${n.leafDepth} ${DEPTH_CLASSES[node.depth] || n.depthL0}`}>{node.depth}</span>}
            </div>
        </div>
    );
}

/** 节点内嵌深度选择器 */
function InlineDepthSelector({ currentDepth, onSetDepth }) {
    const [open, setOpen] = useState(false);
    const levels = [
        { key: 'L0', label: '索引' }, { key: 'L1', label: '简要' },
        { key: 'L2', label: '摘要' }, { key: 'L3', label: '完整' }, { key: 'L4', label: '原始' },
    ];
    return (
        <div className={n.inlineDepth}>
            <span className={n.inlineDepthTrigger} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
                深度: {currentDepth || '—'} ▾
            </span>
            {open && (
                <div className={n.inlineDepthMenu} onClick={(e) => e.stopPropagation()}>
                    {levels.map(l => (
                        <button key={l.key}
                            className={`${n.inlineDepthBtn} ${currentDepth === l.key ? n.inlineDepthBtnActive : ''}`}
                            onClick={() => { onSetDepth(l.key); setOpen(false); }}>
                            {l.key} {l.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
