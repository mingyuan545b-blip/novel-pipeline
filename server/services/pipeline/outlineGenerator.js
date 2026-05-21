const store = require("../../store");
const llm = require("../../services/llm");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { getOutlineApiConfig } = require("./constants");
const { validateOutlineRhythm, buildGenreOutlineInjection } = require("./outlineHelpers");
const { buildVolumeRhythmGuidance, enforceVolumeSubplaneLocks, getVisibleMaterials, getVolumeSubplane } = require("./volumeHelpers");
const { getModeConfig } = require("../contentUtils");
const { CONSTRAINT_PRESETS } = require("../agentPrompts");

async function generateInitialMaterials(projectId, userPrompt) {
    const project = store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const messages = [
        {
            role: 'system',
            content: `你是一个小说素材库生成器。根据用户提供的小说需求和设定，生成完整的素材库。

请生成以下类型的素材，每个素材用JSON数组格式输出：
- worldview: 世界观设定（详细描述世界背景、规则、历史，至少300字）
- character: 主要人物卡（每个角色详细描述外貌、性格、能力、背景，至少200字/角色，可生成多个）
- equipment: 重要装备（描述名称、品级、能力、来源，至少150字/件）
- relationship: 人物关系（描述角色间的关系和羁绊，至少200字）
- power-system: 战力体系（详细描述等级划分、突破条件、能力特征，至少300字）
- catchphrase: 金句/热梗（创造3-5个经典台词或网络梗）
- famous-scene: 名场面（描述2-3个高光剧情场景，至少150字/场景）
- growth-history: 成长史（描述主角成长路线，至少300字）
- foreshadowing: 伏笔设计（设计3-5个伏笔，描述埋设和回收计划）

重要：content字段必须包含详细的素材内容，不要只写简短描述：

输出格式（JSON数组，不要包含其他文字）：
[
  {
    "type": "素材类型",
    "name": "素材名称",
    "content": "详细内容描述（至少150字）"
  }
]`
        },
        {
            role: 'user',
            content: `小说名称：${project.name}\n类型：${project.genre}\n描述：${project.description}\n\n用户需求：${userPrompt}`
        }
    ];

    const result = await llm.chat(messages, { maxTokens: 32768, temperature: 0.8, enableThinking: false, apiConfig: getOutlineApiConfig() });
    const responseText = result.choices?.[0]?.message?.content || '';
    console.log(`[PIPELINE] generateInitialMaterials response length: ${responseText.length}, first 200 chars: ${responseText.substring(0, 200)}`);

    try {
        let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }
        const safeJson = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
        const materials = JSON.parse(safeJson);
        const created = [];

        for (const mat of materials) {
            const id = uuidv4();
            const now = new Date().toISOString();
            const item = {
                id,
                projectId,
                type: mat.type || 'other',
                name: mat.name || 'Unnamed',
                description: '',
                initialContent: mat.content || '',
                currentContent: mat.content || '',
                tags: [],
                isLocked: mat.type === 'worldview',
                version: 1,
                changeLog: [{
                    from: '',
                    to: mat.content || '',
                    reason: 'Initial creation from prompt',
                    timestamp: now
                }],
                createdAt: now,
                updatedAt: now
            };
            await store.setItem('materials', id, item);
            created.push(item);
        }

        return { created, count: created.length };
    } catch (e) {
        return { created: [], count: 0, raw: responseText, error: e.message };
    }
}

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
    console.log(`[PIPELINE] parseMarkdownOutlines: extracted ${outlines.length} chapters from Markdown`);
    return outlines;
}

async function generateChapterOutlines(projectId, userPrompt, overrideTargetCount) {
    const project = store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const existingChapters = store.queryItems('chapters', { projectId });
    const nextChapterNum = existingChapters.length + 1;
    const targetChapters = overrideTargetCount || Math.min(project.targetChapterCount || project.targetChapters || 10, 30);

    enforceVolumeSubplaneLocks(projectId, nextChapterNum);

    const vis = getVisibleMaterials(projectId, nextChapterNum, { purpose: 'outline' });
    const filteredMaterials = vis.materials;
    const currentVolumeSubplane = vis.currentVolSubplane;

    console.log(`[PIPELINE] Volume ${vis.currentVolume}, forced subplane: ${currentVolumeSubplane?.name || 'NONE'}, materials: ${vis.debug.totalMaterials}→${vis.debug.filteredMaterials} (removed ${vis.debug.removedMaterials})`);

    const lockedShortNames = vis.lockedSubplaneNames.map(n => n.short);
    let materialSummary = filteredMaterials.map(m => {
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

    if (materialSummary.length > 6000) {
        materialSummary = materialSummary.substring(0, 6000) + '\n...(素材过长已截断】';
    }

    let checklistSection = '';
    try {
        const checklistPath = path.join(__dirname, '..', '..', '..', 'data', 'subplanes', 'outline-checklist.json');
        const checklistData = JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
        if (checklistData.checklist) {
            checklistSection = '\n【📋 大纲生成指引清单 - 必须逐项对照，生成后自检打标】\n';
            checklistSection += '序号 | 指引项 | 规则要点 | 必须? | 自检\n';
            checklistSection += '---|---|---|---|---\n';
            for (const item of checklistData.checklist) {
                const req = item.required ? '🔴必须' : '🟡建议';
                checklistSection += `${item.order} | ${item.name} | ${item.rule.substring(0, 40)} | ${req} | ✓\n`;
            }
            checklistSection += '\n生成大纲后，请在每个outline末尾用【✓X标记】标注你对照了哪些指引项。格式：[✓1✓2✓3✓4✓5✓6✓7✓8✓10✓11✓12✓13✓14✓15]（数字=已遵循的指引序号，X=未遵循）\n';
        }
    } catch (e) { }

    const genreInjection = buildGenreOutlineInjection(project.styleProfile);
    const genreSection = genreInjection ? `\n\n${genreInjection}` : '';

    const volumeRhythmGuidance = buildVolumeRhythmGuidance(projectId, targetChapters);

    const subplaneName = currentVolumeSubplane ? currentVolumeSubplane.name : '当前解锁次位面';
    const volumeEntry = getVolumeSubplane(projectId, nextChapterNum);
    const subplaneType = volumeEntry?.type || '';
    const lockedSubNames = vis.lockedSubplaneNames.map(n => n.full);
    const lockedListStr = lockedSubNames.length > 0 ? `（包括"${lockedSubNames.slice(0, 5).join('""')}"等）` : '';
    const volumeNum = vis.currentVolume;

    const messages = [
        {
            role: 'system',
            content: `你是一个JSON生成器。你的唯一输出格式是JSON数组，禁止输出Markdown、标题、说明文字等任何非JSON内容。

【输出格式 - 最高优先级】
直接输出以下格式的JSON数组，不要包含任何其他文字、Markdown标题、代码块标记：
[
  {"chapterNumber": 1, "title": "章节标题", "scene": "主世界", "outline": "章节大纲200-500字"},
  {"chapterNumber": 2, "title": "章节标题", "scene": "${subplaneName}", "outline": "章节大纲200-500字"}
]

每章必须包含"scene"字段，值只能是"主世界"或"${subplaneName}"之一。这决定了章节发生在哪个场景。
🔴 如果你输出了任何非JSON内容（如Markdown标题#、说明文字、代码块标记），系统将无法解析，大纲会被直接丢弃！

【🔴🔴🔴 绝对红线 - 违反任何一条大纲直接作废 🔴🔴🔴】
1. 🔒本卷（第${volumeNum}卷）已被程序强制指定使用"${subplaneName}"（${subplaneType}类型）！你没有选择权！绝对禁止提及任何其他次位面${lockedListStr}！即使只是提及名字也不行！
2. scene="${subplaneName}"的章节必须≥15章！建议Ch6-Ch25共20章scene="${subplaneName}"
3. scene="主世界"的回响阶段（最后几章）必须≥2章！建议Ch26-Ch30共5章scene="主世界"
4. 30章一卷，一卷只有一个次位面——就是"${subplaneName}"，没有第二个

【推荐章节分配（严格遵守）】
Ch1-Ch5：scene="主世界"（系统激活、介绍配角、建立情感线、穿越进入${subplaneName}）
Ch6-Ch25：scene="${subplaneName}"（至少15章！摸清规则、遭遇危机、结交位面角色、系统任务推进、掠夺能力）
Ch26-Ch30：scene="主世界"（消化能力、实力提升、打脸被认可、配角互动、情感线推进、下一卷伏笔）

【重要：标题命名规则 - 必须遵守】
章节标题格式："第X章：[四字雅称]·[反套路事件/喜剧反转]"
标题要接地气有画面感，暗含喜剧反转或规则错位，让读者一看就想点进来。
❌禁止文青病式命名："XX之殇""XX的叹息""XX如梦"等空洞诗意
❌禁止技术说明书式命名："XX与YY的ZZ阀/舱/器/系统/装置"
✅正确示例："第一章：渊鳞隐契·系统让我卸载QQ""第三章：规则碎片·沉默的处方签""第七章：论道首日·这人比我的系统还机械"

【重要：大纲节奏规则 - 必须遵守】
- 3章内必须出金手指并完成首次使用（但不是直述金手指全貌！见下方"信息释放节奏"）
- 10章内必须完成第一次打脸/突破/逆袭
- 每章大纲必须有明确的剧情推进（不能一整章在描写和心理活动里打转）
- 每章大纲必须包含至少2处搞笑元素（内心吐槽/系统抽象反馈/规则错位荒诞/角色互动反差，四种来源均衡不要只靠吐槽）
- 每2-3章必须有一个爽感点（打脸/突破/智斗胜利/被认可/反差操作/暧昧互动/情感共鸣），爽感类型要轮换
- 文风接地气，大纲描述用大白话，不要文青病

【🔴🔴🔴 信息释放节奏 - 大纲层面最高优先级 🔴🔴🔴】
大纲最忌讳"第1章就把什么都说明白"。读者要的是"跟着主角一起懵逼、一起发现、一起恍然大悟"的过程。
1. 禁止前3章直述系统全貌——系统不会自我介绍，不会说"我是XX系统，功能是XX"，主角只能通过体验逐步理解
2. 禁止前5章直述金手指机制——"规则解读"不是系统告诉你的，是主角自己发现的
3. 禁止前3章直述世界观体系——"五域九境"通过场景和对话自然带出，不是旁白解说
4. 禁止主角第1章就想明白系统底层逻辑——认知是逐步建立的，第1章只感受到"这玩意儿有点毛病"
5. 每章只给1-2个新信息碎片，让读者和主角一起拼图
6. 展示代替告知——大纲里不要写"规则脉络显现出来了"，要写主角看到了什么异常、感受到了什么、自己得出了什么结论
7. 禁止总结式旁白——不要替读者归纳"这系统靠解读规则运转"
8. 🔴禁止第一章用"学术解读古籍"作为开篇——不要让主角读《礼记》/《论语》/古籍残卷来触发系统，这是严肃学术路线不是搞笑智斗！第一章必须是搞笑冲突开局（系统荒诞激活+日常被刁难+离谱任务），不是坐在书斋里做学问！

❌错误大纲示例："沈渡识海剧痛，脑海中响起'检测到高维规则碎片，位面掠夺系统激活。新手任务：三息内解读并修复某本古籍中的逻辑悖论，否则抹杀。'沈渡眼前文字化作银色脉络，指出循环论证漏洞。"
→ 这段大纲犯了所有错误：系统自我介绍、直述金手指机制、主角第1章就理解了规则解读、用学术解读古籍作为开篇太严肃无趣

✅正确大纲示例："沈渡脑子里突然炸开一个声音：'检测到高维灵魂，正在格式化……'他第一反应是脑瘤。紧接着又来一句：'内存不足，请卸载修仙版QQ以释放空间。'沈渡：……这系统比流氓软件还流氓。还没来得及吐槽完，外门管事来收呼吸税，沈渡因没钱被刁难。识海一阵灼烧，那个欠揍的声音又来了：'新手任务发布：在众目睽睽之下，用物理说服让管事闭嘴。'沈渡看着自己瘦弱的小胳膊，心想这系统是嫌我死得不够快吗？"
→ 这段大纲正确：系统不自我介绍只说荒诞的话、搞笑来自系统抽象反馈、主角只感受到"这玩意儿有点毛病"、开篇是搞笑冲突不是学术解读

配角戏份：不用每章都有配角，但偶尔（每5-8章）给配角高光时刻，情感线自然推进（友情/师徒/暧昧）。
爽感节奏：每2-3章必须有一个爽感点（大小皆可），爽感类型要轮换（不要连续都是战力爽），爽感不一定非得战力碾压（社交打脸/智斗翻盘/情感共鸣/反差震惊都是爽）。
每经历一个次位面后，必须回主世界浪一波：实力提升体现/打脸被认可/配角互动/情感线推进。
${volumeRhythmGuidance}
${genreSection}
${checklistSection}
重要：只输出JSON数组，不要输出其他任何文字。

输出JSON数组格式：
[
  {
    "chapterNumber": 1,
    "title": "章节标题",
    "outline": "章节大纲：200-500字，包含场景、人物、事件、喜剧点、爽感点、伏笔安排"
  }
]

请生成${targetChapters}章的大纲。`
        },
        {
            role: 'user',
            content: `小说名称：${project.name}\n类型：${project.genre || '未设定'}\n描述：${project.description || '无描述'}\n目标章节数：${targetChapters}\n\n【素材库摘要】\n${materialSummary}\n\n用户需求：${userPrompt || '请根据素材库规划章节'}`
        }
    ];

    console.log(`[PIPELINE] generateChapterOutlines: project=${project.name}, materials=${filteredMaterials.length}, targetChapters=${targetChapters}, promptLength=${JSON.stringify(messages).length}`);

    const result = await llm.chat(messages, { maxTokens: 32768, temperature: 0.8, enableThinking: false, apiConfig: getOutlineApiConfig() });
    const responseText = result.choices?.[0]?.message?.content || '';
    console.log(`[PIPELINE] generateChapterOutlines response length: ${responseText.length}, first 300 chars: ${responseText.substring(0, 300)}`);

    if (!responseText.trim()) {
        console.error('[PIPELINE] generateChapterOutlines: AI returned empty response');
        return { created: [], count: 0, error: 'AI returned empty response. The model may have used all tokens for reasoning. Try again or use a different model.' };
    }

    try {
        let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }
        let safeJson2 = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
        safeJson2 = safeJson2.replace(/,\s*([}\]])/g, '$1');
        safeJson2 = safeJson2.replace(/\/\/[^\n]*/g, '');
        safeJson2 = safeJson2.replace(/\/\*[\s\S]*?\*\//g, '');
        let outlines;
        try {
            outlines = JSON.parse(safeJson2);
        } catch (jsonErr) {
            console.log('[PIPELINE] generateChapterOutlines: JSON parse failed, trying Markdown extraction...');
            outlines = parseMarkdownOutlines(responseText);
        }

        if (!outlines || !Array.isArray(outlines) || outlines.length === 0) {
            console.error('[PIPELINE] generateChapterOutlines: parsed result is not a valid array');
            return { created: [], count: 0, error: 'AI output is not a valid array', raw: responseText.substring(0, 500) };
        }

        const rhythmValidation = validateOutlineRhythm(outlines, projectId);
        if (!rhythmValidation.isValid) {
            console.error('[PIPELINE] generateChapterOutlines: 卷节奏校验失败！', rhythmValidation.issues);
            return { created: [], count: 0, error: `卷节奏校验失败：${rhythmValidation.issues.join('；')}`, rhythmIssues: rhythmValidation.issues };
        }
        console.log('[PIPELINE] generateChapterOutlines: 卷节奏校验通过', rhythmValidation);

        const created = [];
        const allExistingTitles = store.queryItems('chapters', { projectId }).map(c => c.title).filter(Boolean);
        const allExistingOutlines = store.queryItems('chapters', { projectId }).map(c => (c.outline || '').substring(0, 80)).filter(Boolean);
        const usedTitles = new Set(allExistingTitles);
        const usedOutlineStarts = new Set(allExistingOutlines);

        for (const outline of outlines) {
            let title = outline.title || `第${created.length + 1}章`;
            let dedupAttempts = 0;
            while (usedTitles.has(title) && dedupAttempts < 5) {
                dedupAttempts++;
                const suffix = dedupAttempts === 1 ? '（续）' : dedupAttempts === 2 ? '（下）' : dedupAttempts === 3 ? '（再续）' : `${dedupAttempts}）`;
                title = (outline.title || `第${created.length + 1}}章`) + suffix;
            }
            if (usedTitles.has(title)) {
                console.log(`[PIPELINE] Skipping unresolvable duplicate chapter title: ${outline.title}`);
                continue;
            }
            usedTitles.add(title);
            const outlineStart = (outline.outline || '').substring(0, 80);
            if (outlineStart && usedOutlineStarts.has(outlineStart)) {
                console.log(`[PIPELINE] Skipping duplicate chapter outline: ${outlineStart}`);
                continue;
            }
            if (outlineStart) usedOutlineStarts.add(outlineStart);
            const id = uuidv4();
            const now = new Date().toISOString();
            const chapter = {
                id,
                projectId,
                chapterNumber: outline.chapterNumber || created.length + 1,
                title,
                outline: outline.outline || '',
                scene: outline.scene || '',
                content: '',
                status: 'outlined',
                wordCount: 0,
                round: 0,
                writerOutput: '',
                firstReviewOutput: '',
                secondReviewOutput: '',
                finalEditorOutput: '',
                history: [],
                createdAt: now,
                updatedAt: now
            };
            await store.setItem('chapters', id, chapter);
            created.push(chapter);
        }

        project.currentChapter = created.length;
        project.status = 'outlined';
        project.updatedAt = new Date().toISOString();
        await store.setItem('projects', projectId, project);

        console.log(`[PIPELINE] generateChapterOutlines: created ${created.length} chapters`);
        return { created, count: created.length };
    } catch (e) {
        console.error('[PIPELINE] generateChapterOutlines parse error:', e.message);
        return { created: [], count: 0, raw: responseText.substring(0, 1000), error: e.message };
    }
}

async function generateFromTemplate(template) {
    const { name, genre, elements, targetChapters, targetWords, style, tone, pov, setting, conflict, themes, styleTemplateId, constraints, mode } = template;
    if (!name || !genre) throw new Error('name and genre are required');

    const projectMode = mode || 'novel';
    const modeConfig = getModeConfig(projectMode);

    const projectId = uuidv4();
    const now = new Date().toISOString();

    const project = {
        id: projectId,
        name,
        description: `${genre}题材${elements ? '，包含' + elements : ''}，目标${targetWords || ((targetChapters * modeConfig.TARGET_MIN_WORDS) + '~' + (targetChapters * modeConfig.TARGET_MAX_WORDS))}字`,
        genre,
        mode: projectMode,
        targetChapters: targetChapters || 100,
        currentChapter: 0,
        status: 'template-generating',
        settings: { autoPipeline: false, chapterRounds: projectMode === 'shuangwen' ? 2 : 3 },
        styleTemplateId: styleTemplateId || '',
        constraints: constraints || (projectMode === 'shuangwen' ? ['no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'fast-escalation', 'reader-satisfaction'] : []),
        template: {
            elements: elements || '',
            targetWords: targetWords || '',
            style: style || '',
            tone: tone || '',
            pov: pov || '',
            setting: setting || '',
            conflict: conflict || '',
            themes: themes || ''
        },
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('projects', projectId, project);

    const elementList = elements ? elements.split(/[,，、\s]+/).filter(Boolean) : [];
    const elementStr = elementList.length > 0 ? elementList.map(e => `"${e}"`).join('、') : '';

    let styleInjection = '';
    if (styleTemplateId) {
        const st = store.getItem('style-templates', styleTemplateId);
        if (st) {
            const r = st.rules || {};
            const rules = [
                r.sentenceStyle && `句式:${r.sentenceStyle}`,
                r.paragraphStyle && `段落:${r.paragraphStyle}`,
                r.dialogueStyle && `对话:${r.dialogueStyle}`,
                r.descriptionStyle && `描写:${r.descriptionStyle}`,
                r.emotionStyle && `情感:${r.emotionStyle}`,
                r.pacing && `节奏:${r.pacing}`,
                r.vocabulary && `词汇:${r.vocabulary}`,
                r.forbidden?.length && `禁止:${r.forbidden.join('/')}`
            ].filter(Boolean).join('|');
            if (rules) {
                styleInjection = `\n【风格模板】${st.name}】${rules}`;
            } else if (st.example) {
                styleInjection = `\n【风格参考${st.name}】请模仿以下文本的写作风格：${st.example.substring(0, 1000)}`;
            }
        }
    }

    let constraintInjection = '';
    if (constraints && constraints.length) {
        const items = constraints.map(id => CONSTRAINT_PRESETS[id]).filter(Boolean).map(c => `${c.label}：${c.desc}`);
        if (items.length) constraintInjection = `\n【写作约束（必须遵守）】\n${items.join('\n')}`;
    }

    const templatePrompt = projectMode === 'shuangwen'
        ? `你是一个顶级爽文策划师。请根据以下模板信息，生成一套适合番茄/七猫平台的快节奏爽文设定。

【小说名称】${name}
【题材/类型】${genre}
${elementStr ? `【核心元素】${elementStr}` : ''}
${targetWords ? `【目标字数】${targetWords}字` : `【目标章节数】${targetChapters || 100}章`}
${style ? `【写作风格】${style}` : ''}
${tone ? `【基调】${tone}` : ''}
${pov ? `【叙事视角】${pov}` : ''}
${setting ? `【世界设定方向】${setting}` : ''}
${conflict ? `【核心冲突】${conflict}` : ''}
${themes ? `【主题】${themes}` : ''}
${styleInjection}
${constraintInjection}

请严格按照以下JSON格式输出：

{
  "materials": [
    {"type": "素材类型", "name": "素材名称", "content": "详细内容（至少150字）"}
  ],
  "chapterOutlines": [
    {"chapterNumber": 1, "title": "章节标题", "outline": "章节大纲：00-200字，必须包含爽点和章末钩子）"}
  ]
}

【爽文素材要求】- 精简高效】
- worldview: 世界观（200字以上，突出等级体系和升级路线）
- character: 主要人物：3-5个核心角色，每人150字以上，突出实力等级和标志性能力）
- power-system: 战力体系：300字以上，等级分明，升级路径清晰，读者能直观感受变强】
- equipment: 核心装备/金手指（2-3件，突出获得时的爽感）
- relationship: 核心关系（主角与主要对手/盟友的关系）
- foreshadowing: 伏笔设计：3-5个，每个都是打脸/翻盘的铺垫）

【爽文章节大纲要求】
- 生了{Math.min(targetChapters || 20, 20)}章的大纲
- 每章大纲100-200字，必须包含：①爽点描述 ②章末钩子
- 前3章必须有：第1章金手指觉醒，第2章首次打脸，第3章实力展示
- 节奏要快：每3-5章一个小高潮，每130章一个大高潮
- 打脸三段式：嚣张嘲讽→碾压→震惊

重要：只输出JSON，不要输出其他任何文字。`
        : `你是一个顶级小说策划师。请根据以下模板信息，生成一套完整的小说设定体系。

【小说名称】${name}
【题材/类型】${genre}
${elementStr ? `【核心元素】${elementStr}` : ''}
${targetWords ? `【目标字数】${targetWords}字` : `【目标章节数】${targetChapters || 100}章`}
${style ? `【写作风格】${style}` : ''}
${tone ? `【基调】${tone}` : ''}
${pov ? `【叙事视角】${pov}` : ''}
${setting ? `【世界设定方向】${setting}` : ''}
${conflict ? `【核心冲突】${conflict}` : ''}
${themes ? `【主题】${themes}` : ''}
${styleInjection}
${constraintInjection}

请严格按照以下JSON格式输出，包含2个部分：

{
  "materials": [
    {"type": "素材类型", "name": "素材名称", "content": "详细内容（至少200字）"}
  ],
  "mainQuests": [
    {"title": "主线任务名", "description": "任务描述（至少200字）", "priority": "normal|high|critical", "subQuests": [
      {"title": "子任务名", "description": "子任务描述"}
    ]}
  ],
  "timeline": [
    {"title": "事件名", "description": "事件描述", "eventType": "plot|character|world|conflict|revelation|foreshadow|resolution", "storyTime": "故事内时间", "location": "地点", "importance": "normal|high|critical", "isKeyEvent": true/false}
  ],
  "chapterOutlines": [
    {"chapterNumber": 1, "title": "章节标题", "outline": "章节大纲：00-500字）"}
  ]
}

【素材类型说明】
- worldview: 世界观设定（详细描述世界背景、规则、历史、势力分布，至少500字）
- character: 主要人物卡（每个角色详细描述外貌、性格、能力、背景、动机，至少300字/角色，生成5-8个主要角色）
- equipment: 重要装备/道具（描述名称、品级、能力、来源，至少200字/件，生成3-5件）
- relationship: 人物关系网（描述角色间的关系和羁绊，至少300字，生成2-3组关系）
- power-system: 战力体系（详细描述等级划分、突破条件、能力特征、修炼方式，至少500字）
- catchphrase: 金句/热梗（创造5-8个经典台词或网络梗）
- famous-scene: 名场面（描述3-5个高光剧情场景，至少200字/场景）
- growth-history: 主角成长史（描述主角从弱到强的完整成长路线，至少400字）
- foreshadowing: 伏笔设计（设计5-8个伏笔，描述埋设时机和回收计划，至少150字/个）

【主线任务说明】
- 设计3-5条主线任务，每条可包含2-4个子任务
- 任务之间应有逻辑关联，形成完整的剧情推进链
- priority: 普通任务用normal，关键转折用high，核心主线用critical

【时间线说明】
- 按故事发展顺序排列10-20个关键事件
- eventType: plot(剧情转折)、character(人物变化)、world(世界观揭示)、conflict(冲突爆发)、revelation(真相揭示)、foreshadow(伏笔埋设)、resolution(冲突解决)
- isKeyEvent: 对剧情走向有重大影响的事件标记为true
- storyTime: 用故事内的时间描述，如"故事开始"、"修炼第三天"、"大战前夕""

【章节大纲说明】
- 生了{Math.min(targetChapters || 10, 30)}章的大纲
- 每章大纲200-500字，包含场景、人物、事件、伏笔安排
- 章节之间要连贯，推动剧情发展

重要：只输出JSON，不要输出其他任何文字。content字段必须包含详细内容。`;

    const messages = [
        { role: 'system', content: templatePrompt },
        { role: 'user', content: `请为《${name}》生成完整的小说设定体系。题材：${genre}${elementStr ? '，元素：' + elementStr : ''}。` }
    ];

    console.log(`[PIPELINE] generateFromTemplate: name=${name}, genre=${genre}, elements=${elements}`);

    const result = await llm.chat(messages, { maxTokens: 65536, temperature: 0.85, maxRetries: 8, retryDelay: 30000, apiConfig: getOutlineApiConfig() });
    const responseText = result.choices?.[0]?.message?.content || '';
    console.log(`[PIPELINE] generateFromTemplate response length: ${responseText.length}`);

    if (!responseText.trim()) {
        project.status = 'template-failed';
        project.updatedAt = new Date().toISOString();
        await store.setItem('projects', projectId, project);
        return { projectId, success: false, error: 'AI returned empty response' };
    }

    try {
        let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            const openBraces = (cleaned.match(/\{/g) || []).length;
            const closeBraces = (cleaned.match(/\}/g) || []).length;
            if (openBraces > closeBraces) {
                cleaned = cleaned + '}'.repeat(openBraces - closeBraces);
            }
            const retryMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!retryMatch) throw new Error('No JSON object found in response');
            cleaned = retryMatch[0];
        } else {
            cleaned = jsonMatch[0];
        }

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.log('[PIPELINE] Initial JSON parse failed, attempting repair...');
            console.log('[PIPELINE] First 200 chars:', cleaned.substring(0, 200));
            console.log('[PIPELINE] Around error pos:', cleaned.substring(Math.max(0, 900), 1050));

            const repairAndParse = (text) => {
                text = text.replace(/,\s*([}\]])/g, '$1');
                text = text.replace(/[\x00-\x1f]/g, c => c === '\n' || c === '\r' || c === '\t' ? c : '');
                try { return JSON.parse(text); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                try { return require('json5').parse(text); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                let fixed = text.replace(/\\\"/g, '"');
                const openB = (fixed.match(/\[/g) || []).length;
                const closeB = (fixed.match(/\]/g) || []).length;
                const openBr = (fixed.match(/\{/g) || []).length;
                const closeBr = (fixed.match(/\}/g) || []).length;
                if (closeB < openB) fixed += ']'.repeat(openB - closeB);
                if (closeBr < openBr) fixed += '}'.repeat(openBr - closeBr);
                try { return JSON.parse(fixed); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                return null;
            };

            parsed = repairAndParse(cleaned);
            if (!parsed) {
                const lines = cleaned.split('\n');
                let partial = '';
                let depth = 0;
                for (const line of lines) {
                    for (const ch of line) {
                        if (ch === '{' || ch === '[') depth++;
                        if (ch === '}' || ch === ']') depth--;
                    }
                    partial += line + '\n';
                    if (depth <= 0 && partial.includes('{')) {
                        try {
                            const testParsed = JSON.parse(partial.trim().replace(/,\s*$/, ''));
                            if (testParsed.materials || testParsed.mainQuests || testParsed.timeline || testParsed.chapterOutlines) {
                                parsed = testParsed;
                                console.log('[PIPELINE] Partial JSON recovery successful');
                                break;
                            }
                        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                    }
                }
            }
            if (!parsed) {
                throw new Error('JSON parse failed after all repair attempts: ' + parseErr.message);
            }
        }

        const createdMaterials = [];
        const createdQuests = [];
        const createdTimelines = [];
        const createdChapters = [];

        if (parsed.materials && Array.isArray(parsed.materials)) {
            for (const mat of parsed.materials) {
                const matId = uuidv4();
                const item = {
                    id: matId,
                    projectId,
                    type: mat.type || 'other',
                    name: mat.name || 'Unnamed',
                    description: '',
                    initialContent: mat.content || '',
                    currentContent: mat.content || '',
                    tags: ['template-generated', ...(mat.type === 'character' && mat.isMainCharacter ? ['主角'] : [])],
                    isLocked: mat.type === 'worldview',
                    version: 1,
                    changeLog: [{
                        from: '',
                        to: mat.content || '',
                        reason: 'Template auto-generated',
                        timestamp: now
                    }],
                    createdAt: now,
                    updatedAt: now
                };
                await store.setItem('materials', matId, item);
                createdMaterials.push(item);
            }
        }

        if (parsed.mainQuests && Array.isArray(parsed.mainQuests)) {
            for (let i = 0; i < parsed.mainQuests.length; i++) {
                const q = parsed.mainQuests[i];
                const questId = uuidv4();
                const quest = {
                    id: questId,
                    projectId,
                    parentId: null,
                    title: q.title || `主线任务${i + 1}`,
                    description: q.description || '',
                    status: 'planned',
                    priority: ['low', 'normal', 'high', 'critical'].includes(q.priority) ? q.priority : 'normal',
                    sortOrder: i,
                    materialIds: [],
                    chapterIds: [],
                    timelineEventIds: [],
                    progress: 0,
                    notes: '',
                    tags: ['template-generated', 'main-quest'],
                    createdAt: now,
                    updatedAt: now
                };
                await store.setItem('quests', questId, quest);
                createdQuests.push(quest);

                if (q.subQuests && Array.isArray(q.subQuests)) {
                    for (let j = 0; j < q.subQuests.length; j++) {
                        const sub = q.subQuests[j];
                        const subId = uuidv4();
                        const subQuest = {
                            id: subId,
                            projectId,
                            parentId: questId,
                            title: sub.title || `子任务${j + 1}`,
                            description: sub.description || '',
                            status: 'planned',
                            priority: 'normal',
                            sortOrder: j,
                            materialIds: [],
                            chapterIds: [],
                            timelineEventIds: [],
                            progress: 0,
                            notes: '',
                            tags: ['template-generated', 'sub-quest'],
                            createdAt: now,
                            updatedAt: now
                        };
                        await store.setItem('quests', subId, subQuest);
                    }
                }
            }
        }

        if (parsed.timeline && Array.isArray(parsed.timeline)) {
            for (let i = 0; i < parsed.timeline.length; i++) {
                const ev = parsed.timeline[i];
                const evId = uuidv4();
                const event = {
                    id: evId,
                    projectId,
                    title: ev.title || `事件${i + 1}`,
                    description: ev.description || '',
                    eventType: ['plot', 'character', 'world', 'conflict', 'revelation', 'foreshadow', 'resolution'].includes(ev.eventType) ? ev.eventType : 'plot',
                    storyOrder: i,
                    sortOrder: i,
                    storyTime: ev.storyTime || '',
                    chapterIds: [],
                    questIds: [],
                    materialIds: [],
                    characterIds: [],
                    location: ev.location || '',
                    importance: ['low', 'normal', 'high', 'critical'].includes(ev.importance) ? ev.importance : 'normal',
                    isKeyEvent: ev.isKeyEvent || false,
                    notes: '',
                    tags: ['template-generated'],
                    createdAt: now,
                    updatedAt: now
                };
                await store.setItem('timelines', evId, event);
                createdTimelines.push(event);
            }
        }

        if (parsed.chapterOutlines && Array.isArray(parsed.chapterOutlines)) {
            const allExistingTitles = store.queryItems('chapters', { projectId }).map(c => c.title).filter(Boolean);
            const allExistingOutlines = store.queryItems('chapters', { projectId }).map(c => (c.outline || '').substring(0, 80)).filter(Boolean);
            const usedTitles = new Set(allExistingTitles);
            const usedOutlineStarts = new Set(allExistingOutlines);
            for (const outline of parsed.chapterOutlines) {
                let title = outline.title || `${createdChapters.length + 1}章`;
                let dedupAttempts = 0;
                while (usedTitles.has(title) && dedupAttempts < 5) {
                    dedupAttempts++;
                    const suffix = dedupAttempts === 1 ? '（续）' : dedupAttempts === 2 ? '（下）' : dedupAttempts === 3 ? '（再续）' : `${dedupAttempts}）`;
                    title = (outline.title || `${createdChapters.length + 1}章`) + suffix;
                }
                if (usedTitles.has(title)) {
                    console.log(`[PIPELINE] Skipping unresolvable duplicate template chapter title: ${outline.title}`);
                    continue;
                }
                usedTitles.add(title);
                const outlineStart = (outline.outline || '').substring(0, 80);
                if (outlineStart && usedOutlineStarts.has(outlineStart)) {
                    console.log(`[PIPELINE] Skipping duplicate template chapter outline: ${outlineStart}`);
                    continue;
                }
                if (outlineStart) usedOutlineStarts.add(outlineStart);
                const chId = uuidv4();
                const chapter = {
                    id: chId,
                    projectId,
                    chapterNumber: outline.chapterNumber || createdChapters.length + 1,
                    title,
                    outline: outline.outline || '',
                    content: '',
                    status: 'outlined',
                    wordCount: 0,
                    round: 0,
                    writerOutput: '',
                    firstReviewOutput: '',
                    secondReviewOutput: '',
                    finalEditorOutput: '',
                    history: [],
                    createdAt: now,
                    updatedAt: now
                };
                await store.setItem('chapters', chId, chapter);
                createdChapters.push(chapter);

                const qId2 = uuidv4();
                await store.setItem('quests', qId2, {
                    id: qId2,
                    projectId,
                    parentId: null,
                    title: `第${chapter.chapterNumber}章 ${chapter.title}`,
                    description: chapter.outline || '',
                    status: 'planned',
                    priority: 'normal',
                    sortOrder: chapter.chapterNumber - 1,
                    materialIds: [],
                    chapterIds: [chId],
                    timelineEventIds: [],
                    progress: 0,
                    notes: '',
                    tags: ['auto-generated'],
                    createdAt: now,
                    updatedAt: now
                });
            }
        }

        const allQuests = store.listItems('quests').filter(q => q.projectId === projectId);
        const allTimelines = store.listItems('timelines').filter(t => t.projectId === projectId);
        const allChapters = store.listItems('chapters').filter(c => c.projectId === projectId);
        const allMaterials = store.listItems('materials').filter(m => m.projectId === projectId);

        console.log(`[PIPELINE] Association: quests=${allQuests.length}, timelines=${allTimelines.length}, chapters=${allChapters.length}, materials=${allMaterials.length}`);

        const mainQuests = allQuests.filter(q => !q.parentId && q.tags?.includes('main-quest'));
        const chapterQuests = allQuests.filter(q => q.tags?.includes('auto-generated'));
        const characterMaterials = allMaterials.filter(m => m.type === 'character');

        console.log(`[PIPELINE] Association: mainQuests=${mainQuests.length}, chapterQuests=${chapterQuests.length}, charMats=${characterMaterials.length}`);

        function extractKeywords(text) {
            if (!text) return [];
            return text.replace(/[0-9第章整合（）【】、\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
        }

        for (const ev of allTimelines) {
            const evKeywords = extractKeywords(ev.title + ' ' + (ev.description || ''));
            let bestQuest = null;
            let bestScore = 0;

            for (const q of mainQuests) {
                let score = 0;
                const qKeywords = extractKeywords(q.title + ' ' + (q.description || ''));
                for (const ek of evKeywords) {
                    for (const qk of qKeywords) {
                        if (ek === qk) score += 3;
                        else if (ek.includes(qk) || qk.includes(ek)) score += 1;
                    }
                }
                const subQuests = allQuests.filter(sq => sq.parentId === q.id);
                for (const sq of subQuests) {
                    const sqKeywords = extractKeywords(sq.title + ' ' + (sq.description || ''));
                    for (const ek of evKeywords) {
                        for (const sqk of sqKeywords) {
                            if (ek === sqk) score += 2;
                            else if (ek.includes(sqk) || sqk.includes(ek)) score += 1;
                        }
                    }
                }
                if (ev.eventType === 'conflict' && q.priority === 'critical') score += 2;
                if (ev.eventType === 'revelation' && q.priority === 'high') score += 2;
                if (ev.eventType === 'resolution' && q.priority === 'critical') score += 3;
                if (ev.eventType === 'world' && q.priority === 'high') score += 1;
                if (ev.eventType === 'character' && q.priority === 'critical') score += 1;
                if (score > bestScore) { bestScore = score; bestQuest = q; }
            }

            if (bestQuest && bestScore >= 2) {
                if (!ev.questIds) ev.questIds = [];
                if (!ev.questIds.includes(bestQuest.id)) ev.questIds.push(bestQuest.id);
                if (!bestQuest.timelineEventIds) bestQuest.timelineEventIds = [];
                if (!bestQuest.timelineEventIds.includes(ev.id)) bestQuest.timelineEventIds.push(ev.id);
                await store.setItem('timelines', ev.id, ev);
                await store.setItem('quests', bestQuest.id, bestQuest);
            }
        }

        const sortedTimelines = [...allTimelines].sort((a, b) => (a.storyOrder ?? 0) - (b.storyOrder ?? 0));

        for (const ch of allChapters) {
            const chQuest = chapterQuests.find(q => (q.chapterIds || []).includes(ch.id));
            if (!chQuest) continue;

            const totalCh = allChapters.length;
            const totalEv = sortedTimelines.length;
            if (totalEv === 0) continue;
            const evPerCh = totalEv / totalCh;
            const startIdx = Math.floor((ch.chapterNumber - 1) * evPerCh);
            const endIdx = Math.floor(ch.chapterNumber * evPerCh);

            for (let ei = startIdx; ei < endIdx && ei < totalEv; ei++) {
                const ev = sortedTimelines[ei];
                if (!ev) continue;
                if (!chQuest.timelineEventIds) chQuest.timelineEventIds = [];
                if (!chQuest.timelineEventIds.includes(ev.id)) chQuest.timelineEventIds.push(ev.id);
                if (!ev.chapterIds) ev.chapterIds = [];
                if (!ev.chapterIds.includes(ch.id)) ev.chapterIds.push(ch.id);
                await store.setItem('timelines', ev.id, ev);
            }
            await store.setItem('quests', chQuest.id, chQuest);
        }

        for (const ev of allTimelines) {
            if (ev.eventType !== 'character' || characterMaterials.length === 0) continue;
            let bestChar = null;
            let bestScore = 0;
            const evTitleLower = (ev.title || '').toLowerCase();
            const evText = (ev.title + ' ' + (ev.description || '')).toLowerCase();
            for (const c of characterMaterials) {
                const rawName = (c.name || '').toLowerCase();
                if (!rawName) continue;
                const coreName = rawName.replace(/[【].+?[】]/g, '').replace(/\s*[-–—]\s*.+$/, '').trim();
                let score = 0;
                if (evTitleLower.includes(coreName)) score += coreName.length * 4;
                if (evText.includes(coreName)) score += coreName.length * 2;
                if (evText.includes(rawName)) score = Math.max(score, rawName.length * 2);
                const charContent = (c.currentContent || c.initialContent || '').toLowerCase();
                const evKeywords = extractKeywords(ev.title);
                for (const ek of evKeywords) {
                    if (charContent.includes(ek.toLowerCase())) score += 1;
                }
                if (score > bestScore) { bestScore = score; bestChar = c; }
            }
            if (bestChar && bestScore >= 2) {
                if (!ev.characterIds) ev.characterIds = [];
                if (!ev.characterIds.includes(bestChar.id)) ev.characterIds.push(bestChar.id);
                if (!ev.materialIds) ev.materialIds = [];
                if (!ev.materialIds.includes(bestChar.id)) ev.materialIds.push(bestChar.id);
                await store.setItem('timelines', ev.id, ev);
            }
        }

        for (const q of mainQuests) {
            const qText = (q.title + ' ' + (q.description || '')).toLowerCase();
            const relatedMats = allMaterials.filter(m => {
                if (m.type === 'character') return false;
                const mText = (m.name + ' ' + (m.currentContent || m.initialContent || '')).toLowerCase();
                const qKw = extractKeywords(q.title + ' ' + q.description);
                const mKw = new Set(extractKeywords(m.name + ' ' + (m.currentContent || m.initialContent || '')));
                let overlap = 0;
                for (const k of qKw) { if (mKw.has(k)) overlap++; }
                return overlap >= 2 || mText.includes(q.title.toLowerCase());
            });
            if (relatedMats.length > 0) {
                q.materialIds = [...new Set([...(q.materialIds || []), ...relatedMats.map(m => m.id)])];
                await store.setItem('quests', q.id, q);
                for (const m of relatedMats) {
                    if (!m.questIds) m.questIds = [];
                    if (!m.questIds.includes(q.id)) {
                        m.questIds.push(q.id);
                        await store.setItem('materials', m.id, m);
                    }
                }
            }
        }

        project.currentChapter = createdChapters.length;
        project.status = 'outlined';
        project.updatedAt = new Date().toISOString();
        await store.setItem('projects', projectId, project);

        console.log(`[PIPELINE] generateFromTemplate complete: project=${projectId}, materials=${createdMaterials.length}, quests=${createdQuests.length}, timelines=${createdTimelines.length}, chapters=${createdChapters.length}`);

        return {
            projectId,
            success: true,
            stats: {
                materials: createdMaterials.length,
                quests: createdQuests.length,
                timelines: createdTimelines.length,
                chapters: createdChapters.length
            }
        };
    } catch (e) {
        console.error('[PIPELINE] generateFromTemplate parse error:', e.message);
        project.status = 'template-failed';
        project.updatedAt = new Date().toISOString();
        await store.setItem('projects', projectId, project);
        return { projectId, success: false, error: e.message, raw: responseText.substring(0, 1000) };
    }
}

async function supplementChapterOutlines(projectId, existingCount, supplementCount = 30, retryHint = '') {
    const project = store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const currentVolume = Math.floor(existingCount / 30) + 1;
    const chapterInVolume = existingCount % 30;
    const isVolumeComplete = chapterInVolume === 0 && existingCount > 0;

    let volumeOrderConfig = null;
    try {
        volumeOrderConfig = getVolumeOrder(projectId);
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

    const allSubplaneMats = store.queryItems('materials', { projectId, type: 'sub-plane' }).filter(m => !m.archived);

    if (isVolumeComplete && volumeOrderConfig?.volumeOrder) {
        const previousVolume = currentVolume - 1;
        const prevVolEntry = volumeOrderConfig.volumeOrder.find(v => v.volume === previousVolume);
        if (prevVolEntry) {
            const prevSub = allSubplaneMats.find(m => m.id === prevVolEntry.subplaneId || m.name === prevVolEntry.subplaneName);
            if (prevSub && !prevSub.isLocked) {
                prevSub.isLocked = true;
                prevSub.updatedAt = new Date().toISOString();
                await store.setItem('materials', prevSub.id, prevSub);
                console.log(`[PIPELINE] 自动锁定上一卷(第${previousVolume}卷)次位面: ${prevSub.name}`);
            }
        }

        const nextVolEntry = volumeOrderConfig.volumeOrder.find(v => v.volume === currentVolume);
        if (nextVolEntry) {
            const targetSub = allSubplaneMats.find(m => m.id === nextVolEntry.subplaneId || m.name === nextVolEntry.subplaneName);
            if (targetSub) {
                if (targetSub.isLocked) {
                    targetSub.isLocked = false;
                    targetSub.updatedAt = new Date().toISOString();
                    await store.setItem('materials', targetSub.id, targetSub);
                    console.log(`[PIPELINE] 自动解锁第${currentVolume}卷次位面: ${targetSub.name}`);
                }
            } else {
                console.warn(`[PIPELINE] 第${currentVolume}卷次位面 ${nextVolEntry.subplaneName}(${nextVolEntry.subplaneId}) 在素材库中不存在，尝试创建...`);
                const newSubId = nextVolEntry.subplaneId;
                const newSub = {
                    id: newSubId,
                    projectId,
                    type: 'sub-plane',
                    name: nextVolEntry.subplaneName,
                    description: `${nextVolEntry.type}类次位面`,
                    initialContent: `【位面名】${nextVolEntry.subplaneName}\n【类型】${nextVolEntry.type}\n【核心规则】待探索\n【视觉特征】待探索`,
                    currentContent: `【位面名】${nextVolEntry.subplaneName}\n【类型】${nextVolEntry.type}\n【核心规则】待探索\n【视觉特征】待探索`,
                    isLocked: false,
                    parentPlane: '主世界',
                    tags: ['sub-plane', nextVolEntry.type],
                    version: 1,
                    changeLog: [{ action: 'auto-created', reason: `第${currentVolume}卷自动创建`, at: new Date().toISOString() }],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await store.setItem('materials', newSubId, newSub);
            }
            for (const sub of allSubplaneMats) {
                const nextVolEntry2 = volumeOrderConfig.volumeOrder.find(v => v.volume === currentVolume);
                const currentSubId = nextVolEntry2?.subplaneId;
                if (sub.id === currentSubId) continue;
                if (!sub.isLocked) {
                    sub.isLocked = true;
                    sub.updatedAt = new Date().toISOString();
                    await store.setItem('materials', sub.id, sub);
                    console.log(`[PIPELINE] 卷过渡：锁定非当前卷次位面 ${sub.name}`);
                }
            }
        }
    }

    if (isVolumeComplete) {
        supplementCount = 30;
        console.log(`[PIPELINE] 第${currentVolume - 1}卷已完成，自动补充第${currentVolume}卷30章大纲`);
    } else if (chapterInVolume > 0) {
        const remainingInVolume = 30 - chapterInVolume;
        if (supplementCount > remainingInVolume) {
            supplementCount = remainingInVolume;
        }
        console.log(`[PIPELINE] 第${currentVolume}卷进行中(卷内第${chapterInVolume}章)，补充${supplementCount}章完成本卷`);
    }

    const targetChapterForVis = existingCount + 1;
    const vis = getVisibleMaterials(projectId, targetChapterForVis, { purpose: 'outline' });
    const filteredMaterials = vis.materials;
    const currentVolSubplane = vis.currentVolSubplane;

    console.log(`[PIPELINE] supplementChapterOutlines: volume=${vis.currentVolume}, subplane=${currentVolSubplane?.name || 'NONE'}, materials: ${vis.debug.totalMaterials}→${vis.debug.filteredMaterials}`);

    const chapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);

    const targetChapterCount = project?.targetChapterCount || null;
    const targetWordCount = project?.targetWordCount || null;
    const currentTotalWords = chapters.filter(c => c.content).reduce((sum, c) => sum + (c.content || '').length, 0);

    let endingGuidance = '';
    if (targetChapterCount) {
        const remainingChapters = targetChapterCount - existingCount;
        if (remainingChapters <= 0) {
            return { created: [], count: 0, reason: '已达到目标章数' };
        }
        if (remainingChapters <= supplementCount) {
            supplementCount = remainingChapters;
            endingGuidance = `\n\n【关键：即将完结】\n本批大纲是全书最后${remainingChapters}章，必须规划大结局！\n- 倒数第${remainingChapters}章：所有伏笔回收、终极对决、情感高潮\n- 最后一章：收束所有线索、角色归宿、余韵结尾\n- 确保结局完整、震撼、有回味`;
        } else if (remainingChapters <= supplementCount * 2) {
            endingGuidance = `\n\n【注意：接近完结】\n距离目标${targetChapterCount}章还剩约${remainingChapters}章，开始收束剧情：\n- 逐步回收伏笔\n- 推向最终冲突\n- 为大结局做铺垫`;
        }
    }
    if (targetWordCount) {
        const remainingWords = targetWordCount - currentTotalWords;
        if (remainingWords <= 0) {
            return { created: [], count: 0, reason: '已达到目标字数' };
        }
        const avgWordsPerChapter = existingCount > 0 ? Math.round(currentTotalWords / existingCount) : 3000;
        const estimatedRemainingChapters = Math.ceil(remainingWords / avgWordsPerChapter);
        if (estimatedRemainingChapters <= supplementCount) {
            endingGuidance += `\n\n【字数目标：即将完结】\n当前总字数${currentTotalWords}，目标${targetWordCount}，预计还需约${estimatedRemainingChapters}章达到目标。本批大纲应包含大结局规划。`;
        }
    }

    let materialSummary = filteredMaterials.map(m => {
        let prefix = `[${m.type}] ${m.name}`;
        if (m.type === 'character' || m.type === 'faction') {
            if (m.parentPlane === '主世界' || !m.parentPlane) {
                prefix += ' [主世界]';
            } else if (currentVolSubplane && (m.parentPlane === currentVolSubplane.id || m.parentPlane === currentVolSubplane.name)) {
                prefix += ` [${currentVolSubplane.name}]`;
            }
        }
        return `${prefix}: ${(m.currentContent || '').substring(0, 150)}`;
    }).join('\n');
    if (materialSummary.length > 6000) materialSummary = materialSummary.substring(0, 6000);

    let recentChaptersSummary;
    if (isVolumeComplete) {
        recentChaptersSummary = chapters.slice(-3).map(ch =>
            `第${ch.chapterNumber}章 ${ch.title} [${ch.scene || '主世界'}]`
        ).join('\n');
        recentChaptersSummary += '\n（以上为上一卷末尾章节，本卷从主世界重新开始，不要延续上次位面剧情）';
    } else {
        recentChaptersSummary = chapters.slice(-5).map(ch =>
            `第${ch.chapterNumber}章 ${ch.title}: ${(ch.outline || ch.content || '').substring(0, 200)}`
        ).join('\n');
    }
    if (recentChaptersSummary.length > 3000) recentChaptersSummary = recentChaptersSummary.substring(0, 3000);

    const existingTitles = chapters.map(c => c.title).filter(Boolean);
    const existingOutlineStarts = chapters.map(c => (c.outline || '').substring(0, 50)).filter(s => s.length > 0);

    const lockedSubNames = vis.lockedSubplaneNames;
    for (const ln of lockedSubNames) {
        const escapedFull = ln.full.replace(/[.*+?^${}()|[\]\\]/g, '\\module.exports = {');
        const escapedShort = ln.short.replace(/[.*+?^${}()|[\]\\]/g, '\\module.exports = {');
        recentChaptersSummary = recentChaptersSummary.replace(new RegExp(escapedFull, 'g'), '[已锁定次位面]');
        recentChaptersSummary = recentChaptersSummary.replace(new RegExp(escapedShort, 'g'), '[已锁定次位面]');
        materialSummary = materialSummary.replace(new RegExp(escapedFull, 'g'), '[已锁定次位面]');
        materialSummary = materialSummary.replace(new RegExp(escapedShort, 'g'), '[已锁定次位面]');
        for (let i = 0; i < existingTitles.length; i++) {
            existingTitles[i] = existingTitles[i].replace(new RegExp(escapedShort, 'g'), '[已锁定]');
        }
        for (let i = 0; i < existingOutlineStarts.length; i++) {
            existingOutlineStarts[i] = existingOutlineStarts[i].replace(new RegExp(escapedShort, 'g'), '[已锁定]');
        }
    }

    const genreInjection = buildGenreOutlineInjection(project.styleProfile);
    const genreSection = genreInjection ? `\n\n${genreInjection}` : '';

    const volumeRhythmGuidance = buildVolumeRhythmGuidance(projectId, supplementCount, existingCount);

    let volumeTransitionGuidance = '';
    if (isVolumeComplete) {
        volumeTransitionGuidance = `\n\n【关键：新一卷开始！】
这是第${currentVolume}卷的开篇，必须从主世界重新开始！
- 前5章必须在主世界，铺垫新一卷的冲突和动机
- 第5章左右穿越进入本卷次位面「${currentVolSubplane ? currentVolSubplane.name : '待解锁'}」
- 与上一卷的衔接：主角从上一卷获得了新能力/新认知，在主世界引发新的冲突
- 必须引入新的配角互动和情感线推进
- 绝对不能继续上一卷次位面的剧情！`;
    }

    const messages = [
        {
            role: 'system',
            content: `你是一个小说章节大纲生成器。根据已有的素材库和已有章节，为小说补充新的章节大纲：

已有${existingCount}章，需要再生成${supplementCount}章的后续大纲：
请确保新章节与已有内容连贯，推动剧情发展，合理使用素材库中的元素。

【重要：标题命名规则 - 必须遵守】
章节标题格式："[四字雅称]·[反套路事件/喜剧反转]"
标题要接地气有画面感，暗含喜剧反转或规则错位，让读者一看就想点进来。
❌禁止文青病式命名："XX之殇""XX的叹息""XX如梦"等空洞诗意
❌禁止技术说明书式命名："XX与YY的ZZ阀/舱/器/系统/装置"
✅正确示例："渊鳞隐契·系统让我卸载QQ""规则碎片·沉默的处方签""论道首日·这人比我的系统还机械"

【重要：大纲节奏规则 - 必须遵守】
- 每章大纲必须有明确的剧情推进
- 每章大纲必须包含至少1处喜剧/吐槽/荒诞元素
- 每3-5章必须有一个爽感点（打脸/突破/智斗胜利/被认可/反差操作）
- 文风接地气，大纲描述用大白话，不要文青病

【最重要：卷节奏 - 违反视为硬伤，大纲直接作废】
30章为一卷，一卷只有一个次位面！
每卷标准节奏：
- 第一阶段（约5章，Ch1-5）：主世界铺垫→穿越进入次位面
- 第二阶段（约20章，Ch6-25）：深入次位面探索→系统任务推进→掠夺能力
- 第三阶段（约5章，Ch26-30）：返回主世界→消化能力→打脸/被认可→配角互动→下一卷伏笔
三阶段合计30章，次位面不少于15章，回响不少于3章。

绝对禁止：
- ❌一卷出现两个及以上次位面
- ❌次位面章节少于15章
- ❌主世界回响阶段少于3章

本卷指定次位面：${currentVolSubplane ? currentVolSubplane.name : '待解锁'}（禁止使用其他任何次位面！）
🔴🔴🔴 锁定次位面警告：以下次位面已在前面卷中使用完毕，本卷绝对禁止提及或使用！
${lockedSubNames.length > 0 ? lockedSubNames.map(n => `❌ ${n.full} - 已锁定，禁止使用`).join('\n') : '（无锁定次位面）'}
如果大纲中出现了上述锁定次位面的名称或元素，大纲将直接作废！

配角戏份：每5章至少1-2章给配角戏份，情感线自然推进。
${volumeRhythmGuidance}${volumeTransitionGuidance}
${genreSection}
【重要：去重规则】
- 新章节标题不能与已有标题重复
- 新章节大纲不能与已有大纲内容重复
- 每章大纲必须有独特的剧情推进，不能照搬前文

已有章节标题（禁止重复）${existingTitles.join('、')}
${endingGuidance}
${retryHint ? `\n\n【⚠️ 重试提示 - 必须修正以下问题】\n${retryHint}\n请严格按上述要求重新生成，否则大纲将再次被拒！` : ''}

输出JSON数组格式：
[
  {"title": "章节标题", "scene": "主世界/次位面名", "outline": "章节大纲：200字以上，包含场景、人物、事件、喜剧点、爽感点、伏笔安排"},
  ...
]
scene字段必须填写！主世界章节填"主世界"，次位面章节填"${currentVolSubplane ? currentVolSubplane.name : '次位面'}"。`
        },
        {
            role: 'user',
            content: `小说名：${project.name}\n小说描述：${project.description || ''}\n\n【素材库摘要】\n${materialSummary}\n\n【最近章节】\n${recentChaptersSummary}\n\n请生成第${existingCount + 1}到第${existingCount + supplementCount}章的大纲。注意：标题和大纲不能与已有内容重复！`
        }
    ];

    console.log(`[PIPELINE] supplementChapterOutlines: generating ${supplementCount} new outlines after chapter ${existingCount}`);

    const result = await llm.chat(messages, { temperature: 0.8, maxTokens: 32768, apiConfig: getOutlineApiConfig() });
    const responseText = result.choices?.[0]?.message?.content || '';

    try {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array found in response');
        const jsonStr = match[0].replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
        const outlines = JSON.parse(jsonStr);

        const rhythmValidation = validateOutlineRhythm(outlines, projectId);
        if (!rhythmValidation.isValid) {
            console.error('[PIPELINE] supplementChapterOutlines: 卷节奏校验失败！', rhythmValidation.issues);
            return { created: [], count: 0, error: `卷节奏校验失败：${rhythmValidation.issues.join('；')}`, rhythmIssues: rhythmValidation.issues };
        }
        console.log('[PIPELINE] supplementChapterOutlines: 卷节奏校验通过', rhythmValidation);

        const created = [];
        const allExistingTitles = store.queryItems('chapters', { projectId }).map(c => c.title).filter(Boolean);
        const allExistingOutlines = store.queryItems('chapters', { projectId }).map(c => (c.outline || '').substring(0, 80)).filter(Boolean);
        const usedTitles = new Set(allExistingTitles);
        const usedOutlineStarts = new Set(allExistingOutlines);
        for (const outline of outlines) {
            let title = outline.title || `第${existingCount + created.length + 1}章`;
            let dedupAttempts = 0;
            while (usedTitles.has(title) && dedupAttempts < 5) {
                dedupAttempts++;
                const suffix = dedupAttempts === 1 ? '（续）' : dedupAttempts === 2 ? '（下）' : dedupAttempts === 3 ? '（再续）' : `${dedupAttempts}）`;
                title = outline.title + suffix;
            }
            if (usedTitles.has(title)) {
                console.log(`[PIPELINE] Skipping unresolvable duplicate title: ${outline.title}`);
                continue;
            }
            usedTitles.add(title);

            const outlineStart = (outline.outline || '').substring(0, 80);
            if (outlineStart && usedOutlineStarts.has(outlineStart)) {
                console.log(`[PIPELINE] Skipping duplicate outline content: ${outlineStart}`);
                continue;
            }
            if (outlineStart) usedOutlineStarts.add(outlineStart);

            const id = uuidv4();
            const now = new Date().toISOString();
            const chapter = {
                id,
                projectId,
                chapterNumber: existingCount + created.length + 1,
                title,
                outline: outline.outline || '',
                scene: outline.scene || '',
                content: '',
                status: 'outlined',
                round: 0,
                wordCount: 0,
                createdAt: now,
                updatedAt: now
            };
            await store.setItem('chapters', id, chapter);
            created.push(chapter);

            const qId1 = uuidv4();
            await store.setItem('quests', qId1, {
                id: qId1,
                projectId,
                parentId: null,
                title: `第${chapter.chapterNumber}章 ${chapter.title}`,
                description: chapter.outline || '',
                status: 'planned',
                priority: 'normal',
                sortOrder: chapter.chapterNumber - 1,
                materialIds: [],
                chapterIds: [id],
                timelineEventIds: [],
                progress: 0,
                notes: '',
                tags: ['auto-generated'],
                createdAt: now,
                updatedAt: now
            });
        }

        project.currentChapter = existingCount + created.length;
        project.updatedAt = new Date().toISOString();
        await store.setItem('projects', projectId, project);

        console.log(`[PIPELINE] supplementChapterOutlines: created ${created.length} new chapters`);
        return { created, count: created.length };
    } catch (e) {
        console.error('[PIPELINE] supplementChapterOutlines parse error:', e.message);
        return { created: [], count: 0, raw: responseText.substring(0, 500), error: e.message };
    }
}

module.exports = {
    generateInitialMaterials,
    parseMarkdownOutlines,
    generateChapterOutlines,
    generateFromTemplate,
    supplementChapterOutlines
};
