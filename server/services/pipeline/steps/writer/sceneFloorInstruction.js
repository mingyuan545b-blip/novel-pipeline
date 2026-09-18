'use strict';

/**
 * sceneFloorInstruction.js — 场景字数下限指令构建器
 * 由 wordConfig 派生场景下限（禁止硬编码），并强制"四场景合计≥硬性最低"。
 */
const { SCENE_FLOOR_RATIOS, SCENE_LABELS, FLOOR_ROUNDING } = require('../../../../config/writerLengthPolicy');

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
    return [
        `【字数要求 - 必须满足】本章目标字数：${targetMin}-${targetMax}字。硬性最低${rejectMin}字、上限${targetMax + 700}字。`,
        `低于${rejectMin}字退回重写，超过${targetMax + 700}字退回精简。`,
        `结构：${structure}；四个场景合计必须≥${floorSum}字（不得少于硬性最低${rejectMin}字）。`,
        `每个场景都要写足：动作+对话+叙事推进三层俱全，环境描写最多2句带过。`,
        `成稿前自检：估算总字数是否≥${rejectMin}字；不足则补写细节与对话，不要靠精简收尾。`,
    ].join('\n');
}

module.exports = { buildLengthInstruction, resolveSceneFloors };
