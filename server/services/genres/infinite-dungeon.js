const _self = {
    id: 'infinite-dungeon',
    label: '无限流副本博弈',
    patterns: ['无限流', '副本博弈', '阈限剧场', 'infinite-battle-royale', 'infinite-dungeon', '认知投影', '副本机制'],

    perspectiveSchema: {
        fields: '"perspective":"protagonist/narrator/other"',
        label: '视角：protagonist/narrator/other',
        values: ['protagonist', 'narrator', 'other']
    },

    isMatch(styleProfile) {
        const text = [styleProfile?.key, styleProfile?.label, styleProfile?.description].filter(Boolean).join(' ');
        return this.patterns.some(p => text.includes(p));
    },

    foundation: {
        additionalConstraints: [
            { id: 'dungeon-mechanics-pacing', label: '副本机制节奏', desc: '每章必须包含至少1项机制揭示/规则冲突/资源争夺事件。前800字内必须触发生存危机或规则冲突。破局方案必须有≥1条前置线索支撑，禁止无铺垫秒杀/强行开挂' },
            { id: 'pov-lock-dungeon', label: '视角锁定', desc: '严格有限视角（主角或单一人物）。禁止上帝视角解说副本底层逻辑；所有规则揭示必须通过试错/交互/线索拼凑自然呈现' },
            { id: 'no-deus-ex-machina', label: '反机械降神', desc: '禁止"系统提示音自动解答""主角突然灵光一闪"等机械降神表述。破局方案需有前置铺垫（至少1章线索埋设）' },
            { id: 'trust-contract-rule', label: '信任契约规则', desc: '信任契约签订需明确"互补规则"与"违约代价"；背叛行为必须触发1项负面后果（感知干扰/资源扣减/规则反噬）' },
            { id: 'naming-convention-dungeon', label: '命名规范（题材增强）', desc: '基底已含命名底线红线，本题材增强：采用"意象+功能/反差"结构（如白瓷/槐姐/算盘/钉叔/折纸），禁用AI高频名。全项目命名字典去重' },
            { id: 'rule-density-control', label: '规则密度控制', desc: '禁止连续2章使用相同副本机制类型（防重复疲劳）。禁止在单章内引入超过3个全新核心规则（防信息过载）' },
            { id: 'mechanic-visualization', label: '机制具象化', desc: '所有抽象概念必须绑定1个可交互道具或进度指示器。机制呈现方式由项目素材定义（如千局→筹码/千术等级，副本→权限终端/理智锚点）。每次使用需标注代价/效果/限制' },
            { id: 'protagonist-proactivity', label: '主角能动性', desc: '主角必须主动博弈/反制/有可见成长反馈。每次破局必须伴随：①代价结算 ②资源/权限掉落 ③规则漏洞反制。禁止纯被动支付代价无收益' },
            { id: 'cliffhanger-enforcement', label: '断章钩子强化', desc: '章末必须留有强制选择/信息差反转/代价预告/威胁逼近。禁止纯氛围渲染结尾。断章类型：trust_break/resource_critical/forced_choice/info_reversal/threat_approach' },
            { id: 'pacing-micro-loop', label: '单章微循环节奏', desc: '采用"规划→执行→危机→结算/断章"微循环。环境描写≤20%，改为"动作+规则反馈"驱动。心理描写必须由动作/环境反馈触发，禁止独立心理段落' },
            { id: 'ip-defense-dungeon', label: 'IP风险防御（题材增强）', desc: '基底已含IP防御红线，本题材增强：动漫类/影视类副本中IP角色禁止直呼其名，只能描述外貌特征+性格代号+标志性能力。IP角色设定必须符合原著核心特征，不可魔改核心人设' },
            { id: 'anti-formulaic-dungeon', label: '反固定套路（题材增强）', desc: '基底已含反固定套路红线，本题材增强：禁止每章都是"进副本→发现规则→破局→断章"的固定四段式。副本进入方式要多样（被迫/主动/误入/被选），规则揭示节奏要有变化（快揭示慢推演/慢揭示快推演/碎片拼凑），破局手段要轮换（智斗/合作/牺牲/利用规则漏洞）。禁止评分式时间描述（"0.5秒""0.3秒"）' },
            { id: 'cross-dungeon-isolation', label: '跨副本隔离', desc: '每个副本的人物、势力、道具严格绑定该副本，禁止跨副本出现。副本A的NPC不能出现在副本B。副本间信息差必须保持。主角从副本带回的能力/道具受主世界修为天花板压制' },
            { id: 'power-ceiling-dungeon', label: '能力天花板压制', desc: '副本中获得的能力/道具带回主世界后受修为天花板自然压制。对同境者效果完整，每高一个大境界效果减半，跨两个大境界以上近乎无效。禁止时间限制/残废化弱化描述' }
        ],
        additionalFoundationRules: [
            '【无限流铁律·改造版】副本博弈题材：所有副本机制必须具备可解性（非纯随机/机械降神），推演痕迹必须可见（主角决策逻辑链完整）。视角严格锁定有限视角，禁止上帝视角解说底层逻辑。信任契约/背叛必须伴随明确代价结算。禁止连续2章相同机制类型，禁止单章超3个新规则。',
            '【番茄节奏铁律】前3章必须完成"危机→破局→能力亮相→强悬念断章"结构。首句3行内见生存危机。每章必须包含至少1次主动博弈/反制行为。章末断章必须为强制选择/信息差反转/代价预告，禁止纯氛围渲染结尾。',
            '【机制具象化铁律】所有抽象概念必须绑定可交互道具或进度指示器。机制呈现方式由项目素材定义（千局→筹码等级/千术熟练度，副本→权限终端/理智锚点等）。每次使用标注代价/效果/限制。主角成长可视化：根据项目设定呈现（筹码等级/千术进阶/认知权限/规则碎片进度等）。',
            '【跨副本隔离铁律】每个副本的人物、势力、道具严格绑定该副本，禁止跨副本出现。副本间信息差必须保持。主角从副本带回的能力/道具受主世界修为天花板自然压制，对同境者效果完整，每高一个大境界效果减半。禁止时间限制/残废化弱化描述。',
            '【IP风险防御铁律】动漫类/影视类副本中IP角色禁止直呼其名，只能描述外貌特征+性格代号+标志性能力。IP角色设定必须符合原著核心特征，不可魔改核心人设，需标注[CANON-VERIFIED]。',
            '【反固定套路铁律】禁止每章都是"进副本→发现规则→破局→断章"的固定四段式。副本进入方式要多样，规则揭示节奏要有变化，破局手段要轮换。禁止评分式时间描述（"0.5秒""0.3秒"），用正常人时间感知。'
        ],
        systemMechanismDimming: true,
        systemMechanismTarget: '主角可感知的规则提示/环境异常/机制线索/进度反馈'
    },

    incompatibleConstraints: ['baby-perspective-only', 'no-adult-inner-voice', 'cute-first-always', 'character-intro-whitelist', 'dialogue-authentic', 'comedy-mandatory', 'grounded-style', 'fast-pace', 'rule-concreteness', 'pov-lock-horror', 'rule-pace', 'character-intro-pacing'],
    requiredConstraints: ['dungeon-mechanics-pacing', 'pov-lock-dungeon', 'no-deus-ex-machina', 'cliffhanger-enforcement', 'hook-every-chapter'],

    styleProfile: {
        key: 'infinite-battle-royale',
        label: '无限流·副本博弈',
        povRule: '【视角铁律】严格有限视角（主角或单一人物）。禁止上帝视角解说副本底层逻辑；所有规则揭示必须通过试错/交互/线索拼凑自然呈现。心理描写占比不超过全文20%，必须由动作/环境反馈触发，禁止独立心理段落。',
        dialogueRule: '对话需体现立场差异与利益博弈。禁用AI式"问答推进剧情"；关键信息必须伴随潜台词、试探或代价声明。每人设出场需自带1个可识别的口头禅或语气特征。',
        behaviorRule: '角色行动必须受副本机制约束驱动。禁止无逻辑跳跃/强行降智；破局方案需有前置铺垫（至少1章线索埋设）。遇险反应必须符合角色认知模式+当前已知规则。主角必须主动博弈/反制，每次破局伴随：①代价结算 ②资源/权限掉落 ③规则漏洞反制。',
        toneRule: '冷峻、高压、带策略博弈感。幽默密度10-20%，以黑色幽默/反讽/冷面吐槽为主，不是爽文式搞笑。禁止过度煽情或说教。环境描写服务于机制提示与生存压力，不独立成段，占比≤20%。章末必须留有强制选择/信息差反转/代价预告，禁止纯氛围渲染结尾。',
        titleRule: '【章节标题命名规则】标题必须营造机制感/博弈感，禁止平淡叙述式命名。❌禁止："第X天""新规则"等直白命名。✅正确：用机制暗示+博弈意象命名，如"熄灯后的第三声敲门""走廊尽头的逻辑褶皱""别听它们唱"。',
        reviewFocus: '副本机制可解性|推演痕迹可见性|信任契约代价结算|AI味检测|规则密度控制|机制具象化|主角能动性|断章钩子强度|节奏微循环',
        materialFocus: { primary: ['character', 'worldview', 'foreshadowing', 'famous-scene'], secondary: ['relationship', 'catchphrase'], skip: ['equipment', 'power-system'] },
        constraintOverrides: ['dungeon-mechanics-pacing', 'pov-lock-dungeon', 'no-deus-ex-machina', 'trust-contract-rule', 'naming-convention-dungeon', 'rule-density-control', 'mechanic-visualization', 'protagonist-proactivity', 'cliffhanger-enforcement', 'pacing-micro-loop', 'hook-every-chapter', 'no-derailment', 'character-consistency', 'worldview-consistency'],
        characterRefRules: '【角色称呼规范】每段首次用全名，后续可用代词，换段/换场景后重新用全名。两个同性角色同场景禁连续用代词。命名禁用AI高频名（林晓/苏雨/陈默/顾言），采用"意象+功能/反差"结构（如白瓷/槐姐/算盘/钉叔/折纸）。'
    },

    genreBase: {
        BEHAVIOR_APPEND: '【副本机制驱动·改造版】角色行动必须受当前已知副本规则约束。违反规则必须有明确后果。规则冲突时角色必须表现出推演/试探/抉择，禁止无视规则继续行动。破局方案需有前置线索支撑。主角必须主动博弈/反制，每次破局伴随代价结算+权限掉落+规则反制。',
        REQUIRED_CONSTRAINT_OVERRIDES: ['dungeon-mechanics-pacing', 'naming-convention-dungeon', 'mechanic-visualization', 'protagonist-proactivity', 'cliffhanger-enforcement'],
        TONE_APPEND: '禁止过度煽情或说教，保持冷峻高压博弈基调。幽默密度10-20%，以黑色幽默/反讽/冷面吐槽为主，不是爽文式搞笑。环境描写≤20%，服务于机制提示与生存压力。章末必须为强制选择/信息差反转/代价预告断章。',
        REVIEW_APPEND: '|副本机制可解性检查|推演痕迹可见性检查|信任契约代价检查|规则密度检查|AI味检测|机制具象化检查|主角能动性检查|断章钩子强度检查|节奏微循环检查'
    },

    perspective: null,
    techJargon: { terms: [] },

    qualityChecks: {
        onomatopoeia: { enabled: false },
        visualAnchors: { enabled: false },
        motherChildDialogue: { enabled: false },
        modernSlangExtra: false,
        mechanicVisualization: { enabled: true },
        progressTracking: { enabled: true },
        trustContract: { enabled: true },
        cliffhangerType: { enabled: true }
    },

    dialectConfig: {
        defaultIntensity: 'medium',
        highTensionOverride: 'light',
        reviewCheck: true,
        rules: [
            '高紧张场景（生死关头/副本倒计时/规则冲突）降级为轻度方言',
            '角色内心独白可用轻度方言，对话场景用中/重度',
            '不同次位面的NPC可带不同地区方言，增强辨识度',
            '主角方言在主世界场景中更明显，在次位面中适度收敛'
        ]
    },

    writerHints: {
        terminologyDimming: `【规则呈现规范】副本规则必须通过场景/物品/对话具象化呈现，禁止"系统提示""面板弹出"等网游化表述。规则揭示伴随具体后果展示。破局方案必须有前置线索支撑，禁止灵光一闪。

【机制状态追踪·叙事融入规范】⚠️ 进度追踪必须融入叙事，禁止以独立UI面板/系统提示框形式出现。以下为叙事融入示例：

框架A（千局/千术类）——叙事融入式：
❌ 错误：[筹码] 一筹 | 千术：望气术·入门 | 代价标记：左手无名指旧伤隐痛
✅ 正确：铜筹在口袋里微微发烫，上面的"一筹"二字似乎比刚才更清晰了。主角活动了一下左手无名指，那道旧伤又在隐隐作痛——每次动用千术后的代价，从不缺席。
✅ 正确：他下意识摸了摸口袋里的铜筹。"一筹"两个字硌着指腹，像在提醒他：你才刚入门。

框架B（权限/理智类）——叙事融入式：
❌ 错误：[权限终端] 逻辑褶皱预览Lv.1已激活 | 认知碎片进度: 1/7 | 理智锚点: 82%
✅ 正确：直尺在掌心微微震动，表面浮现出一行极细的字迹："预览·一级"。他感觉脑中多了些什么，像是拼图缺了一角——七分之一，也许。理智还算清醒，但太阳穴突突地跳，像有什么东西在往下拽。

⚠️ 必须根据项目素材选择对应框架，禁止混用。禁止在正文中出现方括号标签如[筹码][权限终端][道具]等。

【机制具象化·叙事融入规范】所有抽象规则必须转为道具/物品状态，但必须融入叙事：
❌ 错误：[道具: 铜筹码] 限制: 仅千局内有效 | 代价: 使用后筹码升温 | 效果: 标记目标物位置
✅ 正确：铜筹码又烫了。每次动用它定位什么东西之后，这枚铜片就像被火烤过一样。主角知道，这东西只在千局里管用——出了那扇门，它就是一块废铜。

【合作约定·叙事融入规范】角色互动建立合作时必须明确条件与代价，但融入对话和行动：
❌ 错误：[合作约定] 纪棠(情报型) | 互补条件: 提供城寨情报 | 违约代价: 当铺信誉受损
✅ 正确："我给你城寨里的消息，"纪棠把当铺的招牌擦了擦，"你替我挡和义堂的人。要是你跑了——"她没说完，但当铺门口那块招牌上的裂纹，主角看得清清楚楚。

【断章钩子规范】每章结尾必须为二选一或紧迫威胁结构，但用叙事呈现：
❌ 错误：面临抉择：①从正门强闯(暴露身份) ②走暗巷绕路(时间不足)。九指强的脚步声越来越近。
✅ 正确：正门就在十步之外，但歪嘴明的人守在那里——出去就是暴露。暗巷在左边，窄得只容一人侧身通过，而九指强的脚步声已经从右边拐角传来。主角咬了咬牙。`,
        wordCountExpand: ['增加1-2段机制线索/环境异常细节描写', '扩展规则违反后果的感官呈现', '补充机制状态的叙事融入描写', '补充道具代价/效果的感官体验']
    },

    constraintPresets: {
        'dungeon-mechanics-pacing': { label: '副本机制节奏', desc: '每章必须包含至少1项机制揭示/规则冲突/资源争夺事件。前800字内必须触发生存危机或规则冲突。破局方案必须有≥1条前置线索支撑，禁止无铺垫秒杀/强行开挂' },
        'pov-lock-dungeon': { label: '视角锁定', desc: '严格有限视角（主角或单一人物）。禁止上帝视角解说副本底层逻辑；所有规则揭示必须通过试错/交互/线索拼凑自然呈现' },
        'no-deus-ex-machina': { label: '反机械降神', desc: '禁止"系统提示音自动解答""主角突然灵光一闪"等机械降神表述。破局方案需有前置铺垫（至少1章线索埋设）' },
        'trust-contract-rule': { label: '信任契约规则', desc: '信任契约签订需明确"互补规则"与"违约代价"；背叛行为必须触发1项负面后果（感知干扰/资源扣减/规则反噬）' },
        'naming-convention-dungeon': { label: '命名规范（题材增强）', desc: '基底已含命名底线红线，本题材增强：采用"意象+功能/反差"结构（如白瓷/槐姐/算盘/钉叔/折纸），禁用AI高频名。全项目命名字典去重' },
        'rule-density-control': { label: '规则密度控制', desc: '禁止连续2章使用相同副本机制类型（防重复疲劳）。禁止在单章内引入超过3个全新核心规则（防信息过载）' },
        'mechanic-visualization': { label: '机制具象化', desc: '所有抽象概念必须绑定1个可交互道具或进度指示器。机制呈现方式由项目素材定义（千局→筹码/千术，副本→权限终端/理智锚点）。每次使用需标注代价/效果/限制' },
        'protagonist-proactivity': { label: '主角能动性', desc: '主角必须主动博弈/反制/有可见成长反馈。每次破局必须伴随：①代价结算 ②资源/权限掉落 ③规则漏洞反制。禁止纯被动支付代价无收益' },
        'cliffhanger-enforcement': { label: '断章钩子强化', desc: '章末必须留有强制选择/信息差反转/代价预告。禁止纯氛围渲染结尾。断章类型：trust_break/resource_critical/forced_choice/info_reversal' },
        'pacing-micro-loop': { label: '单章微循环节奏', desc: '采用"规划→执行→危机→结算/断章"微循环。环境描写≤20%，改为"动作+规则反馈"驱动。心理描写必须由动作/环境反馈触发，禁止独立心理段落' },
        'ip-defense-dungeon': { label: 'IP风险防御（题材增强）', desc: '基底已含IP防御红线，本题材增强：动漫类/影视类副本中IP角色禁止直呼其名，只能描述外貌特征+性格代号+标志性能力' },
        'anti-formulaic-dungeon': { label: '反固定套路（题材增强）', desc: '基底已含反固定套路红线，本题材增强：禁止每章固定四段式，副本进入/规则揭示/破局手段要轮换，禁止评分式时间描述' },
        'cross-dungeon-isolation': { label: '跨副本隔离', desc: '每个副本的人物、势力、道具严格绑定该副本，禁止跨副本出现。副本间信息差必须保持' },
        'power-ceiling-dungeon': { label: '能力天花板压制', desc: '副本中获得的能力/道具带回主世界后受修为天花板自然压制，禁止时间限制/残废化弱化描述' }
    },

    materialTemplates: {
        character: {
            requiredFields: ['身份', '性格', '能力', '战力定位', '口头禅', '与主角关系'],
            template: '【身份】[副本内角色定位]\n【性格】[核心特质+行为模式]\n【能力】[副本内能力描述]\n【战力定位】[副本内战力等级]\n【口头禅】[1个可识别的语气特征]\n【与主角关系】[合作/对立/中立+动态变化]\n【禁忌】[禁止跨副本串台/禁止无脑跟随/禁止工具人化]',
            namingRules: {
                namingStyle: '"意象+功能/反差"结构（如白瓷/槐姐/算盘/钉叔/折纸）',
                forbiddenNames: ['龙傲天', '叶辰', '柳如烟', '林晓', '苏雨', '陈默', '顾言'],
                forbiddenPatterns: [/(傲天|如烟|惊鸿|无垢)/]
            }
        },
        faction: {
            requiredFields: ['所属副本', '势力定位', '势力关系', '成员'],
            template: '【所属副本】[副本名]\n【势力定位】[副本内角色]\n【势力关系】[与其他势力关系]\n【成员】[成员列表]\n【禁忌】禁止跨副本出现'
        },
        worldview: {
            requiredFields: ['副本类型', '核心规则', '视觉特征'],
            template: '【副本类型】规则怪谈类/抽象概念类/文明类/动漫类\n【核心规则】[副本底层逻辑与运行法则]\n【视觉特征】[副本异变的环境描写]\n【IP校验】知名IP角色需标注[CANON-VERIFIED]+战力受主世界修为天花板压制'
        },
        equipment: {
            requiredFields: ['名称', '获取方式', '功能', '代价', '主世界压制规则'],
            template: '【名称】[道具名]\n【获取方式】探索/击败守护者/完成任务/与人交易\n【功能】[功能描述]\n【代价】[使用代价]\n【主世界压制规则】对同境者效果完整，每高一个大境界效果减半'
        }
    },

    newContentValidation: {
        onMaterialCreate(material) {
            const errors = [];
            const warnings = [];
            if (material.type === 'character' || material.type === 'faction') {
                if (!material.parentPlane && material.type !== 'character') {
                    warnings.push('势力未指定所属副本(parentPlane)，可能导致跨副本串台');
                }
                if (material.type === 'character' && !material.parentFaction && !material.parentPlane) {
                    warnings.push('人物未指定归属势力或副本，可能导致跨副本串台');
                }
            }
            if (material.currentContent) {
                const ipNames = /(路飞|孙悟空|哆啦A梦|鸣人|佐助|七龙珠|海贼王|奥特曼|恶魔果实|仙豆|竹蜻蜓|念能力|龟派气功|螺旋丸|写轮眼|草帽|灰太狼|喜羊羊|柯南)/g;
                const ipMatches = material.currentContent.match(ipNames);
                if (ipMatches) {
                    errors.push(`IP角色/道具直呼其名（${[...new Set(ipMatches)].join(', ')}），必须用外貌特征+性格代号替代`);
                }
                const clichéNames = /(龙傲天|叶辰|柳如烟|林晓|苏雨|陈默|顾言)/g;
                const nameMatches = material.currentContent.match(clichéNames);
                if (nameMatches) {
                    errors.push(`命名违规（${[...new Set(nameMatches)].join(', ')}），必须替换为"意象+功能/反差"结构`);
                }
            }
            return { errors, warnings };
        },
        onChapterContent(content) {
            const errors = [];
            const warnings = [];
            const ipNames = /(路飞|孙悟空|哆啦A梦|鸣人|佐助|七龙珠|海贼王|奥特曼|恶魔果实|仙豆|竹蜻蜓|念能力|龟派气功|螺旋丸|写轮眼|草帽|灰太狼|喜羊羊|柯南)/g;
            const ipMatches = content.match(ipNames);
            if (ipMatches) {
                errors.push(`章节内容包含IP直呼（${[...new Set(ipMatches)].join(', ')}），违反IP风险防御铁律`);
            }
            const scoreTime = /(?:0\.[0-9]+\s*(秒|分钟|毫秒))/g;
            const scoreMatches = content.match(scoreTime);
            if (scoreMatches && scoreMatches.length > 2) {
                warnings.push(`评分式时间描述过多（${scoreMatches.length}处"0.X秒"），建议用正常人时间感知`);
            }
            return { errors, warnings };
        }
    },

    dedupRules: [
        { id: 'pov-lock-d', pattern: /【视角铁律[^】]*】[\s\S]*?自然呈现[^\n]*/g, keep: 'first' },
        { id: 'dungeon-pace', pattern: /副本机制节奏[：:][^\n]*/g, keep: 'first' },
        { id: 'no-deus', pattern: /反机械降神[：:][^\n]*/g, keep: 'first' },
        { id: 'trust-contract', pattern: /信任契约规则[：:][^\n]*/g, keep: 'first' },
        { id: 'naming-d', pattern: /命名规范[：:][^\n]*/g, keep: 'first' },
        { id: 'rule-density', pattern: /规则密度控制[：:][^\n]*/g, keep: 'first' },
        { id: 'dungeon-drive', pattern: /副本机制驱动[^】]*】[\s\S]*?继续行动[^\n]*/g, keep: 'first' },
        { id: 'tone-dungeon', pattern: /禁止过度煽情或说教[^\n]*/g, keep: 'first' },
        { id: 'rule-present-d', pattern: /规则呈现规范[^】]*】[\s\S]*?灵光一闪[^\n]*/g, keep: 'first' },
        { id: 'naming-rule-d', pattern: /【角色称呼规范[^】]*】[\s\S]*?折纸[^\n]*/g, keep: 'first' }
    ],

    reviewRules: {
        firstReview: {
            perspectiveRule: `【视角感知审核规则 - 无限流副本博弈·改造版】
判定视角违规时：
- 上帝视角解说副本底层逻辑=违规（critical），规则必须通过角色试错/交互/线索拼凑呈现
- 心理独白占比>20%=违规（high），推演过程必须通过行为与对话呈现
- 角色知晓不应知道的副本信息=违规（critical）
- "系统提示音自动解答""主角突然灵光一闪"=违规（critical），机械降神
- 独立心理段落（无动作/环境触发）=违规（medium）`,
            terminologyRule: `【副本机制可解性判定标准 - 改造版】
✅ 可解机制：规则有明确触发条件+违反后果+可推导的漏洞/破局路径
✅ 推演可见：主角决策逻辑链完整，每步推理有线索支撑
✅ 机制具象化：抽象概念绑定可交互道具或进度指示器，机制呈现方式必须与项目世界观素材一致，每次使用标注代价/效果/限制
❌ 不可解机制：纯随机/无逻辑的规则变化，无任何线索可推导
❌ 机械降神："系统提示""灵光一闪""突然领悟"等无铺垫破局
❌ 规则过载：单章引入超过3个全新核心规则
❌ 抽象规则未具象化：概念未绑定道具/进度指示器

【进度追踪检查·必须验证】
⚠️ 重要：进度追踪必须融入叙事，禁止以UI面板/系统提示框/方括号标签形式出现。
- 每次机制交互后是否有对应的叙事融入式状态追踪？缺少=high违规
- 进度/等级/状态变化是否通过感官体验/物品变化/身体反应呈现？未融入叙事=medium违规
- 主角成长是否有可视化变化？缺少=medium违规
- 正文中出现[筹码][权限终端][道具]等方括号标签=high违规（应融入叙事）

【信任/合作检查·必须验证】
- 角色建立合作时是否明确了条件与代价？缺少=high违规
- 合作条件是否完整：角色定位+互补条件+违约代价？不完整=medium违规
- 背叛行为是否触发负面后果？未触发=high违规`,
            outputRule: `【审核输出要求 - 无限流副本博弈·改造版】
1. 检查副本机制是否具象可执行且绑定道具/进度指示器
2. 检查主角是否有主动博弈/反制行为（非纯被动支付代价）
3. 检查每次破局是否伴随：①代价结算 ②权限/资源掉落 ③规则反制
4. 检查章末断章类型是否为以下5类之一：trust_break/resource_critical/forced_choice/info_reversal/threat_approach（纯氛围渲染=违规）
5. 检查节奏微循环：规划→执行→危机→结算/断章
6. 检查环境描写占比是否≤20%
7. 检查AI味：重复句式/过度修饰/心理独白超标
8. 检查机制状态追踪是否与项目素材定义一致（禁止套用其他项目格式）
9. 检查角色合作是否明确了条件与代价
10. issues中必须包含完整修改指导`
        },
        secondReview: {
            perspectiveRule: `【视角感知审核规则 - 无限流副本博弈·改造版】
判定视角违规时：
- 上帝视角解说副本底层逻辑=违规（critical），规则必须通过角色试错/交互/线索拼凑呈现
- 心理独白占比>20%=违规（high），推演过程必须通过行为与对话呈现
- 角色知晓不应知道的副本信息=违规（critical）
- "系统提示音自动解答""主角突然灵光一闪"=违规（critical），机械降神`,
            terminologyRule: `【副本机制可解性判定标准 - 复审·改造版】
✅ 具象机制：抽象概念绑定可交互道具或进度指示器，机制呈现与项目素材一致
✅ 主角能动性：每次破局伴随代价结算+权限掉落+规则反制
✅ 断章钩子：强制选择/信息差反转/代价预告/威胁逼近（非纯氛围渲染）
❌ 抽象规则未具象化
❌ 主角纯被动无收益
❌ 纯氛围渲染结尾

【信任/合作进度校验·复审必须执行】
- trust_contract_progress ≥ 1：本章是否推进了至少1个信任/合作关系？
- 角色合作是否明确了条件与代价？未明确=high违规
- 违约代价是否被触发/结算？未结算=medium违规

【进度追踪校验·复审必须执行】
⚠️ 进度追踪必须融入叙事，禁止UI面板/方括号标签形式。
- 机制状态追踪是否与机制交互一一对应？缺失=high违规
- 状态变化是否通过感官体验/物品变化/身体反应呈现？未融入叙事=medium违规
- 正文中出现[筹码][权限终端][道具]等方括号标签=high违规（应融入叙事）`,
            correctionRule: `【初审结果校正 - 无限流副本博弈·改造版】
初审可能将合理的推演过程误标为"机械降神"。你需要纠正：
- 如果主角的推理有前置线索支撑（前文已埋设）→不是机械降神
- 如果主角通过观察/试错/交互得出结论→不是灵光一闪
- 如果机制确实通过道具交互呈现→不是抽象规则
- 但如果结论确实无任何前置线索支撑→确实是机械降神
- 方括号标签（如[筹码]、[权限终端]、[道具]等）在正文中属于红线违规，初审对此的判定正确，不应纠正`
        },
        reviser: {
            terminologyDimmingRule: `【副本机制呈现规则 - 修改时必须遵守】
所有副本机制必须通过角色试错/交互/线索拼凑呈现，禁止上帝视角解说底层逻辑。
机制状态追踪标记不得以网游面板形式出现在正文中，必须融入叙事（如感官感受、物品变化等）。
禁止"系统提示音自动解答""主角突然灵光一闪"等机械降神表述。
抽象概念必须绑定可交互道具或进度指示器，机制呈现方式与项目素材一致。
每次使用道具/能力需标注代价/效果/限制。`,
            perspectiveRule: `【视角感知规则 - 修改时必须遵守】
- 严格有限视角：所有信息必须通过角色感官/推理传递，禁止全知旁白
- 推演过程必须通过行为与对话呈现，心理独白占比≤20%
- 心理描写必须由动作/环境反馈触发，禁止独立心理段落
- 禁止突兀插入缺乏感官锚点的环境描写`,
            repairRules: `1. 【视角越界修复核心原则】用角色感知/推理段落替换全知旁白/上帝视角段落，保持情节推进不变
6. 【critical】上帝视角解说副本逻辑→改为角色通过试错/交互/线索拼凑发现规则
7. 机械降神→补充前置线索铺垫，让破局有据可依
8. 规则不具象→绑定可交互道具或进度指示器，标注代价/效果/限制
9. 主角纯被动→添加主动博弈/反制行为，破局伴随代价结算+权限掉落+规则反制
10. 纯氛围渲染结尾→改为强制选择/信息差反转/代价预告断章`
        },
        finalEditor: {
            perspectiveRule: `【视角感知定稿规则 - 无限流副本博弈·改造版】
- 禁止上帝视角解说副本底层逻辑
- 心理独白占比不得超过20%
- 推演过程必须通过行为与对话呈现
- 禁止机械降神式破局
- 机制必须具象化（绑定道具/进度指示器，与项目素材一致）
- 主角必须有主动博弈/反制行为
- 章末必须为强制选择/信息差反转/代价预告断章
- 初审/复审可能对机制可解性判断过严，需确认机制是否确实不可推导`
        }
    },

    detectors: {
        perspective(content, styleProfile) {
            if (!content) return { isViolation: false, issues: [], hasCriticalIssue: false };

            const issues = [];
            const GOD_VIEW_PATTERNS = [
                { pattern: /实际上|事实上|殊不知|其实在这背后|鲜为人知的是/g, desc: '上帝视角旁白', severity: 'critical' },
                { pattern: /系统提示音|面板弹出|叮！.*已解锁|【系统】/g, desc: '网游化/机械降神表述', severity: 'critical' }
            ];

            for (const { pattern, desc, severity } of GOD_VIEW_PATTERNS) {
                const regex = new RegExp(pattern.source, 'g');
                const matches = [];
                let m;
                while ((m = regex.exec(content)) !== null) matches.push(m[0]);
                if (matches.length > 0) {
                    issues.push({ desc: `${desc}：发现${matches.length}处（${matches.slice(0, 3).join('、')}）`, pattern: pattern.source, severity, count: matches.length });
                }
            }

            const DEUS_EX_MACHINA_PATTERNS = [
                { pattern: /突然灵光一闪/g, desc: '机械降神"灵光一闪"' },
                { pattern: /脑海中闪过.*答案/g, desc: '机械降神"脑海闪过答案"' },
                { pattern: /忽然想明白了/g, desc: '机械降神"忽然想明白"' },
                { pattern: /系统自动.*解答/g, desc: '机械降神"系统自动解答"' }
            ];

            let deusCount = 0;
            const deusDetails = [];
            for (const { pattern, desc } of DEUS_EX_MACHINA_PATTERNS) {
                const regex = new RegExp(pattern.source, 'g');
                const matches = [];
                let m;
                while ((m = regex.exec(content)) !== null) matches.push(m[0]);
                if (matches.length > 0) {
                    deusCount += matches.length;
                    deusDetails.push(`${desc}(${matches.length}处)`);
                }
            }
            if (deusCount > 0) {
                issues.push({ desc: `机械降神检测：${deusDetails.join('、')}`, pattern: 'deus-ex-machina', severity: 'critical', count: deusCount });
            }

            const AI_FLAVOR_PATTERNS = [
                { pattern: /仿佛/g, desc: 'AI高频词"仿佛"' },
                { pattern: /不禁/g, desc: 'AI高频词"不禁"' },
                { pattern: /似乎/g, desc: 'AI高频词"似乎"' },
                { pattern: /令人/g, desc: 'AI高频词"令人"' },
                { pattern: /深深地/g, desc: 'AI高频词"深深地"' }
            ];

            let aiFlavorCount = 0;
            const aiFlavorDetails = [];
            for (const { pattern, desc } of AI_FLAVOR_PATTERNS) {
                const regex = new RegExp(pattern.source, 'g');
                const matches = [];
                let m;
                while ((m = regex.exec(content)) !== null) matches.push(m[0]);
                if (matches.length > 0) {
                    aiFlavorCount += matches.length;
                    aiFlavorDetails.push(`${desc}(${matches.length}处)`);
                }
            }
            if (aiFlavorCount >= 5) {
                issues.push({ desc: `AI味过重：${aiFlavorDetails.join('、')}`, pattern: 'ai-flavor-excess', severity: 'high' });
            }

            const INNER_VOICE_PATTERNS = /心想|心中|内心|暗想|暗道|思忖|琢磨|盘算/g;
            const innerMatches = content.match(INNER_VOICE_PATTERNS) || [];
            const charCount = content.replace(/\s/g, '').length;
            const innerRatio = innerMatches.length > 0 ? (innerMatches.length * 50 / charCount) : 0;
            if (innerRatio > 0.3) {
                issues.push({ desc: `心理独白占比过高（约${(innerRatio * 100).toFixed(0)}%>30%），推演过程应通过行为与对话呈现`, pattern: 'inner-voice-excess', severity: 'high' });
            }

            const criticalIssues = issues.filter(i => i.severity === 'critical');
            return {
                isViolation: criticalIssues.length > 0 || issues.filter(i => i.severity === 'high').length > 1,
                issues,
                hasCriticalIssue: criticalIssues.length > 0
            };
        },

        terminology(content, styleProfile) {
            if (!content) return { count: 0, instances: [], violationCount: 0 };

            const ABSTRACT_RULE_PATTERNS = [
                { pattern: /保持理智/g, suggestion: '具体化：如"数到十再行动""握紧手中的物品"' },
                { pattern: /遵守规则/g, suggestion: '具体化：指出具体哪条规则+违反后果' },
                { pattern: /注意安全/g, suggestion: '具体化：指出具体危险+规避方式' }
            ];

            const instances = [];
            let violationCount = 0;
            for (const { pattern, suggestion } of ABSTRACT_RULE_PATTERNS) {
                const regex = new RegExp(pattern.source, 'g');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    instances.push({ match: match[0], type: '抽象规则', suggestion, position: match.index, allowable: false });
                    violationCount++;
                }
            }

            return { count: instances.length, instances: instances.slice(0, 15), violationCount };
        },

        onomatopoeia: () => ({ count: 0, density: 0, issues: [] }),
        visualAnchors: () => ({ count: 0, issues: [] }),
        motherChildDialogue: () => ({ count: 0, issues: [] }),
        modernSlang(content) {
            if (!content) return { count: 0, instances: [] };
            const INTERNET_SLANG = [
                { pattern: /尊嘟假嘟/g, type: '网络词' },
                { pattern: /抽象发言/g, type: '网络词' },
                { pattern: /yyds/gi, type: '网络词' },
                { pattern: /破防了/g, type: '网络词' },
                { pattern: /emo了/g, type: '网络词' },
                { pattern: /蚌埠住了/g, type: '网络词' },
                { pattern: /摆烂/g, type: '网络词' },
                { pattern: /内卷/g, type: '网络词' },
                { pattern: /社死/g, type: '网络词' }
            ];
            const instances = [];
            for (const { pattern, type } of INTERNET_SLANG) {
                const regex = new RegExp(pattern.source, 'g');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    instances.push({ match: match[0], type, position: match.index });
                }
            }
            return { count: instances.length, instances: instances.slice(0, 15) };
        },
        mechanicVisualization(content, styleProfile) {
            if (!content) return { hasMechanicViz: false, issues: [] };
            const issues = [];
            const BRACKET_PROP_PATTERN = /\[道具[：:]\s*[^\]]+\]/g;
            const propMatches = content.match(BRACKET_PROP_PATTERN) || [];
            if (propMatches.length > 0) {
                issues.push({ severity: 'high', desc: `正文中存在${propMatches.length}处[道具]方括号标签，应融入叙事而非使用UI标签格式` });
            }
            return { hasMechanicViz: propMatches.length > 0, propCount: propMatches.length, issues };
        },

        progressTracking(content, styleProfile) {
            if (!content) return { hasProgressTracking: false, issues: [] };
            const issues = [];
            const BRACKET_TAG_PATTERNS = [
                /\[权限终端\]/g,
                /\[筹码\]/g,
                /\[道具[：:]\s*[^\]]+\]/g,
                /\[合作约定\]/g,
                /\[契约绑定\]/g,
                /\[千术\]/g,
                /\[代价标记\]/g
            ];
            let bracketTagCount = 0;
            for (const p of BRACKET_TAG_PATTERNS) {
                const m = content.match(p);
                if (m) bracketTagCount += m.length;
            }
            if (bracketTagCount > 0) {
                issues.push({ severity: 'high', desc: `正文中存在${bracketTagCount}处方括号标签（如[筹码][权限终端]等），应融入叙事而非使用UI标签格式` });
            }
            return { hasProgressTracking: bracketTagCount === 0, progressCount: 0, issues };
        },

        trustContract(content, styleProfile) {
            if (!content) return { hasTrustContract: false, issues: [] };
            const issues = [];
            const BRACKET_CONTRACT_PATTERNS = [
                /\[契约绑定\]/g,
                /\[合作约定\]/g
            ];
            let bracketContractCount = 0;
            for (const p of BRACKET_CONTRACT_PATTERNS) {
                const m = content.match(p);
                if (m) bracketContractCount += m.length;
            }
            if (bracketContractCount > 0) {
                issues.push({ severity: 'high', desc: `正文中存在${bracketContractCount}处方括号合作/契约标签，应融入对话和行动而非使用UI标签格式` });
            }
            return { hasTrustContract: bracketContractCount === 0, contractCount: 0, issues };
        },

        cliffhangerType(content, styleProfile) {
            if (!content) return { hasValidCliffhanger: false, issues: [] };
            const issues = [];
            const OPTION_PATTERN = /[①②③④⑤]\s*.+[（(].+[)）]/g;
            const THREAT_PATTERN = /逼近|抵住|倒计时|倒数|即将|最后一/g;
            const CHOICE_PATTERN = /选项|抉择|二选一|必须选择/g;
            const last500 = content.slice(-500);
            const optionMatches = last500.match(OPTION_PATTERN) || [];
            const threatMatches = last500.match(THREAT_PATTERN) || [];
            const choiceMatches = last500.match(CHOICE_PATTERN) || [];
            const hasForcedChoice = optionMatches.length >= 2 || choiceMatches.length > 0;
            const hasThreat = threatMatches.length > 0;
            const hasValidCliffhanger = hasForcedChoice || hasThreat;
            if (!hasValidCliffhanger) {
                issues.push({ severity: 'high', desc: '章末缺少强制选择/威胁逼近断章，当前结尾为纯氛围渲染，违反断章钩子铁律。必须改为：二选一代价结构 或 威胁逼近倒计时' });
            }
            return { hasValidCliffhanger, cliffhangerType: hasForcedChoice ? 'forced_choice' : (hasThreat ? 'threat_approach' : 'none'), issues };
        },
        ipDirectNaming(content) {
            if (!content) return { isViolation: false, count: 0, issues: [] };
            const ipNames = /(路飞|孙悟空|哆啦A梦|鸣人|佐助|七龙珠|海贼王|奥特曼|恶魔果实|仙豆|竹蜻蜓|念能力|龟派气功|螺旋丸|写轮眼|草帽|铁臂阿童木|柯南|灰太狼|喜羊羊|光头强|熊大|熊二)/g;
            const matches = [];
            let m;
            while ((m = ipNames.exec(content)) !== null) {
                matches.push({ type: 'ip-direct-name', text: m[0] });
            }
            return { isViolation: matches.length > 0, count: matches.length, issues: matches };
        },
        scoreStyleTime(content) {
            if (!content) return { isViolation: false, count: 0, issues: [] };
            const scorePatterns = /(?:0\.[0-9]+\s*(秒|分钟|毫秒)|仅\s*[0-9]+\s*(秒|分钟|毫秒)\s*[内里])/g;
            const matches = [];
            let m;
            while ((m = scorePatterns.exec(content)) !== null) {
                matches.push({ type: 'score-style-time', text: m[0] });
            }
            return { isViolation: matches.length > 2, count: matches.length, issues: matches };
        },
        namingElegance(content) {
            if (!content) return { isViolation: false, issues: [] };
            const clichéNames = /(龙傲天|叶辰|柳如烟|萧炎|林动|楚轩|林晓|苏雨|陈默|顾言)/g;
            const matches = content.match(clichéNames);
            return { isViolation: !!matches, issues: matches ? matches.map(n => ({ type: 'naming', text: n })) : [] };
        },
        paragraphLength(content) {
            if (!content) return { isViolation: false, totalParagraphs: 0, longParagraphs: 0, issues: [] };
            const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
            const longParas = paragraphs.filter(p => p.length > 200);
            const veryLongParas = paragraphs.filter(p => p.length > 300);
            return {
                isViolation: longParas.length > paragraphs.length * 0.3,
                totalParagraphs: paragraphs.length,
                longParagraphs: longParas.length,
                issues: veryLongParas.slice(0, 3).map(p => ({ type: 'long-paragraph', text: p.substring(0, 60) + '...', length: p.length }))
            };
        },
        literaryBloat(content) {
            if (!content) return { isViolation: false, count: 0, issues: [] };
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
            return { isViolation: count > 3, count, issues: count > 3 ? ['文青病描写过多，需删减华丽辞藻改用白描'] : [] };
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
            if (toolCount > 5) {
                issues.push(`检测到${toolCount}处工具性台词，配角可能被工具人化`);
            }
            return { isViolation: issues.length > 0, issues, toolPhraseCount: toolCount };
        }
},

    interceptors: {
        firstReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];

            const perspResult = _self.detectors.perspective(content, styleProfile);
            if (perspResult.isViolation) {
                const criticalDescs = perspResult.issues.filter(i => i.severity === 'critical').map(i => i.desc);
                const highDescs = perspResult.issues.filter(i => i.severity === 'high').map(i => i.desc);
                if (criticalDescs.length > 0) {
                    hardBlockIssues.push({ severity: 'critical', description: `视角/机械降神违规：${criticalDescs.join('；')}`, title: '视角/机械降神违规' });
                    hints.push(`【🚨视角/机械降神检测】${criticalDescs.join('；')}`);
                }
                if (highDescs.length > 0) {
                    warningIssues.push({ severity: 'high', description: `视角偏移/AI味：${highDescs.join('；')}`, title: '视角偏移/AI味' });
                }
            }

            const termResult = _self.detectors.terminology(content, styleProfile);
            if (termResult.violationCount > 0) {
                const abstractRules = termResult.instances.map(j => `"${j.match}"→${j.suggestion}`).join('、');
                warningIssues.push({ severity: 'high', description: `抽象规则检测：发现${termResult.violationCount}处(${abstractRules})，建议具象化`, title: '抽象规则' });
            }

            const slangResult = _self.detectors.modernSlang(content, styleProfile);
            if (slangResult.count > 0) {
                hardBlockIssues.push({ severity: 'critical', description: `年代语言污染：发现${slangResult.count}处网络用语(${slangResult.instances.slice(0, 3).map(s => s.match).join('、')})，必须替换`, title: '年代语言污染' });
            }

            const mechVizResult = _self.detectors.mechanicVisualization(content, styleProfile);
            if (mechVizResult.issues.length > 0) {
                const highIssues = mechVizResult.issues.filter(i => i.severity === 'high');
                const mediumIssues = mechVizResult.issues.filter(i => i.severity === 'medium');
                if (highIssues.length > 0) {
                    warningIssues.push({ severity: 'high', description: `机制具象化建议：${highIssues.map(i => i.desc).join('；')}`, title: '机制具象化建议' });
                }
                if (mediumIssues.length > 0) {
                    warningIssues.push({ severity: 'medium', description: `机制具象化不完整：${mediumIssues.map(i => i.desc).join('；')}`, title: '机制具象化不完整' });
                }
            }

            const progressResult = _self.detectors.progressTracking(content, styleProfile);
            if (progressResult.issues.length > 0) {
                const highIssues = progressResult.issues.filter(i => i.severity === 'high');
                const mediumIssues = progressResult.issues.filter(i => i.severity === 'medium');
                if (highIssues.length > 0) {
                    warningIssues.push({ severity: 'high', description: `进度追踪建议：${highIssues.map(i => i.desc).join('；')}`, title: '进度追踪建议' });
                }
                if (mediumIssues.length > 0) {
                    warningIssues.push({ severity: 'medium', description: `进度追踪不完整：${mediumIssues.map(i => i.desc).join('；')}`, title: '进度追踪不完整' });
                }
            }

            const trustResult = _self.detectors.trustContract(content, styleProfile);
            if (trustResult.issues.length > 0) {
                const highIssues = trustResult.issues.filter(i => i.severity === 'high');
                const mediumIssues = trustResult.issues.filter(i => i.severity === 'medium');
                if (highIssues.length > 0) {
                    warningIssues.push({ severity: 'high', description: `信任契约建议：${highIssues.map(i => i.desc).join('；')}`, title: '信任契约建议' });
                }
                if (mediumIssues.length > 0) {
                    warningIssues.push({ severity: 'medium', description: `信任契约不完整：${mediumIssues.map(i => i.desc).join('；')}`, title: '信任契约不完整' });
                }
            }

            const cliffResult = _self.detectors.cliffhangerType(content, styleProfile);
            if (cliffResult.issues.length > 0) {
                const highIssues = cliffResult.issues.filter(i => i.severity === 'high');
                if (highIssues.length > 0) {
                    warningIssues.push({ severity: 'high', description: `断章钩子建议：${highIssues.map(i => i.desc).join('；')}`, title: '断章钩子建议' });
                }
            }

            const ipCheck = _self.detectors.ipDirectNaming(content);
            if (ipCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `IP角色/道具直呼其名（${ipCheck.issues.map(i=>i.text).join(', ')}），违反IP风险防御铁律。必须用外貌特征+性格代号替代。`, title: 'IP直呼违规' });
            }

            const scoreTimeCheck = _self.detectors.scoreStyleTime(content);
            if (scoreTimeCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `评分式时间描述过多（${scoreTimeCheck.count}处"0.X秒"），违反活人写作规范。用正常人时间感知替代。`, title: '评分式时间' });
            }

            const nameCheck = _self.detectors.namingElegance(content);
            if (nameCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `检测到网文烂梗命名（${nameCheck.issues.map(i=>i.text).join(', ')}），违反命名规范。`, title: '命名违规' });
            }

            const paraCheck = _self.detectors.paragraphLength(content);
            if (paraCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `段落过长影响阅读体验：${paraCheck.totalParagraphs}段中有${paraCheck.longParagraphs}段超200字。必须拆分。`, title: '段落节奏违规' });
            }

            const literaryCheck = _self.detectors.literaryBloat(content);
            if (literaryCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `文青病超标：检测到${literaryCheck.count}处华丽辞藻堆砌。必须删减，改用白描。`, title: '文青病' });
            }

            const toolCharCheck = _self.detectors.toolCharacterDetection(content);
            if (toolCharCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `配角可能被工具人化：${toolCharCheck.issues.join('；')}。每个出场配角至少展现1个独立特质。`, title: '配角工具人化' });
            }

            return { hardBlockIssues, warningIssues, hints };
        },

        secondReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const perspResult = _self.detectors.perspective(content, styleProfile);
            const criticalIssues = perspResult.issues.filter(i => i.severity === 'critical');
            if (criticalIssues.length > 0) {
                hardBlockIssues.push({ severity: 'critical', description: `视角/机械降神违规(复审)：${criticalIssues.map(i => i.desc).join('；')}`, title: '视角/机械降神违规(系统HARD BLOCK)' });
            }

            const mechVizResult = _self.detectors.mechanicVisualization(content, styleProfile);
            const mechVizHigh = mechVizResult.issues.filter(i => i.severity === 'high');
            if (mechVizHigh.length > 0) {
                warningIssues.push({ severity: 'high', description: `机制具象化建议(复审)：${mechVizHigh.map(i => i.desc).join('；')}`, title: '机制具象化建议' });
            }

            const cliffResult = _self.detectors.cliffhangerType(content, styleProfile);
            const cliffHigh = cliffResult.issues.filter(i => i.severity === 'high');
            if (cliffHigh.length > 0) {
                warningIssues.push({ severity: 'high', description: `断章钩子建议(复审)：${cliffHigh.map(i => i.desc).join('；')}`, title: '断章钩子建议' });
            }

            const ipCheck = _self.detectors.ipDirectNaming(content);
            if (ipCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `IP角色/道具直呼其名（${ipCheck.issues.map(i=>i.text).join(', ')}），违反IP风险防御铁律。`, title: 'IP直呼违规' });
            }

            return { hardBlockIssues, warningIssues, hints: [] };
        }
    }
};

module.exports = _self;
