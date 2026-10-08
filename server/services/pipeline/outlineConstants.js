/**
 * 大纲生成器常量定义
 * 素材类型标签、描述、命名规则
 */

const TYPE_LABELS = {
    'worldview': '世界观设定', 'character': '人物卡', 'equipment': '重要物品/工具',
    'relationship': '人物关系', 'power-system': '力量/能力体系', 'catchphrase': '金句/热梗',
    'famous-scene': '名场面', 'growth-history': '成长史', 'foreshadowing': '伏笔设计',
    'faction': '阵营/势力', 'institution': '机构/组织', 'character-combat': '角色战斗设定'
};

const TYPE_DESCS = {
    'worldview': '详细描述世界背景、规则、社区特征，至少300字',
    'character': '按角色等级差异化要求，见下方详细规则',
    'equipment': '每个关键物件单独一个素材！name用物件名，content描述特征+使用场景+情感/职业意义，至少150字/件。可成长/可升级的物件必须加【成长阶段】分节（每阶一行："一阶：攻击+4，微光"；"二阶·凝罡：攻击+12，罡气外放"），并给出【当前阶段】',
    'technique': '每种功法/招式单独一个素材！name用功法名，content描述运功原理+效果+代价，至少150字/种。多层的功法必须加【成长阶段】分节（如"一层：……"至"九层：……"）与【当前阶段】',
    'cultivation-method': '每套修炼法门单独一个素材！content描述境界划分+突破条件+每境特征，至少200字。必须加【成长阶段】分节与【当前阶段】',
    'relationship': '每对关系单独一个素材！name用"角色A与角色B"，content描述互动模式+称呼变化+情感递进节点，至少200字',
    'power-system': '详细描述等级划分、突破条件、能力特征，至少300字',
    'catchphrase': '每条金句单独一个素材！name就是金句原文（逐字，禁过场句如"上车。"），content写【说话人】+【处境】+【为什么记得住（它暴露了他的哪条信念/哪段代价）】',
    'famous-scene': '每个名场面单独一个素材！name用具体场景名，content必须写【处境】+【他的选择（含动作或台词原文）】+【代价/反差】+【为什么只有他会这样】，至少150字',
    'growth-history': '描述主角成长路线，至少300字',
    'foreshadowing': '每个伏笔单独一个素材！name用伏笔名，content描述埋设位置+预期回收窗口+关联角色',
    'faction': '描述阵营/势力的特征、目标、关系，至少200字',
    'institution': '描述机构/组织的结构、规则、功能，至少200字',
    'character-combat': '描述角色战斗能力、招式、风格，至少150字'
};

const TYPE_NAMING_RULES = {
    'character': '名字必须过"命名三问"（时代感/无同款/可反推身份），按时代背景与风格取名；'
        + '严禁烂大街名（萧炎/龙傲天/叶凡/叶辰/韩立/顾清寒/柳如烟/沈砚/林晓/陈默等），'
        + '严禁"高频姓+清寒云雪轩"式拼名与"慕容轩/上官婉"式复姓套餐；同一项目内不许重字率高',
    'catchphrase': 'name必须是金句原文，禁止叫"经典台词集""金句合集"',
    'famous-scene': 'name必须是具体场景名，禁止叫"名场面1""高光场景"',
    'foreshadowing': 'name必须是伏笔内容，禁止叫"伏笔1""伏笔设计"',
    'equipment': 'name必须是物件名，禁止叫"装备列表""重要物品"',
    'relationship': 'name必须是"角色A与角色B"，禁止叫"人物关系图"'
};

module.exports = { TYPE_LABELS, TYPE_DESCS, TYPE_NAMING_RULES };
