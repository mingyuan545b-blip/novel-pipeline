const store = require('../../store');
const { extractJSON } = require('../jsonUtils');

async function getReaderAdvisory(projectId, chapterNumber) {
    const advisory = {
        hardConstraints: [],
        softSuggestions: [],
        outlineAmendmentNeeded: false,
        outlineAmendmentReason: '',
        readerScore: null,
        readerWarning: false
    };

    const chaptersWithReader = (await store.queryItems('chapters', { projectId }))
        .filter(c => c.readerOutput && c.chapterNumber < chapterNumber)
        .sort((a, b) => b.chapterNumber - a.chapterNumber)
        .slice(0, 3);

    for (const ch of chaptersWithReader) {
        try {
            const parsed = extractJSON(ch.readerOutput);
            if (!parsed) continue;

            if (parsed.hardIssues && Array.isArray(parsed.hardIssues)) {
                for (const issue of parsed.hardIssues) {
                    advisory.hardConstraints.push({
                        chapter: ch.chapterNumber,
                        type: issue.type,
                        description: issue.description,
                        evidence: issue.evidence || '',
                        fixSuggestion: issue.fixSuggestion || '',
                        priority: 'L1-hard'
                    });
                }
            }

            if (parsed.readerExperience) {
                advisory.softSuggestions.push({
                    chapter: ch.chapterNumber,
                    experience: typeof parsed.readerExperience === 'string'
                        ? parsed.readerExperience.substring(0, 300)
                        : JSON.stringify(parsed.readerExperience).substring(0, 300),
                    priority: 'L1-soft'
                });
            }

            if (parsed.overallScore !== undefined && parsed.overallScore !== null) {
                advisory.readerScore = parsed.overallScore;
            }

            if (parsed.wantToContinue === false) {
                advisory.readerWarning = true;
                advisory.outlineAmendmentNeeded = true;
                advisory.outlineAmendmentReason = `第${ch.chapterNumber}章阅读者评分${parsed.overallScore || '?'}，不想继续阅读：${(parsed.readerExperience || '').substring(0, 200)}`;
            }
        } catch (_) { /* advisory optional */ }
    }

    if (advisory.readerScore !== null && advisory.readerScore <= 4) {
        advisory.readerWarning = true;
        if (!advisory.outlineAmendmentNeeded) {
            advisory.outlineAmendmentNeeded = true;
            advisory.outlineAmendmentReason = `阅读者评分持续低于4分(${advisory.readerScore})，需要调整剧情走向`;
        }
    }

    return advisory;
}

function formatAdvisoryForIntent(advisory) {
    const parts = [];

    if (advisory.hardConstraints.length > 0) {
        parts.push('## 🔴 阅读者硬伤约束（L1强制——必须避免，优先级高于大纲细节）');
        for (const hc of advisory.hardConstraints.slice(0, 5)) {
            parts.push(`- [Ch${hc.chapter}] ${hc.type}: ${hc.description}`);
            if (hc.fixSuggestion) parts.push(`  修正建议: ${hc.fixSuggestion}`);
        }
        parts.push('');
    }

    if (advisory.softSuggestions.length > 0) {
        parts.push('## 🟡 阅读者体验建议（L1建议——尽量采纳，可覆盖大纲细节）');
        for (const ss of advisory.softSuggestions.slice(0, 3)) {
            parts.push(`- [Ch${ss.chapter}] ${ss.experience}`);
        }
        parts.push('');
    }

    if (advisory.readerWarning) {
        parts.push('## ⚠️ 阅读者弃书警告（必须在本章做出改变！）');
        parts.push(advisory.outlineAmendmentReason);
        parts.push('');
    }

    return parts.join('\n');
}

function formatAdvisoryForOutline(advisory) {
    const parts = [];

    if (advisory.hardConstraints.length > 0) {
        const issueTypes = [...new Set(advisory.hardConstraints.map(h => h.type))];
        parts.push(`【阅读者发现的跨章硬伤类型: ${issueTypes.join('、')}】`);
        parts.push('生成大纲时必须避免这些硬伤：');
        for (const hc of advisory.hardConstraints.slice(0, 5)) {
            parts.push(`- ${hc.type}: ${hc.description} (修正: ${hc.fixSuggestion || '自行判断'})`);
        }
    }

    if (advisory.readerWarning) {
        parts.push('');
        parts.push('【⚠️ 阅读者弃书警告——必须调整剧情走向】');
        parts.push(advisory.outlineAmendmentReason);
        parts.push('新大纲必须解决上述问题，不能继续原来的走向！');
    }

    if (advisory.softSuggestions.length > 0) {
        parts.push('');
        parts.push('【阅读者体验反馈——建议参考】');
        for (const ss of advisory.softSuggestions.slice(0, 2)) {
            parts.push(`- ${ss.experience}`);
        }
    }

    return parts.join('\n');
}

module.exports = { getReaderAdvisory, formatAdvisoryForIntent, formatAdvisoryForOutline };
