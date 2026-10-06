'use strict';

/**
 * M7检测器：段末/章末抽象升华收尾
 *
 * 模式：章末（或段末）用"渺小/命运/终将/这一切/才刚刚开始"等拔高句收尾，
 *       替代具体动作或物象落点。与M4区别：M4管全局抽象抒情，M7只管"结尾位置的升华"。
 */

const { getConfig } = require('../constraintDetectionConfig');

function scanPatterns(text, patterns, reasonMap) {
    const hits = [];
    for (const [name, pattern] of Object.entries(patterns)) {
        const re = new RegExp(pattern.source, pattern.flags);
        const m = text.match(re) || [];
        m.slice(0, 2).forEach(snippet => hits.push({ type: name, snippet, reason: reasonMap[name] || name }));
    }
    return hits;
}

function detectAbstractEnding({ content }) {
    const config = getConfig('M7');
    const threshold = config.threshold;
    if (!content) return { violations: [], actual: 0, threshold };

    const reasonMap = {
        scaleVista: '以渺小/浩瀚的宏大视角收尾（空泛拔高）',
        fateStatement: '以命运/终将/这才是的论断收尾（替代具体因果）',
        openEnding: '以"才刚刚开始"式套话钩子收尾',
        lingeringEmotion: '以挥之不去/难以言喻的情绪概括收尾',
    };

    const stripped = String(content).replace(/\s+$/g, '');
    const ending = stripped.slice(-config.endingChars);
    const violations = scanPatterns(ending, config.elevationPatterns, reasonMap).map(v => ({ ...v, scope: 'chapter-end' }));

    // 段末扫描：权重较低（章末命中权重2，段末命中权重1），避免单处段末误报
    const paragraphs = stripped.split(/\n+/).filter(p => p.trim());
    for (const p of paragraphs) {
        const tail = p.trim().slice(-config.paragraphTailChars);
        const hits = scanPatterns(tail, config.elevationPatterns, reasonMap);
        hits.forEach(v => violations.push({ ...v, scope: 'paragraph-end' }));
    }

    // 加权计分：章末命中=2，段末命中=1
    const score = violations.reduce((s, v) => s + (v.scope === 'chapter-end' ? 2 : 1), 0);
    if (score < threshold) return { violations: [], actual: score, threshold };
    return { violations, actual: score, threshold };
}

module.exports = { detectAbstractEnding };
