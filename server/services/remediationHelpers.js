const { BASE_CONSTRAINT_PRESETS } = require('./prompts/constraintInjector');

function buildRemediationPrompt(project, genre, chapters, sampleText, reviewText) {
    return `你是一个小说流水线整改专家。根据评测意见，分析问题并生成精确的整改方案，每个整改项必须落实到具体的系统组件。

【项目信息】
名称：${project.name}
类型：${project.genre}
模式：${genre?.label || '长篇小说'}
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
3. constraint的content必须是约束ID（从以下可选：${Object.keys(BASE_CONSTRAINT_PRESETS).join(',')}）
4. material的content必须是JSON：{"type":"素材类型","name":"素材名","content":"详细内容"}
5. style-guidance的content必须是风格指导文本

注意：每个问题可能需要多个整改项，确保覆盖所有维度。整改内容必须具体可执行，不能是空话。`;
}

function parseRemediationResponse(responseText, reviewText) {
    try {
        const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0];
        return JSON.parse(jsonStr);
    } catch (_) {
        return {
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
}

async function executeRemediations(projectId, remediations, mode) {
    const { applyRemediation } = require('./remediationApplier');
    const executionLog = [];

    for (const rem of remediations) {
        try {
            const applyResult = await applyRemediation(projectId, rem, mode);
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
    return executionLog;
}

module.exports = {
    buildRemediationPrompt,
    parseRemediationResponse,
    executeRemediations
};
