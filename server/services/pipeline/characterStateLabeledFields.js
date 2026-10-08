/**
 * 角色状态·标签格式字段提取（从 characterStateExtractor 拆出，保证单文件≤200行）
 */

/** 标签格式正则提取规则 */
const LABELED_PATTERNS = [
    [/【?身份[/:：】]\s*([^【。，,；\n]{2,50})/, 'position'],
    [/【?(?:职位|身份|职务|职业特征|职业|角色定位)[/:：】]\s*([^【。，,；\n]{2,80})/, 'position'],
    [/【?(?:阵营|派系|所属|组织)[/:：】]\s*([^【。，,；\n]{2,50})/, 'factionName'],
    [/【?(?:性格|性格特点|性格特征)[/:：】]\s*([^【。，,；\n]{2,80})/, 'personality'],
    [/【?(?:说话语气|语气|口吻)[/:：】]\s*([^【。，,；\n]{2,80})/, 'speakingTone'],
    // 方言/语感/说话风格（陷阱：素材用【方言/语感】【说话风格】【说话风味】，此前无映射 → speakingTone 恒空）
    [/【?(?:方言[／/]?语感|方言|口音|说话风格|说话风味|语言风格|说话特点)[/:：】]\s*([^【\n]{2,120})/, 'speakingTone'],
    [/【?(?:标志性细节|标志性动作|标志细节|标志|辨识特征)[/:：】]\s*([^【。，,；\n]{2,100})/, 'signatureDetail'],
    [/【?(?:习惯|日常习惯|行为习惯)[/:：】]\s*([^【。，,；\n]{2,100})/, 'signatureDetail'],
    [/【?(?:主角镜像|镜像对比)[/:：】]\s*([^【。，,；\n]{2,80})/, 'protagonistMirror'],
    [/【?(?:独立立场|立场驱动)[/:：】]\s*([^【。，,；\n]{2,80})/, 'independentStance'],
    [/【?(?:命运弧光|命运走向|弧光)[/:：】]\s*([^【。，,；\n]{2,80})/, 'fateArc'],
    [/【?(?:内在矛盾|内心矛盾|矛盾冲突)[/:：】]\s*([^【。，,；\n]{2,80})/, 'innerConflict'],
    [/【?(?:创作风格)[/:：】]\s*([^【。，,；\n]{2,100})/, 'craftStyle'],
    [/【?(?:外貌|外貌描写|外貌特征)[/:：】]\s*([^【。，,；\n]{2,120})/, 'appearance'],
    [/【?(?:背景|身世|人物背景|角色背景)[/:：】]\s*([^【。，,；\n]{2,120})/, 'background'],
    [/【?(?:核心动机|动机|核心驱动力|驱动力)[/:：】]\s*([^【。，,；\n]{2,100})/, 'motivation'],
    // 人物魅力系统4维度（参考蛊真人方源设计）
    [/【?(?:人格魅力|魅力点|核心魅力)[/:：】]\s*([^【\n]{2,300})/, 'charisma'],
    [/【?(?:哲学观|哲学理念|核心信念|价值观)[/:：】]\s*([^【\n]{2,400})/, 'philosophy'],
    [/【?(?:出场设计|出场方式|出场场景|首次出场)[/:：】]\s*([^【\n]{2,400})/, 'entranceDesign'],
    // 高光场景（名场面）——初始设计即产出，此前无映射 → highlightScenes 恒空
    [/【?(?:高光场景|高光时刻|名场面)[/:：】]\s*([^【\n]{2,400})/, 'highlightSceneText'],
    // 口头禅/名梗（2026-10-08）：可复用的招牌话，非一次性对白
    [/【?(?:口头禅|名梗|招牌话|口头语|口头习惯)[/:：】]\s*([^【\n]{2,400})/, 'catchphraseText'],
    // 人物四件套（欲望/恐惧/谎言/创伤）——主角设计必填，落 profile
    [/【?(?:欲望|核心欲望|渴望)[/:：】]\s*([^【\n]{2,200})/, 'desire'],
    [/【?(?:恐惧|核心恐惧)[/:：】]\s*([^【\n]{2,200})/, 'fear'],
    [/【?(?:谎言|核心谎言)[/:：】]\s*([^【\n]{2,200})/, 'lie'],
    [/【?(?:创伤|核心创伤)[/:：】]\s*([^【\n]{2,200})/, 'trauma'],
];

/** 从标签格式文本中提取字段 */
/**
 * 清除组合标签残留：《身份/职位》这类双标签只被正则吃掉第一个分隔符，
 * 第二个标签会跟着进捕获组（实测 陈默 position="职位】前户曹档案库职员"、
 * personality="动机】狂热、绝望、自我感动"）。
 * 规则：仅当值以「2-8个汉字 + 】」开头时才剥离该标签前缀。
 */
function stripLabelResidue(value) {
    if (typeof value !== 'string') return value;
    const stripped = value.replace(/^[一-龥]{2,8}[】\]]\s*/, '');
    return stripped.trim() || value.trim();
}

function extractLabeledFields(content) {
    const state = {};
    for (const [regex, key] of LABELED_PATTERNS) {
        const m = content.match(regex);
        if (m) state[key] = stripLabelResidue(m[2] ? m[2].trim() : m[1].trim());
    }
    return state;
}

/**
 * 拆出金句尾部的"（记忆点）"——设计模板要求每条金句带为什么记得住。
 * 形如 `绝境：人生如棋，落子无悔（他一生都在替别人算账）` → why="他一生都在替别人算账"
 */
function splitQuoteMemoryPoint(raw) {
    const text = String(raw || '').trim();
    const m = text.match(/^(.+?)\s*[（(]([^（()）]{4,})[)）]\s*$/);
    if (!m) return { quote: text.replace(/[。.；;]$/, ''), why: '' };
    return { quote: m[1].trim().replace(/[。.；;]$/, ''), why: m[2].trim() };
}

/** 口头禅/名梗标签文本 → 结构化 [{ text, trigger, why }]（支持"场合：口头禅（辨别度）"多行） */
function parseCatchphraseText(text) {
    const list = String(text || '').split(/\n|(?=\d+[.、)])/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const line of list) {
        const m = line.replace(/^\d+[.、)]\s*/, '').match(/^([^:：]{2,20})[：:]\s*(.+)$/);
        const src = m ? m[2] : line;
        const { quote, why } = splitQuoteMemoryPoint(src);
        if (quote) out.push({ text: quote, trigger: m ? m[1].trim() : '', why: why || '' });
    }
    return out;
}

module.exports = { LABELED_PATTERNS, stripLabelResidue, extractLabeledFields, splitQuoteMemoryPoint, parseCatchphraseText };
