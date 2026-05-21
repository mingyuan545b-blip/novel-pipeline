const store = require('../store');
const fs = require('fs');
const path = require('path');
const { detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectOnomatopoeiaDensity, detectVisualAnchors, detectMotherChildDialogue, detectModernSlang, detectTellVerbs, calcInfoDripScore, extractEndingTension, detectCrossChapterRepetition, scanSensitiveWords, cleanChapterContent, cleanFinalContent, deduplicateContent, truncateChapter, ensureCliffhanger, validateTomatoMetrics, MODE_CONFIGS } = require('./contentUtils');
const { getStyleProfileForProject } = require('./agentPrompts');
const { detectGenre, getGenreReviewRules, getGenrePerspectiveSchema } = require('./genreConfig');

class ChapterAuditor {
    constructor(projectId) {
        this.projectId = projectId;
        this.project = store.getItem('projects', projectId);
        this.styleProfile = this.project?.styleProfile;
        this.genre = detectGenre(this.styleProfile);
        this.genreLabel = this.genre?.label || '通用';
    }

    auditChapter(chapterId) {
        const chapter = store.getItem('chapters', chapterId);
        if (!chapter) return { error: '章节不存在' };

        const content = chapter.content || '';
        if (!content || content.replace(/\s/g, '').length < 100) {
            return { chapterNumber: chapter.chapterNumber, violations: [], clean: true };
        }

        const violations = [];

        const adult = detectAdultPerspective(content, this.styleProfile);
        for (const issue of adult.issues) {
            if (issue.desc && issue.desc.includes('全知旁白')) {
                violations.push({ type: 'omniscient', severity: 'critical', desc: issue.desc, category: '全知旁白' });
            } else if (issue.severity === 'critical') {
                violations.push({ type: 'adultPerspective', severity: 'critical', desc: issue.desc, category: '视角越界' });
            } else if (issue.severity === 'high') {
                violations.push({ type: 'adultPerspective', severity: 'critical', desc: issue.desc, category: '视角越界' });
            }
        }

        const meta = detectPipelineMetadataLeak(content, this.styleProfile);
        for (const inst of (meta.instances || [])) {
            if (inst.type === '打破第四面墙' && !inst.allowable) {
                violations.push({ type: 'fourthWall', severity: 'critical', desc: `打破第四面墙："${inst.match}"→"${inst.suggestion}"`, category: '打破第四面墙', match: inst.match, suggestion: inst.suggestion });
            } else if (!inst.allowable) {
                violations.push({ type: 'metadataLeak', severity: 'critical', desc: `系统机制直述："${inst.match}"→"${inst.suggestion}"`, category: '系统机制直述' });
            }
        }

        const _genreQualityChecks = this.genre?.qualityChecks || {};

        const tech = detectTechJargon(content, this.styleProfile);
        const genreJargons = (tech.instances || []).filter(j => !j.allowable);
        if (genreJargons.length > 0 && _genreQualityChecks.terminology?.enabled !== false) {
            violations.push({
                type: 'techJargon',
                severity: 'critical',
                desc: `题材术语未降维(${genreJargons.length}处)：${genreJargons.slice(0, 5).map(j => `"${j.match}"→"${j.suggestion}"`).join('、')}`,
                category: '系统机制直述',
                jargons: genreJargons.map(j => ({ match: j.match, suggestion: j.suggestion, perspective: j.perspective }))
            });
        }

        const slang = detectModernSlang(content, this.styleProfile);
        if (slang.count > 0) {
            violations.push({ type: 'slang', severity: 'high', desc: `网络用语/网文腔(${slang.count}处)：${slang.instances.slice(0, 3).map(s => s.match).join('、')}`, category: '网络用语' });
        }

        const ono = detectOnomatopoeiaDensity(content, this.styleProfile);
        if (ono.issues && ono.issues.length > 0 && _genreQualityChecks.onomatopoeia?.enabled) {
            const onoIssue = ono.issues[0];
            violations.push({ type: 'noOnomatopoeia', severity: onoIssue.severity, desc: onoIssue.desc, category: '拟声词不足', count: ono.count });
        }

        const mc = detectMotherChildDialogue(content, this.styleProfile);
        if (mc.issues && mc.issues.length > 0 && _genreQualityChecks.motherChildDialogue?.enabled) {
            const mcIssue = mc.issues[0];
            violations.push({ type: 'noDialogue', severity: mcIssue.severity, desc: mcIssue.desc, category: '对话不足', count: mc.count });
        }

        const vis = detectVisualAnchors(content, this.styleProfile);
        if (vis.issues && vis.issues.length > 0) {
            const visIssue = vis.issues[0];
            violations.push({ type: 'noVisualAnchor', severity: visIssue.severity, desc: visIssue.desc, category: '视觉锚点不足', count: vis.count });
        }

        try {
            const tellVerbs = detectTellVerbs(content);
            if (tellVerbs.count > 5) {
                violations.push({ type: 'tellVerbs', severity: 'medium', desc: `告知式动词过多(${tellVerbs.count}处)，建议改为感官描写`, category: '告知式描写' });
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const infoDrip = calcInfoDripScore(content);
            if (infoDrip.score < 0.4) {
                violations.push({ type: 'infoDump', severity: 'medium', desc: `设定说明堆砌(节奏分${infoDrip.score.toFixed(1)}，目标≥0.4)`, category: '设定堆砌' });
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const ending = extractEndingTension(content);
            if (!ending.hasTension) {
                violations.push({ type: 'noTension', severity: 'medium', desc: '章节收尾缺乏张力/悬念钩子', category: '收尾张力不足' });
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const chapters = store.queryItems('chapters', c => c.projectId === this.projectId);
            const prevChapter = chapters.find(c => c.chapterNumber === chapter.chapterNumber - 1);
            if (prevChapter?.content) {
                const crossRep = detectCrossChapterRepetition(content, prevChapter.content);
                if (crossRep.hasRepetition) {
                    violations.push({ type: 'crossChapterRep', severity: 'high', desc: `与上一章内容重复(${crossRep.instances?.length || 0}处)`, category: '跨章重复' });
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const sensitive = scanSensitiveWords(content);
            const blocks = (sensitive.instances || []).filter(i => i.severity === 'block');
            if (blocks.length > 0) {
                violations.push({ type: 'sensitiveWords', severity: 'critical', desc: `敏感词(${blocks.length}处): ${blocks.slice(0, 3).map(i => `"${i.match}"`).join('、')}`, category: '敏感词' });
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        const modeConfig = MODE_CONFIGS[this.project?.mode || 'novel'] || MODE_CONFIGS.novel;
        const wc = content.replace(/\s/g, '').length;
        if (wc < modeConfig.REJECT_MIN_WORDS) {
            violations.push({ type: 'wordCountTooLow', severity: 'critical', desc: `字数${wc}低于最低要求${modeConfig.REJECT_MIN_WORDS}字，还差${modeConfig.REJECT_MIN_WORDS - wc}字`, category: '字数不足', current: wc, target: modeConfig.REJECT_MIN_WORDS, gap: modeConfig.REJECT_MIN_WORDS - wc });
        }
        if (wc > modeConfig.MAX_CHAPTER_WORDS) {
            violations.push({ type: 'wordCountTooHigh', severity: 'high', desc: `字数${wc}超出上限${modeConfig.MAX_CHAPTER_WORDS}字，超出${wc - modeConfig.MAX_CHAPTER_WORDS}字`, category: '字数超标', current: wc, target: modeConfig.MAX_CHAPTER_WORDS, gap: wc - modeConfig.MAX_CHAPTER_WORDS });
        }

        if (chapter.title && chapter.title.includes('小满版') && this.genre?.id === 'baby') {
            violations.push({ type: 'titleSuffix', severity: 'medium', desc: '标题含"·小满版"后缀', category: '标题格式' });
        }

        if (chapter.title && this.genre?.id === 'baby') {
            const techTitlePattern = /.{2,10}(与|和).{2,10}的.{2,12}(阀|舱|器|系统|装置|模块|层|网|栅|枢|匣|桥|阵|膜|筒|管|环|计|穹|帐|藤|盘|闸|桩|槽|廊|界|床|弦|台|笛|堤|阈|壁|带|阱|脊|幕|帷|庭|腔|渠|坝|巢|茧|枕|毯|垫|堰|屏|囊|脉|泵|隙|结)$/;
            if (techTitlePattern.test(chapter.title)) {
                violations.push({ type: 'techTitle', severity: 'high', desc: `标题风格偏技术说明书："${chapter.title}"，应改为诗情画意的感官意象命名`, category: '标题风格' });
            }
        }

        const result = {
            chapterId: chapter.id,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            wordCount: content.replace(/\s/g, '').length,
            violations,
            criticalCount: violations.filter(v => v.severity === 'critical').length,
            highCount: violations.filter(v => v.severity === 'high').length,
            clean: violations.length === 0,
            auditedAt: new Date().toISOString()
        };

        store.setItem('chapter-audits', chapter.id, result);
        return result;
    }

    auditAll() {
        const chapters = store.queryItems('chapters')
            .filter(c => c.projectId === this.projectId && !c.archived && c.content)
            .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

        const results = [];
        const summary = { total: chapters.length, clean: 0, withViolations: 0, critical: 0, types: {} };

        for (const ch of chapters) {
            const result = this.auditChapter(ch.id);
            results.push(result);
            if (result.clean) { summary.clean++; }
            else { summary.withViolations++; }
            if (result.criticalCount > 0) summary.critical++;
            for (const v of result.violations) {
                summary.types[v.type] = (summary.types[v.type] || 0) + 1;
            }
        }

        return { summary, results, auditedAt: new Date().toISOString() };
    }

    getAudit(chapterId) {
        const cached = store.getItem('chapter-audits', chapterId);
        if (cached) return cached;
        return this.auditChapter(chapterId);
    }

    getViolationsByType(type) {
        const chapters = store.queryItems('chapters')
            .filter(c => c.projectId === this.projectId && !c.archived && c.content);

        const results = [];
        for (const ch of chapters) {
            const audit = this.getAudit(ch.id);
            const matching = audit.violations?.filter(v => v.type === type) || [];
            if (matching.length > 0) {
                results.push({ chapterNumber: ch.chapterNumber, chapterId: ch.id, title: ch.title, violations: matching });
            }
        }
        return results;
    }

    async repairChapter(chapterId, repairInstructions, llmService, options = {}) {
        const chapter = store.getItem('chapters', chapterId);
        if (!chapter) return { success: false, error: '章节不存在' };

        const audit = this.auditChapter(chapterId);
        if (audit.clean) return { success: false, error: '章节无违规，无需返修' };

        const oldContent = chapter.content || '';
        const oldWordCount = oldContent.replace(/\s/g, '').length;

        const violationSummary = audit.violations.map(v => {
            let line = `[${v.severity}][${v.category}] ${v.desc}`;
            if (v.match) line += ` | 原文匹配:"${v.match}"`;
            if (v.suggestion) line += ` | 建议:${v.suggestion}`;
            if (v.jargons && v.jargons.length > 0) line += ` | 术语替换:${v.jargons.map(j => `"${j.match}"→"${j.suggestion}"`).join('、')}`;
            if (v.type === 'wordCountTooLow') line += ` | 当前${v.current}字，目标${v.target}字，差${v.gap}字`;
            if (v.type === 'wordCountTooHigh') line += ` | 当前${v.current}字，上限${v.target}字，超${v.gap}字`;
            return line;
        }).join('\n');

        const project = store.getItem('projects', this.projectId);
        const styleProfile = getStyleProfileForProject(this.projectId);
        const styleSection = styleProfile ? `
【本作风格配置（最高优先级，与返修规则冲突时以此为准）】
视角规则: ${styleProfile.povRule || ''}
对话规则: ${styleProfile.dialogueRule || ''}
行为规则: ${styleProfile.behaviorRule || ''}
语气基调: ${styleProfile.toneRule || ''}
称呼规范: ${styleProfile.characterRefRules || ''}` : '';

        const reviewFeedback = chapter.firstReviewOutput || chapter.secondReviewOutput || '';
        const reviewIssues = (() => {
            try {
                const parsed = typeof reviewFeedback === 'string' ? JSON.parse(reviewFeedback.match(/\{[\s\S]*\}/)?.[0] || '{}') : reviewFeedback;
                const issues = parsed.issues || [];
                const suggestions = parsed.suggestions || [];
                let text = '';
                if (issues.length > 0) {
                    text += '审核问题（必须逐条修复）:\n' + issues.map(i => {
                        let line = `- [${i.severity || 'medium'}] ${i.title || ''}`;
                        if (i.location) line += ` | 位置: ${i.location}`;
                        if (i.originalText) line += ` | 原文: "${i.originalText}"`;
                        if (i.perspective) line += ` | 视角: ${i.perspective}`;
                        if (i.violationReason) line += ` | 违规原因: ${i.violationReason}`;
                        if (i.howToFix) line += ` | 修改方式: ${i.howToFix}`;
                        if (i.targetText) line += ` | 改为: "${i.targetText}"`;
                        if (!i.originalText && !i.violationReason && i.description) line += ` | ${i.description}`;
                        return line;
                    }).join('\n');
                }
                if (suggestions.length > 0) text += '\n审核建议:\n' + suggestions.map(s => `- ${s.title}: ${s.description}`).join('\n');
                return text;
            } catch { return ''; }
        })();

        const _repairReviewRules = getGenreReviewRules(this.genre);
        const _repairTerminologyDimmingRule = _repairReviewRules?.reviser?.terminologyDimmingRule || '';
        const _repairPerspectiveRule = _repairReviewRules?.reviser?.perspectiveRule || '';
        const _repairRepairRules = _repairReviewRules?.reviser?.repairRules || '';

        const repairPrompt = `你是小说返修专家。请严格按以下要求修改章节内容。

【章节信息】第${chapter.chapterNumber}章 "${chapter.title}" (${oldWordCount}字)

【检测到的违规问题】
${violationSummary}
${reviewIssues ? '\n【审核员反馈（必须逐条修复）】\n' + reviewIssues : ''}
${styleSection}

【人工返修指令】
${repairInstructions || '请修复上述所有违规问题，保持原文风格和情节不变'}

【返修规则 - 必须严格遵守，违反任何一条将被拒绝】
${_repairRepairRules ? _repairRepairRules : `1. 【视角越界修复核心原则】用角色感知段落替换全知旁白/纯叙述段落，保持情节推进不变`}
2. 修改后字数必须在${oldWordCount > 2800 ? Math.floor(Math.min(oldWordCount * 0.75, 2800 * 0.8)) : Math.floor(oldWordCount * 0.75)}~${oldWordCount > 2800 ? '2800~3500' : Math.floor(oldWordCount * 1.3)}字之间，原文${oldWordCount}字${oldWordCount > 3500 ? '（超标精简模式：必须精简至3500字以内，删除冗余描写和重复段落）' : '（替换式修复字数应接近原文，仅补细节允许小幅增加）'}
3. 禁止扩展情节、添加新场景，但允许在已有段落中补入感官细节
4. 【critical】全知旁白→改为角色感知视角（通过角色看/听/感觉引入信息），绝对禁止上帝视角叙述
5. 【critical】打破第四面墙→删除章回引用，改为"之前""早先""前几天"
9. 只输出修改后的完整章节正文，不要输出任何其他内容
${_repairTerminologyDimmingRule ? '\n' + _repairTerminologyDimmingRule + '\n' : ''}
${_repairPerspectiveRule ? '\n' + _repairPerspectiveRule + '\n' : ''}`;

        try {
            let apiConfig;
            const requestedProvider = options.provider;
            const requestedModel = options.model;

            if (requestedProvider) {
                apiConfig = this._buildApiConfig(requestedProvider, requestedModel);
            } else {
                apiConfig = this._getDefaultRepairConfig();
            }

            const messages = [
                { role: 'system', content: '你是专业小说返修编辑。只输出修改后的完整正文，禁止输出思考/注释/大纲。' },
                { role: 'user', content: repairPrompt + '\n\n【原文】\n' + oldContent }
            ];

            console.log(`[AUDITOR] Repair Ch${chapter.chapterNumber} using ${apiConfig.provider}/${apiConfig.model}`);
            const result = await llmService.chat(messages, { maxTokens: 32768, apiConfig });

            const usedModel = result?.model || apiConfig.model || 'unknown';
            const usedProvider = apiConfig.provider || 'unknown';

            let newContent = '';
            if (result?.choices?.[0]?.message?.content) {
                const rawContent = result.choices[0].message.content;
                if (typeof rawContent === 'string') {
                    newContent = rawContent;
                } else if (Array.isArray(rawContent)) {
                    newContent = rawContent
                        .filter(block => block.type === 'text' && block.text)
                        .map(block => block.text)
                        .join('\n');
                    console.log(`[AUDITOR] Converted array content to string, length: ${newContent.length}`);
                } else {
                    console.error('[AUDITOR] Unexpected content type:', typeof rawContent, JSON.stringify(rawContent).substring(0, 200));
                    newContent = String(rawContent || '');
                }
            } else if (result?.response) {
                newContent = typeof result.response === 'string' ? result.response : String(result.response || '');
            } else if (typeof result === 'string') {
                newContent = result;
            } else {
                console.error('[AUDITOR] Unexpected LLM response format:', JSON.stringify(result).substring(0, 500));
                return { success: false, error: 'LLM返回格式异常，无法提取内容', usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };
            }
            newContent = cleanChapterContent(newContent);
            const dedupResult = deduplicateContent(newContent);
            newContent = dedupResult.content || newContent;
            newContent = cleanFinalContent(newContent);
            if (typeof newContent !== 'string') {
                console.error('[AUDITOR] newContent is not string after processing:', typeof newContent, JSON.stringify(newContent).substring(0, 200));
                newContent = String(newContent || '');
            }

            const modeConfig = MODE_CONFIGS[this.project?.mode || 'novel'] || MODE_CONFIGS.novel;
            const projectMode = this.project?.mode || 'novel';

            if (projectMode === 'tomato-short') {
                const tomatoValidation = validateTomatoMetrics(newContent);
                if (!tomatoValidation.pass) {
                    console.warn(`[AUDITOR] 番茄硬校验未通过: ${tomatoValidation.reason} ${tomatoValidation.detail || ''}`);
                }
            }
            if (projectMode === 'shuangwen' || projectMode === 'tomato-short') {
                newContent = ensureCliffhanger(newContent);
            }
            const rejectMin = modeConfig.REJECT_MIN_WORDS;
            const maxWords = modeConfig.MAX_CHAPTER_WORDS;
            const targetMin = modeConfig.TARGET_MIN_WORDS;
            const targetMax = modeConfig.TARGET_MAX_WORDS;

            if (typeof newContent !== 'string') {
                console.error('[AUDITOR] newContent became non-string before word count! type:', typeof newContent);
                newContent = String(newContent || '');
            }
            const newWordCount = newContent.replace(/\s/g, '').length;

            const isOverMax = oldWordCount > maxWords;
            const wordCountMinLimit = isOverMax
                ? Math.min(oldWordCount * 0.75, maxWords * 0.8)
                : oldWordCount * 0.75;
            if (newWordCount < wordCountMinLimit) {
                return { success: false, error: `返修后字数${newWordCount}少于允许下限${Math.floor(wordCountMinLimit)}字（原文${oldWordCount}字${isOverMax ? '，超标精简模式' : ''}），可能丢失内容`, usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };
            }
            const wordCountIncreaseLimit = oldWordCount < rejectMin
                ? Math.max(oldWordCount * 1.3, rejectMin * 1.15)
                : Math.min(oldWordCount * 1.3, maxWords * 1.15);
            if (newWordCount > wordCountIncreaseLimit) {
                return { success: false, error: `返修后字数${newWordCount}超出允许上限${Math.floor(wordCountIncreaseLimit)}字（原文${oldWordCount}字，内容膨胀），已拒绝`, usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };
            }
            if (newWordCount < rejectMin) {
                return { success: false, error: `返修后字数${newWordCount}低于最低要求${rejectMin}字`, usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };
            }
            if (newWordCount > maxWords * 1.15) {
                const truncResult = truncateChapter(newContent, Math.floor(maxWords * 1.15));
                newContent = truncResult.content;
                const truncatedCount = newContent.replace(/\s/g, '').length;
                console.log(`[AUDITOR] Truncated from ${newWordCount} to ${truncatedCount} (max ${Math.floor(maxWords * 1.15)})`);
            }

            const hardBlockResult = this._runHardBlockChecks(newContent);
            if (hardBlockResult.blocked) {
                return { success: false, error: `返修后硬性检测拦截：${hardBlockResult.issues.join('；')}`, hardBlockIssues: hardBlockResult.issues, usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };
            }

            const finalWordCount = newContent.replace(/\s/g, '').length;

            const snapshot = {
                id: `snap_repair_${Date.now()}`,
                chapterId,
                projectId: this.projectId,
                oldContent: oldContent.substring(0, 5000),
                oldWordCount,
                oldPolishedContent: (chapter.polishedContent || '').substring(0, 5000),
                oldNormalContent: (chapter.normalContent || '').substring(0, 5000),
                repairedAt: new Date().toISOString(),
                repairInstructions,
                violationsFixed: audit.violations.map(v => v.type)
            };
            store.setItem('repair-snapshots', snapshot.id, snapshot);

            chapter.content = newContent;
            chapter.normalContent = newContent;
            chapter.polishedContent = newContent;
            chapter.updatedAt = new Date().toISOString();
            chapter._needsReReview = true;
            if (!chapter.history) chapter.history = [];
            chapter.history.push({
                round: 0,
                step: 'targeted-repair',
                content: newContent.substring(0, 500),
                wordCount: newWordCount,
                repairInstructions,
                usedModel,
                usedProvider,
                timestamp: new Date().toISOString()
            });
            store.setItem('chapters', chapterId, chapter);

            const reAudit = this.auditChapter(chapterId);

            this._updateMaterial(chapterId, oldContent, newContent);

            const repairResult = {
                success: true,
                chapterNumber: chapter.chapterNumber,
                chapterId,
                oldWordCount,
                newWordCount: finalWordCount,
                wordCountDelta: finalWordCount - oldWordCount,
                violationsBefore: audit.violations.length,
                violationsAfter: reAudit.violations.length,
                violationsFixed: audit.violations.length - reAudit.violations.length,
                remainingViolations: reAudit.violations,
                snapshotId: snapshot.id,
                usedModel,
                usedProvider,
                reviewResults: null,
                contentBefore: oldContent,
                contentAfter: newContent,
                contentDiff: this._generateDiff(oldContent, newContent)
            };

            if (options.autoReview) {
                repairResult.reviewResults = await this.reviewChapter(chapterId, llmService, apiConfig);
            }

            return repairResult;
        } catch (err) {
            console.error('[CHAPTER_AUDITOR] Repair error:', err);
            return { success: false, error: err.message };
        }
    }

    _getDefaultRepairConfig() {
        const reviserConfig = this.project?.agentModelConfig?.reviser;
        if (reviserConfig) {
            const cfg = { ...reviserConfig };
            if (cfg.provider === 'aliyunCoding' && !cfg.apiKey && process.env.ALIYUN_CODING_API_KEY) {
                cfg.apiKey = process.env.ALIYUN_CODING_API_KEY;
                if (!cfg.model) cfg.model = process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus';
                if (!cfg.baseURL) cfg.baseURL = 'https://coding.dashscope.aliyuncs.com/v1';
            }
            if (cfg.provider === 'minimax' && !cfg.apiKey && process.env.MINIMAX_API_KEY) {
                cfg.apiKey = process.env.MINIMAX_API_KEY;
                if (!cfg.model) cfg.model = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
                if (!cfg.baseURL) cfg.baseURL = 'https://api.minimaxi.com/v1';
                if (!cfg.groupId) cfg.groupId = process.env.MINIMAX_GROUP_ID || '';
            }
            if (cfg.provider === 'siliconflow' && !cfg.apiKey && process.env.SILICONFLOW_API_KEY) {
                cfg.apiKey = process.env.SILICONFLOW_API_KEY;
                if (!cfg.baseURL) cfg.baseURL = 'https://api.siliconflow.cn/v1';
            }
            if (cfg.provider === 'deepseek' && !cfg.apiKey && process.env.DEEPSEEK_API_KEY) {
                cfg.apiKey = process.env.DEEPSEEK_API_KEY;
                if (!cfg.baseURL) cfg.baseURL = 'https://api.deepseek.com';
            }
            if (cfg.provider === 'lmstudio' && !cfg.apiKey) {
                cfg.apiKey = 'lmstudio';
                if (!cfg.baseURL) cfg.baseURL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
            }
            return cfg;
        }
        if (process.env.MINIMAX_API_KEY) {
            return {
                provider: 'minimax',
                apiKey: process.env.MINIMAX_API_KEY,
                groupId: process.env.MINIMAX_GROUP_ID || '',
                model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
                baseURL: 'https://api.minimaxi.com/v1'
            };
        }
        if (process.env.ALIYUN_CODING_API_KEY) {
            return {
                provider: 'aliyunCoding',
                apiKey: process.env.ALIYUN_CODING_API_KEY,
                model: process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus',
                baseURL: 'https://coding.dashscope.aliyuncs.com/v1'
            };
        }
        if (process.env.LLM_PROVIDER === 'lmstudio') {
            return {
                provider: 'lmstudio',
                apiKey: 'lmstudio',
                model: process.env.LMSTUDIO_MODEL || 'default',
                baseURL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
            };
        }
        return {
            provider: 'minimax',
            apiKey: process.env.MINIMAX_API_KEY || '',
            groupId: process.env.MINIMAX_GROUP_ID || '',
            model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
            baseURL: 'https://api.minimaxi.com/v1'
        };
    }

    _buildApiConfig(provider, model) {
        if (provider === 'minimax') {
            return {
                provider: 'minimax',
                apiKey: process.env.MINIMAX_API_KEY || '',
                groupId: process.env.MINIMAX_GROUP_ID || '',
                model: model || process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
                baseURL: 'https://api.minimaxi.com/v1'
            };
        }
        if (provider === 'aliyunCoding') {
            return {
                provider: 'aliyunCoding',
                apiKey: process.env.ALIYUN_CODING_API_KEY || '',
                model: model || process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus',
                baseURL: 'https://coding.dashscope.aliyuncs.com/v1'
            };
        }
        if (provider === 'lmstudio') {
            return {
                provider: 'lmstudio',
                apiKey: 'lmstudio',
                model: model || process.env.LMSTUDIO_MODEL || 'default',
                baseURL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
            };
        }
        return {
            provider,
            model: model || 'default',
            apiKey: process.env.LLM_API_KEY || '',
            baseURL: process.env.LLM_BASE_URL || ''
        };
    }

    async reviewChapter(chapterId, llmService, apiConfig) {
        const chapter = store.getItem('chapters', chapterId);
        if (!chapter) return { error: '章节不存在' };

        const content = chapter.content || '';
        const wordCount = content.replace(/\s/g, '').length;
        const reviewConfig = apiConfig || this._getDefaultRepairConfig();
        const styleProfile = this.styleProfile;
        const _reviewRules = getGenreReviewRules(this.genre);
        const _perspectiveRule = _reviewRules?.firstReview?.perspectiveRule || '';
        const _terminologyRule = _reviewRules?.firstReview?.terminologyRule || '';
        const _outputRule = _reviewRules?.firstReview?.outputRule || '';
        const _perspectiveSchema = getGenrePerspectiveSchema(this.genre);
        const _perspectiveField = _perspectiveSchema.fields;
        const _perspectiveLabel = _perspectiveSchema.label;

        const _genreSpecificChecks = this.genre?.id === 'baby'
            ? `3. 【critical】系统机制直述/幼崽视角术语未降维（管线元数据泄露、专业术语出现在幼崽视角段落）
4. 【critical】视角越界（成人化描写、混合视角、幼崽成人化内心独白）
5. 网络用语/网文腔
6. 拟声词不足
7. 母子对话缺失`
            : `3. 【critical】系统机制直述/管线元数据泄露
4. 【critical】视角越界（上帝视角、全知旁白）
5. 网络用语/网文腔`;

        const reviewPrompt = `你是小说初审复审员。请审核以下章节内容，检查是否存在以下问题：
1. 【critical】全知旁白（信息未通过角色感官自然过渡，上帝视角叙述）
2. 【critical】打破第四面墙（章回引用、元叙事）
${_genreSpecificChecks}

【章节信息】第${chapter.chapterNumber}章 "${chapter.title}" (${wordCount}字)

${this._buildTechniqueHints(content)}
${_perspectiveRule ? '\n' + _perspectiveRule + '\n' : ''}${_terminologyRule ? '\n' + _terminologyRule + '\n' : ''}${_outputRule ? '\n' + _outputRule + '\n' : ''}
【审核输出要求 - 极其重要】
先输出可读的Markdown审核报告，末尾附JSON数据块。

Markdown报告格式：
## 审核结果：✅通过 / ❌未通过
**审核概要**：一句话总结
### 问题列表
1. **[critical] 问题类型** - 位置：第X段
   - 原文："..."
   - ${_perspectiveLabel}
   - 违规原因：...
   - 修改建议：...
   - 改写为："..."
### 建议
- ...

末尾附JSON数据块：
\`\`\`json
{"passed":true/false,"summary":"概述","issues":[{"title":"问题类型","location":"位置","originalText":"原文",${_perspectiveField},"violationReason":"违规原因","howToFix":"修改方法","targetText":"改写后","severity":"critical/high/medium"}],"suggestions":[{"title":"标题","description":"步骤"}]}
\`\`\`

issues中每个问题必须包含完整修改指导，让返修员能直接按指导修改，无需猜测。`;

        try {
            console.log(`[AUDITOR] Review Ch${chapter.chapterNumber} using ${reviewConfig.provider}/${reviewConfig.model}`);
            const _systemPrompt = this.genre?.id === 'baby'
                ? '你是专业小说审核编辑。严格按幼崽视角规则审核，先输出可读Markdown报告，末尾附JSON数据块，绝不输出小说正文。'
                : `你是专业小说审核编辑。严格按${this.genreLabel}题材规则审核，先输出可读Markdown报告，末尾附JSON数据块，绝不输出小说正文。`;
            const messages = [
                { role: 'system', content: _systemPrompt },
                { role: 'user', content: reviewPrompt + '\n\n【章节正文】\n' + content.substring(0, 8000) }
            ];

            const result = await llmService.chat(messages, { maxTokens: 8192, apiConfig: reviewConfig });

            const usedModel = result?.model || reviewConfig.model || 'unknown';
            const usedProvider = reviewConfig.provider || 'unknown';

            let reviewContent = '';
            if (result?.choices?.[0]?.message?.content) {
                const rawContent = result.choices[0].message.content;
                if (typeof rawContent === 'string') {
                    reviewContent = rawContent;
                } else if (Array.isArray(rawContent)) {
                    reviewContent = rawContent
                        .filter(block => block.type === 'text' && block.text)
                        .map(block => block.text)
                        .join('\n');
                } else {
                    reviewContent = String(rawContent || '');
                }
            } else if (typeof result === 'string') {
                reviewContent = result;
            }

            let parsed = null;
            try {
                const jsonMatch = reviewContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
            } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

            if (parsed) {
                const hardBlockResult = this._runHardBlockChecks(content);
                const hardBlockIssues = hardBlockResult.issues.map(issue => ({
                    title: '硬性检测拦截',
                    description: issue,
                    severity: 'critical'
                }));

                return {
                    passed: !!parsed.passed && !hardBlockResult.blocked,
                    summary: parsed.summary || '',
                    issues: [...(parsed.issues || []), ...hardBlockIssues],
                    suggestions: parsed.suggestions || [],
                    reviewContent,
                    usedModel,
                    usedProvider,
                    wordCount,
                    chapterNumber: chapter.chapterNumber
                };
            }

            const passed = reviewContent.includes('通过') && !reviewContent.includes('未通过');

            return {
                passed,
                summary: passed ? '审核通过' : '审核未通过',
                issues: passed ? [] : [{ title: '审核未通过', description: reviewContent.substring(0, 500), severity: 'high' }],
                suggestions: [],
                reviewContent,
                usedModel,
                usedProvider,
                wordCount,
                chapterNumber: chapter.chapterNumber
            };
        } catch (err) {
            console.error('[CHAPTER_AUDITOR] Review error:', err);
            return { error: err.message, passed: false, issues: [], suggestions: [] };
        }
    }

    _updateMaterial(chapterId, oldContent, newContent) {
        const materials = store.queryItems('materials')
            .filter(m => m.projectId === this.projectId && !m.archived);

        for (const mat of materials) {
            if (mat.currentContent && oldContent.includes(mat.currentContent.substring(0, 50))) {
                const oldSnippet = mat.currentContent;
                const snippetStart = newContent.indexOf(oldSnippet.substring(0, 30));
                if (snippetStart === -1) {
                    const idx = newContent.indexOf(mat.currentContent.substring(0, 20));
                    if (idx >= 0) {
                        const updatedSnippet = newContent.substring(idx, Math.min(idx + oldSnippet.length, newContent.length));
                        if (updatedSnippet !== oldSnippet) {
                            mat.currentContent = updatedSnippet;
                            mat.updatedAt = new Date().toISOString();
                            if (!mat.changeLog) mat.changeLog = [];
                            mat.changeLog.push({
                                type: 'repair-update',
                                timestamp: new Date().toISOString(),
                                oldContent: oldSnippet.substring(0, 200),
                                newContent: updatedSnippet.substring(0, 200)
                            });
                            if (mat.changeLog.length > 5) mat.changeLog = mat.changeLog.slice(-5);
                            store.setItem('materials', mat.id, mat);
                        }
                    }
                }
            }
        }
    }

    rollbackRepair(snapshotId) {
        const snapshot = store.getItem('repair-snapshots', snapshotId);
        if (!snapshot) return { success: false, error: '快照不存在' };

        const chapter = store.getItem('chapters', snapshot.chapterId);
        if (!chapter) return { success: false, error: '章节不存在' };

        chapter.content = snapshot.oldContent;
        chapter.normalContent = snapshot.oldNormalContent || snapshot.oldContent;
        chapter.polishedContent = snapshot.oldPolishedContent || snapshot.oldContent;
        chapter.updatedAt = new Date().toISOString();
        store.setItem('chapters', snapshot.chapterId, chapter);

        this.auditChapter(snapshot.chapterId);

        return { success: true, chapterNumber: chapter.chapterNumber, restoredWordCount: snapshot.oldWordCount };
    }

    async repairWithRetry(chapterId, repairInstructions, llmService, pipelineService, options = {}) {
        const maxRetries = options.maxRetries || 10;
        const autoReview = options.autoReview !== false;
        const followUpPipeline = options.followUpPipeline !== false;
        const provider = options.provider;
        const model = options.model;
        const onProgress = options.onProgress;

        const repairOpts = { provider, model, autoReview };
        let lastResult = null;
        let attempt = 0;
        const attemptHistory = [];

        while (attempt < maxRetries) {
            attempt++;
            if (options.shouldCancel && options.shouldCancel()) {
                lastResult = lastResult || { success: false, error: '用户取消' };
                lastResult.cancelled = true;
                lastResult.attempts = attempt - 1;
                break;
            }
            if (onProgress) onProgress({ phase: 'repair', attempt, chapterId, totalAttempts: maxRetries });

            lastResult = await this.repairChapter(chapterId, repairInstructions, llmService, repairOpts);
            if (!lastResult.success) {
                attemptHistory.push({
                    attempt,
                    phase: 'repair',
                    success: false,
                    error: lastResult.error,
                    repairModel: lastResult.usedProvider && lastResult.usedModel ? `${lastResult.usedProvider}/${lastResult.usedModel}` : null,
                    timestamp: new Date().toISOString()
                });
                if (onProgress) onProgress({ phase: 'repair-failed', attempt, error: lastResult.error });
                break;
            }

            const auditClean = lastResult.violationsAfter === 0;
            const hasCriticalViolation = (lastResult.remainingViolations || []).some(v => v.severity === 'critical');
            const reviewPassed = lastResult.reviewResults?.passed !== false;

            const attemptRecord = {
                attempt,
                phase: 'repair+review',
                success: true,
                violationsBefore: lastResult.violationsBefore,
                violationsAfter: lastResult.violationsAfter,
                violationsFixed: lastResult.violationsFixed,
                remainingViolations: lastResult.remainingViolations,
                wordCount: { before: lastResult.oldWordCount, after: lastResult.newWordCount, delta: lastResult.wordCountDelta },
                auditClean,
                reviewPassed,
                reviewSummary: lastResult.reviewResults?.summary || null,
                reviewIssues: lastResult.reviewResults?.issues || null,
                reviewSuggestions: lastResult.reviewResults?.suggestions || null,
                reviewContent: lastResult.reviewResults?.reviewContent || null,
                reviewModel: lastResult.reviewResults ? `${lastResult.reviewResults.usedProvider}/${lastResult.reviewResults.usedModel}` : null,
                repairModel: `${lastResult.usedProvider}/${lastResult.usedModel}`,
                repairInstructions: repairInstructions || '(自动修复所有违规)',
                contentBefore: lastResult.contentBefore || null,
                contentAfter: lastResult.contentAfter || null,
                contentDiff: lastResult.contentDiff || [],
                timestamp: new Date().toISOString()
            };
            attemptHistory.push(attemptRecord);

            if (onProgress) onProgress({
                phase: 'repair-done', attempt,
                violationsAfter: lastResult.violationsAfter,
                reviewPassed,
                usedModel: lastResult.usedModel,
                usedProvider: lastResult.usedProvider,
                attemptRecord
            });

            if ((reviewPassed && !hasCriticalViolation) || (auditClean && reviewPassed)) {
                lastResult.allPassed = true;
                lastResult.attempts = attempt;
                break;
            }

            if (attempt >= maxRetries) {
                lastResult.maxRetriesReached = true;
                lastResult.allPassed = false;
                lastResult.attempts = attempt;
                break;
            }

            const newAudit = this.auditChapter(chapterId);
            if (newAudit.violations && newAudit.violations.length > 0) {
                repairInstructions = newAudit.violations.map(v => v.desc).join('\n');
            }
        }

        lastResult.attemptHistory = attemptHistory;
        if (lastResult.allPassed === undefined) lastResult.allPassed = false;
        if (!lastResult.attempts) lastResult.attempts = attempt;

        if (lastResult.allPassed && followUpPipeline && pipelineService) {
            if (onProgress) onProgress({ phase: 'pipeline-start', chapterId });
            try {
                const pipelineResult = await this._runFollowUpPipeline(chapterId, pipelineService, onProgress);
                lastResult.pipelineResult = pipelineResult;
                if (onProgress) onProgress({ phase: 'pipeline-done', chapterId, success: pipelineResult.success });
            } catch (err) {
                lastResult.pipelineError = err.message;
                if (onProgress) onProgress({ phase: 'pipeline-error', chapterId, error: err.message });
            }
        }

        return lastResult;
    }

    async _runFollowUpPipeline(chapterId, pipelineService, onProgress) {
        const chapter = store.getItem('chapters', chapterId);
        if (!chapter) return { success: false, error: '章节不存在' };

        const projectId = chapter.projectId || this.projectId;
        const project = store.getItem('projects', projectId);
        const mode = project?.mode || 'novel';

        const steps = mode === 'shuangwen'
            ? ['fast-review', 'final-editor']
            : mode === 'tomato-short'
                ? ['fast-review', 'final-editor']
                : ['first-review', 'second-review', 'final-editor'];

        const results = [];
        let materialGuidance = '';

        for (const step of steps) {
            if (onProgress) onProgress({ phase: 'pipeline-step', step, chapterId });
            console.log(`[AUDITOR] Follow-up pipeline step: ${step} for Ch${chapter.chapterNumber}`);

            const stepResult = await pipelineService.runPipelineStep(projectId, chapterId, step, 1, { mode });
            results.push({ step, passed: stepResult.passed });

            if (!stepResult.passed) {
                return { success: false, failedAt: step, results };
            }

            if (step === 'final-editor') {
                materialGuidance = stepResult.materialGuidance || '';
                const ch = store.getItem('chapters', chapterId);
                if (ch) {
                    ch.normalContent = ch.content;
                    ch.status = 'approved';
                    ch.updatedAt = new Date().toISOString();
                    store.setItem('chapters', chapterId, ch);
                }
            }
        }

        try {
            if (onProgress) onProgress({ phase: 'pipeline-step', step: 'polisher', chapterId });
            console.log(`[AUDITOR] Follow-up pipeline: polisher for Ch${chapter.chapterNumber}`);
            const polishResult = await pipelineService.runPipelineStep(projectId, chapterId, 'polisher', 1, { mode });
            results.push({ step: 'polisher', passed: true });

            if (polishResult.result?.response) {
                const polishedContent = polishResult.result.response;
                const ch = store.getItem('chapters', chapterId);
                const originalLength = ch?.normalContent?.length || 0;
                const polishedLength = polishedContent.length;
                const ratio = originalLength > 0 ? polishedLength / originalLength : 1;
                if (ratio >= 0.8 && ratio <= 1.2 && polishedLength > 500) {
                    ch.polishedContent = polishedContent;
                    ch.polisherOutput = polishedContent;
                    ch.content = polishedContent;
                    ch.wordCount = polishedContent.length;
                    ch.updatedAt = new Date().toISOString();
                    store.setItem('chapters', chapterId, ch);
                }
            }
        } catch (err) {
            console.warn('[AUDITOR] Polisher failed:', err.message);
            results.push({ step: 'polisher', passed: false, error: err.message });
        }

        try {
            if (onProgress) onProgress({ phase: 'pipeline-step', step: 'material-manager', chapterId });
            console.log(`[AUDITOR] Follow-up pipeline: material-manager for Ch${chapter.chapterNumber}`);
            await pipelineService.runPipelineStep(projectId, chapterId, 'material-manager', 1, { materialGuidance });
            results.push({ step: 'material-manager', passed: true });
        } catch (err) {
            console.warn('[AUDITOR] Material-manager failed:', err.message);
            results.push({ step: 'material-manager', passed: false, error: err.message });
        }

        const finalChapter = store.getItem('chapters', chapterId);
        return {
            success: true,
            results,
            finalStatus: finalChapter?.status,
            finalWordCount: (finalChapter?.content || '').replace(/\s/g, '').length
        };
    }

    _generateDiff(oldText, newText) {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const diff = [];
        const maxLen = Math.max(oldLines.length, newLines.length);

        for (let i = 0; i < maxLen; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';
            if (oldLine.trim() !== newLine.trim()) {
                diff.push({
                    line: i + 1,
                    before: oldLine.substring(0, 200),
                    after: newLine.substring(0, 200)
                });
            }
        }
        return diff.slice(0, 50);
    }

    _runHardBlockChecks(content) {
        const issues = [];
        const styleProfile = this.styleProfile;
        const modeConfig = MODE_CONFIGS[this.project?.mode || 'novel'] || MODE_CONFIGS.novel;

        try {
            const adultResult = detectAdultPerspective(content, styleProfile);
            if (adultResult.isAdultPerspective) {
                const criticals = adultResult.issues.filter(i => i.severity === 'critical');
                if (criticals.length > 0) {
                    issues.push(`视角违规(critical): ${criticals.map(i => i.desc).join('；')}`);
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const techResult = detectTechJargon(content, styleProfile);
            if (techResult.violationCount > 0 && this.genre?.id === 'baby') {
                const genreJargons = techResult.instances.filter(j => !j.allowable).map(j => `"${j.match}"`);
                if (genreJargons.length > 0) {
                    issues.push(`幼崽视角科技术语: ${genreJargons.join('、')}`);
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const leakResult = detectPipelineMetadataLeak(content);
            if (leakResult.hasLeak) {
                issues.push(`流水线元数据泄露: ${leakResult.instances.map(i => i.match).join('、')}`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const slangResult = detectModernSlang(content, styleProfile);
            if (slangResult.count > 0) {
                issues.push(`网络用语: ${slangResult.instances.map(s => `"${s.match}"`).join('、')}`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const sensitiveResult = scanSensitiveWords(content);
            if (sensitiveResult.blockCount > 0) {
                issues.push(`敏感词(severity=block): ${sensitiveResult.instances.filter(i => i.severity === 'block').map(i => `"${i.match}"`).join('、')}`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const chapters = store.queryItems('chapters', c => c.projectId === this.projectId);
            const currentChapter = chapters.find(c => c.content === content || (c.content && content.includes(c.content.substring(0, 50))));
            if (currentChapter) {
                const prevChapter = chapters.find(c => c.chapterNumber === currentChapter.chapterNumber - 1);
                if (prevChapter?.content) {
                    const crossRep = detectCrossChapterRepetition(content, prevChapter.content);
                    if (crossRep.hasRepetition) {
                        issues.push(`跨章内容重复(${crossRep.instances?.length || 0}处)`);
                    }
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const wc = content.replace(/\s/g, '').length;
            if (wc < modeConfig.REJECT_MIN_WORDS) {
                issues.push(`字数${wc}低于最低要求${modeConfig.REJECT_MIN_WORDS}`);
            }
            if (wc > modeConfig.MAX_CHAPTER_WORDS) {
                issues.push(`字数${wc}超出上限${modeConfig.MAX_CHAPTER_WORDS}`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        return {
            blocked: issues.length > 0,
            issues
        };
    }

    _buildTechniqueHints(content) {
        const hints = [];
        const styleProfile = this.styleProfile;
        try {
            const tellResult = detectTellVerbs(content);
            if (tellResult.count > 0) {
                hints.push(`【展示代替告知检测】发现${tellResult.count}处告知式描写(density:${tellResult.density}/千字)，请检查是否需要转化为动作/生理/环境描写`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        try {
            const dripScore = calcInfoDripScore(content);
            if (dripScore < 0.4) {
                hints.push(`【信息注入节奏检测】info_drip_score=${dripScore.toFixed(2)}(<0.4)，存在连续设定说明，建议将信息包裹在动作冲突/对话博弈中`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        try {
            const endingResult = extractEndingTension(content);
            if (!endingResult.hasTension) {
                hints.push(`【章节收尾检测】末段缺乏张力点，请检查是否需要增加悬念/抉择/伏笔提及/关系转折`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        try {
            const slangResult = detectModernSlang(content, styleProfile);
            if (slangResult.count > 0) {
                hints.push(`【🚨年代语言污染检测 - 严重违规】发现${slangResult.count}处网络用语/网文腔：${slangResult.instances.map(s => `"${s.match}"(${s.type})`).join('、')}。必须全部替换`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        try {
            const adultResult = detectAdultPerspective(content, styleProfile);
            if (adultResult.isAdultPerspective) {
                const criticalDescs = adultResult.issues.filter(i => i.severity === 'critical').map(i => i.desc);
                const highDescs = adultResult.issues.filter(i => i.severity === 'high').map(i => i.desc);
                if (criticalDescs.length > 0) {
                    const perspectiveDesc = this.genre?.id === 'baby'
                        ? `幼崽角色出现成人化内心：${criticalDescs.join('；')}。必须重写为幼崽视角/幼崽行为驱动`
                        : `视角违规：${criticalDescs.join('；')}`;
                    hints.push(`【🚨视角违规检测 - 严重违规】${perspectiveDesc}`);
                }
                if (highDescs.length > 0) {
                    hints.push(`【⚠️视角偏移检测 - 需调整】${highDescs.join('；')}`);
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        try {
            const techJargonResult = detectTechJargon(content, styleProfile);
            if (techJargonResult.violationCount > 0) {
                const genreJargons = techJargonResult.instances.filter(j => !j.allowable).map(j => `"${j.match}"(${j.perspective}视角)→"${j.suggestion}"`).join('、');
                const perspectiveLabel = this.genre?.id === 'baby' ? '幼崽视角' : '角色视角';
                hints.push(`【🚨科技术语检测 - ${perspectiveLabel}违规】发现${techJargonResult.violationCount}处${perspectiveLabel}中的科技术语：${genreJargons}。必须替换为感官隐喻`);
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        try {
            const chapters = store.queryItems('chapters', c => c.projectId === this.projectId);
            const currentChapter = chapters.find(c => c.content === content || (c.content && content.includes(c.content.substring(0, 50))));
            if (currentChapter) {
                const prevChapter = chapters.find(c => c.chapterNumber === currentChapter.chapterNumber - 1);
                if (prevChapter?.content) {
                    const crossChapterResult = detectCrossChapterRepetition(content, prevChapter.content);
                    if (crossChapterResult.hasRepetition) {
                        hints.push(`【跨章相似提示】与上一章存在${crossChapterResult.repeatedCount}处高度相似段落`);
                    }
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        return hints.length > 0 ? hints.join('\n') : '';
    }
}

module.exports = { ChapterAuditor };
