const dialectRegistry = require('../dialectRegistry');

function shouldOverrideReviewRejection(stepResult, chapterContent, systemWordCount, rejectMinWords, projectMaterials, project) {
    if (!stepResult || stepResult.passed) return { override: false };
    const feedback = stepResult.feedback || {};
    const summary = (feedback.summary || '') + ' ' + (feedback.scheduleNote || '');
    const issues = feedback.issues || [];
    const allText = summary + ' ' + issues.map(i => typeof i === 'string' ? i : (i.desc || i.description || '')).join(' ');

    if (systemWordCount && rejectMinWords && systemWordCount >= rejectMinWords) {
        const isWordCountRejection = /字数.*不足|字数.*低于|字数.*未达|字数硬拦截|低于.*字|不足.*字|字数.*硬底线|字数.*红线/.test(allText);
        if (isWordCountRejection) {
            return { override: true, reason: `系统统计字数${systemWordCount}字已达标(≥${rejectMinWords})，LLM字数判定为幻觉，字数控制由流水线自动管理` };
        }
    }

    const dialectFalsePositive = /方言.*不符合|方言.*错误|方言.*不规范|方言.*有误|方言.*不当|口音.*不对|口音.*不自然|口音.*有问题|说话方式.*不当|说话.*不规范|用语.*不规范|用词.*不规范|方言.*奇怪|方言.*违和|口音.*违和|乡音.*不对/.test(allText);
    if (dialectFalsePositive) {
        const dialectRegex = dialectRegistry.getIdentifierCharsRegex();
        const hasDialectChars = (chapterContent || '').match(dialectRegex);
        if (hasDialectChars) {
            return { override: true, reason: '方言使用符合角色设定，审核对方言的"不规范"判定属于误判——方言本身就是非标准普通话' };
        }
    }

    const styleFalsePositive = /说话风格.*不当|表达方式.*不合适|用词.*不正式|语气.*不严肃|说话.*不合适|表达.*不当|语气.*不恰当|口吻.*不当|用词.*不当|措辞.*不正式|表达.*不自然|说话方式.*不妥|风格.*违和|风格.*不协调/.test(allText);
    if (styleFalsePositive) {
        const hasStyledChars = (projectMaterials || []).some(m => m.type === 'character' && m.speechStyle);
        if (hasStyledChars) {
            return { override: true, reason: '说话风格是角色辨识度的一部分，审核对风格的"不当"判定属于误判——风格服务于角色塑造' };
        }
    }

    const humorFalsePositive = /幽默.*过度|搞笑.*过多|喜剧.*超标|笑点.*太密|幽默.*太多|搞笑.*过度|笑点.*过多|幽默.*泛滥|搞笑.*不合适|喜剧.*不当|玩笑.*太多|吐槽.*过多|吐槽.*过度/.test(allText) && !/方括号标签/.test(allText);
    if (humorFalsePositive) {
        const genreLabel = project?.styleProfile?.genreLabel || project?.styleProfile?.genre || '';
        const isComedyGenre = /喜剧|搞笑|幽默|爽文|轻松/.test(genreLabel);
        if (isComedyGenre) {
            return { override: true, reason: `幽默密度由项目题材设定(${genreLabel})定义，审核不应以固定标准判定幽默过度` };
        }
    }

    return { override: false };
}

module.exports = { shouldOverrideReviewRejection };
