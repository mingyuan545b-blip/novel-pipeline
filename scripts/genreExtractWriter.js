const fs = require('fs');
const path = require('path');
const { extractMethods, MAX_LINES } = require('./genreExtractCore');

function writeCodeFile(dirPath, genreId, baseName, code, imports) {
    const header = `/**\n * ${genreId}/${baseName}.js\n */\n${imports}\nmodule.exports = ${code};\n`;
    const lines = header.split('\n').length;

    if (lines <= MAX_LINES) {
        fs.writeFileSync(path.join(dirPath, `${baseName}.js`), header, 'utf8');
        console.log(`  ${baseName}.js: ${lines} lines ✅`);
        return;
    }

    const methods = extractMethods(code);
    console.log(`  ${baseName} has ${methods.length} methods, needs splitting`);

    const importLines = imports.split('\n').length + 6;
    const files = [];
    let currentFile = { methods: [], lines: importLines };

    for (const method of methods) {
        const methodLines = method.code.split('\n').length + 2;
        if (currentFile.lines + methodLines > MAX_LINES && currentFile.methods.length > 0) {
            files.push(currentFile);
            currentFile = { methods: [], lines: importLines };
        }
        currentFile.methods.push(method);
        currentFile.lines += methodLines;
    }
    if (currentFile.methods.length > 0) files.push(currentFile);

    const allMethods = [];
    for (let i = 0; i < files.length; i++) {
        const suffix = i === 0 ? 'Core' : `Extra${i}`;
        const fileName = `${baseName}${suffix}.js`;
        const varName = i === 0 ? 'core' : `extra${i}`;

        let content = `/**\n * ${genreId}/${fileName}\n */\n${imports}\nmodule.exports = {\n`;
        for (const method of files[i].methods) {
            content += method.code + ',\n\n';
            allMethods.push({ name: method.name, varName });
        }
        content += '};\n';
        fs.writeFileSync(path.join(dirPath, fileName), content, 'utf8');
        console.log(`  ${fileName}: ${content.split('\n').length} lines`);
    }

    let entry = `/**\n * ${genreId}/${baseName}.js — 组合入口\n */\n`;
    const usedVarNames = [...new Set(allMethods.map(m => m.varName))];
    for (const vn of usedVarNames) {
        const idx = usedVarNames.indexOf(vn);
        const suffix = idx === 0 ? 'Core' : `Extra${idx}`;
        entry += `const ${vn} = require('./${baseName}${suffix}');\n`;
    }
    entry += `\nmodule.exports = {\n`;
    for (const m of allMethods) entry += `    ${m.name}: ${m.varName}.${m.name},\n`;
    entry += '};\n';
    fs.writeFileSync(path.join(dirPath, `${baseName}.js`), entry, 'utf8');
    console.log(`  ${baseName}.js: ${entry.split('\n').length} lines ✅ (combined)`);
}

function updateIndexJs(dirPath, genreId, genre) {
    const indexPath = path.join(dirPath, 'index.js');
    let content = fs.readFileSync(indexPath, 'utf8');
    content = content.replace(/const _src = require\('\.\.\/[^']+'\);\n/g, '');
    content = content.replace(/detectors: _src\.detectors,/g, 'detectors,');
    content = content.replace(/interceptors: _src\.interceptors,/g, 'interceptors,');
    if (!content.includes("require('./detectors')")) {
        content = content.replace('const parts = {', "const detectors = require('./detectors');\nconst parts = {");
    }
    if (genre.interceptors && !content.includes("require('./interceptors')")) {
        content = content.replace('const parts = {', "const interceptors = require('./interceptors');\nconst parts = {");
    }
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log(`  index.js: updated ✅`);
}

module.exports = { writeCodeFile, updateIndexJs };
