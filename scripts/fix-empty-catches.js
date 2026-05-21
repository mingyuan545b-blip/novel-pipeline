const fs = require('fs');
const path = require('path');

let totalFixed = 0;

function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') processDir(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) {
            let content = fs.readFileSync(full, 'utf-8');
            const original = content;
            content = content.replace(/catch\s*\(\s*(_+)\s*\)\s*\{\s*\}/g, (match, varName) => {
                return `catch(${varName}) { console.warn('[SILENT-CATCH]', ${varName}.message || ${varName}); }`;
            });
            if (content !== original) {
                const count = (original.match(/catch\s*\(\s*_+\s*\)\s*\{\s*\}/g) || []).length;
                totalFixed += count;
                fs.writeFileSync(full, content, 'utf-8');
                console.log(`Fixed ${count} in ${path.relative(process.cwd(), full)}`);
            }
        }
    }
}

processDir(path.join(__dirname, '..', 'server'));
console.log(`Total fixed: ${totalFixed}`);
