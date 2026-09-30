/**
 * LibraryTree — 藏经阁左栏树（部门视图 / 深度视图）
 *
 * 两套视图共用同一份数据（服务端已按"有内容优先"排序），只是分组维度不同。
 */
import { TreeNode } from './BookCard';
import TechListItem from './TechListItem';
import { DEPT_ICONS, DEPT_COLORS, DEPTH_LABELS, DEPTH_COLORS, cleanName } from './useLibraryState';
import s from './library.module.css';

const DEPTH_ICONS = { macro: '🏛️', meso: '⚙️', micro: '🔍' };

function itemCount(subs) {
    return Object.values(subs).reduce((sum, arr) => sum + arr.length, 0);
}

function LeafList({ items, selectedTech, onSelect }) {
    return items.map(item => (
        <TechListItem key={item.id} tech={item} selected={selectedTech === item.id} onClick={() => onSelect(item.id)} />
    ));
}

export default function LibraryTree({ viewMode, treeData, depthTree, expandedNodes, toggleNode, selectedTech, onSelect }) {
    if (viewMode === 'depth') {
        return Object.entries(depthTree).map(([depth, depts]) => (
            <TreeNode key={depth} label={DEPTH_LABELS[depth] || depth} icon={DEPTH_ICONS[depth]}
                color={DEPTH_COLORS[depth]} count={Object.values(depts).reduce((a, subs) => a + itemCount(subs), 0)}
                expanded={expandedNodes.has(depth)} onToggle={() => toggleNode(depth)}>
                {Object.entries(depts).map(([dept, subs]) => (
                    <TreeNode key={dept} label={cleanName(dept)} icon={DEPT_ICONS[dept]} color={DEPT_COLORS[dept]}
                        count={itemCount(subs)} expanded={expandedNodes.has(`${depth}/${dept}`)}
                        onToggle={() => toggleNode(`${depth}/${dept}`)} depth={1}>
                        {Object.entries(subs).map(([sub, items]) => (
                            <TreeNode key={sub} label={cleanName(sub)} count={items.length}
                                expanded={expandedNodes.has(`${depth}/${dept}/${sub}`)}
                                onToggle={() => toggleNode(`${depth}/${dept}/${sub}`)} depth={2}>
                                <LeafList items={items} selectedTech={selectedTech} onSelect={onSelect} />
                            </TreeNode>
                        ))}
                    </TreeNode>
                ))}
            </TreeNode>
        ));
    }

    const empty = Object.keys(treeData).length === 0;
    if (empty) return <div className={s.emptyTip}>当前筛选下没有技法，换个条件试试</div>;

    return Object.entries(treeData).map(([dept, subs]) => (
        <TreeNode key={dept} label={cleanName(dept)} icon={DEPT_ICONS[dept]} color={DEPT_COLORS[dept]}
            count={itemCount(subs)} expanded={expandedNodes.has(dept)} onToggle={() => toggleNode(dept)}>
            {Object.entries(subs).map(([sub, items]) => (
                <TreeNode key={sub} label={cleanName(sub)} count={items.length}
                    expanded={expandedNodes.has(`${dept}/${sub}`)} onToggle={() => toggleNode(`${dept}/${sub}`)} depth={1}>
                    <LeafList items={items} selectedTech={selectedTech} onSelect={onSelect} />
                </TreeNode>
            ))}
        </TreeNode>
    ));
}
