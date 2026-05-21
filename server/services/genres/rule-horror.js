const _self = {
    id: 'rule-horror',
    label: '规则怪谈',
    patterns: ['规则怪谈', '规则恐怖', '怪谈', 'rule-horror', '疗养院', '生存规则', '规则手册'],

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
            { id: 'rule-concreteness', label: '规则具象化', desc: '所有规则必须具象可执行，禁止抽象概念规则。规则呈现必须伴随具体场景/行为/后果' },
            { id: 'pov-lock-horror', label: '视角锁定', desc: '严格锁定主角第一人称或有限第三人称。禁止上帝视角解说规则来源；心理描写占比不超过全文30%' },
            { id: 'no-ai-flavor', label: '反AI味（题材增强）', desc: '基底已含反AI红线，本题材增强：禁用"仿佛""不禁""似乎""殊不知""令人"等AI高频模糊词。禁止跨章重复使用相同句式结构超过3次' },
            { id: 'character-intro-pacing', label: '新人物出场节奏', desc: '新人物出场需附带行为锚点+口头禅+动机三要素，禁止纯外貌描写。单章引入新核心角色不超过2个' },
            { id: 'rule-pace', label: '规则节奏', desc: '每章必须包含至少1个规则揭示或规则冲突事件。前300字内必须出现首个可执行规则或生存危机。每15章必须触发一次规则升维/世界观扩展' },
            { id: 'anti-tool-character-horror', label: '反工具人化（题材增强）', desc: '基底已含反工具人化红线，本题材增强：规则怪谈中NPC必须有独立于主角的规则理解和生存策略，不是单纯给主角提供信息的工具。每个NPC至少有1个独立动机（自保/探索/复仇/信仰），对话必须有信息差和立场差' }
        ],
        additionalFoundationRules: [
            '【规则怪谈铁律】规则怪谈题材：所有规则必须具象可执行，禁止抽象概念。视角严格锁定主角有限视角，禁止上帝视角解说规则来源。恐惧感必须通过行为细节与环境反馈呈现，禁止心理独白超标。新人物出场必须满足"行为锚点+口头禅+动机"三要素。'
        ],
        systemMechanismDimming: true,
        systemMechanismTarget: '主角可感知的规则提示/环境异常'
    },

    incompatibleConstraints: ['baby-perspective-only', 'no-adult-inner-voice', 'cute-first-always', 'character-intro-whitelist', 'dialogue-authentic', 'comedy-mandatory', 'grounded-style', 'fast-pace', 'power-fantasy', 'face-slapping', 'reader-satisfaction', 'dungeon-mechanics-pacing', 'pov-lock-dungeon', 'no-deus-ex-machina', 'trust-contract-rule', 'naming-convention-dungeon', 'rule-density-control', 'mechanic-visualization', 'protagonist-proactivity', 'cliffhanger-enforcement', 'pacing-micro-loop'],
    requiredConstraints: ['rule-concreteness', 'pov-lock-horror', 'no-ai-flavor', 'hook-every-chapter'],

    styleProfile: {
        key: '规则怪谈番茄',
        label: '规则怪谈·番茄节奏',
        povRule: '【视角铁律】严格锁定主角第一人称/有限第三人称。禁止上帝视角解说规则来源；禁止心理描写占比超过全文30%；所有恐惧感必须通过行为细节与环境反馈呈现。',
        dialogueRule: '对话必须符合人物身份与当前情境。禁用"仿佛""不禁""似乎"等AI高频模糊词。每人设出场需自带1个可识别的口头禅或语气特征（如句尾拖音、特定量词）。',
        behaviorRule: '角色行动必须受规则约束驱动。禁止无逻辑跳跃；禁止为推进剧情强行降智；遇险反应必须符合常人本能+主角特质。',
        toneRule: '冷峻、压抑、带黑色幽默或荒诞感。禁止过度煽情或说教。环境描写服务于规则提示，不独立成段。章末必须留有明确悬念或规则反转。',
        titleRule: '【章节标题命名规则】标题必须营造悬念感/规则感，禁止平淡叙述式命名。❌禁止："第X天""新规则"等直白命名。✅正确：用规则暗示+感官意象命名，如"熄灯后的第三声敲门""走廊尽头的纸人""别看它的眼睛"。',
        reviewFocus: '规则具象度|视角锁定|AI味检测|新人物三要素|悬念闭环率',
        materialFocus: { primary: ['character', 'worldview', 'foreshadowing', 'famous-scene'], secondary: ['relationship', 'catchphrase'], skip: ['equipment', 'power-system'] },
        constraintOverrides: ['rule-concreteness', 'pov-lock-horror', 'no-ai-flavor', 'character-intro-pacing', 'rule-pace', 'hook-every-chapter', 'no-derailment', 'character-consistency', 'worldview-consistency'],
        characterRefRules: '【角色称呼规范】每段首次用全名，后续可用代词，换段/换场景后重新用全名。两个同性角色同场景禁连续用代词。命名禁用AI高频名（林晓/苏雨/陈默/顾言），采用"地域+职业/特征"或"意象+反差"结构（如槐姐/钉叔/白瓷/老秤）。'
    },

    genreBase: {
        BEHAVIOR_APPEND: '【规则驱动行为】角色行动必须受当前已知规则约束。违反规则必须有明确后果。规则冲突时角色必须表现出困惑/恐惧/抉择，禁止无视规则继续行动。',
        REQUIRED_CONSTRAINT_OVERRIDES: ['rule-concreteness', 'character-intro-pacing'],
        TONE_APPEND: '禁止过度煽情或说教，保持冷峻压抑基调。可适度使用黑色幽默或荒诞感缓解紧张。',
        REVIEW_APPEND: '|规则具象度检查|新人物三要素检查|AI味检测|悬念闭环率检查'
    },

    perspective: null,
    techJargon: { terms: [] },

    qualityChecks: {
        onomatopoeia: { enabled: false },
        visualAnchors: { enabled: false },
        motherChildDialogue: { enabled: false },
        modernSlangExtra: false
    },

    writerHints: {
        terminologyDimming: '【规则呈现规范】规则必须通过场景/物品/对话具象化呈现，禁止"系统提示""面板弹出"等网游化表述（除非题材明确设定）。规则揭示伴随具体后果展示。',
        wordCountExpand: ['增加1-2段环境异常细节描写', '扩展规则违反后果的感官呈现']
    },

    constraintPresets: {
        'rule-concreteness': { label: '规则具象化', desc: '所有规则必须具象可执行，禁止抽象概念规则。规则呈现必须伴随具体场景/行为/后果' },
        'pov-lock-horror': { label: '视角锁定', desc: '严格锁定主角第一人称或有限第三人称。禁止上帝视角解说规则来源；心理描写占比不超过全文30%' },
        'no-ai-flavor': { label: '反AI味（题材增强）', desc: '基底已含反AI红线，本题材增强：禁用"仿佛""不禁""似乎""殊不知""令人"等AI高频模糊词。禁止跨章重复使用相同句式结构超过3次' },
        'character-intro-pacing': { label: '新人物出场节奏', desc: '新人物出场需附带行为锚点+口头禅+动机三要素，禁止纯外貌描写。单章引入新核心角色不超过2个' },
        'rule-pace': { label: '规则节奏', desc: '每章必须包含至少1个规则揭示或规则冲突事件。前300字内必须出现首个可执行规则或生存危机。每15章必须触发一次规则升维/世界观扩展' }
    },

    dedupRules: [
        { id: 'pov-lock', pattern: /【视角铁律[^】]*】[\s\S]*?环境反馈呈现[^\n]*/g, keep: 'first' },
        { id: 'rule-concrete', pattern: /规则具象化[：:][^\n]*/g, keep: 'first' },
        { id: 'no-ai', pattern: /反AI味[：:][^\n]*/g, keep: 'first' },
        { id: 'char-intro', pattern: /新人物出场节奏[：:][^\n]*/g, keep: 'first' },
        { id: 'rule-pace-dedup', pattern: /规则节奏[：:][^\n]*/g, keep: 'first' },
        { id: 'rule-drive', pattern: /规则驱动行为[^】]*】[\s\S]*?继续行动[^\n]*/g, keep: 'first' },
        { id: 'tone-horror', pattern: /禁止过度煽情或说教[^\n]*/g, keep: 'first' },
        { id: 'naming-rule', pattern: /【角色称呼规范[^】]*】[\s\S]*?老秤[^\n]*/g, keep: 'first' },
        { id: 'naming-rule2', pattern: /命名禁用AI高频名[^\n]*/g, keep: 'first' },
        { id: 'rule-present', pattern: /规则呈现规范[^】]*】[\s\S]*?明确设定[^\n]*/g, keep: 'first' }
    ],

    reviewRules: {
        firstReview: {
            perspectiveRule: `【视角感知审核规则 - 规则怪谈】
判定视角违规时：
- 上帝视角解说规则来源=违规（critical），规则必须通过角色发现/场景呈现
- 心理独白占比>30%=违规（high），恐惧感必须通过行为与环境反馈呈现
- 角色知晓不应知道的信息（如规则背后的真相）=违规（critical）`,
            terminologyRule: `【规则具象度判定标准】
✅ 具象规则："熄灯后禁止睁眼"——有明确触发条件+禁止行为+违反后果
✅ 具象规则："走廊只走右侧，听到脚步声停下"——可执行
❌ 抽象规则："保持理智"——无法执行，无明确判定标准
❌ 网游化："系统提示：规则#3已触发"——除非题材明确设定`,
            outputRule: `【审核输出要求 - 规则怪谈】
1. 检查每条规则是否具象可执行
2. 检查新人物是否满足"行为锚点+口头禅+动机"三要素
3. 检查AI味：重复句式/过度修饰/心理独白超标
4. 检查章末是否有明确悬念或规则反转
5. issues中必须包含完整修改指导`
        },
        secondReview: {
            perspectiveRule: `【视角感知审核规则 - 规则怪谈】
判定视角违规时：
- 上帝视角解说规则来源=违规（critical），规则必须通过角色发现/场景呈现
- 心理独白占比>30%=违规（high），恐惧感必须通过行为与环境反馈呈现
- 角色知晓不应知道的信息（如规则背后的真相）=违规（critical）`,
            terminologyRule: `【规则具象度判定标准 - 复审】
✅ 具象规则：有明确触发条件+禁止行为+违反后果
❌ 抽象规则：无法执行，无明确判定标准
❌ 网游化："系统提示：规则#3已触发"——除非题材明确设定`,
            correctionRule: `【初审结果校正 - 规则怪谈】
初审可能将合理的环境暗示误标为"上帝视角"。你需要纠正：
- 如果信息通过角色感官自然感知到（看到/听到/闻到）→不是上帝视角
- 如果规则通过场景中的物品/文字/他人转述呈现→不是上帝视角解说`
        },
        reviser: {
            terminologyDimmingRule: `【规则具象化规则 - 修改时必须遵守】
所有规则必须通过场景中的物品/文字/他人转述呈现，禁止上帝视角解说规则来源。
系统管线标记（如"伏笔追踪报告""归档日志"等）不得出现在正文中，必须替换为故事内合理物品。`,
            perspectiveRule: `【视角感知规则 - 修改时必须遵守】
- 严格有限视角：所有信息必须通过角色感官传递，禁止全知旁白
- 恐惧感必须通过行为与环境反馈呈现，禁止心理独白堆砌
- 禁止突兀插入缺乏感官锚点的环境描写`,
            repairRules: `1. 【视角越界修复核心原则】用角色感知段落替换全知旁白/上帝视角段落，保持情节推进不变
6. 【critical】上帝视角解说规则来源→改为角色通过场景/物品/他人转述发现规则
7. 心理独白超标→将内心独白改为行为与环境反馈描写
8. 规则不具象→补充触发条件+违反后果`
        },
        finalEditor: {
            perspectiveRule: `【视角感知定稿规则 - 规则怪谈】
- 禁止上帝视角解说规则来源
- 心理独白占比不得超过30%
- 恐惧感必须通过行为与环境反馈呈现
- 初审/复审可能对规则具象度判断过严，需确认规则是否确实不可执行`
        }
    },

    detectors: {
        perspective(content, styleProfile) {
            if (!content) return { isViolation: false, issues: [], hasCriticalIssue: false };

            const issues = [];
            const GOD_VIEW_PATTERNS = [
                { pattern: /实际上|事实上|殊不知|其实在这背后|鲜为人知的是/g, desc: '上帝视角旁白', severity: 'critical' },
                { pattern: /系统提示|面板弹出|叮！|【系统】/g, desc: '网游化表述（除非题材设定）', severity: 'high' }
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

            const AI_FLAVOR_PATTERNS = [
                { pattern: /仿佛/g, desc: 'AI高频词"仿佛"' },
                { pattern: /不禁/g, desc: 'AI高频词"不禁"' },
                { pattern: /似乎/g, desc: 'AI高频词"似乎"' },
                { pattern: /殊不知/g, desc: 'AI高频词"殊不知"' },
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
                issues.push({ desc: `心理独白占比过高（约${(innerRatio * 100).toFixed(0)}%>30%），应通过行为与环境反馈呈现恐惧`, pattern: 'inner-voice-excess', severity: 'high' });
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
                    hardBlockIssues.push({ severity: 'critical', description: `视角违规：${criticalDescs.join('；')}`, title: '视角违规' });
                    hints.push(`【🚨视角违规检测】${criticalDescs.join('；')}`);
                }
                if (highDescs.length > 0) {
                    warningIssues.push({ severity: 'high', description: `视角偏移：${highDescs.join('；')}`, title: '视角偏移' });
                }
            }

            const termResult = _self.detectors.terminology(content, styleProfile);
            if (termResult.violationCount > 0) {
                const abstractRules = termResult.instances.map(j => `"${j.match}"→${j.suggestion}`).join('、');
                warningIssues.push({ severity: 'high', description: `抽象规则检测：发现${termResult.violationCount}处抽象规则表达(${abstractRules})，建议具象化`, title: '抽象规则' });
            }

            const slangResult = _self.detectors.modernSlang(content, styleProfile);
            if (slangResult.count > 0) {
                hardBlockIssues.push({ severity: 'critical', description: `年代语言污染：发现${slangResult.count}处网络用语(${slangResult.instances.slice(0, 3).map(s => s.match).join('、')})，必须替换`, title: '年代语言污染' });
            }

            return { hardBlockIssues, warningIssues, hints };
        },

        secondReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const perspResult = _self.detectors.perspective(content, styleProfile);
            const criticalIssues = perspResult.issues.filter(i => i.severity === 'critical');
            if (criticalIssues.length > 0) {
                hardBlockIssues.push({ severity: 'critical', description: `视角违规(复审)：${criticalIssues.map(i => i.desc).join('；')}`, title: '视角违规(系统HARD BLOCK)' });
            }
            return { hardBlockIssues, warningIssues: [], hints: [] };
        }
    }
};

module.exports = _self;
