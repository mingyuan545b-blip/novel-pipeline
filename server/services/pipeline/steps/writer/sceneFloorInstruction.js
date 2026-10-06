'use strict';

/**
 * sceneFloorInstruction.js — 场景字数下限指令构建器
 * 由 wordConfig 派生场景下限（禁止硬编码），并强制"四场景合计≥硬性最低"。
 */
const { SCENE_FLOOR_RATIOS, SCENE_LABELS, FLOOR_ROUNDING } = require('../../../../config/writerLengthPolicy');
const { EXPANSION_METHODS } = require('../expansionInstructionBuilder');

/** 按硬性最低字数派生各场景下限 */
function resolveSceneFloors(wordConfig) {
    const floorTotal = wordConfig.targetMin || wordConfig.rejectMin || 2000;
    return SCENE_FLOOR_RATIOS.map((r) => Math.round((floorTotal * r) / FLOOR_ROUNDING) * FLOOR_ROUNDING);
}

/**
 * 构建"字数要求 + 场景结构"指令段
 * @param {object} wordConfig { targetMin, targetMax, rejectMin }
 * @returns {string}
 */
function buildLengthInstruction(wordConfig) {
    const { targetMin, targetMax, rejectMin } = wordConfig;
    const floors = resolveSceneFloors(wordConfig);
    const floorSum = floors.reduce((a, b) => a + b, 0);
    const structure = SCENE_LABELS.map((label, i) => `${label}≥${floors[i]}字`).join(' → ');
    // 中途检查点（2026-09-21 新增长度锚点）：
    // 只给"最终总字数"下限时，模型容易前松后紧、结尾草草收束（20章E2E实测 1615/2198/1689 字平台期）。
    // 改为在场景边界给累计字数检查点，把长任务拆成三个可自检的小目标。
    const mid1 = floors[0] + floors[1];
    const mid2 = mid1 + floors[2];
    const checkpoints = SCENE_LABELS
        .map((label, i) => ({ label, acc: floors.slice(0, i + 1).reduce((a, b) => a + b, 0) }))
        .slice(0, 3)
        .map(c => `${c.label}结束时累计≥${c.acc}字`)
        .join('；');
    return [
        `【字数要求 - 必须满足】本章目标字数：${targetMin}-${targetMax}字。硬性最低${rejectMin}字、上限${targetMax + 700}字。`,
        `低于${rejectMin}字退回重写，超过${targetMax + 700}字退回精简。`,
        `结构：${structure}；四个场景合计必须≥${floorSum}字（不得少于硬性最低${rejectMin}字）。`,
        `中途检查点（每写完一个场景就自检，不达标先补足再往下写）：${checkpoints}。`,
        `禁止"先写简版、结尾再补"：结尾钩子场景同样要写满${floors[3]}字，不得用总结句草草收束。`,
        `每个场景都要写足：动作+对话+叙事推进三层俱全，环境描写最多2句带过。`,
        `成稿前自检：估算总字数是否≥${rejectMin}字（对照检查点 ${mid1}/${mid2}/${floorSum}）；不足则补写细节与对话，不要靠精简收尾。`,
        // S7：首轮即下发结构化写满手法（此前只在 round>1 的扩写指令里出现 → 首轮普遍偏短）
        '首轮就按下列手法一次写满（不要留到被退回后再补）：',
        ...EXPANSION_METHODS,
    ].join('\n');
}

module.exports = { buildLengthInstruction, resolveSceneFloors };
