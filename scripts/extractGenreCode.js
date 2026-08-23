const fs = require('fs');
const path = require('path');
const { extractCodeBlock, fixSelfRefs, generateImports, MAX_LINES } = require('./genreExtractCore');
const { writeCodeFile, updateIndexJs } = require('./genreExtractWriter');

const GENRES_DIR = path.join(__dirname, 'server', 'services', 'genres');

function processGenre(genreId) {
    const srcFile = path.join(GENRES_DIR, `${genreId}.js`);
    const destDir = path.join(GENRES_DIR, genreId);
    if (!fs.existsSync(srcFile) || !fs.existsSync(destDir)) return;

    console.log(`\n=== Processing ${genreId} ===`);
    delete require.cache[require.resolve(srcFile)];
    const genre = require(srcFile);
    const srcContent = fs.readFileSync(srcFile, 'utf8');

    if (genre.detectors) {
        const detCode = extractCodeBlock(srcContent, 'detectors');
        if (detCode) {
            const fixedCode = fixSelfRefs(detCode);
            const imports = generateImports(fixedCode, destDir, false);
            writeCodeFile(destDir, genreId, 'detectors', fixedCode, imports);
        }
    }

    if (genre.interceptors) {
        const intCode = extractCodeBlock(srcContent, 'interceptors');
        if (intCode) {
            const fixedCode = fixSelfRefs(intCode);
            const imports = generateImports(fixedCode, destDir, true);
            writeCodeFile(destDir, genreId, 'interceptors', fixedCode, imports);
        }
    }

    updateIndexJs(destDir, genreId, genre);
}

const args = process.argv.slice(2);
const genreIds = args.includes('--all')
    ? fs.readdirSync(GENRES_DIR)
        .filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'baseGenreTemplate.js' && f !== 'genrePluginSpec.js')
        .map(f => f.replace('.js', ''))
    : args;

for (const id of genreIds) processGenre(id);

console.log('\n=== Verification ===');
const gc = require(path.join(GENRES_DIR, '..', 'genreConfig'));
let passCount = 0, failCount = 0;
for (const g of gc.GENRE_REGISTRY) {
    const detCount = Object.keys(g.detectors || {}).length;
    const intCount = Object.keys(g.interceptors || {}).length;
    if (detCount > 0) { console.log(`  ✅ ${g.id}: detectors=${detCount} interceptors=${intCount}`); passCount++; }
    else { console.log(`  ❌ ${g.id}: NO DETECTORS`); failCount++; }
}
console.log(`\nResult: ${passCount} passed, ${failCount} failed`);

const dirs = fs.readdirSync(GENRES_DIR).filter(e => fs.statSync(path.join(GENRES_DIR, e)).isDirectory());
let overLimit = [];
for (const dir of dirs) {
    const dirPath = path.join(GENRES_DIR, dir);
    for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.js'))) {
        const lines = fs.readFileSync(path.join(dirPath, f), 'utf8').split('\n').length;
        if (lines > MAX_LINES) overLimit.push(`${dir}/${f}: ${lines}`);
    }
}
console.log(overLimit.length === 0 ? 'ALL FILES UNDER 200 LINES ✅' : 'FILES OVER LIMIT:');
overLimit.forEach(f => console.log(`  ⚠️ ${f}`));
