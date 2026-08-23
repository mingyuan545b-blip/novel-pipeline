const store = require('../../store');
const { MEMORY_LAYERS } = require('./memoryConstants');
const { MemoryCache } = require('./memoryCache');
const { buildL0, buildL1, buildL2, buildL3, buildL4 } = require('./memoryLayerBuilder');
const { assembleContext, formatContextForPrompt } = require('./memoryContext');
const { updateAfterChapter, applyDecayAndCompress, touchRecency, generateVolumeSummary } = require('./memoryLifecycle');

const buildFns = { buildL0, buildL1, buildL2, buildL3, buildL4 };

class MemorySystem {
    constructor() {
        this._cache = new MemoryCache();
    }

    async getLayer(projectId, layer) {
        return this._cache.get(projectId, layer, async () => {
            const id = `${projectId}_${layer}`;
            return store.getItem('memory-layers', id);
        });
    }

    async setLayer(projectId, layer, data) {
        const id = `${projectId}_${layer}`;
        await store.setItem('memory-layers', id, {
            ...data, projectId, layer,
            updatedAt: new Date().toISOString()
        });
        this._cache.invalidate(projectId, layer);
    }

    async buildL0(projectId) { return buildL0(projectId, (p, l, d) => this.setLayer(p, l, d)); }
    async buildL1(projectId, ch) { return buildL1(projectId, ch, (p, l, d) => this.setLayer(p, l, d)); }
    async buildL2(projectId, ch, ws) { return buildL2(projectId, ch, ws, (p, l, d) => this.setLayer(p, l, d)); }
    async buildL3(projectId, ch, kw) { return buildL3(projectId, ch, kw, (p, l, d) => this.setLayer(p, l, d), (p, l) => this.getLayer(p, l)); }
    async buildL4(projectId, ch) { return buildL4(projectId, ch, (p, l, d) => this.setLayer(p, l, d), (p, l) => this.getLayer(p, l)); }

    async assembleContext(projectId, chapterNumber, chapterOutline, model, options) {
        return assembleContext(
            projectId, chapterNumber, { ...(options || {}), chapterOutline, model }
        );
    }

    formatContextForPrompt(context) { return formatContextForPrompt(context); }

    async updateAfterChapter(projectId, chapterNumber, chapterContent, materialUpdates) {
        return updateAfterChapter(
            projectId, chapterNumber, chapterContent, materialUpdates,
            buildFns, (p, l) => this.getLayer(p, l), (p, l, d) => this.setLayer(p, l, d),
            (p, l) => this._cache.invalidate(p, l)
        );
    }

    async applyDecayAndCompress(projectId, currentChapter) {
        return applyDecayAndCompress(projectId, currentChapter, (p, l) => this.getLayer(p, l), (p, l, d) => this.setLayer(p, l, d));
    }

    async touchRecency(projectId, layerName, entryId) {
        return touchRecency(projectId, layerName, entryId, (p, l) => this.getLayer(p, l), (p, l, d) => this.setLayer(p, l, d));
    }

    async getMemoryLayers(projectId) {
        const layers = {};
        // MEMORY_LAYERS 是对象 {L0:'core',...}，需要用 Object.values 迭代
        for (const layerName of Object.values(MEMORY_LAYERS)) {
            const data = await this.getLayer(projectId, layerName);
            if (data) layers[layerName] = data;
        }
        return layers;
    }

    async generateVolumeSummary(projectId, endChapterNumber) {
        return generateVolumeSummary(projectId, endChapterNumber, (p, l) => this.getLayer(p, l), (p, l, d) => this.setLayer(p, l, d));
    }

    invalidateCache(projectId, layer) {
        this._cache.invalidate(projectId, layer);
    }
}

module.exports = new MemorySystem();
