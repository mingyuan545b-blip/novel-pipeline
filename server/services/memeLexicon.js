const fs = require('fs');
const path = require('path');

const MEME_DIR = path.join(__dirname, '../../data/meme-lexicon');
const HUMOR_DIR = path.join(__dirname, '../../data/humor-devices');

let memeEntries = new Map();
let humorDevices = new Map();

function load() {
    memeEntries.clear();
    humorDevices.clear();

    if (!fs.existsSync(MEME_DIR)) return 0;
    const memeFiles = fs.readdirSync(MEME_DIR).filter(f => f.endsWith('.json'));
    for (const file of memeFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(MEME_DIR, file), 'utf8'));
            memeEntries.set(data.id, data);
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    }

    if (!fs.existsSync(HUMOR_DIR)) return 0;
    const humorFiles = fs.readdirSync(HUMOR_DIR).filter(f => f.endsWith('.json'));
    for (const file of humorFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(HUMOR_DIR, file), 'utf8'));
            humorDevices.set(data.id, data);
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    }

    return { memes: memeEntries.size, devices: humorDevices.size };
}

function listMemes() { return Array.from(memeEntries.values()); }
function listDevices() { return Array.from(humorDevices.values()); }
function getMeme(id) { return memeEntries.get(id) || null; }
function getDevice(id) { return humorDevices.get(id) || null; }

function buildWriterPrompt(projectId) {
    const store = require('../store');
    const project = store.getItem('projects', projectId);
    if (!project) return '';

    const genre = project.genre || project.styleProfile?.genre || '';
    const parts = [];

    const applicableMemes = listMemes();
    for (const meme of applicableMemes) {
        if (meme.applicableGenres && !meme.applicableGenres.some(g => genre.includes(g))) continue;
        const entries = meme.entries || [];
        if (entries.length === 0) continue;

        parts.push(`【${meme.label}】`);
        parts.push(`${meme.description}`);
        for (const entry of entries) {
            const e = entry;
            if (e.quote) {
                parts.push(`- "${e.quote}"（${e.source}）：${e.triggerScene}。${e.buildupRule}。每${e.densityLimit?.match(/\d+/)?.[0] || 5}章最多1次`);
            } else if (e.signaturePatterns) {
                parts.push(`- ${e.label}：${e.description}`);
                parts.push(`  句式：${e.signaturePatterns.join('；')}`);
                parts.push(`  触发：${e.triggerScene}。${e.buildupRule}。每${e.densityLimit?.match(/\d+/)?.[0] || 10}章最多1次`);
            } else if (e.templates) {
                parts.push(`- ${e.label}：${e.description}`);
                parts.push(`  模板：${e.templates.join('；')}`);
                parts.push(`  示例：${(e.examples || []).join('；')}`);
            }
        }
        if (meme.globalRules?.forbidden) {
            parts.push(`  禁忌：${meme.globalRules.forbidden.join('；')}`);
        }
    }

    const applicableDevices = listDevices();
    for (const device of applicableDevices) {
        if (device.applicableGenres && !device.applicableGenres.some(g => genre.includes(g))) continue;
        const devs = device.devices || device.rules || [];
        if (devs.length === 0) continue;

        parts.push(`\n【${device.label}】`);
        parts.push(`${device.description}`);
        for (const d of devs) {
            if (d.writerRule) {
                parts.push(`- ${d.label}：${d.writerRule}`);
            } else if (d.pattern) {
                parts.push(`- ${d.label}：${d.pattern}`);
                parts.push(`  铺垫：${d.buildup}`);
                parts.push(`  密度：${d.densityLimit}`);
            }
        }
        if (device.globalRules?.forbidden) {
            parts.push(`  禁忌：${device.globalRules.forbidden.join('；')}`);
        }
        if (device.densityGuide) {
            parts.push(`  密度指南：${Object.entries(device.densityGuide).map(([k, v]) => `${k}→${v}`).join('；')}`);
        }
    }

    return parts.length > 0 ? parts.join('\n') : '';
}

function buildReviewerPrompt(projectId) {
    const store = require('../store');
    const project = store.getItem('projects', projectId);
    if (!project) return '';

    const genre = project.genre || project.styleProfile?.genre || '';
    const parts = [];

    parts.push('【幽默审核规则】');
    parts.push('幽默审核以场景适配度和角色一致性为准，不以固定标准一刀切：');

    const applicableDevices = listDevices();
    for (const device of applicableDevices) {
        if (device.applicableGenres && !device.applicableGenres.some(g => genre.includes(g))) continue;
        const devs = device.devices || device.rules || [];
        for (const d of devs) {
            if (d.reviewRule) {
                parts.push(`- ${d.label}：${d.reviewRule}`);
            }
        }
    }

    const applicableMemes = listMemes();
    for (const meme of applicableMemes) {
        if (meme.globalRules?.forbidden) {
            parts.push(`- ${meme.label}禁忌：${meme.globalRules.forbidden.join('；')}`);
        }
    }

    parts.push('\n冲突消解规则：');
    parts.push('1. 角色有说话风格设定时，幽默方式必须符合风格');
    parts.push('2. 悲伤/牺牲/告别场景零幽默是铁律');
    parts.push('3. 幽默密度每2000字不超过4个笑点');
    parts.push('4. 有铺垫的笑点不算突兀');
    parts.push('5. 以上都通过→幽默合规，不得以"幽默过度"打回');

    return parts.join('\n');
}

function reload() {
    const result = load();
    return result;
}

load();

module.exports = { listMemes, listDevices, getMeme, getDevice, buildWriterPrompt, buildReviewerPrompt, reload };
