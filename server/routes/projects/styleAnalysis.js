/**
 * styleAnalysis - 风格分析核心逻辑
 */
const store = require('../../store');
const llm = require('../../services/llm');
const { DEFAULT_MODEL } = require('../../config/modelResolver');
const { PROVIDER_DEFAULTS } = require('../../config/systemConfig');

function buildStyleAnalysisPrompt(sampleText, suggestion) {
    return `你是一个顶级小说写作风格分析师。请根据用户的修改建议和已有章节内容，分析当前写作风格的优缺点，并生成精确的风格指导。

【用户修改建议】
${suggestion || '无具体建议，请全面分析'}

【近期章节样本】
${sampleText}

请严格按照以下JSON格式输出：
{
  "strengths": ["当前写作的优点1", "优点2", "优点3"],
  "weaknesses": ["需要改善的问题1", "问题2", "问题3"],
  "styleGuidance": "综合风格指导文本（200-400字）",
  "adjustmentPoints": ["具体调整点1", "调整点2", "调整点3"],
  "tone": "建议的情感基调",
  "pacingGuidance": "节奏建议",
  "dialogueGuidance": "对话建议",
  "descriptionGuidance": "描写建议"
}`;
}

function parseStyleResponse(responseText, suggestion) {
    let parsed;
    try {
        const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0];
        parsed = JSON.parse(jsonStr);
    } catch (_) {
        parsed = {
            strengths: ['已有章节内容完整'], weaknesses: ['需要根据建议调整'],
            styleGuidance: responseText.substring(0, 500),
            adjustmentPoints: [suggestion || '按建议调整'],
            tone: '', pacingGuidance: '', dialogueGuidance: '', descriptionGuidance: ''
        };
    }
    return parsed;
}

function formatStyleGuidance(parsed, suggestion) {
    return `【风格指导 - 基于修改建议生成】

✅ 必须保持的优点：
${parsed.strengths.map(s => `· ${s}`).join('\n')}

⚠ 需要改善的方向：
${parsed.weaknesses.map(w => `· ${w}`).join('\n')}

🎯 具体调整要点：
${parsed.adjustmentPoints.map(a => `· ${a}`).join('\n')}

📝 综合写作指导：
${parsed.styleGuidance}
${parsed.tone ? `\n🎭 情感基调：${parsed.tone}` : ''}${parsed.pacingGuidance ? `\n⏱ 节奏建议：${parsed.pacingGuidance}` : ''}${parsed.dialogueGuidance ? `\n💬 对话建议：${parsed.dialogueGuidance}` : ''}${parsed.descriptionGuidance ? `\n🎨 描写建议：${parsed.descriptionGuidance}` : ''}

【原始修改建议】${suggestion || '无'}`;
}

async function analyzeStyle(projectId, suggestion) {
    const chapters = (await store.queryItems('chapters', { projectId }))
        .filter(ch => ch.content)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

    if (chapters.length === 0) throw new Error('没有已完成的章节可供分析');

    const sampleChapters = chapters.slice(-5);
    const sampleText = sampleChapters.map(ch =>
        `【第${ch.chapterNumber}章 ${ch.title}】\n${ch.content.substring(0, 1500)}`
    ).join('\n\n');

    const apiConfig = {
        provider: process.env.LLM_PROVIDER || PROVIDER_DEFAULTS.DEFAULT_PROVIDER,
        model: process.env.LLM_MODEL || DEFAULT_MODEL,
        temperature: 0.3
    };

    const prompt = buildStyleAnalysisPrompt(sampleText, suggestion);
    const result = await llm.chat(
        [{ role: 'system', content: '你是顶级小说写作风格分析师，只输出JSON。' }, { role: 'user', content: prompt }],
        { maxTokens: 4096, temperature: 0.3, apiConfig }
    );
    const responseText = result.choices?.[0]?.message?.content || result.response || '';
    const parsed = parseStyleResponse(responseText, suggestion);
    const fullGuidance = formatStyleGuidance(parsed, suggestion);

    return { fullGuidance, analysis: parsed };
}

module.exports = { analyzeStyle };
