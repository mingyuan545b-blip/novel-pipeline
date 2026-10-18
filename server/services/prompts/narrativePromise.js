'use strict';

/**
 * narrativePromise — "本书叙事承诺"提示块（12-创作工艺 Stage0）
 *
 * 目的：让写手/审核在拿到素材与约束之外，还知道"读者要什么"，避免为凑元素/凑笑点背离主味情绪。
 * 数据来源：project.narrativePromise（唯一写入点：narrativePromiseDesigner）。
 * 缺字段时返回空串，不影响既有项目。
 */

function buildNarrativePromiseBlock(project) {
    if (!project) return '';
    const p = project.narrativePromise || {};
    const readerPromise = p.readerPromise || project.readerPromise || '';
    const differentiator = p.differentiator || project.differentiator || '';
    const coreLoop = p.coreLoop || project.coreLoop || '';
    const emotionFormula = p.emotionFormula || project.emotionFormula || '';
    if (!readerPromise && !differentiator && !coreLoop && !emotionFormula) return '';

    const lines = ['【本书叙事承诺（最高优先级，主导每一章的取舍）】'];
    if (readerPromise) lines.push(`- 读者承诺（要持续给读者什么情绪）：${readerPromise}`);
    if (differentiator) lines.push(`- 差异化卖点（别人没有的）：${differentiator}`);
    if (coreLoop) lines.push(`- 主循环（读者每章想看到的东西，须可重复且有变化）：${coreLoop}`);
    if (emotionFormula) lines.push(`- 情绪配方（各情绪占比，必须有主味）：${emotionFormula}`);
    lines.push('一切写作取舍服从以上承诺：不得为凑元素、凑笑点、凑设定而背离主味情绪。');
    return lines.join('\n');
}

module.exports = { buildNarrativePromiseBlock };
