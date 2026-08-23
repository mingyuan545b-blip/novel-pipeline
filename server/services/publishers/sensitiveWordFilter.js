const { scanContent: scanSensitiveWords } = require('../sensitiveWordGuard');
const { addLog } = require('./PublisherBase');

function filterContent(content, platform) {
    addLog(platform, '敏感词预扫描...');
    const scanResult = scanSensitiveWords(content);
    if (!scanResult.clean) {
        const blockHits = scanResult.hits.filter(h => h.severity === 'block');
        if (blockHits.length > 0) {
            addLog(platform, `⚠ 敏感词拦截: ${scanResult.summary}`);
            content = scanResult.replacedContent;
            addLog(platform, `已自动替换敏感词，替换后继续发布`);
        }
    }
    if (scanResult.hasWarnings) {
        addLog(platform, `⚠ 敏感词警告: ${scanResult.summary}`);
    }
    return content;
}

module.exports = { filterContent };
