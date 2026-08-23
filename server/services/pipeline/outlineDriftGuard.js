/**
 * 大纲偏移检测模块
 * 生成大纲后检测题材偏移，自动拦截并生成重试提示
 */

// 偏移模式定义：constraintId → 禁止模式
const DRIFT_PATTERNS = {
    'anti-bazong': {
        label: '霸总偏移',
        patterns: [
            { regex: /霸道地.*拉|不由分说.*拉|强行.*带走/g, desc: '霸总式强行拉人' },
            { regex: /你是我的|你只能.*我的|不许.*离开/g, desc: '霸总式占有宣言' },
            { regex: /黑卡|无限额|随便刷|不差钱/g, desc: '霸总式用钱解决' },
            { regex: /总裁|CEO|董事长.*少爷|金主|包养/g, desc: '霸总身份标签' },
            { regex: /强行安排.*生活|用钱解决.*问题/g, desc: '霸总式控制' },
            { regex: /签了.*合同|协议.*结婚|契约.*婚姻/g, desc: '霸总式契约' }
        ],
        retryHint: '注意：本题材严禁霸总元素！男主是手艺人不是霸总，保护方式是修工具/挡客户/放咖啡/用作品说话。请重新生成。'
    }
};

/**
 * 检测大纲中的题材偏移
 * @param {Array} outlines - 大纲数组 [{chapterNumber, title, outline}]
 * @param {Object} genre - 题材插件对象
 * @returns {{ hasDrift: boolean, issues: Array, retryHint: string }}
 */
function detectOutlineDrift(outlines, genre) {
    if (!outlines || !outlines.length || !genre) {
        return { hasDrift: false, issues: [], retryHint: '' };
    }

    const constraints = genre.foundation?.additionalConstraints || [];
    const allIssues = [];
    const retryHints = [];

    for (const constraint of constraints) {
        const driftDef = DRIFT_PATTERNS[constraint.id];
        if (!driftDef) continue;

        for (const outline of outlines) {
            const text = `${outline.title || ''} ${outline.outline || ''}`;
            for (const { regex, desc } of driftDef.patterns) {
                const re = new RegExp(regex.source, 'g');
                const matches = [];
                let m;
                while ((m = re.exec(text)) !== null) matches.push(m[0]);
                if (matches.length > 0) {
                    allIssues.push({
                        chapter: outline.chapterNumber,
                        title: outline.title,
                        type: driftDef.label,
                        desc,
                        matches: matches.slice(0, 3)
                    });
                }
            }
        }

        if (allIssues.length > 0) {
            retryHints.push(driftDef.retryHint);
        }
    }

    return {
        hasDrift: allIssues.length > 0,
        issues: allIssues,
        retryHint: retryHints.join('\n')
    };
}

/**
 * 生成偏移报告日志
 * @param {{ hasDrift: boolean, issues: Array }} driftResult
 * @returns {string}
 */
function formatDriftReport(driftResult) {
    if (!driftResult.hasDrift) return '大纲偏移检测: PASS (0 issues)';

    const lines = [`大纲偏移检测: FAIL (${driftResult.issues.length} issues)`];
    const byChapter = {};
    for (const issue of driftResult.issues) {
        const key = `Ch${issue.chapter}`;
        if (!byChapter[key]) byChapter[key] = [];
        byChapter[key].push(`${issue.type}: ${issue.desc} (${issue.matches.join(', ')})`);
    }
    for (const [ch, issues] of Object.entries(byChapter)) {
        lines.push(`  ${ch}: ${issues.join('; ')}`);
    }
    return lines.join('\n');
}

module.exports = { detectOutlineDrift, formatDriftReport, DRIFT_PATTERNS };
