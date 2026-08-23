/**
 * baby/styleProfile.js
 */
module.exports = {
  "styleProfile": {
    "key": "萌娃变废为宝",
    "label": "植物系躺平萌宝·变废为宝",
    "povRule": "【视角铁律 - 触发即中断】第三人称限知视角，紧贴幼崽感知。每章幼崽出场段占比≥40%，全章无幼崽视角=自动拒绝。幼崽段落禁用：意识到/明白/暗想/盘算/权衡/谋划/深知/恍然/领悟。可用：觉得/感觉/看见/听见/想/知道/发现。成人段落允许内心独白但每章≤2处，优先通过幼崽可观察行为侧面表达。成人工作段术语保留但必须紧跟幼崽感知反应过渡（如\"陈工说参数正常→小满看见屏幕上的绿线趴平了\"）。",
    "dialogueRule": "幼崽：叠词+具象比喻+短句（3-5岁特征）。成人对幼崽：降维匹配认知。成人之间：正常表达。",
    "behaviorRule": "躺平基调，动机围绕舒适区与家人陪伴。严禁萌宝主动承担成人责任。冲突来自外部/意外/成人波及。术语降维：幼崽感知段→感官隐喻1句，成人工作段→术语保留。",
    "toneRule": "轻松治愈+轻喜剧。短句短段。禁恐怖/克苏鲁。章末用好奇/期待感钩子。",
    "titleRule": "【章节标题命名规则】标题必须诗情画意、具画面感，禁止技术说明书式命名。❌禁止：\"XX与YY的ZZ阀/舱/器/系统/装置/模块/缓冲层\"（材料+材料+功能装置的工程命名模式）。✅正确：用感官意象+动作/状态命名，如\"会唱歌的草茎井盖\"\"冻土下的软被子\"\"蒲苇穗会唱歌\"\"沙盘里的白霜\"\"暖土与亮片片\"。标题要让读者产生画面感和好奇心，而不是像读工程图纸。",
    "reviewFocus": "萌宝视角一致性|术语降维合理性|金手指自然度|字数达标",
    "materialFocus": {
      "primary": [
        "character",
        "relationship",
        "catchphrase",
        "famous-scene"
      ],
      "secondary": [
        "worldview",
        "growth-history"
      ],
      "skip": [
        "equipment",
        "power-system",
        "faction"
      ]
    },
    "constraintOverrides": [
      "no-adult-inner-voice",
      "baby-perspective-only",
      "cute-first-always",
      "simple-readable-style",
      "dialogue-authentic",
      "no-derailment",
      "character-consistency",
      "worldview-consistency",
      "hook-every-chapter",
      "character-intro-whitelist"
    ],
    "characterRefRules": "【角色称呼规范】每段首次用全名，后续可用代词，换段/换场景后重新用全名。两个同性角色同场景禁连续用代词。幼崽优先用名字，严禁用\"他\"指代幼崽时产生歧义。母亲角色幼崽视角统一用一个称呼。"
  },
  "genreBase": {
    "BEHAVIOR_APPEND": "【术语降维规则】按段落视角区分：①幼崽感知段落（出现幼崽名/感官词/动作词）：术语→1句感官隐喻，如「安全阈值」→「安全线」、「后台日志」→「小本本」、「净化装置」→「洗澡大机器」、「地下管网」→「蚂蚁通道」。②成人工作段落（出现成人名/监控/屏幕/仪器）：术语保留原样。③混合段落：术语后紧跟幼崽感知反应。",
    "REQUIRED_CONSTRAINT_OVERRIDES": [
      "character-intro-whitelist"
    ],
    "TONE_APPEND": "禁用恐怖/克苏鲁意象，可用科学奇幻化表达。",
    "REVIEW_APPEND": "|科技降维检查|新角色出场铺垫检查|段落级防重复检查"
  }
};
