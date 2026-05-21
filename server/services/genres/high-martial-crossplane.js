module.exports = {
    id: 'high-martial-comedy',
    label: '主位面高武·反套路喜剧',
    patterns: ['高武', '反套路', '搞笑', '肉身穿越', '系统升级', '五家九境', '抽象幽默', '反AI痕迹', 'high-martial-comedy'],

    isMatch(styleProfile) {
        const key = (styleProfile?.key || '').toLowerCase();
        const label = (styleProfile?.label || '').toLowerCase();
        const desc = (styleProfile?.description || '').toLowerCase();
        return this.patterns.some(p =>
            key.includes(p.toLowerCase()) || label.includes(p.toLowerCase()) || desc.includes(p.toLowerCase())
        );
    },

    perspectiveSchema: {
        fields: '"perspective":"protagonist/narrator/other"',
        label: '视角：protagonist/narrator/other',
        values: ['protagonist', 'narrator', 'other']
    },

    foundation: {
        additionalConstraints: [
            { id: 'grounded-style', label: '接地气白话文风', desc: '严禁文青病：不要堆砌华丽辞藻、空洞修辞、诗意描写。用大白话讲故事，像跟朋友聊天一样自然。环境描写最多2句带过，把笔墨留给动作、对话、吐槽。读者要的是爽和笑，不是文学鉴赏。关键场景可以有画面感和张力，但不是通篇口水话。' },
            { id: 'fast-pace', label: '快节奏硬约束', desc: '3章内必须出金手指并完成首次使用；10章内必须完成第一次打脸/突破/逆袭；每章必须有明确的剧情推进（不能一整章在描写和心理活动里打转）；禁止连续2段纯环境描写或纯心理活动。' },
            { id: 'comedy-mandatory', label: '喜剧占比硬指标', desc: '每章至少3处让人笑出来的点（吐槽/错位/反差/荒诞/自嘲），喜剧元素占比不低于30%。搞笑不是点缀，是本书核心卖点。幽默来源：1.主角内心吐槽（现代思维碰撞修仙世界）；2.系统任务的荒诞感；3.次位面规则与主世界的错位；4.配角对主角行为的误解。场景适配：日常/过渡场景3处以上笑点，紧张/危机场景允许降至1-2处（冷面吐槽/内心OS），爽感高潮场景允许降至1处（反差式收尾吐槽），全卷平均不低于30%即可。' },
            { id: 'anti-ai-trace', label: '反AI写作痕迹（题材增强）', desc: '基底已含反AI红线，本题材增强：白描+心理反差+节奏留白，杜绝"仿佛/似乎/不禁"高频堆砌与"镜头缓缓拉近"影视化套话' },
            { id: 'physical-secret', label: '肉身穿越绝对保密', desc: '仅男主知晓自身为肉身降临，主位面他人皆为魂穿或仅通过秘法/分身/偶然机缘知晓片段。无次位面监管机构，非烂大街副本机制。' },
            { id: 'system-anti-cliché', label: '反套路系统逻辑', desc: '积分仅用于主位面技能等级跃迁或装备购置；掠夺需完成系统指派任务后获得资格，每位面限用一次，无冷却/反噬代价。掠夺能力功能完整，受主世界修为天花板自然压制（对同境者效果完整，每高一个大境界效果减半），禁止用时间限制/残废化描述弱化。' },
            { id: 'power-stacking-limit', label: '战力堆叠硬阈值', desc: '次位面能力/道具仅可提升3-9个小等级，禁止直接跨越一个大境界对战；若差距仅差三个小等级，允许跨大境界硬撼但需符合战术逻辑与肉身极限。' },
            { id: 'main-plane-depth', label: '主位面人物立体刻画', desc: '主位面角色必须拥有完整行为动机、性格弧光与社交网络，禁止工具人化或为剧情强行降智。' },
            { id: 'naming-elegance', label: '古典命名规范（题材增强）', desc: '基底已含命名底线红线，本题材增强：命名必须古典雅致有意境，禁用龙傲天/叶辰/柳如烟等大众网文烂梗，违规则硬拦截。' },
            { id: 'meme-quality-control', label: '优质抽象梗过滤', desc: '幽默需高级错位感（如卸载QQ式），严禁低质烂梗（就这/绝了/栓Q等），必须贴合语境且具喜剧张力。' },
            { id: 'volume-rhythm', label: '卷节奏硬约束', desc: '30章一卷，一卷一个次位面。每卷节奏：约5章主世界铺垫→约20章深入次位面→约5章主世界回响（三阶段合计30章，次位面不少于15章，回响不少于3章）。禁止一卷出现两个次位面，禁止次位面章节少于15章，禁止主世界回响少于3章。每经历一个次位面后必须回主世界浪一波（打脸/论道/被认可）。' },
            { id: 'golden-finger-balance', label: '金手指爽感平衡', desc: '金手指核心是「压制下见真章」：能力在次位面内是核心依仗效果完整，回主世界受修为天花板压制但绝不等于废掉——压制创造的是「解题空间」而非「无解困局」。爽感来源五维并重：①智斗爽（规则漏洞以弱胜强/用信息差反杀/借力打力）；②社交爽（打脸/被认可/身份反转/装逼成功/以弱者姿态获得强者尊重）；③成长爽（突破/融合/升级/能力组合出新花样）；④情感爽（师徒传承/兄弟义气/暧昧互动/被信任被需要）；⑤反差爽（低境界做出高境界都做不到的事/废脉体质惊人操作/众人震惊）。每2-3章必须有一个爽感点（不一定是大高潮，小爽也行），每卷至少3-4个爽感高潮。禁止无脑平推也禁止全程吃瘪。当修为差距导致能力效果大幅削弱时，允许通过规则错位/战术推演/环境利用/配合队友/能力组合创新来弥补战力差距实现"够用"，禁止无脑平推也禁止凭空突破。关键：爽感不一定非得战力碾压，社交打脸、智斗翻盘、情感共鸣、反差震惊都是爽。' },
            { id: 'supporting-cast', label: '配角戏份与情感线', desc: '配角不能全程边缘化，但也不用每章都出场——偶尔给配角高光时刻即可，大约每5-8章安排1-2章配角戏份。情感线类型：友情（兄弟/同门并肩作战/互相托付后背）、师徒情（传承/教导/守护/师尊对弟子的信任与放手）、暧昧线（若即若离/误会/心动/欲言又止/心照不宣）。配角互动要有化学反应，不是工具人式配合，每个配角都有自己的立场和行事逻辑。主角每次从次位面回来，配角应该有感知和互动——苏挽青的敏锐观察、陆衡霜的剑道共鸣、顾缄言的暗中记录。情感线推进要自然，通过事件和对话流露，不要硬塞。情感线本身也是爽感来源：被信任的感动、并肩作战的热血、暧昧互动的心跳。' },
            { id: 'tomato-pacing', label: '番茄节奏适配', desc: '每2-3章必须有一个爽感点（大小皆可：大爽=打脸/突破/翻盘，小爽=吐槽成功/被认可/暧昧互动/智斗小胜）。禁止主角连续3章以上吃瘪无翻盘。每章结尾必须有钩子（悬念/反转/期待感）。短段落、快推进、高信息密度、不注水。爽感类型要轮换：不要连续3次都是战力爽，要穿插智斗爽→社交爽→情感爽→反差爽。节奏适配番茄小说读者习惯：快节奏、高密度、持续爽感、不拖沓。' }
        ],
        additionalFoundationRules: [
            '铁律零（最高优先级）：文风必须接地气，禁止文青病。用大白话讲故事，不要堆砌华丽辞藻。环境描写最多2句带过，把笔墨留给动作、对话、吐槽。读者要的是爽和笑，不是文学鉴赏。每章至少3处笑点，喜剧占比不低于30%。关键场景可以有画面感和张力。',
            '铁律零点五（节奏硬约束）：3章内出金手指并首次使用；10章内完成第一次打脸/突破/逆袭；每章必须有明确剧情推进，禁止整章纯描写纯心理。禁止连续2段纯环境描写或纯心理活动。场景切换要快，不要在一个地方磨叽超过3段。每2-3章必须有一个爽感点（大小皆可），禁止连续3章吃瘪无翻盘。爽感类型要轮换，不要连续都是战力爽。',
            '铁律零点七（卷节奏·最高优先级）：30章一卷，一卷一个次位面。每卷节奏：5-10章主世界铺垫→20-25章深入次位面→5章主世界回响。禁止一卷出现两个次位面！禁止次位面章节少于15章！每经历一个次位面后必须回主世界浪一波（打脸/论道/被认可/实力体现/配角互动）。',
            '铁律一：主位面战力绝对压制与阶级壁垒不可破。次位面仅为"能力插件库"，严禁数值崩坏。主角堆叠次位面道具/技能仅可提升3-9个小等级，禁止直接跨越一个大境界对战；若差距仅差三个小等级，允许跨大境界硬撼，但必须通过战术推演、环境利用或规则错位实现，禁止无脑平推。',
            '铁律一五（金手指爽感平衡）：金手指核心是「压制下见真章」。能力在次位面内是核心依仗效果完整，回主世界受修为天花板压制但绝不等于废掉——压制创造的是「解题空间」而非「无解困局」。爽感来源五维并重：智斗爽、社交爽、成长爽、情感爽、反差爽。每2-3章必须有一个爽感点，每卷至少3-4个爽感高潮，禁止无脑平推也禁止全程吃瘪。爽感不一定非得战力碾压，社交打脸、智斗翻盘、情感共鸣、反差震惊都是爽。',
            '铁律一八（配角戏份与情感线）：配角不能全程边缘化，但也不用每章都出场——偶尔给配角高光时刻即可，大约每5-8章安排1-2章配角戏份。情感线类型：友情（并肩作战/互相托付后背）、师徒情（传承/守护/信任与放手）、暧昧线（若即若离/心动/欲言又止）。配角互动要有化学反应，主角每次从次位面回来配角应有感知和互动。情感线推进要自然，情感线本身也是爽感来源。',
            '铁律二：穿越真相与信息差绝对保密。仅男主知晓自身为"肉身降临"，主位面他人皆为"魂穿"或仅通过秘法/分身/偶然机缘知晓片段。战力巅峰者或可窥见天机，绝不设置次位面监管机构，严禁烂大街的"副本大厅/公共面板"设定。所有跨位面交互必须保持单线信息差张力。',
            '铁律三：反套路系统运作逻辑去UI化、去数值化。积分四大用途：1.主世界境界提升；2.功法等级升级；3.系统商城购买；4.已历次位面道具购买。能力掠夺需完成系统指派任务后获得资格，每个位面仅可掠夺一次。道具通过次位面中获得或与人交易获得，道具不是掠夺。能力与道具功能完整，受主世界修为天花板自然压制——对同境者效果完整，每高一个大境界效果减半，跨两个大境界以上近乎无效。严禁用时间限制或残废化描述弱化。系统反馈必须荒诞幽默且反常识，杜绝机械播报。',
            '铁律四：人物刻画与文风规范。主位面角色必须具备完整利益博弈逻辑与性格弧光；命名严格遵循古典雅致。幽默需高级抽象，严禁低质烂梗与AI写作痕迹。',
            '铁律四点五（IP风险防御）：次位面涉及知名IP角色时，禁止直呼其名，只能描述外貌特征、性格代号、标志性能力。❌"路飞"→✅"那个戴草帽的橡皮人"；❌"孙悟空"→✅"那个会七十二变的石猴"；❌"哆啦A梦"→✅"那个蓝色圆手机器猫"。IP道具同理：❌"恶魔果实"→✅"那种吃了会变异的诡异果实"；❌"仙豆"→✅"那种吃一颗就能满血复原的豆子"。IP角色设定必须符合原著核心特征，不可魔改核心人设，需标注[CANON-VERIFIED]。',
            '铁律四点七（反固定套路·活人写作）：禁止每章结构雷同。章节开头至少5种轮换（对话/动作/环境/回忆/悬念），转折位置不固定，收尾至少4种轮换（悬念/反转/情感/留白）。禁止评分式时间描述（"0.5秒""0.3秒"），用正常人时间感知。禁止连续3章使用相同叙事结构。活人写作：像真人在讲故事，不是在填模板。'
        ],
        systemMechanismDimming: true,
        systemMechanismTarget: '将系统提示、积分结算、掠夺冷却等管线元数据转化为荒诞幽默的具象化表达（如"命牌刻痕的错位感""气机牵引的反常识反馈"），严禁直接输出UI界面、进度条或纯数字面板。'
    },

    incompatibleConstraints: ['baby-perspective-only', 'no-adult-inner-voice', 'cute-first-always', 'character-intro-whitelist', 'dialogue-authentic', 'slow-burn-romance', 'bitter-camaraderie', 'montage-narrative', 'rule-concreteness', 'pov-lock-horror', 'rule-pace', 'dungeon-mechanics-pacing', 'pov-lock-dungeon', 'no-deus-ex-machina', 'trust-contract-rule', 'naming-convention-dungeon', 'rule-density-control', 'mechanic-visualization', 'protagonist-proactivity', 'cliffhanger-enforcement', 'pacing-micro-loop'],
    requiredConstraints: ['grounded-style', 'fast-pace', 'comedy-mandatory', 'anti-ai-trace', 'hook-every-chapter'],

    styleProfile: {
        key: 'high-martial-comedy',
        label: '主位面高武·反套路喜剧',
        povRule: '紧贴男主"局外人+吐槽役"视角。描写要快准狠，不要慢悠悠铺陈。主位面侧重人物冲突与规则碰撞（用对话和动作推进，不要大段旁白）；次位面以碎片化信息或男主主观体验呈现，严禁全知解说。',
        dialogueRule: '对话要像活人说话，不要像念台词。主角台词融合谨小慎微与抽象幽默，善用反讽、错位类比与冷面吐槽。配角对话需符合其阶级/学派背景但必须接地气（儒家弟子也会说大白话，不是每句都引经据典）。严禁AI式"您说得对""果然如此""不禁让人感慨"等机械应答与空洞升华。',
        behaviorRule: '主角行动遵循"条件触发-能力适配-生存优化"循环。掠夺后不描写反噬，但需展现"技能融合/道具适配"的战术推演过程。主位面角色行为必须有完整前因后果与利益博弈逻辑，禁止工具人化或为推进剧情强行降智。',
        toneRule: '搞笑是核心不是点缀。幽默来源：1.主角内心吐槽（现代思维碰撞修仙世界）；2.系统任务的荒诞感；3.次位面规则与主世界的错位；4.配角对主角行为的误解。文风要接地气，用大白话讲故事，不要文青病。杜绝AI腔调（避免"仿佛/似乎/不禁"高频堆砌、"镜头缓缓拉近"等影视化套话），采用白描+冷面吐槽+节奏明快的网文喜剧笔法。关键场景可以有画面感和张力。',
        titleRule: '采用"第X章：[四字雅称]+[反套路事件]"格式（例：第三章：渊鳞隐契·系统让我卸载QQ）。标题需暗含喜剧反转或规则错位，禁止直白说明性短语。',
        reviewFocus: '卷节奏合规性|爽感节奏|喜剧元素占比|文风接地气程度|战力阶梯严谨性|跨位面信息差|系统反套路逻辑|人物刻画深度|配角戏份|情感线推进|幽默质量与AI痕迹过滤|命名雅化合规率|掠夺限制遵守度|段落节奏|金手指平衡',
        materialFocus: { primary: ['character', 'worldview', 'power-system'], secondary: ['equipment', 'foreshadowing', 'institution'], skip: [] },
        constraintOverrides: ['hook-every-chapter'],
        characterRefRules: '严格区分主位面称谓与次位面代号。命名必须古典雅致，禁止网文烂梗。对话中避免现代互联网低质热梗，幽默需贴合当下语境且具抽象趣味。'
    },

    genreBase: {
        BEHAVIOR_APPEND: '主角所有决策必须经过"条件触发-能力适配-战术推演"逻辑链。堆叠次位面道具/技能时，需详细描写如何与主位面功法融合以提升生存概率（仅可提升3-9小等级）。禁止无脑平推或跨越大境界秒杀。金手指核心是「压制下见真章」，能力在次位面是核心依仗效果完整，回主世界受修为天花板压制但绝不等于废掉——压制创造的是「解题空间」而非「无解困局」。爽感来源五维并重：智斗爽、社交爽、成长爽、情感爽、反差爽。爽感不一定非得战力碾压。',
        REQUIRED_CONSTRAINT_OVERRIDES: ['power-fantasy', 'fast-escalation'],
        TONE_APPEND: '搞笑是核心卖点，不是点缀。每章至少3处笑点。幽默来源：1.主角内心吐槽（现代思维碰撞修仙世界）；2.系统任务的荒诞感；3.次位面规则与主世界的错位；4.配角对主角行为的误解。文风要接地气，用大白话讲故事，不要文青病，不要堆砌华丽辞藻。关键场景可以有画面感和张力。',
        REVIEW_APPEND: '重点核查：1. 卷节奏是否合规（30章一卷一次位面，5-10主线+20-25次位面+5回响）；2. 爽感节奏是否达标（每2-3章一个爽感点，类型要轮换）；3. 喜剧元素是否达标（每章至少3处笑点）；4. 文风是否接地气（禁止文青病）；5. 是否出现AI写作痕迹；6. 幽默梗是否优质应景；7. 主位面人物刻画是否完整立体；8. 配角戏份是否偶尔出现（每5-8章1-2章配角戏份即可，不用每章都有）；9. 情感线是否有推进（友情/师徒/暧昧）；10. 次位面信息差是否严格保持；11. 掠夺机制是否遵守设定；12. 战力堆叠是否严格限制；13. 金手指是否平衡（压制下见真章，不OP也不废，爽感五维并重）；14. 段落节奏是否合规。'
    },

    qualityChecks: {
        onomatopoeia: { enabled: false },
        visualAnchors: { enabled: false },
        motherChildDialogue: { enabled: false },
        modernSlangExtra: true,
        aiTraceFilter: { enabled: true },
        memeQuality: { enabled: true },
        namingElegance: { enabled: true },
        powerScalingLimit: { enabled: true },
        paceCheck: { enabled: true },
        comedyCheck: { enabled: true }
    },

    writerHints: {
        terminologyDimming: '主位面五家战力体系必须严格遵循"9大等级×9小等级"结构，命名需脱离传统修仙网文套路（如练气、筑基、金丹等），采用古典雅致且具象化意境的词汇。儒家侧重"理-道-世"进阶（启微→明理→守正→弘道→经世→致知→格物→化境→通神）；道家侧重"虚-炁-真-道"演化（纳虚→炼炁→结婴→阳神→渡劫→归真→合道→太初→无相）；法家侧重"规-刑-律-极"秩序（立规→定矩→执刑→明赏→肃纲→镇狱→裁天→律令→极刑）；佛门侧重"惑-果-觉-寂"超脱（闻思→修慧→断惑→证果→罗汉→菩萨→佛陀→如来→涅槃）；墨家侧重"机-阵-衡-衍"演算（观微→构型→成阵→破虚→逆理→执衡→归一→太衍→无枢）。系统提示必须去UI化，转化为荒诞幽默的具象反馈。掠夺能力需完成系统指派任务后获得资格，每位面限用一次，无冷却/反噬代价。能力功能完整，受主世界修为天花板自然压制，严禁用时间限制或残废化描述弱化。积分四大用途：1.主世界境界提升；2.功法等级升级；3.系统商城购买；4.已历次位面道具购买。文风必须接地气，用大白话讲故事，不要文青病，不要堆砌华丽辞藻，环境描写最多2句带过。每章至少3处笑点，喜剧占比不低于30%。节奏要快，3章出金手指，10章完成第一次打脸/突破。',
        wordCountExpand: [
            '用对话和动作推进剧情，不要大段旁白描写',
            '补充主角内心吐槽和冷面反应，增加喜剧效果',
            '描写能力使用时的荒诞感和规则错位，不要正经八百地解说',
            '增加配角对主角行为的误解和反应，制造错位幽默'
        ]
    },

    constraintPresets: {
        'grounded-style': { label: '接地气白话文风', desc: '严禁文青病：不要堆砌华丽辞藻、空洞修辞、诗意描写。用大白话讲故事，像跟朋友聊天一样自然。环境描写最多2句带过，把笔墨留给动作、对话、吐槽。' },
        'fast-pace': { label: '快节奏硬约束', desc: '3章内必须出金手指并完成首次使用；10章内必须完成第一次打脸/突破/逆袭；每章必须有明确的剧情推进；禁止连续2段纯环境描写或纯心理活动。' },
        'comedy-mandatory': { label: '喜剧占比硬指标', desc: '每章至少3处让人笑出来的点，喜剧元素占比不低于30%。幽默来源：主角吐槽、系统荒诞、位面错位、配角误解。' },
        'anti-ai-trace': { label: '反AI写作痕迹（题材增强）', desc: '基底已含反AI红线，本题材增强：白描+心理反差+节奏留白，杜绝"仿佛/似乎/不禁"高频堆砌与"镜头缓缓拉近"影视化套话' },
        'physical-secret': { label: '肉身穿越绝对保密', desc: '仅男主知晓自身为肉身降临，主位面他人皆为魂穿或仅通过秘法/分身/偶然机缘知晓片段。无次位面监管机构，非烂大街副本机制。' },
        'system-anti-cliché': { label: '反套路系统逻辑', desc: '积分四大用途：境界提升/功法升级/系统商城/已历次位面道具购买；能力掠夺需完成系统任务后获得资格；道具通过次位面获取或交易获得，不是掠夺。能力与道具功能完整，受主世界修为天花板自然压制，严禁用时间限制或残废化描述弱化。' },
        'power-stacking-limit': { label: '战力堆叠硬阈值', desc: '次位面能力/道具仅可提升3-9个小等级，禁止直接跨越一个大境界对战；若差距仅差三个小等级，允许跨大境界硬撼但需符合战术逻辑与肉身极限。' },
        'main-plane-depth': { label: '主位面人物立体刻画', desc: '主位面角色必须拥有完整行为动机、性格弧光与社交网络，禁止工具人化或为剧情强行降智。' },
        'meme-quality-control': { label: '优质抽象梗过滤', desc: '幽默需高级错位感（如卸载QQ式），严禁低质烂梗（就这/绝了/栓Q等），必须贴合语境且具喜剧张力。' },
        'naming-elegance': { label: '古典命名规范（题材增强）', desc: '基底已含命名底线红线，本题材增强：命名必须古典雅致有意境，禁用龙傲天/叶辰/柳如烟等大众网文烂梗，违规则硬拦截。' }
    },

    materialTemplates: {
        character: {
            requiredFields: ['身份', '性格', '微表情习惯', '立场逻辑', '与沈渡关系', '禁忌'],
            template: '【身份】[学派+境界+职位]\n【字号】[可选，古典雅致]\n【性格】[核心特质+行为模式]\n【微表情习惯】[具体动作描写]\n【立场逻辑】[利益驱动+行为底线]\n【与沈渡关系】[具体关系+动态变化]\n【禁忌】[禁止脸谱化/工具人化/烂梗命名]',
            namingRules: {
                allowedSurnames: ['沈', '苏', '陆', '顾', '韩', '裴', '温', '谢', '萧', '楚', '秦', '宋', '叶', '白', '纪', '容', '晏', '卫', '霍', '戚'],
                namingStyle: '先秦两汉古姓+典籍意象/自然雅称（如渡、挽青、衡霜、缄言、肃规）',
                forbiddenNames: ['龙傲天', '叶辰', '柳如烟', '萧炎', '林动', '楚轩', '白无垢', '裴惊鸿'],
                forbiddenPatterns: [/(傲天|如烟|无垢|惊鸿)/]
            }
        },
        'sub-plane': {
            requiredFields: ['类型', '核心规则', '位面人物', '势力关系', '剧情线', '掠夺能力', '触发条件', '可获取道具', '视觉特征', 'IP校验'],
            template: '【类型】规则怪谈类/抽象概念类/文明类/动漫类\n【核心规则】[位面底层逻辑与运行法则]\n【位面人物】[人物名]（身份/性格/能力/与主角关系/出场方式）+ [CANON-VERIFIED标注（IP角色必填）]\n【势力关系】[位面内势力划分/利益冲突/与主角的立场关系]\n【剧情线】[位面主线事件/系统任务/关键转折/与主世界剧情的衔接点]\n【掠夺能力】[能力名]+[功能描述]+[主世界修为压制规则]\n【触发条件】系统任务完成后获得掠夺资格\n【可获取道具】[道具名]（获取方式：探索遗迹/击败守护者/完成任务奖励/与人交易）+[功能描述]+[主世界修为压制规则]\n【视觉特征】[位面异变的环境描写]\n【IP校验】知名IP角色需标注[CANON-VERIFIED]+战力受主世界修为天花板压制',
            namingRules: {
                style: '四字雅称或古典意境名（如沉默之域、锈蚀王庭、青青草原、铁臂穹城）',
                forbiddenPatterns: [/(位面之[战塔城]|副本[大厅中心])/]
            },
            typeSystem: {
                categories: {
                    '规则怪谈类': { label: '规则怪谈类', desc: '以诡异规则为核心的恐怖解谜世界', examples: ['沉默之域', '诡辩迷局', '禁忌书阁'] },
                    '抽象概念类': { label: '抽象概念类', desc: '以经典动画/概念为骨架的荒诞世界', examples: ['青青草原', '任意口袋', '追逐永恒'] },
                    '文明类': { label: '文明类', desc: '以完整文明体系为背景的异世界', examples: ['铁臂穹城(高等科技)', '霓虹废墟(末日赛博)', '元素潮汐(魔法世界)', '黄沙秘典(古埃及)', '洪荒遗脉(史前文明)'] },
                    '动漫类': { label: '动漫类', desc: '以知名动漫为蓝本的战斗世界', examples: ['龙珠擂台', '伟大航路', '猎人试炼', '光之降临'] }
                },
                unlockRules: {
                    chaptersPerUnlock: 30,
                    order: 'random',
                    description: '次位面逐步解封，平均每30章推进解锁一个新位面。解锁顺序随机。当所有已创建位面素材用完后，根据已用位面类型分布推断下一个位面应属的类型，再补充新的。'
                }
            }
        },
        faction: {
            requiredFields: ['所属位面', '势力名', '定位', '势力关系'],
            template: '【所属位面】[位面名]\n【势力名】[势力名]\n【定位】[势力在位面中的角色]\n【势力关系】[与其他势力的关系]\n【成员】[成员列表]',
            namingRules: {
                style: '位面内势力名（如缄默守卫、齿轮王廷、草帽海贼团）'
            }
        },
        institution: {
            requiredFields: ['定位', '特色', '内部结构', '与五家关系'],
            template: '【定位】[域内地位+学派归属]\n【特色】[核心特征+行事风格]\n【内部结构】[层级划分]\n【与五家关系】[政治地位+义务]',
            namingRules: {
                style: '古典雅致（如渊渟阁、霜序台、律鉴司）',
                forbiddenNames: ['合欢宗', '天机阁', '万宝楼'],
                forbiddenPatterns: [/(合欢|天机|万宝|仙门|神宗)/]
            }
        },
        'power-system': {
            requiredFields: ['规则描述', '限制条件', '系统内化表达'],
            template: '【规则描述】[核心机制]\n【限制条件】[硬性约束]\n【系统内化表达】[高武意境化替换方案]',
            namingRules: {
                style: '9×9雅致框架词汇',
                forbiddenTerms: ['练气', '筑基', '金丹', '元婴', '化神', '渡劫', '凝元']
            }
        }
    },

    newContentValidation: {
        onMaterialCreate(material, existingMaterials) {
            const errors = [];
            const warnings = [];
            const type = material.type;
            const template = this.materialTemplates[type];
            if (!template) return { errors, warnings };

            if (template.requiredFields) {
                for (const field of template.requiredFields) {
                    if (!(material.currentContent || material.initialContent || '').includes(field)) {
                        warnings.push(`素材缺少必填字段：${field}`);
                    }
                }
            }

            if (template.namingRules) {
                const content = material.name + (material.currentContent || material.initialContent || '');
                if (template.namingRules.forbiddenNames) {
                    for (const fn of template.namingRules.forbiddenNames) {
                        if (content.includes(fn)) {
                            errors.push(`命名违规：检测到禁用名"${fn}"，必须替换为古典雅致命名`);
                        }
                    }
                }
                if (template.namingRules.forbiddenPatterns) {
                    for (const pat of template.namingRules.forbiddenPatterns) {
                        if (pat.test(content)) {
                            errors.push(`命名违规：检测到禁用命名模式"${pat.source}"，必须替换`);
                        }
                    }
                }
                if (template.namingRules.forbiddenTerms) {
                    for (const ft of template.namingRules.forbiddenTerms) {
                        if (content.includes(ft)) {
                            errors.push(`术语违规：检测到禁用术语"${ft}"，必须替换为9×9雅致框架词汇`);
                        }
                    }
                }
            }

            return { errors, warnings };
        },
        onChapterContent(content) {
            const errors = [];
            const charTemplate = this.materialTemplates.character;
            if (charTemplate?.namingRules?.forbiddenNames) {
                for (const fn of charTemplate.namingRules.forbiddenNames) {
                    if (content.includes(fn)) {
                        errors.push(`章节内容包含禁用名"${fn}"`);
                    }
                }
            }
            if (charTemplate?.namingRules?.forbiddenPatterns) {
                for (const pat of charTemplate.namingRules.forbiddenPatterns) {
                    if (pat.test(content)) {
                        errors.push(`章节内容包含禁用命名模式"${pat.source}"`);
                    }
                }
            }
            const instTemplate = this.materialTemplates.institution;
            if (instTemplate?.namingRules?.forbiddenNames) {
                for (const fn of instTemplate.namingRules.forbiddenNames) {
                    if (content.includes(fn)) {
                        errors.push(`章节内容包含禁用势力名"${fn}"`);
                    }
                }
            }
            return { errors, warnings: [] };
        }
    },

    dedupRules: [
        { id: 'dedup-power-terms', pattern: /(练气|筑基|金丹|元婴|化神|凝元|结丹|开光|大乘|分神|合体|出窍)/g, keep: 'first' },
        { id: 'dedup-system-ui', pattern: /(系统提示|积分\s*[:：]?\d+|进度条|面板显示|UI界面)/gi, keep: 'first' },
        { id: 'dedup-ai-traces', pattern: /(仿佛|似乎|不禁)\s+(他|主角)\s+(发现|感慨|觉得|意识到)/g, keep: 'first' },
        { id: 'dedup-cringe-memes', pattern: /(就这|绝了|栓Q|YYDS|破防)/g, keep: 'first' },
        { id: 'dedup-cliche-names', pattern: /(龙傲天|叶辰|柳如烟|萧炎|林动|楚轩)/gi, keep: 'first' },
        { id: 'dedup-redundant-phrasing', pattern: /(突然|猛然|瞬间)\s+是\s+(他|主角)\s+发现/gi, keep: 'first' },
        { id: 'dedup-literary-bloat', pattern: /(宛如|恍若|犹似|恰似|犹如).{0,20}(般|一样|似的|一般)/g, keep: 'first' }
    ],

    reviewRules: {
        firstReview: {
            perspectiveRule: '核查视角是否紧贴男主感知范围。严禁描写未明确关联的次位面势力动向或跨位面实时交互。次位面信息差必须保持，仅男主知晓肉身降临。注意区分"能力名称直述"与"能力效果演绎"：如果正文通过感官体验、身体反应、环境变化来展现能力效果，即使提到能力名称也不算"直白告知"。',
            terminologyRule: '主位面战力名称必须匹配"9大等级×9小等级"雅致命名框架，严禁练气/筑基/金丹等烂大街词汇。系统提示必须去UI化、去数值化。能力功能完整，受主世界修为天花板自然压制，严禁用时间限制或残废化描述弱化。',
            outputRule: '报告需明确标注：1. 卷节奏是否合规（当前处于卷的哪个阶段，是否偏离5-10主线+20-25次位面+5回响节奏）；2. 爽感节奏（距上一个爽感点几章了，是否该来一个了，爽感类型是否轮换）；3. 喜剧元素是否达标（每章至少3处笑点）；4. 文风是否接地气（有无文青病）；5. 视角越界段落；6. 战力命名违规清单；7. 系统提示是否内化；8. 主位面人物刻画是否立体；9. 配角戏份是否偶尔出现（每5-8章1-2章即可，不用每章都有）；10. 情感线是否有推进（友情/师徒/暧昧）；11. 金手指是否平衡（压制下见真章，不OP也不废）；12. 段落节奏。重要：卷节奏违规和爽感缺失是硬伤，必须判❌；喜剧缺失和文青病是硬伤，必须判❌。配角连续8章无戏份给⚠️建议。'
        },
        secondReview: {
            perspectiveRule: '复核初审视角判定是否过度收紧。允许男主通过话术周旋间接感知次位面信息。如果初审把"能力名称出现"误判为"直白告知"，必须翻案。',
            terminologyRule: '重点校正初审对"弱化掠夺"与"反噬冷却"的误判。注意区分"残废化弱化"和"修为天花板压制"：前者是"仅限手指关节""3秒"等限制，后者是"对同境者效果完整，每高一个大境界效果减半"，后者是合规的。',
            correctionRule: '防止矫枉过正。复审的核心职责是纠偏初审，不是重复初审的判断。如果初审的判断有误，复审必须翻案。同时检查：1.卷节奏是否合规；2.爽感节奏是否达标（每2-3章一个，类型轮换）；3.喜剧是否达标；4.文风是否接地气；5.配角戏份是否偶尔出现（不用每章都有）；6.金手指是否平衡（压制下见真章）。这六项如果初审没检查到，复审必须补检。'
        },
        reviser: {
            terminologyDimmingRule: '将违规的数值面板、UI提示、烂大街战力词替换为高武意境表达。注意：返修时不要把正文改得面目全非，只修改审核指出的具体问题。',
            perspectiveRule: '修正视角跳跃：移除所有脱离男主感知的外部势力实时描写。注意：男主内心独白中提到能力名称或系统机制是合规的。',
            repairRules: '1. 拆分超长段落：对话独立成段，动作/心理/环境分段，每段不超过150字；2. 增加吐槽和笑点：如果正文太正经，在合适位置插入主角内心吐槽；3. 删减华丽辞藻：把文青病描写改成大白话；4. 加快节奏：删掉不必要的环境铺陈，直接推进剧情；5. 补充掠夺能力后的技能融合与道具适配的战术推演过程；6. 如果配角太久没戏份（超过8章），在合适位置插入配角互动；7. 如果爽感不足，在合适位置增加爽感元素（打脸/智斗/反差/认可/暧昧/情感共鸣），爽感不一定非得战力碾压；8. 爽感类型要轮换，不要连续都是战力爽。重要：返修时优先处理hardBlock问题。'
        },
        finalEditor: {
            perspectiveRule: '定稿底线：1.节奏必须快，不能磨叽；2.喜剧必须到位，不能太正经；3.文风必须接地气，不能文青病；4.战力体系必须保持绝对压制感；5.爽感节奏必须达标，不能连续吃瘪。数值崩坏、跨位面势力直接混战或机械降神式救援，一律标记为hardBlock并拒绝定稿。注意：定稿人的职责是润色，不是重新审核。如果初审和复审都已通过，定稿人不应再提出新的审核问题。'
        }
    },

    detectors: {
        perspective(content, styleProfile) {
            const violationPatterns = [
                /次位面\s+势力\s+正在\s+(进攻|集结|布阵)/g,
                /系统\s+后台\s+显示/gi,
                /全知视角\s+解说\s+规则来源/g
            ];
            let issues = [];
            for (const p of violationPatterns) {
                const matches = content.match(p);
                if (matches) issues.push({ type: 'perspective', text: matches[0] });
            }
            return { isViolation: issues.length > 0, issues, hasCriticalIssue: true };
        },
        terminology(content, styleProfile) {
            const clichéPowerTerms = /(练气|筑基|金丹|元婴|化神|凝元|结丹|开光|大乘|分神|合体|出窍)/g;
            const uiSystemTerms = /(积分\s*[:：]?\d+|进度条|面板显示|系统提示)/gi;
            let count = 0, instances = [], violationCount = 0;
            const powerMatches = content.match(clichéPowerTerms);
            if (powerMatches) { count += powerMatches.length; instances.push(...powerMatches.map(t => ({ type: 'power', text: t }))); violationCount++; }
            const uiMatches = content.match(uiSystemTerms);
            if (uiMatches) { count += uiMatches.length; instances.push(...uiMatches.map(t => ({ type: 'system_ui', text: t }))); violationCount++; }
            return { count, instances, violationCount };
        },
        modernSlang(content, styleProfile) {
            const slangPattern = /(我他妈|卧槽|牛逼|绝了|就这|栓Q)/g;
            const matches = content.match(slangPattern);
            return { count: matches ? matches.length : 0, instances: matches || [] };
        },
        aiTraceDetection(content) {
            const tracePatterns = [/(仿佛|似乎|不禁)\s+(他|主角)\s+(发现|感慨|觉得|意识到)/g, /(镜头\s+缓缓\s+拉近|推远|切换)/g, /(?:又|再|还)\s+是\s+(他|主角)\s+的(?:思考|内心)/g];
            let issues = [];
            for (const p of tracePatterns) {
                const matches = content.match(p);
                if (matches) issues.push(...matches.slice(0, 3).map(t => ({ type: 'ai_trace', text: t })));
            }
            return { isViolation: issues.length > 2, issues, hasCriticalIssue: true };
        },
        powerScalingCheck(content) {
            const scalingPatterns = [/(直接\s+跨越\s+一\s+个\s+大境界)/g, /(提升\s+(超过|大于)\s+[0-9]+\s+个小等级)/g, /(堆叠\s+后\s+战力\s+暴涨\s+至\s+跨阶)/g];
            let found = false;
            for (const p of scalingPatterns) { if (p.test(content)) { found = true; break; } }
            return { isViolation: found };
        },
        namingElegance(content) {
            const clichéNames = /(龙傲天|叶辰|柳如烟|萧炎|林动|楚轩)/g;
            const matches = content.match(clichéNames);
            return { isViolation: !!matches, issues: matches ? matches.map(n => ({ type: 'naming', text: n })) : [] };
        },
        timeLimitWeakening(content) {
            const timePatterns = /(?:仅能|只能|仅可|仅限).{0,20}(\d+)\s*(秒|分钟|时辰)/g;
            const cripplePatterns = /(?:仅限|只能).{0,10}(手指关节|指尖大小|巴掌大小|指甲盖)/g;
            const matches = [];
            let m;
            while ((m = timePatterns.exec(content)) !== null) {
                matches.push({ type: 'time-limit-ability', text: m[0] });
            }
            while ((m = cripplePatterns.exec(content)) !== null) {
                matches.push({ type: 'crippled-ability', text: m[0] });
            }
            return { isViolation: matches.length > 0, issues: matches };
        },
        paragraphLength(content) {
            const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
            const longParas = paragraphs.filter(p => p.length > 200);
            const veryLongParas = paragraphs.filter(p => p.length > 300);
            return {
                isViolation: longParas.length > paragraphs.length * 0.3,
                totalParagraphs: paragraphs.length,
                longParagraphs: longParas.length,
                veryLongParagraphs: veryLongParas.length,
                issues: veryLongParas.slice(0, 3).map(p => ({ type: 'long-paragraph', text: p.substring(0, 60) + '...', length: p.length }))
            };
        },
        literaryBloat(content) {
            const bloatPatterns = [
                /(宛如|恍若|犹似|恰似|犹如).{0,20}(般|一样|似的|一般)/g,
                /(?:那|这).{0,5}(一抹|一缕|一丝|一道).{0,15}(划过|掠过|浮上|涌上)/g,
                /(?:空气|氛围|气息).{0,10}(凝固|凝滞|沉寂|静谧)/g
            ];
            let count = 0;
            for (const p of bloatPatterns) {
                const m = content.match(p);
                if (m) count += m.length;
            }
            return { isViolation: count > 3, count, issues: count > 3 ? ['文青病描写过多，需删减华丽辞藻改用大白话'] : [] };
        },
        comedyCheck(content) {
            const comedyPatterns = [
                /吐槽|内心OS|冷面|翻白眼|嘴角抽搐|无语|扶额|叹气|嘀咕/g,
                /系统.{0,20}(荒诞|离谱|离大谱|什么鬼|离奇)/g,
                /沈渡.{0,15}(吐槽|无语|翻白眼|嘴角抽|扶额)/g
            ];
            let count = 0;
            for (const p of comedyPatterns) {
                const m = content.match(p);
                if (m) count += m.length;
            }
            return { comedyCount: count, isInsufficient: count < 3, required: 3 };
        },
        paceCheck(content) {
            const envOnly = content.match(/(?:.{0,5}(雾气|云层|山峦|溪流|竹林|石阶|殿堂|廊道).{0,30}[。！？]\s*){3,}/g);
            const psychOnly = content.match(/(?:.{0,5}(心中|暗想|思忖|盘算|犹豫|纠结).{0,30}[。！？]\s*){3,}/g);
            return {
                isSlow: !!(envOnly || psychOnly),
                envBlock: envOnly ? envOnly.length : 0,
                psychBlock: psychOnly ? psychOnly.length : 0
            };
        },
        ipDirectNaming(content) {
            const ipNames = /(路飞|孙悟空|哆啦A梦|鸣人|佐助|七龙珠|海贼王|奥特曼|恶魔果实|仙豆|竹蜻蜓|念能力|龟派气功|元气弹|螺旋丸|写轮眼|草帽|铁臂阿童木|柯南|毛利兰|灰太狼|喜羊羊|美羊羊|懒羊羊|光头强|熊大|熊二)/g;
            const matches = [];
            let m;
            while ((m = ipNames.exec(content)) !== null) {
                matches.push({ type: 'ip-direct-name', text: m[0] });
            }
            return { isViolation: matches.length > 0, count: matches.length, issues: matches };
        },
        scoreStyleTime(content) {
            const scorePatterns = /(?:0\.[0-9]+\s*(秒|分钟|毫秒)|仅\s*[0-9]+\s*(秒|分钟|毫秒)\s*[内里])/g;
            const matches = [];
            let m;
            while ((m = scorePatterns.exec(content)) !== null) {
                matches.push({ type: 'score-style-time', text: m[0] });
            }
            return { isViolation: matches.length > 2, count: matches.length, issues: matches };
        },
        toolCharacterDetection(content) {
            if (!content) return { isViolation: false, issues: [] };
            const issues = [];
            const toolPhrases = [
                /(?:果然如此|您说得对|属下明白|主人英明|少爷英明|是，?大人|遵命|诺)/g,
                /(?:[^。！？]{0,10}(点了点头|应了一声|没有异议|表示赞同)[^。！？]{0,10})/g
            ];
            let toolCount = 0;
            for (const p of toolPhrases) {
                const m = content.match(p);
                if (m) toolCount += m.length;
            }
            const dialogueLines = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];
            const shortAgree = dialogueLines.filter(d => d.length < 12 && /^(果然|是的|好的|明白|遵命|诺|是)/.test(d.slice(1)));
            if (toolCount > 5 || shortAgree.length > 3) {
                issues.push(`检测到${toolCount}处工具性台词+${shortAgree.length}处短同意对话，配角可能被工具人化`);
            }
            const namedChars = content.match(/(?:苏挽青|陆衡霜|顾缄言|温如璧|回声|鸣刃|余韵)/g) || [];
            const charSet = new Set(namedChars);
            let hasIndependentAction = 0;
            for (const ch of charSet) {
                const charPattern = new RegExp(`${ch}[^。]{0,50}(自己|独自|暗中|偷偷|犹豫|质疑|反对|拒绝|犹豫|动摇)`, 'g');
                if (charPattern.test(content)) hasIndependentAction++;
            }
            if (charSet.size > 0 && hasIndependentAction === 0 && content.length > 1000) {
                issues.push('出场配角无独立行动/判断/质疑，可能被工具人化');
            }
           return { isViolation: issues.length > 0, issues, toolPhraseCount: toolCount, shortAgreeCount: shortAgree.length };
        }
    },

    interceptors: {
        firstReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];

            const literaryCheck = this.detectors.literaryBloat(content);
            if (literaryCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `文青病超标：检测到${literaryCheck.count}处华丽辞藻堆砌。必须删减，改用大白话讲故事。环境描写最多2句带过，把笔墨留给动作、对话、吐槽。`, title: '文青病' });
            }

            const comedyCheck = this.detectors.comedyCheck(content);
            if (comedyCheck.isInsufficient) {
                hardBlockIssues.push({ severity: 'high', description: `喜剧元素不足：仅检测到${comedyCheck.comedyCount}处笑点，要求至少${comedyCheck.required}处。本书核心卖点是搞笑，正文太正经就名不副实。增加主角吐槽、系统荒诞感、位面错位幽默。`, title: '喜剧缺失' });
            }

            const paceCheck = this.detectors.paceCheck(content);
            if (paceCheck.isSlow) {
                hardBlockIssues.push({ severity: 'high', description: `节奏太慢：检测到大段纯环境描写或纯心理活动。必须删减铺陈，用对话和动作推进剧情。禁止连续2段纯描写。`, title: '节奏拖沓' });
            }

            const termCheck = this.detectors.terminology(content, styleProfile);
            if (termCheck.violationCount > 0 && termCheck.count > 3) {
                hardBlockIssues.push({ severity: 'critical', description: `检测到${termCheck.count}处战力命名烂大街或系统UI元数据泄露，违反铁律三。`, title: '体系污染' });
            }

            const perspectiveCheck = this.detectors.perspective(content, styleProfile);
            if (perspectiveCheck.isViolation) {
                hardBlockIssues.push({ severity: 'high', description: '视角越界描写次位面势力或系统后台，违反铁律二。', title: '视角崩坏' });
            }

            const aiTrace = this.detectors.aiTraceDetection(content);
            if (aiTrace.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: '检测到高频AI写作痕迹（机械过渡词/空洞比喻/重复句式），违反反套路与喜剧基调要求。', title: 'AI腔调超标' });
            }

            const slangCheck = this.detectors.modernSlang(content, styleProfile);
            if (slangCheck.count > 2) {
                warningIssues.push({ severity: 'high', description: '低质网络烂梗使用过多，破坏喜剧质感。', title: '梗质量低劣' });
            }

            const nameCheck = this.detectors.namingElegance(content);
            if (nameCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `检测到网文烂梗命名（${nameCheck.issues.map(i=>i.text).join(', ')}），违反古典雅致规范。`, title: '命名违规' });
            }

            const scalingCheck = this.detectors.powerScalingCheck(content);
            if (scalingCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: '检测到直接跨越大境界或堆叠战力超限，违反铁律一。', title: '战力崩坏' });
            }

            const timeLimitCheck = this.detectors.timeLimitWeakening(content);
            if (timeLimitCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `弱化版能力使用了时间限制或残废化描述，违反铁律三。能力功能完整，弱化应通过主世界修为天花板自然压制体现。`, title: '弱化方式违规' });
            }

            const paraCheck = this.detectors.paragraphLength(content);
            if (paraCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `段落过长影响阅读体验：${paraCheck.totalParagraphs}段中有${paraCheck.longParagraphs}段超200字。必须拆分：对话独立成段，每段不超过150字。`, title: '段落节奏违规' });
            }

            const ipCheck = this.detectors.ipDirectNaming(content);
            if (ipCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `IP角色/道具直呼其名（${ipCheck.issues.map(i=>i.text).join(', ')}），违反铁律四点五。必须用外貌特征+性格代号替代。`, title: 'IP直呼违规' });
            }

            const scoreTimeCheck = this.detectors.scoreStyleTime(content);
            if (scoreTimeCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `评分式时间描述过多（${scoreTimeCheck.count}处"0.X秒"），违反活人写作规范。用正常人时间感知替代。`, title: '评分式时间' });
            }

            const toolCharCheck = this.detectors.toolCharacterDetection(content);
            if (toolCharCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `配角可能被工具人化：${toolCharCheck.issues.join('；')}。每个出场配角至少展现1个独立特质（个人目标/判断/质疑/微表情）。`, title: '配角工具人化' });
            }

            hints.push('确保每章至少3处笑点');
            hints.push('用大白话讲故事，不要文青病');
            hints.push('节奏要快，不要大段描写铺陈');
            return { hardBlockIssues, warningIssues, hints };
        },
        secondReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];

            if (content.includes('系统提示') || content.match(/积分[:：]\d+/)) {
                hardBlockIssues.push({ severity: 'critical', description: '系统提示未内化为高武意境表达，违反铁律三。', title: '元数据泄露' });
            }

            const literaryCheck = this.detectors.literaryBloat(content);
            if (literaryCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: '仍存在文青病描写，建议进一步删减华丽辞藻。', title: '文风偏文青' });
            }

            const comedyCheck = this.detectors.comedyCheck(content);
            if (comedyCheck.isInsufficient) {
                warningIssues.push({ severity: 'high', description: `喜剧元素仍不足（${comedyCheck.comedyCount}/${comedyCheck.required}），建议增加吐槽和错位幽默。`, title: '喜剧偏弱' });
            }

            const powerCheck = this.detectors.terminology(content, styleProfile);
            if (powerCheck.violationCount > 0) {
                warningIssues.push({ severity: 'medium', description: '战力命名未严格遵循9×9雅致框架，建议替换。', title: '命名雅化不足' });
            }

            const aiTrace = this.detectors.aiTraceDetection(content);
            if (aiTrace.isViolation) {
                warningIssues.push({ severity: 'medium', description: '存在机械过渡词或影视化套话，建议改为白描笔法。', title: '文风AI化' });
            }

            const ipCheck = this.detectors.ipDirectNaming(content);
            if (ipCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `IP角色/道具直呼其名（${ipCheck.issues.map(i=>i.text).join(', ')}），违反铁律四点五。`, title: 'IP直呼违规' });
            }

            hints.push('复核节奏是否够快、喜剧是否达标、文风是否接地气');
            return { hardBlockIssues, warningIssues, hints };
        }
    }
};
