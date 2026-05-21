const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const llm = require('../services/llm');
const pipeline = require('./pipeline');

const WORKSHOP_DIR = path.join(__dirname, '..', '..', 'output', 'workshop');

function ensureWorkshopDir(subDir) {
    const dir = path.join(WORKSHOP_DIR, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function callWithRetry(messages, options, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await llm.chat(messages, options);
        } catch (error) {
            const isTimeout = error.message.includes('超时') || error.message.includes('timeout');
            const isServerError = error.message.includes('500') || error.message.includes('502') || error.message.includes('503');
            if ((isTimeout || isServerError) && attempt < retries) {
                console.log(`[WORKSHOP] Retry attempt ${attempt + 1}/${retries} after error: ${error.message}`);
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }
            throw error;
        }
    }
}

function stripThinkTags(text) {
    if (!text) return text;
    const thinkEnd = text.indexOf('</think');
    if (thinkEnd !== -1) {
        const afterThink = text.substring(thinkEnd);
        const closeTag = afterThink.indexOf('>');
        if (closeTag !== -1) {
            return afterThink.substring(closeTag + 1).trim();
        }
    }
    return text;
}

function parseJsonFromResponse(responseText) {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error('No JSON found in response');
}

async function generateMaterials(projectId, settingText, project) {
    return pipeline.generateInitialMaterials(projectId, `【设定文本】\n${settingText}`);
}

async function generateOutlines(projectId, settingText, project, chapterCount = 10) {
    return pipeline.generateChapterOutlines(projectId, `【设定文本】\n${settingText}\n\n请生成${chapterCount}章大纲。`);
}

async function importSettingAndGenerate(projectId, settingText, options = {}) {
    const project = store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const { generateMaterials = true, generateOutlines = true, chapterCount = 10 } = options;

    if (settingText.length > 20000) {
        settingText = settingText.substring(0, 20000) + '\n...(内容过长已截断)';
    }

    const dir = ensureWorkshopDir(projectId);
    const settingFile = path.join(dir, 'imported-setting.txt');
    fs.writeFileSync(settingFile, settingText, 'utf-8');

    let materialsResult = null;
    let outlinesResult = null;

    if (generateMaterials) {
        try {
            materialsResult = await generateMaterials(projectId, settingText, project);
        } catch (error) {
            console.error('[WORKSHOP] Materials generation failed:', error.message);
            materialsResult = { created: [], count: 0, error: error.message };
        }
    }

    if (generateOutlines) {
        try {
            outlinesResult = await generateOutlines(projectId, settingText, project, chapterCount);
        } catch (error) {
            console.error('[WORKSHOP] Outlines generation failed:', error.message);
            outlinesResult = { created: [], count: 0, error: error.message };
        }
    }

    return {
        materials: materialsResult,
        outlines: outlinesResult,
        settingFile
    };
}

async function fuseNovels(novelTexts, options = {}) {
    const { extractTechniques = true, extractElements = true, fusionAnalysis = true } = options;

    const dir = ensureWorkshopDir('fusion');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (let i = 0; i < novelTexts.length; i++) {
        const novelFile = path.join(dir, `novel-${i + 1}-${timestamp}.txt`);
        const content = novelTexts[i].length > 30000 ? novelTexts[i].substring(0, 30000) : novelTexts[i];
        fs.writeFileSync(novelFile, content, 'utf-8');
    }

    const summaries = novelTexts.map((text, i) => {
        const preview = text.substring(0, 2000);
        return `=== 小说${i + 1} ===\n${preview}`;
    }).join('\n\n');

    const fullText = novelTexts.map((text, i) => {
        const truncated = text.length > 15000 ? text.substring(0, 15000) + '...(截断)' : text;
        return `=== 小说${i + 1} ===\n${truncated}`;
    }).join('\n\n');

    const results = {};

    if (extractTechniques) {
        console.log('[WORKSHOP] Extracting writing techniques');
        const messages = [
            {
                role: 'system',
                content: `你是文学分析师。从多本小说中提炼写作手法。

分析：叙事手法、节奏控制、人物塑造、场景描写、语言风格、结构技巧、情感操控

输出JSON：
{"techniques":[{"category":"类别","name":"手法名","description":"描述","examples":["示例1"],"applicability":"适用场景"}],"styleSummary":"风格总结","commonPatterns":["共同模式"],"uniqueTricks":["独门技巧"]}`
            },
            {
                role: 'user',
                content: `分析以下${novelTexts.length}本小说的写作手法：\n\n${fullText.substring(0, 40000)}`
            }
        ];

        try {
            const result = await callWithRetry(messages, { temperature: 0.5, maxTokens: 4096 });
            const responseText = stripThinkTags(result.choices?.[0]?.message?.content || '');
            const techFile = path.join(dir, `techniques-${timestamp}.json`);
            fs.writeFileSync(techFile, responseText, 'utf-8');
            results.techniques = parseJsonFromResponse(responseText);
        } catch (e) {
            console.error('[WORKSHOP] Techniques extraction failed:', e.message);
            results.techniques = { error: e.message };
        }
    }

    if (extractElements) {
        console.log('[WORKSHOP] Extracting writing elements');
        const messages = [
            {
                role: 'system',
                content: `你是小说元素分析师。从多本小说中提炼可复用的写作元素。

分析：世界观模板、人物原型、情节模式、设定元素、情感元素、伏笔类型、对话模板

输出JSON：
{"elements":[{"category":"类别","name":"元素名","description":"描述","sourceNovel":"来源编号","reusability":"复用性","variants":["变体"]}],"elementSummary":"总结","crossNovelPatterns":["跨小说模式"],"recommendedCombinations":["推荐组合"]}`
            },
            {
                role: 'user',
                content: `分析以下${novelTexts.length}本小说的写作元素：\n\n${fullText.substring(0, 40000)}`
            }
        ];

        try {
            const result = await callWithRetry(messages, { temperature: 0.5, maxTokens: 4096 });
            const responseText = stripThinkTags(result.choices?.[0]?.message?.content || '');
            const elemFile = path.join(dir, `elements-${timestamp}.json`);
            fs.writeFileSync(elemFile, responseText, 'utf-8');
            results.elements = parseJsonFromResponse(responseText);
        } catch (e) {
            console.error('[WORKSHOP] Elements extraction failed:', e.message);
            results.elements = { error: e.message };
        }
    }

    if (fusionAnalysis) {
        console.log('[WORKSHOP] Performing fusion analysis');
        const messages = [
            {
                role: 'system',
                content: `你是小说融合分析师。分析多本小说如何融合创造新方案。

输出JSON：
{"novelStrengths":[{"novelIndex":1,"strengths":["优势"],"uniqueValue":"独特价值"}],"fusionStrategy":{"coreIdea":"核心理念","styleBlend":"风格融合","elementCombination":"元素组合","structureDesign":"结构设计"},"writingPlan":{"recommendedGenre":"推荐类型","targetAudience":"目标读者","keySellingPoints":["卖点"],"openingStrategy":"开篇策略"},"innovationPoints":["创新点"]}`
            },
            {
                role: 'user',
                content: `融合分析以下${novelTexts.length}本小说：\n\n${summaries}\n\n详细：\n${fullText.substring(0, 30000)}`
            }
        ];

        try {
            const result = await callWithRetry(messages, { temperature: 0.7, maxTokens: 4096 });
            const responseText = stripThinkTags(result.choices?.[0]?.message?.content || '');
            const fusionFile = path.join(dir, `fusion-${timestamp}.json`);
            fs.writeFileSync(fusionFile, responseText, 'utf-8');
            results.fusion = parseJsonFromResponse(responseText);
        } catch (e) {
            console.error('[WORKSHOP] Fusion analysis failed:', e.message);
            results.fusion = { error: e.message };
        }
    }

    results.outputDir = dir;
    results.novelCount = novelTexts.length;
    results.timestamp = timestamp;
    return results;
}

module.exports = {
    importSettingAndGenerate,
    generateMaterials,
    generateOutlines,
    fuseNovels
};
