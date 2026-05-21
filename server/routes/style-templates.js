const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const router = require('express').Router();
const llm = require('../services/llm');

const DEFAULT_STYLES = [
    {
        id: 'default-hotblood',
        name: '热血爽文',
        description: '节奏明快，爽感十足，适合升级流、争霸流',
        rules: {
            sentenceStyle: '多用短句和感叹句，节奏紧凑有力',
            paragraphStyle: '段落简短，每段2-4句，留白多',
            dialogueStyle: '对话简洁有力，少用长篇大论，多用反问和感叹',
            descriptionStyle: '场景描写点到为止，重点突出动作和冲击感',
            emotionStyle: '情绪外放，喜怒形于色，多用心理独白强化爽感',
            pacing: '快节奏，高潮密集，每章至少一个爽点',
            vocabulary: '多用力量感词汇：轰、爆、撕裂、碾压、碾压、震撼',
            forbidden: ['长篇景物描写', '冗长内心独白', '慢节奏铺垫超过500字', '配角视角超过30%']
        },
        example: '轰！一拳轰出，虚空震颤。叶尘嘴角微扬："就这点本事？"对方瞳孔骤缩——不可能！他明明已经是筑基巅峰！',
        tags: ['热血', '爽文', '快节奏']
    },
    {
        id: 'default-dark',
        name: '暗黑深沉',
        description: '氛围压抑，人性复杂，适合悬疑、末世、权谋',
        rules: {
            sentenceStyle: '长短句交错，用短句制造紧张感，长句渲染氛围',
            paragraphStyle: '段落中等长度，注重环境与心理的交织描写',
            dialogueStyle: '对话含蓄，话中有话，少说多暗示',
            descriptionStyle: '环境描写阴郁细腻，善用光影、天气暗示人物命运',
            emotionStyle: '内敛克制，情绪通过细节和行为暗示，不直白表达',
            pacing: '慢热递进，前期铺垫厚重，后期爆发凌厉',
            vocabulary: '多用阴暗冷冽词汇：阴影、沉默、冰冷、腐朽、深渊',
            forbidden: ['直白的情绪表达', '轻松幽默的对话', '过于正面的描写', '简单善恶二元']
        },
        example: '雨幕中，他站在那扇紧闭的门前，指尖触碰门锁——冰凉的金属传来一丝不属于雨水的温度。有人来过。他收回手，目光沉入更深的暗处。',
        tags: ['暗黑', '深沉', '悬疑']
    },
    {
        id: 'default-humor',
        name: '轻松幽默',
        description: '诙谐有趣，吐槽不断，适合都市、网游、日常',
        rules: {
            sentenceStyle: '口语化，善用反问、吐槽、自嘲',
            paragraphStyle: '段落活泼，善用破折号和省略号制造喜剧节奏',
            dialogueStyle: '对话为主，穿插内心吐槽，角色互动有趣',
            descriptionStyle: '描写简洁有趣，善用比喻和夸张',
            emotionStyle: '轻松为主，偶尔认真，反差萌',
            pacing: '轻松推进，笑点密集，偶尔认真',
            vocabulary: '多用网络用语和梗：离谱、绝了、离大谱、好家伙',
            forbidden: ['过于严肃的长篇描写', '沉重的心理独白', '血腥暴力细节', '过于复杂的权谋']
        },
        example: '"系统，你管这叫新手任务？"林风看着眼前三米高的史莱姆，嘴角抽搐。系统：【是的宿主，请加油哦~】——加油？这玩意儿比我房子还大好吗！',
        tags: ['幽默', '轻松', '吐槽']
    },
    {
        id: 'default-literary',
        name: '唯美文艺',
        description: '文笔优美，意境深远，适合古言、仙侠、言情',
        rules: {
            sentenceStyle: '善用排比、对偶，句式优美有韵律',
            paragraphStyle: '段落舒展，注重意境营造和画面感',
            dialogueStyle: '对话含蓄优美，善用诗词典故',
            descriptionStyle: '环境描写细腻如画，善用通感和意象',
            emotionStyle: '含蓄内敛，以景写情，留白多于直述',
            pacing: '舒缓有致，如流水行云，张弛有度',
            vocabulary: '多用雅致词汇：缱绻、蹁跹、潋滟、阑珊、浮生',
            forbidden: ['粗俗用语', '过于直白的表达', '网络用语', '暴力血腥描写']
        },
        example: '月色如水，倾泻在青石板路上。她提灯而行，裙裾蹁跹如蝶。那灯火映在她眸中，比天上的星子还要明亮几分。他立在廊下，看她渐行渐远，终是没说出那句——且留步。',
        tags: ['唯美', '文艺', '古风']
    },
    {
        id: 'default-hardcore',
        name: '硬核写实',
        description: '逻辑严密，细节扎实，适合科幻、军事、历史',
        rules: {
            sentenceStyle: '准确简洁，多用陈述句，少用修辞',
            paragraphStyle: '段落结构清晰，信息密度高',
            dialogueStyle: '对话专业简练，符合角色身份',
            descriptionStyle: '技术细节准确，数据支撑，逻辑自洽',
            emotionStyle: '克制理性，通过行为和选择展现内心',
            pacing: '稳扎稳打，每个设定都有据可查',
            vocabulary: '多用专业术语和精确描述：参数、阈值、矢量、协议',
            forbidden: ['模糊的描写', '不合理的设定', '感性过度的表达', '逻辑漏洞']
        },
        example: '反应堆温度已突破1200开尔文，距临界值还剩47秒。李明关闭了二号冷却回路，将全部功率转入磁约束系统。"足够了，"他盯着读数说道，"但只有一次机会。"',
        tags: ['硬核', '写实', '科幻']
    }
];

for (const style of DEFAULT_STYLES) {
    const existing = store.getItem('style-templates', style.id);
    if (!existing) {
        store.setItem('style-templates', style.id, { ...style, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
}

router.get('/templates', (req, res) => {
    const { tag } = req.query;
    let templates = store.listItems('style-templates');
    if (tag) templates = templates.filter(t => (t.tags || []).includes(tag));
    templates.sort((a, b) => (a.isDefault ? 0 : 1) - (b.isDefault ? 0 : 1));
    res.json(templates);
});

router.get('/templates/:id', (req, res) => {
    const t = store.getItem('style-templates', req.params.id);
    if (!t) return res.status(404).json({ error: 'Style template not found' });
    res.json(t);
});

router.post('/templates', async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const template = {
        id,
        name: req.body.name || 'Unnamed Style',
        description: req.body.description || '',
        rules: req.body.rules || {},
        example: req.body.example || '',
        tags: req.body.tags || [],
        isDefault: false,
        source: req.body.source || 'manual',
        sourceRef: req.body.sourceRef || '',
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('style-templates', id, template);
    res.status(201).json(template);
});

router.put('/templates/:id', async (req, res) => {
    const existing = store.getItem('style-templates', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Style template not found' });
    const updated = {
        ...existing,
        ...req.body,
        id: existing.id,
        isDefault: existing.isDefault,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
    };
    await store.setItem('style-templates', existing.id, updated);
    res.json(updated);
});

router.delete('/templates/:id', (req, res) => {
    const existing = store.getItem('style-templates', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Style template not found' });
    if (existing.isDefault) return res.status(400).json({ error: 'Cannot delete default template' });
    store.deleteItem('style-templates', existing.id);
    res.json({ success: true });
});

router.post('/import-direct', async (req, res) => {
    const { text, name, description, tags } = req.body;
    if (!text || text.length < 50) return res.status(400).json({ error: 'Text must be at least 50 characters' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required for direct import' });

    const id = uuidv4();
    const now = new Date().toISOString();
    const template = {
        id,
        name: name.trim(),
        description: description || `直接导入的风格文本（${text.length}字）`,
        rules: {},
        example: text.substring(0, 10000),
        tags: tags || ['导入文本'],
        isDefault: false,
        source: 'direct',
        sourceRef: '直接导入',
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('style-templates', id, template);
    res.status(201).json(template);
});

router.post('/analyze', async (req, res) => {
    const { text, name } = req.body;
    if (!text || text.length < 500) return res.status(400).json({ error: 'Text must be at least 500 characters' });

    try {
        const messages = [
            {
                role: 'system',
                content: `你是一个写作风格分析专家。请分析以下文本的写作风格，并输出JSON格式的风格模板。

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

重要：只输出JSON，不要输出其他文字。分析要精确到具体可执行的规则。`
            },
            {
                role: 'user',
                content: `请分析以下文本的写作风格：\n\n${text.substring(0, 8000)}`
            }
        ];

        const result = await llm.chat(messages, { maxTokens: 4096, temperature: 0.3 });
        const responseText = result.choices?.[0]?.message?.content || '';

        let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Failed to parse style analysis');
        const parsed = JSON.parse(jsonMatch[0]);

        const id = uuidv4();
        const now = new Date().toISOString();
        const template = {
            id,
            name: name || parsed.name || 'Analyzed Style',
            description: parsed.description || '',
            rules: parsed.rules || {},
            example: parsed.example || '',
            tags: parsed.tags || [],
            isDefault: false,
            source: 'analyze',
            sourceRef: name || '导入文本分析',
            createdAt: now,
            updatedAt: now
        };
        await store.setItem('style-templates', id, template);
        res.status(201).json(template);
    } catch (e) {
        console.error('[STYLE] Analyze error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/learn-from-chapter', async (req, res) => {
    const { projectId, chapterId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    try {
        let sampleText = '';
        if (chapterId) {
            const chapter = store.getItem('chapters', chapterId);
            if (!chapter || !chapter.content) return res.status(400).json({ error: 'Chapter has no content' });
            sampleText = chapter.content;
        } else {
            const chapters = store.queryItems('chapters', { projectId })
                .filter(c => c.status === 'approved' || c.status === 'material-updated')
                .sort((a, b) => b.chapterNumber - a.chapterNumber);
            const recent = chapters.slice(0, 3);
            if (recent.length === 0) return res.status(400).json({ error: 'No approved chapters to learn from' });
            sampleText = recent.map(c => c.content).join('\n\n');
        }

        if (sampleText.length < 500) return res.status(400).json({ error: 'Not enough text to analyze' });

        const project = store.getItem('projects', projectId);
        const existingStyle = project?.template?.style || '';

        const messages = [
            {
                role: 'system',
                content: `你是一个写作风格学习系统。请从以下已定稿的正文中学习写作风格，生成风格模板。

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

重要：只输出JSON。规则必须具体可执行，不能笼统。`
            },
            {
                role: 'user',
                content: `请从以下正文中学习写作风格：\n\n${sampleText.substring(0, 12000)}`
            }
        ];

        const result = await llm.chat(messages, { maxTokens: 4096, temperature: 0.3 });
        const responseText = result.choices?.[0]?.message?.content || '';

        let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Failed to parse style learning result');
        const parsed = JSON.parse(jsonMatch[0]);

        const id = uuidv4();
        const now = new Date().toISOString();
        const template = {
            id,
            name: parsed.name || `${project?.name || 'Project'}风格`,
            description: parsed.description || '',
            rules: parsed.rules || {},
            example: parsed.example || '',
            tags: [...(parsed.tags || []), 'auto-learned'],
            isDefault: false,
            source: 'learn',
            sourceRef: project?.name || projectId,
            createdAt: now,
            updatedAt: now
        };
        await store.setItem('style-templates', id, template);

        if (project) {
            project.styleTemplateId = id;
            project.updatedAt = now;
            await store.setItem('projects', project.id, project);
        }

        res.status(201).json(template);
    } catch (e) {
        console.error('[STYLE] Learn error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/apply-to-project', async (req, res) => {
    const { projectId, templateId } = req.body;
    if (!projectId || !templateId) return res.status(400).json({ error: 'projectId and templateId required' });

    const project = store.getItem('projects', projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const template = store.getItem('style-templates', templateId);
    if (!template) return res.status(404).json({ error: 'Style template not found' });

    project.styleTemplateId = templateId;
    project.updatedAt = new Date().toISOString();
    await store.setItem('projects', project.id, project);

    res.json({ success: true, templateName: template.name });
});

module.exports = router;
