/**
 * high-martial-crossplane/config.js
 *
 * 阶段3：通用配置，去不搭元素
 * 已移除：肉身穿越/系统升级/五家九境等传统套路patterns
 */
module.exports = {
  "id": "high-martial-comedy",
  "genreProfileIds": [
    "武侠",
    "历史",
    "奇幻"
  ],
  "label": "万界debug·反套路喜剧",
  "patterns": [
    "高武",
    "反套路",
    "搞笑",
    "万界debug",
    "抽象幽默",
    "反AI痕迹",
    "high-martial-comedy"
  ],
  "incompatibleConstraints": [
    "baby-perspective-only",
    "no-adult-inner-voice",
    "cute-first-always"
  ],
  "requiredConstraints": [
    "grounded-style",
    "fast-pace",
    "comedy-mandatory",
    "anti-ai-trace",
    "hook-every-chapter"
  ],
  "perspective": null,
  "techJargon": {
    "terms": []
  },
  "pacingConfig": {
    "openingHookRange": 100
  },
  "pipelineConfig": {
    "targetMinWords": 2400,
    "targetMaxWords": 2800,
    "rejectMinWords": 2000,
    "maxChapterWords": 3500
  },
  "milestones": {}
};
