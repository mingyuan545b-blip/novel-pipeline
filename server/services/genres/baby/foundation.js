/**
 * baby/foundation.js
 */
module.exports = {
  "additionalConstraints": [
    {
      "id": "baby-perspective-only",
      "label": "纯萌宝视角",
      "desc": "全文必须以幼崽的第一视角或紧贴幼崽的第三人称有限视角叙事。幼崽角色严禁出现成人化内心独白、权谋分析、战略思考"
    },
    {
      "id": "no-adult-inner-voice",
      "label": "禁成人内心戏",
      "desc": "幼崽角色严禁出现成人化内心独白。成人角色直接内心独白每章≤2处，优先通过幼崽可观察行为侧面表达"
    },
    {
      "id": "cute-first-always",
      "label": "萌感优先",
      "desc": "萌感必须来自幼崽天真行为而非形容词堆砌。幼崽的强大必须通过幼崽行为体现"
    },
    {
      "id": "dialogue-authentic",
      "label": "对话真实",
      "desc": "对话必须承载信息差/立场差/情感差，禁止无信息量寒暄。儿童化表达需体现3-5岁语言特征"
    },
    {
      "id": "character-intro-whitelist",
      "label": "新角色出场铺垫规范",
      "desc": "禁止无铺垫突然引入亲属/权威称谓（如爹爹/阿姨/老师）。所有新角色必须通过以下路径自然带出：①现有关系网延伸 ②儿童社交标签化 ③物品代称过渡。违反则标记major"
    },
    {
      "id": "anti-tool-character-baby",
      "label": "反工具人化（题材增强）",
      "desc": "基底已含反工具人化红线，本题材增强：成人角色必须有独立于幼崽的动机和情感，不能只围着幼崽转。每个成人角色至少有1个独立生活线（工作/社交/个人烦恼），对话必须有信息差和立场差，不是单纯的\"宠溺+配合\""
    }
  ],
  "skipConstraints": [
    "natural-ability",
    "redline-ip-defense",
    "fast-pace"
  ],
  "additionalFoundationRules": [
    "【幼崽视角铁律】萌宝/幼崽题材：每章必须有幼崽角色的感官/行为/对话描写，幼崽出场段占比≥40%。全章无幼崽视角=自动拒绝。幼崽感知段严禁使用专业术语/工程参数/系统机制描述，必须用3-5岁感官隐喻替代。成人工作段术语保留但必须紧跟幼崽感知反应过渡。"
  ],
  "systemMechanismDimming": true,
  "systemMechanismTarget": "幼崽可理解的感官表达"
};
