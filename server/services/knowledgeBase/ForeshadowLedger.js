'use strict';

const store = require('../../store');
const logger = require('../../shared/logger');

const FORESHADOW_TYPE = 'foreshadow-ledger';

class ForeshadowLedger {
    async plant(projectId, name, description, options = {}) {
        const existing = await this.findByName(projectId, name);
        if (existing) return existing;

        const id = options.id || `fs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const entry = {
            id,
            projectId,
            name,
            description,
            status: 'planted',
            plantChapter: options.plantChapter || 0,
            lastAdvanceChapter: options.plantChapter || 0,
            resolveChapter: null,
            expectedResolveWindow: options.expectedResolveWindow || '',
            importance: options.importance || 'normal',
            storyline: options.storyline || 'sub',
            relatedEntityIds: options.relatedEntityIds || [],
            relatedEventIds: options.relatedEventIds || [],
            relatedPlotThreads: options.relatedPlotThreads || [],
            advanceLog: [],
            resolutionNotes: ''
        };

        await store.setItem(FORESHADOW_TYPE, id, entry);
        logger.info('foreshadow', `Planted: "${name}" in ch${entry.plantChapter}`);
        return entry;
    }

    async advance(projectId, name, chapterNumber, detail = '') {
        const entry = await this.findByName(projectId, name);
        if (!entry) return null;

        entry.lastAdvanceChapter = chapterNumber;
        entry.status = 'advanced';
        entry.advanceLog = entry.advanceLog || [];
        entry.advanceLog.push({ chapter: chapterNumber, detail, timestamp: new Date().toISOString() });

        await store.setItem(FORESHADOW_TYPE, entry.id, entry);
        logger.info('foreshadow', `Advanced: "${name}" in ch${chapterNumber}`);
        return entry;
    }

    async resolve(projectId, name, chapterNumber, notes = '') {
        const entry = await this.findByName(projectId, name);
        if (!entry) return null;

        entry.status = 'resolved';
        entry.resolveChapter = chapterNumber;
        entry.resolutionNotes = notes;
        entry.advanceLog = entry.advanceLog || [];
        entry.advanceLog.push({ chapter: chapterNumber, detail: '已回收', timestamp: new Date().toISOString() });

        await store.setItem(FORESHADOW_TYPE, entry.id, entry);
        logger.info('foreshadow', `Resolved: "${name}" in ch${chapterNumber}`);
        return entry;
    }

    async abandon(projectId, name, reason = '') {
        const entry = await this.findByName(projectId, name);
        if (!entry) return null;

        entry.status = 'abandoned';
        entry.resolutionNotes = reason;

        await store.setItem(FORESHADOW_TYPE, entry.id, entry);
        return entry;
    }

    async findByName(projectId, name) {
        const all = await store.queryItems(FORESHADOW_TYPE, { projectId });
        return all.find(f => f.name === name) || null;
    }

    async getActive(projectId) {
        const all = await store.queryItems(FORESHADOW_TYPE, { projectId });
        return all.filter(f => f.status === 'planted' || f.status === 'advanced');
    }

    async getMainline(projectId) {
        const active = await this.getActive(projectId);
        return active.filter(f => f.storyline === 'main');
    }

    async getSubline(projectId) {
        const active = await this.getActive(projectId);
        return active.filter(f => f.storyline !== 'main');
    }

    async getOverdue(projectId, currentChapter) {
        const active = await this.getActive(projectId);
        return active.filter(f => {
            if (!f.expectedResolveWindow) return false;
            const match = f.expectedResolveWindow.match(/(\d+)/);
            if (!match) return false;
            const expectedChapter = f.plantChapter + parseInt(match[1]);
            return currentChapter > expectedChapter;
        });
    }

    async getStats(projectId) {
        const all = await store.queryItems(FORESHADOW_TYPE, { projectId });
        return {
            total: all.length,
            planted: all.filter(f => f.status === 'planted').length,
            advanced: all.filter(f => f.status === 'advanced').length,
            resolved: all.filter(f => f.status === 'resolved').length,
            abandoned: all.filter(f => f.status === 'abandoned').length
        };
    }
}

module.exports = ForeshadowLedger;
