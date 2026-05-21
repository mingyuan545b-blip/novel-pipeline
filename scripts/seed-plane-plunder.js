const crypto = require('crypto');
function uuid() { return crypto.randomUUID(); }

const projectId = '51414e1b-c7e8-4609-985f-b48c1498b1fc';
const BASE = 'http://localhost:3001/api';

async function createMaterial(data) {
    const res = await fetch(`${BASE}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function main() {
    const mats = [
        { projectId, type: 'worldview', name: '主位面·五域九阶', currentContent: '主位面由儒、道、法、佛、墨五家共治，战力体系严格遵循9大等级×9小等级结构。\n\n【儒家】理-道-世进阶：启微→明理→守正→弘道→经世→致知→格物→化境→通神\n【道家】虚-炁-真-道演化：纳虚→炼炁→结婴→阳神→渡劫→归真→合道→太初→无相\n【法家】规-刑-律-极秩序：立规→定矩→执刑→明赏→肃纲→镇狱→裁天→律令→极刑\n【佛门】惑-果-觉-寂超脱：闻思→修慧→断惑→证果→罗汉→菩萨→佛陀→如来→涅槃\n【墨家】机-阵-衡-衍演算：观微→构型→成阵→破虚→逆理→执衡→归一→太衍→无枢\n\n小等级以"初、中、后、极"或"渊、沧、溟、瀚"等雅致后缀区分。\n\n次位面分三类：抽象概念类（规则驱动）、文明类（科技/魔法锚点）、动漫类（IP弱化适配）。跨位面提及必须使用"源初编号+领域尊称"。', tags: ['worldview', 'power-system'] },
        { projectId, type: 'character', name: '沈渡', currentContent: '合欢宗外门男宠，性格谨小慎微、善于话术周旋。拥有系统掠夺次位面能力，但每次掠夺后必受反噬痛楚与冷却期限制。行事遵循"风险评估-资源置换-最小暴露"原则，表面柔弱实则心思缜密。修为仅儒家启微境初期。', tags: ['protagonist'] },
        { projectId, type: 'character', name: '柳如烟', currentContent: '合欢宗内门长老，沈渡的庇护者。修为道家归真境，性格冷厉但对沈渡有特殊容忍。掌握宗门资源分配权。', tags: ['supporting'] },
        { projectId, type: 'character', name: '裴惊鸿', currentContent: '儒家弘道境天才，五域论道大会魁首。正道楷模，行事光明磊落但对合欢宗极度排斥，视沈渡为邪道余孽。', tags: ['rival'] },
        { projectId, type: 'character', name: '白无垢', currentContent: '法家肃纲境执法使，负责监察跨位面异动。表面铁面无私，实则暗中调查系统掠夺者身份。', tags: ['supporting'] },
        { projectId, type: 'power-system', name: '系统掠夺机制', currentContent: '核心规则：1.掠夺能力为弱化版，受容器容量限制 2.每次使用需消耗气血与因果线 3.超限触发经脉寸断或精神污染 4.冷却期虚弱状态 5.积分兑换需消耗寿命/气血/因果线。系统结算内化为"天道账册翻动声""气运秤杆起落痕""命牌刻痕冷却期"。', tags: ['power-system', 'plunder'] },
        { projectId, type: 'foreshadowing', name: '次位面裂隙异动', currentContent: '主位面近期出现多处次位面裂隙，法家执法使白无垢受命调查。裂隙频率与系统掠夺者活动高度相关。', tags: ['foreshadowing'] }
    ];

    for (const m of mats) {
        const result = await createMaterial(m);
        console.log('Created material:', result.name || result.id || 'error');
    }

    const chapters = [
        { projectId, chapterNumber: 1, title: '渊鳞隐契', outline: '沈渡在合欢宗后山采药时意外触发次位面裂隙，系统首次激活，掠夺到抽象概念类世界"沉默之域"的弱化能力——感知剥夺。反噬导致经脉寸断，被柳如烟救回。', status: 'outlined', content: '', round: 0 },
        { projectId, chapterNumber: 2, title: '命牌初刻', outline: '沈渡在养伤期间研究系统机制，发现掠夺能力受容器容量限制，每次使用需消耗气血与因果线。柳如烟察觉异常，沈渡以话术周旋掩饰。裴惊鸿到访合欢宗，对沈渡发出警告。', status: 'outlined', content: '', round: 0 },
        { projectId, chapterNumber: 3, title: '借势推锋', outline: '五域论道大会预选赛，沈渡被迫代表合欢宗出战。面对法家弟子，沈渡利用感知剥夺能力制造对手破绽，但反噬几乎暴露身份。白无垢在场观察，对沈渡的战斗方式产生怀疑。', status: 'outlined', content: '', round: 0 }
    ];

    for (const ch of chapters) {
        const res = await fetch(`${BASE}/chapters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ch)
        });
        const result = await res.json();
        console.log('Created chapter:', result.title || result.id || 'error');
    }

    const updateRes = await fetch(`${BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', currentChapter: 0, chapters: chapters.map(c => c.chapterNumber), chapterIntents: { chapters: [] }, hookBudget: { active: [], resolved: [], budget: 12 } })
    });
    const updated = await updateRes.json();
    console.log('Project updated:', updated.name, 'status:', updated.status);

    console.log('\nAll data seeded. Starting infinite pipeline for 3 chapters...');
}

main().catch(e => console.error('FAIL:', e.message));
