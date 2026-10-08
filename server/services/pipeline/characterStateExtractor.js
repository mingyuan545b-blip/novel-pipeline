/**
 * 角色状态字段提取模块
 * 从AI返回的文本中提取结构化角色字段
 */

const { extractLabeledFields, splitQuoteMemoryPoint, parseCatchphraseText } = require('./characterStateLabeledFields');

/**
 * 从【金句库】标签提取金句列表
 * 支持格式：
 *   - "场景：金句" 或 "场景: 金句"
 *   - "1. 场景：金句" 编号列表
 *   - 纯金句（无场景标注）归为通用场景
 * 返回：[{ scene, quote }, ...]
 */
function extractQuoteLibrary(content) {
    if (!content) return [];
    // 截取【金句库】到下一个【XX】标签或文本结尾
    const blockMatch = content.match(/【?(?:金句库|金句|代表性金句)[/:：】]\s*([\s\S]*?)(?=【[^】]+[/:：】]|$)/);
    if (!blockMatch) return [];

    const block = blockMatch[1].trim();
    if (!block) return [];

    const quotes = [];
    // 按换行或编号切分
    const lines = block.split(/\n|(?=\d+[.、)])/).map(s => s.trim()).filter(Boolean);

    for (const line of lines) {
        // 去掉行首编号
        const cleaned = line.replace(/^\d+[.、)]\s*/, '').trim();
        if (!cleaned || cleaned.length < 2) continue;

        // 尝试匹配 "场景：金句" 或 "场景: 金句"；金句尾部可带"（记忆点）"
        const sceneMatch = cleaned.match(/^([^:：]{2,20})[：:]\s*(.+)$/);
        if (sceneMatch) {
            const scene = sceneMatch[1].trim();
            const { quote, why } = splitQuoteMemoryPoint(sceneMatch[2]);
            if (quote.length >= 2) quotes.push(why ? { scene, quote, why } : { scene, quote });
        } else {
            // 无场景标注，归为"通用场景"
            const { quote, why } = splitQuoteMemoryPoint(cleaned);
            if (quote.length >= 2) quotes.push(why ? { scene: '通用场景', quote, why } : { scene: '通用场景', quote });
        }
    }
    return quotes;
}

/** 从非结构化文本中fallback提取personality */
function fallbackPersonality(content) {
    const rules = [
        /(?:具有|有着?|是)([^。，,；\n]{2,20})(?:的性格|性格特征|个性)/,
        /性格(?:特征|特点)?[是为：:\s]+([^。，,；\n]{2,30})/,
        /(?:外柔内刚|外冷内热|外刚内柔|温柔|冷酷|开朗|沉稳|活泼|内向|倔强|坚韧|敏感|豪爽|细腻|洒脱)/,
    ];
    for (const re of rules) {
        const m = content.match(re);
        if (m) return m[1] ? m[1].trim() : m[0].trim();
    }
    return null;
}

/** 从纯文本格式中提取personality（如"NPC，小满，六岁。天真烂漫"） */
function fallbackPlainTextPersonality(content) {
    const rules = [
        /[一二三四五六七八九十\d]+岁[。.，,]\s*([^,，。；\n]{2,30}?)(?:[,，。；\n]|$)/,
        /[,，]\s*([^,，。；\n]{2,20}?(?:天真|烂漫|活泼|安静|乖巧|懂事|倔强|温柔|善良|机灵|聪慧|调皮|内向|开朗|沉稳|敏感|坚韧|细腻|洒脱|豪爽|冷酷|冷漠|热情|乐观|悲观|胆小|勇敢|害羞|大方|固执|随和|急躁|冷静|忠诚|狡猾|正直|单纯|复杂|天真烂漫|外柔内刚|外冷内热|外刚内柔))[^,，。；\n]*/,
        /[,，]\s*性格(?:是|为)?([^,，。；\n]{2,20})/,
    ];
    for (const re of rules) {
        const m = content.match(re);
        if (m && m[1] && m[1].trim().length >= 2) return m[1].trim();
    }
    return null;
}

/** 从描述文本中fallback提取position */
function fallbackPosition(content) {
    // 职业后缀——排除过于宽泛的"人/女/男/孩/童"避免误匹配
    const JOB_SUFFIX = '(?:师|长|者|员|官|主|总|理|工|匠|手|家|生|兵|将|侠|客|徒|卫|仆|侍)';
    const rules = [
        new RegExp(`(?:是|身为|担任|任职于?)([^。，,；\\n]{2,40}?${JOB_SUFFIX})`),
        new RegExp(`^([^。，,；\\n]{2,30}?${JOB_SUFFIX})[,，。]`, 'm'),
        // 逗号分隔的职业描述，要求前缀是2-4字的职业名
        new RegExp(`[,，]\\s*([\\u4e00-\\u9fa5]{2,8}?${JOB_SUFFIX})[,，。；\\n]`),
    ];
    for (const re of rules) {
        const m = content.match(re);
        if (m && m[1] && m[1].trim().length >= 2) return m[1].trim();
    }
    return null;
}

/** 从描述文本中fallback提取signatureDetail */
function fallbackSignatureDetail(content) {
    const rules = [
        /【?标志性动作[/:：】]\s*([^【\n]{2,80}?(?:；|。|$))/,
        // 修复：原先 `习惯([^。，,；\n]{4,40})` 会把"【习惯】"的右括号一起吞进结果
        // （实测产出 "】收殓时必与尸体低声交谈"），这里先剥掉标签分隔符再取值
        /习惯(?:性)?[】/:：]?\s*([^。，,；\n】\[]{4,40})/,
    ];
    for (const re of rules) {
        const m = content.match(re);
        if (m) return m[1] ? m[1].trim() : m[0].trim();
    }
    return null;
}

/** 从描述文本中fallback提取speakingTone */
function fallbackSpeakingTone(content) {
    const rules = [
        /(?:说话|语气|口吻|语调)(?:是|为|：|:)\s*([^,，。；\n]{2,30})/,
        /(?:轻声|低声|高声|柔声|冷声|温和地|冷淡地|热情地|平静地)(?:说|道|问|喊|叫)/,
    ];
    for (const re of rules) {
        const m = content.match(re);
        if (m) return m[1] ? m[1].trim() : m[0].trim();
    }
    return null;
}

/**
 * 从角色素材文本中提取结构化状态字段
 * 三层提取策略：标签格式 → 半结构化 → 纯文本fallback
 */
function extractCharacterStateFromContent(content, schema) {
    const state = {};
    if (schema?.fields) {
        for (const [key, field] of Object.entries(schema.fields)) {
            if (state[key] === undefined && field.defaultValue !== undefined) {
                state[key] = field.defaultValue;
            }
        }
    }

    // 第一层：标签格式提取
    Object.assign(state, extractLabeledFields(content));

    // 高光场景：标签型单段文本 → 结构化 [ { scene, what } ]（供 entities.highlightScenes / formatters 使用）
    if (state.highlightSceneText && !state.highlightScenes) {
        const what = String(state.highlightSceneText).trim();
        if (what) state.highlightScenes = [{ scene: '高光场景', what }];
    }
    delete state.highlightSceneText;

    // 口头禅/名梗：标签型多行文本 → 结构化 [ { text, trigger, why } ]
    if (state.catchphraseText && !state.catchphrases) {
        const parsed = parseCatchphraseText(state.catchphraseText);
        if (parsed.length > 0) state.catchphrases = parsed;
    }
    delete state.catchphraseText;

    // 金句库独立提取（多句多场景，无法用单行正则）
    const quoteLibrary = extractQuoteLibrary(content);
    if (quoteLibrary.length > 0) state.quoteLibrary = quoteLibrary;

    // 第二层：半结构化fallback
    if (!state.personality) state.personality = fallbackPersonality(content);
    if (!state.position) state.position = fallbackPosition(content);
    if (!state.signatureDetail) state.signatureDetail = fallbackSignatureDetail(content);
    if (!state.speakingTone) state.speakingTone = fallbackSpeakingTone(content);

    // 第三层：纯文本fallback
    if (!state.personality) state.personality = fallbackPlainTextPersonality(content);

    // 将profile字段打包到profile对象（含人物四件套：欲望/恐惧/谎言/创伤）
    const profileKeys = ['appearance', 'background', 'motivation', 'desire', 'fear', 'lie', 'trauma'];
    const profile = {};
    for (const pk of profileKeys) {
        if (state[pk]) { profile[pk] = state[pk]; delete state[pk]; }
    }
    if (Object.keys(profile).length > 0) state.profile = profile;
    return state;
}

module.exports = {
    extractCharacterStateFromContent,
    extractLabeledFields,
    extractQuoteLibrary,
    fallbackPersonality,
    fallbackPlainTextPersonality,
    fallbackPosition,
    fallbackSignatureDetail,
    fallbackSpeakingTone,
};
