const { v4: uuidv4 } = require('uuid');
const store = require('../../../store');
const { getModeConfig, cleanChapterContent, deduplicateContent, truncateChapter, validateTomatoMetrics, ensureCliffhanger } = require('../../contentUtils');
const { getVolumeSubplane } = require('../volumeHelpers');
const { detectGenre, getGenreWriterInjection } = require('../../genreConfig');
const { getStyleProfileForProject } = require('../../agentPrompts');
const materialIndex = require('../../materialIndex');
const reviewRemediation = require('../../reviewRemediation');
const trendingSearch = require('../../trendingSearch');

async function handleWriter(params) {
    const { projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput, round, mode, modeConfig, maxChapterWords, budget } = params;
    const project = store.getItem('projects', projectId);
    const outlineText = (chapter.outline || '').substring(0, 2000);
    agentContext.chapterOutline = outlineText;

    try {
        const discoverySummary = materialIndex.getDiscoverySummary(projectId);
        if (discoverySummary) {
            agentContext.discoveryLog = discoverySummary;
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

    const projectWordConfig = project?.wordConfig || {};
    const targetMin = projectWordConfig.targetMin || modeConfig.TARGET_MIN_WORDS || 2200;
    const targetMax = projectWordConfig.targetMax || modeConfig.TARGET_MAX_WORDS || 2800;
    const rejectMin = projectWordConfig.rejectMin || modeConfig.REJECT_MIN_WORDS || 1800;
    agentContext.content += `\n\n【字数要求 - 必须满足】本章目标字数：${targetMin}-${targetMax}字。硬性最低${rejectMin}字、上限${targetMax + 700}字。低于${rejectMin}字退回重写，超过${targetMax + 700}字退回精简。宁可多写不可少写，但不要超过${targetMax + 700}字。`;

    const MEMORY_COVERED = new Set(['character', 'worldview', 'power-system', 'relationship', 'foreshadowing', 'growth-history', 'equipment', 'faction']);
    const activeMats = materials.filter(m => m.projectId === projectId && !m.archived);
    const outlineLower = outlineText.toLowerCase();
    const styleProfile = getStyleProfileForProject(projectId);
    const genreWriterInjection = getGenreWriterInjection(detectGenre(styleProfile));

    const chapterScene = chapter.scene || '主世界';
    const volumeInfo = getVolumeSubplane(projectId, chapter.chapterNumber);
    const currentSubplaneId = volumeInfo ? volumeInfo.subplaneId : null;
    const isInSubplane = chapterScene !== '主世界' && chapterScene !== '';

    const subPlaneMats = activeMats.filter(m => m.type === 'sub-plane');
    const subPlaneEquip = activeMats.filter(m => m.type === 'equipment' && m.parentPlane && m.parentPlane !== '主世界');
    const subPlaneFactions = activeMats.filter(m => m.type === 'faction' && m.parentPlane && m.parentPlane !== '主世界');
    const subPlaneChars = activeMats.filter(m => m.type === 'character' && m.parentPlane && m.parentPlane !== '主世界');

    const relevantEquip = activeMats.filter(m => m.type === 'equipment' && (!m.parentPlane || m.parentPlane === '主世界') && !MEMORY_COVERED.has('equipment')).filter(e => {
        const nameLower = e.name.toLowerCase();
        return outlineLower.includes(nameLower) || outlineLower.includes(nameLower.split(/[-\s]/)[0]);
    });

    const locationMats = activeMats.filter(m => m.type === 'location').filter(l => {
        const nameLower = l.name.toLowerCase();
        const lNames = nameLower.split(/[-\s–—]/);
        return lNames.some(n => n.length >= 2 && outlineLower.includes(n));
    });

    const catchphraseMats = activeMats.filter(m => m.type === 'catchphrase').slice(0, 5);
    const sceneMats = activeMats.filter(m => m.type === 'famous-scene').slice(0, 3);

    const coreSettingMats = activeMats.filter(m => ['worldview', 'power-system', 'craft'].includes(m.type));

    let materialSection = '';
    const MATERIAL_BUDGET = 8000;
    let materialBudgetUsed = 0;
    const budgetAppend = (text) => {
        if (materialBudgetUsed + text.length > MATERIAL_BUDGET) {
            const remaining = MATERIAL_BUDGET - materialBudgetUsed;
            if (remaining > 100) {
                materialSection += text.substring(0, remaining) + '\n[素材注入已达预算上限]\n';
            }
            return false;
        }
        materialSection += text;
        materialBudgetUsed += text.length;
        return true;
    };

    if (coreSettingMats.length > 0) {
        budgetAppend('\n【⚠️ 核心设定 - 必须严格遵守，违反即退回】\n');
        for (const cs of coreSettingMats) {
            const csContent = (cs.currentContent || cs.initialContent || '');
            const maxLen = Math.min(csContent.length, 800);
            if (!budgetAppend(`--- ${cs.name} ---\n${csContent.substring(0, maxLen)}\n\n`)) break;
        }
    }

    if (subPlaneMats.length > 0) {
        const relevantSubPlanes = isInSubplane
            ? subPlaneMats.filter(sp => sp.id === currentSubplaneId || chapterScene.includes(sp.name))
            : subPlaneMats.filter(sp => sp.id === currentSubplaneId);

        if (isInSubplane) {
            if (budgetAppend('\n【当前次位面 - 本章场景】\n')) {
                for (const sp of relevantSubPlanes) {
                    const spContent = (sp.currentContent || sp.initialContent || '');
                    if (!budgetAppend(`▸ ${sp.name}: ${spContent.substring(0, 500)}\n`)) break;
                    const spFactions = subPlaneFactions.filter(f => f.parentPlane === sp.id);
                    for (const fac of spFactions) {
                        const facContent = (fac.currentContent || fac.initialContent || '');
                        if (!budgetAppend(`  └ ${fac.name}: ${facContent.substring(0, 200)}\n`)) break;
                        const facChars = subPlaneChars.filter(c => c.parentFaction === fac.id);
                        for (const chr of facChars) {
                            const chrContent = (chr.currentContent || chr.initialContent || '');
                            if (!budgetAppend(`    └ ${chr.name}: ${chrContent.substring(0, 200)}\n`)) break;
                        }
                    }
                    const spMechs = activeMats.filter(m => m.type === 'mechanism' && m.parentPlane === sp.id);
                    for (const mech of spMechs) {
                        const mechContent = (mech.currentContent || mech.initialContent || '');
                        if (!budgetAppend(`  └ 规则·${mech.name}: ${mechContent.substring(0, 200)}\n`)) break;
                    }
                    const spItems = subPlaneEquip.filter(i => i.parentPlane === sp.id);
                    if (spItems.length > 0) {
                        if (!budgetAppend(`  └ 可获取道具: ${spItems.map(i => i.name).join('、')}\n`)) break;
                    }
                }
            }
        } else {
            if (relevantSubPlanes.length > 0 && budgetAppend('\n【当前卷次位面概要 - 仅参考，本章在主世界】\n')) {
                for (const sp of relevantSubPlanes) {
                    const spContent = (sp.currentContent || sp.initialContent || '');
                    if (!budgetAppend(`▸ ${sp.name}: ${spContent.substring(0, 200)}\n`)) break;
                }
            }
        }
    }

    if (relevantEquip.length > 0) {
        if (budgetAppend('\n【本章相关装备/道具】\n')) {
            for (const e of relevantEquip) {
                const content = (e.currentContent || e.initialContent || '');
                if (!budgetAppend(`${e.name}: ${content.substring(0, 300)}\n`)) break;
            }
        }
    }

    if (locationMats.length > 0) {
        if (budgetAppend('\n【本章相关地点】\n')) {
            for (const l of locationMats) {
                const content = (l.currentContent || l.initialContent || '');
                if (!budgetAppend(`${l.name}: ${content.substring(0, 300)}\n`)) break;
            }
        }
    }

    if (catchphraseMats.length > 0) {
        if (budgetAppend('\n【经典台词参考- 优先使用已有台词】\n')) {
            for (const c of catchphraseMats) {
                const content = (c.currentContent || c.initialContent || '');
                if (!budgetAppend(`${c.name}: ${content.substring(0, 200)}\n`)) break;
            }
        }
    }

    if (sceneMats.length > 0) {
        if (budgetAppend('\n【关键名场面参考】\n')) {
            for (const s of sceneMats) {
                const content = (s.currentContent || s.initialContent || '');
                if (!budgetAppend(`${s.name}: ${content.substring(0, 150)}\n`)) break;
            }
        }
    }

    if (!MEMORY_COVERED.has('foreshadowing')) {
        const foreshadowMats = activeMats.filter(m => m.type === 'foreshadowing').filter(m => {
            if (!m.parentPlane || m.parentPlane === '主世界') return true;
            if (isInSubplane) return m.parentPlane === currentSubplaneId;
            return m.parentPlane === currentSubplaneId;
        });
        if (foreshadowMats.length > 0) {
            const pendingItems = [];
            for (const fm of foreshadowMats) {
                const fContent = (fm.currentContent || fm.initialContent || '');
                if (fContent.includes('未回收') || fContent.includes('挂起') || fContent.includes('待回收')) {
                    pendingItems.push(`▸ ${fm.name}: ${fContent.substring(0, 200)}`);
                }
            }
            if (pendingItems.length > 0) {
                budgetAppend('\n【未回收伏笔提醒 - 优先推进】\n');
                budgetAppend(pendingItems.join('\n') + '\n');
            }
        }
    }

    const projectForStyle = store.getItem('projects', projectId);
    let styleInjection = '';
    if (projectForStyle?.styleTemplateId) {
        const styleTemplate = store.getItem('style-templates', projectForStyle.styleTemplateId);
        if (styleTemplate) {
            const r = styleTemplate.rules || {};
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
                styleInjection = `\n【风格模板】${styleTemplate.name}】${rules}`;
            } else if (styleTemplate.example) {
                styleInjection = `\n【风格参考${styleTemplate.name}】请模仿以下文本的写作风格：${styleTemplate.example.substring(0, 2000)}`;
            }
        }
    }

    let characterRefSection = '';
    const characterMats = activeMats.filter(m => m.type === 'character').filter(m => {
        if (!m.parentPlane || m.parentPlane === '主世界') return true;
        if (isInSubplane) return m.parentPlane === currentSubplaneId;
        return m.parentPlane === currentSubplaneId;
    });
    const CHAR_DETAIL_BUDGET = 4000;
    let charDetailUsed = 0;
    if (characterMats.length > 0) {
        const refLines = [];
        const detailLines = [];
        for (const cm of characterMats) {
            const content = cm.currentContent || cm.initialContent || '';
            const name = cm.name;
            const refNames = cm.refNames;
            if (refNames && typeof refNames === 'object') {
                const parts = [];
                if (refNames.narrator) parts.push(`叙事称"${refNames.narrator}"`);
                if (refNames.byChild) parts.push(`角色叫"${refNames.byChild}"`);
                if (refNames.byAdult) parts.push(`他人称"${refNames.byAdult}"`);
                if (refNames.pronoun) parts.push(`代词用"${refNames.pronoun}"`);
                if (parts.length > 0) refLines.push(`${name}：${parts.join('，')}`);
            } else {
                const gender = content.includes('女') ? '她' : '他';
                refLines.push(`${name}：叙事称"${name}"，代词用"${gender}"`);
            }
            if (content.length > 10) {
                const maxDetailLen = Math.min(400, CHAR_DETAIL_BUDGET - charDetailUsed - 20);
                if (maxDetailLen > 50) {
                    detailLines.push(`▸ ${name}: ${content.substring(0, maxDetailLen)}`);
                    charDetailUsed += maxDetailLen + 20;
                }
            }
        }
        if (refLines.length > 0) {
            characterRefSection = `\n【角色称呼表 - 必须严格遵守，不得随意切换称呼】\n${refLines.join('\n')}\n代词规则：每段首次出现用全名，换段/换场景后必须重新用全名。两个同性角色同场景时严禁连续用代词。`;
        }
        if (detailLines.length > 0) {
            characterRefSection += `\n\n【角色当前状态 - 必须与素材一致，不得凭空编造角色信息】\n${detailLines.join('\n')}`;
        }
    }

    let narrativeBridgeSection = '';
    const skippedChapters = store.queryItems('chapters', { projectId }).filter(c => c.status === 'permanently-skipped' && c.chapterNumber < chapter.chapterNumber);
    if (skippedChapters.length > 0) {
        const bridgeMats = store.queryItems('materials', { projectId }).filter(m => m.type === 'narrative-bridge' && !m.archived);
        if (bridgeMats.length > 0) {
            narrativeBridgeSection = '\n\n【⚠️ 叙事断裂提醒 - 以下章节被跳过，必须在正文中自然过渡】\n';
            for (const bm of bridgeMats) {
                const bridgeContent = bm.currentContent || bm.initialContent || '';
                try {
                    const parsed = JSON.parse(bridgeContent);
                    narrativeBridgeSection += `\n--- 跳过章节：第${parsed.skippedChapter}章《${parsed.title}》---\n`;
                    narrativeBridgeSection += `跳过原因：${parsed.reason}\n`;
                    narrativeBridgeSection += `大纲概要：${parsed.outline || '无'}\n`;
                    narrativeBridgeSection += `内容摘要：${parsed.contentSummary || '无'}\n`;
                    narrativeBridgeSection += `关键事件：${parsed.keyEvents || '无'}\n`;
                    narrativeBridgeSection += `衔接指导：${parsed.narrativeBridge || '无'}\n`;
                } catch (_) {
                    narrativeBridgeSection += `\n${bridgeContent}\n`;
                }
            }
            narrativeBridgeSection += '\n【衔接规则】1.必须在本章前1/3处通过角色回忆/对话/场景暗示提及跳过章节的关键信息 2.不能假装跳过章节的事件没发生过 3.角色状态必须与跳过章节的结局一致';
        }
    }

    agentContext.content = `创作第${chapter.chapterNumber}章正文：

【输出规则】只输出纯正文，禁止思考/注释/大纲/总结/标记。系统清洗后只计正文字数——如果你输出500字思考+1500字正文，系统只算1500字判不足。所以把所有token用来写正文。目标${projectWordConfig.targetMin || modeConfig.TARGET_MIN_WORDS || 2200}-${projectWordConfig.targetMax || modeConfig.TARGET_MAX_WORDS || 2800}字，纯正文必须达标。
结构：场景1(铺垫≥400字)→场景2(核心≥600字)→场景3(推进≥500字)→场景4(钩子≥400字)。每场景含动作+对话+吐槽，环境最多2句带过。
防重复：不逐字复制前文，时间推进须有新动作/对话。

【文风硬约束 - 必须遵守】
- 接地气大白话，不要文青病。禁止堆砌华丽辞藻、空洞修辞、诗意描写
- 环境描写最多2句带过，把笔墨留给动作、对话、吐槽
- 幽默密度由题材插件和项目设定定义，审核时不得以固定百分比作为硬性通过标准
- 节奏要快，每章必须有明确剧情推进，禁止整章纯描写纯心理
- 禁止连续2段纯环境描写或纯心理活动

【段落节奏硬约束 - 必须遵守】
- 每段不超过150字，禁止超过200字的超长段落
- 对话必须独立成段，不要把对话和动作/心理塞同一段
- 动作描写、心理描写、环境描写分段呈现，不要混在一起
- 段落之间用空行分隔，保持阅读节奏
- 长场景拆分为短段落交替推进：环境→动作→对话→心理，每类各一段

标题：${chapter.title}
大纲：${outlineText}
${context.chapterIntent ? '\n' + context.chapterIntent + '\n' : ''}${context.hookAgenda ? '\n' + context.hookAgenda + '\n' : ''}${characterRefSection}${materialSection}${styleInjection}${genreWriterInjection ? '\n\n' + genreWriterInjection : ''}${narrativeBridgeSection}`;

    if (project?.styleGuidance) {
        budget.allocate('style_guidance', project.styleGuidance);
    }

    const remediationText = reviewRemediation.getWriterPromptInjection(projectId);
    if (remediationText) {
        budget.allocate('review_feedback', remediationText);
    }

    const projForRules = store.getItem('projects', projectId);
    if (projForRules?.writerPromptAdditions?.length > 0) {
        const adjusterRules = projForRules.writerPromptAdditions
            .filter(r => r.source === 'adjuster')
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
        if (adjusterRules) {
            agentContext.content += `\n\n【调整员追加规则 - 必须遵守】\n${adjusterRules}`;
        }
    }

    if (mode === 'shuangwen' || mode === 'tomato-short') {
        try {
            const trending = await trendingSearch.searchTrendingMemes(project?.genre || '玄幻', project?.name);
            if (trending.injectionHint) {
                agentContext.content += `\n\n${trending.injectionHint}`;
            }
        } catch (e) {
            console.warn('[PIPELINE] trending search failed, skipping:', e.message);
        }
    }
    if (chapter.content && round > 1) {
        const currentWc = chapter.content.replace(/\s/g, '').length;
        const wcTargetMin = projectWordConfig.targetMin || modeConfig.TARGET_MIN_WORDS || 2200;
        const wcTargetMax = projectWordConfig.targetMax || modeConfig.TARGET_MAX_WORDS || 2800;
        const wcRejectMin = projectWordConfig.rejectMin || modeConfig.REJECT_MIN_WORDS || 1800;
        if (currentWc < wcRejectMin) {
            const wcGap = wcTargetMin - currentWc;
            const ratio = currentWc / wcRejectMin;
            if (ratio < 0.6) {
                agentContext.content += `\n\n⚠️字数严重不足(${currentWc}字<最低${wcRejectMin})，必须完全重写，目标${wcTargetMin}-${wcTargetMax}字。`;
            } else {
                agentContext.content += `\n\n【当前正文(参考并扩展)】\n${chapter.content.substring(0, 5000)}\n\n⚠️字数不足(${currentWc}字，差${wcGap}字达目标)，重写完整章节并扩展每个场景，目标${wcTargetMin}字以上。`;
            }
        } else if (currentWc < wcTargetMin) {
            const wcGap = wcTargetMin - currentWc;
            agentContext.content += `\n\n【当前正文(参考并扩展)】\n${chapter.content.substring(0, 5000)}\n\n⚠️字数未达标(${currentWc}字，还需${wcGap}字)，扩展场景描写，不删减。`;
        } else {
            agentContext.content += `\n\n【当前正文(参考)】\n${chapter.content.substring(0, 5000)}`;
        }
    }
    if (context.reviewFeedback) {
        agentContext.content += `\n\n【审核反馈(必须修改)】\n${context.reviewFeedback.substring(0, 2000)}`;
        const currentWc = chapter.content ? chapter.content.replace(/\s/g, '').length : 0;
        const wcTargetMin = projectWordConfig.targetMin || modeConfig.TARGET_MIN_WORDS || 2200;
        if (currentWc > 0) {
            agentContext.content += `\n\n⚠️修改时字数保底：不删未涉及段落，替换内容≥原文，总字数≥${Math.max(currentWc, wcTargetMin)}字。`;
        }
    }
    console.log(`[PIPELINE] writer prompt length: ${agentContext.content.length}`);
    const result = await runAgent('writer', agentContext);
    if (!result.response || result.response.trim().length === 0) {
        console.error('[PIPELINE] writer returned empty response');
        throw new Error('Writer agent returned empty response. Model may have used all tokens for reasoning.');
    }
    chapter.content = cleanChapterContent(result.response);
    const rawLen = (result.response || '').replace(/\s/g, '').length;
    const cleanLen = (chapter.content || '').replace(/\s/g, '').length;
    if (rawLen > 0 && cleanLen / rawLen < 0.6) {
        console.warn(`[PIPELINE] ⚠️ Writer输出大量非正文内容！原始${rawLen}字→清洗后${cleanLen}字（保留率${(cleanLen/rawLen*100).toFixed(0)}%）。LLM可能输出了思考过程/注释等非正文内容。`);
    }
    chapter.writerOutput = chapter.content;
    chapter.status = 'written';
    chapter.round = round;

    const dedup = deduplicateContent(chapter.content);
    if (dedup.removed > 0) {
        console.log(`[PIPELINE] 去重: 移除${dedup.removed}处重复内容`);
        dedup.details.forEach(d => console.log(`  - ${d}`));
        chapter.content = dedup.content;
        chapter.wordCount = chapter.content.replace(/\s/g, '').length;
        console.log(`[PIPELINE] 去重后字数: ${chapter.wordCount}`);
    }
    chapter.wordCount = chapter.content.replace(/\s/g, '').length;

    if (chapter.wordCount > maxChapterWords) {
        console.log(`[PIPELINE] 字数超标: ${chapter.wordCount}字 > ${maxChapterWords}字，执行智能截断`);
        const truncated = truncateChapter(chapter.content, maxChapterWords);
        chapter.content = truncated.content;
        chapter.wordCount = truncated.content.replace(/\s/g, '').length;
        chapter.truncated = true;
        chapter.originalWordCount = result.response.length;
        console.log(`[PIPELINE] 截断完成: ${chapter.wordCount}字 (原${chapter.originalWordCount}字)`);
    }

    const rejectMinWords = projectWordConfig.rejectMin || modeConfig.REJECT_MIN_WORDS || 1800;
    if (chapter.wordCount < rejectMinWords) {
        const gap = rejectMinWords - chapter.wordCount;
        const targetMinWords = projectWordConfig.targetMin || modeConfig.TARGET_MIN_WORDS || 2200;
        const targetMaxWords = projectWordConfig.targetMax || modeConfig.TARGET_MAX_WORDS || 2800;
        console.warn(`[PIPELINE] 字数不达标: ${chapter.wordCount}字 < 最低${rejectMinWords}字，直接退回重写`);
        chapter._wordCountRejected = true;
        chapter._wordCountDetail = `${chapter.wordCount}字 < 最低${rejectMinWords}字`;
        chapter.status = 'written';
        chapter.updatedAt = new Date().toISOString();
        store.setItem('chapters', chapter.id, chapter);
        return {
            step: 'writer',
            result: { response: chapter.content },
            passed: false,
            feedback: {
                approved: false,
                summary: `【字数严重不足】当前${chapter.wordCount}字，距离最低${rejectMinWords}字还差${gap}字，距离目标${targetMinWords}-${targetMaxWords}字还差${targetMinWords - chapter.wordCount}字以上。必须大幅扩展内容，不能只做小幅修改。`,
                issues: [{ desc: `字数${chapter.wordCount}字低于最低要求${rejectMinWords}字，差${gap}字`, severity: 'critical' }],
                suggestions: [
                    `在现有场景之间插入新的过渡段落（至少${gap}字）`,
                    '为每个角色动作补充感官描写（视觉+听觉+触觉+嗅觉至少2种）',
                    '增加2-3段角色与环境的互动细节',
                    '在对话之间插入角色微动作和表情描写',
                    '扩展场景开场描写，用3-5句话铺垫环境氛围',
                    '如果场景转换太快，放慢节奏补充过渡'
                ],
                edits: []
            },
            materialGuidance: ''
        };
    }

    if (mode === 'tomato-short') {
        const tomatoValidation = validateTomatoMetrics(chapter.content);
        if (!tomatoValidation.pass) {
            console.log(`[PIPELINE] 番茄硬校验未通过: ${tomatoValidation.reason} ${tomatoValidation.detail || ''}`);
            chapter.tomatoValidation = tomatoValidation;
        } else {
            chapter.tomatoValidation = { pass: true };
            console.log(`[PIPELINE] 番茄硬校验通过`);
        }
    }
    if (mode === 'shuangwen' || mode === 'tomato-short') {
        chapter.content = ensureCliffhanger(chapter.content);
        chapter.wordCount = chapter.content.replace(/\s/g, '').length;
    }
    saveAgentOutput(projectId, chapter, 'writer', result.response);
    console.log(`[PIPELINE] writer done: wordCount=${chapter.wordCount}`);

    const writerQuests = store.listItems('quests').filter(q =>
        q.projectId === projectId && (q.chapterIds || []).includes(chapter.id) && q.status === 'planned'
    );
    for (const q of writerQuests) {
        await store.setItem('quests', q.id, { ...q, status: 'active', updatedAt: new Date().toISOString() });
    }

    return { step: 'writer', passed: true, result, chapter };
}

module.exports = { handleWriter };
