/**
 * phraseTemplateDetector.js - 台词模板/句式重复检测器
 *
 * 职责边界：
 *   - 检测跨章节重复使用的台词模板（如"想当年...算了不说这个"）
 *   - 检测高频套路化句式（"嘴角微微上扬了一毫米"等）
 *   - 输出 high/critical 级问题，供review注入
 *
 * 单一职责：只做检测和报告，不做修改、不阻断pipeline
 */

// 台词模板提取：去掉具体内容，保留句式骨架
const TEMPLATE_EXTRACTION_PATTERNS = Object.freeze([
    // "想当年...咳咳/算了"模板（老前辈专用套路）
    { id: 'nostalgia_interrupted', pattern: /想当年[\s\S]{0,30}(咳咳|算了|不说|打住|言归正传|正事|不提)/g },
    // "X微微Y了一Z"模板（嘴角微微上扬了一毫米）
    { id: 'micro_expression', pattern: /([嘴角眉眼脸手])[\s\S]{0,4}微微[\s\S]{0,6}(一|了)[\s\S]{1,4}(毫米|寸|分|度)/g },
    // "死死盯住"模板
    { id: 'death_stare', pattern: /(死死|紧紧)[\s\S]{0,3}(盯|看|望|握|抓|攥)/g },
    // "皮笑肉不笑"模板
    { id: 'fake_smile', pattern: /皮笑肉不笑|笑里藏刀|假笑|赔笑/g },
    // "眼神阴鸷"模板
    { id: 'sinister_eyes', pattern: /眼神(阴鸷|阴冷|冰冷|凌厉|锐利|深邃)/g },
    // "仿佛被电击"模板
    { id: 'electric_shock', pattern: /(仿佛|好像|如同)[\s\S]{0,6}(被电击|被雷击|遭电击)/g },
    // "如鹰隼般"模板
    { id: 'eagle_simile', pattern: /如(鹰隼|猎豹|饿狼|毒蛇|猛虎)般/g },
    // "倒吸一口凉气"模板
    { id: 'gasp_cold_air', pattern: /倒吸(一口|了口)?凉气|倒抽(一口|了口)?凉气/g },
    // "嘴角抽搐"模板
    { id: 'mouth_twitch', pattern: /嘴角(抽搐|抽动|微微一抽|抖了抖)/g },
    // "瞳孔骤缩"模板
    { id: 'pupil_shrink', pattern: /瞳孔(骤缩|猛缩|一缩|微缩|急剧收缩)/g }
]);

// 检测阈值
const PHRASE_THRESHOLDS = Object.freeze({
    WINDOW_CHAPTERS: 5,        // 5章窗口
    SAME_TEMPLATE_MAX: 2,      // 同一模板最多出现2次（超过则high）
    CRITICAL_THRESHOLD: 4      // 达到4次升级为critical
});

/**
 * 从内容中提取台词模板实例
 * @param {string} content
 * @returns {Array<{templateId:string, match:string, position:number}>}
 */
function extractPhraseTemplates(content) {
    if (!content) return [];
    const results = [];

    for (const { id, pattern } of TEMPLATE_EXTRACTION_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            results.push({
                templateId: id,
                match: match[0],
                position: match.index
            });
        }
    }
    return results;
}

/**
 * 检测跨章节台词模板重复
 * @param {Array<{chapterNumber:number, content:string}>} recentChapters
 * @returns {{hasRepetition:boolean, issues:Array, summary:Object}}
 */
function detectPhraseTemplateRepetition(recentChapters) {
    if (!Array.isArray(recentChapters) || recentChapters.length < 2) {
        return { hasRepetition: false, issues: [], summary: {} };
    }

    const windowChapters = recentChapters.slice(-PHRASE_THRESHOLDS.WINDOW_CHAPTERS);

    // 收集所有模板实例，按templateId分组
    const templateInstances = {};
    for (const ch of windowChapters) {
        const templates = extractPhraseTemplates(ch.content);
        for (const t of templates) {
            if (!templateInstances[t.templateId]) {
                templateInstances[t.templateId] = [];
            }
            templateInstances[t.templateId].push({
                chapterNumber: ch.chapterNumber,
                match: t.match
            });
        }
    }

    const issues = [];
    for (const [templateId, instances] of Object.entries(templateInstances)) {
        if (instances.length > PHRASE_THRESHOLDS.SAME_TEMPLATE_MAX) {
            const chapters = [...new Set(instances.map(i => i.chapterNumber))];
            const examples = instances.slice(0, 3).map(i => `"${i.match}"(第${i.chapterNumber}章)`);
            const severity = instances.length >= PHRASE_THRESHOLDS.CRITICAL_THRESHOLD ? 'critical' : 'high';
            issues.push({
                severity,
                type: 'phrase_template_repetition',
                templateId,
                count: instances.length,
                chapters: chapters.map(c => `第${c}章`),
                description: `台词模板重复：模板【${templateId}】近${windowChapters.length}章出现${instances.length}次（${examples.join('、')}）。需更换表达方式或删除冗余。`
            });
        }
    }

    // 按count降序
    issues.sort((a, b) => b.count - a.count);

    // 生成摘要
    const summary = {};
    for (const [templateId, instances] of Object.entries(templateInstances)) {
        summary[templateId] = instances.length;
    }

    return {
        hasRepetition: issues.length > 0,
        issues,
        summary
    };
}

/**
 * 生成注入review prompt的文本
 * @param {Array<{chapterNumber:number, content:string}>} recentChapters
 * @returns {string}
 */
function buildPhraseTemplateHint(recentChapters) {
    const { hasRepetition, issues, summary } = detectPhraseTemplateRepetition(recentChapters);
    if (!hasRepetition) return '';

    const lines = issues.map(i => {
        const icon = i.severity === 'critical' ? '🚨' : '⚠️';
        return `${icon} ${i.description}`;
    });

    // 附带模板频次摘要
    const summaryLines = Object.entries(summary)
        .filter(([, count]) => count > 1)
        .map(([id, count]) => `${id}:${count}次`)
        .join('、');

    const summaryText = summaryLines ? `\n模板频次：${summaryLines}` : '';

    return `【台词模板重复检测】${summaryText}\n${lines.join('\n')}`;
}

module.exports = {
    extractPhraseTemplates,
    detectPhraseTemplateRepetition,
    buildPhraseTemplateHint,
    TEMPLATE_EXTRACTION_PATTERNS,
    PHRASE_THRESHOLDS
};
