const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

let errors = 0;
let warnings = 0;
let checks = 0;

function fail(msg) { console.error(`  ❌ FAIL: ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠️  WARN: ${msg}`); warnings++; }
function pass(msg) { console.log(`  ✅ PASS: ${msg}`); }
function section(title) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'═'.repeat(60)}`);
}

function readFile(relPath) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, 'utf-8');
}

function readDir(relPath) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs);
}

function getStats() { return { errors, warnings, checks }; }
function addCheck() { checks++; return checks; }

module.exports = { fail, warn, pass, section, readFile, readDir, getStats, addCheck, ROOT };
