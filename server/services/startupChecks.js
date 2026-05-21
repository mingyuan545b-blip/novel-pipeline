const fs = require('fs');
const path = require('path');

const STARTUP_CHECKS = [];

function registerCheck(name, fn) {
    STARTUP_CHECKS.push({ name, fn });
}

function runStartupChecks() {
    const results = [];
    let hasCritical = false;

    for (const check of STARTUP_CHECKS) {
        try {
            const result = check.fn();
            results.push({ name: check.name, ...result });
            if (result.level === 'critical') hasCritical = true;
        } catch (e) {
            results.push({ name: check.name, level: 'critical', message: e.message });
            hasCritical = true;
        }
    }

    if (results.length > 0) {
        console.log(`\n${'═'.repeat(50)}`);
        console.log('  启动自检报告');
        console.log(`${'═'.repeat(50)}`);
        for (const r of results) {
            const icon = r.level === 'critical' ? '❌' : r.level === 'warning' ? '⚠️' : '✅';
            console.log(`  ${icon} ${r.name}: ${r.message}`);
        }
        console.log(`${'═'.repeat(50)}\n`);
    }

    return { results, hasCritical };
}

registerCheck('ENCRYPTION_SECRET', () => {
    if (!process.env.ENCRYPTION_SECRET) {
        return { level: 'warning', message: '未配置 → API Key明文存储' };
    }
    return { level: 'ok', message: '已配置' };
});

registerCheck('REQUEST_SECRET', () => {
    if (!process.env.REQUEST_SECRET) {
        return { level: 'warning', message: '未配置 → 每次重启生成随机token' };
    }
    return { level: 'ok', message: '已配置' };
});

registerCheck('数据目录', () => {
    const dataDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dataDir)) {
        return { level: 'critical', message: 'data目录不存在' };
    }
    const requiredDirs = ['projects', 'materials', 'chapters'];
    const missing = requiredDirs.filter(d => !fs.existsSync(path.join(dataDir, d)));
    if (missing.length > 0) {
        return { level: 'warning', message: `子目录缺失: ${missing.join(',')}（将自动创建）` };
    }
    return { level: 'ok', message: '完整' };
});

registerCheck('方言数据', () => {
    const dialectDir = path.join(__dirname, '..', '..', 'data', 'dialects');
    if (!fs.existsSync(dialectDir)) {
        return { level: 'warning', message: '方言目录不存在' };
    }
    const count = fs.readdirSync(dialectDir).filter(f => f.endsWith('.json')).length;
    if (count < 5) {
        return { level: 'warning', message: `方言文件仅${count}个（预期21个）` };
    }
    return { level: 'ok', message: `${count}个方言` };
});

registerCheck('说话风格数据', () => {
    const styleDir = path.join(__dirname, '..', '..', 'data', 'speech-styles');
    if (!fs.existsSync(styleDir)) {
        return { level: 'warning', message: '风格目录不存在' };
    }
    const count = fs.readdirSync(styleDir).filter(f => f.endsWith('.json')).length;
    if (count < 5) {
        return { level: 'warning', message: `风格文件仅${count}个（预期14个）` };
    }
    return { level: 'ok', message: `${count}个风格` };
});

registerCheck('素材类型注册', () => {
    try {
        const { VALID_MATERIAL_TYPES } = require('../config/materialTypes');
        if (VALID_MATERIAL_TYPES.length < 20) {
            return { level: 'critical', message: `素材类型仅${VALID_MATERIAL_TYPES.length}种（预期28+）` };
        }
        return { level: 'ok', message: `${VALID_MATERIAL_TYPES.length}种类型` };
    } catch (e) {
        return { level: 'critical', message: `加载失败: ${e.message}` };
    }
});

registerCheck('题材插件', () => {
    try {
        const genreConfig = require('./genreConfig');
        const plugins = genreConfig.getRegisteredPlugins ? genreConfig.getRegisteredPlugins() : [];
        if (plugins.length < 3) {
            return { level: 'warning', message: `仅${plugins.length}个插件注册` };
        }
        return { level: 'ok', message: `${plugins.length}个插件` };
    } catch (e) {
        return { level: 'warning', message: `检查失败: ${e.message}` };
    }
});

module.exports = { runStartupChecks, registerCheck };
