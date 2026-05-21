const _self = {
    id: 'urban-fantasy',
    label: '都市玄幻',
    patterns: ['都市', '玄幻', '修仙', '异能', '觉醒', '灵气'],

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
            { id: 'anti-tool-character-urban', label: '反工具人化（题材增强）', desc: '基底已含反工具人化红线，本题材增强：都市玄幻中配角必须有独立于主角的都市生活线（工作/社交/家庭），不能只为提供情报或推动剧情而存在。每个配角至少有1个独立动机和微表情特征' }
        ],
        additionalFoundationRules: [],
        systemMechanismDimming: false
    },

    incompatibleConstraints: ['baby-perspective-only', 'no-adult-inner-voice', 'cute-first-always', 'character-intro-whitelist', 'dialogue-authentic', 'comedy-mandatory', 'grounded-style', 'fast-pace', 'rule-concreteness', 'pov-lock-horror', 'rule-pace', 'dungeon-mechanics-pacing', 'pov-lock-dungeon', 'no-deus-ex-machina', 'trust-contract-rule', 'naming-convention-dungeon', 'rule-density-control', 'mechanic-visualization', 'protagonist-proactivity', 'cliffhanger-enforcement', 'pacing-micro-loop'],
    requiredConstraints: ['hook-every-chapter', 'no-derailment', 'character-consistency', 'worldview-consistency', 'anti-tool-character', 'character-depth'],

    styleProfile: {
        key: 'urban-fantasy',
        label: '都市玄幻',
        povRule: '有限第三人称或第一人称，禁止上帝视角解说设定来源。都市场景必须接地气，修仙元素与都市生活自然融合。',
        dialogueRule: '对话要像都市人说话，可以夹杂现代用语但需符合角色身份。禁止AI式"果然如此""您说得对"等机械应答。配角对话必须有信息差和立场差。',
        behaviorRule: '角色行动必须符合都市逻辑+修仙设定的融合。禁止为推进剧情强行降智。配角必须有独立于主角的都市生活线（工作/社交/家庭），不能只为提供情报而存在。',
        toneRule: '都市玄幻风格：现代都市的烟火气+修仙设定的神秘感。接地气大白话，不要文青病。环境描写最多2句带过，笔墨留给动作、对话、剧情推进。',
        titleRule: '章节标题用四字雅称+事件描述，如"灵气初显·地铁里的修仙者"',
        reviewFocus: '设定具象性|视角合规|AI味检测|配角独立性|都市烟火气|修仙与都市融合度|章末钩子|人物刻画深度|反工具人化|段落节奏',
        materialFocus: {
            primary: ['character', 'worldview', 'power-system', 'faction'],
            secondary: ['equipment', 'location', 'foreshadowing', 'writing-technique'],
            characterDetailPriority: '身份+都市职业+修为+性格+微表情习惯+立场逻辑',
            characterDetailRules: '人物素材必须包含：身份、性格、微表情习惯、立场逻辑、与主角关系、禁忌。禁止工具人化。'
        },
        characterRefRules: '【角色引用规范 - 都市玄幻】角色出场必须通过行为锚点+口头禅+动机三要素自然带出。禁止纯外貌描写式出场。配角必须有独立于主角的动机和立场。'
    },

    genreBase: {
        BEHAVIOR_APPEND: '都市玄幻中修仙设定必须与都市生活自然融合，禁止突兀的修仙术语堆砌。',
        TONE_APPEND: '保持都市烟火气，修仙元素通过日常场景自然呈现，不要刻意营造神秘感。',
        REVIEW_APPEND: '重点核查：1.修仙设定是否与都市生活自然融合；2.配角是否有独立生活线；3.是否出现AI写作痕迹；4.都市烟火气是否充足；5.人物刻画是否立体。'
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
        terminologyDimming: '',
        wordCountExpand: ['增加1-2段环境氛围描写', '扩展战斗/修炼细节']
    },

    constraintPresets: {},
    dedupRules: [],
    reviewRules: {
        firstReview: {
            perspectiveRule: `【视角感知审核规则 - 都市玄幻】
判定视角违规时：
- 上帝视角解说设定来源=违规（critical），设定必须通过角色发现/场景呈现
- 心理独白占比>30%=违规（high），冲突必须通过行为与对话呈现`,
            terminologyRule: `【设定呈现判定标准】
✅ 具象设定：有明确触发条件+可见效果+代价/限制
❌ 抽象设定：无法执行，无明确判定标准
❌ 设定堆砌：单章引入超过3个全新核心设定`,
            outputRule: `【审核输出要求 - 都市玄幻】
1. 检查设定是否具象可执行
2. 检查新人物是否满足"行为锚点+口头禅+动机"三要素
3. 检查AI味：重复句式/过度修饰/心理独白超标
4. 检查章末是否有明确悬念或冲突升级
5. issues中必须包含完整修改指导`
        },
        secondReview: {
            perspectiveRule: `【视角感知审核规则 - 都市玄幻】
判定视角违规时：
- 上帝视角解说设定来源=违规（critical）
- 心理独白占比>30%=违规（high）`,
            terminologyRule: `【设定呈现判定标准 - 复审】
✅ 具象设定：有明确触发条件+可见效果+代价/限制
❌ 抽象设定：无法执行，无明确判定标准`,
            correctionRule: `【初审结果校正 - 都市玄幻】
初审可能将合理的环境暗示误标为"上帝视角"。你需要纠正：
- 如果信息通过角色感官自然感知到→不是上帝视角
- 如果设定通过场景中的物品/他人转述呈现→不是上帝视角解说`
        },
        reviser: {
            terminologyDimmingRule: `【设定呈现规则 - 修改时必须遵守】
所有设定必须通过场景中的物品/他人转述/角色体验呈现，禁止上帝视角解说设定来源。
系统管线标记不得出现在正文中，必须替换为故事内合理物品。`,
            perspectiveRule: `【视角感知规则 - 修改时必须遵守】
- 有限视角：所有信息必须通过角色感官传递，禁止全知旁白
- 冲突必须通过行为与对话呈现，禁止心理独白堆砌
- 禁止突兀插入缺乏感官锚点的环境描写`,
            repairRules: `1. 【视角越界修复核心原则】用角色感知段落替换全知旁白/上帝视角段落，保持情节推进不变
6. 【critical】上帝视角解说设定来源→改为角色通过场景/物品/他人转述发现设定
7. 心理独白超标→将内心独白改为行为与对话描写
8. 设定不具象→补充触发条件+可见效果+代价/限制`
        },
        finalEditor: {
            perspectiveRule: `【视角感知定稿规则 - 都市玄幻】
- 禁止上帝视角解说设定来源
- 心理独白占比不得超过30%
- 冲突必须通过行为与对话呈现`
        }
    },

    detectors: {
        perspective: () => ({ isViolation: false, issues: [] }),
        terminology: () => ({ count: 0, instances: [], violationCount: 0 }),
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
            const PROP_STATE_PATTERN = /\[道具[：:]\s*[^\]]+\]\s*冷却[：:]/g;
            const COOLDOWN_PATTERN = /冷却[：:]\s*\d+/g;
            const COST_PATTERN = /代价[：:]\s*[^\s，,。；;]+/g;
            const EFFECT_PATTERN = /效果[：:]\s*[^\s，,。；;]+/g;
            const propMatches = content.match(PROP_STATE_PATTERN) || [];
            const cooldownMatches = content.match(COOLDOWN_PATTERN) || [];
            const costMatches = content.match(COST_PATTERN) || [];
            const effectMatches = content.match(EFFECT_PATTERN) || [];
            const RULE_INTERACTION_PATTERNS = [/规则/g, /副本/g, /机制/g, /破局/g, /权限/g];
            let ruleInteractionCount = 0;
            for (const p of RULE_INTERACTION_PATTERNS) {
                const m = content.match(new RegExp(p.source, 'g'));
                if (m) ruleInteractionCount += m.length;
            }
            if (ruleInteractionCount > 3 && propMatches.length === 0) {
                issues.push({ severity: 'high', desc: `存在规则交互(${ruleInteractionCount}处提及)但无[道具]状态机标注，违反机制具象化铁律` });
            }
            if (propMatches.length > 0) {
                if (cooldownMatches.length < propMatches.length) {
                    issues.push({ severity: 'medium', desc: `${propMatches.length - cooldownMatches.length}个道具缺少冷却标注` });
                }
                if (costMatches.length < propMatches.length) {
                    issues.push({ severity: 'medium', desc: `${propMatches.length - costMatches.length}个道具缺少代价标注` });
                }
                if (effectMatches.length < propMatches.length) {
                    issues.push({ severity: 'medium', desc: `${propMatches.length - effectMatches.length}个道具缺少效果标注` });
                }
            }
            return { hasMechanicViz: propMatches.length > 0, propCount: propMatches.length, issues };
        },

        progressTracking(content, styleProfile) {
            if (!content) return { hasProgressTracking: false, issues: [] };
            const issues = [];
            const TERMINAL_PATTERN = /\[权限终端\]/g;
            const FRAGMENT_PATTERN = /认知碎片进度[：:]\s*\d+\/\d+/g;
            const ANCHOR_PATTERN = /理智锚点[：:]\s*\d+%/g;
            const terminalMatches = content.match(TERMINAL_PATTERN) || [];
            const fragmentMatches = content.match(FRAGMENT_PATTERN) || [];
            const anchorMatches = content.match(ANCHOR_PATTERN) || [];
            const RULE_INTERACTION_PATTERNS = [/规则交互/g, /权限.*激活/g, /破局/g, /代价.*支付/g];
            let ruleInteractionCount = 0;
            for (const p of RULE_INTERACTION_PATTERNS) {
                const m = content.match(new RegExp(p.source, 'g'));
                if (m) ruleInteractionCount += m.length;
            }
            if (ruleInteractionCount > 0 && terminalMatches.length === 0) {
                issues.push({ severity: 'high', desc: `存在规则交互但无[权限终端]状态提示，违反进度追踪铁律` });
            }
            if (fragmentMatches.length === 0) {
                issues.push({ severity: 'medium', desc: '缺少认知碎片进度标注' });
            }
            if (anchorMatches.length === 0) {
                issues.push({ severity: 'medium', desc: '缺少理智锚点数值标注' });
            }
            return { hasProgressTracking: terminalMatches.length > 0, terminalCount: terminalMatches.length, issues };
        },

        trustContract(content, styleProfile) {
            if (!content) return { hasTrustContract: false, issues: [] };
            const issues = [];
            const CONTRACT_PATTERN = /\[契约绑定\]/g;
            const ROLE_PATTERN = /(?:导航型|测试型|商人型|引导型|辅助型)/g;
            const COMPLEMENT_PATTERN = /互补条件[：:]/g;
            const PENALTY_PATTERN = /违约代价[：:]/g;
            const contractMatches = content.match(CONTRACT_PATTERN) || [];
            const roleMatches = content.match(ROLE_PATTERN) || [];
            const complementMatches = content.match(COMPLEMENT_PATTERN) || [];
            const penaltyMatches = content.match(PENALTY_PATTERN) || [];
            const COOPERATION_PATTERNS = [/合作/g, /联手/g, /结盟/g, /一起/g, /共同/g];
            let cooperationCount = 0;
            for (const p of COOPERATION_PATTERNS) {
                const m = content.match(new RegExp(p.source, 'g'));
                if (m) cooperationCount += m.length;
            }
            if (cooperationCount > 0 && contractMatches.length === 0) {
                issues.push({ severity: 'high', desc: `存在角色合作(${cooperationCount}处)但无[契约绑定]标记，违反信任契约铁律` });
            }
            if (contractMatches.length > 0) {
                if (roleMatches.length < contractMatches.length) {
                    issues.push({ severity: 'medium', desc: `${contractMatches.length - roleMatches.length}个契约缺少角色定位` });
                }
                if (complementMatches.length < contractMatches.length) {
                    issues.push({ severity: 'medium', desc: `${contractMatches.length - complementMatches.length}个契约缺少互补条件` });
                }
                if (penaltyMatches.length < contractMatches.length) {
                    issues.push({ severity: 'medium', desc: `${contractMatches.length - penaltyMatches.length}个契约缺少违约代价` });
                }
            }
            return { hasTrustContract: contractMatches.length > 0, contractCount: contractMatches.length, issues };
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
        }
    },

    interceptors: {
        firstReview(content, styleProfile) {
            if (!content) return { hardBlockIssues: [], warningIssues: [], hints: [] };
            const _self = this;
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];

            const perspectiveResult = _self.detectors.perspective(content);
            if (perspectiveResult.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: '上帝视角解说设定来源，违反都市玄幻视角规则', title: '视角越界' });
            }

            const slangResult = _self.detectors.modernSlang(content);
            if (slangResult.count > 5) {
                warningIssues.push({ severity: 'medium', description: `网络用语过多（${slangResult.count}处），影响阅读体验`, title: '网络用语超标' });
            }

            const cliffResult = _self.detectors.cliffhangerType(content, styleProfile);
            if (cliffResult.issues.length > 0) {
                const highIssues = cliffResult.issues.filter(i => i.severity === 'high');
                if (highIssues.length > 0) {
                    hardBlockIssues.push({ severity: 'high', description: `断章钩子违规：${highIssues.map(i => i.desc).join('；')}`, title: '断章钩子违规' });
                }
            }

            return { hardBlockIssues, warningIssues, hints };
        },
        secondReview(content, styleProfile) {
            if (!content) return { hardBlockIssues: [], warningIssues: [], hints: [] };
            const _self = this;
            const hardBlockIssues = [];
            const warningIssues = [];

            const perspectiveResult = _self.detectors.perspective(content);
            if (perspectiveResult.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: '上帝视角解说设定来源(复审)', title: '视角越界(复审)' });
            }

            return { hardBlockIssues, warningIssues, hints: [] };
        }
    }
};

module.exports = _self;
