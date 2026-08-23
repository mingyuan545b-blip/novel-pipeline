/**
 * baby/perspectiveConfig.js
 */
module.exports = {
  "babyNames": /小满|团团|幼崽|宝宝|萌宝|小豆丁|小团子|小家伙/,
  "adultContextWords": /陈工|林晚|张工|李工|王工|赵工|监控|屏幕|仪器|数据|记录板|分贝仪|实验室|控制室|办公室/,
  "babyContextWords": /小满|团团|宝宝|萌宝|小豆丁|小团子|小家伙|拍手|蹦跳|抱大腿|吃手|蹭|拍肚皮|打嗝|好暖|好软|好香|肚肚|怕怕|要要/,
  "adultViewMarkers": [
    "陈工",
    "林晚",
    "张工",
    "李工",
    "王工",
    "赵工",
    "看着监控",
    "看着屏幕",
    "盯着数据",
    "检查仪器",
    "翻阅记录",
    "操作台",
    "控制面板",
    "记录板",
    "分贝仪",
    "实验室",
    "控制室",
    "办公室",
    "工作站",
    "会议室"
  ],
  "babyViewMarkers": [
    "小满",
    "他觉得",
    "他看见",
    "他听见",
    "好暖",
    "好软",
    "像棉花糖",
    "像小蜗牛",
    "拍手",
    "蹦跳",
    "抱大腿",
    "蹭",
    "歪头",
    "哼唧",
    "肚肚",
    "怕怕",
    "要要",
    "好香",
    "吧唧",
    "小揪揪",
    "肉嘟嘟",
    "圆鼓鼓",
    "小手",
    "小脚"
  ],
  "criticalPatterns": [
    {
      "pattern": "BABY_NAMES_ADULT_THINKING",
      "desc": "幼崽成人化内心独白（critical）",
      "severity": "critical"
    },
    {
      "pattern": "BABY_NAMES_ADULT_JUDGMENT",
      "desc": "幼崽成人化认知判断（critical）",
      "severity": "critical"
    }
  ],
  "highPatterns": [
    {
      "desc": "幼崽因果推理越界",
      "severity": "high"
    },
    {
      "desc": "成人角色内心活动过多，应优先通过幼崽可观察行为侧面表达",
      "severity": "high"
    },
    {
      "desc": "全章无幼崽视角/行为描写，完全是成人观察视角",
      "severity": "high"
    }
  ],
  "mediumPatterns": [
    {
      "desc": "全章无任何幼崽萌感行为（拍手/蹦跳/抱大腿/蹭人/歪头/哼唧等）",
      "severity": "medium"
    }
  ],
  "forbiddenPatterns": [
    {
      "pattern": /恐怖|惊悚|血腥|阴森|诡异|毛骨悚然|不寒而栗/,
      "desc": "恐怖/悬疑化描写（禁止）"
    },
    {
      "pattern": /阴暗|死寂|冰冷刺骨|黑影|低语|阴风/,
      "desc": "恐怖化环境描写（禁止）"
    }
  ],
  "adultInnerVoiceThreshold": 2,
  "babyActionPatterns": /拍手|蹦跳|抱大腿|缩成团|吃手|蹭人|拍肚皮|打嗝|小揪揪|肉嘟嘟|圆鼓鼓|吧唧|嗝|歪头|眨巴|拽着|爬|趴|钻|扑|啃|揉|摸|扯|咕噜|哼唧|扭|摇|抓/,
  "causalPattern": "BABY_CAUSAL"
};
