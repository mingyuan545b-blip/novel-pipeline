/**
 * storyBibleConstants — 全书设定的字段定义与展示常量
 *
 * 可直接编辑的字段必须落在后端白名单内（否则会被静默丢弃）：
 *   项目 PUT /api/projects/:id      → name / description / subGenre / genreProfile / styleProfile（+ 透传 wordConfig）
 *   目标 PUT /api/projects/:id/targets → targetChapters / targetWordCount
 *   素材 PUT /api/materials/:id     → name / currentContent / type / parentPlane / parentFaction
 *                                     / dialectRegion / dialectIntensity / speechStyle / speechStyleIntensity
 * 只读字段（genre / roleLevel）不能改：它们驱动题材插件与实体分级，改了会与约束链/归属脱钩。
 *
 * 文件位置：client/src/pages/storybible/storyBibleConstants.js
 */

export const INTENSITY_OPTIONS = [
    { value: 'light', label: '轻（偶尔带一点）' },
    { value: 'medium', label: '中（常态）' },
    { value: 'heavy', label: '重（浓）' },
];

/** 项目级：风格画像可编辑项（写回 styleProfile 对象） */
export const STYLE_FIELDS = [
    { key: 'style', label: '文风', hint: '如：传统武侠 / 冷硬都市 / 轻喜剧' },
    { key: 'tone', label: '基调', hint: '如：苍劲豪迈 / 冷面幽默' },
    { key: 'pov', label: '叙事视角', hint: '如：第三人称全知视角 / 紧贴主角限知' },
    { key: 'povRule', label: '视角规则', hint: '描写镜头怎么走、推进快慢', long: true },
    { key: 'dialogueRule', label: '对白规则', hint: '人物怎么说话、禁止什么腔调', long: true },
    { key: 'toneRule', label: '基调规则', hint: '幽默/沉重从哪来，禁止什么', long: true },
];

/** 项目级：字数配置 */
export const WORD_FIELDS = [
    { key: 'minWords', label: '单章下限' },
    { key: 'targetWords', label: '单章目标' },
    { key: 'maxWords', label: '单章上限' },
];

export const ROLE_LABEL = { protagonist: '主角', supporting: '配角', npc: 'NPC' };
export const roleLabel = (r) => ROLE_LABEL[r] || r || '未标注';
export const ROLE_COLOR = { protagonist: '#ffa502', supporting: '#3498db', npc: '#8d99ae' };
export const roleColor = (r) => ROLE_COLOR[r] || '#8d99ae';

/** 角色卡摘要：从素材正文里抓一句"定位/身份"，便于列表快速辨认 */
export function charSummary(m) {
    const text = (m.description || m.currentContent || '').replace(/\s+/g, ' ').trim();
    return text.length > 56 ? `${text.slice(0, 56)}…` : text;
}

/** 有没有设过方言/语体（列表上打标记，一眼看出哪些角色还没配语言特征） */
export const hasLanguageProfile = (m) => Boolean(m.dialectRegion || m.speechStyle);
