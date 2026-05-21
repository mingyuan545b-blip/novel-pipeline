const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data', 'subplanes');

const renames = {
    'green-grassland.json': {
        name: '翠野牧歌',
        '青青草原': '翠野牧歌',
        '羊村': '白羊部族',
        '狼族': '灰狼部族',
        '铃铛白羊': '铃音白羔',
        '破帽灰狼': '破帽灰狼',
        '白须老羊': '白须长老'
    },
    'grand-voyage.json': {
        name: '沧溟远航',
        '伟大航路': '沧溟远航',
        '自由航团': '沧溟船团',
        '草编帽船长': '草编帽船长',
        '绿藻剑士': '碧藻剑客',
        '橘发航海士': '橘发引航使'
    },
    'chase-eternal.json': {
        name: '追逐永恒',
        '被追逐者': '逃逸族',
        '追逐者': '追猎族',
        '第三方武力': '旁观武力',
        '蓝灰家猫': '蓝灰猎手',
        '棕色小鼠': '棕褐遁者',
        '褐色斗牛犬': '褐甲力士'
    }
};

let total = 0;
for (const [filename, mapping] of Object.entries(renames)) {
    const fp = path.join(dir, filename);
    if (!fs.existsSync(fp)) { console.log('SKIP:', filename); continue; }
    let content = fs.readFileSync(fp, 'utf8');
    let count = 0;
    for (const [from, to] of Object.entries(mapping)) {
        if (from === 'name') continue;
        const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        const matches = content.match(regex);
        if (matches) { count += matches.length; content = content.replace(regex, to); }
    }
    let data = JSON.parse(content);
    if (mapping.name) data.name = mapping.name;
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    console.log(filename + ': ' + count + ' replacements, name -> ' + (mapping.name || data.name));
    total += count;
}
console.log('Total:', total);
