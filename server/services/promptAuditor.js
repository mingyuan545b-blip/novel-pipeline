const logger = require('../shared/logger');
const { getConceptRegistry, INFLATION_RULES } = require('./promptAuditConstants');

class PromptAuditor {
    constructor() {
        this.auditLog = [];
        this.lastAudit = null;
    }

    audit(systemPrompt, userPrompt, agentType, genreId) {
        const fullText = (systemPrompt || '') + '\n' + (userPrompt || '');
        const issues = [];
        const stats = { totalChars: fullText.length, systemChars: (systemPrompt || '').length, userChars: (userPrompt || '').length };

        // Concept duplication check
        const registry = getConceptRegistry(genreId);
        for (const concept of registry) {
            let count = 0;
            const locations = [];
            for (const kw of concept.keywords) {
                const matches = fullText.match(new RegExp(kw, 'g'));
                if (matches) {
                    count += matches.length;
                    locations.push({ keyword: kw, count: matches.length });
                }
            }
            if (count >= concept.threshold) {
                issues.push({
                    type: 'concept-duplication', conceptId: concept.id, conceptLabel: concept.label,
                    count, threshold: concept.threshold, severity: concept.severity,
                    fix: concept.fix, locations
                });
            }
        }

        // Inflation check
        for (const rule of INFLATION_RULES) {
            const matches = fullText.match(rule.pattern);
            const count = matches ? matches.length : 0;
            const maxCount = rule.maxCount || 2;
            if (count > maxCount) {
                issues.push({
                    type: 'inflation', desc: rule.desc, count, maxCount,
                    severity: rule.severity, fix: `减少"${rule.desc}"出现次数至${maxCount}次以内`
                });
            }
        }

        // Structure check
        const bracketBlocks = fullText.match(/【[^】]{5,}】/g) || [];
        stats.bracketBlocks = bracketBlocks.length;
        if (bracketBlocks.length > 15) {
            issues.push({
                type: 'structure', desc: '标记块过多', count: bracketBlocks.length,
                severity: 'low', fix: '合并相似标记块，减少标记块总数'
            });
        }

        // Length check
        if (fullText.length > 15000) {
            issues.push({
                type: 'length', desc: '提示词过长', count: fullText.length,
                severity: 'medium', fix: '精简提示词，移除重复内容，目标12000字以内'
            });
        }

        // Agent-specific checks
        if (agentType === 'writer' && fullText.length > 12000) {
            issues.push({
                type: 'agent-length', desc: '写作Agent提示词过长', count: fullText.length,
                severity: 'high', fix: '写作Agent提示词应控制在10000字以内，移除非必要约束'
            });
        }

        const audit = {
            timestamp: new Date().toISOString(), agentType, genreId,
            issues, stats,
            score: Math.max(0, 100 - issues.reduce((sum, i) => sum + (i.severity === 'high' ? 20 : i.severity === 'medium' ? 10 : 5), 0))
        };

        this.lastAudit = audit;
        this.auditLog.push(audit);
        if (this.auditLog.length > 50) this.auditLog = this.auditLog.slice(-50);

        if (issues.length > 0) {
            logger.info('promptAuditor', `[AUDIT] ${issues.length} issues found for ${agentType} (score: ${audit.score})`);
        }

        return audit;
    }

    getAuditHistory() { return [...this.auditLog]; }

    getLastAudit() { return this.lastAudit; }

    getConceptSummary(genreId) {
        const registry = getConceptRegistry(genreId);
        return registry.map(c => ({ id: c.id, label: c.label, threshold: c.threshold, severity: c.severity }));
    }

    suggestFixes(auditResult) {
        if (!auditResult || !auditResult.issues) return [];
        return auditResult.issues
            .filter(i => i.fix)
            .map(i => ({ type: i.type, desc: i.desc, fix: i.fix, severity: i.severity }));
    }

    async getFullReport(projectId, mode) {
        const report = {
            projectId,
            mode,
            timestamp: new Date().toISOString(),
            lastAudit: this.lastAudit,
            auditHistory: this.getAuditHistory(),
            conceptSummary: this.getConceptSummary(mode)
        };
        return report;
    }
}

module.exports = new PromptAuditor();
