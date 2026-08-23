/**
 * high-martial-crossplane/entitySchema.js
 * 阶段2：小世界/修炼相关实体已迁移到modules
 * 保留：通用实体类型、通用关系类型、穿越叙事阶段
 */
module.exports = {
  "entityTypes": [
    "character",
    "location",
    "faction",
    "relationship",
    "foreshadowing"
  ],
  "genreStateKeys": {},
  "relationTypes": [
    "ally",
    "enemy",
    "rival",
    "family",
    "subordinate"
  ],
  "relationTypeKeywords": {
    "ally": [
      "盟友",
      "合作",
      "结盟"
    ],
    "enemy": [
      "敌人",
      "仇人",
      "敌对"
    ],
    "rival": [
      "对手",
      "竞争",
      "较劲"
    ],
    "family": [
      "家人",
      "父母",
      "兄弟",
      "姐妹"
    ],
    "subordinate": [
      "下属",
      "手下",
      "跟班"
    ]
  },
  "narrativePhases": [
    "transmigration"
  ],
  "milestones": {
    "1": "穿越降临"
  }
};
