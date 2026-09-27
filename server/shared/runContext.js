/**
 * runContext — 流水线运行上下文（AsyncLocalStorage）
 *
 * 背景（bug 修复）：
 *   `orchestrator.js` 里 `startRound = chapter.round + 1`，round 是**跨运行累计**的绝对值，
 *   而 reviews 只记录了这个绝对值。前端"执行日志"直接显示 R{round}，
 *   于是续跑/多轮之后用户看到的是 "R3/R5/R6"，既没有 R1/R2，也不知道这是第几轮。
 *   pipeline 日志已在第三批修复中补了 runRound，reviews 没有。
 *
 * 方案：用 AsyncLocalStorage 把本次运行的 startRound 透传到任意深度的写库调用，
 *   在 store.setItem('reviews', ...) 单点补 runRound，避免改动 14 处 review 写入点。
 *
 * 注意：只有流水线运行期间才有 store；路由/脚本手工写 review 时 get() 返回 undefined，
 *   行为与修复前完全一致（不写 runRound）。
 */
const { AsyncLocalStorage } = require('async_hooks');

const _als = new AsyncLocalStorage();

/** 在指定运行上下文内执行 fn（并发跑多章节时各自隔离） */
function runWithContext(ctx, fn) {
    return _als.run({ ...(ctx || {}) }, fn);
}

/** 当前运行上下文（无则 undefined） */
function getRunContext() {
    return _als.getStore();
}

/** 本次运行是否已到最后一轮（无重试轮次） */
function isLastRound() {
    return _als.getStore()?.isLastRound === true;
}

/** 本次运行的第几轮（相对轮次）。无上下文或参数非法时返回 undefined */
function toRunRound(absoluteRound, ctx = _als.getStore()) {
    const start = ctx?.startRound;
    if (!start || typeof absoluteRound !== 'number' || absoluteRound <= 0) return undefined;
    const rel = absoluteRound - start + 1;
    return rel > 0 ? rel : undefined;
}

module.exports = { runWithContext, getRunContext, toRunRound, isLastRound };
