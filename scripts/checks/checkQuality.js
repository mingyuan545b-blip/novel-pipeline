const { fail, warn, pass, section, readFile, addCheck } = require('./checkUtils');

function checkCodeQuality() {
    section('4. 代码质量检查');

    addCheck();
    const fullPipeline = readFile('server/services/pipeline/fullPipeline.js');
    if (fullPipeline) {
        const bareCatchCount = (fullPipeline.match(/catch\s*\(\s*_\s*\)/g) || []).length;
        if (bareCatchCount > 10) { warn(`fullPipeline.js 有${bareCatchCount}个空catch(_)，错误可能被吞掉`); }
        else { pass(`fullPipeline.js 空catch数量: ${bareCatchCount}`); }
    }

    addCheck();
    const materialManager = readFile('server/services/pipeline/steps/materialManager.js');
    if (materialManager) {
        const intensityMapCount = (materialManager.match(/intensityMap/g) || []).length;
        if (intensityMapCount > 3) { warn(`materialManager.js intensityMap重复${intensityMapCount}次，应提取为通用函数`); }
        else { pass('materialManager.js intensityMap重复度可接受'); }
        const lineCount = materialManager.split('\n').length;
        if (lineCount > 600) { warn(`materialManager.js ${lineCount}行，建议拆分为子模块`); }
        else { pass('materialManager.js 行数合理'); }
    }

    addCheck();
    const infinitePipeline = readFile('server/services/pipeline/infinitePipeline.js');
    if (infinitePipeline) {
        if (infinitePipeline.includes('INFINITE_PIPELINE_STATE') && infinitePipeline.includes('delete INFINITE_PIPELINE_STATE')) { pass('infinitePipeline.js 有内存状态清理机制'); }
        else { warn('infinitePipeline.js 内存状态清理可能不完整'); }
        if (infinitePipeline.includes('cleanupStalePipelineStates')) { pass('infinitePipeline.js 有僵尸进程清理'); }
        else { warn('infinitePipeline.js 缺少僵尸进程清理'); }
    }
}

function checkFoundationProtection() {
    section('5. 基底素材保护检查');

    addCheck();
    const jsonStoreContent = readFile('server/db/jsonStore.js');
    const dbStoreContent = readFile('server/db/store.js');
    let hasFoundationProtection = false;
    if (jsonStoreContent && jsonStoreContent.includes('isFoundationMaterial') && jsonStoreContent.includes('Blocked deletion of foundation material')) { hasFoundationProtection = true; }
    if (dbStoreContent && dbStoreContent.includes('isFoundationMaterial') && dbStoreContent.includes('Blocked deletion of foundation material')) { hasFoundationProtection = true; }
    if (hasFoundationProtection) { pass('存储层有基底素材删除保护'); }
    else { fail('存储层缺少基底素材删除保护！isFoundationMaterial检查缺失'); }

    addCheck();
    const materialsRoute = readFile('server/routes/materials.js');
    if (materialsRoute) {
        if (materialsRoute.includes('isFoundationMaterial')) { pass('素材路由有基底素材删除保护'); }
        else { warn('素材路由可能缺少基底素材删除保护'); }
    }
}

function checkDataIntegrity() {
    const fs = require('fs');
    const path = require('path');
    const { ROOT } = require('./checkUtils');

    section('6. 数据目录完整性检查');

    addCheck();
    const dataDir = path.join(ROOT, 'data');
    const requiredDirs = ['projects', 'materials', 'chapters', 'reviews', 'dialects', 'speech-styles'];
    const missingDirs = requiredDirs.filter(d => !fs.existsSync(path.join(dataDir, d)));
    if (missingDirs.length > 0) { warn(`数据目录缺失: ${missingDirs.join(', ')}（首次运行会自动创建）`); }
    else { pass('所有必需数据目录存在'); }

    addCheck();
    const dialectFiles = require('./checkUtils').readDir('data/dialects').filter(f => f.endsWith('.json'));
    if (dialectFiles.length >= 15) { pass(`方言数据文件: ${dialectFiles.length}个`); }
    else if (dialectFiles.length > 0) { warn(`方言数据文件偏少: ${dialectFiles.length}个（预期21个）`); }
    else { fail('方言数据目录为空'); }

    addCheck();
    const styleFiles = require('./checkUtils').readDir('data/speech-styles').filter(f => f.endsWith('.json'));
    if (styleFiles.length >= 10) { pass(`说话风格数据文件: ${styleFiles.length}个`); }
    else if (styleFiles.length > 0) { warn(`说话风格数据文件偏少: ${styleFiles.length}个（预期14个）`); }
    else { fail('说话风格数据目录为空'); }
}

module.exports = { checkCodeQuality, checkFoundationProtection, checkDataIntegrity };
