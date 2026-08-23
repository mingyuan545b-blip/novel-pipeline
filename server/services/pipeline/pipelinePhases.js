const { isLLMOverloaded, isLLMTimeout, isContextOverflow } = require('../../shared/errors');

function formatReviewFeedback(feedback) {
    if (!feedback) return '';
    const parts = [];
    if (feedback.summary) parts.push(`【总结】${feedback.summary}`);
    if (feedback.issues && feedback.issues.length > 0) {
        const criticalIssues = feedback.issues.filter(i => {
            const desc = typeof i === 'string' ? i : (i.severity || '');
            return desc === 'critical' || desc === 'major';
        });
        const allIssues = feedback.issues.map((issue, idx) => {
            if (typeof issue === 'string') return `${idx + 1}.  ${issue}`;
            const severity = issue.severity ? `[${issue.severity}] ` : '';
            const desc = issue.description || issue.desc || '';
            return `${idx + 1}. ${severity}${desc}`;
        });
        parts.push(`【必须修改的问题】\n${allIssues.join('\n')}`);
    }
    if (feedback.suggestions && feedback.suggestions.length > 0) {
        parts.push(`【修改建议】\n${feedback.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
    }
    return parts.join('\n');
}

function classifyError(error) {
    const isOverloaded = isLLMOverloaded(error);
    const isContextErr = isContextOverflow(error);
    const isTimeout = isLLMTimeout(error);
    return { isOverloaded, isContextErr, isTimeout };
}

function checkWordCountHardGate(wordCount, minWords, maxWords, step) {
    const reviewSteps = ['first-review', 'fast-review', 'second-review'];
    if (!reviewSteps.includes(step)) return null;
    if (wordCount < minWords) {
        return {
            passed: false,
            type: 'under',
            feedback: {
                summary: `字数不足，低于最低要求${minWords}字`,
                issues: [{ description: `当前字数${wordCount}，低于最低要求${minWords}字`, severity: 'critical' }],
                scheduleNote: `字数硬拦截：${wordCount} < ${minWords}`
            }
        };
    }
    if (wordCount > maxWords) {
        return {
            passed: false,
            type: 'over',
            feedback: {
                summary: `字数超出上限${maxWords}字`,
                issues: [{ description: `当前字数${wordCount}，超出上限${maxWords}字`, severity: 'major' }],
                scheduleNote: `字数硬拦截：${wordCount} > ${maxWords}`
            }
        };
    }
    return null;
}

function preflightMaterialCheck(materials, step) {
    if (!materials || materials.length === 0) return { ok: true };
    return { ok: true };
}

module.exports = { formatReviewFeedback, classifyError, checkWordCountHardGate, preflightMaterialCheck };
