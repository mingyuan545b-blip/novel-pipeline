'use strict';

/**
 * narrativePromiseDesigner — 立项四件（叙事承诺）生成器
 *
 * 背景（sop/12 §七 7.6）：新项目缺 narrativePromise → agentPromptAssembler 的
 *   "叙事承诺"块被整块跳过 → 写手不知道读者要什么，只能写"一眼AI文"的标准件。
 * 做法：立项/初始化时用一次 LLM 调用，从项目前提 + 已生成素材里提炼四件并落 project。
 * 依据：docs/sop/12-创作工艺与反AI化规范.md Stage0 / §7.6
 */
const store = require('../store');
const llm = require('./llm');
const logger = require('../shared/logger');

const FIELDS = ['readerPromise', 'sellingPoint', 'mainLoop', 'emotionRecipe'];

/** 校验四件是否齐备（纯函数） */
function isComplete(promise) {
    if (!promise) return false;
    return FIELDS.every(f => String(promise[f] || '').trim().length >= 4);
}

function buildPrompt(project, materials) {
    const mats = (materials || []).slice(0, 12)
        .map(m => '- [' + m.type + '] ' + m.name + '：' + String(m.currentContent || m.initialContent || '').slice(0, 120))
        .join('\n');
    const system = '你是网文立项策划。只输出 JSON，不要解释。';
    const user = [
        '根据项目前提与已生成素材，提炼这本书的"叙事承诺"四件：',
        '{"readerPromise":"读者承诺：读者冲着什么来（一句话，具体到情绪/爽点类型）",'
        + '"sellingPoint":"差异化卖点：同类书没有的那个点",'
        + '"mainLoop":"主循环：读者每几章能重复获得的那份体验（触发→冲突→兑现）",'
        + '"emotionRecipe":"情绪配方：全书情绪配比与拐点（如 憋屈40%→翻盘50%→余味10%）"}',
        '要求：必须具体到这本书，禁止"精彩纷呈""热血励志"这类空话。',
        '',
        '项目：' + (project?.name || '') + '（题材：' + (project?.genre || '') + '，目标 ' + (project?.targetChapters || '?') + ' 章）',
        '前提：' + String(project?.description || project?.premise || '').slice(0, 800),
        mats ? '\n已生成素材（节选）：\n' + mats : '',
    ].join('\n');
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function parsePromise(raw) {
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced ? fenced[1] : raw;
    const m = body.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
        const p = JSON.parse(m[0]);
        const out = {};
        for (const f of FIELDS) out[f] = String(p[f] || '').trim();
        return isComplete(out) ? out : null;
    } catch (_) { return null; }
}

/**
 * 生成并落盘叙事承诺（失败不阻断初始化）
 * @returns {Promise<{ok:boolean, promise?:object, reason?:string}>}
 */
async function designNarrativePromise(projectId, options) {
    const opts = options || {};
    try {
        const project = await store.getItem('projects', projectId);
        if (!project) return { ok: false, reason: 'project-not-found' };
        const existing = project.narrativePromise || project.styleProfile?.narrativePromise;
        if (isComplete(existing)) return { ok: true, promise: existing, reason: 'already-complete' };

        const materials = await store.queryItems('materials', { projectId });
        const result = await llm.chat(buildPrompt(project, materials), {
            maxTokens: 1200, temperature: 0.7, enableThinking: false,
            apiConfig: opts.apiConfig, usageStep: 'narrative-promise',
        });
        const raw = result?.choices?.[0]?.message?.content || '';
        const promise = parsePromise(raw);
        if (!promise) {
            logger.warn('narrativePromise', '四件解析失败，前200字: ' + raw.slice(0, 200));
            return { ok: false, reason: 'unparsable' };
        }
        if (!opts.apply) return { ok: true, promise, reason: 'dry-run' };
        await store.setItem('projects', projectId, { ...project, narrativePromise: promise, updatedAt: new Date().toISOString() });
        logger.info('narrativePromise', '立项四件已落盘: ' + promise.readerPromise.slice(0, 40));
        return { ok: true, promise };
    } catch (e) {
        logger.warn('narrativePromise', '生成失败: ' + e.message);
        return { ok: false, reason: e.message };
    }
}

module.exports = { designNarrativePromise, isComplete, parsePromise, FIELDS };
