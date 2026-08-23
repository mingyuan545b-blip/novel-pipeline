const fs = require('fs');
const path = require('path');

const MAX_LINES = 200;

function extractCodeBlock(srcContent, key) {
    const startMarker = `${key}: {`;
    const startIdx = srcContent.indexOf(startMarker);
    if (startIdx === -1) return null;
    let depth = 0;
    let i = srcContent.indexOf('{', startIdx);
    for (; i < srcContent.length; i++) {
        if (srcContent[i] === '{') depth++;
        if (srcContent[i] === '}') depth--;
        if (depth === 0) break;
    }
    return srcContent.slice(srcContent.indexOf('{', startIdx), i + 1);
}

function extractMethods(objCode) {
    const methods = [];
    const inner = objCode.slice(1, -1).trim();
    let pos = 0;
    while (pos < inner.length) {
        while (pos < inner.length && /[\s,\n]/.test(inner[pos])) pos++;
        if (pos >= inner.length) break;
        const nameStart = pos;
        while (pos < inner.length && /[\w]/.test(inner[pos])) pos++;
        const name = inner.slice(nameStart, pos);
        if (!name || ['const','let','var','if','for','while','return','function'].includes(name)) {
            const nlIdx = inner.indexOf('\n', pos);
            if (nlIdx === -1) break;
            pos = nlIdx + 1;
            continue;
        }
        let braceStart = -1, hasArrow = false, scanPos = pos, parenDepth = 0;
        for (; scanPos < inner.length; scanPos++) {
            const ch = inner[scanPos];
            if (ch === '(') { parenDepth++; continue; }
            if (ch === ')') { parenDepth--; continue; }
            if (parenDepth === 0) {
                if (ch === '{') { braceStart = scanPos; break; }
                if (ch === '=' && inner[scanPos+1] === '>') { hasArrow = true; }
                if (ch === ',' || ch === '\n') break;
            }
        }
        if (braceStart !== -1) {
            let depth = 0, braceEnd = braceStart;
            for (let j = braceStart; j < inner.length; j++) {
                if (inner[j] === '{') depth++;
                if (inner[j] === '}') depth--;
                if (depth === 0) { braceEnd = j; break; }
            }
            methods.push({ name, code: inner.slice(nameStart, braceEnd + 1).trim() });
            pos = braceEnd + 1;
        } else if (hasArrow) {
            let arrowPos = inner.indexOf('=>', pos);
            if (arrowPos !== -1) {
                let exprStart = arrowPos + 2;
                while (exprStart < inner.length && inner[exprStart] === ' ') exprStart++;
                if (inner[exprStart] === '(' || inner[exprStart] === '{') {
                    const openCh = inner[exprStart];
                    const closeCh = openCh === '(' ? ')' : '}';
                    let depth = 0, exprEnd = exprStart;
                    for (let j = exprStart; j < inner.length; j++) {
                        if (inner[j] === openCh) depth++;
                        if (inner[j] === closeCh) depth--;
                        if (depth === 0) { exprEnd = j; break; }
                    }
                    methods.push({ name, code: inner.slice(nameStart, exprEnd + 1).trim() });
                    pos = exprEnd + 1;
                } else {
                    let exprEnd = exprStart;
                    while (exprEnd < inner.length && inner[exprEnd] !== ',' && inner[exprEnd] !== '\n') exprEnd++;
                    methods.push({ name, code: inner.slice(nameStart, exprEnd).trim() });
                    pos = exprEnd;
                }
            } else {
                const nlIdx = inner.indexOf('\n', pos);
                if (nlIdx === -1) break;
                pos = nlIdx + 1;
            }
        } else {
            let commaIdx = inner.indexOf(',', pos);
            if (commaIdx === -1) break;
            pos = commaIdx + 1;
        }
    }
    return methods;
}

function fixSelfRefs(code) {
    let fixed = code;
    fixed = fixed.replace(/const _self = this;\n/g, '');
    fixed = fixed.replace(/_self\.detectors\./g, 'detectors.');
    fixed = fixed.replace(/_self\.detectors(?!\w)/g, 'detectors');
    fixed = fixed.replace(/_self\.perspective/g, 'perspective');
    fixed = fixed.replace(/_self\.qualityChecks/g, 'qualityChecks');
    fixed = fixed.replace(/_self\.techJargon/g, 'techJargon');
    fixed = fixed.replace(/_self\.(\w+)/g, 'genre.$1');
    fixed = fixed.replace(/this\.detectors\./g, 'detectors.');
    fixed = fixed.replace(/this\.detectors(?!\w)/g, 'detectors');
    fixed = fixed.replace(/this\.qualityChecks/g, 'qualityChecks');
    fixed = fixed.replace(/this\.perspective/g, 'perspective');
    fixed = fixed.replace(/this\.(\w+)/g, 'genre.$1');
    return fixed;
}

function generateImports(code, dirPath, isInterceptor) {
    let imports = '';
    if (isInterceptor) imports += `const detectors = require('./detectors');\n`;
    if (code.includes('perspective') && !isInterceptor) {
        if (fs.existsSync(path.join(dirPath, 'perspectiveConfig.js'))) {
            imports += `const perspective = require('./perspectiveConfig');\n`;
        } else {
            imports += `const config = require('./config');\nconst perspective = config.perspective;\n`;
        }
    }
    if (code.includes('qualityChecks')) imports += `const { qualityChecks } = require('./qualityChecks');\n`;
    if (code.includes('techJargon')) {
        if (!imports.includes('require(\'./config\')')) imports += `const config = require('./config');\n`;
        imports += `const techJargon = config.techJargon;\n`;
    }
    if (code.includes('genre.') && !imports.includes('require(\'./config\')')) imports += `const config = require('./config');\n`;
    if (code.includes('genre.')) imports += `const genre = config;\n`;
    return imports;
}

module.exports = { extractCodeBlock, extractMethods, fixSelfRefs, generateImports, MAX_LINES };
