const template = {
    name: '位面掠夺·高武跨域',
    genre: 'high-martial-crossplane',
    mode: 'novel',
    projectId: '51414e1b-c7e8-4609-985f-b48c1498b1fc',
    worldview: {
        name: '主位面·五域九阶',
        description: '主位面由儒、道、法、佛、墨五家共治，战力体系严格遵循9大等级×9小等级结构。儒家侧重理-道-世进阶（启微→通神），道家侧重虚-炁-真-道演化（纳虚→无相），法家侧重规-刑-律-极秩序（立规→极刑），佛门侧重惑-果-觉-寂超脱（闻思→涅槃），墨家侧重机-阵-衡-衍演算（观微→无枢）。次位面分为抽象概念类、文明类、动漫类三类，主角通过系统掠夺次位面能力但仅获弱化版且受反噬限制。',
        rules: [
            '主位面战力天花板绝对压制，次位面力量不可反哺导致阶级跨越',
            '次位面势力人物道具严格同源绑定，禁止跨位面越界互动',
            '系统掠夺能力为弱化版，受积分冷却/反噬代价/容量上限限制',
            '跨位面提及必须使用源初编号+领域尊称',
            '合欢宗男宠身份需体现依附性生存与话术周旋特质'
        ]
    },
    characters: [
        { name: '沈渡', role: 'protagonist', description: '合欢宗外门男宠，性格谨小慎微、善于话术周旋。拥有系统掠夺次位面能力，但每次掠夺后必受反噬痛楚与冷却期限制。行事遵循风险评估-资源置换-最小暴露原则，表面柔弱实则心思缜密。' },
        { name: '柳如烟', role: 'supporting', description: '合欢宗内门长老，沈渡的庇护者。修为道家归真境，性格冷厉但对沈渡有特殊容忍。掌握宗门资源分配权，是沈渡生存的关键依仗。' },
        { name: '裴惊鸿', role: 'rival', description: '儒家弘道境天才，五域论道大会魁首。正道楷模，行事光明磊落但对合欢宗极度排斥，视沈渡为邪道余孽。' },
        { name: '白无垢', role: 'supporting', description: '法家肃纲境执法使，负责监察跨位面异动。表面铁面无私，实则暗中调查系统掠夺者的身份，与沈渡形成微妙的猫鼠关系。' }
    ],
    outline: [
        { chapter: 1, title: '渊鳞隐契', summary: '沈渡在合欢宗后山采药时意外触发次位面裂隙，系统首次激活，掠夺到抽象概念类世界沉默之域的弱化能力——感知剥夺。反噬导致经脉寸断，被柳如烟救回。' },
        { chapter: 2, title: '命牌初刻', summary: '沈渡在养伤期间研究系统机制，发现掠夺能力受容器容量限制，每次使用需消耗气血与因果线。柳如烟察觉异常，沈渡以话术周旋掩饰。裴惊鸿到访合欢宗，对沈渡发出警告。' },
        { chapter: 3, title: '借势推锋', summary: '五域论道大会预选赛，沈渡被迫代表合欢宗出战。面对法家弟子，沈渡利用感知剥夺能力制造对手破绽，但反噬几乎暴露身份。白无垢在场观察，对沈渡的战斗方式产生怀疑。' }
    ]
};

fetch('http://localhost:3001/api/pipeline/generate-from-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template)
})
.then(r => r.json())
.then(d => {
    console.log('Template task started:', JSON.stringify(d, null, 2).substring(0, 500));
    if (d.taskId) {
        const poll = setInterval(() => {
            fetch('http://localhost:3001/api/pipeline/task/' + d.taskId)
                .then(r => r.json())
                .then(t => {
                    console.log('Task status:', t.status, 'progress:', t.progress);
                    if (t.status === 'completed' || t.status === 'failed') {
                        clearInterval(poll);
                        if (t.status === 'completed') {
                            console.log('RESULT:', JSON.stringify(t.result, null, 2).substring(0, 3000));
                        } else {
                            console.log('ERROR:', t.error);
                        }
                    }
                })
                .catch(e => { clearInterval(poll); console.error('Poll error:', e.message); });
        }, 5000);
    }
})
.catch(e => console.error('FAIL:', e.message));
