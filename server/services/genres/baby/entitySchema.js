/**
 * baby/entitySchema.js
 */
module.exports = {
  "entityTypes": [
    "character",
    "location",
    "relationship",
    "foreshadowing",
    "catchphrase",
    "famous-scene"
  ],
  "genreStateKeys": {
    "energy": {
      "label": "精力",
      "type": "number",
      "default": 100
    },
    "wealth": {
      "label": "财富",
      "type": "number",
      "default": 0
    },
    "psychologicalState": {
      "label": "心理状态",
      "type": "string",
      "default": "开心"
    },
    "relationshipProgress": {
      "label": "关系进度",
      "type": "string",
      "default": "初识"
    },
    "emotionalState": {
      "label": "情感状态",
      "type": "string",
      "default": "平静"
    }
  },
  "relationTypes": [
    "family",
    "friend",
    "caretaker",
    "rival",
    "neighbor",
    "benefactor"
  ],
  "relationTypeKeywords": {
    "family": [
      "家人",
      "父母",
      "爸爸",
      "妈妈",
      "爷爷",
      "奶奶",
      "叔叔",
      "阿姨"
    ],
    "friend": [
      "朋友",
      "小伙伴",
      "玩伴"
    ],
    "caretaker": [
      "照顾",
      "保姆",
      "看护",
      "老师"
    ],
    "rival": [
      "对手",
      "竞争",
      "抢"
    ],
    "neighbor": [
      "邻居",
      "隔壁"
    ],
    "benefactor": [
      "恩人",
      "帮助",
      "好心"
    ]
  },
  "narrativePhases": [
    "encounter",
    "bonding",
    "conflict",
    "growth",
    "reunion",
    "milestone"
  ],
  "milestones": {
    "1": "初次相遇",
    "3": "建立信任",
    "5": "第一次冲突",
    "8": "关系突破",
    "12": "成长考验",
    "16": "危机化解",
    "20": "温馨结局"
  }
};
