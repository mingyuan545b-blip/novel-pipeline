const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/naming-styles');
let styles = new Map();

function load() {
    styles.clear();
    if (!fs.existsSync(DATA_DIR)) return;
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
            const data = JSON.parse(raw);
            if (data.id) styles.set(data.id, data);
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    }
}

load();

function list() { return Array.from(styles.values()); }

function get(id) { return styles.get(id) || null; }

function buildPromptBlock(namingStyleId, intensity) {
    const style = get(namingStyleId);
    if (!style) return '';

    const level = intensity || 'medium';
    const lines = [];

    lines.push(`【命名规范·${style.label}(${style.tag})】`);
    lines.push(`核心原则: ${style.corePrinciple}`);
    lines.push('');

    lines.push('姓氏池:');
    for (const [category, surnames] of Object.entries(style.surnamePool || {})) {
        lines.push(`  ${category}: ${surnames.join('、')}`);
    }
    lines.push('');

    lines.push('命名模式:');
    for (const p of (style.givenNamePatterns || [])) {
        lines.push(`  ${p.pattern}: ${p.examples.join('、')}`);
        lines.push(`    规则: ${p.rule}`);
    }
    lines.push('');

    if (style.epithetPatterns) {
        lines.push('绰号模式:');
        for (const p of style.epithetPatterns) {
            lines.push(`  ${p.pattern}: ${p.examples.join('、')}`);
            lines.push(`    规则: ${p.rule}`);
        }
        lines.push('');
    }

    lines.push('组合规则:');
    for (const r of (style.combinationRules || [])) {
        lines.push(`  - ${r}`);
    }
    lines.push('');

    lines.push('禁止模式:');
    for (const f of (style.forbiddenPatterns || [])) {
        lines.push(`  - ${f}`);
    }
    lines.push('');

    lines.push('示例:');
    for (const e of (style.exampleNames || [])) {
        const extra = e.绰号 ? ` 绰号:${e.绰号}` : e.真名 ? ` 真名:${e.真名}` : e.谐音 ? ` 谐音:${e.谐音}` : e.元素 ? ` 元素:${e.元素}` : e.表面 ? ` 表面:${e.表面}→暗藏:${e.暗藏}` : '';
        lines.push(`  ${e.name}${extra} — ${e.解析}`);
    }

    lines.push('');
    lines.push(`强度: ${level} (${(style.intensity || {})[level] || ''})`);
    lines.push(`适用题材: ${(style.applicableGenres || []).join('、')}`);

    return lines.join('\n');
}

function buildReviewBlock(namingStyleId, intensity) {
    const style = get(namingStyleId);
    if (!style) return '';

    const lines = [];
    lines.push(`【命名规范审核·${style.label}】`);
    lines.push(`检查新角色的命名是否符合"${style.label}"规范:`);
    lines.push(`1. 姓氏是否从姓氏池中选取或符合风格`);
    lines.push(`2. 名字是否符合命名模式（${(style.givenNamePatterns || []).map(p => p.pattern).join('/')}）`);
    lines.push(`3. 名字是否违反禁止模式`);
    lines.push(`4. 姓名组合是否符合组合规则`);
    if (style.forbiddenPatterns && style.forbiddenPatterns.length > 0) {
        lines.push(`5. 绝对禁止: ${style.forbiddenPatterns.join('; ')}`);
    }
    lines.push(`如果命名不符合规范，在审核中指出并建议替代名。`);

    return lines.join('\n');
}

function buildCombinedPromptBlock(projectId) {
    const store = require('../store');
    const project = store.getItem('projects', projectId);
    if (!project) return '';

    const materials = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
    const charactersWithStyle = materials.filter(m => m.type === 'character' && m.namingStyle);

    const projectNamingStyle = project.styleProfile?.namingStyle;
    const projectNamingIntensity = project.styleProfile?.namingStyleIntensity || 'medium';

    if (charactersWithStyle.length === 0) {
        if (projectNamingStyle) {
            return buildPromptBlock(projectNamingStyle, projectNamingIntensity);
        }
        const genre = project.genre || project.styleProfile?.genre || '';
        const autoStyle = inferFromGenre(genre);
        if (autoStyle) {
            return buildPromptBlock(autoStyle.id, 'medium');
        }
        return '';
    }

    const blocks = [];
    if (projectNamingStyle) {
        const block = buildPromptBlock(projectNamingStyle, projectNamingIntensity);
        if (block) blocks.push(`项目级命名规范:\n${block}`);
    }
    for (const ch of charactersWithStyle) {
        const block = buildPromptBlock(ch.namingStyle, ch.namingStyleIntensity || 'medium');
        if (block) blocks.push(`角色"${ch.name}"的命名规范:\n${block}`);
    }

    return blocks.length > 0 ? blocks.join('\n\n---\n\n') : '';
}

function buildCombinedReviewBlock(projectId) {
    const store = require('../store');
    const project = store.getItem('projects', projectId);
    if (!project) return '';

    const materials = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
    const charactersWithStyle = materials.filter(m => m.type === 'character' && m.namingStyle);

    const projectNamingStyle = project.styleProfile?.namingStyle;
    const projectNamingIntensity = project.styleProfile?.namingStyleIntensity || 'medium';

    if (charactersWithStyle.length === 0) {
        if (projectNamingStyle) {
            return buildReviewBlock(projectNamingStyle, projectNamingIntensity);
        }
        const genre = project.genre || project.styleProfile?.genre || '';
        const autoStyle = inferFromGenre(genre);
        if (autoStyle) {
            return buildReviewBlock(autoStyle.id, 'medium');
        }
        return '';
    }

    const blocks = [];
    if (projectNamingStyle) {
        const block = buildReviewBlock(projectNamingStyle, projectNamingIntensity);
        if (block) blocks.push(block);
    }
    for (const ch of charactersWithStyle) {
        const block = buildReviewBlock(ch.namingStyle, ch.namingStyleIntensity || 'medium');
        if (block) blocks.push(block);
    }

    return blocks.length > 0 ? blocks.join('\n\n') : '';
}

function inferFromGenre(genre) {
    if (!genre) return null;
    const genreMap = {
        '高武': 'poetic-imagery',
        '玄幻': 'net-abstract',
        '仙侠': 'myth-reincarnate',
        '武侠': 'jianghu-epithet',
        '都市': 'minimalist-cool',
        '赛博': 'cyber-codename',
        '末世': 'cyber-codename',
        '废土': 'cyber-codename',
        '喜剧': 'pun-homophone',
        '反套路': 'pun-homophone',
        '暗黑': 'dark-abyss',
        '恐怖': 'dark-abyss',
        '规则怪谈': 'dark-abyss',
        '二次元': 'japanese-anime',
        '轻小说': 'japanese-anime',
        '权谋': 'double-entendre',
        '宫斗': 'double-entendre',
        '农村': 'earthy-grounded',
        '年代': 'earthy-grounded',
        '异能': 'element-fusion',
        '魔法': 'element-fusion'
    };
    for (const [key, styleId] of Object.entries(genreMap)) {
        if (genre.includes(key)) return get(styleId);
    }
    return null;
}

function reload() { load(); return styles.size; }

module.exports = { list, get, buildPromptBlock, buildReviewBlock, buildCombinedPromptBlock, buildCombinedReviewBlock, inferFromGenre, reload };
