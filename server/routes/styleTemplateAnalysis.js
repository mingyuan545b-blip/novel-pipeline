const { v4: uuidv4 } = require('uuid');
const logger = require('../shared/logger');
const store = require('../store');
const llm = require('../services/llm');
const router = require('express').Router();
const { ERROR_CODES } = require('../shared/errorCodes');
const { STATUS_VALUES } = require('../services/chapterStatus');

const { VALIDATION_ERROR, INTERNAL_ERROR } = ERROR_CODES;

const STYLE_ANALYSIS_PROMPT = `你是一个写作风格分析专家。请分析以下文本的写作风格，并输出JSON格式的风格模板。

输出格式：
{
  "name": "风格名称",
  "description": "风格描述（50字以内）",
  "rules": {
    "sentenceStyle": "句式特点描述",
    "paragraphStyle": "段落特点描述",
    "dialogueStyle": "对话特点描述",
    "descriptionStyle": "描写特点描述",
    "emotionStyle": "情感表达特点描述",
    "pacing": "节奏特点描述",
    "vocabulary": "常用词汇风格描述",
    "forbidden": ["应避免的写法1", "应避免的写法2"]
  },
  "example": "模仿该风格写一段50字以内的示例",
  "tags": ["标签1", "标签2"]
}

重要：只输出JSON，不要输出其他文字。分析要精确到具体可执行的规则。`;

function parseLlmStyleResponse(responseText) {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse style analysis');
    return JSON.parse(jsonMatch[0]);
}

router.post('/analyze', async (req, res) => {
    const { text, name } = req.body;
    if (!text || text.length < 500) return res.apiError(VALIDATION_ERROR.statusCode, 'Text must be at least 500 characters', VALIDATION_ERROR.code);

    try {
        const messages = [
            { role: 'system', content: STYLE_ANALYSIS_PROMPT },
            { role: 'user', content: `请分析以下文本的写作风格：\n\n${text.substring(0, 8000)}` }
        ];

        const result = await llm.chat(messages, { maxTokens: 4096, temperature: 0.3 });
        const responseText = result.choices?.[0]?.message?.content || '';
        const parsed = parseLlmStyleResponse(responseText);

        const id = uuidv4();
        const now = new Date().toISOString();
        const template = {
            id, name: name || parsed.name || 'Analyzed Style',
            description: parsed.description || '', rules: parsed.rules || {},
            example: parsed.example || '', tags: parsed.tags || [],
            isDefault: false, source: 'analyze',
            sourceRef: name || '导入文本分析', createdAt: now, updatedAt: now
        };
        await store.setItem('style-templates', id, template);
        res.apiOk(template, null, 201);
    } catch (e) {
        logger.error('style-templates', '[STYLE] Analyze error:', e.message);
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/learn-from-chapter', async (req, res) => {
    const { projectId, chapterId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId required', VALIDATION_ERROR.code);

    try {
        let sampleText = '';
        if (chapterId) {
            const chapter = await store.getItem('chapters', chapterId);
            if (!chapter || !chapter.content) return res.apiError(VALIDATION_ERROR.statusCode, 'Chapter has no content', VALIDATION_ERROR.code);
            sampleText = chapter.content;
        } else {
            const chapters = (await store.queryItems('chapters', { projectId }))
                .filter(c => c.status === STATUS_VALUES.APPROVED || c.status === STATUS_VALUES.MATERIAL_UPDATED)
                .sort((a, b) => b.chapterNumber - a.chapterNumber);
            const recent = chapters.slice(0, 3);
            if (recent.length === 0) return res.apiError(VALIDATION_ERROR.statusCode, 'No approved chapters to learn from', VALIDATION_ERROR.code);
            sampleText = recent.map(c => c.content).join('\n\n');
        }

        if (sampleText.length < 500) return res.apiError(VALIDATION_ERROR.statusCode, 'Not enough text to analyze', VALIDATION_ERROR.code);

        const project = await store.getItem('projects', projectId);
        const existingStyle = project?.template?.style || '';

        const learnPrompt = `你是一个写作风格学习系统。请从以下已定稿的正文中学习写作风格，生成风格模板。

${existingStyle ? `当前项目声明的风格方向：${existingStyle}\n请在分析中参考这个方向。` : ''}

输出格式：
{
  "name": "风格名称（基于项目名）",
  "description": "风格描述",
  "rules": {
    "sentenceStyle": "句式特点（具体到长度、节奏、常用句式）",
    "paragraphStyle": "段落特点（长度、结构、留白习惯）",
    "dialogueStyle": "对话特点（比例、风格、常用表达）",
    "descriptionStyle": "描写特点（侧重、手法、细节程度）",
    "emotionStyle": "情感表达特点（内敛/外放、手法）",
    "pacing": "节奏特点（快慢分布、高潮频率）",
    "vocabulary": "词汇风格（常用词、修辞手法、禁忌词）",
    "forbidden": ["严格禁止的写法"]
  },
  "example": "模仿该风格写一段80字示例",
  "tags": ["标签1", "标签2"]
}

重要：只输出JSON。规则必须具体可执行，不能笼统。`;

        const messages = [
            { role: 'system', content: learnPrompt },
            { role: 'user', content: `请从以下正文中学习写作风格：\n\n${sampleText.substring(0, 12000)}` }
        ];

        const result = await llm.chat(messages, { maxTokens: 4096, temperature: 0.3 });
        const responseText = result.choices?.[0]?.message?.content || '';
        const parsed = parseLlmStyleResponse(responseText);

        const id = uuidv4();
        const now = new Date().toISOString();
        const template = {
            id, name: parsed.name || `${project?.name || 'Project'}风格`,
            description: parsed.description || '', rules: parsed.rules || {},
            example: parsed.example || '', tags: [...(parsed.tags || []), 'auto-learned'],
            isDefault: false, source: 'learn',
            sourceRef: project?.name || projectId, createdAt: now, updatedAt: now
        };
        await store.setItem('style-templates', id, template);

        if (project) {
            project.styleTemplateId = id;
            project.updatedAt = now;
            await store.setItem('projects', project.id, project);
        }

        res.apiOk(template, null, 201);
    } catch (e) {
        logger.error('style-templates', '[STYLE] Learn error:', e.message);
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
