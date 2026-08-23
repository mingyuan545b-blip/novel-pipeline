/**
 * hookRepetitionDetector.js - 章末钩子重复检测器
 *
 * 职责边界：
 *   - 检测近N章章末钩子是否重复使用同一手法/道具/句式
 *   - 输出 high/critical 级问题，供review注入
 *
 * 单一职责：只做检测和报告，不做修改、不阻断pipeline
 * 数据源：章节正文内容数组
 */

const { extractEndingTension } = require('./contentDetectors');

// 钩子类型签名模式：按"钩子手法"分类
// 设计原则：检测末段是否包含某类钩子的特征词群，而非要求同句出现所有元素
const HOOK_SIGNATURE_PATTERNS = Object.freeze([
    // 道具感应类：随身道具出现异常反应（发烫/震动/发光/温度变化等）
    { type: '道具感应', pattern: /(发烫|灼热|震动|颤动|发红|发亮|温度.{0,3}升高|异样波动|蜂鸣|烫得|滚烫)/g },
    // 神秘警告类：老前辈/系统发出模糊警告
    { type: '神秘警告', pattern: /(老夫|本座|前辈|系统)[\s\S]{0,15}(眼熟|不对劲|危险|小心|慎之|不妙)/g },
    // 眼神特写类：死死盯住/紧紧盯着
    { type: '眼神特写', pattern: /(死死|紧紧|直直)[\s\S]{0,5}(盯|看|望|盯着)/g },
    // 液体滴落类：墨汁/茶水/鲜血滴落
    { type: '液体滴落', pattern: /(墨汁|茶水|酒液|鲜血|冷汗)[\s\S]{0,10}(滴落|溅落|溢出|流下)/g },
    // 突然察觉类：突然发现/猛地意识到
    { type: '突然察觉', pattern: /(突然|忽然|猛地)[\s\S]{0,10}(察觉|发现|意识到|感到)/g },
    // 反派密谋类：阴鸷冷笑
    { type: '反派密谋', pattern: /(阴鸷|冷笑|皮笑肉不笑|眼底闪过)[\s\S]{0,15}(杀意|寒光|算计)/g },
    // 异常声响类：嗡鸣/轰隆
    { type: '异常声响', pattern: /(嗡|轰|咔嚓|嘎吱|尖锐的)[\s\S]{0,15}(声响|动静|声音|嗡鸣)/g },
    // 行动提前/危机逼近类：敌人行动提前/危机将至
    { type: '危机逼近', pattern: /(行动.{0,3}提前|提前.{0,5}行动|逼近|杀到|攻来|不等了|变故)/g }
]);

// 钩子重复阈值
const HOOK_REPETITION_THRESHOLDS = Object.freeze({
    WINDOW_CHAPTERS: 5,           // 检测窗口：近5章
    SAME_TYPE_MAX: 2,             // 同类型钩子最多出现次数（超过则high）
    SAME_SIGNATURE_MAX: 1,        // 完全相同签名最多出现次数（超过则critical）
    CRITICAL_ESCALATION: 3        // 同类型出现3次及以上升级为critical
});

/**
 * 提取单章钩子签名
 * @param {string} content - 章节正文
 * @returns {{type:string, signature:string|null, lastParagraph:string}}
 */
function extractHookSignature(content) {
    if (!content) return { type: 'none', signature: null, lastParagraph: '' };

    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length === 0) return { type: 'none', signature: null, lastParagraph: '' };

    // 取最后2段作为钩子区域
    const hookZone = paragraphs.slice(-2).join(' ');
    const lastPara = paragraphs[paragraphs.length - 1].trim();

    // 匹配钩子签名
    for (const { type, pattern } of HOOK_SIGNATURE_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        const match = regex.exec(hookZone);
        if (match) {
            return {
                type,
                signature: match[0],
                lastParagraph: lastPara.substring(0, 100)
            };
        }
    }

    // 兜底：用extractEndingTension的结果
    const tension = extractEndingTension(content);
    return {
        type: tension.tensionType || 'unknown',
        signature: tension.lastParagraph || null,
        lastParagraph: tension.lastParagraph || ''
    };
}

/**
 * 检测近N章钩子重复
 * @param {Array<{chapterNumber:number, content:string}>} recentChapters
 * @returns {{hasRepetition:boolean, issues:Array, signatures:Array}}
 */
function detectHookRepetition(recentChapters) {
    if (!Array.isArray(recentChapters) || recentChapters.length < 2) {
        return { hasRepetition: false, issues: [], signatures: [] };
    }

    const windowChapters = recentChapters.slice(-HOOK_REPETITION_THRESHOLDS.WINDOW_CHAPTERS);
    const signatures = windowChapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        ...extractHookSignature(ch.content)
    }));

    const issues = [];
    const typeCount = {};

    // 统计各类型出现次数
    for (const sig of signatures) {
        if (sig.type === 'none' || sig.type === 'unknown') continue;
        typeCount[sig.type] = (typeCount[sig.type] || 0) + 1;
    }

    // 检测同类型超限
    for (const [type, count] of Object.entries(typeCount)) {
        if (count > HOOK_REPETITION_THRESHOLDS.SAME_TYPE_MAX) {
            const chapters = signatures.filter(s => s.type === type).map(s => `第${s.chapterNumber}章`);
            const severity = count >= HOOK_REPETITION_THRESHOLDS.CRITICAL_ESCALATION ? 'critical' : 'high';
            issues.push({
                severity,
                type: 'hook_type_repetition',
                hookType: type,
                count,
                chapters,
                description: `章末钩子重复：近${windowChapters.length}章中【${type}】类型钩子出现${count}次（${chapters.join('、')}），需更换钩子手法。建议：信息揭露/人物登场/场景切换/承诺倒计时/视角转换/悬念问句。`
            });
        }
    }

    // 检测完全相同签名（精确去重）
    const signatureMap = {};
    for (const sig of signatures) {
        if (!sig.signature) continue;
        const key = sig.signature.substring(0, 20);
        if (!signatureMap[key]) signatureMap[key] = [];
        signatureMap[key].push(sig.chapterNumber);
    }
    for (const [sig, chs] of Object.entries(signatureMap)) {
        if (chs.length > HOOK_REPETITION_THRESHOLDS.SAME_SIGNATURE_MAX) {
            issues.push({
                severity: 'critical',
                type: 'hook_signature_duplication',
                signature: sig,
                chapters: chs.map(c => `第${c}章`),
                description: `章末钩子完全重复："${sig}..."在${chs.map(c => '第' + c + '章').join('、')}重复出现，必须更换。`
            });
        }
    }

    return {
        hasRepetition: issues.length > 0,
        issues,
        signatures
    };
}

/**
 * 生成注入review prompt的文本
 * @param {Array<{chapterNumber:number, content:string}>} recentChapters
 * @returns {string} 注入文本（空字符串表示无问题）
 */
function buildHookRepetitionHint(recentChapters) {
    const { hasRepetition, issues, signatures } = detectHookRepetition(recentChapters);
    if (!hasRepetition) return '';

    const lines = issues.map(i => {
        const icon = i.severity === 'critical' ? '🚨' : '⚠️';
        return `${icon} ${i.description}`;
    });

    // 附带近章钩子类型摘要，供审核参考
    const sigSummary = signatures
        .filter(s => s.type !== 'none' && s.type !== 'unknown')
        .map(s => `第${s.chapterNumber}章:${s.type}`)
        .join('、');

    return `【章末钩子重复检测】近章钩子分布：${sigSummary}\n${lines.join('\n')}`;
}

module.exports = {
    extractHookSignature,
    detectHookRepetition,
    buildHookRepetitionHint,
    HOOK_SIGNATURE_PATTERNS,
    HOOK_REPETITION_THRESHOLDS
};
