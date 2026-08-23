const fs = require('fs');
const path = require('path');
const { fail, warn, pass, section, readFile, readDir, addCheck, ROOT } = require('./checkUtils');

function checkTestCoverage() {
    section('7. 测试覆盖检查');

    addCheck();
    const testDir = path.join(ROOT, 'tests');
    if (fs.existsSync(testDir)) {
        const unitTests = readDir('tests/unit').filter(f => f.endsWith('.test.js'));
        const integrationTests = readDir('tests/integration').filter(f => f.endsWith('.test.js'));
        const coreTests = fs.existsSync(path.join(testDir, 'core.test.js')) ? 1 : 0;
        const totalTests = unitTests.length + integrationTests.length + coreTests;
        if (totalTests >= 10) { pass(`测试文件: ${totalTests}个 (unit:${unitTests.length} integration:${integrationTests.length} core:${coreTests})`); }
        else { warn(`测试文件偏少: ${totalTests}个，核心逻辑缺乏测试保护`); }
    } else {
        fail('tests目录不存在！无任何测试覆盖');
    }

    addCheck();
    const packageJson = JSON.parse(readFile('package.json') || '{}');
    if (packageJson.scripts && packageJson.scripts.test) { pass(`package.json 有test命令: ${packageJson.scripts.test}`); }
    else { fail('package.json 缺少test命令'); }
    if (packageJson.scripts && packageJson.scripts.check) { pass(`package.json 有check命令: ${packageJson.scripts.check}`); }
    else { warn('package.json 缺少check命令（建议添加自检脚本）'); }
}

function checkTypeSync() {
    section('8. 类型同步检查（三处同步铁律）');

    addCheck();
    const materialTypesConfig = readFile('server/config/materialTypes.js');
    if (materialTypesConfig) {
        const validTypesMatch = materialTypesConfig.match(/VALID_MATERIAL_TYPES\s*=\s*\[([\s\S]*?)\]/);
        if (validTypesMatch) {
            const typesInConfig = validTypesMatch[1].match(/'([^']+)'/g);
            if (typesInConfig && typesInConfig.length >= 28) { pass(`materialTypes.js 定义了${typesInConfig.length}种素材类型`); }
            else { warn(`materialTypes.js 素材类型数量: ${typesInConfig ? typesInConfig.length : 0}（预期28+）`); }
        }
    }

    addCheck();
    const materialsRouteContent = readFile('server/routes/materials.js');
    if (materialsRouteContent) {
        if (materialsRouteContent.includes('MATERIAL_TYPES')) { pass('materials.js 路由引用了MATERIAL_TYPES'); }
        else { warn('materials.js 路由可能硬编码了素材类型列表'); }
    }
}

function checkIpViolations() {
    section('9. IP直呼检查');

    addCheck();
    const ipNames = ['灰太狼', '喜羊羊', '哆啦A梦', '路飞', '孙悟空', '七龙珠', '海贼王', '奥特曼', '恶魔果实', '仙豆', '竹蜻蜓', '念能力'];
    let ipViolations = [];
    const dataDir = path.join(ROOT, 'data');
    const subplaneDir = path.join(dataDir, 'subplanes');
    if (fs.existsSync(subplaneDir)) {
        const subplaneFiles = fs.readdirSync(subplaneDir).filter(f => f.endsWith('.json'));
        for (const sf of subplaneFiles) {
            const content = fs.readFileSync(path.join(subplaneDir, sf), 'utf-8');
            for (const ip of ipNames) { if (content.includes(ip)) { ipViolations.push(`${sf}: ${ip}`); } }
        }
    }
    if (ipViolations.length > 0) { fail(`次位面数据存在IP直呼: ${ipViolations.join('; ')}`); }
    else { pass('次位面数据无IP直呼违规'); }
}

function checkProtagonistHardcode() {
    section('10. 主角名硬编码检查');

    addCheck();
    let hardcodedProtagonistNames = [];
    const pipelineFiles = ['server/services/pipeline/steps/materialManager.js', 'server/services/pipeline/fullPipeline.js'];
    for (const pf of pipelineFiles) {
        const content = readFile(pf);
        if (!content) continue;
        if (content.includes('"沈渡"') || content.includes("'沈渡'") || content.includes('沈渡')) {
            if (!content.includes('protagonistName')) { hardcodedProtagonistNames.push(pf); }
        }
    }
    if (hardcodedProtagonistNames.length > 0) { fail(`主角名硬编码: ${hardcodedProtagonistNames.join(', ')}`); }
    else { pass('无主角名硬编码'); }
}

module.exports = { checkTestCoverage, checkTypeSync, checkIpViolations, checkProtagonistHardcode };
