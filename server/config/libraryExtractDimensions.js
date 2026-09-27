/**
 * libraryExtractDimensions — 藏经阁「一键提取」的通用技法维度定义（SSOT）
 *
 * 设计目标：提取出来的必须是**跨作品可复用的通用技法**，而不是某一本书的专有设定。
 *   因此维度按"写作能力"划分（节奏/宏大/压力/危机/人物/弧光/对白/世界观/情感/语言），
 *   每本小说都必然在这些维度上有可提取的手法。
 *
 * 每条维度声明：
 *   id/label   维度标识与显示名（落到藏经阁的 subcategory 上）
 *   departments 允许归属的部门（必须是 techIndex 现有7部门之一，否则无法被调度）
 *   injection   推荐注入点（intent-planner / writer / polisher / material-manager）
 *   hint        给LLM的提取指引（描述"要提取什么"，不是"怎么抄"）
 *   slot/depth  上下文槽与世界观深度（决定调度优先级）
 *
 * 文件位置：server/config/libraryExtractDimensions.js
 */

const INJECTION_DEFAULTS = {
    'intent-planner': { slot: 'L0', priority: 100 },
    'writer': { slot: 'L2', priority: 80 },
    'polisher': { slot: 'L3', priority: 70 },
    'material-manager': { slot: 'L4', priority: 20 },
};

const CRAFT_DIMENSIONS = [
    {
        id: 'rhythm', label: '叙事节奏', departments: ['02_情节引擎部', '01_顶层设计部', '05_文笔滤镜部'],
        injection: 'writer', depth: 'meso',
        hint: '张弛交替、信息释放速度、场景切换频率、章节内部的推进-停顿-爆发顺序、章末钩子的落点',
    },
    {
        id: 'grandeur', label: '宏大感与群像璀璨', departments: ['06_世界构建部', '03_人物熔炉部', '00_叙事之魂部'],
        injection: 'writer', depth: 'macro',
        hint: '尺度阶梯（由近及远的放大）、数量与沉默的堆叠、多线并进的群戏调度、史诗时刻的铺垫与兑现、让配角各自发光的分配方式',
    },
    {
        id: 'pressure', label: '压力表达', departments: ['02_情节引擎部', '01_顶层设计部'],
        injection: 'writer', depth: 'meso',
        hint: '压力来源（时间/资源/规则/他人/自身）、压力的可见化（计数、刻度、伤口）、压力叠加与转移、旁观者反应放大',
    },
    {
        id: 'crisis', label: '危机关头', departments: ['02_情节引擎部', '05_文笔滤镜部'],
        injection: 'writer', depth: 'meso',
        hint: '骤变如何发生、绝境如何封闭退路、临场决策的取舍、感官窄化与时间变慢、破局手段的来源限制（必须来自前文已给信息）',
    },
    {
        id: 'character', label: '人物刻画', departments: ['03_人物熔炉部', '04_对白艺术部'],
        injection: 'writer', depth: 'meso',
        hint: '有血有肉的具体做法：缺陷先行、私心与癖好、语言指纹、行动暴露性格、他人视角侧写、关系张力制造',
    },
    {
        id: 'arc', label: '成长弧光', departments: ['03_人物熔炉部', '00_叙事之魂部'],
        injection: 'intent-planner', depth: 'macro',
        hint: '起点信念、压力测试、关键选择的改变、代价的不可逆、用同一情境复现验证变化、配角弧光与主角弧光的呼应',
    },
    {
        id: 'dialogue', label: '对白张力', departments: ['04_对白艺术部'],
        injection: 'writer', depth: 'meso',
        hint: '潜台词、答非所问、借对白推进信息、博弈式谈判、多人对话的调度与打断、对白与动作的配比',
    },
    {
        id: 'worldview', label: '世界观揭示', departments: ['06_世界构建部'],
        injection: 'intent-planner', depth: 'macro',
        hint: '规则披露的节奏与顺序、用角色试错代替旁白说明、细节暗示与远景留白、设定与情节的咬合方式',
    },
    {
        id: 'emotion', label: '情感共鸣', departments: ['00_叙事之魂部', '03_人物熔炉部', '05_文笔滤镜部'],
        injection: 'writer', depth: 'meso',
        hint: '情绪引爆点的位置、共鸣的锚（具体物件/承诺/回忆）、克制的表达方式、复合情绪的叠加层次',
    },
    {
        id: 'language', label: '语言质感', departments: ['05_文笔滤镜部'],
        injection: 'polisher', depth: 'micro',
        hint: '句式长短与变速、段落切分、比喻喻体的选择、感官调度、叙述腔调的稳定性、标点用法',
    },
];

/** 部门 → 允许的子类（LLM只能落到这些子类，避免生成无法归类的孤儿技法） */
const DEPARTMENT_SUBCATEGORIES = {
    '00_叙事之魂部': ['01_故事母题', '02_高概念内核', '03_叙事模型', '04_读者心理操控', '05_情感巅峰设计'],
    '01_顶层设计部': ['01_故事模型', '02_叙事视角', '03_时间线设计', '04_开篇设计', '05_结尾设计', '06_章节结构', '07_情感节奏设计'],
    '02_情节引擎部': ['01_冲突类型', '02_悬念编码', '03_反转设计', '04_伏笔与呼应', '05_高潮设计', '06_节拍与节奏', '07_因果链设计'],
    '03_人物熔炉部': ['01_人物出场塑造', '02_人物标签系统', '03_人物源动力', '04_人物关系网', '05_人物弧光', '06_配角功能化', '07_群像设计'],
    '04_对白艺术部': ['01_对白功能', '02_潜台词设计', '03_角色语言区分', '04_多人对话调度', '05_特殊对话场景', '06_对白与叙述衔接'],
    '05_文笔滤镜部': ['01_句式与节奏', '02_感官调度', '03_修辞系统', '04_描写技法', '05_叙事腔调', '06_文字质感'],
    '06_世界构建部': ['01_世界规则', '02_规则揭示方式', '03_空间构建', '04_历史纵深感', '05_日常生活', '06_权力结构'],
};

const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_SUBCATEGORIES);

function getDimension(id) {
    return CRAFT_DIMENSIONS.find(d => d.id === id) || null;
}

function getInjectionDefaults(injection) {
    return INJECTION_DEFAULTS[injection] || INJECTION_DEFAULTS.writer;
}

module.exports = {
    CRAFT_DIMENSIONS, DEPARTMENT_SUBCATEGORIES, ALL_DEPARTMENTS, INJECTION_DEFAULTS,
    getDimension, getInjectionDefaults,
};
