const store = require('../store');
const { getProtagonistName } = require('./materialRefResolver');
const { checkDuplicates, checkParentReferences, buildIntegrityStats } = require('./materialIntegrityHelpers');

async function checkIntegrity(projectId) {
    const allMats = (await store.queryItems('materials', { projectId })).filter(m => !m.archived);
    const issues = [];

    issues.push(...checkDuplicates(allMats));

    const factions = allMats.filter(m => m.type === 'faction');
    issues.push(...await checkParentReferences(allMats, projectId, factions));

    const mainWorldChars = allMats.filter(m => m.type === 'character' && (m.parentPlane === null || m.parentPlane === undefined));
    if (mainWorldChars.length < 3) {
        const protagonistName = await getProtagonistName(projectId);
        const hasProtagonist = mainWorldChars.some(c => c.name === protagonistName || c.name.includes('主角'));
        if (!hasProtagonist) {
            issues.push({
                severity: 'warning', type: 'missing-protagonist',
                message: `主世界缺少主角"${protagonistName}"的角色素材`,
                fix: 'create', fixDescription: `创建主角"${protagonistName}"的角色素材卡`
            });
        }
    }

    const stats = buildIntegrityStats(allMats);

    return {
        projectId, issues, stats,
        criticalCount: issues.filter(i => i.severity === 'critical').length,
        warningCount: issues.filter(i => i.severity === 'warning').length,
        infoCount: issues.filter(i => i.severity === 'info').length,
        healthy: issues.filter(i => i.severity === 'critical').length === 0
    };
}

module.exports = { checkIntegrity };
