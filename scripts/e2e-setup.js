const store = require('../server/store');
const crypto = require('crypto');

const PROJECT_ID = crypto.randomUUID();
console.log('=== 端到端测试：创建新项目 ===');
console.log('PROJECT_ID:', PROJECT_ID);

const project = {
    id: PROJECT_ID,
    name: '位面掠夺·端到端测试',
    mode: 'novel',
    targetChapterCount: 360,
    currentChapter: 0,
    styleProfile: {
        key: 'witty-strategy',
        label: '位面掠夺·智斗喜剧',
        description: '高武智斗向，五家九境战力体系，金手指为位面掠夺+规则解读',
        povRule: '紧贴男主"局外人+吐槽役"视角。描写要快准狠，不要慢悠悠铺陈。',
        dialogueRule: '对话要像活人说话，不要像念台词。主角台词融合谨小慎微与抽象幽默，善用反讽、错位类比与冷面吐槽。',
        behaviorRule: '主角行动遵循"观察规则→解读漏洞→设计博弈→利用漏洞→一击制胜"循环。',
        toneRule: '搞笑是核心不是点缀。杜绝AI腔调，采用白描+冷面吐槽+节奏明快的网文喜剧笔法。'
    },
    genre: 'witty-strategy',
    wordConfig: { TARGET_MIN_WORDS: 2200, TARGET_MAX_WORDS: 2800, REJECT_MIN_WORDS: 1800, MAX_CHAPTER_WORDS: 3500 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};
store.setItem('projects', PROJECT_ID, project);
console.log('✅ 项目创建成功');

const materials = [];
const materialIds = {};
const subplaneNameToId = {};

function addMaterial(type, name, desc, content, parentPlane, isLocked, extra) {
    const id = crypto.randomUUID();
    materials.push({ id, type, name, desc, content, parentPlane: parentPlane || '', isLocked: isLocked || false, extra: extra || {} });
    materialIds[name] = id;
    if (type === 'sub-plane') subplaneNameToId[parentPlane || name] = id;
    return id;
}

addMaterial('worldview', '主位面·五域九境体系', '五域并立·九境通神',
`【世界架构】主位面由五大势力分域而治：儒域渊渟阁、法域律鉴司、道域散修联盟、佛域禅寂院、墨域衡机阁。
【核心矛盾】五域论道大会每十年一次；天机异象频繁出现位面裂隙；九境通神为理论极限。
【战力压制规则】同境对决智斗可弥补；跨1大境绝对压制但规则漏洞可创造局部均势；跨2大境以上碾压级差距。`);

addMaterial('power-system', '五家九境战力体系', '9大等级x9小等级',
`【儒家】1.启微→2.明理→3.守正→4.弘道→5.经世→6.致知→7.格物→8.化境→9.通神
【法家】1.立规→2.定矩→3.执刑→4.明赏→5.肃纲→6.镇狱→7.裁天→8.律令→9.极刑
【道家】1.纳虚→2.炼炁→3.结婴→4.阳神→5.历劫→6.归真→7.合道→8.太初→9.无相
【佛门】1.闻思→2.修慧→3.断惑→4.证果→5.罗汉→6.菩萨→7.佛陀→8.如来→9.涅槃
【墨家】1.观微→2.构型→3.成阵→4.破虚→5.逆理→6.执衡→7.归一→8.太衍→9.无枢
【禁用术语】练气、筑基、金丹、元婴、化神、渡劫`);

addMaterial('power-system', '系统机制·位面掠夺', '位面掠夺+规则解读',
`【系统特征】反馈通过身体感受+脑内声音，绝不弹出UI。像流氓软件+广场舞大妈+算命先生的混合体。
【规则解读】进入次位面后自动激活，能看见底层规则脉络，规则漏洞处纹路断裂或扭曲。
【能力掠夺】完成系统任务后获得掠夺资格，每个位面仅一次。能力功能完整，受主世界修为天花板自然压制。
【道具获取】探索遗迹/击败守护者/完成任务奖励/与人交易。道具不是掠夺！
【积分系统】境界提升/功法升级/商城购买/已历位面道具购买。积分以命牌刻痕错位感烙入识海。`);

addMaterial('character', '沈渡', '男主·渊渟阁外门弟子',
`核心欲望：活下去并搞清楚这破系统到底想干什么
内在矛盾：谨小慎微的本性 vs 被迫卷入的荒诞命运
行为模式：观察规则→解读漏洞→设计博弈→利用漏洞→一击制胜
性格：冷面吐槽+内心戏丰富+表面怂实际精
修为：儒家启微二阶（极低）
特殊：肉身穿越，非魂穿，此事仅自己知晓`, null, true);

addMaterial('character', '陆衡霜', '渊渟阁内门大师姐',
`核心欲望：突破第八境，证明儒家道统
内在矛盾：严守师门规矩 vs 对沈渡异常天赋的好奇
行为模式：以理服人（物理），观察后出手
性格：冷面热心+毒舌护短+对规则有强迫症般的执着
修为：儒家弘道五阶（极高）`, null, true);

addMaterial('character', '方砚', '律鉴司少司命',
`核心欲望：建立完美的秩序体系
内在矛盾：规则至上的信念 vs 规则无法覆盖的灰色地带
行为模式：先立规矩再行事，以规则为武器
性格：强迫症+话少但每句都是结论+偶尔被沈渡气到失态
修为：法家肃纲三阶`, null, true);

addMaterial('craft', '写作手法基底', '智斗向+搞笑调味',
`【文风】接地气白话文风，禁止堆砌华丽辞藻，禁止空洞修辞
【智斗】每章至少1处智斗元素，来源：规则漏洞/信息差/心理博弈/借力打力
【搞笑】前期每章3处笑点，中后期每章2处。四条腿：内心吐槽30%/系统反馈30%/规则错位20%/角色互动20%
【信息释放】禁止前3章直述系统全貌，禁止前5章直述金手指机制，展示代替告知
【爽感】每2-3章一个爽感点，类型轮换，禁止主角连续3章吃瘪
【系统交互去UI化】通过身体感受传达，严禁"系统弹出任务"等UI描述`);

addMaterial('craft', '卷节奏模板', '30章一卷',
`第一阶段·主世界铺垫（Ch1-5）：主角日常+系统激活+规则解读初体验+核心配角+系统发布位面任务
第二阶段·次位面探索（Ch6-25）：初入位面观察规则→深入解读发现漏洞→位面核心规则对抗完成掠夺
第三阶段·主世界回响（Ch26-30）：返回主世界消化能力/道具+实力提升体现+智斗博弈+下一卷伏笔`);

// ========== 第一卷次位面：沉默之域 ==========
addMaterial('sub-plane', '次位面·沉默之域', '规则怪谈类·第一卷',
`【核心规则】以诡异规则为核心的恐怖解谜世界。沉默之域的底层规则为"感知剥夺"——所有进入者的五感会被逐步剥夺，唯有遵循特定行为模式才能暂时恢复。规则以"禁忌条令"形式存在，违反者将永久失去对应感官。位面内无昼夜之分，一切声响皆被吞噬。
【主线剧情】沈渡进入沉默之域，五感逐步被剥夺，必须在彻底失感前找到系统任务目标——从缄默守卫处取得"沉默面纱"
【系统任务】在沉默之域中存活并取得沉默面纱，任务完成后获得掠夺资格
【关键转折】沈渡发现"感知剥夺"规则本身有漏洞——当所有感官被剥夺到极限时，反而能"看见"规则脉络
【智斗要素】在五感逐步丧失的条件下解谜+博弈，用规则解读弥补感官缺失
【掠夺能力】规则解读·深度模式——可主动进入"感知剥离"状态以看见更深层规则脉络
【可获取道具】沉默面纱（任务奖励→可遮蔽自身规则痕迹）、回音石（探索遗迹→短暂恢复一感）
【位面势力】缄默守卫（哑婆）、被困者（闻笙）、规则漏洞产物（无瞳）
【主世界回响】沈渡带回沉默面纱，在主世界智斗中可遮蔽自身规则痕迹，让对手无法预判`, '次位面·沉默之域');

addMaterial('faction', '缄默守卫', '沉默之域·规则维护方',
`【定位】沉默之域的规则执行者，中立但致命，不隶属任何势力
【特色】形如枯木老妪，永远闭目封耳，仅在规则被违反时出现
【与主角关系】系统任务目标——需从哑婆手中取得"沉默面纱"后完成掠夺
【内部关系】与闻笙达成默契（不违反规则则不被攻击）；与无瞳互不干涉`, '次位面·沉默之域');

addMaterial('character', '哑婆', '缄默守卫·规则执行者',
`核心欲望：维护沉默之域的规则秩序
内在矛盾：执行规则的使命 vs 对"不违规者"的微妙善意
行为模式：永远沉默，仅通过行动表达——违反规则者被剥夺感官，不违反者被无视
性格：枯木般的外表下藏着对秩序的执着，偶尔流露的善意比恐怖更令人不安
禁忌：禁止脸谱化恐怖NPC`, '次位面·沉默之域');

addMaterial('character', '闻笙', '被困沉默之域的前代穿越者',
`核心欲望：逃离沉默之域
内在矛盾：已适应规则存活数十年 vs 内心从未放弃逃离的希望
行为模式：以音乐（无声之乐）与沈渡交流，提供关键信息但从不直接告知答案
性格：温和但疏离，对后来者有复杂的保护欲和嫉妒心
禁忌：禁止工具人化`, '次位面·沉默之域');

addMaterial('character', '无瞳', '沉默之域中唯一能"看见"的存在',
`核心欲望：存在本身（它不知道自己想要什么）
内在矛盾：规则漏洞的产物 vs 拥有自我意识的存在
行为模式：出现在规则被违反的瞬间，"看"向违规者后消失
性格：神秘莫测，既非敌也非友，它的"注视"本身就是一种信息
禁忌：禁止脸谱化神秘NPC`, '次位面·沉默之域');

addMaterial('equipment', '沉默面纱', '任务奖励·可遮蔽规则痕迹',
`获取方式：完成系统任务后从哑婆处获得
功能：遮蔽自身规则痕迹，让对手无法通过规则脉络预判行动
限制：每次使用消耗积分，持续时间有限
受主世界修为天花板压制：对高一个大境界以上者效果减半`, '次位面·沉默之域');

addMaterial('equipment', '回音石', '探索遗迹获得·短暂恢复一感',
`获取方式：在沉默之域遗迹中探索发现
功能：使用后短暂恢复一种感官（约一刻钟）
限制：每块回音石只能使用一次
受主世界修为天花板压制：恢复时间随修为差距缩短`, '次位面·沉默之域');

addMaterial('foreshadowing', '伏笔·闻笙的真实身份', '沉默之域伏笔',
`内容：闻笙并非普通穿越者，而是上一任系统宿主的残影
预期回收窗口：第25-28章
关联角色：闻笙、沈渡、系统
回收方式：沈渡在掠夺能力时发现规则脉络中有"前任宿主"的残留印记`, '次位面·沉默之域');

addMaterial('foreshadowing', '伏笔·无瞳的注视', '沉默之域伏笔',
`内容：无瞳的"注视"实际上是规则自我修复的机制，每次注视都在修补规则漏洞
预期回收窗口：第20-23章
关联角色：无瞳、沈渡
回收方式：沈渡发现利用无瞳的注视可以暂时"冻结"规则`, '次位面·沉默之域');

// ========== 写入素材 ==========
const factionNameToId = {};
let created = 0;
materials.forEach(m => {
    let resolvedParentPlane = m.parentPlane;
    if (resolvedParentPlane && resolvedParentPlane !== '主世界' && subplaneNameToId[resolvedParentPlane]) {
        resolvedParentPlane = subplaneNameToId[resolvedParentPlane];
    }
    if (m.type === 'faction') {
        factionNameToId[m.name] = m.id;
    }
    store.setItem('materials', m.id, {
        id: m.id,
        projectId: PROJECT_ID,
        type: m.type,
        name: m.name,
        description: m.desc || '',
        initialContent: m.content,
        currentContent: m.content,
        parentPlane: resolvedParentPlane || null,
        isLocked: m.isLocked || false,
        isFoundation: m.isLocked || false,
        tags: [],
        version: 1,
        changeLog: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    created++;
});

materials.filter(m => m.type === 'character' && m.parentPlane && m.parentPlane !== '主世界' && m.parentPlane !== null).forEach(m => {
    const mat = store.queryItems('materials', { projectId: PROJECT_ID, name: m.name })[0];
    if (mat && subplaneNameToId[m.parentPlane]) {
        const factions = store.queryItems('materials', { projectId: PROJECT_ID, type: 'faction', parentPlane: subplaneNameToId[m.parentPlane] });
        if (factions.length > 0) {
            store.setItem('materials', mat.id, { ...mat, parentFaction: factions[0].id });
        }
    }
});

console.log('✅ 素材创建成功:', created);

// ========== 创建30章大纲（第一卷：沉默之域） ==========
const outlines = [
    'Ch1 沈渡在渊渟阁外门扫地，被师姐陆衡霜叫住——她发现沈渡手腕上多了一道奇怪的气流印。沈渡自己也不知道那是什么，只觉得脑子里偶尔冒出一些莫名其妙的声音。',
    'Ch2 系统首次"发言"——识海灼烧，一个欠揍的声音说检测到高维灵魂正在格式化。沈渡以为脑瘤。系统发布新手任务：用"物理说服"让管事闭嘴。沈渡照做后获得第一笔积分。',
    'Ch3 沈渡发现手腕上的气流印会微微发烫——系统沉默时的身体反馈。陆衡霜注意到沈渡的异常，但没有追问。方砚来访渊渟阁，带来律鉴司关于"天机异象"的通报。',
    'Ch4 系统发布位面任务：进入"沉默之域"取得沉默面纱。沈渡问什么是沉默之域，系统回"你不想知道"。沈渡在藏书阁找到关于位面裂隙的记载，发现五域都有异象。',
    'Ch5 沈渡被迫穿越——位面裂隙在渊渟阁后山出现，系统"推荐"沈渡跳进去。陆衡霜试图阻止但晚了一步。沈渡坠入沉默之域，第一个感受：绝对安静。',
    'Ch6 沈渡初入沉默之域，五感开始被剥夺——先是嗅觉消失，然后味觉。系统冷不丁说"建议不要违反规则"，但没说规则是什么。沈渡发现地面上有银色纹路——规则脉络。',
    'Ch7 沈渡观察到沉默之域的基本规则：不能发出声音、不能触碰他人、不能回头。违反一条就永久失去一种感官。沈渡用规则解读发现银色纹路在"禁忌条令"附近会断裂。',
    'Ch8 遇到闻笙——一个在沉默之域存活数十年的前代穿越者。闻笙用"无声之乐"与沈渡交流，告诉他沉默之域有三层规则，表层规则只是冰山一角。闻笙警告：哑婆快来了。',
    'Ch9 哑婆首次出现——另一个被困者违反了"不能发出声音"的规则，哑婆瞬间出现，剥夺了那人的听觉。沈渡目睹全过程，发现哑婆闭目封耳但行动精准——她靠规则脉络感知。',
    'Ch10 沈渡开始适应沉默之域的规则，发现"感知剥夺"有规律可循——每违反一条规则失去一种感官，但遵循特定行为模式可以暂时恢复。系统提示"检测到规则漏洞3处"。',
    'Ch11 沈渡利用第一个规则漏洞：在规则脉络断裂处停留，可以暂时免疫感知剥夺。他开始系统性地探索沉默之域的深层规则。闻笙对此表示惊讶——从没有人主动寻找规则漏洞。',
    'Ch12 无瞳首次出现——沈渡在探索中触发了深层规则，无瞳的"注视"降临。沈渡感到一种奇异的"被看见"感，但不是通过视觉。无瞳注视后消失，沈渡发现被注视处的规则脉络被"修复"了。',
    'Ch13 沈渡意识到无瞳是规则自我修复的机制——每次注视都在修补漏洞。这意味着他找到的漏洞会被逐渐修复，必须加快速度。系统说"补丁可能含病毒"，沈渡选择利用漏洞而非等待修复。',
    'Ch14 沈渡与闻笙深入交流，得知沉默面纱在哑婆手中。闻笙透露哑婆并非恶意——她只是在执行规则。沈渡开始思考：有没有不违反规则就能取得沉默面纱的方法？',
    'Ch15 第二次遭遇哑婆——沈渡差点违反"不能触碰他人"的规则，但在最后一刻收手。哑婆"看"了他一眼（尽管她闭着目），然后离开。沈渡发现哑婆对他有一种微妙的"放行"。',
    'Ch16 沈渡发现第二个规则漏洞：在所有感官被剥夺到极限时，反而能"看见"最深层规则脉络。他主动放弃触觉，进入"感知剥离"状态，看见了沉默之域的核心规则——感知剥夺本身就是一条可以逆转的规则。',
    'Ch17 系统发布核心任务：从哑婆处取得沉默面纱。沈渡制定博弈方案——不与哑婆对抗，而是利用规则本身。他需要找到一个"规则允许取得沉默面纱"的路径。',
    'Ch18 沈渡发现沉默之域的第三层规则：当一个人在沉默之域中"完全沉默"（不违反任何规则且不产生任何规则波动）持续一定时间后，可以获得"规则豁免"——暂时不受任何规则约束。',
    'Ch19 沈渡开始"完全沉默"的修炼——比想象中困难得多，因为连思维活动都会产生微弱的规则波动。闻笙用无声之乐帮助沈渡平息内心。系统偶尔冒出一句"你今天忘带脑子了"。',
    'Ch20 沈渡接近"完全沉默"状态，但无瞳再次出现开始修复他利用过的漏洞。时间紧迫。沈渡必须在漏洞被完全修复前完成规则豁免。他发现无瞳的注视有"冻结规则"的副作用——被注视的瞬间规则暂停运作。',
    'Ch21 沈渡利用无瞳的注视"冻结规则"的瞬间，完成了"完全沉默"状态，获得规则豁免。在豁免期间，他可以不受约束地行动——包括触碰哑婆。',
    'Ch22 沈渡在规则豁免期间接近哑婆，发现哑婆并非不可沟通——她只是在等待一个"不违反规则但也不被规则约束"的人。哑婆将沉默面纱交给沈渡，说这是她守护了千年的东西。',
    'Ch23 取得沉默面纱后，系统判定任务完成，获得掠夺资格。沈渡选择掠夺能力：规则解读·深度模式——可主动进入感知剥离状态以看见更深层规则脉络。能力功能完整，受修为压制。',
    'Ch24 沈渡在掠夺过程中发现规则脉络中有"前任宿主"的残留印记——闻笙的真实身份浮出水面。闻笙是上一任系统宿主的残影，他在沉默之域中存活了数百年，等待下一个宿主。',
    'Ch25 闻笙的告别——他选择将自己的"无声之乐"融入沉默之域的规则中，让后来的被困者有一线生机。沈渡带着沉默面纱和回音石离开沉默之域。',
    'Ch26 返回主世界——沈渡发现自己离开只过了一天。陆衡霜质问沈渡去了哪里，沈渡含糊其辞。系统沉默，手腕上的气流印微微发烫。',
    'Ch27 沈渡在主世界测试新能力——规则解读·深度模式在主世界同样有效，但规则脉络远比次位面复杂。他发现渊渟阁的阵法中有一条异常的规则脉络——有人在暗中操控。',
    'Ch28 方砚再次来访，这次是调查渊渟阁的"天机异象"。沈渡用沉默面纱遮蔽自身规则痕迹，方砚的规则探测完全失效。方砚对沈渡产生了强烈的好奇。',
    'Ch29 沈渡在主世界首次智斗——利用规则解读发现方砚的规则探测有盲区，在盲区内行动不被发现。方砚虽然没抓到证据，但对沈渡的"隐藏能力"产生了警觉。',
    'Ch30 卷末收束——沈渡的实力从启微二阶提升到明理初阶。陆衡霜决定收沈渡为亲传弟子。系统发布新任务预告：下一个位面——"追逐永恒"。沈渡心想：这破系统还没完没了了？'
];

const chapterIds = [];
for (let i = 0; i < outlines.length; i++) {
    const chapterId = crypto.randomUUID();
    chapterIds.push(chapterId);
    store.setItem('chapters', chapterId, {
        id: chapterId,
        projectId: PROJECT_ID,
        chapterNumber: i + 1,
        status: 'outlined',
        outline: outlines[i],
        content: '',
        _reviewRounds: 0,
        _wordCountRetry: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}
console.log('✅ 30章大纲创建成功');

// ========== 污染检测 ==========
const allMats = store.queryItems('materials', { projectId: PROJECT_ID });
const silencePlaneId = subplaneNameToId['次位面·沉默之域'];
const silenceMats = allMats.filter(m => m.parentPlane === silencePlaneId);
const mainWorldMats = allMats.filter(m => !m.parentPlane || m.parentPlane === null);

console.log('\n=== 污染检测 ===');
console.log('沉默之域素材数:', silenceMats.length);
console.log('主世界素材数:', mainWorldMats.length);

let pollutionFound = false;
for (const sm of silenceMats) {
    for (const mw of mainWorldMats) {
        if (sm.currentContent && mw.currentContent && sm.currentContent.includes(mw.name) && sm.type === 'character') {
            if (!['沈渡', '陆衡霜', '方砚'].includes(sm.name)) {
                console.log('⚠ 跨位面污染:', sm.name, '引用了主世界角色', mw.name);
                pollutionFound = true;
            }
        }
    }
}
if (!pollutionFound) console.log('✅ 无跨位面污染');

// ========== 输出关键信息 ==========
console.log('\n=== 素材统计 ===');
const types = {};
allMats.forEach(m => { types[m.type] = (types[m.type] || 0) + 1; });
Object.entries(types).forEach(([t, c]) => console.log(`  ${t}: ${c}`));
console.log('总计:', allMats.length);

console.log('\n=== 章节统计 ===');
const chapters = store.queryItems('chapters', { projectId: PROJECT_ID });
console.log('大纲章节数:', chapters.length);
console.log('状态分布:', chapters.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {}));

console.log('\n=== 关键ID ===');
console.log('PROJECT_ID:', PROJECT_ID);
console.log('沉默之域ID:', silencePlaneId);
console.log('前10章ID:');
for (let i = 0; i < 10; i++) {
    console.log(`  Ch${i + 1}: ${chapterIds[i]}`);
}
