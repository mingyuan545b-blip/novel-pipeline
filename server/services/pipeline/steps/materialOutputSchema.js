'use strict';

/**
 * materialOutputSchema — material-manager 输出的**真校验**（T3）
 *
 * 为什么要有它：
 *   material-manager.contract.yml 的输出契约只有一句"response 是 ≥10 字字符串"，
 *   真正要交接的 updates[]（type/action/name/content）**没有任何结构校验**。
 *   后果（实测可复现的静默丢弃）：
 *     · type 不在 VALID_MATERIAL_TYPES → validateNewMaterial 拒绝 → 只 logger.warn
 *     · action 写成"新增/加入/新增素材" → processUpdates 三个分支都不匹配 → **什么都不做**
 *     · name 缺失 → 建不出来也更新不了 → 静默丢
 *
 * 本模块只做**结构性判定**（纯函数，不调 LLM、不写库）；
 * 修复策略见 materialUpdateRepair.js，由 materialUpdateApplier 编排。
 */
const { VALID_MATERIAL_TYPES } = require('../../../config/materialTypes');

/** 允许的 action（与 processUpdates 实际分支对齐；缺省 action 由 determineAction 推断，不算错） */
const ALLOWED_ACTIONS = new Set(['create', 'update', 'retire', 'deprecate', 'recycle', 'archive', 'import']);

const MAX_NAME_LEN = 120;
const ERR = Object.freeze({
    NOT_ARRAY: 'MS-NOT-ARRAY',
    NOT_OBJECT: 'MS-NOT-OBJECT',
    BAD_TYPE: 'MS-BAD-TYPE',
    BAD_NAME: 'MS-BAD-NAME',
    BAD_ACTION: 'MS-BAD-ACTION',
    NO_CONTENT: 'MS-NO-CONTENT',
});

function _hasContent(update) {
    const c = update.content || update.description || update.fields;
    if (typeof c === 'string') return c.trim().length > 0;
    if (c && typeof c === 'object') return Object.keys(c).length > 0;
    return false;
}

/** 单条判定 → 错误数组（空数组=合规） */
function validateOne(update, index) {
    const out = [];
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
        return [{ index, code: ERR.NOT_OBJECT, field: null, message: '条目不是对象' }];
    }
    const type = typeof update.type === 'string' ? update.type.trim() : '';
    if (!type || !VALID_MATERIAL_TYPES.includes(type)) {
        out.push({ index, code: ERR.BAD_TYPE, field: 'type', message: `非法素材类型 "${update.type}"` });
    }
    const name = typeof update.name === 'string' ? update.name.trim() : '';
    if (!name) out.push({ index, code: ERR.BAD_NAME, field: 'name', message: 'name 缺失或非字符串' });
    else if (name.length > MAX_NAME_LEN) out.push({ index, code: ERR.BAD_NAME, field: 'name', message: `name 过长(${name.length}>${MAX_NAME_LEN})` });

    if (update.action !== undefined && update.action !== null && !ALLOWED_ACTIONS.has(update.action)) {
        out.push({ index, code: ERR.BAD_ACTION, field: 'action', message: `非法 action "${update.action}"（允许：${[...ALLOWED_ACTIONS].join('/')}）` });
    }
    if (!_hasContent(update)) {
        out.push({ index, code: ERR.NO_CONTENT, field: 'content', message: 'content/description/fields 均为空' });
    }
    return out;
}

/**
 * 校验整批 updates。
 * @returns {{ok:boolean, errors:Array, valid:Array, invalid:Array<{update:object,index:number,errors:Array}>}}
 */
function validateMaterialUpdates(updates) {
    if (!Array.isArray(updates)) {
        return { ok: false, errors: [{ index: -1, code: ERR.NOT_ARRAY, field: null, message: 'updates 不是数组' }], valid: [], invalid: [] };
    }
    const errors = [];
    const valid = [];
    const invalid = [];
    updates.forEach((update, index) => {
        const errs = validateOne(update, index);
        if (errs.length === 0) valid.push(update);
        else { errors.push(...errs); invalid.push({ update, index, errors: errs }); }
    });
    return { ok: errors.length === 0, errors, valid, invalid };
}

/** 定向修复提示词：**只回喂违规条目**（合规条目不重复消耗 token） */
function buildRepairPrompt(invalid) {
    const items = invalid.map(({ update, errors }) => ({
        item: update,
        problems: errors.map(e => `${e.field || '结构'}：${e.message}`),
    }));
    return [
        '你上一步输出的素材更新指令中，以下条目不合规，请只修正这些条目。',
        '',
        '【不合规条目】',
        JSON.stringify(items, null, 2),
        '',
        '【修正要求】',
        `1. type 必须是下列之一：${VALID_MATERIAL_TYPES.join('/')}`,
        `2. action 必须是下列之一：${[...ALLOWED_ACTIONS].join('/')}`,
        '3. name 必须是非空字符串',
        '4. content 必须是非空【纯文本字符串】（用【标签】值格式，禁止 JSON 对象）',
        '5. 语义保持不变：只修字段，不要新增未出现过的素材',
        '',
        '只输出修正后的 JSON：{"updates":[...]}（不要重复已合规的条目，不要解释）',
    ].join('\n');
}

module.exports = { validateMaterialUpdates, validateOne, buildRepairPrompt, ALLOWED_ACTIONS, ERR, MAX_NAME_LEN };
