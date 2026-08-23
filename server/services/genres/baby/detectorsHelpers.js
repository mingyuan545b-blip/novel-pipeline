const perspective = require('./perspectiveConfig');

function buildParagraphContexts(content) {
    const ADULT_CONTEXT_WORDS = perspective.adultContextWords;
    const BABY_CONTEXT_WORDS = perspective.babyContextWords;
    const paragraphs = content.split(/\n\n+/);
    const contexts = paragraphs.map(para => {
        if (ADULT_CONTEXT_WORDS.test(para) && !BABY_CONTEXT_WORDS.test(para)) return 'adult';
        if (BABY_CONTEXT_WORDS.test(para) && !ADULT_CONTEXT_WORDS.test(para)) return 'baby';
        if (ADULT_CONTEXT_WORDS.test(para) && BABY_CONTEXT_WORDS.test(para)) return 'mixed';
        return 'unknown';
    });
    return { paragraphs, contexts };
}

function findParagraphIndex(pos, paragraphs) {
    let cumLen = 0;
    for (let i = 0; i < paragraphs.length; i++) {
        if (cumLen + paragraphs[i].length >= pos) return i;
        cumLen += paragraphs[i].length + 2;
    }
    return 0;
}

function checkBabyInnerVoice(content, paragraphs, paragraphContexts, issues) {
    const BABY_NAMES = perspective.babyNames;
    const BABY_INNER_VOICE_PATTERNS = [
        { pattern: new RegExp(`(${BABY_NAMES.source}).{0,5}(意识到|明白|暗想|暗道|心中暗|盘算|算计|权衡|谋划|战略布局|深谋远虑)`), desc: '幼崽成人化内心独白（critical）', severity: 'critical' },
        { pattern: new RegExp(`(${BABY_NAMES.source}).{0,5}(必须|不得不|显然|由此可见|综上所述|战略|权谋|布局)`), desc: '幼崽成人化认知判断（critical）', severity: 'critical' },
    ];

    for (const { pattern, desc, severity } of BABY_INNER_VOICE_PATTERNS) {
        const matches = [];
        let m;
        const regex = new RegExp(pattern.source, 'g');
        while ((m = regex.exec(content)) !== null) {
            const paraIdx = findParagraphIndex(m.index, paragraphs);
            const pCtx = paragraphContexts[paraIdx] || 'unknown';
            if (pCtx === 'adult' || pCtx === 'mixed') continue;
            matches.push(m[0]);
        }
        if (matches.length > 0) {
            issues.push({ desc, pattern: pattern.source, severity, count: matches.length });
        }
    }
}

function checkBabyCausalReasoning(content, paragraphs, paragraphContexts, issues) {
    const BABY_NAMES = perspective.babyNames;
    const BABY_CAUSAL_PATTERN = new RegExp(`(${BABY_NAMES.source})([^不]{0,5})(知道|清楚).{0,10}(必须|应该|所以|因此|这意味着)`);
    const causalMatches = [];
    let cm;
    const causalRegex = new RegExp(BABY_CAUSAL_PATTERN.source, 'g');
    while ((cm = causalRegex.exec(content)) !== null) {
        const paraIdx = findParagraphIndex(cm.index, paragraphs);
        const pCtx = paragraphContexts[paraIdx] || 'unknown';
        if (pCtx !== 'adult') causalMatches.push(cm[0]);
    }
    if (causalMatches.length > 0) {
        issues.push({ desc: `幼崽因果推理越界（${causalMatches.length}处）`, pattern: BABY_CAUSAL_PATTERN.source, severity: 'high', count: causalMatches.length });
    }
}

function checkAdultInnerVoiceExcess(content, paragraphContexts, paragraphs, issues) {
    const ADULT_CHARACTER_PATTERNS = [
        { pattern: /(?<!原来)(他|她)(意识到|明白|暗想|暗道|心中暗|盘算|算计|权衡|谋划)/, desc: '成人角色深度内心独白' },
        { pattern: /心中(想|道|叹)/, desc: '成人角色内心独白' },
    ];
    const ADULT_EXCLUDED_PATTERNS = [
        /原来.{2,15}(不是|是个|是)/,
        /他.{1,10}(把它|把它|叫醒|做|去)/,
        /(不是|不是乱冲).{0,5}(是有节奏|是惊喜|是安心)/,
        /(手指|手心|肩膀).{0,10}(发颤|发抖|微微).{0,10}(不是害怕|不是冷|是惊喜)/
    ];
    let adultInnerVoiceCount = 0;
    for (const { pattern } of ADULT_CHARACTER_PATTERNS) {
        const matches = content.match(new RegExp(pattern.source, 'g'));
        if (matches) adultInnerVoiceCount += matches.length;
    }
    for (const exPattern of ADULT_EXCLUDED_PATTERNS) {
        const exMatches = content.match(new RegExp(exPattern.source, 'g'));
        if (exMatches) adultInnerVoiceCount = Math.max(0, adultInnerVoiceCount - exMatches.length);
    }
    const adultParaCount = paragraphContexts.filter(c => c === 'adult' || c === 'mixed').length;
    const adultRatio = adultParaCount / Math.max(paragraphs.length, 1);
    const adultVoiceThreshold = adultRatio > 0.3 ? 4 : 2;
    if (adultInnerVoiceCount > adultVoiceThreshold) {
        issues.push({
            desc: `成人角色内心活动过多（${adultInnerVoiceCount}>${adultVoiceThreshold}处/章），应优先通过幼崽可观察行为侧面表达`,
            pattern: 'adult-inner-voice-excess',
            severity: 'high'
        });
    }
}

function checkOmniscientNarration(content, paragraphs, paragraphContexts, issues) {
    const OMNISCIENT_PATTERNS = [
        { pattern: /[，。]\s*[^，。]*?(早就|早已|本来|其实|事实上|殊不知)[^，。]*?(就|便|已|在)[^，。]{0,20}(了|着|过)[^，。]*?[，。]/, desc: '全知旁白：叙述者知道角色不应知道的信息' },
        { pattern: /(?:沉睡|休眠|蛰伏|埋藏|隐藏).{0,10}[一二三四五六七八九十\d]+年/, desc: '全知旁白+打破第四面墙：引用章回编号' },
        { pattern: /(?:在脑海里|在心中|在心底|在意识深处)(翻腾|涌动|浮现|闪过|掠过)/, desc: '全知旁白：无角色归属的内心描写' },
        { pattern: /^(?!.*(?:小满|团团|林晚|他觉得|他看见|他感觉|他发现|他说|他问|妈妈|妈咪)).{0,30}(早就|早已|本来就该|注定|命运|宿命)/, desc: '全知旁白：上帝视角叙事' },
    ];
    for (const { pattern, desc } of OMNISCIENT_PATTERNS) {
        const matches = content.match(new RegExp(pattern.source, 'g'));
        if (matches) {
            for (const match of matches) {
                const paraIdx = findParagraphIndex(content.indexOf(match), paragraphs);
                const pCtx = paragraphContexts[paraIdx] || 'unknown';
                if (pCtx === 'adult') continue;
                issues.push({ desc: desc + '："' + match.substring(0, 30) + '"', pattern: pattern.source, severity: 'critical' });
            }
        }
    }
}

function checkBabyPresence(content, issues) {
    const BABY_NAMES = perspective.babyNames;
    const babyActionPatterns = perspective.babyActionPatterns;
    if (!babyActionPatterns.test(content)) {
        issues.push({ desc: '全章无任何幼崽萌感行为（拍手/蹦跳/抱大腿/蹭人/歪头/哼唧等）', pattern: 'missing-baby-action', severity: 'medium' });
    }

    const firstPersonBaby = /(我要吃|怕怕|抱抱|要要|好吃|嗝|肚肚)/;
    const babyActionVerbs = '拍拍?小手|拍手|蹦蹦?跳跳?|蹦跳|抱住|缩成|吃手|蹭|拍肚皮|打嗝|歪头|眨眼|拽着|抓住|爬|趴|钻|扑|啃|吧唧|揉|摸|扯|哼唧|咕噜|扭|摇|抓';
    const thirdPersonBaby = new RegExp(`(${BABY_NAMES.source})(${babyActionVerbs})`);
    const babySensoryPattern = new RegExp(`(${BABY_NAMES.source}).{0,10}(觉得|感觉|看见|听见|闻到|好暖|好软|好香|好冷|好硬)`);
    const hasBabyPerspective = firstPersonBaby.test(content) || thirdPersonBaby.test(content) || babySensoryPattern.test(content);
    if (!hasBabyPerspective) {
        issues.push({ desc: '全章无幼崽视角/行为描写，完全是成人观察视角', pattern: 'missing-baby-perspective', severity: 'high' });
    }
}

module.exports = {
    buildParagraphContexts,
    findParagraphIndex,
    checkBabyInnerVoice,
    checkBabyCausalReasoning,
    checkAdultInnerVoiceExcess,
    checkOmniscientNarration,
    checkBabyPresence
};
