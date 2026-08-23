const fs = require('fs');
const path = require('path');
const logger = require('../../shared/logger');

function parseMarkdownOutlines(text) {
    const outlines = [];
    const chapterRegex = /(?:第|Chapter\s*)(\d+)\s*章[：:]\s*(.+)/g;
    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
        const chapterNumber = parseInt(match[1]);
        const title = match[2].trim();
        const afterMatch = text.substring(match.index + match[0].length);
        const nextChapter = afterMatch.search(/(?:第|Chapter\s*)\d+\s*章/);
        const outlineText = nextChapter > 0 ? afterMatch.substring(0, nextChapter) : afterMatch;
        const cleanedOutline = outlineText
            .replace(/^[\s\n]*\*{1,2}[^*]+\*{1,2}[\s\n]*/gm, '')
            .replace(/^#{1,4}\s+.+$/gm, '')
            .replace(/^---+$/gm, '')
            .trim();
        if (cleanedOutline.length > 20) {
            outlines.push({
                chapterNumber,
                title,
                outline: cleanedOutline.substring(0, 800)
            });
        }
    }
    if (outlines.length === 0) {
        const sectionRegex = /###?\s*(?:第|Chapter\s*)(\d+)\s*章[：:]*\s*(.*)/g;
        while ((match = sectionRegex.exec(text)) !== null) {
            const chapterNumber = parseInt(match[1]);
            const title = match[2].trim() || `第${chapterNumber}章`;
            const afterMatch = text.substring(match.index + match[0].length);
            const nextSection = afterMatch.search(/###?\s*(?:第|Chapter\s*)\d+/);
            const outlineText = nextSection > 0 ? afterMatch.substring(0, nextSection) : afterMatch;
            const cleanedOutline = outlineText.trim();
            if (cleanedOutline.length > 20) {
                outlines.push({
                    chapterNumber,
                    title,
                    outline: cleanedOutline.substring(0, 800)
                });
            }
        }
    }
    logger.info('outlineFormatter', '[PIPELINE] parseMarkdownOutlines: extracted {outlinesLength} chapters from Markdown', { outlinesLength: outlines.length });
    return outlines;
}

function cleanJsonArrayResponse(responseText) {
    let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }
    let safeJson = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    safeJson = safeJson.replace(/,\s*([}\]])/g, '$1');
    safeJson = safeJson.replace(/\/\/[^\n]*/g, '');
    safeJson = safeJson.replace(/\/\*[\s\S]*?\*\//g, '');
    return safeJson;
}

function buildMaterialSummary(filteredMaterials, currentVolumeSubplane) {
    let summary = filteredMaterials.map(m => {
        let prefix = `[${m.type}] ${m.name}`;
        if (m.type === 'character' || m.type === 'faction') {
            if (m.parentPlane === '主世界' || !m.parentPlane) {
                prefix += ' [主世界]';
            } else if (currentVolumeSubplane && (m.parentPlane === currentVolumeSubplane.id || m.parentPlane === currentVolumeSubplane.name)) {
                prefix += ` [${currentVolumeSubplane.name}]`;
            }
        }
        return `${prefix}: ${(m.currentContent || '').substring(0, 150)}`;
    }).join('\n');
    if (summary.length > 6000) {
        summary = summary.substring(0, 6000) + '\n...(素材过长已截断】';
    }
    return summary;
}

function loadOutlineChecklist() {
    try {
        const checklistPath = path.join(__dirname, '..', '..', '..', 'data', 'subplanes', 'outline-checklist.json');
        const checklistData = JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
        if (checklistData.checklist) {
            let section = '\n【📋 大纲生成指引清单 - 必须逐项对照，生成后自检打标】\n';
            section += '序号 | 指引项 | 规则要点 | 必须? | 自检\n';
            section += '---|---|---|---|---\n';
            for (const item of checklistData.checklist) {
                const req = item.required ? '🔴必须' : '🟡建议';
                section += `${item.order} | ${item.name} | ${item.rule.substring(0, 40)} | ${req} | ✓\n`;
            }
            section += '\n生成大纲后，请在每个outline末尾用【✓X标记】标注你对照了哪些指引项。格式：[✓1✓2✓3✓4✓5✓6✓7✓8✓10✓11✓12✓13✓14✓15]（数字=已遵循的指引序号，X=未遵循）\n';
            return section;
        }
    } catch (e) {
        logger.debug('outlineFormatter', 'Failed to load outline checklist', { error: e.message });
    }
    return '';
}

function buildChapterOutlineSystemPrompt(config) {
    const { genreSection, volumeRhythmGuidance, checklistSection, targetChapters, titleRule, pacingRule, constraintRule } = config;
    return {
        role: 'system',
        content: `你是一个JSON生成器。你的唯一输出格式是JSON数组，禁止输出Markdown、标题、说明文字等任何非JSON内容。

【输出格式 - 最高优先级】
直接输出以下格式的JSON数组，不要包含任何其他文字、Markdown标题、代码块标记：
[
  {"chapterNumber": 1, "title": "章节标题", "outline": "章节大纲200-500字"},
  {"chapterNumber": 2, "title": "章节标题", "outline": "章节大纲200-500字"}
]

🔴 如果你输出了任何非JSON内容（如Markdown标题#、说明文字、代码块标记），系统将无法解析，大纲会被直接丢弃！

【重要：标题命名规则 - 必须遵守】
${titleRule || '章节标题要有画面感和吸引力，让读者一看就想点进来'}

【重要：大纲节奏规则 - 必须遵守】
${pacingRule || '- 每章必须有明确的剧情推进\n- 章末必须有钩子或悬念'}
${constraintRule ? '\n【题材约束 - 必须遵守】\n' + constraintRule : ''}
- 每章大纲必须有明确的剧情推进（不能一整章在描写和心理活动里打转）
- 章末必须有钩子或悬念，让读者想继续看下一章

【重要：信息释放节奏】
大纲最忌讳"第1章就把什么都说明白"。读者要的是"跟着主角一起发现、一起恍然大悟"的过程。
1. 每章只给1-2个新信息碎片，让读者和主角一起拼图
2. 展示代替告知——大纲里要写主角看到了什么、感受到了什么、自己得出了什么结论
3. 禁止总结式旁白——不要替读者归纳设定

配角戏份：不用每章都有配角，但偶尔给配角高光时刻，情感线自然推进。
${volumeRhythmGuidance}
${genreSection}
${checklistSection}
重要：只输出JSON数组，不要输出其他任何文字。

输出JSON数组格式：
[
  {
    "chapterNumber": 1,
    "title": "章节标题",
    "outline": "章节大纲：200-500字，包含场景、人物、事件、伏笔安排"
  }
]

请生成${targetChapters}章的大纲。`
    };
}

module.exports = { parseMarkdownOutlines, cleanJsonArrayResponse, buildMaterialSummary, loadOutlineChecklist, buildChapterOutlineSystemPrompt };
