const { GENRE_NAMING_MAP, inferFromGenre } = require('./namingGenreMap');

const NAMING_STYLES = {
    classical: {
        id: 'classical', label: '古典雅致', tag: 'classical',
        description: '取自古诗词典故，意境深远',
        surnamePool: ['白', '苏', '柳', '沈', '顾', '谢', '林', '秦', '楚', '温'],
        maleGivenPool: ['清', '远', '逸', '尘', '墨', '轩', '泽', '渊', '明', '玄'],
        femaleGivenPool: ['瑶', '月', '雪', '灵', '芷', '婉', '素', '梦', '烟', '清'],
        compoundRate: 0.3, maxSurnameLen: 1, titleWords: ['先生', '姑娘', '公子', '小姐']
    },
    modern: {
        id: 'modern', label: '现代简约', tag: 'modern',
        description: '现代常见姓名，接地气',
        surnamePool: ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'],
        maleGivenPool: ['浩', '磊', '鑫', '鹏', '强', '伟', '军', '杰', '涛', '明'],
        femaleGivenPool: ['婷', '雪', '静', '敏', '丽', '芳', '娟', '燕', '玲', '琳'],
        compoundRate: 0.1, maxSurnameLen: 1, titleWords: ['总', '哥', '姐', '老师']
    },
    fantasy: { ...GENRE_NAMING_MAP['xuanhuan'], id: 'fantasy', label: '玄幻修仙', tag: 'fantasy', description: '修仙玄幻风格命名' },
    wuxia: { ...GENRE_NAMING_MAP['wuxia'], id: 'wuxia', label: '武侠江湖', tag: 'wuxia', description: '武侠江湖风格命名' },
    scifi: { ...GENRE_NAMING_MAP['scifi'], id: 'scifi', label: '科幻未来', tag: 'scifi', description: '科幻未来风格命名' }
};

function getAllStyles() {
    return Object.values(NAMING_STYLES).map(s => ({
        id: s.id, label: s.label, tag: s.tag, description: s.description,
        surnameCount: s.surnamePool.length, givenCount: s.maleGivenPool.length + s.femaleGivenPool.length
    }));
}

function get(styleId) {
    return NAMING_STYLES[styleId] || null;
}

function buildPromptBlock(styleId, intensity = 'medium') {
    const style = get(styleId);
    if (!style) return '';
    const samples = _generateSamples(style, 3);
    const intensityNote = intensity === 'high' ? '严格遵循' : intensity === 'low' ? '参考' : '建议遵循';
    return `【命名风格·${style.label}】${intensityNote}\n姓氏池：${style.surnamePool.join('、')}\n男性名池：${style.maleGivenPool.join('、')}\n女性名池：${style.femaleGivenPool.join('、')}\n示例：${samples.join('、')}`;
}

function _generateSamples(style, count = 3) {
    const samples = [];
    for (let i = 0; i < count; i++) {
        const isMale = i % 2 === 0;
        const surname = style.surnamePool[Math.floor(Math.random() * style.surnamePool.length)];
        const givenPool = isMale ? style.maleGivenPool : style.femaleGivenPool;
        const given = givenPool[Math.floor(Math.random() * givenPool.length)];
        samples.push(surname + given);
    }
    return samples;
}

function validateName(name, styleId) {
    const style = get(styleId);
    if (!style) return { valid: true, warnings: [] };
    const warnings = [];
    const AI高频名 = ['林晓', '苏雨', '陈默', '顾言', '叶凡', '苏瑶', '林夕', '李默', '王浩', '张伟'];
    if (AI高频名.includes(name)) warnings.push(`"${name}"是AI高频名，建议更换`);
    const 烂梗名 = ['龙傲天', '叶辰', '柳如烟', '萧炎', '唐三', '林动', '石昊'];
    if (烂梗名.includes(name)) warnings.push(`"${name}"是网文烂梗名，必须更换`);
    return { valid: warnings.length === 0, warnings };
}

function generateName(styleId, gender = 'male') {
    const style = get(styleId);
    if (!style) return '未名';
    const surname = style.surnamePool[Math.floor(Math.random() * style.surnamePool.length)];
    const givenPool = gender === 'female' ? style.femaleGivenPool : style.maleGivenPool;
    const given = givenPool[Math.floor(Math.random() * givenPool.length)];
    return surname + given;
}

async function buildCombinedPromptBlock(projectId) {
    const store = require('../store');
    const project = await store.getItem('projects', projectId);
    if (!project) return '';
    const genreId = project.genre || '';
    const styleId = inferFromGenre(genreId);
    const style = get(styleId);
    if (!style) return '';
    const block = buildPromptBlock(styleId, 'high');
    const warnings = _buildAINameWarnings();
    return block + (warnings ? '\n' + warnings : '');
}

async function buildCombinedReviewBlock(projectId) {
    const store = require('../store');
    const project = await store.getItem('projects', projectId);
    if (!project) return '';
    const genreId = project.genre || '';
    const styleId = inferFromGenre(genreId);
    const style = get(styleId);
    if (!style) return '';
    return `【命名审核·${style.label}】检查角色名是否符合${style.label}风格，排除AI高频名和烂梗名`;
}

function _buildAINameWarnings() {
    const aiNames = ['林晓', '苏雨', '陈默', '顾言', '叶凡', '苏瑶', '林夕', '李默', '王浩', '张伟'];
    const memeNames = ['龙傲天', '叶辰', '柳如烟', '萧炎', '唐三', '林动', '石昊'];
    return `【禁止使用的AI高频名】${aiNames.join('、')}\n【禁止使用的烂梗名】${memeNames.join('、')}`;
}

function list() { return getAllStyles(); }

/**
 * reload - 命名风格为代码内常量，无需从外部文件重载。
 * 提供 no-op 实现以保持与其他 registry 的 API 一致性（flavorRegistryRoutes /reload 调用）。
 */
function reload() { /* no-op: naming styles are code constants */ }

module.exports = { NAMING_STYLES, getAllStyles, get, list, buildPromptBlock, buildCombinedPromptBlock, buildCombinedReviewBlock, inferFromGenre, validateName, generateName, reload };
