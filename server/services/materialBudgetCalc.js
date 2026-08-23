const store = require('../store');
const { detectGenre } = require('./genreConfig');

const LIFECYCLE_CONFIG = {
    DECAY_THRESHOLD_CHAPTERS: 15,
    ARCHIVE_THRESHOLD_CHAPTERS: 30,
    MAX_TOKEN_BUDGET: 4000,
    MIN_TOKEN_BUDGET: 1500,
    TYPE_BUDGETS: { character: 800, 'power-system': 400, setting: 400, foreshadowing: 300, 'narrative-bridge': 200, 'famous-scene': 200, item: 200, other: 200 },
    MERGE_SIMILARITY_THRESHOLD: 0.8
};

async function calculateTokenBudget(projectId, chapterNumber) {
    const allMaterials = await store.queryItems('materials', { projectId });
    const materials = allMaterials.filter(m => !m.archived);
    const { getStyleProfileForProject } = require('./prompts/styleInjector');
    const styleProfile = await getStyleProfileForProject(projectId);
    const genre = detectGenre(styleProfile);
    const typeCounts = {};
    for (const mat of materials) { const type = mat.type || 'other'; typeCounts[type] = (typeCounts[type] || 0) + 1; }
    const totalMaterials = materials.length;
    let totalBudget = Math.min(LIFECYCLE_CONFIG.MAX_TOKEN_BUDGET, Math.max(LIFECYCLE_CONFIG.MIN_TOKEN_BUDGET, totalMaterials * 50));
    if (genre?.styleProfile?.materialFocus) {
        const focus = genre.styleProfile.materialFocus;
        if (focus.character) totalBudget = Math.min(totalBudget + 500, LIFECYCLE_CONFIG.MAX_TOKEN_BUDGET);
        if (focus.worldBuilding) totalBudget = Math.min(totalBudget + 300, LIFECYCLE_CONFIG.MAX_TOKEN_BUDGET);
    }
    const budgetAllocation = {};
    let allocatedBudget = 0;
    for (const [type, count] of Object.entries(typeCounts)) {
        const typeBudget = Math.min(LIFECYCLE_CONFIG.TYPE_BUDGETS[type] || LIFECYCLE_CONFIG.TYPE_BUDGETS.other, count * 100);
        budgetAllocation[type] = typeBudget;
        allocatedBudget += typeBudget;
    }
    if (allocatedBudget > totalBudget) {
        const scale = totalBudget / allocatedBudget;
        for (const type of Object.keys(budgetAllocation)) { budgetAllocation[type] = Math.floor(budgetAllocation[type] * scale); }
    }
    return { totalBudget, budgetAllocation, typeCounts, totalMaterials };
}

module.exports = { calculateTokenBudget, LIFECYCLE_CONFIG };
