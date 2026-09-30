/**
 * BookCard — 藏经阁左栏树节点
 *
 * 样式全部走 CSS Module（不再内联），配合 library.module.css 的分层视觉。
 * 条目渲染见 TechListItem.jsx（带内容完整度徽标）。
 */
import s from './library.module.css';

export function TreeNode({ label, icon, color, count, expanded, onToggle, children, depth = 0 }) {
    return (
        <div className={s.treeNode} style={{ paddingLeft: depth * 14 }}>
            <button type="button" className={`${s.treeRow} ${expanded ? s.treeRowOpen : ''}`} onClick={onToggle}>
                <span className={`${s.treeArrow} ${expanded ? s.treeArrowOpen : ''}`}>▶</span>
                {icon && <span className={s.treeIcon}>{icon}</span>}
                <span className={s.treeLabel} style={color ? { color } : undefined}>{label}</span>
                {count !== undefined && <span className={s.treeCount}>{count}</span>}
            </button>
            {expanded && <div className={s.treeChildren}>{children}</div>}
        </div>
    );
}

export default TreeNode;
