import { useMemo } from 'react';
import { MATERIAL_TYPE_LABELS, MATERIAL_TYPE_ICONS, ARCHIVE_STATUS_COLORS, buildDomainTree } from './materialConstants';
import VirtualList from '../../components/VirtualList';
import styles from './MaterialTreePanel.module.css';

const INDENT = 20;

export default function MaterialTreePanel({
    filteredMaterials, selectedMaterialId, selectMaterial,
    collapsedTypes, setCollapsedTypes, expandedPlanes, setExpandedPlanes
}) {
    const domainTree = buildDomainTree(filteredMaterials);

    const flatItems = useMemo(() => {
        const items = [];
        const { mainWorld, subPlanes, craftRules } = domainTree;
        const mwFactions = Object.values(mainWorld.factions);
        const mwOthersByType = mainWorld.othersByType || {};
        const mwTotal = mwFactions.length + Object.values(mwOthersByType).reduce((s, arr) => s + arr.length, 0);

        items.push({ type: 'section', key: '__mw__', label: '主世界', count: mwTotal, collapsedKey: '__mw__' });
        if (!collapsedTypes.has('__mw__')) {
            mwFactions.forEach(fac => {
                items.push({ type: 'faction', key: fac.id, data: fac, depth: 0, facKey: `fac-${fac.id}` });
                if (expandedPlanes.has(`fac-${fac.id}`) && fac.characters?.length > 0) {
                    fac.characters.forEach(chr => {
                        items.push({ type: 'material', key: chr.id, data: chr, depth: 1, fontSize: 12, color: 'var(--text-secondary)' });
                    });
                }
            });
            Object.entries(mwOthersByType).forEach(([type, mats]) => {
                items.push({ type: 'typeHeader', key: `mw-type-${type}`, label: `${MATERIAL_TYPE_LABELS[type] || type}`, count: mats.length, depth: 0 });
                mats.forEach(m => items.push({ type: 'material', key: m.id, data: m, depth: 1, fontSize: 12 }));
            });
        }

        if (subPlanes.length > 0) {
            items.push({ type: 'section', key: '__sp__', label: '次位面', count: subPlanes.length, collapsedKey: '__sp__' });
            if (!collapsedTypes.has('__sp__')) {
                subPlanes.forEach(plane => {
                    const facCount = Object.keys(plane.factions).length;
                    const otherCount = plane.others ? plane.others.length : 0;
                    const itemCount = plane.items ? plane.items.length : 0;
                    items.push({ type: 'subPlane', key: plane.id, data: plane, depth: 0, total: facCount + otherCount + itemCount, isLocked: plane.isLocked });
                    if (expandedPlanes.has(plane.id)) {
                        Object.values(plane.factions).forEach(fac => {
                            items.push({ type: 'faction', key: fac.id, data: fac, depth: 1, facKey: `fac-${fac.id}` });
                            if (expandedPlanes.has(`fac-${fac.id}`) && fac.characters?.length > 0) {
                                fac.characters.forEach(chr => items.push({ type: 'material', key: chr.id, data: chr, depth: 2, fontSize: 12, color: 'var(--text-secondary)' }));
                            }
                        });
                        if (plane.others) plane.others.forEach(m => items.push({ type: 'material', key: m.id, data: m, depth: 1 }));
                        if (itemCount > 0) items.push({ type: 'itemsList', key: `${plane.id}-items`, data: plane.items, depth: 1 });
                    }
                });
            }
        }

        if (craftRules && craftRules.total > 0) {
            items.push({ type: 'section', key: '__craft__', label: '✍️ 创作规范', count: craftRules.total, collapsedKey: '__craft__' });
            if (!collapsedTypes.has('__craft__')) {
                Object.entries(craftRules.byType).forEach(([type, mats]) => {
                    items.push({ type: 'typeHeader', key: `craft-type-${type}`, label: `${MATERIAL_TYPE_LABELS[type] || type}`, count: mats.length, depth: 0 });
                    mats.forEach(m => items.push({ type: 'material', key: m.id, data: m, depth: 1, fontSize: 12 }));
                });
            }
        }
        return items;
    }, [domainTree, collapsedTypes, expandedPlanes]);

    const toggleSection = (key) => setCollapsedTypes(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const toggleExpand = (key) => setExpandedPlanes(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

    const renderItem = (item) => {
        if (item.type === 'section') {
            const isCollapsed = collapsedTypes.has(item.collapsedKey);
            return (
                <div onClick={() => toggleSection(item.collapsedKey)}
                    className={`${styles.section} ${isCollapsed ? '' : styles.sectionExpanded}`}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = isCollapsed ? 'transparent' : 'var(--bg-secondary)'}>
                    <span className={`${styles.sectionArrow} ${isCollapsed ? styles.sectionArrowCollapsed : styles.sectionArrowExpanded}`}>▼</span>
                    <span>{item.label}</span>
                    <span className={styles.sectionCount}>{item.count}</span>
                </div>
            );
        }
        if (item.type === 'faction') {
            const fac = item.data;
            const isFacOpen = expandedPlanes.has(item.facKey);
            const hasChars = fac.characters && fac.characters.length > 0;
            const isSelected = selectedMaterialId === fac.id;
            return (
                <div className={styles.treeBranch} style={{ marginLeft: INDENT + item.depth * INDENT + 6 }}>
                    <div className={`${styles.treeRow} ${isSelected ? styles.treeRowSelected : ''}`} style={{ padding: `5px 10px 5px ${INDENT + item.depth * INDENT}px` }}>
                        {hasChars ? <span onClick={e => { e.stopPropagation(); toggleExpand(item.facKey); }} className={`${styles.treeArrow} ${isFacOpen ? styles.treeArrowExpanded : styles.treeArrowCollapsed}`}>▼</span> : <span className={styles.treeArrowPlaceholder} />}
                        <span onClick={() => selectMaterial(fac.id)} className={styles.treeContent}>
                            <span className={styles.treeIcon}>🏛</span>
                            <span className={styles.treeName}>{fac.name}</span>
                            {hasChars && <span className={styles.treeCount}>{fac.characters.length}</span>}
                        </span>
                    </div>
                </div>
            );
        }
        if (item.type === 'subPlane') {
            const plane = item.data;
            const isOpen = expandedPlanes.has(plane.id);
            const isSelected = selectedMaterialId === plane.id;
            return (
                <div className={styles.treeBranch} style={{ marginLeft: INDENT + 6 }}>
                    <div className={`${styles.treeRow} ${styles.treeRowSubPlane} ${isSelected ? styles.treeRowSelected : ''}`} style={{ padding: `5px 10px 5px ${INDENT + item.depth * INDENT}px`, opacity: item.isLocked ? 0.55 : 1 }}>
                        <span onClick={e => { e.stopPropagation(); toggleExpand(plane.id); }} className={`${styles.treeArrow} ${isOpen ? styles.treeArrowExpanded : styles.treeArrowCollapsed}`}>▼</span>
                        <span onClick={() => selectMaterial(plane.id)} className={styles.treeContent}>
                            <span className={styles.treeIcon}>🌀</span><span className={styles.treeName}>{plane.name}</span>
                            {item.isLocked && <span className={styles.treeLock}>🔒</span>}
                            <span className={styles.treeCount}>{item.total}</span>
                        </span>
                    </div>
                </div>
            );
        }
        if (item.type === 'typeHeader') {
            return (<div className={styles.treeBranch} style={{ marginLeft: INDENT + item.depth * INDENT + 6 }}>
                <div className={styles.typeHeader} style={{ padding: `4px 10px 4px ${INDENT + item.depth * INDENT}px` }}>{item.label} ({item.count})</div></div>);
        }
        if (item.type === 'itemsList') {
            return (<div className={styles.treeBranch} style={{ marginLeft: INDENT + item.depth * INDENT + 6 }}>
                <div className={styles.itemsList} style={{ padding: `2px 10px 2px ${INDENT + item.depth * INDENT}px` }}>⚔ {item.data.map(i => i.name).join('、')}</div></div>);
        }
        if (item.type === 'material') {
            const mat = item.data;
            const depth = item.depth;
            const isSelected = selectedMaterialId === mat.id;
            const archivedColor = mat.archived ? (ARCHIVE_STATUS_COLORS[mat.status] || 'var(--neon-red)') : null;
            return (
                <div className={styles.treeBranch} style={{ marginLeft: INDENT + (depth > 0 ? depth - 1 : 0) * INDENT + 6 }}>
                    <div onClick={() => selectMaterial(selectedMaterialId === mat.id ? null : mat.id)}
                        className={`${styles.materialRow} ${isSelected ? styles.materialRowSelected : ''}`}
                        style={{ padding: `5px 10px 5px ${INDENT + depth * INDENT}px`, fontSize: item.fontSize || 13, color: item.color || 'inherit', opacity: mat.isLocked ? 0.55 : mat.archived ? 0.6 : 1 }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                        <span className={styles.materialIcon}>{MATERIAL_TYPE_ICONS[mat.type] || '📄'}</span>
                        <span className={styles.materialName}>{mat.name}</span>
                        {mat.isLocked && <span className={styles.materialLock}>🔒</span>}
                        {mat.archived && <span className={styles.materialArchived} style={{ '--archived-color': archivedColor }}>●</span>}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={styles.panel}>
            <VirtualList items={flatItems} renderItem={renderItem} estimateSize={36} overscan={10} className={styles.virtualList} />
        </div>
    );
}
