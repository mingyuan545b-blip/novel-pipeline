/**
 * secondReviewParser.js — 复审结果解析与保存
 *
 * 从 secondReview.js 拆出，负责：
 * - parseSecondReviewResult: JSON解析+自动纠正+复审推翻初审校验+软硬分离+保存reviews表
 * - checkFirstReviewPassed: 从初审输出中解析passed字段
 *
 * 复审特有逻辑：复审不得以提高标准推翻初审，除非初审遗漏了Critical级硬伤
 */
const logger = require('../../../../shared/logger');
const { uuidv4, store, extractJSON, getMetrics } = require('./reviewShared');
const { autoCorrectContradiction, separateSoftFromHard } = require('./reviewSoftHardSeparator');

/**
 * 解析复审结果并保存到reviews表
 * @returns {Object|null} 返回未通过结果对象，通过时返回null
 */
async function parseSecondReviewResult(result, projectId, chapterId, round, chapter) {
    try {
        const parsed = extractJSON(result.response);
        if (!parsed) throw new Error('JSON extraction failed');

        // 自动纠正：passed=false但summary正向时改为通过
        autoCorrectContradiction(parsed, 'secondReview');

        // 复审推翻初审校验（SOP: 复审不得以提高标准推翻初审，除非初审遗漏了Critical级硬伤）
        // 解决问题：复审员自行提高标准，把初审已通过的风格偏好/OOC等升为issues导致pipeline失败
        if (!parsed.passed) {
            const firstReviewPassed = checkFirstReviewPassed(chapter.firstReviewOutput);
            const hasCriticalHardBlock = (parsed.issues || []).some(i => i.severity === 'critical' || i.severity === 'blocker');
            if (firstReviewPassed && !hasCriticalHardBlock) {
                logger.info('secondReview', `second-review override: first-review passed but second-review rejected without critical hardblock. Auto-passing to prevent standard inflation.`);
                parsed.passed = true;
                parsed._autoCorrected = true;
                parsed._overrideReason = '初审已通过且复审无Critical级硬伤，复审不得以提高标准推翻初审';
                // 将复审issues降级为suggestions，保留反馈但不阻断
                if (parsed.issues && parsed.issues.length > 0) {
                    parsed.suggestions = (parsed.suggestions || []).concat(parsed.issues.map(i => ({ title: i.title, description: i.violationReason || i.description || '' })));
                    parsed.issues = [];
                }
            }
        }

        // 软硬分离：无critical/blocker级issue时强制通过，软性issues降级为suggestions
        separateSoftFromHard(parsed, 'secondReview');

        const revId2 = uuidv4();
        await store.setItem('reviews', revId2, {
            id: revId2, chapterId, projectId, step: 'second-review', type: 'second-review',
            reviewer: 'second-review-agent', result: parsed, passed: !!parsed.passed,
            content: parsed.summary, issues: parsed.issues || [], suggestions: parsed.suggestions || [],
            round, createdAt: new Date().toISOString()
        });

        if (!parsed.passed) {
            try { getMetrics(projectId).recordAgentPassRate('second-review', false, chapter.chapterNumber); } catch (_) { logger.warn('secondReview', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'second-review', result, passed: false, feedback: parsed, chapter };
        }
    } catch (e) {
        return await fallbackMarkdownReview(result, projectId, chapterId, round, chapter);
    }
    return null;
}

/** JSON解析失败时降级到Markdown解析 */
async function fallbackMarkdownReview(result, projectId, chapterId, round, chapter) {
    logger.warn('secondReview', 'second-review JSON parse failed, fallback to markdown');
    const text = result.response || '';
    const criticalSection = text.match(/严重问题|重大缺陷|设定矛盾[\s\S]{0,200}/)?.[0] || '';
    const criticalIsEmpty = /(?:严重问题|重大缺陷)\s*\n\s*(?:\*\*无\*\*|无[。，.]|没有|不存在)/.test(criticalSection);
    const hasCriticalIssues = !criticalIsEmpty && /(?:设定矛盾|逻辑错误|重大缺陷|❌|⚠️|矛盾|不一致|冲突|断裂)/.test(text);
    const fallbackPassed = !hasCriticalIssues;
    const fallbackFeedback = {
        passed: fallbackPassed,
        summary: hasCriticalIssues ? '复审发现严重问题（Markdown格式）' : '复审通过（Markdown格式）',
        issues: hasCriticalIssues ? [{ description: '复审返回Markdown格式，检测到严重问题', severity: 'high' }] : [],
        suggestions: []
    };
    const revId2b = uuidv4();
    await store.setItem('reviews', revId2b, {
        id: revId2b, chapterId, projectId, step: 'second-review', type: 'second-review',
        reviewer: 'second-review-agent', result: fallbackFeedback, passed: fallbackPassed,
        content: fallbackFeedback.summary, issues: fallbackFeedback.issues, suggestions: [],
        round, createdAt: new Date().toISOString()
    });
    if (!fallbackPassed) {
        try { getMetrics(projectId).recordAgentPassRate('second-review', false, chapter.chapterNumber); } catch (_) { logger.warn('secondReview', _.message || _); }
        chapter.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapterId, chapter);
        return { step: 'second-review', result, passed: false, feedback: fallbackFeedback, chapter };
    }
    return null;
}

/**
 * 检查初审是否通过（从初审输出中解析passed字段）
 * @param {string} firstReviewOutput - 初审输出文本
 * @returns {boolean} 初审是否通过
 */
function checkFirstReviewPassed(firstReviewOutput) {
    if (!firstReviewOutput) return false;
    try {
        const parsed = extractJSON(firstReviewOutput);
        if (parsed && typeof parsed.passed === 'boolean') return parsed.passed;
    } catch (_) { /* JSON解析失败时降级到文本匹配，忽略解析错误 */ }
    // fallback: 检查文本中是否明确标"通过"
    return /✅\s*通过|初审结果[：:]\s*✅|passed["\s]*[:：]\s*true/i.test(firstReviewOutput);
}

module.exports = { parseSecondReviewResult, checkFirstReviewPassed };
