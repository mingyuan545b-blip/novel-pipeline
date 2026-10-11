'use strict';
/** 30_naming_craft.js <projectId> — 取名标准性 + 人物设计（工艺）质量 体检（只读） */
const { Checker, out, readId } = require('./_lib');
const { q, end } = require('./_db');
const namingSpec = require('../../server/services/namingQualitySpec');
const { validateQuotes } = require('../../server/services/validateQuotes');
const { validateHighlights } = require('../../server/services/validateHighlights');
const { validateCatchphrases } = require('../../server/services/validateCatchphrases');
const { isWeakCharisma, CHARISMA_FORM_RE } = require('../../server/services/craftTargets');

const pid = process.argv[2] || readId();
const parseData = (x) => (x == null ? {} : (typeof x === 'string' ? JSON.parse(x) : x));
(async () => {
    const proj = await q('SELECT data FROM projects WHERE id=$1', [pid]);
    const pdata = parseData(proj[0] && proj[0].data);
    const eraKey = namingSpec.inferEraKey(pdata.genre || '');
    const ents = await q("SELECT id,name,rolelevel,data FROM entities WHERE projectid=$1 AND entitytype='character'", [pid]);

    const c = new Checker('取名标准性 + 人物设计（工艺）');
    const nameRows = [], craftRows = [];
    for (const e of ents) {
        const d = parseData(e.data);
        const nr = namingSpec.validateName(e.name, eraKey);
        nameRows.push({ name: e.name, role: e.rolelevel, valid: nr.valid, issues: nr.issues });
        const quotes = validateQuotes(d.quoteLibrary || []);
        const highlights = validateHighlights(d.highlightScenes || []);
        const catchs = validateCatchphrases(d.catchphrases || []);
        const craft = {
            name: e.name, role: e.rolelevel,
            charisma: !isWeakCharisma(d.charisma), charismaFormOk: !!d.charisma && CHARISMA_FORM_RE.test(String(d.charisma)),
            philosophy: !!d.philosophy, entranceDesign: !!d.entranceDesign,
            quotes: quotes.passed, highlights: highlights.passed, catchphrases: catchs.passed,
            motive: !!(d.profile && (d.profile.desire || d.profile.motivation || d.profile.fear)),
        };
        craftRows.push(craft);
    }
    // 取名
    const badNames = nameRows.filter(r => !r.valid);
    c.add('取名：无禁用/流水线名', badNames.length === 0, badNames.map(b => b.name + ':' + b.issues.join('；')).join(' | '));
    // 名字唯一
    const nameSet = new Set(nameRows.map(r => r.name));
    c.add('取名：项目内无重名', nameSet.size === nameRows.length, `${nameSet.size}/${nameRows.length}`);
    // 人物设计：主角+关键角色四件套
    const mainRoles = craftRows.filter(r => ['protagonist', 'key-supporting'].includes(r.role));
    const mainOk = mainRoles.filter(r => r.charisma && r.philosophy && r.entranceDesign && r.quotes > 0 && r.highlights > 0);
    c.add('人物设计：主角/关键配角 工艺四件套齐（魅力+哲学+出场+金句+高光）', mainRoles.length > 0 && mainOk.length === mainRoles.length,
        `${mainOk.length}/${mainRoles.length} 达标`);
    const anyHighlight = craftRows.filter(r => r.highlights > 0).length;
    c.add('人物设计：至少半数角色有合格高光', anyHighlight >= Math.ceil(craftRows.length / 2), `${anyHighlight}/${craftRows.length}`);
    const charismaForm = craftRows.filter(r => r.charismaFormOk).length;
    c.add('人物设计：魅力写成"当X时宁可Y也不Z"句式', charismaForm > 0, `${charismaForm}/${craftRows.length}`);

    console.log('\n取名明细：');
    for (const r of nameRows) console.log(`  ${r.valid ? '✅' : '❌'} ${r.name} (${r.role || '-'})${r.valid ? '' : ' — ' + r.issues.join('；')}`);
    console.log('\n工艺明细：');
    for (const r of craftRows) console.log(`  ${r.name} (${r.role}) 魅力=${r.charisma ? 'Y' : 'N'} 句式=${r.charismaFormOk ? 'Y' : 'N'} 哲学=${r.philosophy ? 'Y' : 'N'} 出场=${r.entranceDesign ? 'Y' : 'N'} 金句=${r.quotes} 高光=${r.highlights} 口头禅=${r.catchphrases} 动机=${r.motive ? 'Y' : 'N'}`);

    const rep = c.report();
    out('30_naming_craft.json', { projectId: pid, eraKey, names: nameRows, craft: craftRows, summary: rep });
    await end();
    process.exit(rep.pass === rep.total ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
