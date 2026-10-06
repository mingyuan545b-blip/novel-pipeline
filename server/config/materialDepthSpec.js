/**
 * materialDepthSpec.js — 素材深度系统规范（聚合入口，单一数据源）
 *
 * 设计理念：
 *   素材不能只"有就行"，必须有深度等级。
 *   300万字长篇要求每个素材达到"deep"等级，否则角色扁平、世界观空架子。
 *
 * 历史教训（陷阱#22）：
 *   之前 MATERIAL_STANDARDS 只用正则匹配关键词，导致：
 *   - 角色素材写了"核心欲望"三个字就通过，实际内容为空
 *   - 人物魅力4维度（charisma/philosophy/quoteLibrary/entranceDesign）不校验
 *   - 小世界 sub-plane 的 requiredFields 在题材模板里有，但无校验执行点
 *   - 校验只"标记"不"阻断"，生成器无视校验继续产出垃圾素材
 *
 * 字段约束三要素：
 *   1. label:        字段中文名（用于错误提示）
 *   2. minChars:     该字段最小字符数（防止"有标签无内容"）
 *   3. qualityHints: 内容质量关键词（至少匹配1个，防止敷衍填充）
 *
 * 文件拆分（陷阱#45：拆分不破坏引用）：
 *   - materialDepthConstants.js  → DEPTH_LEVELS 常量（破环点）
 *   - materialDepthRequirements.js → DEPTH_REQUIREMENTS 映射表
 *   - materialDepthSpec.js（本文件）→ FIELD_SPECS、工具函数、聚合 re-export
 *   引用方仍可 `require('../config/materialDepthSpec')` 解构所有导出
 */
'use strict';

const { DEPTH_LEVELS } = require('./materialDepthConstants');
const { DEPTH_REQUIREMENTS } = require('./materialDepthRequirements');

// ── 字段约束定义 ──
// 每个字段：{ label, minChars, qualityHints }
// minChars: 该字段内容最小字符数（不含标签本身）
// qualityHints: 内容质量关键词数组，至少匹配1个（空数组表示不检查）
const FIELD_SPECS = Object.freeze({
    // === 角色通用字段 ===
    '身份/职位': { label: '身份/职位', minChars: 4, qualityHints: [] },
    '性格': { label: '性格', minChars: 8, qualityHints: ['冷静', '热血', '腹黑', '傲娇', '憨厚', '阴沉', '开朗', '孤僻', '机智', '冲动'] },
    '说话语气': { label: '说话语气', minChars: 4, qualityHints: ['冷淡', '温和', '尖刻', '犹豫', '豪爽', '轻柔', '沙哑', '清冷', '慵懒'] },
    '标志性细节': { label: '标志性细节', minChars: 6, qualityHints: ['习惯', '随身', '外貌', '动作', '疤痕', '纹身', '饰品'] },
    '核心欲望': { label: '核心欲望', minChars: 8, qualityHints: ['想要', '追求', '渴望', '执念', '目标', '梦想', '复仇', '守护'] },
    '内在矛盾': { label: '内在矛盾', minChars: 8, qualityHints: ['矛盾', '冲突', '两难', '挣扎', '纠结', '取舍', '撕裂'] },
    '行为模式': { label: '行为模式', minChars: 8, qualityHints: ['面对', '遇到', '习惯', '总是', '倾向于', '反应'] },
    '成长弧光': { label: '成长弧光', minChars: 10, qualityHints: ['从', '到', '变化', '转变', '成长', '蜕变', '觉醒'] },
    '标志性动作': { label: '标志性动作', minChars: 4, qualityHints: ['动作', '口头禅', '招牌', '习惯'] },

    // === 人物魅力4维度（主角必填，陷阱#22修复）===
    '人格魅力': { label: '人格魅力', minChars: 10, qualityHints: ['魅力', '特质', '气质', '独特', '吸引'] },
    '哲学观': { label: '哲学观', minChars: 12, qualityHints: ['信念', '价值观', '认知', '天道', '生死', '规则', '认为', '信奉'] },
    '金句库': { label: '金句库', minChars: 20, qualityHints: ['场景', '金句', '：', '场景：'] },
    '高光场景': { label: '高光场景', minChars: 10, qualityHints: ['场景', '高光', '名场面', '转折', '立住'] },
    '出场设计': { label: '出场设计', minChars: 10, qualityHints: ['出场', '首次', '方式', '场景', '登场'] },

    // === 世界观字段 ===
    '天地格局': { label: '天地格局', minChars: 10, qualityHints: ['界', '层', '飞升', '天劫', '凡人', '仙'] },
    '修炼体系': { label: '修炼体系', minChars: 15, qualityHints: ['练气', '筑基', '结丹', '元婴', '化神', '境界', '突破'] },
    '势力格局': { label: '势力格局', minChars: 10, qualityHints: ['宗门', '世家', '散修', '魔道', '势力', '博弈'] },
    '天道法则': { label: '天道法则', minChars: 10, qualityHints: ['因果', '天劫', '道心', '考验', '约束', '惩罚'] },
    '资源体系': { label: '资源体系', minChars: 10, qualityHints: ['灵石', '丹药', '法宝', '灵脉', '稀缺', '争夺'] },
    '禁忌与红线': { label: '禁忌与红线', minChars: 8, qualityHints: ['禁术', '禁地', '禁忌', '红线', '代价'] },
    '边界条件': { label: '边界条件', minChars: 8, qualityHints: ['边界', '限制', '禁忌', '不可', '禁止', '上限', '极限', '规则'] },
    '违反后果': { label: '违反后果', minChars: 6, qualityHints: ['后果', '代价', '惩罚', '反噬', '反作用', '遭到', '受到'] },

    // === 战力体系字段 ===
    '升级条件': { label: '升级条件', minChars: 10, qualityHints: ['升级', '突破', '进阶', '晋升', '提升条件', '修炼'] },
    '代价/限制': { label: '代价/限制', minChars: 6, qualityHints: ['代价', '限制', '反噬', '副作用', '消耗', '瓶颈'] },

    // === 伏笔字段 ===
    '预期回收窗口': { label: '预期回收窗口', minChars: 4, qualityHints: ['回收', '揭晓', '揭示', '揭穿', '揭底', '预期', '章', '窗口'] },
    '关联角色': { label: '关联角色', minChars: 2, qualityHints: ['关联', '涉及', '相关', '角色', '人物'] },
    '伏笔内容': { label: '伏笔内容', minChars: 15, qualityHints: [] },
    '回收方式': { label: '回收方式', minChars: 8, qualityHints: ['揭示', '揭晓', '触发', '回收', '真相'] },

    // === 小世界字段（陷阱#22修复：sub-plane 校验缺失）===
    '核心规则': { label: '核心规则', minChars: 15, qualityHints: ['规则', '法则', '逻辑', '运行', '底层'] },
    '位面人物': { label: '位面人物', minChars: 8, qualityHints: [] },
    '势力关系': { label: '势力关系', minChars: 8, qualityHints: ['势力', '阵营', '对立', '合作', '冲突'] },
    '剧情线': { label: '剧情线', minChars: 15, qualityHints: ['主线', '任务', '事件', '转折', '衔接'] },
    '掠夺能力': { label: '掠夺能力', minChars: 10, qualityHints: ['掠夺', '能力', '功能', '描述'] },
    '触发条件': { label: '触发条件', minChars: 8, qualityHints: ['触发', '条件', '任务', '完成'] },
    '可获取道具': { label: '可获取道具', minChars: 6, qualityHints: ['道具', '获取', '探索', '击败', '奖励'] },
    '视觉特征': { label: '视觉特征', minChars: 10, qualityHints: ['视觉', '环境', '描写', '异变', '场景'] },
    'IP校验': { label: 'IP校验', minChars: 4, qualityHints: ['CANON', 'IP', '校验', '战力', '压制'] },

    // === 装备字段 ===
    '获取方式': { label: '获取方式', minChars: 6, qualityHints: ['探索', '击败', '完成', '交易', '获取'] },
    '功能': { label: '功能', minChars: 10, qualityHints: ['功能', '效果', '作用', '描述'] },
    '代价': { label: '代价', minChars: 4, qualityHints: ['代价', '消耗', '副作用', '反噬'] },
    '主世界压制规则': { label: '主世界压制规则', minChars: 8, qualityHints: ['压制', '同境', '境界', '减半', '效果'] }
});

// ── 角色 roleLevel → 深度等级映射 ──
const ROLE_LEVEL_TO_DEPTH = Object.freeze({
    npc: DEPTH_LEVELS.BASIC,
    supporting: DEPTH_LEVELS.STANDARD,
    protagonist: DEPTH_LEVELS.DEEP
});

/**
 * 从素材内容中提取字段值
 * 支持【标签】内容 格式（标签后的换行或下一个标签前的内容）
 * @param {string} content - 素材内容
 * @param {string} fieldLabel - 字段标签（如"核心欲望"）
 * @returns {string} 字段值（去除标签和首尾空白），未找到返回空字符串
 */
function extractFieldValue(content, fieldLabel) {
    if (!content || !fieldLabel) return '';
    // 匹配【标签】后到下一个【标签】或字符串末尾的内容
    const pattern = new RegExp(`【${fieldLabel}】([\\s\\S]*?)(?=【[^】]+】|$)`);
    const match = content.match(pattern);
    if (!match) return '';
    return match[1].trim();
}

/**
 * 计算素材内容总字符数（去除标签和空白）
 * @param {string} content
 * @returns {number}
 */
function countContentChars(content) {
    if (!content) return 0;
    // 去除所有【标签】
    const noTags = content.replace(/【[^】]+】/g, '');
    // 去除空白
    return noTags.replace(/\s/g, '').length;
}

// 聚合 re-export：引用方仍可从本文件解构所有导出
module.exports = {
    DEPTH_LEVELS,
    FIELD_SPECS,
    DEPTH_REQUIREMENTS,
    ROLE_LEVEL_TO_DEPTH,
    extractFieldValue,
    countContentChars
};
