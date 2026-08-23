/**
 * baby/detectorsCore.js
 */
const perspective = require('./perspectiveConfig');
const {
    buildParagraphContexts,
    checkBabyInnerVoice,
    checkBabyCausalReasoning,
    checkAdultInnerVoiceExcess,
    checkOmniscientNarration,
    checkBabyPresence
} = require('./detectorsHelpers');

module.exports = {
perspective(content, styleProfile) {
            if (!content) return { isViolation: false, issues: [] };

            const { paragraphs, contexts: paragraphContexts } = buildParagraphContexts(content);
            const issues = [];

            checkBabyInnerVoice(content, paragraphs, paragraphContexts, issues);
            checkBabyCausalReasoning(content, paragraphs, paragraphContexts, issues);
            checkAdultInnerVoiceExcess(content, paragraphContexts, paragraphs, issues);

            for (const { pattern, desc } of perspective.forbiddenPatterns) {
                if (pattern.test(content)) {
                    issues.push({ desc, pattern: pattern.source, severity: 'critical' });
                }
            }

            checkOmniscientNarration(content, paragraphs, paragraphContexts, issues);
            checkBabyPresence(content, issues);

            const criticalIssues = issues.filter(i => i.severity === 'critical');
            return {
                isViolation: criticalIssues.length > 0 || issues.filter(i => i.severity === 'high').length > 1,
                issues,
                hasCriticalIssue: criticalIssues.length > 0
            };
        },

};
