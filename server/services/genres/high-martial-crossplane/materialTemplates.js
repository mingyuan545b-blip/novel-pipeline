/**
 * high-martial-crossplane/materialTemplates.js
 * 阶段2：小世界/势力素材模板已迁移到modules
 * 保留：角色/机构/力量体系模板
 */
module.exports = {
  "character": {
    "requiredFields": [
      "身份",
      "性格",
      "微表情习惯",
      "立场逻辑",
      "与沈渡关系",
      "禁忌"
    ],
    "template": "【身份】[学派+境界+职位]\n【字号】[可选，古典雅致]\n【性格】[核心特质+行为模式]\n【微表情习惯】[具体动作描写]\n【立场逻辑】[利益驱动+行为底线]\n【与沈渡关系】[具体关系+动态变化]\n【禁忌】[禁止脸谱化/工具人化/烂梗命名]",
    "namingRules": {
      "allowedSurnames": [
        "沈",
        "苏",
        "陆",
        "顾",
        "韩",
        "裴",
        "温",
        "谢",
        "萧",
        "楚",
        "秦",
        "宋",
        "叶",
        "白",
        "纪",
        "容",
        "晏",
        "卫",
        "霍",
        "戚"
      ],
      "namingStyle": "先秦两汉古姓+典籍意象/自然雅称（如渡、挽青、衡霜、缄言、肃规）",
      "forbiddenNames": [
        "龙傲天",
        "叶辰",
        "柳如烟",
        "萧炎",
        "林动",
        "楚轩",
        "白无垢",
        "裴惊鸿"
      ],
      "forbiddenPatterns": [
        {}
      ]
    }
  },
  "institution": {
    "requiredFields": [
      "定位",
      "特色",
      "内部结构",
      "与五家关系"
    ],
    "template": "【定位】[域内地位+学派归属]\n【特色】[核心特征+行事风格]\n【内部结构】[层级划分]\n【与五家关系】[政治地位+义务]",
    "namingRules": {
      "style": "古典雅致（如渊渟阁、霜序台、律鉴司）",
      "forbiddenNames": [
        "合欢宗",
        "天机阁",
        "万宝楼"
      ],
      "forbiddenPatterns": [
        {}
      ]
    }
  },
  "power-system": {
    "requiredFields": [
      "规则描述",
      "限制条件",
      "系统内化表达"
    ],
    "template": "【规则描述】[核心机制]\n【限制条件】[硬性约束]\n【系统内化表达】[高武意境化替换方案]",
    "namingRules": {
      "style": "9×9雅致框架词汇",
      "forbiddenTerms": [
        "练气",
        "筑基",
        "金丹",
        "元婴",
        "化神",
        "渡劫",
        "凝元"
      ]
    }
  }
};
