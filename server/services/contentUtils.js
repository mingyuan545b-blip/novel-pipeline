const { detectGenre, isBabyGenre: isBabyGenreHelper, getGenreModernSlangResult, getGenrePerspectiveResult, getGenreTerminologyResult, getGenreQualityResults } = require('./genreConfig');

const MODE_CONFIGS = {
    novel: {
        MAX_CHAPTER_WORDS: 3500,
        TARGET_MIN_WORDS: 2200,
        TARGET_MAX_WORDS: 2800,
        REJECT_MIN_WORDS: 1800
    },
    shuangwen: {
        MAX_CHAPTER_WORDS: 2800,
        TARGET_MIN_WORDS: 1800,
        TARGET_MAX_WORDS: 2500,
        REJECT_MIN_WORDS: 1200
    },
    'tomato-short': {
        MAX_CHAPTER_WORDS: 2150,
        TARGET_MIN_WORDS: 1900,
        TARGET_MAX_WORDS: 2100,
        REJECT_MIN_WORDS: 1850,
        DIALOGUE_RATIO_MAX: 0.28,
        TOTAL_CHAPTERS: 28,
        READER_TRIGGERS: [7, 14],
        ADJUSTER_MAX_WRITER_RULES: 2,
        ADJUSTER_MAX_REVIEW_RULES: 1,
        ADJUSTER_MAX_MATERIAL_UPDATES: 1
    }
};

const MAX_CHAPTER_WORDS = 3500;

function getModeConfig(mode) {
    return MODE_CONFIGS[mode] || MODE_CONFIGS.novel;
}

function calcNgramOverlap(a, b, n = 4) {
    if (a.length < n || b.length < n) return 0;
    const ngramsA = new Set();
    for (let i = 0; i <= a.length - n; i++) ngramsA.add(a.substring(i, i + n));
    let overlap = 0;
    let total = 0;
    for (let i = 0; i <= b.length - n; i++) {
        total++;
        if (ngramsA.has(b.substring(i, i + n))) overlap++;
    }
    return total > 0 ? overlap / total : 0;
}

function normalizeForDedup(text) {
    return text
        .replace(/[，。！？、；：""''（）\s]/g, '')
        .replace(/第[一二三四五六七八九十百千万零\d]+[天日周月年]/g, '')
        .replace(/(早上|上午|中午|下午|傍晚|晚上|深夜|凌晨|清晨|黄昏|黎明)/g, '')
        .toLowerCase();
}

function deduplicateContent(content) {
    if (!content || content.length < 100) return { content: content || '', removed: 0, details: [] };
    if (typeof content !== 'string') { console.error('[deduplicateContent] non-string input:', typeof content); return { content: String(content || ''), removed: 0, details: [] }; }

    const details = [];
    let totalRemoved = 0;

    const paragraphs = content.split(/\n\n+/);
    if (paragraphs.length <= 2 && content.length > 500) {
        const sentences = content.split(/(?<=[。！？])/);
        const chunks = [];
        let chunk = '';
        let sentCount = 0;
        for (const s of sentences) {
            chunk += s;
            sentCount++;
            if (sentCount >= 3) {
                chunks.push(chunk.trim());
                chunk = '';
                sentCount = 0;
            }
        }
        if (chunk.trim()) chunks.push(chunk.trim());
        if (chunks.length > 1) {
            const seenChunks = new Map();
            const keptChunks = [];
            for (let i = 0; i < chunks.length; i++) {
                const norm = normalizeForDedup(chunks[i]);
                if (norm.length < 20) { keptChunks.push(chunks[i]); continue; }
                let isDup = false;
                for (const [existingNorm, existingIdx] of seenChunks.entries()) {
                    if (norm === existingNorm) {
                        isDup = true;
                        details.push(`语块${i + 1}与语块${existingIdx + 1}完全重复: "${chunks[i].substring(0, 50)}..."`);
                        break;
                    }
                    const overlap = calcNgramOverlap(norm, existingNorm);
                    if (overlap > 0.5) {
                        isDup = true;
                        details.push(`语块${i + 1}与语块${existingIdx + 1}高度相似(ngram重叠${(overlap * 100).toFixed(0)}%): "${chunks[i].substring(0, 50)}..."`);
                        break;
                    }
                }
                if (isDup) { totalRemoved++; } else { seenChunks.set(norm, i); keptChunks.push(chunks[i]); }
            }
            if (totalRemoved > 0) {
                content = keptChunks.join('');
            }
        }
    } else {
        const seen = new Map();
        const result = [];
        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i].trim();
            if (!para) { result.push(paragraphs[i]); continue; }
            const normalized = normalizeForDedup(para);
            if (normalized.length < 15) { result.push(paragraphs[i]); continue; }
            let isDuplicate = false;
            for (const [existingNorm, existingIdx] of seen.entries()) {
                if (normalized === existingNorm) {
                    isDuplicate = true;
                    details.push(`段落${i + 1}与段落${existingIdx + 1}完全重复: "${para.substring(0, 50)}..."`);
                    break;
                }
                if (normalized.length > 30) {
                    const overlap = calcNgramOverlap(normalized, existingNorm);
                    if (overlap > 0.5) {
                        isDuplicate = true;
                        details.push(`段落${i + 1}与段落${existingIdx + 1}高度相似(ngram重叠${(overlap * 100).toFixed(0)}%): "${para.substring(0, 50)}..."`);
                        break;
                    }
                }
            }
            if (!isDuplicate) { seen.set(normalized, i); result.push(paragraphs[i]); }
            else { totalRemoved++; }
        }
        content = result.join('\n\n');
    }

    const sentences = content.split(/(?<=[。！？])/);
    const sentSeen = new Map();
    const finalSentences = [];
    let sentRemoved = 0;
    for (const sent of sentences) {
        const norm = normalizeForDedup(sent);
        if (norm.length < 15) { finalSentences.push(sent); continue; }
        let isDupSent = false;
        for (const [existingNorm] of sentSeen.entries()) {
            if (norm === existingNorm) { isDupSent = true; break; }
            if (norm.length > 20 && existingNorm.length > 20) {
                const overlap = calcNgramOverlap(norm, existingNorm);
                if (overlap > 0.6) { isDupSent = true; break; }
            }
        }
        if (isDupSent) { sentRemoved++; details.push(`重复/高度相似句子: "${sent.trim().substring(0, 60)}..."`); }
        else { sentSeen.set(norm, true); finalSentences.push(sent); }
    }

    const finalContent = finalSentences.join('');
    totalRemoved += sentRemoved;

    return { content: finalContent, removed: totalRemoved, details };
}

function truncateChapter(content, maxWords) {
    if (content.length <= maxWords) return { content };

    const paragraphs = content.split(/\n\n+/);
    let result = '';
    let wordCount = 0;

    for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        if (wordCount + para.length + 2 > maxWords) {
            const remaining = maxWords - wordCount;
            if (remaining > 200) {
                const sentences = para.split(/(?<=[。！？])/);
                let partialResult = '';
                for (const sent of sentences) {
                    if (wordCount + partialResult.length + sent.length > maxWords - 50) break;
                    partialResult += sent;
                }
                if (partialResult.length > 100) {
                    result += (result ? '\n\n' : '') + partialResult;
                }
            }
            break;
        }
        result += (result ? '\n\n' : '') + para;
        wordCount = result.length;
    }

    const lastChar = result.trim().slice(-1);
    if (!/[。！？…」』]/.test(lastChar)) {
        result = result.trimEnd() + '……';
    }

    return { content: result };
}

function cleanFinalContent(content) {
    if (!content) return '';
    if (typeof content !== 'string') { console.error('[cleanFinalContent] non-string input:', typeof content, JSON.stringify(content).substring(0, 200)); return String(content || ''); }
    let cleaned = content;
    cleaned = cleaned.replace(/^#\s*第?\d+[章节].*?\n*/i, '');
    cleaned = cleaned.replace(/^第?\d+[章节][、]\s*.*?\n*/m, '');
    cleaned = cleaned.replace(/---\s*\n*/g, '');
    cleaned = cleaned.replace(/【[^】]*(?:钩子|伏笔|悬念|下章预告|hook)[^】]*】[\s\S]*?(?=\n\n|\Z)/gi, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = splitLongParagraphs(cleaned);
    return cleaned.trim();
}

function splitLongParagraphs(content, maxLen = 150) {
    if (!content) return content;
    const paragraphs = content.split(/\n\n+/);
    const result = [];
    for (const para of paragraphs) {
        if (para.trim().length <= maxLen) {
            result.push(para);
            continue;
        }
        const sentences = para.match(/[^。！？…]+[。！？…]+/g) || [para];
        let current = '';
        for (const sentence of sentences) {
            if ((current + sentence).length > maxLen && current.length > 0) {
                result.push(current.trim());
                current = sentence;
            } else {
                current += sentence;
            }
        }
        if (current.trim()) result.push(current.trim());
    }
    return result.join('\n\n');
}

function cleanChapterContent(content) {
    if (!content) return '';
    if (typeof content !== 'string') { console.error('[cleanChapterContent] non-string input:', typeof content, JSON.stringify(content).substring(0, 200)); return String(content || ''); }
    let cleaned = content
        .replace(/【修改后的正文】/g, '')
        .replace(/【修改后正文】/g, '')
        .replace(/【正文】/g, '')
        .replace(/【修改后的正文[\s\S]*?】/g, '')
        .replace(/^[\s]*修改后的正文[\s]*\n*/m, '')
        .replace(/【本章完】/g, '')
        .replace(/【伏笔提醒[^】]*】/g, '')
        .replace(/【作者注[^】]*】/g, '')
        .replace(/【下章预告[^】]*】/g, '')
        .replace(/【思考[^】]*】/g, '')
        .replace(/【IP方向[^】]*】/g, '')
        .replace(/【素材更新指引[^】]*】/g, '')
        .replace(/<think[\s\S]*?<\/think>/g, '')
        .replace(/<thinking[\s\S]*?<\/thinking>/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\[权限终端\][^\n]*/g, '')
        .replace(/\[道具[：:]\s*[^\]]+\][^\n]*/g, '')
        .replace(/\[筹码\][^\n]*/g, '')
        .replace(/\[合作约定\][^\n]*/g, '')
        .replace(/\[契约绑定\][^\n]*/g, '')
        .replace(/(?:手册|道具)浮现选项[：:][^\n]*/g, '')
        .replace(/面临抉择[：:][^\n]*/g, '')
        .replace(/认知碎片进度[：:]\s*\d+\/\d+/g, '')
        .replace(/理智锚点[：:]\s*\d+%/g, '')
        .replace(/扣减\d+%理智锚点/g, '')
        .replace(/①.{1,30}②.{1,50}/g, '')
        .replace(/\n{3,}/g, '\n\n');

    const ANALYSIS_PATTERNS = [
        /^让我.{0,20}(分析|阅读|仔细|逐段|检查|看看|理解|思考).{0,30}[:：]\s*/m,
        /^我需要.{0,30}[:：]\s*/m,
        /^(一些|几个|以下).{0,20}(可以|需要|值得).{0,20}[:：]\s*/m,
        /^(保持|保留|这个|不错|很好).{0,10}[。！？\n]/m,
        /^第[一二三四五六七八九十\d]+段[：:]/m,
        /^(可以|能够|应该).{0,15}(更|更加|更生动|更凝练|更流畅).{0,20}[:：]/m,
        /^[""「「].{0,5}[""」」].{0,10}(可以|能够|应该)/m,
        /^(这个|这段|此处|这里).{0,10}(比喻|描写|表达|表述)/m,
        /^\s*[-*•]\s+(可以|能够|应该|需要|保持|保留)/m,
        /^(不能|不得|不可|不要|别).{0,20}(改变|修改|删)/m
    ];

    for (const pattern of ANALYSIS_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    cleaned = cleaned
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();

    cleaned = splitLongParagraphs(cleaned);
    return cleaned;
}

function ensureCliffhanger(content) {
    if (!content) return content;
    const trimmed = content.trimEnd();
    const lastChar = trimmed.slice(-1);
    if (/[。！？…」』]/.test(lastChar)) {
        return trimmed;
    }
    return trimmed + '……';
}

function validateTomatoMetrics(content) {
    if (!content) return { pass: false, reason: 'EMPTY_CONTENT' };

    const text = content.replace(/\s/g, '');
    const words = text.length;

    if (words < 1850) return { pass: false, reason: 'WORD_COUNT_BELOW_MIN', detail: `${words} < 1850` };
    if (words > 2150) return { pass: false, reason: 'WORD_COUNT_ABOVE_MAX', detail: `${words} > 2150` };

    const dialoguePattern = /[\u201c\u201d\u0022\u300c\u300e]([^\u201c\u201d\u0022\u300d\u300f]*?)[\u201c\u201d\u0022\u300d\u300f]/g;
    let dialogueChars = 0;
    let match;
    while ((match = dialoguePattern.exec(content)) !== null) {
        dialogueChars += match[0].length;
    }
    if (content.length > 0 && dialogueChars / content.length > 0.28) {
        return { pass: false, reason: 'DIALOGUE_RATIO_HIGH', detail: `${(dialogueChars / content.length * 100).toFixed(1)}% > 28%` };
    }

    const bannedPhrases = ["账本该翻页了", "疼就对了", "总比当个干净的空白强", "至少咱们还能活着记账"];
    for (const p of bannedPhrases) {
        const count = (content.match(new RegExp(p, 'g')) || []).length;
        if (count >= 2) return { pass: false, reason: 'REPETITION_PENALTY', detail: `"${p}" 出现${count}次` };
    }

    const first50 = content.slice(0, 50);
    const conflictWords = /危机|异常|反常|警告|倒计时|冻结|撕裂|坍塌|崩塌|警报|红灯|闪|碎|裂|震/;
    if (!conflictWords.test(first50)) {
        return { pass: false, reason: 'OPENING_HOOK_MISSING', detail: `前50字无冲突词` };
    }

    return { pass: true };
}

function detectTellVerbs(content) {
    if (!content) return { count: 0, instances: [], density: 0 };

    const TELL_VERB_PATTERNS = [
        /他很?(愤怒|生气|暴怒|火大|恼怒|震怒)/g,
        /她很?(愤怒|生气|暴怒|火大|恼怒|震怒)/g,
        /他很?(悲伤|难过|伤心|痛苦|心碎|绝望)/g,
        /她很?(悲伤|难过|伤心|痛苦|心碎|绝望)/g,
        /他很?(害怕|恐惧|惊恐|惶恐|胆怯|畏缩)/g,
        /她很?(害怕|恐惧|惊恐|惶恐|胆怯|畏缩)/g,
        /他很?(高兴|开心|快乐|兴奋|激动|欣喜)/g,
        /她很?(高兴|开心|快乐|兴奋|激动|欣喜)/g,
        /他很?(紧张|焦虑|不安|担忧|忐忑)/g,
        /她很?(紧张|焦虑|不安|担忧|忐忑)/g,
        /他感.{0,4}(愤怒|悲伤|害怕|高兴|紧张|绝望|痛苦|恐惧)/g,
        /她感.{0,4}(愤怒|悲伤|害怕|高兴|紧张|绝望|痛苦|恐惧)/g,
        /他觉.{0,4}(愤怒|悲伤|害怕|高兴|紧张|绝望|痛苦|恐惧)/g,
        /她觉.{0,4}(愤怒|悲伤|害怕|高兴|紧张|绝望|痛苦|恐惧)/g,
        /心中(满是|充满|涌起|升起|泛起).{0,6}(怒|悲|惧|喜|忧|恨|愁)/g,
        /内心(满是|充满|涌起|升起|泛起).{0,6}(怒|悲|惧|喜|忧|恨|愁)/g
    ];

    const instances = [];
    for (const pattern of TELL_VERB_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            const start = Math.max(0, match.index - 15);
            const end = Math.min(content.length, match.index + match[0].length + 15);
            instances.push({
                match: match[0],
                context: content.substring(start, end)
            });
        }
    }

    const charCount = content.length || 1;
    return {
        count: instances.length,
        instances: instances.slice(0, 10),
        density: (instances.length / (charCount / 1000)).toFixed(2)
    };
}

function extractEndingTension(content) {
    if (!content) return { hasTension: false, tensionType: null, lastParagraph: '' };

    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length === 0) return { hasTension: false, tensionType: null, lastParagraph: '' };

    const lastPara = paragraphs[paragraphs.length - 1].trim();
    const lastTwoParas = paragraphs.slice(-2).join(' ');

    const tensionPatterns = [
        { type: '威胁逼近', pattern: /逼近|靠近|袭来|涌来|蔓延|危机|危险|杀意|寒意|不妙/ },
        { type: '未解之谜', pattern: /秘密|真相|谜|疑问|困惑|不解|迷惑|未解|悬而未决/ },
        { type: '悬念', pattern: /到底|究竟|是否|会不会|难道|莫非|莫不是|莫非是|莫非是/ },
        { type: '抉择', pattern: /不得不|只能|别无选择|两难|抉择|要么/ },
        { type: '伏笔提及', pattern: /突然|忽然|意外|没想到|想不到|竟|居然|竟然|岂料|孰料/ },
        { type: '关系转折', pattern: /转身离开|消失|沉默|不再|终于|从此|再也|再也不/ }
    ];

    for (const { type, pattern } of tensionPatterns) {
        if (pattern.test(lastPara) || pattern.test(lastTwoParas)) {
            return { hasTension: true, tensionType: type, lastParagraph: lastPara.substring(0, 100) };
        }
    }

    const lastSentence = lastPara.match(/[^。！？！?]+[。！？！?]$/)?.[0] || lastPara.slice(-30);
    const cliffhangerWords = /但|却|然而|不过|只是|只是…|可是|偏偏|谁知|哪知/;
    if (cliffhangerWords.test(lastSentence)) {
        return { hasTension: true, tensionType: '转折未完', lastParagraph: lastPara.substring(0, 100) };
    }

    return { hasTension: false, tensionType: null, lastParagraph: lastPara.substring(0, 100) };
}

function calcInfoDripScore(content) {
    if (!content) return 1.0;

    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length === 0) return 1.0;

    let consecutiveInfoDump = 0;
    let maxConsecutive = 0;
    let totalInfoSentences = 0;
    let totalActionSentences = 0;

    const infoPatterns = /(?:是|有|属于|位于|因为|所以|由于|为了|据说|传说|记载|历史|由来|规则|规定|原理|机制|体系|等级|阶层)/;
    const actionPatterns = /(?:说|喊|叫|跑|走|打|抓|推|拉|跳|冲|闪|躲|砍|刺|射|踢|拍|握|扔|挥|咬|吃|喝|看|听|闻|摸)/;

    for (const para of paragraphs) {
        const sentences = para.split(/[。！？]/).filter(s => s.trim());
        let paraInfoCount = 0;

        for (const sentence of sentences) {
            if (infoPatterns.test(sentence)) {
                paraInfoCount++;
                totalInfoSentences++;
            }
            if (actionPatterns.test(sentence)) {
                totalActionSentences++;
            }
        }

        if (paraInfoCount >= 3) {
            consecutiveInfoDump++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveInfoDump);
        } else {
            consecutiveInfoDump = 0;
        }
    }

    if (maxConsecutive >= 3) return 0.2;
    if (maxConsecutive >= 2) return 0.4;

    const total = totalInfoSentences + totalActionSentences;
    if (total === 0) return 1.0;

    const actionRatio = totalActionSentences / total;
    if (actionRatio < 0.2) return 0.3;
    if (actionRatio < 0.4) return 0.6;

    return Math.min(1.0, actionRatio);
}

function detectModernSlang(content, styleProfile) {
    return getGenreModernSlangResult(content, styleProfile);
}

function detectAdultPerspective(content, styleProfile) {
    const result = getGenrePerspectiveResult(content, styleProfile);
    return {
        isAdultPerspective: result.isViolation,
        issues: result.issues,
        hasCriticalIssue: result.hasCriticalIssue
    };
}

function detectTechJargon(content, styleProfile) {
    const result = getGenreTerminologyResult(content, styleProfile);
    return {
        count: result.count,
        instances: result.instances,
        violationCount: result.violationCount
    };
}

function detectCrossChapterRepetition(content, previousChapterContent) {
    if (!content || !previousChapterContent) return { hasRepetition: false, overlapScore: 0, details: [] };

    const currentNorm = normalizeForDedup(content);
    const prevNorm = normalizeForDedup(previousChapterContent);

    if (currentNorm.length < 100 || prevNorm.length < 100) return { hasRepetition: false, overlapScore: 0, details: [] };

    const currentParagraphs = content.split(/\n\n+/).filter(p => p.trim());
    const prevParagraphs = previousChapterContent.split(/\n\n+/).filter(p => p.trim());

    const details = [];
    let repeatedCount = 0;

    for (let i = 0; i < currentParagraphs.length; i++) {
        const currNorm = normalizeForDedup(currentParagraphs[i]);
        if (currNorm.length < 30) continue;

        for (let j = 0; j < prevParagraphs.length; j++) {
            const pNorm = normalizeForDedup(prevParagraphs[j]);
            if (pNorm.length < 30) continue;

            const overlap = calcNgramOverlap(currNorm, pNorm);
            if (overlap > 0.4) {
                repeatedCount++;
                details.push({
                    currentParaIndex: i,
                    prevParaIndex: j,
                    overlapPercent: (overlap * 100).toFixed(0),
                    preview: currentParagraphs[i].substring(0, 60)
                });
                break;
            }
        }
    }

    const overlapScore = currentParagraphs.length > 0 ? repeatedCount / currentParagraphs.length : 0;

    return {
        hasRepetition: repeatedCount >= 2 || overlapScore > 0.2,
        overlapScore,
        repeatedCount,
        details: details.slice(0, 10)
    };
}

function detectPipelineMetadataLeak(content, styleProfile) {
    if (!content) return { count: 0, instances: [] };

    const METADATA_PATTERNS = [
        { pattern: /藏经阁[·\.]?技法注入/g, type: '管线元数据', suggestion: '删除此标记，技法应融入叙事不可直述' },
        { pattern: /【藏经阁/g, type: '管线元数据', suggestion: '删除此标记' },
        { pattern: /技法注入[^】]/g, type: '管线元数据', suggestion: '删除此标记' },
        { pattern: /技法融入[】]/g, type: '管线元数据', suggestion: '删除此标记，技法应自然融入不可标注' },
        { pattern: /伏笔追踪报告/g, type: '管线元数据', suggestion: '旧笔记/手写记录/盖着章的文件' },
        { pattern: /伏笔追踪日志/g, type: '管线元数据', suggestion: '旧笔记本/手写记录' },
        { pattern: /异常波动归零/g, type: '管线元数据', suggestion: '数字变正常了' },
        { pattern: /参数校准进度/g, type: '管线元数据', suggestion: '屏幕上的小绿线' },
        { pattern: /系统提示光点/g, type: '管线元数据', suggestion: '机器上的小灯' },
        { pattern: /参数同步/g, type: '管线元数据', suggestion: '机器滴滴响' },
        { pattern: /循环数据归档/g, type: '管线元数据', suggestion: '记好的数字' },
        { pattern: /主控逻辑/g, type: '管线元数据', suggestion: '管事的规矩' },
        { pattern: /[一二三四五六七八九十百千万\d]+章[前后以]?/g, type: '打破第四面墙', suggestion: '删除章回引用，改"之前""早先""前几章"' },
        { pattern: /上[一二三四五六七八九十\d]+章/g, type: '打破第四面墙', suggestion: '删除章回引用，改"之前"' },
        { pattern: /前[一二三四五六七八九十\d]+章/g, type: '打破第四面墙', suggestion: '删除章回引用，改"之前"' }
    ];

    const PROFESSIONAL_TERMS = [
        { pattern: /归档日志/g, type: '专业术语', suggestion: '旧记录/小本本' },
        { pattern: /观测数据/g, type: '专业术语', suggestion: '记下来的数字' },
        { pattern: /指标曲线/g, type: '专业术语', suggestion: '屏幕上的线' },
        { pattern: /反馈曲线/g, type: '专业术语', suggestion: '屏幕上的线' },
        { pattern: /拓扑图/g, type: '专业术语', suggestion: '连线图/地图' },
        { pattern: /坐标反馈/g, type: '专业术语', suggestion: '位置标记' },
        { pattern: /归档时间戳/g, type: '专业术语', suggestion: '记下的时间' },
        { pattern: /时间戳/g, type: '专业术语', suggestion: '日期/时间标记/小数字' },
        { pattern: /背景数据/g, type: '专业术语', suggestion: '背后的数字' }
    ];

    const genre = detectGenre(styleProfile);
    const genrePerspective = genre?.perspective;
    const ADULT_CONTEXT_MARKERS = genrePerspective?.adultViewMarkers || [];
    const BABY_VIEW_MARKERS = genrePerspective?.babyViewMarkers || [];
    const ADULT_CONTEXT_REGEX = ADULT_CONTEXT_MARKERS.length > 0 ? new RegExp(ADULT_CONTEXT_MARKERS.join('|')) : /(?!.*)/;
    const BABY_VIEW_REGEX = BABY_VIEW_MARKERS.length > 0 ? new RegExp(BABY_VIEW_MARKERS.join('|')) : /(?!.*)/;

    const instances = [];

    for (const { pattern, type, suggestion } of METADATA_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            instances.push({
                match: match[0],
                type,
                suggestion,
                position: match.index,
                allowable: false
            });
        }
    }

    const paragraphs = content.split(/\n\n+/);
    const paragraphContexts = paragraphs.map(p => {
        if (ADULT_CONTEXT_REGEX.test(p) && !BABY_VIEW_REGEX.test(p)) return 'adult';
        if (BABY_VIEW_REGEX.test(p) && !ADULT_CONTEXT_REGEX.test(p)) return 'baby';
        if (ADULT_CONTEXT_REGEX.test(p) && BABY_VIEW_REGEX.test(p)) return 'mixed';
        return 'unknown';
    });

    let charOffset = 0;
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        const para = paragraphs[pIdx];
        const context = paragraphContexts[pIdx];

        for (const { pattern, type, suggestion } of PROFESSIONAL_TERMS) {
            const regex = new RegExp(pattern.source, 'g');
            let match;
            while ((match = regex.exec(para)) !== null) {
                const globalPos = charOffset + match.index;
                const matchStart = Math.max(0, match.index - 60);
                const matchEnd = Math.min(para.length, match.index + match[0].length + 60);
                const sentenceContext = para.substring(matchStart, matchEnd);
                const isNearAdult = ADULT_CONTEXT_REGEX.test(sentenceContext);
                const isNearBaby = BABY_VIEW_REGEX.test(sentenceContext);
                const isAllowable = isNearAdult && !isNearBaby;

                instances.push({
                    match: match[0],
                    type,
                    suggestion,
                    position: globalPos,
                    perspective: context,
                    allowable: isAllowable,
                    note: isAllowable
                        ? '成人角色语境中专业术语使用合理'
                        : (context === 'baby' ? '幼崽视角中专业术语需降维' : '视角不确定，需确认')
                });
            }
        }

        charOffset += para.length + 2;
    }

    const metadataCount = instances.filter(i => !i.allowable).length;
    return { count: metadataCount, instances: instances.slice(0, 20), totalMatches: instances.length, adultAllowable: instances.filter(i => i.allowable).length };
}

function detectOnomatopoeiaDensity(content, styleProfile) {
    const results = getGenreQualityResults(content, styleProfile);
    if (results.onomatopoeia) return results.onomatopoeia;
    return { count: 0, density: 0, issues: [] };
}

function detectVisualAnchors(content, styleProfile) {
    const results = getGenreQualityResults(content, styleProfile);
    if (results.visualAnchors) return results.visualAnchors;
    return { count: 0, issues: [] };
}

function detectMotherChildDialogue(content, styleProfile) {
    const results = getGenreQualityResults(content, styleProfile);
    if (results.motherChildDialogue) return results.motherChildDialogue;
    return { count: 0, issues: [] };
}

module.exports = {
    MAX_CHAPTER_WORDS,
    MODE_CONFIGS,
    getModeConfig,
    deduplicateContent,
    truncateChapter,
    cleanFinalContent,
    cleanChapterContent,
    ensureCliffhanger,
    validateTomatoMetrics,
    detectTellVerbs,
    extractEndingTension,
    calcInfoDripScore,
    detectModernSlang,
    detectAdultPerspective,
    detectTechJargon,
    detectPipelineMetadataLeak,
    detectCrossChapterRepetition,
    detectOnomatopoeiaDensity,
    detectVisualAnchors,
    detectMotherChildDialogue,
    normalizeForDedup
};
