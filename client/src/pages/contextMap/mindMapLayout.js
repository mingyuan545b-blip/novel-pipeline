/**
 * mindMapLayout.js — 思维导图布局计算
 * 根→超级分组→二级分支→叶子节点 四层从左到右展开
 * 世界观3层：宏观·底层规则 / 中观·势力与地理 / 微观·细节补充
 * 角色3层：主角·核心设定 / 配角与反派 / 人物关系网
 */
const GROUP_GAP_X = 220;
const GROUP_GAP_Y = 90;
const LEAF_GAP_Y = 36;
const ROOT_X = 60;
const LEAF_START_X = 440;

/** 超级分组：10个分支合并为5大组 */
const SUPER_GROUPS = [
    { key: 'worldview', label: '世界观', icon: '🌍', tagClass: 'tagWorldview',
      childKeys: ['worldview-macro', 'worldview-meso', 'worldview-micro'] },
    { key: 'character', label: '角色', icon: '👤', tagClass: 'tagCharacter',
      childKeys: ['character-protagonist', 'character-supporting', 'character-relationship'] },
    { key: 'bindable', label: '装备/功法', icon: '🗡', tagClass: 'tagBindable',
      childKeys: ['equipment', 'technique'] },
    { key: 'foreshadowing', label: '伏笔', icon: '🪝', tagClass: 'tagForeshadowing',
      childKeys: ['foreshadowing'] },
    { key: 'knowledge', label: '知识库', icon: '📚', tagClass: 'tagKnowledge',
      childKeys: ['knowledge-access'] },
];

export function computeLayout(root, expandedBranches, categoryFilters) {
    if (!root || !root.children) return { nodes: [], connections: [], canvasSize: { w: 1200, h: 800 } };

    const nodes = [];
    const connections = [];
    const filteredChildren = root.children.filter(c => categoryFilters[c.id]);

    const groups = SUPER_GROUPS.map(sg => ({
        ...sg,
        branches: sg.childKeys.map(key => filteredChildren.find(c => c.id === key)).filter(Boolean),
    })).filter(g => g.branches.length > 0);

    const totalHeight = _calcTotalHeight(groups, expandedBranches);
    const canvasW = Math.max(1200, LEAF_START_X + 300);
    const canvasH = Math.max(800, totalHeight + 120);
    const rootY = canvasH / 2;

    nodes.push({ id: root.id, type: 'root', label: root.label, icon: '📁', x: ROOT_X, y: rootY, status: root.status });

    let currentY = rootY - totalHeight / 2;
    for (const group of groups) {
        const groupHeight = _calcGroupHeight(group, expandedBranches);
        const groupCenterY = currentY + groupHeight / 2;
        const groupNodeX = ROOT_X + GROUP_GAP_X;

        nodes.push({
            id: `sg-${group.key}`, type: 'super-group', label: group.label, icon: group.icon,
            tagClass: group.tagClass, childCount: group.branches.length,
            x: groupNodeX, y: groupCenterY, status: _worstStatus(group.branches),
        });
        connections.push({ from: { x: ROOT_X + 160, y: rootY }, to: { x: groupNodeX, y: groupCenterY }, status: _worstStatus(group.branches) });

        let branchY = currentY;
        for (const branch of group.branches) {
            const isExpanded = expandedBranches.has(branch.id);
            const branchHeight = _calcBranchHeight(branch, isExpanded);
            const branchCenterY = branchY + branchHeight / 2;
            const branchX = groupNodeX + GROUP_GAP_X;

            nodes.push({
                id: branch.id, type: 'group', label: branch.label, icon: branch.icon,
                x: branchX, y: branchCenterY, status: branch.status,
                depth: branch.depth, itemCount: branch.itemCount, defaultDepth: branch.defaultDepth,
                description: branch.description || null,
            });
            connections.push({ from: { x: groupNodeX + 130, y: groupCenterY }, to: { x: branchX, y: branchCenterY }, status: branch.status });

            if (isExpanded && branch.children && branch.children.length > 0) {
                let leafY = branchCenterY - (branch.children.length - 1) * LEAF_GAP_Y / 2;
                for (const leaf of branch.children) {
                    const leafX = branchX + GROUP_GAP_X;
                    nodes.push({
                        id: leaf.id, type: 'leaf', label: leaf.label, icon: leaf.icon,
                        x: leafX, y: leafY, status: leaf.status, depth: leaf.depth,
                        hasOverride: leaf.hasOverride, overrideId: leaf.overrideId,
                        wordCount: leaf.wordCount, parentBranchId: branch.id,
                    });
                    connections.push({ from: { x: branchX + 130, y: branchCenterY }, to: { x: leafX, y: leafY }, status: leaf.status });
                    leafY += LEAF_GAP_Y;
                }
            }
            branchY += branchHeight;
        }
        currentY += groupHeight + 20;
    }

    return { nodes, connections, canvasSize: { w: canvasW, h: canvasH } };
}

function _calcTotalHeight(groups, expandedBranches) {
    let total = 0;
    for (const g of groups) total += _calcGroupHeight(g, expandedBranches) + 20;
    return Math.max(0, total - 20);
}

function _calcGroupHeight(group, expandedBranches) {
    let h = 0;
    for (const b of group.branches) h += _calcBranchHeight(b, expandedBranches.has(b.id));
    return Math.max(GROUP_GAP_Y, h);
}

function _calcBranchHeight(branch, isExpanded) {
    if (!isExpanded || !branch.children || branch.children.length === 0) return GROUP_GAP_Y;
    return Math.max(GROUP_GAP_Y, branch.children.length * LEAF_GAP_Y + 20);
}

function _worstStatus(branches) {
    if (branches.some(b => b.status === 'error')) return 'error';
    if (branches.some(b => b.status === 'warning')) return 'warning';
    if (branches.some(b => b.status === 'healthy')) return 'healthy';
    return 'empty';
}

export function curvePath(from, to) {
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

export { SUPER_GROUPS };
