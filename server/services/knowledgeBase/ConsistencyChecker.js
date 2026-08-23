'use strict';

const store = require('../../store');

const CONSISTENCY_TYPE = 'consistency-checks';

class ConsistencyChecker {
    async recordCheck(projectId, chapterNumber, checkType, description, options = {}) {
        const id = `cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const check = {
            id,
            projectId,
            chapterNumber,
            checkType,
            severity: options.severity || 'warning',
            entityId: options.entityId || null,
            description,
            expectedValue: options.expectedValue || '',
            actualValue: options.actualValue || '',
            isResolved: false,
            resolvedChapter: null
        };

        await store.setItem(CONSISTENCY_TYPE, id, check);
        return check;
    }

    async getUnresolved(projectId) {
        const all = await store.queryItems(CONSISTENCY_TYPE, { projectId });
        return all.filter(c => !c.isResolved);
    }

    async resolveCheck(checkId, resolvedChapter) {
        const check = await store.getItem(CONSISTENCY_TYPE, checkId);
        if (!check) return;
        check.isResolved = true;
        check.resolvedChapter = resolvedChapter;
        await store.setItem(CONSISTENCY_TYPE, checkId, check);
    }

    async checkNameConsistency(projectId, chapterNumber, textContent, knownEntities) {
        const issues = [];
        for (const entity of knownEntities) {
            if (!entity.name) continue;
            const nameVariants = this._getNameVariants(entity.name);
            const regex = new RegExp(nameVariants.join('|'), 'g');
            const matches = textContent.match(regex);
            if (matches) {
                for (const match of matches) {
                    if (match !== entity.name && entity.roleLevel === 'protagonist') {
                        issues.push({
                            checkType: 'name',
                            severity: 'warning',
                            entityId: entity.id,
                            description: `主角"${entity.name}"在正文中被称呼为"${match}"`,
                            expectedValue: entity.name,
                            actualValue: match
                        });
                    }
                }
            }
        }
        return issues;
    }

    _getNameVariants(name) {
        const variants = [name];
        if (name.length >= 2) {
            variants.push(name.substring(0, 1));
            variants.push(name.substring(name.length - 1));
        }
        return variants;
    }
}

module.exports = ConsistencyChecker;
