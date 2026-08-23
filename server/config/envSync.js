/**
 * envSync.js — .env智能恢复与前端认证同步
 * 启动时自动执行：缺失key追加、空值警告、client/.env.local同步
 */
const logger = require('../shared/logger');
const path = require('path');
const fs = require('fs');
const { SERVER_DEFAULTS } = require('../config/systemConfig');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');
const ENV_EXAMPLE_PATH = path.join(__dirname, '..', '..', '.env.example');
const CLIENT_ENV_PATH = path.join(__dirname, '..', '..', 'client', '.env.local');
const CRITICAL_ENV_KEYS = ['ALIYUN_CODING_API_KEY', 'REQUEST_SECRET', 'ENCRYPTION_SECRET'];

function ensureEnvFile() {
    if (!fs.existsSync(ENV_EXAMPLE_PATH)) return;
    if (!fs.existsSync(ENV_PATH)) {
        fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
        logger.info('envSync', '[CONFIG] .env不存在，已从.env.example自动生成。请修改API Key等配置后重启。');
        return;
    }
    const exampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const envKeys = new Set();
    const envValues = {};
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match) { envKeys.add(match[1]); envValues[match[1]] = match[2]; }
    });
    const missingLines = [];
    exampleContent.split('\n').forEach(line => {
        const match = line.match(/^([A-Z_]+)=/);
        if (match && !envKeys.has(match[1])) missingLines.push(line);
    });
    if (missingLines.length > 0) {
        fs.appendFileSync(ENV_PATH, '\n# --- 自动补充的配置项 ---\n' + missingLines.join('\n') + '\n', 'utf8');
        logger.info('envSync', `[CONFIG] .env已自动补充${missingLines.length}个缺失配置项（不覆盖已有值）`);
    }
    const emptyCriticalKeys = CRITICAL_ENV_KEYS.filter(k => envKeys.has(k) && (!envValues[k] || envValues[k].trim() === ''));
    if (emptyCriticalKeys.length > 0) {
        logger.error('envSync', `[CONFIG] 关键配置项值为空: ${emptyCriticalKeys.join(', ')} — 请在.env中填写有效值！`);
    }
}

function syncFrontendEnv() {
    const secret = process.env.REQUEST_SECRET || '';
    const port = process.env.PORT || String(SERVER_DEFAULTS.DEFAULT_PORT);
    const desiredContent = `# 自动生成 - 勿手动修改，由envSync.js启动时同步\nVITE_REQUEST_SECRET=${secret}\nVITE_API_PORT=${port}\n`;
    try {
        let needWrite = true;
        if (fs.existsSync(CLIENT_ENV_PATH)) {
            const existing = fs.readFileSync(CLIENT_ENV_PATH, 'utf8');
            if (existing.includes(`VITE_REQUEST_SECRET=${secret}`) && existing.includes(`VITE_API_PORT=${port}`)) {
                needWrite = false;
            }
        }
        if (needWrite) {
            fs.writeFileSync(CLIENT_ENV_PATH, desiredContent, 'utf8');
            logger.info('envSync', '[CONFIG] client/.env.local已同步（VITE_REQUEST_SECRET + VITE_API_PORT）');
        }
    } catch (e) {
        logger.warn('envSync', `[CONFIG] 无法写入client/.env.local: ${e.message}`);
    }
}

module.exports = { ensureEnvFile, syncFrontendEnv, ENV_PATH };
