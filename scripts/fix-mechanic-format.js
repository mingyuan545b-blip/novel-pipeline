const store = require('../server/store');
const p = store.getItem('projects', 'd4808c1a-3378-4372-b672-9d0a6bd075f8');
if (!p) { console.log('Project not found'); process.exit(1); }

p.styleProfile.mechanicFormat = {
    progressTracking: '叙事融入式：通过感官体验/物品变化/身体反应呈现进度状态（如铜筹发烫、无名指隐痛、字迹浮现等），禁止方括号标签格式',
    progressExample: '铜筹在口袋里微微发烫，上面的"一筹"二字似乎比刚才更清晰了。贺千活动了一下左手无名指，那道旧伤又在隐隐作痛——每次动用千术后的代价，从不缺席。',
    propFormat: '叙事融入式：通过角色与道具的交互呈现功能/代价/限制（如铜筹升温、痛感蔓延等），禁止[道具:XX]标签格式',
    cooperationFormat: '叙事融入式：通过对话和行动呈现合作条件与违约代价，禁止[合作约定]标签格式',
    hookFormat: '叙事融入式断章：用场景描写呈现二选一/威胁逼近（如左边是XX右边是XX），禁止"面临抉择：①②"标准格式模板',
    forbiddenFormats: ['[权限终端]', '[筹码]', '[道具]', '[合作约定]', '[契约绑定]', '[千术]', '[代价标记]', '理智锚点', '认知碎片进度', 'cooldown', '面临抉择：①②格式'],
    humorType: '黑色幽默/反讽/冷面吐槽，密度10-20%',
    settingEra: '1980年代九龙城寨，白话文风，禁止网络用语'
};

store.setItem('projects', p.id, p);
console.log('mechanicFormat updated successfully');

const p2 = store.getItem('projects', p.id);
console.log('verify progressTracking:', p2.styleProfile?.mechanicFormat?.progressTracking);
console.log('verify forbiddenFormats:', JSON.stringify(p2.styleProfile?.mechanicFormat?.forbiddenFormats));
