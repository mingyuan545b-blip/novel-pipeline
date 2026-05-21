const store = require('../store');
const { AGENT_PROMPTS, SHUANGWEN_AGENT_PROMPTS, CONSTRAINT_PRESETS, buildConstraintInjection } = require('./agentPrompts');
const llm = require('./llm');

const REMEDIATION_TARGETS = {
    'opening-hook': {
        label: '开头钩子',
        targets: ['writer-prompt', 'constraint', 'first-chapter-rule'],
        description: '开头3秒法则：第1章前3句必须有冲突/危机/悬念'
    },
    'chapter-hook': {
        label: '章末钩子',
        targets: ['writer-prompt', 'constraint', 'content-utils'],
        description: '每章结尾必须有钩子，让读者必须点下一章'
    },
    'cool-points': {
        label: '爽点密度',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '每章必须有爽点，打脸/碾压/升级/获宝不能一笔带过'
    },
    'character-voice': {
        label: '人物区分度',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '每个角色说话方式必须有区分度，不能千篇一律'
    },
    'logic-flaw': {
        label: '逻辑合理性',
        targets: ['constraint', 'review-prompt', 'material'],
        description: '情节推进必须有逻辑铺垫，不能强行发生'
    },
    'pacing': {
        label: '节奏控制',
        targets: ['writer-prompt', 'constraint'],
        description: '节奏不能拖沓，不能连续2段没有剧情推进'
    },
    'emotion': {
        label: '情绪调动',
        targets: ['writer-prompt', 'review-prompt'],
        description: '关键场景必须有情绪爆发，不能平淡带过'
    },
    'show-not-tell': {
        label: '展示而非告知',
        targets: ['writer-prompt', 'review-prompt'],
        description: '用场景和动作展示，不要用旁白告知'
    },
    'protagonist-proactive': {
        label: '主角主动性',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '主角必须主动发起行动和决策，不能只被动应对。每章至少1次主动行为'
    },
    'concrete-villain': {
        label: '具象反派',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '必须有持续在线的具象化反派，每章给主角施压，让读者恨得牙痒痒'
    },
    'conflict-first': {
        label: '冲突前置',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '前300字必须有冲突/爽点/钩子（15秒法则），禁止前半段大段铺垫'
    },
    'vivid-combat': {
        label: '画面战斗',
        targets: ['writer-prompt', 'review-prompt'],
        description: '战斗必须有画面感：动作细节+感官冲击+代价反馈+高光时刻，禁止概念化描述'
    },
    'slow-burn-romance': {
        label: '渐进感情',
        targets: ['writer-prompt', 'review-prompt'],
        description: '感情线靠事件推动，敌对→合作→动摇→选择→并肩，禁止突兀告白/倒贴'
    },
    'madness-has-cost': {
        label: '疯魔有代价',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '疯魔/爆发状态必须有身体崩溃代价（呕吐/颤抖/灰色纹路扩散/短暂失明），禁止"爽完就没事"，能力使用后即时代价'
    },
    'anchor-mechanism': {
        label: '锚点机制',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '每个角色都有"锚"维持人性，锚动摇=人物危机，锚崩塌=灰化。使用能力消耗锚点，锚点归零=失去人性'
    },
    'bitter-humor': {
        label: '苦涩幽默',
        targets: ['writer-prompt', 'review-prompt'],
        description: '绝境中的冷笑话和苦涩调侃，幽默是防御机制不是性格标签，调侃背后是真实的恐惧和疲惫'
    },
    'stance-conflict': {
        label: '立场撕裂',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '没有绝对正邪只有立场碰撞，角色转变基于自己发现真相而非被感化，反派必须有自洽逻辑'
    },
    'spider-web-foreshadow': {
        label: '蛛网伏笔',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '伏笔如蛛网交织每条线连着另一条，禁止挖坑不填，禁止伏笔孤立存在，每条伏笔至少连接另一条'
    },
    'golden-quote-throttle': {
        label: '金句节流',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '同一金句/口号全书最多出现2次（陈默核心信条1次+系统提示音1次），其余全部替换为具象描写或角色个性化表达。苏婉清用审计术语，老周用账房隐喻，穆春生用体制黑话。金句脱离语境循环播放即从点睛之笔降级为机械口癖'
    },
    'alienation-tiered': {
        label: '异化分级描写',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '异化度/痛觉描写必须分级：1-5%感官错位（听觉延迟/触觉模糊/时间拉伸），6-15%逻辑代偿（判断机械化/微表情消失/记忆碎片闪回），>20%物理侵蚀（皮肤灰白纹路/指尖透明化/痛觉反向灼烧）。禁止每次越权都走同一套"灰白噪点+骨节痉挛"模板'
    },
    'system-warning-restraint': {
        label: '系统警告节制',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '【底层逻辑扰动0.7%】仅关键节点使用（遗址代码暴露/签名溯源/后门导出），日常用【逻辑延迟0.3秒】/【判定缓冲期】/【底层响应异常】替代。系统提示音分层：常规警告蓝框、越权预警黄框、人格覆写预备红框+低频嗡鸣。禁止全用同一句式刷屏'
    },
    'tactic-diversity': {
        label: '战术破局多元',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '破局方式必须多元化：环境利用（冷凝水导电短路/风沙掩蔽轨迹）、盟友配合（方远断刃符箓坏账共振）、规则反杀（主动暴露虚假记忆诱使系统过载）、非技术性抉择。禁止所有破局都靠《亡妻残卷》朱砂批注+逆向映射硬撬，清道夫是漏洞嫁接者不是残卷触发器'
    }
};

async function analyzeAndRemediate(projectId, reviewText, options = {}) {
    const project = store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const mode = project.mode || 'novel';
    const chapters = store.queryItems('chapters', { projectId })
        .filter(ch => ch.content)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

    const sampleText = chapters.slice(0, 3).map(ch =>
        `【第${ch.chapterNumber}章 ${ch.title} - 开头200字】\n${ch.content.substring(0, 200)}\n【第${ch.chapterNumber}章 - 结尾200字】\n${ch.content.substring(ch.content.length - 200)}`
    ).join('\n\n');

    const apiConfig = {
        provider: process.env.LLM_PROVIDER || 'minimax',
        model: process.env.LLM_MODEL || 'MiniMax-Text-01',
        temperature: 0.2
    };

    const analysisPrompt = `你是一个小说流水线整改专家。根据评测意见，分析问题并生成精确的整改方案，每个整改项必须落实到具体的系统组件。

【项目信息】
名称：${project.name}
类型：${project.genre}
模式：${mode === 'shuangwen' ? '爽文' : mode === 'tomato-short' ? '番茄爽文' : '长篇小说'}
已有章节：${chapters.length}章

【近期章节样本（开头+结尾）】
${sampleText || '暂无章节'}

【评测意见】
${reviewText}

请严格按照以下JSON格式输出整改方案：
{
  "problems": [
    {
      "id": "问题编号如p1",
      "title": "问题标题",
      "severity": "critical/high/medium",
      "description": "问题描述"
    }
  ],
  "remediations": [
    {
      "problemId": "对应问题编号",
      "target": "整改目标类型（writer-prompt/review-prompt/constraint/material/style-guidance）",
      "action": "具体整改动作描述",
      "content": "整改内容（将直接写入系统）",
      "priority": "critical/high/medium"
    }
  ]
}

【整改目标类型说明】
- writer-prompt: 修改执笔人提示词，追加写作规则
- review-prompt: 修改审核员提示词，增加检查维度
- constraint: 添加写作约束到项目
- material: 添加/更新素材（如人物语言风格卡）
- style-guidance: 更新风格指导

【整改内容要求】
1. writer-prompt的content必须是具体的写作规则，如"开头3句内必须出现冲突或悬念"
2. review-prompt的content必须是具体的检查标准，如"检查第1章前3句是否有冲突"
3. constraint的content必须是约束ID（从以下可选：${Object.keys(CONSTRAINT_PRESETS).join(',')}）
4. material的content必须是JSON：{"type":"素材类型","name":"素材名","content":"详细内容"}
5. style-guidance的content必须是风格指导文本

注意：每个问题可能需要多个整改项，确保覆盖所有维度。整改内容必须具体可执行，不能是空话。`;

    const result = await llm.chat(
        [{ role: 'system', content: '你是小说流水线整改专家，只输出JSON。' }, { role: 'user', content: analysisPrompt }],
        { maxTokens: 4096, temperature: 0.2, apiConfig }
    );
    const responseText = result.choices?.[0]?.message?.content || result.response || '';

    let parsed;
    try {
        const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0];
        parsed = JSON.parse(jsonStr);
    } catch (_) {
        parsed = {
            problems: [{ id: 'p1', title: '评测问题', severity: 'high', description: reviewText.substring(0, 200) }],
            remediations: [{
                problemId: 'p1',
                target: 'style-guidance',
                action: '将评测意见转为风格指导',
                content: reviewText,
                priority: 'high'
            }]
        };
    }

    const executionLog = [];
    const autoApply = options.autoApply !== false;

    if (autoApply) {
        for (const rem of parsed.remediations) {
            try {
                const applyResult = applyRemediation(projectId, rem, mode);
                executionLog.push({
                    target: rem.target,
                    action: rem.action,
                    status: 'applied',
                    detail: applyResult
                });
            } catch (e) {
                executionLog.push({
                    target: rem.target,
                    action: rem.action,
                    status: 'failed',
                    detail: e.message
                });
            }
        }
    }

    return {
        success: true,
        problems: parsed.problems,
        remediations: parsed.remediations,
        executionLog,
        autoApplied: autoApply
    };
}

function applyRemediation(projectId, remediation, mode) {
    const project = store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    switch (remediation.target) {
        case 'constraint': {
            const constraintId = remediation.content;
            if (!CONSTRAINT_PRESETS[constraintId]) throw new Error(`Unknown constraint: ${constraintId}`);
            if (!project.constraints) project.constraints = [];
            if (!project.constraints.includes(constraintId)) {
                project.constraints.push(constraintId);
                store.setItem('projects', projectId, project);
            }
            return `添加约束: ${CONSTRAINT_PRESETS[constraintId].label}`;
        }

        case 'material': {
            let matData;
            try {
                matData = typeof remediation.content === 'string' ? JSON.parse(remediation.content) : remediation.content;
            } catch (_) {
                matData = { type: 'other', name: remediation.action, content: String(remediation.content) };
            }
            const { v4: uuidv4 } = require('uuid');
            const matId = uuidv4();
            store.setItem('materials', matId, {
                id: matId,
                projectId,
                type: matData.type || 'other',
                name: matData.name || remediation.action,
                content: matData.content || '',
                archived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return `添加素材: ${matData.name} (${matData.type})`;
        }

        case 'style-guidance': {
            const existingGuidance = project.styleGuidance || '';
            const newGuidance = existingGuidance
                ? `${existingGuidance}\n\n【追加整改指导】\n${remediation.content}`
                : `【整改指导】\n${remediation.content}`;
            project.styleGuidance = newGuidance;
            project.styleGuidanceUpdatedAt = new Date().toISOString();
            store.setItem('projects', projectId, project);
            return '更新风格指导';
        }

        case 'writer-prompt': {
            const promptKey = 'writerPromptAdditions';
            if (!project[promptKey]) project[promptKey] = [];
            const MAX_RULES = 8;
            if (project[promptKey].length >= MAX_RULES) {
                console.warn(`[REMEDIATION] writer rules already at max (${MAX_RULES}), consolidating instead of adding`);
                project[promptKey] = consolidateRules(project[promptKey], remediation.content, MAX_RULES);
            } else if (!isRuleRedundant(project[promptKey], remediation.content)) {
                project[promptKey].push({
                    rule: remediation.content,
                    source: 'review-remediation',
                    addedAt: new Date().toISOString()
                });
            } else {
                console.log('[REMEDIATION] writer rule skipped as redundant');
            }
            store.setItem('projects', projectId, project);
            return `处理Writer规则: ${remediation.content.substring(0, 50)}...`;
        }

        case 'review-prompt': {
            const promptKey = 'reviewPromptAdditions';
            if (!project[promptKey]) project[promptKey] = [];
            const MAX_RULES = 6;
            if (project[promptKey].length >= MAX_RULES) {
                console.warn(`[REMEDIATION] review rules already at max (${MAX_RULES}), consolidating instead of adding`);
                project[promptKey] = consolidateRules(project[promptKey], remediation.content, MAX_RULES);
            } else if (!isRuleRedundant(project[promptKey], remediation.content)) {
                project[promptKey].push({
                    rule: remediation.content,
                    source: 'review-remediation',
                    addedAt: new Date().toISOString()
                });
            } else {
                console.log('[REMEDIATION] review rule skipped as redundant');
            }
            store.setItem('projects', projectId, project);
            return `处理Review规则: ${remediation.content.substring(0, 50)}...`;
        }

        default:
            throw new Error(`Unknown remediation target: ${remediation.target}`);
    }
}

function getWriterPromptInjection(projectId) {
    const project = store.getItem('projects', projectId);
    if (!project?.writerPromptAdditions?.length) return '';

    return '\n\n【专项写作规则 - 基于评测整改】\n' +
        project.writerPromptAdditions
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
}

function getReviewPromptInjection(projectId) {
    const project = store.getItem('projects', projectId);
    if (!project?.reviewPromptAdditions?.length) return '';

    return '\n\n【专项审核规则 - 基于评测整改】\n' +
        project.reviewPromptAdditions
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
}

function isRuleRedundant(existingRules, newRule) {
    const CONFLICT_PAIRS = [
        { a: /生物信号传导|网络共振|因果传导层/, b: /降维|感官隐喻|禁止.*术语|幼崽视角锁定/ },
        { a: /工程逻辑|曲线描述|严谨务实/, b: /具象比喻|感官化|降维映射/ }
    ];

    for (const existing of existingRules) {
        const existingLower = existing.rule.toLowerCase();
        const newLower = newRule.toLowerCase();

        const overlapKeywords = ['完整性', '悬空', '残缺', '闭环', '降维', '感官', '术语',
            '比喻', '轮换', '新鲜度', '视角', '幼崽', '重复', '粘贴', '查重'];
        let matchCount = 0;
        for (const kw of overlapKeywords) {
            if (existingLower.includes(kw) && newLower.includes(kw)) matchCount++;
        }
        if (matchCount >= 2) {
            console.log(`[REMEDIATION] Rule redundant: ${matchCount} keyword overlaps with existing rule`);
            return true;
        }

        for (const pair of CONFLICT_PAIRS) {
            if ((pair.a.test(existing.rule) && pair.b.test(newRule)) ||
                (pair.b.test(existing.rule) && pair.a.test(newRule))) {
                console.log('[REMEDIATION] Rule conflicts with existing rule - skipping to avoid contradiction');
                return true;
            }
        }
    }

    return false;
}

function consolidateRules(existingRules, newRule, maxRules) {
    const consolidated = [...existingRules];

    const TOPICS = [
        { keywords: ['完整性', '悬空', '残缺', '闭环', '语义'], label: '章节完整性' },
        { keywords: ['降维', '感官', '术语', '技术', '数据', '设备', '参数'], label: '科技降维' },
        { keywords: ['比喻', '轮换', '新鲜度', '意象'], label: '比喻新鲜度' },
        { keywords: ['视角', '幼崽', '认知', '旁白'], label: '视角一致性' },
        { keywords: ['重复', '粘贴', '查重', '循环'], label: '防重复' },
        { keywords: ['节奏', '过渡', '铺垫', '切换'], label: '节奏过渡' },
        { keywords: ['传导', '因果', '逻辑链'], label: '因果传导' }
    ];

    for (const topic of TOPICS) {
        const matching = consolidated.filter(r =>
            topic.keywords.some(kw => r.rule.toLowerCase().includes(kw))
        );
        if (matching.length >= 2) {
            const keepIdx = consolidated.indexOf(matching[0]);
            const merged = matching.map(r => r.rule).join('；');
            consolidated[keepIdx] = {
                rule: `【${topic.label}】${merged.replace(/【[^】]+】/g, '')}`,
                source: 'consolidated',
                addedAt: new Date().toISOString()
            };
            for (let i = matching.length - 1; i >= 1; i--) {
                consolidated.splice(consolidated.indexOf(matching[i]), 1);
            }
        }
    }

    if (consolidated.length < maxRules && !isRuleRedundant(consolidated, newRule)) {
        consolidated.push({
            rule: newRule,
            source: 'review-remediation',
            addedAt: new Date().toISOString()
        });
    }

    if (consolidated.length > maxRules) {
        consolidated.sort((a, b) => {
            const aTime = a.addedAt ? new Date(a.addedAt).getTime() : 0;
            const bTime = b.addedAt ? new Date(b.addedAt).getTime() : 0;
            return bTime - aTime;
        });
        consolidated.length = maxRules;
    }

    return consolidated;
}

module.exports = {
    REMEDIATION_TARGETS,
    analyzeAndRemediate,
    applyRemediation,
    getWriterPromptInjection,
    getReviewPromptInjection,
    isRuleRedundant,
    consolidateRules
};
