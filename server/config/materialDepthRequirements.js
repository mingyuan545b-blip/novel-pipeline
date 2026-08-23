'use strict';

/**
 * 素材类型 × 深度等级 → 必填字段集（单一数据源）
 * 从 materialDepthSpec.js 拆分，职责：DEPTH_REQUIREMENTS 映射表
 *
 * 拆分原因：主文件 materialDepthSpec.js 超 200 行限制
 * 依赖：materialDepthConstants.js（DEPTH_LEVELS），无循环依赖
 *
 * 规则：
 *   每个 [type][depth] = { requiredFields: [...], minTotalChars: number, description: string }
 *   requiredFields: 该深度等级必须出现的字段标签
 *   minTotalChars: 素材总内容最小字符数（不含标签）
 */
const { DEPTH_LEVELS } = require('./materialDepthConstants');

const DEPTH_REQUIREMENTS = Object.freeze({
    character: {
        [DEPTH_LEVELS.BASIC]: {
            requiredFields: ['身份/职位', '性格', '说话语气', '标志性细节'],
            minTotalChars: 80,
            description: 'NPC级角色：基础辨识信息'
        },
        [DEPTH_LEVELS.STANDARD]: {
            requiredFields: ['身份/职位', '性格', '说话语气', '标志性细节', '核心欲望', '行为模式'],
            minTotalChars: 250,
            description: '配角级角色：含动机和行为模式'
        },
        [DEPTH_LEVELS.DEEP]: {
            requiredFields: [
                '身份/职位', '性格', '说话语气', '标志性细节',
                '核心欲望', '内在矛盾', '行为模式', '成长弧光', '标志性动作',
                // 陷阱#22修复：人物魅力4维度主角必填
                '人格魅力', '哲学观', '金句库', '出场设计'
            ],
            minTotalChars: 400,
            description: '主角级角色：含人物魅力4维度'
        }
    },
    worldview: {
        [DEPTH_LEVELS.BASIC]: {
            requiredFields: ['边界条件', '违反后果'],
            minTotalChars: 100,
            description: '基础世界观：边界+后果'
        },
        [DEPTH_LEVELS.STANDARD]: {
            requiredFields: ['边界条件', '违反后果', '修炼体系', '势力格局'],
            minTotalChars: 250,
            description: '标准世界观：含体系+势力'
        },
        [DEPTH_LEVELS.DEEP]: {
            requiredFields: ['天地格局', '修炼体系', '势力格局', '天道法则', '资源体系', '禁忌与红线'],
            minTotalChars: 400,
            description: '深度世界观：六维度全覆盖'
        }
    },
    'power-system': {
        [DEPTH_LEVELS.BASIC]: {
            requiredFields: ['升级条件', '代价/限制'],
            minTotalChars: 80,
            description: '基础战力体系：升级+代价'
        },
        [DEPTH_LEVELS.STANDARD]: {
            requiredFields: ['升级条件', '代价/限制'],
            minTotalChars: 200,
            description: '标准战力体系：详细升级路径'
        },
        [DEPTH_LEVELS.DEEP]: {
            requiredFields: ['升级条件', '代价/限制'],
            minTotalChars: 400,
            description: '深度战力体系：完整境界表+突破条件+寿元+战力锚点'
        }
    },
    foreshadowing: {
        [DEPTH_LEVELS.BASIC]: {
            requiredFields: ['预期回收窗口', '关联角色'],
            minTotalChars: 50,
            description: '基础伏笔：回收窗口+关联角色'
        },
        [DEPTH_LEVELS.STANDARD]: {
            requiredFields: ['预期回收窗口', '关联角色', '伏笔内容'],
            minTotalChars: 150,
            description: '标准伏笔：含伏笔内容'
        },
        [DEPTH_LEVELS.DEEP]: {
            requiredFields: ['预期回收窗口', '关联角色', '伏笔内容', '回收方式'],
            minTotalChars: 250,
            description: '深度伏笔：含内容+回收方式'
        }
    },
    'sub-plane': {
        [DEPTH_LEVELS.BASIC]: {
            requiredFields: ['核心规则', '视觉特征'],
            minTotalChars: 100,
            description: '基础小世界：规则+视觉'
        },
        [DEPTH_LEVELS.STANDARD]: {
            requiredFields: ['核心规则', '位面人物', '势力关系', '视觉特征'],
            minTotalChars: 250,
            description: '标准小世界：含人物+势力'
        },
        [DEPTH_LEVELS.DEEP]: {
            requiredFields: ['核心规则', '位面人物', '势力关系', '剧情线', '掠夺能力', '触发条件', '可获取道具', '视觉特征', 'IP校验'],
            minTotalChars: 400,
            description: '深度小世界：九字段全覆盖'
        }
    },
    equipment: {
        [DEPTH_LEVELS.BASIC]: {
            requiredFields: ['功能'],
            minTotalChars: 50,
            description: '基础装备：功能描述'
        },
        [DEPTH_LEVELS.STANDARD]: {
            requiredFields: ['获取方式', '功能', '代价'],
            minTotalChars: 150,
            description: '标准装备：含获取+代价'
        },
        [DEPTH_LEVELS.DEEP]: {
            requiredFields: ['获取方式', '功能', '代价', '主世界压制规则'],
            minTotalChars: 250,
            description: '深度装备：含压制规则'
        }
    }
});

module.exports = { DEPTH_REQUIREMENTS };
