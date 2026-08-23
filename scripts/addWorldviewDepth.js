/**
 * addWorldviewDepth.js — 给藏经阁index.json的每个entry添加worldviewDepth字段
 * 根据department自动分类：叙事之魂/叙事结构→macro，人物/悬念→meso，情感/修辞→micro
 */
const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'server', 'data', 'library', 'index.json');

const DEPARTMENT_DEPTH_MAP = {
    '00_叙事之魂部': 'macro',
    '01_顶层设计部': 'macro',
    '02_情节引擎部': 'meso',
    '03_人物熔炉部': 'meso',
    '04_对白艺术部': 'meso',
    '05_文笔滤镜部': 'micro',
    '06_世界构建部': 'macro',
};

function main() {
    const raw = fs.readFileSync(INDEX_PATH, 'utf-8').replace(/^\uFEFF/, '');
    const index = JSON.parse(raw);

    let added = 0;
    for (const entry of index.entries) {
        const dept = entry.department || '';
        entry.worldviewDepth = DEPARTMENT_DEPTH_MAP[dept] || 'meso';
        added++;
    }

    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`Added worldviewDepth to ${added} entries`);

    const counts = { macro: 0, meso: 0, micro: 0 };
    for (const entry of index.entries) {
        counts[entry.worldviewDepth] = (counts[entry.worldviewDepth] || 0) + 1;
    }
    console.log('Distribution:', counts);
}

main();
