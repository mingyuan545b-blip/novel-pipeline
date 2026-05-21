const BASE_CONCEPT_REGISTRY = [
    {
        id: 'pov-lock',
        label: '视角锁定',
        keywords: ['第三人称有限视角', '限知视角'],
        threshold: 4,
        severity: 'high',
        fix: '保留模板中的精简版，移除风格配置中的重复版'
    },
    {
        id: 'word-count',
        label: '字数要求',
        keywords: ['字数要求', '字数硬性', '目标字数', '宁可多写', '最低字数', '字数纪律'],
        threshold: 4,
        severity: 'high',
        fix: '合并所有字数要求为一处，保留基座中的[WORD_LIMITS]和模板中的精简版'
    },
    {
        id: 'hook-chapter',
        label: '章末钩子',
        keywords: ['章末钩子', '章末悬念', '悬念钩子', '每章结尾必须设置悬念'],
        threshold: 3,
        severity: 'medium',
        fix: '保留约束注入或模板中的一处即可'
    },
    {
        id: 'show-not-tell',
        label: '展示代替告知',
        keywords: ['展示代替告知', '感官细节', '感官锚定', '非视觉感官'],
        threshold: 4,
        severity: 'medium',
        fix: '保留基座中的一处即可，不要在风格配置中重复'
    },
    {
        id: 'char-ref',
        label: '角色称呼',
        keywords: ['角色称呼', '称呼规范', '称呼表', '代词规则'],
        threshold: 3,
        severity: 'low',
        fix: '保留动态注入的角色称呼表，移除风格配置中的静态版'
    },
    {
        id: 'golden-finger',
        label: '金手指',
        keywords: ['金手指', '无意识溢出', '主动施法'],
        threshold: 3,
        severity: 'low',
        fix: '保留模板中的一处即可'
    }
];

const GENRE_CONCEPT_REGISTRIES = {
    baby: [
        {
            id: 'baby-pov-lock',
            label: '幼崽视角锁定',
            keywords: ['幼崽视角', '萌宝视角', '纯萌宝视角', '紧贴幼崽', '幼崽的第三人称'],
            threshold: 4,
            severity: 'high',
            fix: '保留模板中的精简版，移除风格配置中的重复版'
        },
        {
            id: 'baby-no-adult-inner',
            label: '禁成人内心',
            keywords: ['成人化内心独白', '成人内心', '权谋', '战略思考', '禁成人内心戏', '成人角色直接内心独白'],
            threshold: 3,
            severity: 'high',
            fix: '保留模板中的禁用词列表，移除风格配置中的重复描述'
        },
        {
            id: 'baby-tech-dedim',
            label: '科技降维',
            keywords: ['科技描写降维', '科技降维', '感官隐喻', '术语降维', '降维规则', '禁止直述术语'],
            threshold: 4,
            severity: 'high',
            fix: '保留模板中"1句话搞定"的精简版，移除详细例子版'
        },
        {
            id: 'baby-horror-ban',
            label: '恐怖禁用',
            keywords: ['恐怖', '克苏鲁', '恐怖意象', '恐怖隐喻', '禁用恐怖'],
            threshold: 4,
            severity: 'medium',
            fix: '保留模板中"禁恐怖/克苏鲁意象"即可，移除风格配置中的重复版'
        },
        {
            id: 'baby-tone-style',
            label: '文风基调',
            keywords: ['句子短', '段落短', '节奏流畅', '轻松治愈', '轻喜剧'],
            threshold: 4,
            severity: 'medium',
            fix: '保留模板中的精简版，移除风格配置中的重复版'
        },
        {
            id: 'baby-cute-first',
            label: '萌感优先',
            keywords: ['萌感优先', '萌感必须', '天真行为', '幼崽萌感行为'],
            threshold: 3,
            severity: 'low',
            fix: '保留约束注入中的一处即可'
        }
    ]
};

function getConceptRegistry(genreId) {
    const base = [...BASE_CONCEPT_REGISTRY];
    if (genreId && GENRE_CONCEPT_REGISTRIES[genreId]) {
        base.push(...GENRE_CONCEPT_REGISTRIES[genreId]);
    }
    return base;
}

const INFLATION_RULES = [
    { pattern: /【[^】]*】[^【]*【[^】]*】/g, desc: '嵌套标记块', severity: 'low' },
    { pattern: /最高优先级[^。！？\n]{0,5}[。！？\n]/g, desc: '"最高优先级"滥用', severity: 'medium', maxCount: 3 },
    { pattern: /极其重要[^。！？\n]{0,5}[。！？\n]/g, desc: '"极其重要"滥用', severity: 'medium', maxCount: 3 },
    { pattern: /必须遵守[^。！？\n]{0,5}[。！？\n]/g, desc: '"必须遵守"滥用', severity: 'low', maxCount: 5 },
    { pattern: /严禁[^。！？\n]{0,3}[。！？\n]/g, desc: '"严禁"滥用', severity: 'low', maxCount: 5 },
];

class PromptAuditor {
    constructor() {
        this.auditLog = [];
        this.lastAudit = null;
    }

    audit(systemPrompt, userPrompt, agentType, genreId) {
        const fullText = (systemPrompt || '') + '\n' + (userPrompt || '');
        const findings = [];
        let totalDuplicates = 0;
        let totalInflation = 0;

        const conceptRegistry = getConceptRegistry(genreId);

        for (const concept of conceptRegistry) {
            const hits = [];
            for (const kw of concept.keywords) {
                const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escaped, 'g');
                const matches = fullText.match(regex);
                if (matches) {
                    hits.push({ keyword: kw, count: matches.length });
                }
            }

            const totalCount = hits.reduce((s, h) => s + h.count, 0);
            if (totalCount >= concept.threshold) {
                totalDuplicates += totalCount - concept.threshold + 1;
                findings.push({
                    type: 'duplicate',
                    conceptId: concept.id,
                    label: concept.label,
                    severity: concept.severity,
                    hits,
                    totalCount,
                    excess: totalCount - concept.threshold + 1,
                    fix: concept.fix
                });
            }
        }

        for (const rule of INFLATION_RULES) {
            const matches = fullText.match(rule.pattern);
            const count = matches ? matches.length : 0;
            const maxCount = rule.maxCount || 2;
            if (count > maxCount) {
                totalInflation += count - maxCount;
                findings.push({
                    type: 'inflation',
                    desc: rule.desc,
                    severity: rule.severity,
                    count,
                    maxCount,
                    excess: count - maxCount,
                    fix: `减少"${rule.desc}"的使用次数，当前${count}次，建议≤${maxCount}次`
                });
            }
        }

        const systemLen = (systemPrompt || '').length;
        const userLen = (userPrompt || '').length;
        const totalLen = systemLen + userLen;

        let healthScore = 100;
        healthScore -= totalDuplicates * 3;
        healthScore -= totalInflation * 4;
        findings.filter(f => f.severity === 'high' && f.excess > 2).forEach(() => healthScore -= 5);
        healthScore = Math.max(0, Math.min(100, healthScore));

        const result = {
            agentType,
            timestamp: new Date().toISOString(),
            healthScore,
            systemLen,
            userLen,
            totalLen,
            duplicateConcepts: findings.filter(f => f.type === 'duplicate'),
            inflationIssues: findings.filter(f => f.type === 'inflation'),
            totalDuplicates,
            totalInflation,
            summary: healthScore >= 80 ? '✅ 约束词健康' :
                     healthScore >= 60 ? '⚠️ 约束词轻微膨胀' :
                     healthScore >= 40 ? '🔴 约束词严重膨胀' :
                     '🚨 约束词极度膨胀，需立即处理'
        };

        this.lastAudit = result;

        if (totalDuplicates > 0 || totalInflation > 0) {
            this.auditLog.push({
                ...result,
                systemLen,
                totalLen
            });
        }

        return result;
    }

    autoDeduplicate(systemPrompt, agentType) {
        let text = systemPrompt;
        let removed = 0;
        let saved = 0;

        const MARKER_BLOCKS = [
            { marker: '【科技描写降维规则】', endMarker: '无需降维', keepFirst: true },
            { marker: '【科技降维', endMarker: '成人语境中术语合理', keepFirst: true },
            { marker: '【角色称呼规范', endMarker: '产生歧义', keepFirst: true },
            { marker: '【视角铁律', endMarker: '每章', keepFirst: true },
        ];

        for (const block of MARKER_BLOCKS) {
            const regex = new RegExp(
                block.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                '[\\s\\S]*?' +
                block.endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                '[^\\n]*',
                'g'
            );
            const matches = [];
            let m;
            while ((m = regex.exec(text)) !== null) {
                matches.push({ match: m[0], index: m.index });
            }
            if (matches.length > 1) {
                for (let i = matches.length - 1; i >= (block.keepFirst ? 1 : 0); i--) {
                    text = text.substring(0, matches[i].index) + text.substring(matches[i].index + matches[i].match.length);
                    removed++;
                    saved += matches[i].match.length;
                }
            }
        }

        text = text.replace(/\n{3,}/g, '\n\n').trim();

        return { text, removed, saved };
    }

    getLastAudit() { return this.lastAudit; }

    getFullReport(projectId, mode) {
        const report = { projectId, mode, agents: {}, overall: { healthScore: 100, totalDuplicates: 0, totalInflation: 0, summary: '' } };

        try {
            const store = require('../store');
            const { buildFoundationPrompt, buildConstraintInjection, getAgentPrompt } = require('./agentPrompts');
            const { detectGenre, getStyleProfileForProject } = require('./genreConfig');

            const project = store.getItem('projects', projectId);
            const profile = project ? getStyleProfileForProject(projectId) : null;
            const genre = profile ? detectGenre(profile) : null;
            const genreId = genre?.id || null;

            const agents = ['writer', 'first-review', 'second-review', 'final-editor', 'reviser', 'polisher'];

            for (const agentType of agents) {
                try {
                    const agent = getAgentPrompt(agentType, mode, projectId);
                    if (!agent) continue;

                    const foundation = buildFoundationPrompt(agentType, mode, projectId);
                    const constraint = buildConstraintInjection(projectId);
                    const rawSystem = foundation + '\n\n' + (agent.system || '') + constraint;

                    const { deduplicateSystemPrompt } = require('./agentPrompts');
                    const systemPrompt = deduplicateSystemPrompt(rawSystem, agentType);

                    const audit = this.audit(systemPrompt, '', agentType, genreId);
                    report.agents[agentType] = audit;
                    report.overall.totalDuplicates += audit.totalDuplicates;
                    report.overall.totalInflation += audit.totalInflation;
                    report.overall.healthScore = Math.min(report.overall.healthScore, audit.healthScore);
                } catch (e) {
                    report.agents[agentType] = { error: e.message };
                }
            }
        } catch (e) {
            console.error(`[PROMPT-AUDIT] getFullReport error: ${e.message}`);
            report.overall.summary = `审计出错: ${e.message}`;
            return report;
        }

        report.overall.summary = report.overall.healthScore >= 80 ? '✅ 约束词健康' :
                                  report.overall.healthScore >= 60 ? '⚠️ 约束词轻微膨胀' :
                                  report.overall.healthScore >= 40 ? '🔴 约束词严重膨胀' :
                                  '🚨 约束词极度膨胀';
        return report;
    }
}

module.exports = new PromptAuditor();
