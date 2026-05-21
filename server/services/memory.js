const store = require('../store');
const { CONTEXT_BUDGETS: MODEL_BUDGETS, estimateTokens: sharedEstimateTokens } = require('./contextBudget');

const MEMORY_LAYERS = {
    L0: 'core',
    L1: 'active',
    L2: 'recent',
    L3: 'archive',
    L4: 'compressed'
};

const CONTEXT_BUDGETS = MODEL_BUDGETS;

const LAYER_PRIORITIES = {
    L0: 100,
    L1: 80,
    L2: 60,
    L3: 40,
    L4: 20
};

const LAYER_DECAY_RATES = {
    L0: 0,
    L1: 0.02,
    L2: 0.05,
    L3: 0.10,
    L4: 0.15
};

const RECENCY_FLOOR = 10;
const RECENCY_TOUCH_BOOST = 100;
const COMPRESSION_THRESHOLD = 0.3;

class MemorySystem {
    constructor() {
        this._cache = new Map();
        this._CACHE_TTL = 5 * 60 * 1000;
        this._CACHE_MAX = 50;
    }

    _cacheKey(projectId, layer) {
        return `${projectId}:${layer}`;
    }

    _invalidateCache(projectId, layer) {
        if (layer) {
            this._cache.delete(this._cacheKey(projectId, layer));
        } else {
            for (const key of this._cache.keys()) {
                if (key.startsWith(projectId + ':')) {
                    this._cache.delete(key);
                }
            }
        }
    }

    _cleanExpiredCache() {
        const now = Date.now();
        for (const [key, entry] of this._cache.entries()) {
            if (entry._cachedAt && (now - entry._cachedAt) > this._CACHE_TTL) {
                this._cache.delete(key);
            }
        }
        if (this._cache.size > this._CACHE_MAX) {
            const entries = [...this._cache.entries()].sort((a, b) =>
                (a[1]._cachedAt || 0) - (b[1]._cachedAt || 0)
            );
            const toRemove = entries.slice(0, this._cache.size - this._CACHE_MAX);
            for (const [key] of toRemove) this._cache.delete(key);
        }
    }

    async getLayer(projectId, layer) {
        this._cleanExpiredCache();
        const key = this._cacheKey(projectId, layer);
        if (this._cache.has(key)) {
            const entry = this._cache.get(key);
            if (entry._cachedAt && (Date.now() - entry._cachedAt) > this._CACHE_TTL) {
                this._cache.delete(key);
            } else {
                return entry;
            }
        }

        const id = `${projectId}_${layer}`;
        const data = await store.getItem('memory-layers', id);
        if (data) {
            const cached = { ...data, _cachedAt: Date.now() };
            this._cache.set(key, cached);
            return cached;
        }
        return data;
    }

    async setLayer(projectId, layer, data) {
        const id = `${projectId}_${layer}`;
        await store.setItem('memory-layers', id, {
            ...data,
            projectId,
            layer,
            updatedAt: new Date().toISOString()
        });
        this._invalidateCache(projectId, layer);
    }

    async buildL0(projectId) {
        const allMaterials = store.queryItems('materials', { projectId }).filter(m => !m.archived);
        const worldviews = allMaterials.filter(m => m.type === 'worldview');
        const powerSystems = allMaterials.filter(m => m.type === 'power-system');
        let coreChars = allMaterials.filter(m => m.type === 'character' && (m.tags?.includes('核心') || m.tags?.includes('主角') || m.tags?.includes('template')));
        if (coreChars.length === 0) {
            const allChars = allMaterials.filter(m => m.type === 'character');
            coreChars = allChars.slice(0, Math.min(3, allChars.length));
        }

        const l0 = {
            worldRules: worldviews.map(w => ({
                id: w.id,
                name: w.name,
                content: w.currentContent || w.initialContent,
                version: w.version || 1
            })),
            powerFramework: powerSystems.map(p => ({
                id: p.id,
                name: p.name,
                content: p.currentContent || p.initialContent,
                version: p.version || 1
            })),
            coreCharacters: coreChars.map(c => ({
                id: c.id,
                name: c.name,
                content: c.currentContent || c.initialContent,
                version: c.version || 1
            })),
            totalTokenEstimate: 0
        };

        l0.totalTokenEstimate = this._estimateTokens(JSON.stringify(l0));
        await this.setLayer(projectId, MEMORY_LAYERS.L0, l0);
        return l0;
    }

    async buildL1(projectId, chapterNumber) {
        const allMaterials = store.queryItems('materials', { projectId }).filter(m => !m.archived);
        const characters = allMaterials.filter(m => m.type === 'character');
        const relationships = allMaterials.filter(m => m.type === 'relationship');
        const equipment = allMaterials.filter(m => m.type === 'equipment');
        const growthHistories = allMaterials.filter(m => m.type === 'growth-history');

        const snapshots = store.queryItems('state-snapshots', { projectId });
        const latestSnapshot = snapshots
            .filter(s => s.chapterNumber <= (chapterNumber || 99999))
            .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];

        const charStates = {};
        for (const c of characters) {
            const snapState = latestSnapshot?.characterStates?.[c.id];
            charStates[c.id] = {
                id: c.id,
                name: c.name,
                currentContent: c.currentContent || c.initialContent,
                location: snapState?.location || '未知',
                status: snapState?.status || '活跃',
                powerLevel: snapState?.powerLevel || '未知',
                emotionalState: snapState?.emotionalState || '未知',
                lastAppearanceChapter: snapState?.lastAppearanceChapter || 0,
                active: snapState?.active !== false
            };
        }

        const relStates = {};
        for (const r of relationships) {
            const snapRel = latestSnapshot?.relationshipStates?.[r.id];
            relStates[r.id] = {
                id: r.id,
                name: r.name,
                content: r.currentContent || r.initialContent,
                type: snapRel?.type || r.tags?.[0] || '未知',
                strength: snapRel?.strength || 50,
                lastChangeChapter: snapRel?.lastChangeChapter || 0
            };
        }

        const equipStates = {};
        for (const e of equipment) {
            const snapEquip = latestSnapshot?.equipmentStates?.[e.id];
            equipStates[e.id] = {
                id: e.id,
                name: e.name,
                content: e.currentContent || e.initialContent,
                owner: snapEquip?.owner || '未知',
                status: snapEquip?.status || '完好'
            };
        }

        const growthStates = {};
        for (const g of growthHistories) {
            growthStates[g.id] = {
                id: g.id,
                name: g.name,
                content: g.currentContent || g.initialContent,
                milestones: latestSnapshot?.growthMilestones?.[g.id] || []
            };
        }

        const l1 = {
            chapterNumber: chapterNumber || latestSnapshot?.chapterNumber || 0,
            characterStates: charStates,
            relationshipStates: relStates,
            equipmentStates: equipStates,
            growthStates: growthStates,
            totalTokenEstimate: 0
        };

        l1.totalTokenEstimate = this._estimateTokens(JSON.stringify(l1));
        await this.setLayer(projectId, MEMORY_LAYERS.L1, l1);
        return l1;
    }

    async buildL2(projectId, chapterNumber, windowSize = 5) {
        const chapters = store.queryItems('chapters', { projectId });
        const sorted = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

        const recentChapters = sorted
            .filter(c => c.chapterNumber < chapterNumber)
            .slice(-windowSize);

        const quests = store.queryItems('quests', { projectId });
        const activeQuests = quests.filter(q => q.status === 'active');

        const allMaterials = store.queryItems('materials', { projectId }).filter(m => !m.archived);
        const foreshadowings = allMaterials.filter(m => m.type === 'foreshadowing');
        const activeForeshadowings = foreshadowings.filter(f => {
            const content = f.currentContent || f.initialContent || '';
            return !content.includes('已回收') && !content.includes('已废弃');
        });

        const l2 = {
            chapterNumber,
            recentSummaries: recentChapters.map(c => ({
                chapterNumber: c.chapterNumber,
                title: c.title,
                summary: c.summary || this._extractSummary(c.content),
                keyEvents: c.keyEvents || [],
                wordCount: c.wordCount || 0
            })),
            activeQuests: activeQuests.map(q => ({
                id: q.id,
                name: q.title || q.name,
                description: q.description,
                progress: q.progress || 0,
                priority: q.priority || 'medium'
            })),
            activeForeshadowings: activeForeshadowings.map(f => ({
                id: f.id,
                name: f.name,
                content: f.currentContent || f.initialContent,
                plantedChapter: f.plantedChapter || 0,
                urgency: this._calcForeshadowingUrgency(f, chapterNumber),
                relatedCharacters: f.relatedCharacters || []
            })),
            totalTokenEstimate: 0
        };

        l2.totalTokenEstimate = this._estimateTokens(JSON.stringify(l2));
        await this.setLayer(projectId, MEMORY_LAYERS.L2, l2);
        return l2;
    }

    async buildL3(projectId, chapterNumber, relevantKeywords = []) {
        const allMaterials = store.queryItems('materials', { projectId });
        const archivedMaterials = allMaterials.filter(m => m.archived);

        const chapters = store.queryItems('chapters', { projectId });
        const olderChapters = chapters
            .filter(c => c.chapterNumber < chapterNumber - 5)
            .sort((a, b) => b.chapterNumber - a.chapterNumber);

        const scored = [];
        for (const ch of olderChapters.slice(0, 50)) {
            const score = this._relevanceScore(
                ch.content || ch.outline || '',
                relevantKeywords
            );
            if (score > 0) {
                scored.push({
                    chapterNumber: ch.chapterNumber,
                    title: ch.title,
                    summary: ch.summary || this._extractSummary(ch.content),
                    relevanceScore: score
                });
            }
        }

        const relevantArchived = archivedMaterials
            .map(m => ({
                id: m.id,
                name: m.name,
                type: m.type,
                content: m.currentContent || m.initialContent,
                retiredAt: m.changeLog?.slice(-1)[0]?.timestamp
            }))
            .filter(m => {
                if (relevantKeywords.length === 0) return true;
                return this._relevanceScore(m.content || '', relevantKeywords) > 0;
            });

        const l3 = {
            chapterNumber,
            relevantHistory: scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10),
            archivedMaterials: relevantArchived.slice(0, 20),
            totalTokenEstimate: 0
        };

        l3.totalTokenEstimate = this._estimateTokens(JSON.stringify(l3));
        await this.setLayer(projectId, MEMORY_LAYERS.L3, l3);
        return l3;
    }

    async buildL4(projectId, chapterNumber) {
        const chapters = store.queryItems('chapters', { projectId });
        const sorted = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

        const volumes = {};
        const VOLUME_SIZE = 30;

        for (const ch of sorted) {
            const vol = Math.ceil(ch.chapterNumber / VOLUME_SIZE);
            if (!volumes[vol]) {
                volumes[vol] = {
                    volumeNumber: vol,
                    startChapter: (vol - 1) * VOLUME_SIZE + 1,
                    endChapter: vol * VOLUME_SIZE,
                    chapters: [],
                    summary: ''
                };
            }
            volumes[vol].chapters.push({
                chapterNumber: ch.chapterNumber,
                title: ch.title,
                summary: ch.summary || this._extractSummary(ch.content),
                keyEvents: ch.keyEvents || []
            });
        }

        const existingL4 = await this.getLayer(projectId, MEMORY_LAYERS.L4);
        if (existingL4?.volumes) {
            for (const [volNum, volData] of Object.entries(volumes)) {
                const existing = existingL4.volumes[volNum];
                if (existing?.summary && existing.chapters?.length === volData.chapters.length) {
                    volData.summary = existing.summary;
                }
            }
        }

        const l4 = {
            chapterNumber,
            volumes,
            totalTokenEstimate: 0
        };

        l4.totalTokenEstimate = this._estimateTokens(JSON.stringify(l4));
        await this.setLayer(projectId, MEMORY_LAYERS.L4, l4);
        return l4;
    }

    async assembleContext(projectId, chapterNumber, chapterOutline, model = 'default', options = {}) {
        const modelBudget = CONTEXT_BUDGETS[model] || CONTEXT_BUDGETS.default;
        const availableBudget = options.maxTokens
            ? Math.min(options.maxTokens, modelBudget)
            : modelBudget - (options.reservedTokens || 3000);

        const keywords = this._extractKeywords(chapterOutline || '');
        const mentionedChars = options.mentionedCharacters || [];

        const l0 = await this.getLayer(projectId, MEMORY_LAYERS.L0) || await this.buildL0(projectId);
        const l1 = await this.getLayer(projectId, MEMORY_LAYERS.L1) || await this.buildL1(projectId, chapterNumber);
        const l2 = await this.getLayer(projectId, MEMORY_LAYERS.L2) || await this.buildL2(projectId, chapterNumber, options.recentWindowSize || 5);
        const l4 = await this.getLayer(projectId, MEMORY_LAYERS.L4) || await this.buildL4(projectId, chapterNumber);

        const context = {
            core: null,
            activeStates: null,
            recentContext: null,
            volumeSummary: null,
            archiveContext: null,
            budgetUsed: 0,
            budgetTotal: availableBudget,
            layersIncluded: []
        };

        let remainingBudget = availableBudget;

        if (l0.totalTokenEstimate <= remainingBudget) {
            context.core = l0;
            remainingBudget -= l0.totalTokenEstimate;
            context.layersIncluded.push('L0');
        } else {
            context.core = this._compressL0(l0, remainingBudget);
            remainingBudget -= this._estimateTokens(JSON.stringify(context.core));
            context.layersIncluded.push('L0-compressed');
        }

        const relevantL1 = this._filterRelevantL1(l1, keywords, mentionedChars);
        const l1RecencyBoost = (l1.recencyScore || 50) / 100;
        const l1Tokens = Math.ceil(this._estimateTokens(JSON.stringify(relevantL1)) * (l1RecencyBoost < 0.3 ? 0.6 : 1));
        if (l1Tokens <= remainingBudget) {
            context.activeStates = relevantL1;
            remainingBudget -= l1Tokens;
            context.layersIncluded.push('L1');
        } else {
            context.activeStates = this._compressL1(relevantL1, remainingBudget);
            remainingBudget -= this._estimateTokens(JSON.stringify(context.activeStates));
            context.layersIncluded.push('L1-compressed');
        }

        const l2Tokens = l2.totalTokenEstimate;
        if (l2Tokens <= remainingBudget) {
            context.recentContext = l2;
            remainingBudget -= l2Tokens;
            context.layersIncluded.push('L2');
        } else {
            context.recentContext = this._compressL2(l2, remainingBudget);
            remainingBudget -= this._estimateTokens(JSON.stringify(context.recentContext));
            context.layersIncluded.push('L2-compressed');
        }

        const currentVol = Math.ceil(chapterNumber / 30);
        if (l4.volumes?.[currentVol]?.summary) {
            const volSummary = {
                currentVolume: l4.volumes[currentVol],
                adjacentVolumes: []
            };
            if (l4.volumes[currentVol - 1]?.summary) {
                volSummary.adjacentVolumes.push(l4.volumes[currentVol - 1]);
            }
            const volTokens = this._estimateTokens(JSON.stringify(volSummary));
            if (volTokens <= remainingBudget) {
                context.volumeSummary = volSummary;
                remainingBudget -= volTokens;
                context.layersIncluded.push('L4');
            }
        }

        if (remainingBudget > 500) {
            const l3 = await this.buildL3(projectId, chapterNumber, keywords);
            const l3Tokens = l3.totalTokenEstimate;
            if (l3Tokens <= remainingBudget) {
                context.archiveContext = l3;
                remainingBudget -= l3Tokens;
                context.layersIncluded.push('L3');
            } else {
                context.archiveContext = this._compressL3(l3, remainingBudget);
                remainingBudget -= this._estimateTokens(JSON.stringify(context.archiveContext));
                context.layersIncluded.push('L3-compressed');
            }
        }

        context.budgetUsed = availableBudget - remainingBudget;
        return context;
    }

    formatContextForPrompt(context) {
        const parts = [];

        if (context.core) {
            parts.push('【核心设定 - 不可违反】');
            if (context.core.worldRules?.length) {
                parts.push('世界观规则:');
                context.core.worldRules.forEach(r => {
                    parts.push(`  - ${r.name}: ${r.content}`);
                });
            }
            if (context.core.powerFramework?.length) {
                parts.push('战力体系:');
                context.core.powerFramework.forEach(p => {
                    parts.push(`  - ${p.name}: ${p.content}`);
                });
            }
            if (context.core.coreCharacters?.length) {
                parts.push('核心人物:');
                context.core.coreCharacters.forEach(c => {
                    parts.push(`  - ${c.name}: ${c.content}`);
                });
            }
        }

        if (context.activeStates) {
            parts.push('\n【当前活跃状态】');
            if (context.activeStates.characterStates) {
                const chars = Object.values(context.activeStates.characterStates);
                if (chars.length) {
                    parts.push('人物状态:');
                    chars.forEach(c => {
                        if (c.active !== false) {
                            parts.push(`  - ${c.name} | 位置:${c.location} | 状态:${c.status} | 战力:${c.powerLevel} | 情绪:${c.emotionalState}`);
                        }
                    });
                }
            }
            if (context.activeStates.relationshipStates) {
                const rels = Object.values(context.activeStates.relationshipStates);
                if (rels.length) {
                    parts.push('人物关系:');
                    rels.forEach(r => {
                        parts.push(`  - ${r.name}: ${r.content} (类型:${r.type} 强度:${r.strength})`);
                    });
                }
            }
            if (context.activeStates.equipmentStates) {
                const equips = Object.values(context.activeStates.equipmentStates);
                if (equips.length) {
                    parts.push('装备状态:');
                    equips.forEach(e => {
                        parts.push(`  - ${e.name} | 持有者:${e.owner} | 状态:${e.status}`);
                    });
                }
            }
            if (context.activeStates.growthStates) {
                const growths = Object.values(context.activeStates.growthStates);
                if (growths.length) {
                    parts.push('成长履历:');
                    growths.forEach(g => {
                        parts.push(`  - ${g.name}: ${g.content}`);
                        if (g.milestones?.length) {
                            g.milestones.forEach(m => {
                                parts.push(`    * 第${m.chapter}章: ${m.description}`);
                            });
                        }
                    });
                }
            }
        }

        if (context.recentContext) {
            parts.push('\n【近期上下文】');
            if (context.recentContext.recentSummaries?.length) {
                parts.push('近几章摘要:');
                context.recentContext.recentSummaries.forEach(s => {
                    parts.push(`  第${s.chapterNumber}章 ${s.title}: ${s.summary}`);
                });
            }
            if (context.recentContext.activeQuests?.length) {
                parts.push('进行中的主线任务:');
                context.recentContext.activeQuests.forEach(q => {
                    parts.push(`  - [${q.priority}] ${q.name}: ${q.description} (进度:${q.progress}%)`);
                });
            }
            if (context.recentContext.activeForeshadowings?.length) {
                parts.push('未回收伏笔:');
                context.recentContext.activeForeshadowings.forEach(f => {
                    const urgency = f.urgency > 70 ? '⚠️紧急' : f.urgency > 40 ? '注意' : '正常';
                    parts.push(`  - [${urgency}] ${f.name}: ${f.content} (埋于第${f.plantedChapter}章)`);
                });
            }
        }

        if (context.volumeSummary) {
            parts.push('\n【卷级摘要】');
            if (context.volumeSummary.adjacentVolumes?.length) {
                parts.push('上一卷概要:');
                context.volumeSummary.adjacentVolumes.forEach(v => {
                    if (v.summary) parts.push(`  第${v.volumeNumber}卷: ${v.summary}`);
                });
            }
            if (context.volumeSummary.currentVolume?.summary) {
                parts.push(`当前卷概要: ${context.volumeSummary.currentVolume.summary}`);
            }
        }

        if (context.archiveContext) {
            parts.push('\n【历史相关记忆】');
            if (context.archiveContext.relevantHistory?.length) {
                parts.push('相关历史章节:');
                context.archiveContext.relevantHistory.forEach(h => {
                    parts.push(`  第${h.chapterNumber}章 ${h.title}: ${h.summary}`);
                });
            }
            if (context.archiveContext.archivedMaterials?.length) {
                parts.push('已归档相关素材:');
                context.archiveContext.archivedMaterials.forEach(m => {
                    parts.push(`  - [${m.type}] ${m.name}: ${m.content}`);
                });
            }
        }

        return parts.join('\n');
    }

    async updateAfterChapter(projectId, chapterNumber, chapterContent, materialUpdates) {
        await this.buildL0(projectId);
        await this.buildL1(projectId, chapterNumber);
        await this.buildL2(projectId, chapterNumber);
        this._invalidateCache(projectId, MEMORY_LAYERS.L3);

        if (chapterNumber % 30 === 0) {
            await this.generateVolumeSummary(projectId, chapterNumber);
        }

        await this.buildL4(projectId, chapterNumber);
        await this.applyDecayAndCompress(projectId, chapterNumber);
    }

    async applyDecayAndCompress(projectId, currentChapter) {
        for (const layerName of ['L1', 'L2', 'L3', 'L4']) {
            const layer = await this.getLayer(projectId, MEMORY_LAYERS[layerName]);
            if (!layer) continue;

            const decayRate = LAYER_DECAY_RATES[layerName];
            if (decayRate === 0) continue;

            const chaptersSinceUpdate = currentChapter - (layer.chapterNumber || currentChapter);
            const decayFactor = Math.pow(1 - decayRate, Math.max(0, chaptersSinceUpdate));

            if (layer.recencyScore !== undefined) {
                layer.recencyScore = Math.max(RECENCY_FLOOR, layer.recencyScore * decayFactor);
            } else {
                layer.recencyScore = Math.max(RECENCY_FLOOR, 100 * decayFactor);
            }

            if (layer.recencyScore < COMPRESSION_THRESHOLD * 100) {
                await this.compressMemory(projectId, layerName, layer);
            } else {
                await this.setLayer(projectId, MEMORY_LAYERS[layerName], layer);
            }
        }
    }

    async compressMemory(projectId, layerName, layer) {
        switch (layerName) {
            case 'L1': {
                const compressed = { ...layer, characterStates: {}, relationshipStates: {}, equipmentStates: {}, growthStates: {} };
                const charEntries = Object.entries(layer.characterStates || {}).sort((a, b) => (b[1].recencyScore || 0) - (a[1].recencyScore || 0));
                for (const [id, state] of charEntries.slice(0, 5)) {
                    compressed.characterStates[id] = { ...state, currentContent: `${state.name}|位置:${state.location}|战力:${state.powerLevel}|状态:${state.status}` };
                }
                const relEntries = Object.entries(layer.relationshipStates || {}).sort((a, b) => (b[1].recencyScore || 0) - (a[1].recencyScore || 0));
                for (const [id, rel] of relEntries.slice(0, 3)) {
                    compressed.relationshipStates[id] = { ...rel, content: `${rel.name}: ${rel.type}(强度:${rel.strength})` };
                }
                compressed.recencyScore = layer.recencyScore;
                compressed.compressed = true;
                await this.setLayer(projectId, MEMORY_LAYERS.L1, compressed);
                break;
            }
            case 'L2': {
                const compressed = { ...layer, recentSummaries: (layer.recentSummaries || []).slice(-2).map(s => ({ ...s, summary: s.summary?.substring(0, 80) || '' })), activeForeshadowings: (layer.activeForeshadowings || []).filter(f => f.urgency > 50).slice(0, 3) };
                compressed.recencyScore = layer.recencyScore;
                compressed.compressed = true;
                await this.setLayer(projectId, MEMORY_LAYERS.L2, compressed);
                break;
            }
            case 'L3': {
                const compressed = { ...layer, relevantHistory: (layer.relevantHistory || []).slice(0, 3), archivedMaterials: (layer.archivedMaterials || []).slice(0, 5) };
                compressed.recencyScore = layer.recencyScore;
                compressed.compressed = true;
                await this.setLayer(projectId, MEMORY_LAYERS.L3, compressed);
                break;
            }
            case 'L4': {
                if (layer.volumes) {
                    const currentVol = Math.ceil((layer.chapterNumber || 1) / 30);
                    const keptVolumes = {};
                    if (layer.volumes[currentVol]) keptVolumes[currentVol] = layer.volumes[currentVol];
                    if (layer.volumes[currentVol - 1]) keptVolumes[currentVol - 1] = layer.volumes[currentVol - 1];
                    const compressed = { ...layer, volumes: keptVolumes };
                    compressed.recencyScore = layer.recencyScore;
                    compressed.compressed = true;
                    await this.setLayer(projectId, MEMORY_LAYERS.L4, compressed);
                }
                break;
            }
        }
    }

    async touchRecency(projectId, layerName, entryId) {
        const layer = await this.getLayer(projectId, MEMORY_LAYERS[layerName]);
        if (!layer) return;

        if (entryId && layer.characterStates?.[entryId]) {
            layer.characterStates[entryId].recencyScore = RECENCY_TOUCH_BOOST;
        } else if (entryId && layer.relationshipStates?.[entryId]) {
            layer.relationshipStates[entryId].recencyScore = RECENCY_TOUCH_BOOST;
        }
        layer.recencyScore = RECENCY_TOUCH_BOOST;
        await this.setLayer(projectId, MEMORY_LAYERS[layerName], layer);
    }

    async generateVolumeSummary(projectId, endChapterNumber) {
        const volumeNum = Math.ceil(endChapterNumber / 30);
        const startChapter = (volumeNum - 1) * 30 + 1;

        const chapters = store.queryItems('chapters', { projectId })
            .filter(c => c.chapterNumber >= startChapter && c.chapterNumber <= endChapter);

        const sorted = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
        const chapterSummaries = sorted.map(c =>
            `第${c.chapterNumber}章 ${c.title}: ${c.summary || this._extractSummary(c.content)}`
        ).join('\n');

        const l4 = await this.getLayer(projectId, MEMORY_LAYERS.L4) || { volumes: {} };
        if (!l4.volumes) l4.volumes = {};

        l4.volumes[volumeNum] = {
            ...l4.volumes[volumeNum],
            summary: `[本卷${sorted.length}章摘要] ${chapterSummaries.substring(0, 2000)}`,
            generatedAt: new Date().toISOString()
        };

        await this.setLayer(projectId, MEMORY_LAYERS.L4, l4);
        return l4.volumes[volumeNum];
    }

    _estimateTokens(text) {
        return sharedEstimateTokens(text);
    }

    _extractSummary(content) {
        if (!content) return '';
        const first500 = content.substring(0, 500);
        const sentences = first500.match(/[^。！？.!?]+[。！？.!?]/g) || [first500];
        return sentences.slice(0, 3).join('');
    }

    _extractKeywords(text) {
        if (!text) return [];
        const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
        const words = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
        const freq = {};
        words.forEach(w => {
            if (!stopWords.has(w)) {
                freq[w] = (freq[w] || 0) + 1;
            }
        });
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([w]) => w);
    }

    _relevanceScore(text, keywords) {
        if (!text || !keywords.length) return 0;
        let score = 0;
        for (const kw of keywords) {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            try {
                const regex = new RegExp(escaped, 'g');
                const matches = text.match(regex);
                if (matches) score += matches.length;
            } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        }
        return score;
    }

    _calcForeshadowingUrgency(foreshadowing, currentChapter) {
        const planted = foreshadowing.plantedChapter || 0;
        const gap = currentChapter - planted;
        if (gap > 50) return 90;
        if (gap > 30) return 70;
        if (gap > 15) return 50;
        return 20;
    }

    _filterRelevantL1(l1, keywords, mentionedCharacters) {
        if (!l1) return l1;
        const filtered = { ...l1, characterStates: { ...l1.characterStates }, relationshipStates: { ...l1.relationshipStates } };

        if (mentionedCharacters.length > 0 || keywords.length > 0) {
            const relevantCharIds = new Set();
            for (const [id, state] of Object.entries(l1.characterStates || {})) {
                const nameMatch = mentionedCharacters.some(mc => state.name?.includes(mc));
                const keywordMatch = keywords.some(kw => (state.currentContent || '').includes(kw) || (state.name || '').includes(kw));
                if (nameMatch || keywordMatch) {
                    relevantCharIds.add(id);
                }
            }

            for (const [id, state] of Object.entries(l1.characterStates || {})) {
                if (!relevantCharIds.has(id) && !state.name?.includes('主角')) {
                    filtered.characterStates[id] = { ...state, active: false };
                }
            }
        }

        return filtered;
    }

    _compressL0(l0, budget) {
        const compressed = { worldRules: [], powerFramework: [], coreCharacters: [] };
        let used = 0;

        for (const r of (l0.worldRules || [])) {
            const tokens = this._estimateTokens(r.content);
            if (used + tokens <= budget * 0.4) {
                compressed.worldRules.push({ ...r, content: r.content.substring(0, 200) });
                used += tokens;
            }
        }

        for (const p of (l0.powerFramework || [])) {
            const tokens = this._estimateTokens(p.content);
            if (used + tokens <= budget * 0.7) {
                compressed.powerFramework.push({ ...p, content: p.content.substring(0, 200) });
                used += tokens;
            }
        }

        for (const c of (l0.coreCharacters || [])) {
            const tokens = this._estimateTokens(c.content);
            if (used + tokens <= budget) {
                compressed.coreCharacters.push({ ...c, content: c.content.substring(0, 150) });
                used += tokens;
            }
        }

        return compressed;
    }

    _compressL1(l1, budget) {
        const compressed = { characterStates: {}, relationshipStates: {}, equipmentStates: {}, growthStates: {} };
        let used = 0;

        for (const [id, state] of Object.entries(l1.characterStates || {})) {
            const line = `${state.name}|位置:${state.location}|战力:${state.powerLevel}|状态:${state.status}`;
            const tokens = this._estimateTokens(line);
            if (used + tokens <= budget * 0.6) {
                compressed.characterStates[id] = { ...state, currentContent: line };
                used += tokens;
            }
        }

        for (const [id, rel] of Object.entries(l1.relationshipStates || {})) {
            const line = `${rel.name}: ${rel.type}(强度:${rel.strength})`;
            const tokens = this._estimateTokens(line);
            if (used + tokens <= budget * 0.8) {
                compressed.relationshipStates[id] = { ...rel, content: line };
                used += tokens;
            }
        }

        return compressed;
    }

    _compressL2(l2, budget) {
        const compressed = { ...l2, recentSummaries: [], activeForeshadowings: [] };
        let used = 0;

        for (const s of (l2.recentSummaries || [])) {
            const summary = s.summary?.substring(0, 100) || '';
            const tokens = this._estimateTokens(summary);
            if (used + tokens <= budget * 0.5) {
                compressed.recentSummaries.push({ ...s, summary });
                used += tokens;
            }
        }

        for (const f of (l2.activeForeshadowings || [])) {
            const content = f.content?.substring(0, 80) || '';
            const tokens = this._estimateTokens(content);
            if (used + tokens <= budget) {
                compressed.activeForeshadowings.push({ ...f, content });
                used += tokens;
            }
        }

        return compressed;
    }

    _compressL3(l3, budget) {
        const compressed = { ...l3, relevantHistory: [], archivedMaterials: [] };
        let used = 0;

        for (const h of (l3.relevantHistory || []).slice(0, 5)) {
            const tokens = this._estimateTokens(h.summary);
            if (used + tokens <= budget) {
                compressed.relevantHistory.push(h);
                used += tokens;
            }
        }

        return compressed;
    }
}

module.exports = new MemorySystem();
