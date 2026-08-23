/**
 * baby/constraintPresets.js
 */
module.exports = {
  "baby-perspective-only": {
    "label": "纯萌宝视角",
    "desc": "全文必须以幼崽的第一视角或紧贴幼崽的第三人称有限视角叙事。幼崽角色严禁出现成人化内心独白、权谋分析、战略思考"
  },
  "no-adult-inner-voice": {
    "label": "禁成人内心戏",
    "desc": "幼崽角色严禁出现成人化内心独白。成人角色直接内心独白每章≤2处，优先通过幼崽可观察行为侧面表达"
  },
  "cute-first-always": {
    "label": "萌感优先",
    "desc": "萌感必须来自幼崽天真行为而非形容词堆砌。幼崽的强大必须通过幼崽行为体现"
  },
  "dialogue-authentic": {
    "label": "对话真实",
    "desc": "对话必须承载信息差/立场差/情感差，禁止无信息量寒暄。儿童化表达需体现3-5岁语言特征"
  },
  "character-intro-whitelist": {
    "label": "新角色出场铺垫规范",
    "desc": "禁止无铺垫突然引入亲属/权威称谓（如爹爹/阿姨/老师）。所有新角色必须通过以下路径自然带出：①现有关系网延伸 ②儿童社交标签化 ③物品代称过渡。违反则标记major"
  }
};
