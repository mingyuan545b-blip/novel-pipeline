/**
 * coverage-summary.js — 生成覆盖率摘要
 * 读取coverage/coverage-final.json，输出整体和按目录的覆盖率统计
 */
const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.join(__dirname, '..', 'coverage', 'coverage-final.json');

function main() {
    if (!fs.existsSync(COVERAGE_FILE)) {
        console.error('❌ coverage-final.json not found. Run: npx jest --coverage');
        process.exit(1);
    }

    const coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));

    let totalStmts = 0, coveredStmts = 0;
    let totalBranches = 0, coveredBranches = 0;
    let totalFuncs = 0, coveredFuncs = 0;

    const byDir = {};

    for (const filePath of Object.keys(coverage)) {
        const data = coverage[filePath];
        if (!data) continue;

        const relPath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
        const dirParts = relPath.split('/');
        const dir = dirParts.slice(0, 3).join('/');

        if (!byDir[dir]) byDir[dir] = { stmts: 0, coveredStmts: 0, branches: 0, coveredBranches: 0, funcs: 0, coveredFuncs: 0, files: 0 };

        byDir[dir].files++;

        if (data.s) {
            const stmtKeys = Object.keys(data.s);
            totalStmts += stmtKeys.length;
            byDir[dir].stmts += stmtKeys.length;
            for (const k of stmtKeys) {
                if (data.s[k] > 0) {
                    coveredStmts++;
                    byDir[dir].coveredStmts++;
                }
            }
        }

        if (data.b) {
            for (const branchKey of Object.keys(data.b)) {
                const branchArr = data.b[branchKey];
                totalBranches += branchArr.length;
                byDir[dir].branches += branchArr.length;
                for (const count of branchArr) {
                    if (count > 0) {
                        coveredBranches++;
                        byDir[dir].coveredBranches++;
                    }
                }
            }
        }

        if (data.f) {
            const funcKeys = Object.keys(data.f);
            totalFuncs += funcKeys.length;
            byDir[dir].funcs += funcKeys.length;
            for (const k of funcKeys) {
                if (data.f[k] > 0) {
                    coveredFuncs++;
                    byDir[dir].coveredFuncs++;
                }
            }
        }
    }

    console.log('=== COVERAGE SUMMARY ===\n');
    console.log('Overall:');
    console.log(`  Statements: ${coveredStmts}/${totalStmts} = ${(coveredStmts / totalStmts * 100).toFixed(1)}%`);
    console.log(`  Branches:   ${coveredBranches}/${totalBranches} = ${(coveredBranches / totalBranches * 100).toFixed(1)}%`);
    console.log(`  Functions:  ${coveredFuncs}/${totalFuncs} = ${(coveredFuncs / totalFuncs * 100).toFixed(1)}%`);
    console.log('');

    console.log('By Directory (sorted by statement coverage):');
    console.log('Directory'.padEnd(50) + 'Stmts%'.padStart(10) + 'Branch%'.padStart(10) + 'Funcs%'.padStart(10) + 'Files'.padStart(8));
    console.log('-'.repeat(88));

    const dirs = Object.entries(byDir).sort((a, b) => {
        const aRate = a[1].stmts > 0 ? a[1].coveredStmts / a[1].stmts : 0;
        const bRate = b[1].stmts > 0 ? b[1].coveredStmts / b[1].stmts : 0;
        return aRate - bRate;
    });

    for (const [dir, d] of dirs) {
        const stmtRate = d.stmts > 0 ? (d.coveredStmts / d.stmts * 100).toFixed(1) : '0.0';
        const branchRate = d.branches > 0 ? (d.coveredBranches / d.branches * 100).toFixed(1) : '0.0';
        const funcRate = d.funcs > 0 ? (d.coveredFuncs / d.funcs * 100).toFixed(1) : '0.0';
        console.log(dir.padEnd(50) + (stmtRate + '%').padStart(10) + (branchRate + '%').padStart(10) + (funcRate + '%').padStart(10) + String(d.files).padStart(8));
    }
}

main();
