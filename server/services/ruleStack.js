const store = require('../store');

const RULE_LAYERS = {
    L1: { name: 'hard_facts', precedence: 100, scope: 'global', description: '硬事实层 - 世界观铁律、核心设定、战力体系规则' },
    L2: { name: 'author_intent', precedence: 80, scope: 'book', description: '作者意图层 - 创作方向、主题基调、角色核心定位' },
    L3: { name: 'planning', precedence: 60, scope: 'arc', description: '规划层 - 卷级大纲、章节大纲、情节走向' },
    L4: { name: 'current_task', precedence: 70, scope: 'local', description: '当前任务层 - 本章写作指令、即时调整、审核反馈' }
};

const OVERRIDE_EDGES = [
    { from: 'L4', to: 'L3', allowed: true, scope: 'current_chapter', description: '当前任务可覆盖规划（如审核反馈要求修改大纲走向）' },
    { from: 'L4', to: 'L2', allowed: false, scope: 'current_chapter', description: '当前任务不可覆盖作者意图（不能违背创作方向和主题）' },
    { from: 'L4', to: 'L1', allowed: false, scope: 'current_chapter', description: '当前任务不可覆盖硬事实（不能违反世界观铁律）' },
    { from: 'L3', to: 'L2', allowed: false, scope: 'current_arc', description: '规划不可覆盖作者意图' },
    { from: 'L3', to: 'L1', allowed: false, scope: 'current_arc', description: '规划不可覆盖硬事实' },
    { from: 'L2', to: 'L1', allowed: false, scope: 'book', description: '作者意图不可覆盖硬事实' }
];

const RULE_SECTIONS = {
    hard: ['worldview', 'power-system', 'character-core', 'worldview-rules'],
    soft: ['author-intent', 'current-focus', 'volume-outline', 'chapter-outline'],
    diagnostic: ['anti-ai-checks', 'continuity-audit', 'style-regression', 'hook-budget']
};

class RuleStack {
    constructor(projectId) {
        this.projectId = projectId;
    }

    _getRuleStore() {
        const project = store.getItem('projects', this.projectId);
        if (!project) return { rules: [], activeOverrides: [], version: 1 };
        if (!project.ruleStack) {
            project.ruleStack = { rules: [], activeOverrides: [], version: 1 };
            store.setItem('projects', this.projectId, project);
        }
        return project.ruleStack;
    }

    _saveRuleStore(data) {
        const project = store.getItem('projects', this.projectId);
        if (!project) return;
        project.ruleStack = { ...data, version: (data.version || 1) + 1, lastUpdated: new Date().toISOString() };
        store.setItem('projects', this.projectId, project);
    }

    addRule(ruleData) {
        const ruleStore = this._getRuleStore();
        const layer = ruleData.layer || 'L3';
        const layerConfig = RULE_LAYERS[layer];
        if (!layerConfig) throw new Error(`Invalid rule layer: ${layer}`);

        const rule = {
            id: ruleData.id || `R${String(ruleStore.rules.length + 1).padStart(3, '0')}`,
            layer,
            layerName: layerConfig.name,
            precedence: layerConfig.precedence,
            scope: layerConfig.scope,
            category: ruleData.category || 'soft',
            content: ruleData.content || '',
            source: ruleData.source || '',
            active: ruleData.active !== false,
            createdAt: new Date().toISOString()
        };

        ruleStore.rules.push(rule);
        this._saveRuleStore(ruleStore);
        return rule;
    }

    resolveConflict(higherRule, lowerRule) {
        const edge = OVERRIDE_EDGES.find(e =>
            e.from === higherRule.layer && e.to === lowerRule.layer
        );

        if (!edge) {
            return { canOverride: true, reason: 'No override constraint between these layers' };
        }

        return {
            canOverride: edge.allowed,
            reason: edge.description,
            fromLayer: higherRule.layer,
            toLayer: lowerRule.layer
        };
    }

    checkCompliance(action, targetLayer) {
        const ruleStore = this._getRuleStore();
        const targetLayerConfig = RULE_LAYERS[targetLayer];
        if (!targetLayerConfig) return { compliant: true, conflicts: [] };

        const conflicts = [];
        const activeRules = ruleStore.rules.filter(r => r.active);

        for (const rule of activeRules) {
            if (RULE_LAYERS[rule.layer].precedence > targetLayerConfig.precedence) {
                const edge = OVERRIDE_EDGES.find(e =>
                    e.from === targetLayer && e.to === rule.layer
                );
                if (edge && !edge.allowed) {
                    const actionViolates = this._checkViolation(action, rule);
                    if (actionViolates) {
                        conflicts.push({
                            ruleId: rule.id,
                            ruleLayer: rule.layer,
                            ruleContent: rule.content.substring(0, 100),
                            violation: actionViolates,
                            overrideAllowed: false,
                            reason: edge.description
                        });
                    }
                }
            }
        }

        return {
            compliant: conflicts.length === 0,
            conflicts
        };
    }

    _checkViolation(action, rule) {
        if (!rule.content || !action) return null;
        const content = rule.content.toLowerCase();
        const actionLower = action.toLowerCase();

        const prohibitionPatterns = [
            /不可|不能|禁止|不得|绝不|严禁|必须/,
            /不允许|不可以|勿|忌|杜绝/
        ];

        for (const pattern of prohibitionPatterns) {
            const match = content.match(pattern);
            if (match) {
                const beforeMatch = content.substring(0, match.index);
                const afterMatch = content.substring(match.index + match[0].length);
                const subject = beforeMatch.split(/[，。；、\s]/).pop() || '';
                const object = afterMatch.split(/[，。；、\s]/)[0] || '';

                if (subject && actionLower.includes(subject) && object && actionLower.includes(object)) {
                    return `规则 ${rule.id} 禁止: ${subject} ${match[0]} ${object}`;
                }
            }
        }

        return null;
    }

    getEffectiveRules(context) {
        const ruleStore = this._getRuleStore();
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

        if (context === 'review') {
            return sorted.filter(r =>
                r.layer === 'L1' || r.layer === 'L2'
            );
        }

        return sorted;
    }

    extractRulesFromMaterials() {
        const materials = store.queryItems('materials', { projectId: this.projectId });
        const ruleStore = this._getRuleStore();
        const existingContents = new Set(ruleStore.rules.map(r => r.content));
        let imported = 0;

        const worldviewMats = materials.filter(m =>
            ['worldview', 'power-system'].includes(m.type) && !m.archived
        );
        for (const mat of worldviewMats) {
            const content = mat.currentContent || '';
            const rules = this._extractProhibitionRules(content, mat.name);
            for (const rule of rules) {
                if (!existingContents.has(rule.content)) {
                    this.addRule({
                        layer: 'L1',
                        category: 'hard',
                        content: rule.content,
                        source: `素材:${mat.name}`
                    });
                    existingContents.add(rule.content);
                    imported++;
                }
            }
        }

        const charMats = materials.filter(m =>
            m.type === 'character' && !m.archived && (m.tags?.includes('主角') || m.tags?.includes('核心'))
        );
        for (const mat of charMats) {
            const content = mat.currentContent || '';
            const coreTraits = this._extractCoreTraits(content, mat.name);
            for (const trait of coreTraits) {
                if (!existingContents.has(trait)) {
                    this.addRule({
                        layer: 'L2',
                        category: 'soft',
                        content: trait,
                        source: `角色:${mat.name}`
                    });
                    existingContents.add(trait);
                    imported++;
                }
            }
        }

        return imported;
    }

    _extractProhibitionRules(content, sourceName) {
        const rules = [];
        const patterns = [
            /(?:不可|不能|禁止|不得|绝不|严禁|必须)[^。，；\n]{2,30}/g,
            /(?:铁律|硬规则|绝对规则)[：:]\s*[^。，；\n]{2,50}/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const ruleText = match[0].trim();
                if (ruleText.length >= 4 && ruleText.length <= 60) {
                    rules.push({ content: `[${sourceName}] ${ruleText}` });
                }
            }
        }

        return rules;
    }

    _extractCoreTraits(content, charName) {
        const traits = [];
        const traitPatterns = [
            /性格[：:]\s*([^。，；\n]{2,30})/g,
            /核心特质[：:]\s*([^。，；\n]{2,30})/g,
            /人格[类型]?[：:]\s*([^。，；\n]{2,30})/g
        ];

        for (const pattern of traitPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const trait = match[1].trim();
                if (trait.length >= 2) {
                    traits.push(`[${charName}] 性格必须一致: ${trait}`);
                }
            }
        }

        return traits;
    }

    formatRuleStackForPrompt(context) {
        const rules = this.getEffectiveRules(context);
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

    getStackSummary() {
        const ruleStore = this._getRuleStore();
        const rules = ruleStore.rules || [];
        const active = rules.filter(r => r.active);

        const byLayer = {};
        for (const r of active) {
            byLayer[r.layer] = (byLayer[r.layer] || 0) + 1;
        }

        return {
            total: rules.length,
            active: active.length,
            byLayer,
            overrideEdges: OVERRIDE_EDGES,
            activeOverrides: ruleStore.activeOverrides || []
        };
    }
}

function getRuleStackForProject(projectId) {
    return new RuleStack(projectId);
}

module.exports = {
    RuleStack,
    getRuleStackForProject,
    RULE_LAYERS,
    OVERRIDE_EDGES,
    RULE_SECTIONS
};
