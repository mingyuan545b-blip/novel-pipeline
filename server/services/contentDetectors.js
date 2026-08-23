const { detectGenre, getGenreModernSlangResult, getGenrePerspectiveResult, getGenreTerminologyResult, getGenreQualityResults } = require('./genreConfig');
const { normalizeForDedup, calcNgramOverlap } = require('./contentCleaners');
const { detectPipelineMetadataLeak } = require('./contentMetadataDetector');

function detectTellVerbs(content) {
    if (!content) return { count: 0, instances: [], density: 0 };
    const TELL_VERB_PATTERNS = [
        /[他她]很?(愤怒|生气|暴怒|火大|恼怒|震怒)/g, /[他她]很?(悲伤|难过|伤心|痛苦|心碎|绝望)/g,
        /[他她]很?(害怕|恐惧|惊恐|惶恐|胆怯|畏缩)/g, /[他她]很?(高兴|开心|快乐|兴奋|激动|欣喜)/g,
        /[他她]很?(紧张|焦虑|不安|担忧|忐忑)/g,
        /[他她]感.{0,4}(愤怒|悲伤|害怕|高兴|紧张|绝望|痛苦|恐惧)/g,
        /[他她]觉.{0,4}(愤怒|悲伤|害怕|高兴|紧张|绝望|痛苦|恐惧)/g,
        /(心中|内心)(满是|充满|涌起|升起|泛起).{0,6}(怒|悲|惧|喜|忧|恨|愁)/g
    ];
    const instances = [];
    for (const pattern of TELL_VERB_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            const start = Math.max(0, match.index - 15);
            const end = Math.min(content.length, match.index + match[0].length + 15);
            instances.push({ match: match[0], context: content.substring(start, end) });
        }
    }
    const charCount = content.length || 1;
    return { count: instances.length, instances: instances.slice(0, 10), density: (instances.length / (charCount / 1000)).toFixed(2) };
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
        { type: '悬念', pattern: /到底|究竟|是否|会不会|难道|莫非|莫不是|莫非是/ },
        { type: '抉择', pattern: /不得不|只能|别无选择|两难|抉择|要么/ },
        { type: '伏笔提及', pattern: /突然|忽然|意外|没想到|想不到|竟|居然|竟然|岂料|孰料/ },
        { type: '关系转折', pattern: /转身离开|消失|沉默|不再|终于|从此|再也|再也不/ }
    ];
    for (const { type, pattern } of tensionPatterns) {
        if (pattern.test(lastPara) || pattern.test(lastTwoParas)) return { hasTension: true, tensionType: type, lastParagraph: lastPara.substring(0, 100) };
    }
    const lastSentence = lastPara.match(/[^。！？！?]+[。！？！?]$/)?.[0] || lastPara.slice(-30);
    if (/但|却|然而|不过|只是|可是|偏偏|谁知|哪知/.test(lastSentence)) return { hasTension: true, tensionType: '转折未完', lastParagraph: lastPara.substring(0, 100) };
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
            if (infoPatterns.test(sentence)) { paraInfoCount++; totalInfoSentences++; }
            if (actionPatterns.test(sentence)) totalActionSentences++;
        }
        if (paraInfoCount >= 3) { consecutiveInfoDump++; maxConsecutive = Math.max(maxConsecutive, consecutiveInfoDump); } else { consecutiveInfoDump = 0; }
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

function detectModernSlang(content, styleProfile) { return getGenreModernSlangResult(content, styleProfile); }
function detectAdultPerspective(content, styleProfile) { const r = getGenrePerspectiveResult(content, styleProfile); return { isAdultPerspective: r.isViolation, issues: r.issues, hasCriticalIssue: r.hasCriticalIssue }; }
function detectTechJargon(content, styleProfile) { const r = getGenreTerminologyResult(content, styleProfile); return { count: r.count, instances: r.instances, violationCount: r.violationCount }; }

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
            if (overlap > 0.4) { repeatedCount++; details.push({ currentParaIndex: i, prevParaIndex: j, overlapPercent: (overlap * 100).toFixed(0), preview: currentParagraphs[i].substring(0, 60) }); break; }
        }
    }
    const overlapScore = currentParagraphs.length > 0 ? repeatedCount / currentParagraphs.length : 0;
    return { hasRepetition: repeatedCount >= 2 || overlapScore > 0.2, overlapScore, repeatedCount, details: details.slice(0, 10) };
}

function detectOnomatopoeiaDensity(content, styleProfile) { const r = getGenreQualityResults(content, styleProfile); return r.onomatopoeia || { count: 0, density: 0, issues: [] }; }
function detectVisualAnchors(content, styleProfile) { const r = getGenreQualityResults(content, styleProfile); return r.visualAnchors || { count: 0, issues: [] }; }
function detectMotherChildDialogue(content, styleProfile) { const r = getGenreQualityResults(content, styleProfile); return r.motherChildDialogue || { count: 0, issues: [] }; }

function detectCombatDensity(content) {
    if (!content) return { ratio: 0, sensoryLayers: 0, weaponSpecificity: 0 };
    const COMBAT_KEYWORDS = /斩|劈|刺|射|轰|碎|裂|击|穿|爆|燃烧|火焰|冰|雷|血|骨|拳|掌|腿|刀|剑|弩|箭|盾|甲|冲击|碰撞|撕裂|贯穿|碾|压|飞|闪|躲|挡|格|架|反击|暴击|必杀/;
    const SENSORY_VISUAL = /血|碎|裂|光|焰|火|冰|雷|影|闪|亮|暗|红|黑|白|金|银|灰/;
    const SENSORY_AUDIO = /嗡|鸣|轰|炸|碎裂声|嘶|吼|咆|尖叫|嗡鸣|震|颤|砰|嘭|咔|嘎/;
    const SENSORY_TACTILE = /灼|烫|冰|冷|刺痛|麻|酥|震|压|撕裂感|灼热|刺骨|滚烫|冰凉/;
    const WEAPON_SPECIFIC = /弩|箭|剑|刀|矛|戟|盾|锤|斧|弓|枪|青铜|铁|钢|符咒|法阵|机关|冲击钻/;
    const totalLen = content.length || 1;
    let combatChars = 0;
    for (const line of content.split(/[。！？\n]/)) { if (COMBAT_KEYWORDS.test(line)) combatChars += line.length; }
    const ratio = combatChars / totalLen;
    let sensoryLayers = 0;
    if (SENSORY_VISUAL.test(content)) sensoryLayers++;
    if (SENSORY_AUDIO.test(content)) sensoryLayers++;
    if (SENSORY_TACTILE.test(content)) sensoryLayers++;
    const weaponHits = (content.match(WEAPON_SPECIFIC) || []).length;
    return { ratio: Math.round(ratio * 100) / 100, sensoryLayers, weaponSpecificity: Math.round((weaponHits / (totalLen / 1000)) * 10) / 10, combatRatioPercent: Math.round(ratio * 100) };
}

function detectHumorPacing(content) {
    if (!content) return { humorCount: 0, humorDensity: 0 };
    const HUMOR_PATTERNS = [/实习|试用期|五险一金|编制|加班|打卡|KPI|绩效|报销|转正/, /包吃住|合同|签|工资|薪水|奖金|社保|公积金/, /不是吧|开什么玩笑|你认真的|离谱|抽象|绷不住/, /吐槽|抱怨|翻白眼|无语|扶额|嘴角抽搐/, /兵马俑.*站岗|秦.*加班|始皇帝.*批准|大秦.*报销/];
    let humorCount = 0;
    for (const pattern of HUMOR_PATTERNS) { const matches = content.match(pattern); if (matches) humorCount += matches.length; }
    const words = content.replace(/\s/g, '').length || 1;
    return { humorCount, humorDensity: Math.round((humorCount / (words / 1000)) * 100) / 100 };
}

const COWARD_BEHAVIOR_PATTERNS = [
    { pattern: /明明.*却.*不动|明明.*却.*犹豫|明明.*却.*没有|有能力.*却.*不|明明可以.*却/g, type: '有能力不行动', severity: 'critical' },
    { pattern: /眼睁睁.*看着|只能.*看着.*被|却只是.*看着|没有.*出手|没有.*阻止/g, type: '见死不救', severity: 'critical' },
    { pattern: /等到.*才动手|等到.*才出手|等到.*才反应|损失.*才|死了.*才|残了.*才/g, type: '等出事才动', severity: 'critical' },
    { pattern: /要不要.*出手|会不会.*太过分|是不是.*不该|会不会.*太残忍|会不会.*太狠/g, type: '圣母式犹豫', severity: 'high' },
    { pattern: /还是.*算了吧|还是.*忍一忍|还是.*别管|还是.*先观察|还是.*再等等/g, type: '拖延不出手', severity: 'high' }
];

function detectCowardBehavior(content) {
    if (!content) return { isViolation: false, issues: [], hasCriticalIssue: false };
    const issues = [];
    for (const { pattern, type, severity } of COWARD_BEHAVIOR_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        const matches = [];
        let m;
        while ((m = regex.exec(content)) !== null) matches.push({ match: m[0], position: m.index, context: content.substring(Math.max(0, m.index - 20), Math.min(content.length, m.index + m[0].length + 20)) });
        if (matches.length > 0) issues.push({ type, severity, count: matches.length, examples: matches.slice(0, 3).map(e => `"${e.match}"`), desc: `${type}：发现${matches.length}处（${matches.slice(0, 3).map(e => `"${e.match}"`).join('、')}）` });
    }
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    return { isViolation: criticalIssues.length > 0 || issues.filter(i => i.severity === 'high').length >= 2, issues, hasCriticalIssue: criticalIssues.length > 0 };
}

function detectCharacterNameMismatch(content, characterNames) {
    if (!content || !Array.isArray(characterNames) || characterNames.length === 0) return { hasMismatch: false, unknownNames: [], missingNames: [] };
    const missingNames = characterNames.filter(n => !content.includes(n));
    const knownNameSet = new Set(characterNames);
    const subNameSet = new Set();
    for (const known of characterNames) { if (known.length < 2) continue; for (let i = 0; i < known.length; i++) { for (let len = 2; len <= Math.min(3, known.length); len++) { if (i + len <= known.length) subNameSet.add(known.substring(i, i + len)); } } }
    const SPEECH_VERBS = ['说','道','笑','喊','叫','问','答','叹','哼','吼','骂','哭','唱','念','读','应','回','嗯','哦','啊','呀','哈','嘿','嗤','唔','噢','哇','咦','哎','低声','高声','大声','小声','轻声','沉声','冷声','温声','柔声','厉声','怒声','冷冷','淡淡','默默','静静','缓缓','轻轻','悄悄','微微','开口','闭嘴','点头','摇头','摆手','挥手','伸手','缩手','转身','回头','抬头','低头'];
    const bigramNamePositionCounts = new Map();
    for (let i = 0; i <= content.length - 2; i++) {
        const c1 = content.charCodeAt(i);
        const c2 = content.charCodeAt(i + 1);
        if (c1 < 0x4e00 || c1 > 0x9fff || c2 < 0x4e00 || c2 > 0x9fff) continue;
        const bigram = content.substring(i, i + 2);
        if (knownNameSet.has(bigram) || subNameSet.has(bigram)) continue;
        const afterBigram = content.substring(i + 2, Math.min(i + 6, content.length));
        const beforeBigram = content.substring(Math.max(0, i - 4), i);
        let inNamePosition = false;
        for (const suffix of SPEECH_VERBS) { if (afterBigram.startsWith(suffix)) { inNamePosition = true; break; } }
        if (!inNamePosition && /^[""「『]/.test(afterBigram)) inNamePosition = true;
        if (!inNamePosition && /(?:和|与|跟)$/.test(beforeBigram)) inNamePosition = true;
        if (inNamePosition) bigramNamePositionCounts.set(bigram, (bigramNamePositionCounts.get(bigram) || 0) + 1);
    }
    const unknownNames = [];
    for (const [name, count] of bigramNamePositionCounts) { if (count < 2 || knownNameSet.has(name) || subNameSet.has(name)) continue; unknownNames.push({ name, count }); }
    unknownNames.sort((a, b) => b.count - a.count);
    return { hasMismatch: unknownNames.length > 0 || missingNames.length > 0, unknownNames, missingNames };
}

module.exports = { detectTellVerbs, extractEndingTension, calcInfoDripScore, detectModernSlang, detectAdultPerspective, detectTechJargon, detectCrossChapterRepetition, detectPipelineMetadataLeak, detectOnomatopoeiaDensity, detectVisualAnchors, detectMotherChildDialogue, detectCombatDensity, detectHumorPacing, detectCowardBehavior, detectCharacterNameMismatch, COWARD_BEHAVIOR_PATTERNS };
