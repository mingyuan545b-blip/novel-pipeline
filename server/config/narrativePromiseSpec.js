/**
 * narrativePromiseSpec.js — 「叙事承诺四件」字段单一源（配置驱动）
 *
 * 背景（E2b）：写入端（narrativePromiseDesigner）用 sellingPoint/mainLoop/emotionRecipe，
 *   消费端（prompts/narrativePromise）读 differentiator/coreLoop/emotionFormula —— 字段名不一致，
 *   实测 PG 中 4 个项目有 3 个因此在写手提示词里丢了 3/4 条。
 * 说明：这里是**数据**不是逻辑。写入端与消费端共用本表；aliases 让历史/模型的不同命名都能被读到，
 *   不必改写既有数据（符合「不改已存在内容，在源头解决」的定调）。
 */
'use strict';

const FIELDS = Object.freeze([
    Object.freeze({
        key: 'readerPromise',
        aliases: Object.freeze(['readerPromise']),
        label: '读者承诺（要持续给读者什么情绪）',
        hint: '读者承诺：读者冲着什么来（一句话，具体到情绪/爽点类型）',
    }),
    Object.freeze({
        key: 'sellingPoint',
        aliases: Object.freeze(['sellingPoint', 'differentiator']),
        label: '差异化卖点（别人没有的）',
        hint: '差异化卖点：同类书没有的那个点',
    }),
    Object.freeze({
        key: 'mainLoop',
        aliases: Object.freeze(['mainLoop', 'coreLoop']),
        label: '主循环（读者每章想看到的东西，须可重复且有变化）',
        hint: '主循环：读者每几章能重复获得的那份体验（触发→冲突→兑现）',
    }),
    Object.freeze({
        key: 'emotionRecipe',
        aliases: Object.freeze(['emotionRecipe', 'emotionFormula']),
        label: '情绪配方（各情绪占比，必须有主味）',
        hint: '情绪配方：全书情绪配比与拐点（如 憋屈40%→翻盘50%→余味10%）',
    }),
]);

const KEYS = Object.freeze(FIELDS.map((f) => f.key));

/** 按 aliases 顺序取第一个非空值（纯函数；兼容历史命名） */
function pickField(promise, field) {
    if (!promise || !field) return '';
    for (const alias of field.aliases) {
        const v = promise[alias];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
}

module.exports = { FIELDS, KEYS, pickField };
