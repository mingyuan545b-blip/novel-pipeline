const store = require('../store');
const { getDataContext } = require('./dataContext');
const { RULE_LAYERS, OVERRIDE_EDGES } = require('./ruleStackConstants');
const { checkViolation, extractProhibitionRules, extractCoreTraits } = require('./ruleStackExtractors');

class RuleStack {
    constructor(projectId) {
        this.projectId = projectId;
    }

    async _getRuleStore() {
        const _rsCtx = await getDataContext(this.projectId);
        const project = await _rsCtx.getProject();
        if (!project) return { rules: [], activeOverrides: [], version: 1 };
        if (!project.ruleStack) {
            project.ruleStack = { rules: [], activeOverrides: [], version: 1 };
            await store.setItem('projects', this.projectId, project);
        }
        return project.ruleStack;
    }

    async _saveRuleStore(data) {
        const _rssCtx = await getDataContext(this.projectId);
        const project = await _rssCtx.getProject();
        if (!project) return;
        project.ruleStack = { ...data, version: (data.version || 1) + 1, lastUpdated: new Date().toISOString() };
        await store.setItem('projects', this.projectId, project);
    }

    async addRule(ruleData) {
        const ruleStore = await this._getRuleStore();
        const layer = ruleData.layer || 'L3';
        const layerConfig = RULE_LAYERS[layer];
        if (!layerConfig) throw new Error(`Invalid rule layer: ${layer}`);

        const rule = {
            id: ruleData.id || `R${String(ruleStore.rules.length + 1).padStart(3, '0')}`,
            layer, layerName: layerConfig.name, precedence: layerConfig.precedence,
            scope: layerConfig.scope, category: ruleData.category || 'soft',
            content: ruleData.content || '', source: ruleData.source || '',
            active: ruleData.active !== false, createdAt: new Date().toISOString()
        };

        ruleStore.rules.push(rule);
        await this._saveRuleStore(ruleStore);
        return rule;
    }

    resolveConflict(higherRule, lowerRule) {
        const edge = OVERRIDE_EDGES.find(e => e.from === higherRule.layer && e.to === lowerRule.layer);
        if (!edge) return { canOverride: true, reason: 'No override constraint between these layers' };
        return { canOverride: edge.allowed, reason: edge.description, fromLayer: higherRule.layer, toLayer: lowerRule.layer };
    }

    async checkCompliance(action, targetLayer) {
        const ruleStore = await this._getRuleStore();
        const targetLayerConfig = RULE_LAYERS[targetLayer];
        if (!targetLayerConfig) return { compliant: true, conflicts: [] };

        const conflicts = [];
        const activeRules = ruleStore.rules.filter(r => r.active);

        for (const rule of activeRules) {
            if (RULE_LAYERS[rule.layer].precedence > targetLayerConfig.precedence) {
                const edge = OVERRIDE_EDGES.find(e => e.from === targetLayer && e.to === rule.layer);
                if (edge && !edge.allowed) {
                    const actionViolates = checkViolation(action, rule);
                    if (actionViolates) {
                        conflicts.push({
                            ruleId: rule.id, ruleLayer: rule.layer,
                            ruleContent: rule.content.substring(0, 100),
                            violation: actionViolates, overrideAllowed: false, reason: edge.description
                        });
                    }
                }
            }
        }

        return { compliant: conflicts.length === 0, conflicts };
    }

    async getEffectiveRules(context) {
        const ruleStore = await this._getRuleStore();
        const activeRules = ruleStore.rules.filter(r => r.active);
        const sorted = [...activeRules].sort((a, b) =>
            (RULE_LAYERS[b.layer]?.precedence || 0) - (RULE_LAYERS[a.layer]?.precedence || 0)
        );

        if (context === 'writer') {
            return sorted.filter(r =>
                r.layer === 'L1' || r.layer === 'L2' ||
                (r.layer === 'L3' && r.category !== 'diagnostic') ||
                (r.layer === 'L4' && r.source === 'review-feedback')
            );
        }
        if (context === 'review') return sorted.filter(r => r.layer === 'L1' || r.layer === 'L2');
        return sorted;
    }

    async extractRulesFromMaterials() {
        const materials = await store.queryItems('materials', { projectId: this.projectId });
        const ruleStore = await this._getRuleStore();
        const existingContents = new Set(ruleStore.rules.map(r => r.content));
        let imported = 0;

        const worldviewMats = materials.filter(m => ['worldview', 'power-system'].includes(m.type) && !m.archived);
        for (const mat of worldviewMats) {
            const content = mat.currentContent || '';
            const rules = extractProhibitionRules(content, mat.name);
            for (const rule of rules) {
                if (!existingContents.has(rule.content)) {
                    await this.addRule({ layer: 'L1', category: 'hard', content: rule.content, source: `素材:${mat.name}` });
                    existingContents.add(rule.content);
                    imported++;
                }
            }
        }

        const charMats = materials.filter(m => m.type === 'character' && !m.archived && (m.tags?.includes('主角') || m.tags?.includes('核心')));
        for (const mat of charMats) {
            const content = mat.currentContent || '';
            const coreTraits = extractCoreTraits(content, mat.name);
            for (const trait of coreTraits) {
                if (!existingContents.has(trait)) {
                    await this.addRule({ layer: 'L2', category: 'soft', content: trait, source: `角色:${mat.name}` });
                    existingContents.add(trait);
                    imported++;
                }
            }
        }

        return imported;
    }

    async formatRuleStackForPrompt(context) {
        const rules = await this.getEffectiveRules(context);
        const lines = [];
        lines.push('【规则栈 - 分层优先级】');
        lines.push('优先级: L1硬事实(100) > L2作者意图(80) > L4当前任务(70) > L3规划(60)');
        lines.push('覆盖约束: 当前任务可覆盖规划，但不可覆盖作者意图和硬事实');
        lines.push('');

        const byLayer = {};
        for (const rule of rules) {
            const key = rule.layer;
            if (!byLayer[key]) byLayer[key] = [];
            byLayer[key].push(rule);
        }

        for (const [layer, layerRules] of Object.entries(byLayer)) {
            const config = RULE_LAYERS[layer];
            if (!config) continue;
            lines.push(`### ${layer} ${config.name} (优先级${config.precedence})`);
            for (const r of layerRules) {
                lines.push(`- [${r.id}] ${r.content.substring(0, 80)}${r.source ? ` (来源:${r.source})` : ''}`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    async getStackSummary() {
        const ruleStore = await this._getRuleStore();
        const rules = ruleStore.rules || [];
        const active = rules.filter(r => r.active);
        const byLayer = {};
        for (const r of active) { byLayer[r.layer] = (byLayer[r.layer] || 0) + 1; }
        return { total: rules.length, active: active.length, byLayer, overrideEdges: OVERRIDE_EDGES, activeOverrides: ruleStore.activeOverrides || [] };
    }
}

function getRuleStackForProject(projectId) {
    return new RuleStack(projectId);
}

module.exports = { RuleStack, getRuleStackForProject };
