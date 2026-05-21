const store = require('../store');

function resolveReference(value, type, projectId) {
    if (!value) return { resolved: null, original: value, method: 'empty' };

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        const mat = store.getItem('materials', value);
        if (mat && mat.projectId === projectId && (!type || mat.type === type)) {
            return { resolved: value, original: value, method: 'direct-id', name: mat.name };
        }
    }

    const allMats = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
    const candidates = type ? allMats.filter(m => m.type === type) : allMats;

    const exactMatch = candidates.find(m => m.name === value);
    if (exactMatch) {
        return { resolved: exactMatch.id, original: value, method: 'exact-name', name: exactMatch.name };
    }

    const lowerVal = value.toLowerCase().replace(/[\s\-_·]/g, '');
    const fuzzyMatch = candidates.find(m => {
        const lowerName = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
        return lowerName === lowerVal;
    });
    if (fuzzyMatch) {
        return { resolved: fuzzyMatch.id, original: value, method: 'fuzzy-name', name: fuzzyMatch.name };
    }

    const partialMatch = candidates.find(m => {
        const lowerName = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
        return lowerName.includes(lowerVal) || lowerVal.includes(lowerName);
    });
    if (partialMatch) {
        return { resolved: partialMatch.id, original: value, method: 'partial-name', name: partialMatch.name };
    }

    return { resolved: null, original: value, method: 'unresolved' };
}

function resolveParentPlane(parentPlane, projectId) {
    if (parentPlane === null || parentPlane === undefined || parentPlane === 'null') {
        return { resolved: null, original: parentPlane, method: 'main-world' };
    }
    return resolveReference(parentPlane, 'sub-plane', projectId);
}

function resolveParentFaction(parentFaction, projectId) {
    if (parentFaction === null || parentFaction === undefined || parentFaction === 'null') {
        return { resolved: null, original: parentFaction, method: 'no-faction' };
    }
    return resolveReference(parentFaction, 'faction', projectId);
}

function checkIntegrity(projectId) {
    const allMats = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
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
                severity: 'critical',
                type: 'duplicate',
                message: `存在${mats.length}个同名同类型素材"${mats[0].name}"(${mats[0].type})`,
                materialIds: mats.map(m => m.id),
                materialNames: mats.map(m => m.name),
                fix: 'merge',
                fixDescription: '合并为一条，保留内容最完整的'
            });
        }
    }

    const subPlanes = allMats.filter(m => m.type === 'sub-plane');
    const subPlaneIds = new Set(subPlanes.map(sp => sp.id));
    const subPlaneNames = new Set(subPlanes.map(sp => sp.name));
    const factions = allMats.filter(m => m.type === 'faction');
    const factionIds = new Set(factions.map(f => f.id));

    for (const m of allMats) {
        if (m.type === 'sub-plane') continue;

        if (m.parentPlane) {
            const planeResult = resolveParentPlane(m.parentPlane, projectId);
            if (planeResult.method === 'unresolved') {
                issues.push({
                    severity: 'critical',
                    type: 'broken-parentPlane',
                    message: `"${m.name}"(${m.type})的parentPlane="${m.parentPlane}"无法解析为任何次位面素材`,
                    materialId: m.id,
                    materialName: m.name,
                    brokenValue: m.parentPlane,
                    fix: 'resolve-or-clear',
                    fixDescription: '尝试解析为次位面ID，无法解析则清空(归入主世界)'
                });
            } else if (planeResult.method !== 'direct-id' && planeResult.method !== 'main-world') {
                issues.push({
                    severity: 'warning',
                    type: 'name-ref-parentPlane',
                    message: `"${m.name}"(${m.type})的parentPlane用名字"${m.parentPlane}"引用而非ID`,
                    materialId: m.id,
                    materialName: m.name,
                    originalValue: m.parentPlane,
                    resolvedId: planeResult.resolved,
                    resolvedName: planeResult.name,
                    fix: 'normalize-to-id',
                    fixDescription: `将parentPlane从"${m.parentPlane}"标准化为ID "${planeResult.resolved}"`
                });
            }
        }

        if (m.type === 'character' || m.type === 'institution') {
            if (!m.parentFaction) {
                const mainFactions = factions.filter(f => !f.parentPlane || f.parentPlane === null);
                if (mainFactions.length > 0) {
                    issues.push({
                        severity: 'warning',
                        type: 'missing-parentFaction',
                        message: `"${m.name}"(${m.type})缺少parentFaction归属`,
                        materialId: m.id,
                        materialName: m.name,
                        fix: 'auto-assign',
                        fixDescription: `自动归入主世界势力"${mainFactions[0].name}"`
                    });
                }
            } else {
                const factionResult = resolveParentFaction(m.parentFaction, projectId);
                if (factionResult.method === 'unresolved') {
                    issues.push({
                        severity: 'critical',
                        type: 'broken-parentFaction',
                        message: `"${m.name}"(${m.type})的parentFaction="${m.parentFaction}"无法解析为任何势力素材`,
                        materialId: m.id,
                        materialName: m.name,
                        brokenValue: m.parentFaction,
                        fix: 'resolve-or-clear',
                        fixDescription: '尝试解析为势力ID，无法解析则归入主世界默认势力'
                    });
                } else if (factionResult.method !== 'direct-id' && factionResult.method !== 'no-faction') {
                    issues.push({
                        severity: 'warning',
                        type: 'name-ref-parentFaction',
                        message: `"${m.name}"(${m.type})的parentFaction用名字"${m.parentFaction}"引用而非ID`,
                        materialId: m.id,
                        materialName: m.name,
                        originalValue: m.parentFaction,
                        resolvedId: factionResult.resolved,
                        resolvedName: factionResult.name,
                        fix: 'normalize-to-id',
                        fixDescription: `将parentFaction从"${m.parentFaction}"标准化为ID "${factionResult.resolved}"`
                    });
                }
            }
        }

        if (m.type === 'character' && m.parentPlane === null && !m.parentFaction) {
            if (!m.name || !(m.name.includes('主角') || m.name.includes('域外'))) {
                issues.push({
                    severity: 'info',
                    type: 'orphan-character',
                    message: `"${m.name}"是主世界角色但无势力归属`,
                    materialId: m.id,
                    materialName: m.name,
                    fix: 'suggest-assign',
                    fixDescription: '建议归入主世界某个势力'
                });
            }
        }
    }

    const mainWorldChars = allMats.filter(m => m.type === 'character' && (m.parentPlane === null || m.parentPlane === undefined));
    if (mainWorldChars.length < 3) {
        const protagonistName = getProtagonistName(projectId);
        const hasProtagonist = mainWorldChars.some(c => c.name === protagonistName || c.name.includes('主角'));
        if (!hasProtagonist) {
            issues.push({
                severity: 'warning',
                type: 'missing-protagonist',
                message: `主世界缺少主角"${protagonistName}"的角色素材`,
                fix: 'create',
                fixDescription: `创建主角"${protagonistName}"的角色素材卡`
            });
        }
    }

    const stats = {
        total: allMats.length,
        byType: {},
        byPlane: { '主世界': 0 },
        characters: { mainWorld: 0, subPlane: 0 }
    };
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

    return {
        projectId,
        issues,
        stats,
        criticalCount: issues.filter(i => i.severity === 'critical').length,
        warningCount: issues.filter(i => i.severity === 'warning').length,
        infoCount: issues.filter(i => i.severity === 'info').length,
        healthy: issues.filter(i => i.severity === 'critical').length === 0
    };
}

async function autoFix(projectId, options = {}) {
    const { fixBroken = true, fixNameRefs = true, fixDuplicates = true, dryRun = false } = options;
    const report = checkIntegrity(projectId);
    const fixes = [];

    for (const issue of report.issues) {
        try {
            if (issue.type === 'broken-parentPlane' && fixBroken) {
                const mat = store.getItem('materials', issue.materialId);
                if (!mat) continue;
                if (!dryRun) {
                    await store.setItem('materials', mat.id, { ...mat, parentPlane: null, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentPlane "${issue.brokenValue}" → null (归入主世界)`, dryRun });
            }

            if (issue.type === 'name-ref-parentPlane' && fixNameRefs) {
                const mat = store.getItem('materials', issue.materialId);
                if (!mat) continue;
                if (!dryRun) {
                    await store.setItem('materials', mat.id, { ...mat, parentPlane: issue.resolvedId, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentPlane "${issue.originalValue}" → ID "${issue.resolvedId}"(${issue.resolvedName})`, dryRun });
            }

            if (issue.type === 'broken-parentFaction' && fixBroken) {
                const mat = store.getItem('materials', issue.materialId);
                if (!mat) continue;
                const allMats = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
                const mainFaction = allMats.find(m => m.type === 'faction' && (!m.parentPlane || m.parentPlane === null));
                if (!dryRun && mainFaction) {
                    await store.setItem('materials', mat.id, { ...mat, parentFaction: mainFaction.id, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentFaction "${issue.brokenValue}" → 主世界势力"${mainFaction?.name}"(${mainFaction?.id})`, dryRun });
            }

            if (issue.type === 'name-ref-parentFaction' && fixNameRefs) {
                const mat = store.getItem('materials', issue.materialId);
                if (!mat) continue;
                if (!dryRun) {
                    await store.setItem('materials', mat.id, { ...mat, parentFaction: issue.resolvedId, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentFaction "${issue.originalValue}" → ID "${issue.resolvedId}"(${issue.resolvedName})`, dryRun });
            }

            if (issue.type === 'missing-parentFaction' && fixBroken) {
                const mat = store.getItem('materials', issue.materialId);
                if (!mat) continue;
                const allMats = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
                const mainFaction = allMats.find(m => m.type === 'faction' && (!m.parentPlane || m.parentPlane === null));
                if (!dryRun && mainFaction) {
                    await store.setItem('materials', mat.id, { ...mat, parentFaction: mainFaction.id, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `自动归入主世界势力"${mainFaction?.name}"`, dryRun });
            }

            if (issue.type === 'duplicate' && fixDuplicates) {
                const mats = issue.materialIds.map(id => store.getItem('materials', id)).filter(Boolean);
                if (mats.length < 2) continue;
                const best = mats.reduce((a, b) => {
                    const aLen = (a.currentContent || '').length;
                    const bLen = (b.currentContent || '').length;
                    return aLen >= bLen ? a : b;
                });
                for (const m of mats) {
                    if (m.id === best.id) continue;
                    if (!dryRun) {
                        await store.setItem('materials', m.id, {
                            ...m,
                            archived: true,
                            archivedReason: `与素材"${best.name}"(${best.id})重复，合并归档`,
                            archivedAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    }
                    fixes.push({ issue: issue.message, action: `归档重复素材"${m.name}"(${m.id})，保留"${best.name}"(${best.id})`, dryRun });
                }
            }
        } catch (err) {
            fixes.push({ issue: issue.message, action: `修复失败: ${err.message}`, dryRun, error: true });
        }
    }

    return { fixes, totalFixes: fixes.length, errors: fixes.filter(f => f.error).length, dryRun };
}

function normalizeMaterial(material, projectId) {
    const updates = {};

    if (material.parentPlane) {
        const result = resolveParentPlane(material.parentPlane, projectId);
        if (result.resolved && result.method !== 'direct-id') {
            updates.parentPlane = result.resolved;
        }
    }

    if (material.parentFaction) {
        const result = resolveParentFaction(material.parentFaction, projectId);
        if (result.resolved && result.method !== 'direct-id') {
            updates.parentFaction = result.resolved;
        }
    }

    return Object.keys(updates).length > 0 ? updates : null;
}

function getProtagonistName(projectId) {
    try {
        const project = store.getItem('projects', projectId);
        return project?.styleProfile?.protagonistName || '主角';
    } catch (_) {
        return '主角';
    }
}

module.exports = {
    resolveReference,
    resolveParentPlane,
    resolveParentFaction,
    checkIntegrity,
    autoFix,
    normalizeMaterial,
    getProtagonistName
};
