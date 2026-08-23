const { resolveParentPlane, resolveParentFaction } = require('./materialRefResolver');

function checkDuplicates(allMats) {
    const issues = [];
    const nameTypeMap = {};
    for (const m of allMats) {
        const key = `${m.type}::${m.name}`;
        if (!nameTypeMap[key]) nameTypeMap[key] = [];
        nameTypeMap[key].push(m);
    }

    for (const [key, mats] of Object.entries(nameTypeMap)) {
        if (mats.length > 1) {
            issues.push({
                severity: 'critical', type: 'duplicate',
                message: `存在${mats.length}个同名同类型素材"${mats[0].name}"(${mats[0].type})`,
                materialIds: mats.map(m => m.id), materialNames: mats.map(m => m.name),
                fix: 'merge', fixDescription: '合并为一条，保留内容最完整的'
            });
        }
    }
    return issues;
}

async function checkParentReferences(allMats, projectId, factions) {
    const issues = [];
    for (const m of allMats) {
        if (m.type === 'sub-plane') continue;

        if (m.parentPlane) {
            const planeResult = await resolveParentPlane(m.parentPlane, projectId);
            if (planeResult.method === 'unresolved') {
                issues.push({
                    severity: 'critical', type: 'broken-parentPlane',
                    message: `"${m.name}"(${m.type})的parentPlane="${m.parentPlane}"无法解析`,
                    materialId: m.id, materialName: m.name, brokenValue: m.parentPlane,
                    fix: 'resolve-or-clear', fixDescription: '尝试解析为小世界ID，无法解析则清空'
                });
            } else if (planeResult.method !== 'direct-id' && planeResult.method !== 'main-world') {
                issues.push({
                    severity: 'warning', type: 'name-ref-parentPlane',
                    message: `"${m.name}"(${m.type})的parentPlane用名字引用而非ID`,
                    materialId: m.id, materialName: m.name,
                    originalValue: m.parentPlane, resolvedId: planeResult.resolved, resolvedName: planeResult.name,
                    fix: 'normalize-to-id', fixDescription: `标准化为ID "${planeResult.resolved}"`
                });
            }
        }

        if (m.type === 'character' || m.type === 'institution') {
            if (!m.parentFaction) {
                const mainFactions = factions.filter(f => !f.parentPlane || f.parentPlane === null);
                if (mainFactions.length > 0) {
                    issues.push({
                        severity: 'warning', type: 'missing-parentFaction',
                        message: `"${m.name}"(${m.type})缺少parentFaction归属`,
                        materialId: m.id, materialName: m.name,
                        fix: 'auto-assign', fixDescription: `自动归入主世界势力"${mainFactions[0].name}"`
                    });
                }
            } else {
                const factionResult = await resolveParentFaction(m.parentFaction, projectId);
                if (factionResult.method === 'unresolved') {
                    issues.push({
                        severity: 'critical', type: 'broken-parentFaction',
                        message: `"${m.name}"(${m.type})的parentFaction无法解析`,
                        materialId: m.id, materialName: m.name, brokenValue: m.parentFaction,
                        fix: 'resolve-or-clear', fixDescription: '尝试解析为势力ID'
                    });
                } else if (factionResult.method !== 'direct-id' && factionResult.method !== 'no-faction') {
                    issues.push({
                        severity: 'warning', type: 'name-ref-parentFaction',
                        message: `"${m.name}"(${m.type})的parentFaction用名字引用而非ID`,
                        materialId: m.id, materialName: m.name,
                        originalValue: m.parentFaction, resolvedId: factionResult.resolved, resolvedName: factionResult.name,
                        fix: 'normalize-to-id', fixDescription: `标准化为ID "${factionResult.resolved}"`
                    });
                }
            }
        }

        if (m.type === 'character' && m.parentPlane === null && !m.parentFaction) {
            if (!m.name || !(m.name.includes('主角') || m.name.includes('域外'))) {
                issues.push({
                    severity: 'info', type: 'orphan-character',
                    message: `"${m.name}"是主世界角色但无势力归属`,
                    materialId: m.id, materialName: m.name,
                    fix: 'suggest-assign', fixDescription: '建议归入主世界某个势力'
                });
            }
        }
    }
    return issues;
}

function buildIntegrityStats(allMats) {
    const stats = { total: allMats.length, byType: {}, byPlane: { '主世界': 0 }, characters: { mainWorld: 0, subPlane: 0 } };
    for (const m of allMats) {
        stats.byType[m.type] = (stats.byType[m.type] || 0) + 1;
        const plane = m.parentPlane || '主世界';
        if (!stats.byPlane[plane]) stats.byPlane[plane] = 0;
        stats.byPlane[plane]++;
        if (m.type === 'character') {
            if (!m.parentPlane) stats.characters.mainWorld++;
            else stats.characters.subPlane++;
        }
    }
    return stats;
}

module.exports = {
    checkDuplicates,
    checkParentReferences,
    buildIntegrityStats
};
