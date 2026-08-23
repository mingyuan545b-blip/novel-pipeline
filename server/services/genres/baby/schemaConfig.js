/**
 * baby/schemaConfig.js
 */
module.exports = {
  "stateSchema": {
    "protagonist": {
      "trackFields": "all",
      "minUpdateFrequency": "every-chapter"
    },
    "supporting": {
      "trackFields": "important",
      "minUpdateFrequency": "appearance-chapter",
      "importantFields": [
        "factionName",
        "position",
        "personality",
        "speakingTone"
      ]
    },
    "npc": {
      "trackFields": "basic",
      "minUpdateFrequency": "appearance-chapter",
      "basicFields": [
        "name",
        "factionName",
        "position"
      ]
    }
  },
  "kvImportantKeys": [
    "name",
    "hp",
    "combatPower",
    "position",
    "factionName",
    "speakingTone"
  ],
  "characterProfile": {
    "protagonistTags": [
      "【年龄】具体年龄",
      "【外貌】身高体型、面容特征、标志性穿着",
      "【性格】至少3个性格特征词+1段行为表现描述",
      "【说话语气】声音特征+语言习惯",
      "【核心欲望】角色最深层想要什么",
      "【内在矛盾】角色内心的矛盾冲突",
      "【行为模式】面对问题的典型反应方式",
      "【身份/职位】在故事世界中的位置",
      "【与主角关系】填写\"主角本人\"",
      "【成长弧光】主角从开头到结尾的性格/能力变化轨迹",
      "【标志性动作】主角的招牌动作或口头禅"
    ],
    "protagonistWordCount": 400,
    "protagonistExample": "【年龄】[具体年龄]【外貌】[身高体型+面容特征+标志性穿着]【性格】[3个性格特征词]+[1段行为表现描述]【说话语气】[声音特征+语言习惯]【核心欲望】[角色最深层想要什么]【内在矛盾】[角色内心的矛盾冲突]【行为模式】[面对问题的典型反应方式]【身份/职位】[在故事世界中的位置]【与主角关系】主角本人【成长弧光】[从开头到结尾的性格/能力变化轨迹]【标志性动作】[招牌动作或口头禅]",
    "supportingTags": [
      "【年龄】具体年龄",
      "【外貌】1-2句标志性外貌特征",
      "【性格】2-3个性格特征词+简短行为描述",
      "【说话语气】语言习惯（1句即可）",
      "【核心欲望】角色最深层想要什么",
      "【身份/职位】在故事世界中的位置",
      "【与主角关系】和主角的关系定位+互动模式",
      "【出场功能】叙事功能（导师/对手/盟友/信息源）"
    ],
    "supportingWordCount": 250,
    "supportingExample": "【年龄】[具体年龄]【外貌】[1-2句标志性外貌特征]【性格】[2-3个性格特征词]+[简短行为描述]【说话语气】[语言习惯（1句即可）]【核心欲望】[角色最深层想要什么]【身份/职位】[在故事世界中的位置]【与主角关系】[和主角的关系定位+互动模式]【出场功能】[叙事功能（导师/对手/盟友/信息源）]",
    "supportingWriterPrinciples": "",
    "supportingOrganizerDimensions": "",
    "supportingTrackingFields": [],
    "supportingRegistrarNoteFields": [],
    "npcTags": [
      "【外貌】1句标志性特征（让人记住的辨识点）",
      "【说话语气】语言习惯（1句即可）",
      "【身份/职位】在故事世界中的位置",
      "【出场功能】这个NPC在故事中承担什么功能（如：信息源/障碍/氛围点缀）"
    ],
    "npcWordCount": 80,
    "npcExample": "【外貌】[1句标志性特征（让人记住的辨识点）]【说话语气】[语言习惯（1句即可）]【身份/职位】[在故事世界中的位置]【出场功能】[这个NPC在故事中承担什么功能（如：信息源/障碍/氛围点缀）]",
    "worldviewTemplate": "",
    "namingTemplate": "",
    "flavorTemplate": ""
  },
  "materialRules": {
    "worldview": "必须包含 边界条件 + 违反后果",
    "power-system": "必须包含 升级条件 + 代价/限制",
    "foreshadowing": "必须包含 预期回收窗口 + 关联角色"
  }
};
