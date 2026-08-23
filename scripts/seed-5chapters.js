const BASE = 'http://localhost:3001/api';
const projectId = '51414e1b-c7e8-4609-985f-b48c1498b1fc';

async function createChapter(data) {
    const res = await fetch(`${BASE}/chapters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
}

async function main() {
    const chapters = [
        { projectId, chapterNumber: 1, title: '渊鳞隐契', outline: '沈渡在合欢宗后山采药时意外触发次位面裂隙，系统首次激活，掠夺到抽象概念类世界"沉默之域"的弱化能力——感知剥夺。反噬导致经脉寸断，被柳如烟救回。沈渡在昏迷中隐约感知到气运秤杆的起落，系统结算以命牌刻痕的方式烙入识海。', status: 'outlined', content: '', round: 0 },
        { projectId, chapterNumber: 2, title: '命牌初刻', outline: '沈渡在养伤期间研究系统机制，发现掠夺能力受容器容量限制，每次使用需消耗气血与因果线。柳如烟察觉异常，沈渡以话术周旋掩饰。裴惊鸿到访合欢宗，对沈渡发出警告。沈渡尝试使用感知剥夺能力，反噬虚弱期持续三个时辰。', status: 'outlined', content: '', round: 0 },
        { projectId, chapterNumber: 3, title: '借势推锋', outline: '五域论道大会预选赛，沈渡被迫代表合欢宗出战。面对法家弟子周律，沈渡利用感知剥夺能力制造对手破绽险胜。反噬几乎暴露身份，沈渡以合欢宗秘术掩饰。白无垢在场外观察，对沈渡的战斗方式产生怀疑，但未直接对质。', status: 'outlined', content: '', round: 0 },
        { projectId, chapterNumber: 4, title: '暗流织网', outline: '论道大会间隙，沈渡在合欢宗驻地发现第二道次位面裂隙的痕迹，系统提示新位面"锈蚀王庭"可掠夺。沈渡权衡利弊后决定暂不触发，但裂隙的气机波动被白无垢的法家律令之术捕捉。裴惊鸿在大会上连胜三场，剑意凝霜，引起五家高层关注。', status: 'outlined', content: '', round: 0 },
        { projectId, chapterNumber: 5, title: '裂隙深渊', outline: '沈渡夜间独自探查裂隙时遭遇"锈蚀王庭"的规则侵蚀，左臂出现锈蚀纹路。系统强制结算，掠夺到"规则锈蚀"弱化能力，但代价是左臂暂时失去知觉。柳如烟及时赶到封印裂隙，对沈渡发出最后通牒。白无垢在暗处记录了一切。', status: 'outlined', content: '', round: 0 }
    ];

    for (const ch of chapters) {
        const result = await createChapter(ch);
        console.log('Created chapter:', result.title || result.id || 'error');
    }

    const updateRes = await fetch(`${BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', currentChapter: 0, chapters: chapters.map(c => c.chapterNumber), chapterIntents: { chapters: {} }, hookBudget: { hooks: [], lastUpdated: null } })
    });
    const updated = await updateRes.json();
    console.log('Project updated:', updated.name, 'status:', updated.status);
    console.log('\nReady to start pipeline!');
}

main().catch(e => console.error('FAIL:', e.message));
