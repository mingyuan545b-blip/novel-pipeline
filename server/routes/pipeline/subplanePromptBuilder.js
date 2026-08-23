function buildSubplanePrompt({ project, subplaneName, subplaneType, ipReference, volumeNumber }) {
    const systemContent = `你是一个小说小世界素材生成器。根据给定的题材、类型和IP参考，生成完整的小世界素材包。

输出严格JSON格式，包含以下结构：
{
  "subplane": {
    "name": "小世界·${subplaneName}",
    "type": "${subplaneType}",
    "description": "一句话描述",
    "initialContent": "【类型】${subplaneType}\\n【核心规则】...\\n【视觉特征】...\\n【主线剧情】...\\n【系统任务】...\\n【关键转折】...\\n【智斗要素】...\\n【掠夺能力】...\\n【主世界回响】..."
  },
  "factions": [
    {"name": "势力名", "description": "一句话描述", "content": "【定位】...\\n【特色】...\\n【与主角关系】...\\n【内部关系】..."}
  ],
  "characters": [
    {"name": "角色全称", "faction": "所属势力", "description": "一句话描述", "content": "【所属位面】小世界·${subplaneName}\\n【所属势力】...\\n【身份】...\\n【性格】...\\n【能力】...\\n【与主角关系】...\\n【出场方式】...", "refNames": {"narrator": "全称", "byChild": "简称", "byAdult": "简称", "pronoun": "他/她/它"}}
  ],
  "items": [
    {"name": "道具名", "description": "一句话描述", "content": "【所属位面】小世界·${subplaneName}\\n【道具名】...\\n【获取方式】...\\n【功能】...\\n【主世界翻译】..."}
  ]
}

要求：
1. 至少3个势力，势力之间有明确冲突关系
2. 至少6个角色（每势力2个），角色有独特性格和能力
3. 至少3个道具/装备
4. 核心规则必须有"智斗"空间——规则本身可以被解读、利用、绕过
5. 抢劫能力要有创意，不能太强也不能太弱
6. ${ipReference ? `参考IP：${ipReference}，但要原创化处理，不能直接照搬` : '完全原创'}`;

    const userContent = `请为小说"${project.name}"生成一个小世界素材包：
- 小世界名称：${subplaneName}
- 类型：${subplaneType}
${ipReference ? `- IP参考：${ipReference}` : ''}
- 风格定位：${project.styleProfile?.description || project.genre || '智斗喜剧'}
- 第${volumeNumber || '?'}卷的小世界

请生成完整素材包。`;

    return [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent }
    ];
}

module.exports = { buildSubplanePrompt };
