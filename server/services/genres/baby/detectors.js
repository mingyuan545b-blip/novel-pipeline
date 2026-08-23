/**
 * baby/detectors.js — 组合入口
 */
const core = require('./detectorsCore');
const extra1 = require('./detectorsExtra1');
const extra2 = require('./detectorsExtra2');

module.exports = {
    perspective: core.perspective,
    terminology: extra1.terminology,
    onomatopoeia: extra1.onomatopoeia,
    visualAnchors: extra1.visualAnchors,
    motherChildDialogue: extra1.motherChildDialogue,
    modernSlang: extra2.modernSlang,
};
