const PROXIMITY_THRESHOLD = 200;

const TOPIC_KEYWORDS = {
    dialect: ['方言', '口音', '乡音', '说话方式', '用语', '用词'],
    style: ['风格', '说话风格', '表达方式', '语气', '口吻', '措辞'],
    humor: ['幽默', '搞笑', '喜剧', '笑点', '吐槽', '玩笑']
};

const ISSUE_KEYWORDS = ['不当', '不规范', '不自然', '错误', '违和', '不合适', '不严肃', '不妥', '不协调', '过度', '过多', '泛滥', '超标', '有误', '不符合', '不对', '有问题', '奇怪'];

// 陷阱#43: override治理——同类问题连续3章被override，第4次禁止override
// 详见 SOP: docs/sop/08-约束执行规范.md 第四节
const { checkOverrideEligibility, recordOverride, shouldOverridePerspectiveViolation } = require('./overrideGovernance');

function _checkProximity(text, topicWords, issueWords, threshold) {
    const topicPositions = [];
    const issuePositions = [];
    for (const tw of topicWords) {
        let idx = text.indexOf(tw);
        while (idx !== -1) {
            topicPositions.push(idx);
            idx = text.indexOf(tw, idx + 1);
        }
    }
    for (const iw of issueWords) {
        let idx = text.indexOf(iw);
        while (idx !== -1) {
            issuePositions.push(idx);
            idx = text.indexOf(iw, idx + 1);
        }
    }
    if (topicPositions.length === 0 || issuePositions.length === 0) return false;
    for (const tp of topicPositions) {
        for (const ip of issuePositions) {
            if (Math.abs(tp - ip) <= threshold) return true;
        }
    }
    return false;
}

function _hasDialectInContent(chapterContent) {
    if (!chapterContent || typeof chapterContent !== 'string') return false;
    try {
        const dialectRegistry = require('../dialectRegistry');
        const regex = dialectRegistry.getIdentifierCharsRegex();
        return regex.test(chapterContent);
    } catch (_) {
        return false;
    }
}

// 陷阱#43: override从"关键词判断"升级为"规则式判断"+"治理闭环"
// 详见 SOP: docs/sop/08-约束执行规范.md 第四节
async function shouldOverrideReviewRejection(stepResult, chapterContent, systemWordCount, rejectMinWords, projectMaterials, project, overrideCtx = {}) {
    if (!stepResult || stepResult.passed) return { override: false };
    const feedback = stepResult.feedback || {};
    const safeMaterials = Array.isArray(projectMaterials) ? projectMaterials : [];

    // 硬性拦截不可覆盖：管线元数据泄露、敏感词、题材hardBlock等critical问题必须修复，不允许override
    if (feedback._hardBlock === true) return { override: false };
    const hasCriticalHardBlock = (feedback.issues || []).some(i =>
        i.severity === 'critical' && (i._hardBlock === true || feedback._hardBlock === true)
    );
    if (hasCriticalHardBlock) return { override: false };

    const summary = (feedback.summary || '') + ' ' + (feedback.scheduleNote || '');
    const issues = feedback.issues || [];
    const allText = summary + ' ' + issues.map(i => typeof i === 'string' ? i : (i.desc || i.description || '')).join(' ');

    // 视角违规误判校验（规则式判断，非关键词判断）
    // 陷阱#43: 原逻辑"原文有仿佛=视角误判"过宽，"仿佛"成免死金牌
    // 新规则：(1)主语必须是主角 (2)不能直接陈述NPC内心 (3)必须是外部观察或主观推测
    // 且受override治理：同类问题连续3章被override，第4次禁止
    const povViolationIssues = issues.filter(i =>
        (i.title || '').includes('视角') || (i.violationReason || '').includes('视角') || (i.violationReason || '').includes('上帝')
    );
    const nonPovCriticalIssues = issues.filter(i =>
        i.severity === 'critical' &&
        !(i.title || '').includes('视角') && !(i.violationReason || '').includes('视角') && !(i.violationReason || '').includes('上帝')
    );
    if (povViolationIssues.length > 0 && nonPovCriticalIssues.length === 0) {
        const projectId = overrideCtx.projectId || project?.id;
        const chapterNumber = overrideCtx.chapterNumber || project?.currentChapter;
        const protagonistName = overrideCtx.protagonistName || safeMaterials.find(m => m.type === 'character' && m.tags?.includes('主角'))?.name;

        // 规则式判断（非关键词）
        const allPovOriginalText = povViolationIssues.map(i => (i.originalText || '') + ' ' + (i.targetText || '')).join(' ');
        const isPerspectiveFalsePositive = shouldOverridePerspectiveViolation({ originalText: allPovOriginalText }, protagonistName);

        if (isPerspectiveFalsePositive) {
            // override治理：检查是否已连续3章override同类问题
            if (projectId && chapterNumber) {
                const governance = await checkOverrideEligibility(projectId, 'perspective-violation');
                if (!governance.eligible) {
                    return { override: false, reason: governance.reason };
                }
                await recordOverride(projectId, chapterNumber, 'perspective-violation', '规则式判断：主语为主角+外部观察/主观推测+无直接内心陈述', governance.eligible ? 'eligible' : 'blocked');
            }
            return { override: true, reason: '视角违规判定为误判（规则式判断：主语为主角+外部观察/主观推测+无直接NPC内心陈述）。受override治理：连续3次后禁止override。' };
        }
    }

    if (systemWordCount && rejectMinWords && systemWordCount >= rejectMinWords) {
        const isWordCountRejection = /字数.*不足|字数.*低于|字数.*未达|字数硬拦截|低于.*字|不足.*字|字数.*硬底线|字数.*红线/.test(allText);
        // 字数override仅当issues中只有字数相关问题时才生效，存在其他critical/high问题时不override
        if (isWordCountRejection) {
            const nonWordCountCritical = issues.some(i =>
                (i.severity === 'critical' || i.severity === 'high') &&
                !/字数/.test(i.desc || i.description || i.title || '')
            );
            if (!nonWordCountCritical) {
                return { override: true, reason: `系统统计字数${systemWordCount}字已达标(≥${rejectMinWords})，LLM字数判定为幻觉，字数控制由流水线自动管理` };
            }
        }
    }

    const redLinePatterns = /方括号标签|视角跳跃|情节断裂|术语错误|严重逻辑|关键矛盾/;
    const hasRedLine = redLinePatterns.test(allText);

    const dialectRegex = /方言.*不符合|方言.*错误|方言.*不规范|方言.*有误|方言.*不当|口音.*不对|口音.*不自然|口音.*有问题|说话方式.*不当|说话.*不规范|用语.*不规范|用词.*不规范|方言.*奇怪|方言.*违和|口音.*违和|乡音.*不对/;
    const dialectFalsePositive = dialectRegex.test(allText);
    if (dialectFalsePositive && !hasRedLine) {
        const hasDialectMaterial = safeMaterials.some(m => m.type === 'character' && m.dialectRegion);
        const hasDialectContent = _hasDialectInContent(chapterContent);
        if (hasDialectMaterial || hasDialectContent) {
            const closeEnough = _checkProximity(allText, TOPIC_KEYWORDS.dialect, ISSUE_KEYWORDS, PROXIMITY_THRESHOLD);
            if (closeEnough) {
                return { override: true, reason: '方言使用符合角色设定，审核对方言的"不规范"判定属于误判——方言本身就是非标准普通话' };
            }
        }
    }

    const styleRegex = /说话风格.*不当|表达方式.*不合适|用词.*不正式|语气.*不严肃|说话.*不合适|表达.*不当|语气.*不恰当|口吻.*不当|用词.*不当|措辞.*不正式|表达.*不自然|说话方式.*不妥|风格.*违和|风格.*不协调|风格.*不自然/;
    const styleFalsePositive = styleRegex.test(allText);
    if (styleFalsePositive && !hasRedLine) {
        const hasStyledChars = safeMaterials.some(m => m.type === 'character' && m.speechStyle);
        if (hasStyledChars) {
            const closeEnough = _checkProximity(allText, TOPIC_KEYWORDS.style, ISSUE_KEYWORDS, PROXIMITY_THRESHOLD);
            if (closeEnough) {
                return { override: true, reason: '说话风格是角色辨识度的一部分，审核对风格的"不当"判定属于误判——风格服务于角色塑造' };
            }
        }
    }

    const humorRegex = /幽默.*过度|搞笑.*过多|喜剧.*超标|笑点.*太密|幽默.*太多|搞笑.*过度|笑点.*过多|幽默.*泛滥|搞笑.*不合适|喜剧.*不当|玩笑.*太多|吐槽.*过多|吐槽.*过度/;
    const humorFalsePositive = humorRegex.test(allText) && !/方括号标签/.test(allText);
    if (humorFalsePositive && !hasRedLine) {
        const genreLabel = project?.styleProfile?.genreLabel || project?.styleProfile?.genre || '';
        const isComedyGenre = /喜剧|搞笑|幽默|爽文|轻松/.test(genreLabel);
        if (isComedyGenre) {
            return { override: true, reason: `幽默密度由项目题材设定(${genreLabel})定义，审核不应以固定标准判定幽默过度` };
        }
    }

    return { override: false };
}

module.exports = { shouldOverrideReviewRejection };
