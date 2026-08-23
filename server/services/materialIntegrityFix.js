const store = require('../store');

async function autoFix(projectId, options = {}) {
    const { fixBroken = true, fixNameRefs = true, fixDuplicates = true, dryRun = false } = options;
    const { checkIntegrity } = require('./materialIntegrityCheck');
    const report = await checkIntegrity(projectId);
    const fixes = [];

    for (const issue of report.issues) {
        try {
            if (issue.type === 'broken-parentPlane' && fixBroken) {
                const mat = await store.getItem('materials', issue.materialId);
                if (!mat) continue;
                if (!dryRun) {
                    await store.setItem('materials', mat.id, { ...mat, parentPlane: null, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentPlane "${issue.brokenValue}" → null (归入主世界)`, dryRun });
            }

            if (issue.type === 'name-ref-parentPlane' && fixNameRefs) {
                const mat = await store.getItem('materials', issue.materialId);
                if (!mat) continue;
                if (!dryRun) {
                    await store.setItem('materials', mat.id, { ...mat, parentPlane: issue.resolvedId, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentPlane "${issue.originalValue}" → ID "${issue.resolvedId}"(${issue.resolvedName})`, dryRun });
            }

            if (issue.type === 'broken-parentFaction' && fixBroken) {
                const mat = await store.getItem('materials', issue.materialId);
                if (!mat) continue;
                const allMats = (await store.queryItems('materials', { projectId })).filter(m => !m.archived);
                const mainFaction = allMats.find(m => m.type === 'faction' && (!m.parentPlane || m.parentPlane === null));
                if (!dryRun && mainFaction) {
                    await store.setItem('materials', mat.id, { ...mat, parentFaction: mainFaction.id, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentFaction "${issue.brokenValue}" → 主世界势力"${mainFaction?.name}"`, dryRun });
            }

            if (issue.type === 'name-ref-parentFaction' && fixNameRefs) {
                const mat = await store.getItem('materials', issue.materialId);
                if (!mat) continue;
                if (!dryRun) {
                    await store.setItem('materials', mat.id, { ...mat, parentFaction: issue.resolvedId, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `parentFaction "${issue.originalValue}" → ID "${issue.resolvedId}"(${issue.resolvedName})`, dryRun });
            }

            if (issue.type === 'missing-parentFaction' && fixBroken) {
                const mat = await store.getItem('materials', issue.materialId);
                if (!mat) continue;
                const allMats = (await store.queryItems('materials', { projectId })).filter(m => !m.archived);
                const mainFaction = allMats.find(m => m.type === 'faction' && (!m.parentPlane || m.parentPlane === null));
                if (!dryRun && mainFaction) {
                    await store.setItem('materials', mat.id, { ...mat, parentFaction: mainFaction.id, updatedAt: new Date().toISOString() });
                }
                fixes.push({ issue: issue.message, action: `自动归入主世界势力"${mainFaction?.name}"`, dryRun });
            }

            if (issue.type === 'duplicate' && fixDuplicates) {
                const mats = [];
                for (const id of issue.materialIds) {
                    const m = await store.getItem('materials', id);
                    if (m) mats.push(m);
                }
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
                            ...m, archived: true,
                            archivedReason: `与素材"${best.name}"(${best.id})重复，合并归档`,
                            archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
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

module.exports = { autoFix };
