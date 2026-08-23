const store = require('../store');
const logger = require('../shared/logger');
const { LIFECYCLE_CONFIG } = require('./materialBudgetCalc');
const { calculateTokenBudget } = require('./materialBudgetCalc');

class MaterialLifecycleService {
    async getMaterialActivityAnalysis(projectId, currentChapter) {
        const allMaterials = await store.queryItems('materials', { projectId });
        const materials = allMaterials.filter(m => !m.archived);
        const analysis = [];
        for (const mat of materials) {
            const lastRef = mat.lastReferencedChapter || mat.baseState?.lastReferencedChapter || 0;
            const created = mat.createdChapter || mat.baseState?.createdChapter || 0;
            const age = currentChapter - created;
            const refGap = lastRef > 0 ? currentChapter - lastRef : age;
            let status = 'active';
            if (refGap > LIFECYCLE_CONFIG.ARCHIVE_THRESHOLD_CHAPTERS) status = 'archive_candidate';
            else if (refGap > LIFECYCLE_CONFIG.DECAY_THRESHOLD_CHAPTERS) status = 'decaying';
            analysis.push({ id: mat.id, name: mat.name, type: mat.type, status, age, refGap, lastReferencedChapter: lastRef, referenceCount: mat.referenceCount || mat.baseState?.referenceCount || 0 });
        }
        return analysis;
    }

    async archiveStaleMaterials(projectId, currentChapter) {
        const analysis = await this.getMaterialActivityAnalysis(projectId, currentChapter);
        const archiveCandidates = analysis.filter(a => a.status === 'archive_candidate');
        const archived = [];
        for (const candidate of archiveCandidates) {
            try {
                const mat = await store.getItem('materials', candidate.id);
                if (mat && !mat.isArchived) {
                    await store.setItem('materials', candidate.id, { ...mat, isArchived: true, archivedAt: new Date().toISOString(), archivedReason: `${candidate.refGap}章未引用` });
                    archived.push(candidate.id);
                }
            } catch (_) { logger.warn('materialLifecycleSer', _.message || _); }
        }
        logger.info('materialLifecycle', `Archived ${archived.length} stale materials in project ${projectId}`);
        return archived;
    }

    async detectDuplicateMaterials(projectId) {
        const allMaterials = await store.queryItems('materials', { projectId });
        const materials = allMaterials.filter(m => !m.archived);
        const duplicates = [];
        const byType = new Map();
        for (const mat of materials) { const type = mat.type || 'other'; if (!byType.has(type)) byType.set(type, []); byType.get(type).push(mat); }
        for (const [type, mats] of byType) {
            for (let i = 0; i < mats.length; i++) {
                for (let j = i + 1; j < mats.length; j++) {
                    const similarity = this._computeSimilarity(mats[i].name, mats[j].name);
                    if (similarity >= LIFECYCLE_CONFIG.MERGE_SIMILARITY_THRESHOLD) {
                        duplicates.push({ type, materials: [mats[i], mats[j]], similarity, suggestion: `素材"${mats[i].name}"和"${mats[j].name}"高度相似（${(similarity * 100).toFixed(0)}%），建议合并` });
                    }
                }
            }
        }
        return duplicates;
    }

    async calculateTokenBudget(projectId, chapterNumber) { return calculateTokenBudget(projectId, chapterNumber); }

    async getHealthReport(projectId, currentChapter) {
        const analysis = await this.getMaterialActivityAnalysis(projectId, currentChapter);
        const duplicates = await this.detectDuplicateMaterials(projectId);
        const budget = await calculateTokenBudget(projectId, currentChapter);
        const active = analysis.filter(a => a.status === 'active').length;
        const decaying = analysis.filter(a => a.status === 'decaying').length;
        const archiveCandidates = analysis.filter(a => a.status === 'archive_candidate').length;
        return {
            total: analysis.length, active, decaying, archiveCandidates, duplicates: duplicates.length, budget,
            suggestions: [
                ...(archiveCandidates > 0 ? [`${archiveCandidates}个素材可归档以释放token预算`] : []),
                ...(duplicates.length > 0 ? [`${duplicates.length}对重复素材可合并`] : []),
                ...(decaying > 0 ? [`${decaying}个素材正在衰减，考虑在近期章节中引用`] : [])
            ]
        };
    }

    _computeSimilarity(strA, strB) {
        if (!strA || !strB) return 0;
        const a = new Set(strA.split(''));
        const b = new Set(strB.split(''));
        const intersection = new Set([...a].filter(x => b.has(x)));
        const union = new Set([...a, ...b]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
}

const materialLifecycleService = new MaterialLifecycleService();

module.exports = { materialLifecycleService, MaterialLifecycleService, LIFECYCLE_CONFIG };
