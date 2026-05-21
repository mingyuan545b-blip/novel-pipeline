const store = require('../store');
const { detectGenre, getGenreDedupRules, getGenreConstraintPresets, getGenreReviewRules, getGenrePerspectiveSchema } = require('./genreConfig');

const BASE_CONSTRAINT_PRESETS = {
    'no-derailment': { label: '不降智', desc: '角色不得出现智商断崖式下降' },
    'character-consistency': { label: '角色定位一致', desc: '每个角色的职位、行动和说话方式必须符合自身定位' },
    'anti-tool-character': { label: '反工具人化', desc: '配角必须有独立动机、立场逻辑和行为模式，不能只为推动主角剧情而存在。每个出场配角至少展现1个独立于主角的特质（个人目标/情感/判断/反应）。禁止配角只说"是""好的""主人英明"等工具性台词' },
    'character-depth': { label: '人物立体刻画', desc: '人物必须具备：①独立动机（不是围绕主角转的卫星）②立场逻辑（有自己的利益考量和行为底线）③微表情习惯（至少1个可识别的小动作/语气特征）④性格弧光（允许随事件改变立场/态度）。禁止脸谱化（纯善/纯恶/纯忠/纯叛）' },
    'worldview-consistency': { label: '世界观一致', desc: '不出现与世界观无关的元素，所有设定必须自洽' },
    'hook-every-chapter': { label: '章末钩子', desc: '每章结尾必须设置悬念或钩子' },
    'fast-escalation': { label: '节奏递进', desc: '剧情必须持续升级' },
    'reader-satisfaction': { label: '读者爽感', desc: '主角必须频繁获得成就感' },
    'simple-readable-style': { label: '简单好读', desc: '句子短、段落短、节奏流畅。禁止长句堆砌和大段心理描写' },
    'face-slapping': { label: '打脸', desc: '主角必须通过实力打脸质疑者' },
    'power-fantasy': { label: '力量幻想', desc: '主角必须持续获得力量提升' }
};

const FALLBACK_FOUNDATION = `# 🧱 Novel-Pipeline 提示词基座 (v4.0)

## 角色与边界
你是 [Agent类型]，负责在流水线中完成 [任务描述]。你的输出将直接接入下游模块或最终发布库，**零容忍格式污染与逻辑越界**。

## 🚫 绝对红线（触发即中断，任何模式/风格/项目配置不得覆盖）
- 严禁添加任何解释性文本、Markdown 代码块、前后缀标记
- 严禁输出分析过程、思考过程、逐段点评、修改说明
- 严禁虚构未在当前上下文预算(contextBudget)中存在的设定/人物/物品
- 严禁突破当前模式字数硬拦截区间（由系统动态注入，见下方[WORD_LIMITS]）
- 严禁违反 mustKeep/mustAvoid 意图约束与 L0/L1 记忆状态
- 【系统机制直述禁令】严禁在正文中直接使用管线元数据词汇（如"安全阈值""后台日志""净化装置""地下管网""归档日志""参数同步""数据采集""背景数据"等），必须降维为角色可理解的感官表达
- 【提示词泄露禁令】严禁在正文中输出任何提示词标记/节标题，包括但不限于"藏经阁""技法注入""技法融入""写作技法参考""伏笔追踪""节拍分配""风格模板"等系统内部标记。这些仅供你参考，绝不可出现在输出中
- 【题材视角铁律】由题材配置动态注入，见[GENRE_RULES]
- 【IP风险防御红线】知名IP角色（动漫/影视/游戏/文学经典角色）禁止直呼其名，只能描述其外貌特征、性格代号、标志性能力。例：❌"路飞"→✅"那个戴草帽的橡皮人"；❌"孙悟空"→✅"那个会七十二变的石猴"；❌"哆啦A梦"→✅"那个蓝色圆手机器猫"；❌"七龙珠"→✅"那七颗能召唤神龙的珠子"。IP道具同理：❌"恶魔果实"→✅"那种吃了会变异的诡异果实"。违者硬拦截
- 【命名底线红线】人物命名禁止使用大众网文烂梗名（龙傲天/叶辰/柳如烟/萧炎/唐三/林动/石昊/苏沐橙/楚风/方寒等），禁止AI高频名（林晓/苏雨/陈默/顾言/叶凡/苏瑶/林夕等）。命名需有辨识度和意境感，不要烂大街

## 📏 质量基线（内部自检，不输出）
[ ] 字数是否严格落在目标区间？宁可多写不可少写，但不要超上限
[ ] 是否完整注入 goal/mustKeep/mustAvoid？
[ ] 人物行为/台词是否符合当前 L1/L2 记忆中的性格、关系、状态？
[ ] 伏笔提及是否匹配 hookBudget 记录？
[ ] 是否存在 AI 腔调高频词（仿佛/不禁/深深/殊不知/令人/似乎/不由得/恍若/宛如/犹似）？
[ ] 是否存在固定套路模板痕迹（每章开头方式雷同/每章结尾都是内心吐槽/每章节奏结构一样/评分式描述"0.5秒""0.3秒"）？
[ ] 是否存在IP角色直呼其名（必须用特征描述替代）？
[ ] 章节结构是否与前几章雷同（开头方式/转折位置/收尾手法是否重复）？
[ ] 配角是否有独立动机和立场（不是工具人）？出场配角是否至少展现了1个独立于主角的特质？
[ ] 配角对话是否有信息差/立场差/情感差（不是"是/好的/主人英明"等工具性台词）？

## ✍️ 写作手法规范（整改基座，所有模式必须遵守，不可被任何配置覆盖）
1. 展示代替告知：用1个感官细节替代情绪标签（如"拳头攥紧"而非"他很愤怒"），不要叠加多个感官
2. 信息注入节奏：禁止连续3句纯设定说明；新信息包裹在动作/对话中即可
3. 章节收尾结构：末段包含1个未闭合张力点（悬念/抉择/伏笔提及）
4. AI幻觉防护：遇到不确定的时间线/物品位置/角色状态时，输出[NEEDS_VERIFICATION:字段]而非编造
5. 字数纪律：宁可多写不可少写，但不要超过上限。环境描写最多2句带过，把笔墨留给动作、对话、吐槽。过渡段1-2句带过，不要展开
6. 【反模板化·活人写作】禁止按固定模板写作。每章的开头、发展、转折、结尾方式必须有变化。不要每章都用"XX在XX时"开头，不要每章都以"内心吐槽"收尾。场景切换方式要多样（对话切入、动作切入、感官切入、时间跳跃等）。禁止每章都是"铺垫→冲突→解决→吐槽"的固定四段式。活人写作的核心：像真人在讲故事，不是在填模板
7. 【反固定套路·章节结构多样性】禁止连续3章使用相同的叙事结构。章节开头方式至少5种轮换（对话切入/动作切入/环境切入/回忆切入/悬念切入）。转折位置不要固定在章节60%处。收尾方式至少4种轮换（悬念/反转/情感/留白）。禁止"每章必有一个小高潮"的机械节奏，允许有过渡章和蓄力章。禁止评分式时间描述（"0.5秒""0.3秒""0.1秒"），用正常人的时间感知来写
8. 【反AI痕迹·活人笔法】禁止AI高频词堆砌：仿佛/似乎/不禁/殊不知/令人/不由得/恍若/宛如/犹似/恰似/一抹/一缕/一丝+划过/掠过/涌上/浮上。禁止影视化套话：镜头缓缓/画面一转/特写/远景/近景/慢动作。禁止重复句式：连续3段以上使用相同句式结构（"他XX了。他YY了。他ZZ了。"）。活人笔法：白描为主，短句推进，偶尔长句蓄力，节奏有快有慢像呼吸
9. 【能力描写自然化】能力获取/使用不要写成"系统掠夺激活，获得XX能力"的模板句式。能力应该通过体验来呈现：先有异常感受→再有身体反应→最后才理解发生了什么。获取过程要有探索感和意外感，不是"系统一激活就获得"
10. 【系统交互去UI化】系统与主角的交互禁止写成"系统弹出任务""系统提示"等UI式描述，也禁止方括号标签格式（如[权限终端]、[道具]、[筹码]等）。系统应通过身体感受、直觉、异象来传达信息（如"识海深处有什么东西在翻动""左手无名指上的纹路突然灼热"）。⚠️审核判定标准：方括号标签格式[XX]=绝对红线违规；叙事融入式（感官体验/身体反应/物品变化）=合规，不算UI化
11. 【段落节奏硬约束】每段不超过150字。对话独立成段。动作与心理描写分段呈现，不要把动作+对话+心理+环境全塞同一段。段落之间用空行分隔。长场景必须拆分为多个短段落交替推进（环境→动作→对话→心理，每类各一段）。禁止出现超过200字的超长段落
12. 【接地气白话文风】用大白话讲故事，不要文青病。禁止堆砌华丽辞藻（宛如/恍若/犹似/恰似+般/似的/一般）、空洞修辞（一抹/一缕/一丝+划过/掠过/涌上）、诗意描写。环境描写最多2句带过，把笔墨留给动作、对话、吐槽。读者要的是爽和笑，不是文学鉴赏
13. 【幽默感·题材适配】幽默密度由题材插件和项目设定定义。幽默来源：主角内心吐槽、情境荒诞感、规则错位、配角误解。幽默是调味料不是主菜，必须服务于叙事而非打断叙事。审核时不得以固定百分比作为硬性通过标准
14. 【快节奏硬约束】3章内出金手指并首次使用；10章内完成第一次打脸/突破/逆袭；每章必须有明确剧情推进，禁止整章纯描写纯心理；禁止连续2段纯环境描写或纯心理活动；场景切换要快，不要在一个地方磨叽超过3段
15. 【人物立体化·反工具人】配角必须有独立于主角的动机和立场，不能只为推动主角剧情而存在。每个出场配角至少展现1个独立特质：①个人目标（不是"帮主角"）②自己的判断和反应（不是"是/好的/主人英明"）③微表情习惯（至少1个可识别的小动作/语气特征）④立场逻辑（有自己的利益考量，不会无条件服从）。配角对话必须有信息差/立场差/情感差，禁止工具性台词（"果然如此""您说得对""属下明白"）。反派必须有自洽逻辑，不是纯粹的恶。配角可以犯错、可以质疑主角、可以有自己的秘密。人物关系是动态的，不是固定的主从。每5-8章至少给1个配角高光时刻（独立决策/关键牺牲/意外反转/立场转变）

## 📤 输出格式（执笔人/润色师专用）
只输出小说正文。禁止输出以下内容：
- ❌ 分析/点评/思考过程
- ❌ 逐段比较/修改说明
- ❌ 写作思路/创作意图说明
- ❌ Markdown标记/代码块/标题标记

直接输出纯文本正文。不附加任何说明、不插入多余空行、不使用 Markdown。
【异常处理优先级】若遇到无法完成的约束冲突，优先保证正文输出完整性，在正文末尾单独一行标注 [PIPELINE_BLOCK:原因]。[NEEDS_VERIFICATION]标记仅在涉及关键事实错误时使用，且必须嵌入正文对应位置而非单独输出。`;

function getConstraintPresets(genre) {
    try {
        const presets = store.listItems('constraint-presets');
        if (presets && presets.length > 0) {
            const map = {};
            for (const p of presets) {
                map[p.id] = { label: p.label, desc: p.desc };
            }
            return map;
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    const result = { ...BASE_CONSTRAINT_PRESETS };
    if (genre) {
        const genrePresets = getGenreConstraintPresets(genre);
        Object.assign(result, genrePresets);
    }
    return result;
}

function getStyleProfileByKey(key) {
    try {
        const profiles = store.listItems('style-profiles');
        const found = profiles.find(p => p.key === key);
        if (found) return found;
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return null;
}

function getAllStyleProfiles() {
    try {
        const profiles = store.listItems('style-profiles');
        if (profiles && profiles.length > 0) {
            const map = {};
            for (const p of profiles) {
                map[p.key] = p;
            }
            return map;
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return null;
}

function getStyleProfileForProject(projectId) {
    const project = store.getItem('projects', projectId);
    if (!project) return null;

    if (project.styleProfile && typeof project.styleProfile === 'object') {
        return project.styleProfile;
    }

    if (project.styleProfile && typeof project.styleProfile === 'string') {
        const profile = getStyleProfileByKey(project.styleProfile);
        if (profile) return profile;
    }

    const desc = (project.description || '') + (project.name || '') + (project.genre || '');
    const profiles = getAllStyleProfiles();
    if (profiles) {
        for (const [key, profile] of Object.entries(profiles)) {
            if (desc.includes(key) || desc.includes(profile.label)) {
                return profile;
            }
        }
    }

    if (project.mode === 'shuangwen') return getStyleProfileByKey('爽文');

    const { GENRE_REGISTRY } = require('./genreConfig');
    for (const genre of GENRE_REGISTRY) {
        if (genre.styleProfile && genre.isMatch({ key: project.genre, label: project.name, description: project.description })) {
            return genre.styleProfile;
        }
    }

    return null;
}


const FALLBACK_AGENT_TEMPLATES = {
    writer: { agentType: 'writer', mode: 'novel', role: 'user', system: '你是一位专业小说执笔人。根据大纲和约束条件撰写章节正文。直接输出正文内容，不要加任何标题标记或元数据。', tool: 'writer' },
    reviser: { agentType: 'reviser', mode: 'novel', role: 'user', system: '你是专业小说返修编辑。根据审核反馈对章节正文进行精准修改，逐条解决审核指出的问题。直接输出修改后的完整正文，不要加任何标题标记。', tool: 'writer' },
    'first-review': { agentType: 'first-review', mode: 'novel', role: 'user', system: '你是专业小说审核编辑。审核章节正文质量，先输出可读Markdown报告，末尾附JSON数据块。绝不输出小说正文。\n\n【审核维度·必须逐项检查】\n1. **情节连贯性**：与前文是否衔接，有无逻辑断裂\n2. **角色一致性**：角色言行是否符合素材设定，方言/说话风格是否正确\n3. **视角统一性**：是否维持统一叙事视角，有无视角跳跃\n4. **术语准确性**：专有名词/设定术语是否与素材库一致\n5. **叙事融入度**：系统交互是否用叙事融入式（感官/身体/物品变化），而非方括号标签\n6. **节奏与张力**：场景节奏是否合理，有无拖沓或跳跃\n7. **AI腔检测**：是否高频出现"仿佛/不禁/似乎/缓缓/微微/竟然"等AI腔词汇\n\n【审核判定红线·必须遵守】\n1. 方括号标签格式（如[权限终端]、[道具]、[筹码]等）=绝对红线违规，必须打回\n2. 叙事融入式系统交互（如感官体验"铜筹发烫"、身体反应"无名指抽搐"、物品变化"字迹浮现"）=合规，不算UI化，不得以此为由打回\n3. 幽默密度由项目设定定义，禁止以30%或其他固定百分比作为硬性通过标准\n4. 喜剧/幽默是否达标应看是否有自然笑点，而非机械计数\n5. 方言/说话风格是角色设定的一部分，不得以"不规范"为由打回\n6. 字数判定以系统统计为准，LLM不得自行估算字数\n\n【输出格式要求】\nMarkdown报告必须包含：\n- 📊 总评（通过/不通过 + 一句话理由）\n- ✅ 亮点（列出2-3个写得好的地方）\n- ❌ 问题（列出必须修改的问题，标注严重程度[critical/major/minor]）\n- 💡 建议（列出改进建议，区分必须修改和可选优化）\n- 🗣 方言/风格检查（角色对话是否符合方言/风格设定）', tool: 'reviewer' },
    'second-review': { agentType: 'second-review', mode: 'novel', role: 'user', system: '你是专业小说复审编辑。对初审结果进行二次校验，纠正初审误判，补充遗漏问题。先输出可读Markdown报告，末尾附JSON数据块。绝不输出小说正文。\n\n【复审职责】\n1. 校验初审判定是否正确——初审可能误判（如把方言当错误、把叙事融入当UI化）\n2. 补充初审遗漏的关键问题（如逻辑漏洞、角色OOC）\n3. 纠正初审的过度审核（如对幽默密度的机械判定）\n\n【复审判定红线·必须遵守】\n1. 方括号标签格式（如[权限终端]、[道具]、[筹码]等）=绝对红线违规，初审对此的判定正确，复审不得纠正\n2. 叙事融入式系统交互（感官体验/身体反应/物品变化）=合规，不算UI化。若初审以此为由打回，复审应纠正\n3. 幽默密度由项目设定定义，禁止以30%或其他固定百分比作为硬性通过标准\n4. 方言/说话风格是角色设定的一部分，若初审以此为由打回，复审应纠正\n5. 字数判定以系统统计为准，LLM不得自行估算字数\n\n【输出格式要求】\nMarkdown报告必须包含：\n- 📊 复审结论（维持初审/纠正初审 + 理由）\n- 🔄 纠正的误判（列出初审误判的项目）\n- ➕ 补充的问题（列出初审遗漏的问题）\n- 🗣 方言/风格复核（确认角色对话是否符合设定）', tool: 'reviewer' },
    'final-editor': { agentType: 'final-editor', mode: 'novel', role: 'user', system: '你是专业小说定稿编辑。对通过审核的正文进行最终润色裁定。先输出可读Markdown定稿意见，末尾附JSON数据块。绝不输出小说正文，绝不续写正文。\n\n【定稿判定红线·必须遵守】\n1. 方括号标签格式（如[权限终端]、[道具]、[筹码]等）=绝对红线违规，不得要求作者添加这些格式\n2. 叙事融入式系统交互（感官体验/身体反应/物品变化）=合规，不算UI化\n3. 幽默密度由项目设定定义，禁止以30%或其他固定百分比作为硬性通过标准\n4. 如果正文中缺少进度追踪，应要求作者使用叙事融入式（感官体验/物品变化/身体反应），禁止要求作者添加方括号标签格式', tool: 'reviewer' },
    'material-manager': { agentType: 'material-manager', mode: 'novel', role: 'user', system: '你是素材管理AI。从章节正文中提取角色、世界观、伏笔等素材，输出JSON格式。\n\n【层级归属铁律 - 违反即拦截】\n所有新素材必须填写归属字段，否则系统拒绝创建：\n- faction(势力): 必须有parentPlane字段（主世界势力parentPlane=null，次位面势力parentPlane=次位面素材ID）\n- character(人物): 必须有parentFaction字段（所属势力素材ID）；若势力属于次位面，还必须有parentPlane\n- institution(机构): 必须有parentPlane字段\n- equipment(道具): 若属于次位面，需有parentPlane\n- sub-plane(次位面): 无需parentPlane\n\n层级结构：主世界→势力→人物 / 次位面→势力→人物\n禁止创建无归属的势力或人物。', tool: 'material-manager' },
    'fast-review': { agentType: 'fast-review', mode: 'novel', role: 'user', system: '你是快速审核编辑。快速审核章节爽点密度和节奏，先输出可读Markdown报告，末尾附JSON数据块。绝不输出小说正文。', tool: 'reviewer' },
    'intent-planner': { agentType: 'intent-planner', mode: 'novel', role: 'user', system: '你是章节意图规划AI。根据大纲、素材库和前文记忆，为即将创作的章节规划写作意图(goal/mustKeep/mustAvoid)。输出结构化JSON格式，包含goal(本章核心目标)、mustKeep(必须保留的要素)、mustAvoid(必须避免的要素)、toneHint(基调提示)、keyEvents(关键事件列表)。', tool: 'intent-planner' },
    'polisher': { agentType: 'polisher', mode: 'novel', role: 'user', system: '你是专业小说润色编辑。对已通过审核的正文进行语言润色，提升文笔质感。规则：1.只润色语言表达，不改变任何情节/设定/人物行为 2.消除AI腔调（仿佛/不禁/似乎/缓缓/微微等高频词替换为更精准的表达） 3.强化白描质感，减少华丽辞藻 4.保持原文叙事风格和节奏 5.禁止添加方括号标签格式（如[筹码][道具]等） 6.输出润色后的完整正文，不要输出审核意见', tool: 'writer' }
};

function getAgentTemplate(agentType, mode) {
    try {
        const templates = store.listItems('agent-templates');
        const modeSpecific = templates.find(t => t.agentType === agentType && t.mode === mode);
        if (modeSpecific) return modeSpecific;

        const generic = templates.find(t => t.agentType === agentType && t.mode === 'novel');
        if (generic) return generic;

        const anyMatch = templates.find(t => t.agentType === agentType);
        if (anyMatch) return anyMatch;
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

    const fallback = FALLBACK_AGENT_TEMPLATES[agentType];
    if (fallback) return fallback;

    return null;
}

function getFoundationPrompt() {
    try {
        const rulesLoader = require('./rulesLoader');
        const content = rulesLoader.getFoundationContent();
        if (content) return content;
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    try {
        const foundations = store.listItems('foundation-prompts');
        if (foundations && foundations.length > 0) {
            foundations.sort((a, b) => (b.version || '').localeCompare(a.version || ''));
            return foundations[0].content;
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return FALLBACK_FOUNDATION;
}

function buildFoundationPrompt(agentType, mode = 'novel', projectId = null) {
    const roleMap = {
        writer: '执笔人', 'first-review': '初审', 'second-review': '复审',
        'final-editor': '定稿人', 'material-manager': '素材管理员',
        reviser: '返修员', polisher: '润色师', 'intent-planner': '意图规划',
        'fast-review': '快审', reader: '阅读者', adjuster: '调整员'
    };
    const taskMap = {
        writer: '根据大纲和素材撰写章节正文',
        'first-review': '对章节初稿进行质量审核',
        'second-review': '对初审通过的稿件进行复审',
        'final-editor': '对稿件进行最终定稿编辑',
        'material-manager': '管理素材库的增删改查',
        reviser: '根据审核反馈修改章节内容',
        polisher: '对章节进行润色优化',
        'intent-planner': '规划章节写作意图和大纲',
        'fast-review': '快速审核章节爽点密度和节奏',
        reader: '以读者视角评价章节阅读体验',
        adjuster: '根据评审意见调整写作规则'
    };

    let prompt = getFoundationPrompt()
        .replace('[Agent类型]', roleMap[agentType] || agentType)
        .replace('[任务描述]', taskMap[agentType] || '完成指定任务');

    const { getModeConfig } = require('./contentUtils');
    const modeConfig = getModeConfig(mode);
    let rejectMin = modeConfig.REJECT_MIN_WORDS || 1800;
    let maxWords = modeConfig.MAX_CHAPTER_WORDS || 3500;
    let targetMin = modeConfig.TARGET_MIN_WORDS || 2200;
    let targetMax = modeConfig.TARGET_MAX_WORDS || 2800;

    if (projectId) {
        const store = require('../store');
        const project = store.getItem('projects', projectId);
        const wc = project?.wordConfig || {};
        if (wc.rejectMin) rejectMin = wc.rejectMin;
        if (wc.maxWords) maxWords = wc.maxWords;
        if (wc.targetMin) targetMin = wc.targetMin;
        if (wc.targetMax) targetMax = wc.targetMax;
    }

    prompt = prompt.replace('[WORD_LIMITS]',
        `【字数要求】目标${targetMin}-${targetMax}字，硬性最低${rejectMin}字、上限${maxWords}字。低于${rejectMin}字退回重写，超过${maxWords}字退回精简。宁可多写不可少写，但不要超过${maxWords}字。`);

    return prompt;
}

function buildConstraintInjection(projectId) {
    const project = store.getItem('projects', projectId);
    if (!project) return '';

    const profile = getStyleProfileForProject(projectId);
    const genre = detectGenre(profile);
    const CONSTRAINT_PRESETS = getConstraintPresets(genre);
    const profileOverrides = (profile && profile.constraintOverrides) ? profile.constraintOverrides : [];
    const projectConstraints = project.constraints || [];
    const effectiveConstraints = [...new Set([...projectConstraints, ...profileOverrides])];
    if (!effectiveConstraints.length) return '';

    const BASE_STYLE_COVERED_CONSTRAINTS = {
        'hook-every-chapter': {
            profileFields: ['toneRule', 'behaviorRule'],
            keywords: ['章末钩子', '未闭合张力点', '悬念', '钩子']
        },
        'simple-readable-style': {
            profileFields: ['toneRule'],
            keywords: ['句子短', '段落短', '节奏流畅', '禁用成语', '长难句']
        },
        'worldview-consistency': {
            profileFields: ['behaviorRule'],
            keywords: ['世界观', '设定自洽']
        },
        'character-consistency': {
            profileFields: ['povRule', 'dialogueRule'],
            keywords: ['称呼', '角色', '内心独白']
        }
    };

    const genreConstraintPresets = genre ? getGenreConstraintPresets(genre) : {};
    const GENRE_STYLE_COVERED = {};
    for (const [id, preset] of Object.entries(genreConstraintPresets)) {
        const desc = preset.desc || '';
        const keywords = [];
        if (desc.includes('视角')) keywords.push('视角', '第一视角', '限知视角');
        if (desc.includes('内心')) keywords.push('内心独白', '内心戏');
        if (desc.includes('萌感')) keywords.push('萌感', '天真行为');
        if (desc.includes('对话')) keywords.push('对话', '儿童化', '叠词');
        if (desc.includes('铺垫')) keywords.push('铺垫', '新角色');
        if (keywords.length > 0) {
            GENRE_STYLE_COVERED[id] = {
                profileFields: ['povRule', 'behaviorRule', 'dialogueRule', 'toneRule'],
                keywords
            };
        }
    }

    const STYLE_COVERED_CONSTRAINTS = { ...BASE_STYLE_COVERED_CONSTRAINTS, ...GENRE_STYLE_COVERED };

    const isStyleProfileLoaded = profile && (
        profile.povRule || profile.dialogueRule || profile.behaviorRule || profile.toneRule
    );

    const dedupedConstraints = [];
    const dedupedReasons = [];

    for (const id of effectiveConstraints) {
        const mapping = STYLE_COVERED_CONSTRAINTS[id];
        if (mapping && isStyleProfileLoaded) {
            let covered = false;
            for (const field of mapping.profileFields) {
                const fieldValue = profile[field] || '';
                if (mapping.keywords.some(kw => fieldValue.includes(kw))) {
                    covered = true;
                    break;
                }
            }
            if (covered) {
                dedupedReasons.push(`${id}(已由${mapping.profileFields.join('/')}覆盖)`);
                continue;
            }
        }
        dedupedConstraints.push(id);
    }

    if (dedupedReasons.length > 0) {
        console.log(`[AGENT-PROMPTS] Constraint dedup for project ${projectId}: skipped ${dedupedReasons.join(', ')}`);
    }

    const TIER1 = ['character-depth', 'anti-tool-character', 'anti-ai-trace', 'anti-formulaic-dungeon', 'ip-defense-dungeon', 'cross-dungeon-isolation', 'power-ceiling-dungeon', 'protagonist-proactive', 'anchor-mechanism', 'stance-conflict', 'madness-has-cost', 'vivid-combat', 'conflict-first', 'hook-every-chapter', 'dialogue-authentic', 'plot-originality', 'foreshadow-manage', 'spider-web-foreshadow', 'slow-burn-romance', 'concrete-villain', 'misunderstood-savior', 'interest-exchange-transform', 'emotional-closure-foreshadow', 'bitter-camaraderie', 'small-detail-worldview', 'montage-narrative', 'baby-perspective-only', 'no-adult-inner-voice', 'cute-first-always', 'simple-readable-style'];
    const TIER2 = ['worldview-consistency', 'character-consistency', 'power-consistency', 'no-derailment', 'no-random-plot', 'no-deus-ex', 'bitter-humor', 'fast-escalation', 'reader-satisfaction', 'character-intro-whitelist', 'naming-elegance', 'naming-convention-dungeon', 'meme-quality-control', 'main-plane-depth', 'supporting-cast', 'anti-tool-character-horror', 'anti-tool-character-baby', 'anti-tool-character-urban', 'no-ai-flavor', 'system-anti-cliché', 'power-stacking-limit', 'pacing-micro-loop', 'rule-pace', 'rule-concreteness'];
    const TIER3 = ['proper-introduction', 'face-slapping', 'power-fantasy'];

    const tier1Items = [];
    const tier2Labels = [];
    const tier3Labels = [];

    for (const id of dedupedConstraints) {
        const preset = CONSTRAINT_PRESETS[id];
        if (!preset) continue;
        if (TIER1.includes(id)) {
            tier1Items.push(`● ${preset.label}：${preset.desc}`);
        } else if (TIER2.includes(id)) {
            tier2Labels.push(preset.label);
        } else if (TIER3.includes(id)) {
            tier3Labels.push(preset.label);
        } else {
            tier2Labels.push(preset.label);
        }
    }

    let result = '\n【写作约束（必须遵守）】';
    if (tier1Items.length > 0) {
        result += '\n' + tier1Items.join('\n');
    }
    if (tier2Labels.length > 0) {
        result += `\n遵守：${tier2Labels.join('、')}`;
    }
    if (tier3Labels.length > 0) {
        result += `\n注意：${tier3Labels.join('、')}`;
    }
    return result;
}

function buildStyleInjection(projectId) {
    const profile = getStyleProfileForProject(projectId);
    if (!profile) return '';

    let result = '\n【本作风格配置（最高优先级，覆盖默认规则）】';
    if (profile.povRule) result += '\n' + profile.povRule;
    if (profile.dialogueRule) result += '\n' + profile.dialogueRule;
    if (profile.behaviorRule) result += '\n' + profile.behaviorRule;
    if (profile.toneRule) result += '\n' + profile.toneRule;
    if (profile.titleRule) result += '\n' + profile.titleRule;
    return result;
}

function deduplicateSystemPrompt(fullSystem, agentType, styleProfile) {
    const BASE_DEDUP_RULES = [
        { id: 'hook-chapter', pattern: /每章结尾必须设置悬念或钩子/g, keep: 'first' },
        { id: 'hook-chapter2', pattern: /章末钩子用[^。\n]*[。\n]/g, keep: 'first' },
        { id: 'show-not-tell', pattern: /展示代替告知[：:][^\n]*/g, keep: 'first' },
        { id: 'word-count', pattern: /【字数要求[^】]*】[^\n]*/g, keep: 'first' },
        { id: 'word-count2', pattern: /宁可多写不可少写[^。\n]*[。\n]/g, keep: 'first' },
        { id: 'word-count3', pattern: /字数纪律[：:][^\n]*/g, keep: 'first' },
        { id: 'golden-finger', pattern: /金手指[^。]*触发[^\n]*/g, keep: 'first' },
        { id: 'sensory-anchor', pattern: /场景感官锚定[：:][^\n]*/g, keep: 'first' },
        { id: 'sensory-detail', pattern: /感官细节[^，。\n]*[，。\n]/g, keep: 'first' },
        { id: 'style-header', pattern: /【⚠️ 本作风格配置（最高优先级[^】]*）】/g, keep: 'first' },
        { id: 'style-header2', pattern: /【⚠️ 本作风格配置（审核依据）】/g, keep: 'first' },
    ];

    const genre = detectGenre(styleProfile);
    const genreDedupRules = genre ? getGenreDedupRules(genre) : [];
    const DEDUP_RULES = [...BASE_DEDUP_RULES, ...genreDedupRules];

    let result = fullSystem;
    let totalSaved = 0;

    for (const rule of DEDUP_RULES) {
        const matches = [];
        let m;
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        while ((m = regex.exec(result)) !== null) {
            matches.push({ match: m[0], index: m.index });
        }
        if (matches.length > 1) {
            for (let i = matches.length - 1; i >= 1; i--) {
                const toRemove = matches[i].match;
                result = result.substring(0, matches[i].index) + result.substring(matches[i].index + toRemove.length);
                totalSaved += toRemove.length;
            }
            console.log(`[DEDUP] ${rule.id}: removed ${matches.length - 1} duplicate(s)`);
        }
    }

    result = result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();

    if (totalSaved > 0) {
        console.log(`[DEDUP] Total saved: ${totalSaved} chars (${((totalSaved / fullSystem.length) * 100).toFixed(1)}%)`);
    }

    return result;
}

function getAgentPrompt(agentType, mode = 'novel', projectId = null) {
    const buildLog = [];
    const profile = projectId ? getStyleProfileForProject(projectId) : null;

    const template = getAgentTemplate(agentType, mode);
    if (!template) return null;

    let agent = {
        role: template.role,
        system: template.system,
        tool: template.tool
    };
    buildLog.push({ step: 'template', chars: template.system.length });

    if (!projectId) { agent._buildLog = buildLog; return agent; }

    const project = store.getItem('projects', projectId);
    if (!project) { agent._buildLog = buildLog; return agent; }

    if (project.agentOverrides?.[agentType]) {
        const before = agent.system.length;
        agent = { ...agent, system: project.agentOverrides[agentType] };
        buildLog.push({ step: 'agentOverride', chars: agent.system.length - before });
    }

    if (profile) {
        let systemOverride = agent.system;

        const genre = detectGenre(profile);

        const localProfile = {
            ...profile,
            constraintOverrides: profile.constraintOverrides ? [...profile.constraintOverrides] : undefined
        };

        if (genre?.genreBase) {
            if (localProfile.behaviorRule && genre.genreBase.BEHAVIOR_APPEND && !localProfile.behaviorRule.includes(genre.genreBase.BEHAVIOR_APPEND)) {
                localProfile.behaviorRule += '\n' + genre.genreBase.BEHAVIOR_APPEND;
            }
            if (localProfile.toneRule && genre.genreBase.TONE_APPEND && !localProfile.toneRule.includes(genre.genreBase.TONE_APPEND)) {
                localProfile.toneRule += '\n' + genre.genreBase.TONE_APPEND;
            }
            if (localProfile.reviewFocus && genre.genreBase.REVIEW_APPEND && !localProfile.reviewFocus.includes(genre.genreBase.REVIEW_APPEND)) {
                localProfile.reviewFocus += genre.genreBase.REVIEW_APPEND;
            }
            if (localProfile.constraintOverrides && genre.genreBase.REQUIRED_CONSTRAINT_OVERRIDES) {
                for (const rc of genre.genreBase.REQUIRED_CONSTRAINT_OVERRIDES) {
                    if (!localProfile.constraintOverrides.includes(rc)) {
                        localProfile.constraintOverrides.push(rc);
                    }
                }
            }
        }

        if (genre?.foundation?.additionalFoundationRules?.length) {
            const genreRules = genre.foundation.additionalFoundationRules.join('\n');
            systemOverride = systemOverride.replace('[GENRE_RULES]', genreRules);
            buildLog.push({ step: 'genreRules', chars: genreRules.length });
        } else {
            systemOverride = systemOverride.replace('- 【题材视角铁律】由题材配置动态注入，见[GENRE_RULES]', '');
        }

        const isWritingAgent = ['writer', 'reviser', 'polisher', 'intent-planner'].includes(agentType);
        const isReviewAgent = ['first-review', 'second-review', 'fast-review', 'final-editor'].includes(agentType);
        const isReviser = agentType === 'reviser';

        if (isWritingAgent) {
            const styleHeader = `【⚠️ 本作风格配置（最高优先级）】\n本作为${localProfile.label}，与模板规则冲突时以此为准：\n`;
            let styleBody = '';
            if (localProfile.povRule) styleBody += '\n' + localProfile.povRule + '\n';
            if (localProfile.behaviorRule) styleBody += '\n' + localProfile.behaviorRule + '\n';
            if (localProfile.dialogueRule) styleBody += '\n' + localProfile.dialogueRule + '\n';
            if (localProfile.characterRefRules) styleBody += '\n' + localProfile.characterRefRules + '\n';
            if (localProfile.mechanicFormat) {
                styleBody += '\n【⚠️ 本项目机制格式（叙事融入式，禁止标签模板）】\n';
                styleBody += `进度追踪：${localProfile.mechanicFormat.progressTracking}\n`;
                styleBody += `叙事融入示例：${localProfile.mechanicFormat.progressExample}\n`;
                styleBody += `道具呈现：${localProfile.mechanicFormat.propFormat}\n`;
                styleBody += `合作呈现：${localProfile.mechanicFormat.cooperationFormat}\n`;
                styleBody += `断章呈现：${localProfile.mechanicFormat.hookFormat}\n`;
                if (localProfile.mechanicFormat.forbiddenFormats?.length) {
                    styleBody += `🚫 绝对禁止的格式（出现即红线违规）：${localProfile.mechanicFormat.forbiddenFormats.join('、')}\n`;
                    styleBody += `⚠️ 正文中不得出现上述禁止格式。如果正文中缺少进度追踪，应要求作者使用叙事融入式（感官体验/物品变化/身体反应），而非方括号标签格式。\n`;
                }
                if (localProfile.mechanicFormat.humorType) {
                    styleBody += `幽默类型：${localProfile.mechanicFormat.humorType}\n`;
                }
                if (localProfile.mechanicFormat.settingEra) {
                    styleBody += `时代背景：${localProfile.mechanicFormat.settingEra}\n`;
                }
                styleBody += '\n';
            }
            if (styleBody.trim()) {
                systemOverride = styleHeader + styleBody + '\n\n' + systemOverride;
                buildLog.push({ step: 'styleProfile-writing', chars: (styleHeader + styleBody).length });
            }
        } else if (isReviewAgent) {
            const _reviewRules = getGenreReviewRules(genre);
            const _stepKey = agentType === 'fast-review' ? 'firstReview' : (agentType === 'final-editor' ? 'finalEditor' : agentType);
            const _stepRules = _reviewRules?.[_stepKey] || {};

            const styleHeader = `【⚠️ 本作风格配置（审核依据）】\n本作为${localProfile.label}，以下为本作核心规范，审核时以此为准：\n`;
            let styleBody = '';
            if (localProfile.povRule) styleBody += '\n' + localProfile.povRule + '\n';
            if (localProfile.dialogueRule) styleBody += '\n' + localProfile.dialogueRule + '\n';
            if (localProfile.behaviorRule) styleBody += '\n' + localProfile.behaviorRule + '\n';
            if (localProfile.toneRule) styleBody += '\n' + localProfile.toneRule + '\n';
            if (localProfile.characterRefRules) styleBody += '\n' + localProfile.characterRefRules + '\n';

            if (localProfile.mechanicFormat) {
                styleBody += '\n【⚠️ 本项目机制格式（审核判定依据·叙事融入式）】\n';
                styleBody += `进度追踪：${localProfile.mechanicFormat.progressTracking}\n`;
                styleBody += `叙事融入示例：${localProfile.mechanicFormat.progressExample}\n`;
                styleBody += `道具呈现：${localProfile.mechanicFormat.propFormat}\n`;
                styleBody += `合作呈现：${localProfile.mechanicFormat.cooperationFormat}\n`;
                styleBody += `断章呈现：${localProfile.mechanicFormat.hookFormat}\n`;
                if (localProfile.mechanicFormat.forbiddenFormats?.length) {
                    styleBody += `🚫 绝对禁止的格式（正文中出现即红线违规，审核不得要求作者添加这些格式）：${localProfile.mechanicFormat.forbiddenFormats.join('、')}\n`;
                    styleBody += `⚠️ 如果正文中缺少进度追踪，应要求作者使用叙事融入式（感官体验/物品变化/身体反应），而非方括号标签格式。禁止要求作者添加[筹码][道具][合作约定]等方括号标签。禁止要求作者使用"面临抉择：①②"标准格式模板。\n`;
                }
                if (localProfile.mechanicFormat.humorType) {
                    styleBody += `幽默类型：${localProfile.mechanicFormat.humorType}\n`;
                    styleBody += `⚠️ 绝对禁止以30%喜剧密度作为审核标准。30%是其他题材的要求，本项目不适用。本项目的幽默要求以mechanicFormat.humorType为准。\n`;
                }
                if (localProfile.mechanicFormat.settingEra) {
                    styleBody += `时代背景：${localProfile.mechanicFormat.settingEra}\n`;
                }
                styleBody += '\n';
            }

            if (_stepRules.perspectiveRule) styleBody += '\n' + _stepRules.perspectiveRule + '\n';
            if (_stepRules.terminologyRule) styleBody += '\n' + _stepRules.terminologyRule + '\n';
            if (_stepRules.outputRule) styleBody += '\n' + _stepRules.outputRule + '\n';
            if (_stepRules.correctionRule) styleBody += '\n' + _stepRules.correctionRule + '\n';

            systemOverride = styleHeader + styleBody + '\n\n' + systemOverride;
            buildLog.push({ step: 'styleProfile-review', chars: (styleHeader + styleBody).length });
        } else {
            const styleHeader = `【⚠️ 本作风格配置（最高优先级，覆盖所有默认规则）】\n本作为${localProfile.label}，以下规则为本作核心写作规范，与任何默认规则冲突时一律以此为准：\n`;
            let styleBody = '';
            if (localProfile.povRule) styleBody += '\n' + localProfile.povRule + '\n';
            if (localProfile.dialogueRule) styleBody += '\n' + localProfile.dialogueRule + '\n';
            if (localProfile.behaviorRule) styleBody += '\n' + localProfile.behaviorRule + '\n';
            if (localProfile.toneRule) styleBody += '\n' + localProfile.toneRule + '\n';
            systemOverride = styleHeader + styleBody + '\n\n' + systemOverride;
            buildLog.push({ step: 'styleProfile-other', chars: (styleHeader + styleBody).length });
        }

        if (isReviser) {
            const _reviewRules = getGenreReviewRules(genre);
            const _reviserRules = _reviewRules?.reviser || {};
            let reviserInjection = '\n\n【返修审核标准 - 必须按此标准修复】\n';
            if (_reviserRules.repairRules) reviserInjection += _reviserRules.repairRules + '\n';
            if (_reviserRules.perspectiveRule) reviserInjection += _reviserRules.perspectiveRule + '\n';
            if (_reviserRules.terminologyDimmingRule) reviserInjection += _reviserRules.terminologyDimmingRule + '\n';
            if (localProfile.reviewFocus) reviserInjection += '审核焦点：' + localProfile.reviewFocus + '\n';
            systemOverride += reviserInjection;
        }

        if (agentType === 'fast-review') {
            if (localProfile.reviewFocus) {
                let reviewFocus = localProfile.reviewFocus;
                const PROGRAM_COVERED_REVIEWS = [
                    { pattern: /段落级防重复检查/, reason: '已由detectCrossChapterRepetition HARD BLOCK覆盖' },
                    { pattern: /字数达标/, reason: '已由wordCount HARD BLOCK覆盖' }
                ];
                for (const pc of PROGRAM_COVERED_REVIEWS) {
                    if (pc.pattern.test(reviewFocus)) {
                        reviewFocus = reviewFocus.replace(new RegExp('\\|?' + pc.pattern.source, 'g'), '');
                    }
                }
                if (reviewFocus.trim()) {
                    systemOverride += '\n\n【快审专属审核焦点 - 仅关注节奏/爽点/题材偏离】\n' + reviewFocus;
                }
            }
        } else if (agentType === 'first-review' || agentType === 'second-review') {
            if (localProfile.reviewFocus) {
                let reviewFocus = localProfile.reviewFocus;
                const PROGRAM_COVERED_REVIEWS = [
                    { pattern: /段落级防重复检查/, reason: '已由detectCrossChapterRepetition HARD BLOCK覆盖' },
                    { pattern: /字数达标/, reason: '已由wordCount HARD BLOCK覆盖' }
                ];
                for (const pc of PROGRAM_COVERED_REVIEWS) {
                    if (pc.pattern.test(reviewFocus)) {
                        reviewFocus = reviewFocus.replace(new RegExp('\\|?' + pc.pattern.source, 'g'), '');
                    }
                }
                if (reviewFocus.trim()) {
                    const stepLabel = agentType === 'first-review' ? '初审' : '复审';
                    systemOverride += '\n\n【' + stepLabel + '审核焦点】\n' + reviewFocus;
                }
            }
        }

        if (agentType === 'material-manager' && localProfile.materialFocus) {
            const mf = localProfile.materialFocus;
            let materialFocusInjection = '\n\n【题材素材焦点 - 最高优先级，覆盖默认素材类型优先级】\n';
            if (typeof mf === 'string') {
                materialFocusInjection += mf;
            } else {
                materialFocusInjection += `本作为${localProfile.label}，素材管理必须遵循以下题材焦点：\n`;
                if (mf.primary) materialFocusInjection += `核心素材类型（优先创建/维护）：${Array.isArray(mf.primary) ? mf.primary.join('、') : mf.primary}\n`;
                if (mf.secondary) materialFocusInjection += `辅助素材类型（按需创建）：${Array.isArray(mf.secondary) ? mf.secondary.join('、') : mf.secondary}\n`;
                if (mf.skip && (Array.isArray(mf.skip) ? mf.skip.length > 0 : mf.skip)) {
                    materialFocusInjection += `跳过素材类型（禁止创建，除非剧情绝对必要）：${Array.isArray(mf.skip) ? mf.skip.join('、') : mf.skip}\n`;
                }
                if (mf.characterDetailPriority) materialFocusInjection += `人物细节优先级：${mf.characterDetailPriority}\n`;
                if (mf.characterDetailRules) materialFocusInjection += `人物细节规则：${mf.characterDetailRules}\n`;
                if (mf.worldBuildingRule) materialFocusInjection += `世界观规则：${mf.worldBuildingRule}\n`;
            }
            systemOverride += materialFocusInjection;
        }

        if (agentType === 'material-manager') {
            let hierarchyInjection = '\n\n【层级归属规范 - 系统强制校验，缺失即拒绝创建】\n';
            hierarchyInjection += '素材层级结构：\n';
            hierarchyInjection += '  主世界 → 势力(faction, parentPlane=null) → 人物(character, parentFaction=势力ID)\n';
            hierarchyInjection += '  次位面(sub-plane) → 势力(faction, parentPlane=次位面ID) → 人物(character, parentFaction=势力ID, parentPlane=次位面ID)\n\n';
            hierarchyInjection += '创建新素材时必须包含归属字段：\n';
            hierarchyInjection += '  - faction: 必须有parentPlane（主世界=null，次位面=次位面素材ID）\n';
            hierarchyInjection += '  - character: 必须有parentFaction（所属势力素材ID）；若势力属次位面还需parentPlane\n';
            hierarchyInjection += '  - institution: 必须有parentPlane\n';
            hierarchyInjection += '  - equipment: 若属次位面需有parentPlane\n';
            hierarchyInjection += '  - sub-plane: 无需parentPlane\n\n';
            hierarchyInjection += '输出JSON中每个create条目必须包含parentPlane和/或parentFaction字段。缺失归属字段的素材将被系统拒绝创建。';

            try {
                const allMats = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
                const planes = allMats.filter(m => m.type === 'sub-plane');
                const factions = allMats.filter(m => m.type === 'faction');
                if (planes.length > 0 || factions.length > 0) {
                    hierarchyInjection += '\n\n【当前项目位面与势力索引（用于填写归属字段）】\n';
                    hierarchyInjection += '主世界:\n';
                    const mwFactions = factions.filter(f => !f.parentPlane);
                    for (const f of mwFactions) {
                        hierarchyInjection += `  势力ID=${f.id} 名称=${f.name}\n`;
                    }
                    for (const p of planes) {
                        const status = p.isLocked ? '[未解锁]' : '[已解锁]';
                        hierarchyInjection += `次位面 ID=${p.id} 名称=${p.name} ${status}:\n`;
                        const pFactions = factions.filter(f => f.parentPlane === p.id);
                        for (const f of pFactions) {
                            hierarchyInjection += `  势力ID=${f.id} 名称=${f.name}\n`;
                        }
                    }
                }
            } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

            systemOverride += hierarchyInjection;
        }

        if (localProfile.characterRefRules && !isWritingAgent && (agentType === 'first-review' || agentType === 'second-review' || agentType === 'fast-review')) {
            systemOverride += '\n\n' + localProfile.characterRefRules;
        }

        try {
            const speechStyleRegistry = require('./speechStyleRegistry');
            const allMats = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
            const flavorChars = allMats.filter(m => m.type === 'character' && (m.dialectRegion || m.speechStyle));

            if (flavorChars.length > 0) {
                if (isWritingAgent) {
                    const combinedBlock = speechStyleRegistry.buildCombinedPromptBlock(flavorChars);
                    if (combinedBlock) { systemOverride += '\n\n' + combinedBlock; buildLog.push({ step: 'flavor-writing', chars: combinedBlock.length }); }
                    if (genre?.dialectConfig?.rules?.length) {
                        const dr = '【题材方言交互规则】\n' + genre.dialectConfig.rules.join('\n');
                        systemOverride += '\n\n' + dr;
                        buildLog.push({ step: 'dialectConfig', chars: dr.length });
                    }
                } else if (isReviewAgent) {
                    const reviewBlock = speechStyleRegistry.buildCombinedReviewBlock(flavorChars);
                    if (reviewBlock) { systemOverride += '\n\n' + reviewBlock; buildLog.push({ step: 'flavor-review', chars: reviewBlock.length }); }
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        let _genreProfile = null;
        try {
            const genreProfileRegistry = require('./genreProfileRegistry');
            const genreProfileId = project.styleProfile?.genreProfile || '';
            _genreProfile = genreProfileId ? genreProfileRegistry.get(genreProfileId) : genreProfileRegistry.resolve(project.genre || '');
            if (_genreProfile) {
                const genreBlock = genreProfileRegistry.buildWriterPromptBlock(_genreProfile.id);
                if (genreBlock && isWritingAgent) { systemOverride += '\n\n' + genreBlock; buildLog.push({ step: 'genreProfile', chars: genreBlock.length }); }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const namingStyleRegistry = require('./namingStyleRegistry');
            if (isWritingAgent) {
                const namingBlock = namingStyleRegistry.buildCombinedPromptBlock(projectId);
                if (namingBlock) { systemOverride += '\n\n' + namingBlock; buildLog.push({ step: 'namingStyle', chars: namingBlock.length }); }
            } else if (isReviewAgent) {
                const namingReviewBlock = namingStyleRegistry.buildCombinedReviewBlock(projectId);
                if (namingReviewBlock) { systemOverride += '\n\n' + namingReviewBlock; buildLog.push({ step: 'namingStyle-review', chars: namingReviewBlock.length }); }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const memeLexicon = require('./memeLexicon');
            if (isWritingAgent) {
                const memeBlock = memeLexicon.buildWriterPrompt(projectId);
                if (memeBlock) { systemOverride += '\n\n' + memeBlock; buildLog.push({ step: 'memeLexicon', chars: memeBlock.length }); }
            } else if (isReviewAgent) {
                const memeReviewBlock = memeLexicon.buildReviewerPrompt(projectId);
                if (memeReviewBlock) { systemOverride += '\n\n' + memeReviewBlock; buildLog.push({ step: 'memeLexicon-review', chars: memeReviewBlock.length }); }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const worldviewTemplateRegistry = require('./worldviewTemplateRegistry');
            const wvTemplateId = project.styleProfile?.worldviewTemplate || (_genreProfile?.worldviewTemplate || '');
            const inferred = wvTemplateId ? worldviewTemplateRegistry.get(wvTemplateId) : worldviewTemplateRegistry.inferFromGenre(project.genre || '');
            if (inferred) {
                const chapterNumber = context?.chapterNumber || 1;
                const totalChapters = project.targetChapters || 100;
                if (isWritingAgent) {
                    const wvBlock = worldviewTemplateRegistry.buildWriterPrompt(inferred.id, chapterNumber, totalChapters);
                    if (wvBlock) { systemOverride += '\n\n' + wvBlock; buildLog.push({ step: 'worldviewTemplate', chars: wvBlock.length }); }
                } else if (isReviewAgent) {
                    const wvReviewBlock = worldviewTemplateRegistry.buildReviewerPrompt(inferred.id, chapterNumber, totalChapters);
                    if (wvReviewBlock) { systemOverride += '\n\n' + wvReviewBlock; buildLog.push({ step: 'worldviewTemplate-review', chars: wvReviewBlock.length }); }
                }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const characterArchetypeRegistry = require('./characterArchetypeRegistry');
            if (isWritingAgent) {
                const archBlock = characterArchetypeRegistry.buildCombinedWriterPrompt(project.id);
                if (archBlock) { systemOverride += '\n\n' + archBlock; buildLog.push({ step: 'characterArchetype', chars: archBlock.length }); }
            } else if (isReviewAgent) {
                const archReviewBlock = characterArchetypeRegistry.buildCombinedReviewerPrompt(project.id);
                if (archReviewBlock) { systemOverride += '\n\n' + archReviewBlock; buildLog.push({ step: 'characterArchetype-review', chars: archReviewBlock.length }); }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        try {
            const systemPersonaRegistry = require('./systemPersonaRegistry');
            if (isWritingAgent) {
                const spBlock = systemPersonaRegistry.buildCombinedWriterPrompt(project.id);
                if (spBlock) { systemOverride += '\n\n' + spBlock; buildLog.push({ step: 'systemPersona', chars: spBlock.length }); }
            } else if (isReviewAgent) {
                const spReviewBlock = systemPersonaRegistry.buildCombinedReviewerPrompt(project.id);
                if (spReviewBlock) { systemOverride += '\n\n' + spReviewBlock; buildLog.push({ step: 'systemPersona-review', chars: spReviewBlock.length }); }
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

        agent = { ...agent, system: systemOverride };
    }

    buildLog.push({ step: 'final', chars: agent.system.length });
    agent._buildLog = buildLog;
    return agent;
}

const AGENT_PROMPTS = {};
const SHUANGWEN_AGENT_PROMPTS = {};
const TOMATO_SHORT_AGENT_PROMPTS = {};
const CONSTRAINT_PRESETS = BASE_CONSTRAINT_PRESETS;
const STYLE_PROFILES = getAllStyleProfiles() || {};
const FOUNDATION_PROMPT = getFoundationPrompt();

module.exports = {
    AGENT_PROMPTS,
    SHUANGWEN_AGENT_PROMPTS,
    TOMATO_SHORT_AGENT_PROMPTS,
    CONSTRAINT_PRESETS,
    SHUANGWEN_DEFAULT_CONSTRAINTS: ['no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'fast-escalation', 'reader-satisfaction'],
    NOVEL_DEFAULT_CONSTRAINTS: ['no-derailment', 'proper-introduction', 'character-consistency', 'worldview-consistency', 'no-random-plot'],
    STYLE_PROFILES,
    buildConstraintInjection,
    buildFoundationPrompt,
    buildStyleInjection,
    getStyleProfileForProject,
    FOUNDATION_PROMPT,
    getAgentPrompt,
    getConstraintPresets,
    getAllStyleProfiles,
    getAgentTemplate,
    getFoundationPrompt: getFoundationPrompt,
    deduplicateSystemPrompt
};
