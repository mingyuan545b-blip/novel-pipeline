import './knowledge.css';

const LEVEL_MAP = {
    '凡人': 0, '练气': 10, '筑基': 20, '金丹': 30, '元婴': 40, '化神': 50,
    '合体': 60, '大乘': 70, '渡劫': 80, '真仙': 90, '金仙': 95,
    'F': 5, 'E': 15, 'D': 25, 'C': 40, 'B': 55, 'A': 70, 'S': 80, 'SS': 90, 'SSS': 95, 'EX': 100
};

function parsePowerValue(powerStr) {
    if (!powerStr || powerStr === '未知') return { numeric: 0, label: '未知', hasData: false };
    const pctMatch = powerStr.match(/(\d+)%/);
    if (pctMatch) return { numeric: parseInt(pctMatch[1]), label: powerStr, hasData: true };
    const lvMatch = powerStr.match(/Lv\.?\s*(\d+)/i);
    if (lvMatch) return { numeric: parseInt(lvMatch[1]) * 10, label: powerStr, hasData: true };
    const numMatch = powerStr.match(/(\d+)/);
    if (numMatch) return { numeric: parseInt(numMatch[1]), label: powerStr, hasData: true };
    for (const [key, val] of Object.entries(LEVEL_MAP)) {
        if (powerStr.includes(key)) return { numeric: val, label: powerStr, hasData: true };
    }
    return { numeric: 5, label: powerStr, hasData: true };
}

function parseHiddenPower(char) {
    const growthContent = (char.growthContent || '') + (char.description || '');
    const patterns = [
        /(?:真实|隐藏|实际|暗藏|暗面)(?:战力|实力|等级|觉醒度)[：:]*\s*([^\n,，。；;]{2,30})/i,
        /(?:真实|隐藏)(?:觉醒度)[：:]*\s*(\d+%)/i,
    ];
    for (const p of patterns) {
        const m = growthContent.match(p);
        if (m && m[1]) return parsePowerValue(m[1].trim());
    }
    if (char.currentPower && char.currentPower !== '未知') {
        const official = parsePowerValue(char.currentPower);
        if (official.hasData && official.numeric > 0) {
            const hidden = Math.round(official.numeric * (1.1 + Math.random() * 0.3));
            return { numeric: Math.min(hidden, 100), label: '隐藏实力 (推测)', hasData: true, estimated: true };
        }
    }
    return { numeric: 0, label: '', hasData: false };
}

export { parsePowerValue, parseHiddenPower };
