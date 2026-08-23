/**
 * cleanupRoutes - 项目清理路由
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const fs = require('fs');
const path = require('path');
const { ERROR_CODES } = require('../../shared/errorCodes');
const { cleanupChapters, cleanupTimelines, cleanupMaterials, cleanupKnowledge, cleanupOutlines, cleanupLogs, cleanupRemediation } = require('./cleanupHandlers');

const { NOT_FOUND } = ERROR_CODES;

function getDirSize(dirPath) {
    let size = 0;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) { size += getDirSize(filePath); }
        else { size += stats.size; }
    }
    return size;
}

function registerCleanupRoutes(router) {
    router.post('/:id/cleanup', async (req, res) => {
        const { id } = req.params;
        const { targets, keepLocked } = req.body;
        const project = await store.getItem('projects', id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const result = { success: true, cleaned: {} };
        const shouldKeepLocked = keepLocked !== false;

        if (targets.includes('chapters')) result.cleaned = { ...result.cleaned, ...(await cleanupChapters(id, project)) };
        if (targets.includes('timelines')) result.cleaned = { ...result.cleaned, ...(await cleanupTimelines(id)) };
        if (targets.includes('materials')) result.cleaned = { ...result.cleaned, ...(await cleanupMaterials(id, shouldKeepLocked)) };
        if (targets.includes('knowledge')) result.cleaned = { ...result.cleaned, ...(await cleanupKnowledge(id)) };
        if (targets.includes('outlines')) result.cleaned = { ...result.cleaned, ...(await cleanupOutlines(id)) };
        if (targets.includes('logs')) result.cleaned = { ...result.cleaned, ...(await cleanupLogs(id)) };
        if (targets.includes('remediation')) result.cleaned = { ...result.cleaned, ...cleanupRemediation(project) };

        project.updatedAt = new Date().toISOString();
        await store.setItem('projects', id, project);
        res.json(result);
    });

    router.get('/:id/cleanup-stats', async (req, res) => {
        const { id } = req.params;
        const project = await store.getItem('projects', id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const dataDir = store.DATA_DIR;

        const chapters = await store.queryItems('chapters', { projectId: id });
        const reviews = await store.queryItems('reviews', { projectId: id });
        const timelines = await store.queryItems('timelines', { projectId: id });
        const quests = await store.queryItems('quests', { projectId: id });
        const materials = await store.queryItems('materials', { projectId: id });
        const memoryLayers = await store.queryItems('memory-layers', { projectId: id });
        const snapshots = await store.queryItems('state-snapshots', { projectId: id });
        const consistencyReports = await store.queryItems('consistency-reports', { projectId: id });
        const outlines = materials.filter(m => m.type === 'chapter-outline');
        const chapterOutlines = await store.queryItems('chapter-outlines', { projectId: id });
        const totalOutlines = Math.max(outlines.length, chapterOutlines.length);
        const lockedMaterials = materials.filter(m => m.isLocked);

        const countFiles = (dir) => {
            if (!fs.existsSync(dir)) return 0;
            return fs.readdirSync(dir).filter(f => f.includes(id) && f.endsWith('.json')).length;
        };

        const outputDir = path.join(__dirname, '..', '..', '..', 'output', id);
        const exportDir = path.join(dataDir, id, 'export');
        let logSize = 0;
        [outputDir, exportDir].forEach(d => {
            if (fs.existsSync(d)) { try { logSize += getDirSize(d); } catch (_) { logger.warn('cleanupRoutes', '[cleanup]', _.message || _); } }
        });

        res.json({
            chapters: { count: Math.max(chapters.length, countFiles(path.join(dataDir, 'chapters'))), reviews: Math.max(reviews.length, countFiles(path.join(dataDir, 'reviews'))) },
            timelines: { count: Math.max(timelines.length, countFiles(path.join(dataDir, 'timelines'))), quests: Math.max(quests.length, countFiles(path.join(dataDir, 'quests'))) },
            materials: { count: materials.length, locked: lockedMaterials.length, unlocked: materials.length - lockedMaterials.length },
            knowledge: { memoryLayers: Math.max(memoryLayers.length, countFiles(path.join(dataDir, 'memory-layers'))), snapshots: Math.max(snapshots.length, countFiles(path.join(dataDir, 'state-snapshots'))), consistencyReports: Math.max(consistencyReports.length, countFiles(path.join(dataDir, 'consistency-reports'))) },
            outlines: { count: totalOutlines },
            logs: { sizeBytes: logSize, hasOutput: fs.existsSync(outputDir), hasExport: fs.existsSync(exportDir) },
            remediation: { hasWriterAdditions: (project.writerPromptAdditions || []).length > 0, hasReviewAdditions: (project.reviewPromptAdditions || []).length > 0, hasStyleGuidance: !!project.styleGuidance }
        });
    });
}

module.exports = { registerCleanupRoutes };
