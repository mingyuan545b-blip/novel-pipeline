const POWER_LEVELS = ['凡人', '入门', '初阶', '中阶', '高阶', '大师', '宗师', '超凡', '圣境', '神境', '至高'];

const LEVEL_MAP = {
    '凡人': 5, '练气': 15, '筑基': 25, '金丹': 35, '元婴': 45, '化神': 55,
    '合体': 65, '大乘': 75, '渡劫': 85, '真仙': 92, '金仙': 97,
    'F': 10, 'E': 20, 'D': 35, 'C': 50, 'B': 65, 'A': 80, 'S': 90, 'SS': 95, 'SSS': 98
};

function parsePowerString(str) {
    if (typeof str === 'number') return str;
    if (!str || typeof str !== 'string') return 0;
    for (const [key, val] of Object.entries(LEVEL_MAP)) {
        if (str.includes(key)) return val;
    }
    const numMatch = str.match(/(\d+)/);
    return numMatch ? parseInt(numMatch[1]) : 0;
}

function isPowerDowngrade(prev, newLevel) {
    const prevIdx = POWER_LEVELS.findIndex(l => prev.includes(l));
    const newIdx = POWER_LEVELS.findIndex(l => newLevel.includes(l));
    if (prevIdx === -1 || newIdx === -1) return true;
    return newIdx < prevIdx;
}

function isPowerUpgrade(prev, newLevel) {
    const prevIdx = POWER_LEVELS.findIndex(l => prev.includes(l));
    const newIdx = POWER_LEVELS.findIndex(l => newLevel.includes(l));
    if (prevIdx === -1 || newIdx === -1) return true;
    return newIdx > prevIdx;
}

module.exports = { POWER_LEVELS, LEVEL_MAP, parsePowerString, isPowerDowngrade, isPowerUpgrade };
