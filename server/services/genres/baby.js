const _self = {
    id: 'baby',
    label: '萌娃题材',
    patterns: ['萌宝', '萌娃', '幼崽', '宝宝', '变废为宝', '躺平', '植物系', 'plant_kid'],

    perspectiveSchema: {
        fields: '"perspective":"baby/adult/mixed"',
        label: '视角：baby/adult/mixed',
        values: ['baby', 'adult', 'mixed']
    },

    isMatch(styleProfile) {
        const text = [styleProfile?.key, styleProfile?.label, styleProfile?.description].filter(Boolean).join(' ');
        return this.patterns.some(p => text.includes(p));
    },

    foundation: {
        additionalConstraints: [
            { id: 'baby-perspective-only', label: '纯萌宝视角', desc: '全文必须以幼崽的第一视角或紧贴幼崽的第三人称有限视角叙事。幼崽角色严禁出现成人化内心独白、权谋分析、战略思考' },
            { id: 'no-adult-inner-voice', label: '禁成人内心戏', desc: '幼崽角色严禁出现成人化内心独白。成人角色直接内心独白每章≤2处，优先通过幼崽可观察行为侧面表达' },
            { id: 'cute-first-always', label: '萌感优先', desc: '萌感必须来自幼崽天真行为而非形容词堆砌。幼崽的强大必须通过幼崽行为体现' },
            { id: 'dialogue-authentic', label: '对话真实', desc: '对话必须承载信息差/立场差/情感差，禁止无信息量寒暄。儿童化表达需体现3-5岁语言特征' },
            { id: 'character-intro-whitelist', label: '新角色出场铺垫规范', desc: '禁止无铺垫突然引入亲属/权威称谓（如爹爹/阿姨/老师）。所有新角色必须通过以下路径自然带出：①现有关系网延伸 ②儿童社交标签化 ③物品代称过渡。违反则标记major' },
            { id: 'anti-tool-character-baby', label: '反工具人化（题材增强）', desc: '基底已含反工具人化红线，本题材增强：成人角色必须有独立于幼崽的动机和情感，不能只围着幼崽转。每个成人角色至少有1个独立生活线（工作/社交/个人烦恼），对话必须有信息差和立场差，不是单纯的"宠溺+配合"' }
        ],
        additionalFoundationRules: [
            '【幼崽视角铁律】萌宝/幼崽题材：每章必须有幼崽角色的感官/行为/对话描写，幼崽出场段占比≥40%。全章无幼崽视角=自动拒绝。幼崽感知段严禁使用专业术语/工程参数/系统机制描述，必须用3-5岁感官隐喻替代。成人工作段术语保留但必须紧跟幼崽感知反应过渡。'
        ],
        systemMechanismDimming: true,
        systemMechanismTarget: '幼崽可理解的感官表达'
    },

    incompatibleConstraints: ['foreshadow-manage', 'spider-web-foreshadow', 'emotional-closure-foreshadow', 'vivid-combat', 'madness-has-cost', 'stance-conflict', 'slow-burn-romance', 'concrete-villain', 'power-fantasy', 'protagonist-proactive', 'plot-originality', 'interest-exchange-transform', 'bitter-camaraderie', 'montage-narrative'],
    requiredConstraints: ['simple-readable-style', 'dialogue-authentic'],

    styleProfile: {
        key: '萌娃变废为宝',
        label: '植物系躺平萌宝·变废为宝',
        povRule: '【视角铁律 - 触发即中断】第三人称限知视角，紧贴幼崽感知。每章幼崽出场段占比≥40%，全章无幼崽视角=自动拒绝。幼崽段落禁用：意识到/明白/暗想/盘算/权衡/谋划/深知/恍然/领悟。可用：觉得/感觉/看见/听见/想/知道/发现。成人段落允许内心独白但每章≤2处，优先通过幼崽可观察行为侧面表达。成人工作段术语保留但必须紧跟幼崽感知反应过渡（如"陈工说参数正常→小满看见屏幕上的绿线趴平了"）。',
        dialogueRule: '幼崽：叠词+具象比喻+短句（3-5岁特征）。成人对幼崽：降维匹配认知。成人之间：正常表达。',
        behaviorRule: '躺平基调，动机围绕舒适区与家人陪伴。严禁萌宝主动承担成人责任。冲突来自外部/意外/成人波及。术语降维：幼崽感知段→感官隐喻1句，成人工作段→术语保留。',
        toneRule: '轻松治愈+轻喜剧。短句短段。禁恐怖/克苏鲁。章末用好奇/期待感钩子。',
        titleRule: '【章节标题命名规则】标题必须诗情画意、具画面感，禁止技术说明书式命名。❌禁止："XX与YY的ZZ阀/舱/器/系统/装置/模块/缓冲层"（材料+材料+功能装置的工程命名模式）。✅正确：用感官意象+动作/状态命名，如"会唱歌的草茎井盖""冻土下的软被子""蒲苇穗会唱歌""沙盘里的白霜""暖土与亮片片"。标题要让读者产生画面感和好奇心，而不是像读工程图纸。',
        reviewFocus: '萌宝视角一致性|术语降维合理性|金手指自然度|字数达标',
        materialFocus: { primary: ['character', 'relationship', 'catchphrase', 'famous-scene'], secondary: ['worldview', 'growth-history'], skip: ['equipment', 'power-system', 'faction'] },
        constraintOverrides: ['no-adult-inner-voice', 'baby-perspective-only', 'cute-first-always', 'simple-readable-style', 'dialogue-authentic', 'no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'character-intro-whitelist'],
        characterRefRules: '【角色称呼规范】每段首次用全名，后续可用代词，换段/换场景后重新用全名。两个同性角色同场景禁连续用代词。幼崽优先用名字，严禁用"他"指代幼崽时产生歧义。母亲角色幼崽视角统一用一个称呼。'
    },

    genreBase: {
        BEHAVIOR_APPEND: '【术语降维规则】按段落视角区分：①幼崽感知段落（出现幼崽名/感官词/动作词）：术语→1句感官隐喻，如「安全阈值」→「安全线」、「后台日志」→「小本本」、「净化装置」→「洗澡大机器」、「地下管网」→「蚂蚁通道」。②成人工作段落（出现成人名/监控/屏幕/仪器）：术语保留原样。③混合段落：术语后紧跟幼崽感知反应。',
        REQUIRED_CONSTRAINT_OVERRIDES: ['character-intro-whitelist'],
        TONE_APPEND: '禁用恐怖/克苏鲁意象，可用科学奇幻化表达。',
        REVIEW_APPEND: '|科技降维检查|新角色出场铺垫检查|段落级防重复检查'
    },

    perspective: {
        babyNames: /小满|团团|幼崽|宝宝|萌宝|小豆丁|小团子|小家伙/,
        adultContextWords: /陈工|林晚|张工|李工|王工|赵工|监控|屏幕|仪器|数据|记录板|分贝仪|实验室|控制室|办公室/,
        babyContextWords: /小满|团团|宝宝|萌宝|小豆丁|小团子|小家伙|拍手|蹦跳|抱大腿|吃手|蹭|拍肚皮|打嗝|好暖|好软|好香|肚肚|怕怕|要要/,
        adultViewMarkers: ['陈工', '林晚', '张工', '李工', '王工', '赵工', '看着监控', '看着屏幕', '盯着数据', '检查仪器', '翻阅记录', '操作台', '控制面板', '记录板', '分贝仪', '实验室', '控制室', '办公室', '工作站', '会议室'],
        babyViewMarkers: ['小满', '他觉得', '他看见', '他听见', '好暖', '好软', '像棉花糖', '像小蜗牛', '拍手', '蹦跳', '抱大腿', '蹭', '歪头', '哼唧', '肚肚', '怕怕', '要要', '好香', '吧唧', '小揪揪', '肉嘟嘟', '圆鼓鼓', '小手', '小脚'],
        criticalPatterns: [
            { pattern: 'BABY_NAMES_ADULT_THINKING', desc: '幼崽成人化内心独白（critical）', severity: 'critical' },
            { pattern: 'BABY_NAMES_ADULT_JUDGMENT', desc: '幼崽成人化认知判断（critical）', severity: 'critical' }
        ],
        highPatterns: [
            { desc: '幼崽因果推理越界', severity: 'high' },
            { desc: '成人角色内心活动过多，应优先通过幼崽可观察行为侧面表达', severity: 'high' },
            { desc: '全章无幼崽视角/行为描写，完全是成人观察视角', severity: 'high' }
        ],
        mediumPatterns: [
            { desc: '全章无任何幼崽萌感行为（拍手/蹦跳/抱大腿/蹭人/歪头/哼唧等）', severity: 'medium' }
        ],
        forbiddenPatterns: [
            { pattern: /暗红色的纹路|古老的符咒/, desc: '恐怖/悬疑化描写（禁止）' },
            { pattern: /鬼爪|阴森/, desc: '恐怖化环境描写（禁止）' }
        ],
        adultInnerVoiceThreshold: 2,
        babyActionPatterns: /拍手|蹦跳|抱大腿|缩成团|吃手|蹭人|拍肚皮|打嗝|小揪揪|肉嘟嘟|圆鼓鼓|吧唧|嗝|歪头|眨巴|拽着|爬|趴|钻|扑|啃|揉|摸|扯|咕噜|哼唧|扭|摇|抓/,
        causalPattern: 'BABY_CAUSAL'
    },

    techJargon: {
        terms: [
            { term: '微胶囊网络', suggestion: '地下小豆豆在呼吸' },
            { term: '回音廊效应', suggestion: '声音在洞里转圈圈，像捉迷藏' },
            { term: '人地共生协议', suggestion: '人和大地的拉钩约定' },
            { term: '运维纪元', suggestion: '看护人的老故事' },
            { term: '输出回路', suggestion: '说话的小路转了一圈' },
            { term: '修复循环', suggestion: '修修补补转圈圈' },
            { term: '后台日志', suggestion: '偷偷记的小本本' },
            { term: '归档日志', suggestion: '收进柜子的小本本' },
            { term: '安全阈值', suggestion: '安全线/不危险的边边' },
            { term: '系统负载', suggestion: '背的东西重不重' },
            { term: '自我修复', suggestion: '自己给自己贴创可贴' },
            { term: '沙盘推演', suggestion: '用小石头摆阵玩' },
            { term: '矿渣填埋场', suggestion: '垃圾睡觉的大坑' },
            { term: '地下管网', suggestion: '地底下的蚂蚁通道' },
            { term: '净化装置', suggestion: '洗澡的大机器' },
            { term: '通风管道', suggestion: '呼吸的长管子' },
            { term: '生态监测', suggestion: '给大自然把脉' },
            { term: '共鸣能力', suggestion: '心连心的感觉' },
            { term: '协议更新', suggestion: '规则换新衣了' },
            { term: '协议终止', suggestion: '游戏规则变了' },
            { term: '休眠期', suggestion: '在睡懒觉' }
        ]
    },

    qualityChecks: {
        onomatopoeia: { enabled: true, minCount: 15, levels: { high: 5, medium: 10, low: 15 } },
        visualAnchors: { enabled: true, minCount: 3, levels: { high: 2, medium: 3 } },
        motherChildDialogue: { enabled: true, minCount: 2, levels: { high: 0, medium: 2 } },
        modernSlangExtra: true
    },

    writerHints: {
        terminologyDimming: '【术语降维】幼崽感知段：术语→1句感官隐喻（如「安全阈值」→「安全线」「后台日志」→「小本本」）。成人工作段：术语保留。',
        wordCountExpand: ['增加2-3段幼崽与环境的互动细节（摸/闻/听/看）']
    },

    constraintPresets: {
        'baby-perspective-only': { label: '纯萌宝视角', desc: '全文必须以幼崽的第一视角或紧贴幼崽的第三人称有限视角叙事。幼崽角色严禁出现成人化内心独白、权谋分析、战略思考' },
        'no-adult-inner-voice': { label: '禁成人内心戏', desc: '幼崽角色严禁出现成人化内心独白。成人角色直接内心独白每章≤2处，优先通过幼崽可观察行为侧面表达' },
        'cute-first-always': { label: '萌感优先', desc: '萌感必须来自幼崽天真行为而非形容词堆砌。幼崽的强大必须通过幼崽行为体现' },
        'dialogue-authentic': { label: '对话真实', desc: '对话必须承载信息差/立场差/情感差，禁止无信息量寒暄。儿童化表达需体现3-5岁语言特征' },
        'character-intro-whitelist': { label: '新角色出场铺垫规范', desc: '禁止无铺垫突然引入亲属/权威称谓（如爹爹/阿姨/老师）。所有新角色必须通过以下路径自然带出：①现有关系网延伸 ②儿童社交标签化 ③物品代称过渡。违反则标记major' }
    },

    dedupRules: [
        { id: 'pov-full', pattern: /【视角铁律[^】]*】[\s\S]*?成人角色直接内心独白每章[^\n]*/g, keep: 'first' },
        { id: 'pov-constraint', pattern: /纯萌宝视角[：:][^\n]*/g, keep: 'first' },
        { id: 'pov-adult', pattern: /禁成人内心戏[：:][^\n]*/g, keep: 'first' },
        { id: 'tech-dedup', pattern: /【科技描写降维规则】[\s\S]*?无需降维[^\n]*/g, keep: 'first' },
        { id: 'tech-dedup2', pattern: /【科技降维[^】]*】[\s\S]*?成人语境中术语合理[^\n]*/g, keep: 'first' },
        { id: 'tech-dedup3', pattern: /科技描写降维规则[^】]*】[\s\S]*?无需降维[^\n]*/g, keep: 'first' },
        { id: 'tech-dedup4', pattern: /科技描写降维[：:][^\n]*/g, keep: 'first' },
        { id: 'tech-dedup5', pattern: /科技降维检查[^|]*\|?/g, keep: 'first' },
        { id: 'tone-horror', pattern: /禁用恐怖\/克苏鲁意象[^。\n]*[。\n]/g, keep: 'first' },
        { id: 'tone-short', pattern: /句子短、段落短、节奏流畅/g, keep: 'first' },
        { id: 'tone-short2', pattern: /轻松治愈\+轻喜剧[^。\n]*[。\n]/g, keep: 'first' },
        { id: 'cute-behavior', pattern: /萌感必须来自幼崽天真行为[^\n]*/g, keep: 'first' },
        { id: 'cute-first', pattern: /萌感优先[：:][^\n]*/g, keep: 'first' },
        { id: 'baby-pov', pattern: /幼崽严禁成人化内心独白[^\n]*/g, keep: 'first' },
        { id: 'baby-pov2', pattern: /幼崽第一视角或紧贴幼崽的第三人称有限视角[^\n]*/g, keep: 'first' },
        { id: 'adult-inner', pattern: /成人直接内心独白每章[^\n]*/g, keep: 'first' },
        { id: 'dialogue-auth', pattern: /儿童化表达（叠词、具象比喻、短句）[^\n]*/g, keep: 'first' },
        { id: 'new-role-check', pattern: /新角色出场铺垫检查[^|]*\|?/g, keep: 'first' },
        { id: 'para-dedup-check', pattern: /段落级防重复检查[^|]*\|?/g, keep: 'first' },
        { id: 'charref', pattern: /【角色称呼规范[^】]*】[\s\S]*?严禁用[^\n]*指代幼崽时产生歧义/g, keep: 'first' },
        { id: 'charref2', pattern: /【角色称呼表[^】]*】[\s\S]*?换段或换场景后必须重新用全名/g, keep: 'first' },
        { id: 'charref3', pattern: /【角色称呼规范】[^\n]*/g, keep: 'first' }
    ],

    reviewRules: {
        firstReview: {
            perspectiveRule: `【视角感知审核规则 - 极其重要】
判定术语/口吻违规时，必须区分段落视角：
- 成人角色语境（陈工/林晚等专业对话/操作设备/查看数据）：专业术语使用合理，不应标记为违规
- 幼崽视角（小满感知/体验/观察）：所有科技术语必须降维为感官隐喻，违规标记critical
- 混合视角：若幼崽能感知到该信息则需降维
- 判断方法：看段落主语是谁？信息通过谁的感官传递？`,
            terminologyRule: `【科技术语判定标准 - 极其重要，防止矫枉过正】
只有以下情况才标记为"科技术语违规"：
✅ 应标记：幼崽视角中出现3-5岁无法理解的专业术语（如'微胶囊网络''回音廊效应''后台日志''安全阈值'）
✅ 应标记：幼崽视角中用工程/学术口吻描述（如'系统负载降到安全阈值以下'）
❌ 不应标记：3-5岁日常词汇（如'模型'——幼儿园有模型玩具;'垫子'——日常用品;'乱窜'——口语表达）
❌ 不应标记：成人角色在自身语境中的专业描述（如陈工'感受湿度变化'——工程师的正常行为）
❌ 不应标记：拟人化/口语化表达（如'空气乱窜'——这是儿童化表达，不是术语）
判断标准：问自己"3岁小孩在日常生活中会不会听到/用到这个词？"如果会→不是科技术语`,
            outputRule: `【审核输出要求 - 极其重要】
1. issues中每个问题必须包含完整修改指导，让返修员能直接按指导修改，无需猜测
2. 禁止写笼统描述如"存在技术术语"→必须写"第X段'回音廊效应开始显现'(幼崽视角)违反科技降维规则→建议改为'声音在洞里转圈圈'"
3. 成人角色语境中的专业术语不得标记为违规
4. 禁止写"部分段落"→必须指出具体段落位置和原文语句
5. suggestions中每条建议必须是可执行的具体操作，不能是"注意XX"这种空话
6. 标记术语违规前，先确认该词是否3-5岁幼儿在日常生活中真的无法理解`
        },
        secondReview: {
            perspectiveRule: `【视角感知审核规则 - 极其重要】
判定术语/口吻违规时，必须区分段落视角：
- 成人角色语境（陈工/林晚等说话、观察数据、操作设备时）：使用专业术语是合理的，不应标记为违规
- 幼崽视角（小满感知/体验/观察时）：所有科技术语必须降维为感官隐喻，违规标记critical
- 混合视角：术语需谨慎判定，若幼崽能感知到该信息则需降维
- 判断依据：段落主语是谁？信息通过谁的感官传递？如果是成人角色的专业对话/操作，术语使用合理`,
            terminologyRule: `【科技术语判定标准 - 极其重要，防止矫枉过正】
✅ 应标记：幼崽视角中3-5岁无法理解的专业术语（如'微胶囊网络''回音廊效应''后台日志''安全阈值'）
❌ 不应标记：3-5岁日常词汇（如'模型'——幼儿园有模型玩具;'垫子'——日常用品;'乱窜'——口语表达）
❌ 不应标记：成人角色在自身语境中的专业描述（如陈工'感受湿度变化'——工程师的正常行为）
❌ 不应标记：拟人化/口语化表达（如'空气乱窜'——这是儿童化表达，不是术语）
判断标准：问自己"3岁小孩在日常生活中会不会听到/用到这个词？"如果会→不是科技术语`,
            correctionRule: `【初审结果校正】
初审可能矫枉过正，将日常词汇误标为科技术语。你需要纠正这种误判：
- 如果初审标记的"术语"是3-5岁日常词汇→应判定为不违规，在summary中说明
- 如果初审标记的"术语"出现在成人角色语境→应判定为合理，无需降维`
        },
        reviser: {
            terminologyDimmingRule: `【科技描写降维规则 - 修改时必须遵守】
幼崽视角叙事中所有数据/设备/参数必须转化为幼崽感官隐喻，禁止直述术语。
成人角色（陈工/林晚）在自身语境中使用专业术语是合理的。
系统管线标记（如"伏笔追踪报告""归档日志""参数校准"等）不得出现在正文中，必须替换为故事内合理物品。`,
            perspectiveRule: `【视角感知规则 - 修改时必须遵守】
- 幼崽视角：所有信息必须通过五感传递，禁止全知旁白
- 成人视角：专业描述合理，但紧贴幼崽叙事时需归属视角
- 禁止突兀插入缺乏感官锚点的环境描写`,
            repairRules: `1. 【视角越界修复核心原则】用幼崽视角段落替换成人独白/纯叙述段落，而非在原文上叠加幼崽内容
6. 【critical】系统机制直述/术语未降维→按段落视角区分：幼崽感知段术语→1句感官隐喻，成人工作段术语保留
7. 拟声词不足→在环境/动作描写中补入拟声词(沙沙/咕噜/吧唧/滴答/呼哧/咔嗒/噗/嗡嗡等)
8. 母子对话缺失→添加2-3句幼崽与母亲直接对话`
        },
        finalEditor: {
            perspectiveRule: `【视角感知定稿规则 - 极其重要】
判定术语/口吻问题时，必须区分段落视角：
- 成人角色语境（陈工/林晚等专业对话/操作设备/查看数据）：专业术语使用合理，不应作为reject理由
- 幼崽视角（小满感知/体验/观察）：术语必须已降维为感官隐喻，否则reject
- 初审/复审可能矫枉过正，将3-5岁日常词汇（如'模型''垫子''乱窜'）误标为科技术语，你需要纠正这种误判
- 判断标准：3岁小孩在日常生活中会不会听到/用到这个词？如果会→不是科技术语`
        }
    },

    detectors: {
        perspective(content, styleProfile) {
            if (!content) return { isViolation: false, issues: [] };

            const p = _self.perspective;
            const issues = [];

            const ADULT_CONTEXT_WORDS = p.adultContextWords;
            const BABY_CONTEXT_WORDS = p.babyContextWords;

            const paragraphs = content.split(/\n\n+/);
            const paragraphContexts = paragraphs.map(para => {
                if (ADULT_CONTEXT_WORDS.test(para) && !BABY_CONTEXT_WORDS.test(para)) return 'adult';
                if (BABY_CONTEXT_WORDS.test(para) && !ADULT_CONTEXT_WORDS.test(para)) return 'baby';
                if (ADULT_CONTEXT_WORDS.test(para) && BABY_CONTEXT_WORDS.test(para)) return 'mixed';
                return 'unknown';
            });

            const BABY_NAMES = p.babyNames;
            const BABY_INNER_VOICE_PATTERNS = [
                { pattern: new RegExp(`(${BABY_NAMES.source}).{0,5}(意识到|明白|暗想|暗道|心中暗|盘算|算计|权衡|谋划|战略布局|深谋远虑)`), desc: '幼崽成人化内心独白（critical）', severity: 'critical' },
                { pattern: new RegExp(`(${BABY_NAMES.source}).{0,5}(必须|不得不|显然|由此可见|综上所述|战略|权谋|布局)`), desc: '幼崽成人化认知判断（critical）', severity: 'critical' },
            ];

            for (const { pattern, desc, severity } of BABY_INNER_VOICE_PATTERNS) {
                const matches = [];
                let m;
                const regex = new RegExp(pattern.source, 'g');
                while ((m = regex.exec(content)) !== null) {
                    const pos = m.index;
                    let paraIdx = 0;
                    let cumLen = 0;
                    for (let i = 0; i < paragraphs.length; i++) {
                        if (cumLen + paragraphs[i].length >= pos) { paraIdx = i; break; }
                        cumLen += paragraphs[i].length + 2;
                    }
                    const pCtx = paragraphContexts[paraIdx] || 'unknown';
                    if (pCtx === 'adult' || pCtx === 'mixed') continue;
                    matches.push(m[0]);
                }
                if (matches.length > 0) {
                    issues.push({ desc, pattern: pattern.source, severity, count: matches.length });
                }
            }

            const BABY_CAUSAL_PATTERN = new RegExp(`(${BABY_NAMES.source})([^不]{0,5})(知道|清楚).{0,10}(必须|应该|所以|因此|这意味着)`);
            const causalMatches = [];
            let cm;
            const causalRegex = new RegExp(BABY_CAUSAL_PATTERN.source, 'g');
            while ((cm = causalRegex.exec(content)) !== null) {
                const pos = cm.index;
                let paraIdx = 0;
                let cumLen = 0;
                for (let i = 0; i < paragraphs.length; i++) {
                    if (cumLen + paragraphs[i].length >= pos) { paraIdx = i; break; }
                    cumLen += paragraphs[i].length + 2;
                }
                const pCtx = paragraphContexts[paraIdx] || 'unknown';
                if (pCtx !== 'adult') causalMatches.push(cm[0]);
            }
            if (causalMatches.length > 0) {
                issues.push({ desc: `幼崽因果推理越界（${causalMatches.length}处）`, pattern: BABY_CAUSAL_PATTERN.source, severity: 'high', count: causalMatches.length });
            }

            const ADULT_CHARACTER_PATTERNS = [
                { pattern: /(?<!原来)(他|她)(意识到|明白|暗想|暗道|心中暗|盘算|算计|权衡|谋划)/, desc: '成人角色深度内心独白' },
                { pattern: /心中(想|道|叹)/, desc: '成人角色内心独白' },
            ];
            const ADULT_EXCLUDED_PATTERNS = [
                /原来.{2,15}(不是|是个|是)/,
                /他.{1,10}(把它|把它|叫醒|做|去)/,
                /(不是|不是乱冲).{0,5}(是有节奏|是惊喜|是安心)/,
                /(手指|手心|肩膀).{0,10}(发颤|发抖|微微).{0,10}(不是害怕|不是冷|是惊喜)/
            ];
            let adultInnerVoiceCount = 0;
            for (const { pattern } of ADULT_CHARACTER_PATTERNS) {
                const matches = content.match(new RegExp(pattern.source, 'g'));
                if (matches) adultInnerVoiceCount += matches.length;
            }
            for (const exPattern of ADULT_EXCLUDED_PATTERNS) {
                const exMatches = content.match(new RegExp(exPattern.source, 'g'));
                if (exMatches) adultInnerVoiceCount = Math.max(0, adultInnerVoiceCount - exMatches.length);
            }
            const adultParaCount = paragraphContexts.filter(c => c === 'adult' || c === 'mixed').length;
            const adultRatio = adultParaCount / Math.max(paragraphs.length, 1);
            const adultVoiceThreshold = adultRatio > 0.3 ? 4 : 2;
            if (adultInnerVoiceCount > adultVoiceThreshold) {
                issues.push({
                    desc: `成人角色内心活动过多（${adultInnerVoiceCount}>${adultVoiceThreshold}处/章），应优先通过幼崽可观察行为侧面表达`,
                    pattern: 'adult-inner-voice-excess',
                    severity: 'high'
                });
            }

            for (const { pattern, desc } of p.forbiddenPatterns) {
                if (pattern.test(content)) {
                    issues.push({ desc, pattern: pattern.source, severity: 'critical' });
                }
            }

            const OMNISCIENT_PATTERNS = [
                { pattern: /[，。]\s*[^，。]*?(早就|早已|本来|其实|事实上|殊不知)[^，。]*?(就|便|已|在)[^，。]{0,20}(了|着|过)[^，。]*?[，。]/, desc: '全知旁白：叙述者知道角色不应知道的信息' },
                { pattern: /(?:沉睡|休眠|蛰伏|埋藏|隐藏).{0,10}[一二三四五六七八九十\d]+年/, desc: '全知旁白+打破第四面墙：引用章回编号' },
                { pattern: /(?:在脑海里|在心中|在心底|在意识深处)(翻腾|涌动|浮现|闪过|掠过)/, desc: '全知旁白：无角色归属的内心描写' },
                { pattern: /^(?!.*(?:小满|团团|林晚|他觉得|他看见|他感觉|他发现|他说|他问|妈妈|妈咪)).{0,30}(早就|早已|本来就该|注定|命运|宿命)/, desc: '全知旁白：上帝视角叙事' },
            ];
            for (const { pattern, desc } of OMNISCIENT_PATTERNS) {
                const matches = content.match(new RegExp(pattern.source, 'g'));
                if (matches) {
                    for (const match of matches) {
                        let paraIdx = 0;
                        let cumLen = 0;
                        const pos = content.indexOf(match);
                        for (let i = 0; i < paragraphs.length; i++) {
                            if (cumLen + paragraphs[i].length >= pos) { paraIdx = i; break; }
                            cumLen += paragraphs[i].length + 2;
                        }
                        const pCtx = paragraphContexts[paraIdx] || 'unknown';
                        if (pCtx === 'adult') continue;
                        issues.push({ desc: desc + '："' + match.substring(0, 30) + '"', pattern: pattern.source, severity: 'critical' });
                    }
                }
            }

            const babyActionPatterns = p.babyActionPatterns;
            const hasBabyAction = babyActionPatterns.test(content);
            if (!hasBabyAction) {
                issues.push({ desc: '全章无任何幼崽萌感行为（拍手/蹦跳/抱大腿/蹭人/歪头/哼唧等）', pattern: 'missing-baby-action', severity: 'medium' });
            }

            const firstPersonBaby = /(我要吃|怕怕|抱抱|要要|好吃|嗝|肚肚)/;
            const babyActionVerbs = '拍拍?小手|拍手|蹦蹦?跳跳?|蹦跳|抱住|缩成|吃手|蹭|拍肚皮|打嗝|歪头|眨眼|拽着|抓住|爬|趴|钻|扑|啃|吧唧|揉|摸|扯|哼唧|咕噜|扭|摇|抓';
            const thirdPersonBaby = new RegExp(`(${BABY_NAMES.source})(${babyActionVerbs})`);
            const babySensoryPattern = new RegExp(`(${BABY_NAMES.source}).{0,10}(觉得|感觉|看见|听见|闻到|好暖|好软|好香|好冷|好硬)`);
            const hasBabyPerspective = firstPersonBaby.test(content) || thirdPersonBaby.test(content) || babySensoryPattern.test(content);
            if (!hasBabyPerspective) {
                issues.push({ desc: '全章无幼崽视角/行为描写，完全是成人观察视角', pattern: 'missing-baby-perspective', severity: 'high' });
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

            const p = _self.perspective;
            const jargonTerms = _self.techJargon.terms;

            const ADULT_CONTEXT_MARKERS = p.adultViewMarkers;
            const ADULT_CONTEXT_REGEX = new RegExp(ADULT_CONTEXT_MARKERS.join('|'));
            const BABY_VIEW_MARKERS = p.babyViewMarkers;
            const BABY_VIEW_REGEX = new RegExp(BABY_VIEW_MARKERS.join('|'));

            const paragraphs = content.split(/\n\n+/);
            const paragraphContexts = paragraphs.map(para => {
                if (ADULT_CONTEXT_REGEX.test(para) && !BABY_VIEW_REGEX.test(para)) return 'adult';
                if (BABY_VIEW_REGEX.test(para) && !ADULT_CONTEXT_REGEX.test(para)) return 'baby';
                if (ADULT_CONTEXT_REGEX.test(para) && BABY_VIEW_REGEX.test(para)) return 'mixed';
                return 'unknown';
            });

            const GENRE_SPECIFIC_JARGON = jargonTerms.map(t => ({
                pattern: new RegExp(t.term, 'g'),
                type: '题材术语',
                suggestion: t.suggestion
            }));

            const instances = [];
            let violationCount = 0;

            let charOffset = 0;
            for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
                const para = paragraphs[pIdx];
                const context = paragraphContexts[pIdx];

                for (const { pattern, type, suggestion } of GENRE_SPECIFIC_JARGON) {
                    const regex = new RegExp(pattern.source, 'g');
                    let match;
                    while ((match = regex.exec(para)) !== null) {
                        const globalPos = charOffset + match.index;
                        const matchStart = Math.max(0, match.index - 60);
                        const matchEnd = Math.min(para.length, match.index + match[0].length + 60);
                        const sentenceContext = para.substring(matchStart, matchEnd);
                        const isNearAdult = ADULT_CONTEXT_REGEX.test(sentenceContext);
                        const isNearBaby = BABY_VIEW_REGEX.test(sentenceContext);
                        const isAllowable = isNearAdult && !isNearBaby;

                        if (isAllowable) {
                            instances.push({
                                match: match[0], type, suggestion, position: globalPos,
                                perspective: 'adult', allowable: true,
                                note: '成人角色语境中术语使用合理，无需降维'
                            });
                        } else if (isNearAdult && isNearBaby) {
                            instances.push({
                                match: match[0], type, suggestion, position: globalPos,
                                perspective: 'mixed', allowable: false,
                                note: '混合视角段落中题材术语需确认是否在幼崽感知范围内'
                            });
                            violationCount++;
                        } else {
                            instances.push({
                                match: match[0], type, suggestion, position: globalPos,
                                perspective: isNearBaby ? 'baby' : 'unknown', allowable: false,
                                note: '幼崽视角中题材术语必须降维为感官隐喻'
                            });
                            violationCount++;
                        }
                    }
                }
                charOffset += para.length + 2;
            }

            return { count: instances.length, instances: instances.slice(0, 20), violationCount };
        },

        onomatopoeia(content, styleProfile) {
            if (!content) return { count: 0, density: 0, issues: [] };

            const config = _self.qualityChecks.onomatopoeia;
            const ONOMATOPOEIA = /沙沙|咕噜|吧唧|滴答|呼哧|咔嗒|噗|嗡嗡|叮咚|嗒嗒|嘶嘶|嘭|哧|吱呀|扑通|咕嘟|窸窣|哗啦|嘎吱|嗖|咚|啪|叮当|淅沥|呼啦|咕咕|叽叽|喳喳|喵|汪|咩|哼哧|咕咚|噼啪|嗒啦|窸窣|沙啦啦|呼噜噜|叮铃铃|淅沥沥|咕噜噜/g;
            const matches = content.match(ONOMATOPOEIA) || [];
            const count = matches.length;
            const charCount = content.replace(/\s/g, '').length;
            const density = charCount > 0 ? (count / charCount * 10000) : 0;

            const issues = [];
            if (count < config.levels.high) {
                issues.push({ desc: `拟声词严重不足（${count}个<${config.levels.high}个），需系统性补入`, severity: 'high' });
            } else if (count < config.levels.medium) {
                issues.push({ desc: `拟声词偏少（${count}个<${config.levels.medium}个），建议补入至≥${config.levels.low}个`, severity: 'medium' });
            } else if (count < config.levels.low) {
                issues.push({ desc: `拟声词略少（${count}个<${config.levels.low}个），建议适当补入`, severity: 'low' });
            }

            return { count, density: density.toFixed(2), issues, found: [...new Set(matches)] };
        },

        visualAnchors(content, styleProfile) {
            if (!content) return { count: 0, issues: [] };

            const config = _self.qualityChecks.visualAnchors;
            const VISUAL_PATTERNS = [
                /(?:看(到|见|着)|映入|映出|浮现|望(着|过|来|去|上|成|下|起|着|出|过|着)|折射|反射)/,
                /(?:颜色|色彩|红|橙|黄|绿|蓝|紫|白|黑|灰|金|银|粉|青|碧|褐)/,
                /(?:光(影|线|芒|晕|圈|点|束|子|像|斑|光|点|斑|影|处|斑)|折射|反射)/,
                /(?:圆|方|尖|扁|弯|曲|直|螺旋|锯齿|弧|棱角)/,
                /(?:飘|飞|旋|转|晃|摇|闪|跳|蹦|流|涌|散|落)/
            ];

            const paragraphs = content.split(/\n\n+/);
            let visualCount = 0;
            const visualParagraphs = [];
            for (let i = 0; i < paragraphs.length; i++) {
                const para = paragraphs[i];
                let hasVisual = false;
                for (const pattern of VISUAL_PATTERNS) {
                    if (pattern.test(para)) { hasVisual = true; break; }
                }
                if (hasVisual) { visualCount++; visualParagraphs.push(i); }
            }

            const issues = [];
            if (visualCount < config.levels.high) {
                issues.push({ desc: `视觉锚点严重不足（${visualCount}处<${config.levels.high}处），触觉描写可能独大`, severity: 'high' });
            } else if (visualCount < config.levels.medium) {
                issues.push({ desc: `视觉锚点偏少（${visualCount}处<${config.levels.medium}处），建议增加视觉画面描写`, severity: 'medium' });
            }

            return { count: visualCount, totalParagraphs: paragraphs.length, issues, visualParagraphs };
        },

        motherChildDialogue(content, styleProfile) {
            if (!content) return { count: 0, issues: [] };

            const config = _self.qualityChecks.motherChildDialogue;
            const MOTHER_NAMES = /妈妈|妈咪|母亲|林晚|林晚阿姨/;
            const CHILD_NAMES = /小满|团团|宝宝|萌宝|小豆丁/;
            const DIALOGUE_REGEX = /[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]([^\u201c\u201d\u0022\u300c\u300d\u300e\u300f]+)[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]/g;
            const DIALOGUE_TEST = /[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]([^\u201c\u201d\u0022\u300c\u300d\u300e\u300f]+)[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]/;

            const dialogues = [];
            let m;
            while ((m = DIALOGUE_REGEX.exec(content)) !== null) dialogues.push(m[1]);

            const paragraphs = content.split(/\n\n+/);
            let motherChildCount = 0;
            const mcParagraphs = [];
            for (let i = 0; i < paragraphs.length; i++) {
                const para = paragraphs[i];
                const hasMother = MOTHER_NAMES.test(para);
                const hasChild = CHILD_NAMES.test(para);
                const hasDialogue = DIALOGUE_TEST.test(para);
                if (hasDialogue && (hasMother || hasChild)) {
                    const nearbyText = para + (paragraphs[i + 1] || '');
                    if ((hasMother && hasChild) || (hasMother && CHILD_NAMES.test(nearbyText)) || (hasChild && MOTHER_NAMES.test(nearbyText))) {
                        motherChildCount++;
                        mcParagraphs.push(i);
                    }
                }
            }

            const issues = [];
            if (motherChildCount === 0) {
                issues.push({ desc: '全章无母子对话，建议添加2-3句幼崽与母亲直接对话', severity: 'high' });
            } else if (motherChildCount < config.levels.medium) {
                issues.push({ desc: `母子对话偏少（${motherChildCount}处<${config.levels.medium}处），建议增加`, severity: 'medium' });
            }

            return { count: motherChildCount, totalDialogues: dialogues.length, issues, mcParagraphs };
        },

        modernSlang(content, styleProfile) {
            if (!content) return { count: 0, instances: [] };

            const INTERNET_SLANG = [
                { pattern: /尊嘟假嘟/g, type: '网络词' },
                { pattern: /抽象发言/g, type: '网络词' },
                { pattern: /这波啊这波/g, type: '网络词' },
                { pattern: /瞳孔地震/g, type: '网络词' },
                { pattern: /绝绝子/g, type: '网络词' },
                { pattern: /yyds/gi, type: '网络词' },
                { pattern: /破防了/g, type: '网络词' },
                { pattern: /emo了/g, type: '网络词' },
                { pattern: /蚌埠住了/g, type: '网络词' },
                { pattern: /绷不住了/g, type: '网络词' },
                { pattern: /细狗/g, type: '网络词' },
                { pattern: /摆烂/g, type: '网络词' },
                { pattern: /内卷/g, type: '网络词' },
                { pattern: /社死/g, type: '网络词' }
            ];

            const WEB_NOVEL_CLICHE = _self.qualityChecks.modernSlangExtra ? [
                { pattern: /倒吸一口凉气/g, type: '网文腔' },
                { pattern: /瞳孔微缩/g, type: '网文腔' },
                { pattern: /降维打击/g, type: '网文腔' },
                { pattern: /杀意|煞星/g, type: '网文腔' },
                { pattern: /不禁倒吸/g, type: '网文腔' },
                { pattern: /嘴角微微上扬/g, type: '网文腔' },
                { pattern: /眼底闪过一/g, type: '网文腔' },
                { pattern: /冷笑一声/g, type: '网文腔' },
                { pattern: /嗤笑/g, type: '网文腔' }
            ] : [];

            const allPatterns = [...INTERNET_SLANG, ...WEB_NOVEL_CLICHE];
            const instances = [];
            for (const { pattern, type } of allPatterns) {
                const regex = new RegExp(pattern.source, 'g');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    instances.push({ match: match[0], type, position: match.index });
                }
            }

            return { count: instances.length, instances: instances.slice(0, 15) };
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
                    hardBlockIssues.push({ severity: 'critical', description: `视角违规：${criticalDescs.join('；')}，必须重写为幼崽视角/幼崽行为驱动`, title: '视角违规' });
                    hints.push(`【🚨视角违规检测 - 严重违规】幼崽角色出现成人化内心：${criticalDescs.join('；')}。必须重写为幼崽视角/幼崽行为驱动`);
                }
                if (highDescs.length > 0) {
                    hardBlockIssues.push({ severity: 'critical', description: `视角越界：${highDescs.join('；')}，必须重写加入幼崽视角/幼崽行为描写`, title: '视角越界' });
                    hints.push(`【⚠️视角偏移检测 - 需调整】${highDescs.join('；')}。成人角色内心活动应优先通过幼崽可观察行为侧面表达`);
                }
            }

            const termResult = _self.detectors.terminology(content, styleProfile);
            if (termResult.violationCount > 0) {
                const babyJargons = termResult.instances.filter(j => !j.allowable).map(j => `"${j.match}"(${j.perspective}视角)→"${j.suggestion}"`).join('、');
                const adultJargons = termResult.instances.filter(j => j.allowable).map(j => `"${j.match}"(成人语境)`).join('、');
                hardBlockIssues.push({ severity: 'critical', description: `幼崽视角科技术语未降维：发现${termResult.violationCount}处幼崽视角中的科技术语(${babyJargons})，必须替换为感官隐喻`, title: '幼崽视角科技术语未降维' });
                hints.push(`【🚨科技术语检测 - 幼崽视角违规】发现${termResult.violationCount}处幼崽视角中的科技术语：${babyJargons}。幼崽视角必须替换为感官隐喻`);
                if (adultJargons) hints.push(`【ℹ️科技术语提示 - 成人语境合理】成人角色语境中的术语(${adultJargons})使用合理，无需降维`);
            }

            const slangResult = _self.detectors.modernSlang(content, styleProfile);
            if (slangResult.count > 0) {
                hardBlockIssues.push({ severity: 'critical', description: `年代语言污染：发现${slangResult.count}处网络用语/网文腔(${slangResult.instances.slice(0, 3).map(s => s.match).join('、')})，必须替换为符合年代背景的表达`, title: '年代语言污染' });
            }

            if (_self.qualityChecks.onomatopoeia.enabled) {
                const onoResult = _self.detectors.onomatopoeia(content, styleProfile);
                if (onoResult.issues.length > 0) {
                    const onoIssue = onoResult.issues[0];
                    warningIssues.push({ severity: onoIssue.severity, description: `拟声词密度：${onoIssue.desc}（当前${onoResult.count}个，目标≥${_self.qualityChecks.onomatopoeia.minCount}个）`, title: '拟声词密度不足' });
                }
            }

            if (_self.qualityChecks.visualAnchors.enabled) {
                const vaResult = _self.detectors.visualAnchors(content, styleProfile);
                if (vaResult.issues.length > 0) {
                    const vaIssue = vaResult.issues[0];
                    warningIssues.push({ severity: vaIssue.severity, description: `视觉锚点：${vaIssue.desc}（当前${vaResult.count}处，目标≥${_self.qualityChecks.visualAnchors.minCount}处）`, title: '视觉锚点不足' });
                }
            }

            if (_self.qualityChecks.motherChildDialogue.enabled) {
                const mcResult = _self.detectors.motherChildDialogue(content, styleProfile);
                if (mcResult.issues.length > 0) {
                    const mcIssue = mcResult.issues[0];
                    warningIssues.push({ severity: mcIssue.severity, description: `母子对话：${mcIssue.desc}（当前${mcResult.count}处，目标≥${_self.qualityChecks.motherChildDialogue.minCount}处）`, title: '母子对话不足' });
                }
            }

            return { hardBlockIssues, warningIssues, hints };
        },

        secondReview(content, styleProfile, context) {
            const hardBlockIssues = [];

            const termResult = _self.detectors.terminology(content, styleProfile);
            if (termResult.violationCount > 0) {
                const babyJargons = termResult.instances.filter(j => !j.allowable).slice(0, 5).map(j => `"${j.match}"(${j.perspective}视角)→"${j.suggestion}"`).join('、');
                const adultJargons = termResult.instances.filter(j => j.allowable).map(j => `"${j.match}"(成人语境,合理)`).join('、');
                let desc = `复审通过但系统检测到幼崽视角科技术语未降维：发现${termResult.violationCount}处(${babyJargons})，必须替换为感官隐喻`;
                if (adultJargons) desc += `。注：成人语境中的术语(${adultJargons})使用合理，无需修改`;
                hardBlockIssues.push({ severity: 'critical', description: desc, title: '幼崽视角科技术语未降维(系统HARD BLOCK)' });
            }

            return { hardBlockIssues, warningIssues: [], hints: [] };
        }
    }
};

module.exports = _self;
