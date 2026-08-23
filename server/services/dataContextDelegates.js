/**
 * dataContextDelegates.js — DataContext委托服务mixin
 * 实体/时间轴/战力/伏笔/弧线/审计/素材生命周期
 */
const entityCenter = require('./entityCenter');
const { timelineService } = require('./timelineService');
const { powerGuard } = require('./powerGuard');
const { foreshadowGuard } = require('./foreshadowGuard');
const { characterArcGuard } = require('./characterArcGuard');
const { consistencyAuditService } = require('./consistencyAuditService');
const { materialLifecycleService } = require('./materialLifecycleService');

const DelegateMixin = {
    // ── 实体 ──
    async getEntitiesForWriter(chapterNumber, tokenBudget = 3000) {
        return entityCenter.getForWriter(this.projectId, chapterNumber, tokenBudget);
    },
    async getEntitiesForReviewer(chapterNumber) {
        return entityCenter.getForReviewer(this.projectId, chapterNumber);
    },
    async getEntitiesForIntentPlanner(chapterNumber) {
        return entityCenter.getForIntentPlanner(this.projectId, chapterNumber);
    },
    async getEntitiesForProject(options = {}) {
        return entityCenter.getEntitiesForProject(this.projectId, options);
    },
    async getEntityByName(entityType, name) {
        return entityCenter.findEntityByName(this.projectId, entityType, name);
    },
    async getEntityRelations() {
        return entityCenter.getRelationsForProject(this.projectId);
    },
    async getEntityStats() {
        return entityCenter.getEntityStats(this.projectId);
    },

    // ── 时间轴 ──
    async getTimelineEventsForChapter(chapterNumber) {
        return timelineService.getEventsForChapter(this.projectId, chapterNumber);
    },
    async getTimelineEventsForRange(fromChapter, toChapter) {
        return timelineService.getEventsForRange(this.projectId, fromChapter, toChapter);
    },
    async getRecentTimelineEvents(currentChapter, lookbackChapters = 5) {
        return timelineService.getRecentEvents(this.projectId, currentChapter, lookbackChapters);
    },
    async getTimelineCausalChain(eventId, maxDepth = 10) {
        return timelineService.getCausalChain(this.projectId, eventId, maxDepth);
    },
    async getTimelineSummary(currentChapter, lookbackChapters = 5, tokenBudget = 800) {
        return timelineService.generateTimelineSummary(this.projectId, currentChapter, lookbackChapters, tokenBudget);
    },
    async getTimelineStats() { return timelineService.getStats(this.projectId); },
    async detectTimelineConflicts(chapterNumber) {
        return timelineService.detectTimeConflicts(this.projectId, chapterNumber);
    },

    // ── 战力守卫 ──
    async checkPowerConsistency(chapterNumber) {
        return powerGuard.checkPowerConsistency(this.projectId, chapterNumber);
    },
    async getPowerCurve(entityId, fromChapter, toChapter) {
        return powerGuard.getPowerCurve(this.projectId, entityId, fromChapter, toChapter);
    },
    async getPowerCheckHint(chapterNumber) {
        return powerGuard.generatePowerCheckHint(this.projectId, chapterNumber);
    },

    // ── 伏笔守卫 ──
    async getOverdueForeshadows(currentChapter) {
        return foreshadowGuard.getOverdueForeshadows(this.projectId, currentChapter);
    },
    async getForeshadowResolveStats() { return foreshadowGuard.getResolveStats(this.projectId); },
    async getForeshadowHint(currentChapter) {
        return foreshadowGuard.generateForeshadowHint(this.projectId, currentChapter);
    },
    async getForeshadowCheckHint(chapterNumber) {
        return foreshadowGuard.generateForeshadowCheckHint(this.projectId, chapterNumber);
    },

    // ── 角色弧线守卫 ──
    async checkCharacterArcs(chapterNumber) {
        return characterArcGuard.checkCharacterArcs(this.projectId, chapterNumber);
    },
    async getCharacterActivityStats(chapterNumber) {
        return characterArcGuard.getCharacterActivityStats(this.projectId, chapterNumber);
    },
    async getCharacterArcCheckHint(chapterNumber) {
        return characterArcGuard.generateCharacterArcCheckHint(this.projectId, chapterNumber);
    },
    async getCharacterActivityHint(chapterNumber) {
        return characterArcGuard.generateCharacterActivityHint(this.projectId, chapterNumber);
    },

    // ── 一致性审计 ──
    async runFullAudit(chapterNumber) {
        return consistencyAuditService.runFullAudit(this.projectId, chapterNumber);
    },
    shouldRunAudit(chapterNumber) { return consistencyAuditService.shouldRunAudit(chapterNumber); },
    async getAuditHistory(limit = 10) {
        return consistencyAuditService.getAuditHistory(this.projectId, limit);
    },

    // ── 素材生命周期 ──
    async getMaterialActivityAnalysis(currentChapter) {
        return materialLifecycleService.getMaterialActivityAnalysis(this.projectId, currentChapter);
    },
    async archiveStaleMaterials(currentChapter) {
        return materialLifecycleService.archiveStaleMaterials(this.projectId, currentChapter);
    },
    async detectDuplicateMaterials() {
        return materialLifecycleService.detectDuplicateMaterials(this.projectId);
    },
    async calculateTokenBudget(chapterNumber) {
        return materialLifecycleService.calculateTokenBudget(this.projectId, chapterNumber);
    },
    async getMaterialHealthReport(currentChapter) {
        return materialLifecycleService.getHealthReport(this.projectId, currentChapter);
    }
};

module.exports = DelegateMixin;
