'use strict';

/**
 * 调试日志文件归档 fallback 组件（G7）
 *
 * 职责：
 * 1. PG 不可用或写入失败时，将日志条目以 NDJSON 格式追加到本地文件
 * 2. 按日 + 按大小滚动文件，避免单文件过大
 * 3. 定时清理超过保留期的文件
 *
 * 设计权衡：
 * - 同步 appendFile：保证日志落盘后才返回，避免进程崩溃丢失缓冲数据
 * - 文件大小阈值滚动：避免单文件难于查看/迁移
 * - 失败静默：fallback 失败不得影响主日志流
 *
 * 文件位置：server/shared/debugFallbackWriter.js
 */

const fs = require('fs');
const path = require('path');
const { DEBUG_FALLBACK } = require('../config/systemConfigDefs');

const FALLBACK_FILE_PREFIX = 'fallback';
const FALLBACK_FILE_EXT = '.log';

/**
 * 格式化日期为 YYYY-MM-DD（UTC，避免时区影响文件名）
 */
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

class DebugFallbackWriter {
    /**
     * @param {Object} options
     * @param {string} options.dataDir - data 根目录绝对路径
     * @param {Object} [options.config] - 覆盖默认配置（测试用）
     */
    constructor({ dataDir, config }) {
        if (!dataDir) throw new Error('DebugFallbackWriter: dataDir is required');
        this._config = config || DEBUG_FALLBACK;
        this._dir = path.join(dataDir, this._config.FALLBACK_DIR_NAME);
        this._currentDate = null;
        this._currentSeq = 0;
        this._currentSize = 0;
        this._totalWritten = 0;
        this._totalErrors = 0;
        this._dirEnsured = false;
    }

    /**
     * 确保目录存在（首次写入时惰性创建）
     */
    _ensureDir() {
        if (this._dirEnsured) return;
        try {
            if (!fs.existsSync(this._dir)) {
                fs.mkdirSync(this._dir, { recursive: true });
            }
            this._dirEnsured = true;
        } catch (e) {
            this._totalErrors++;
            throw e;
        }
    }

    /**
     * 计算当前应使用的文件名
     */
    _getCurrentFilename() {
        const today = formatDate(new Date());
        if (this._currentDate !== today) {
            this._currentDate = today;
            this._currentSeq = 0;
            this._currentSize = 0;
        }
        return `${FALLBACK_FILE_PREFIX}-${today}-${this._currentSeq}${FALLBACK_FILE_EXT}`;
    }

    /**
     * 滚动到下一个文件（大小超限时调用）
     */
    _rollFile() {
        this._currentSeq++;
        this._currentSize = 0;
    }

    /**
     * 写入一条日志条目（NDJSON 格式）
     * @param {string} traceId
     * @param {Object} entry - { timestamp, level, module, message, context }
     * @returns {boolean} 是否写入成功
     */
    write(traceId, entry) {
        try {
            this._ensureDir();
            const line = JSON.stringify({
                traceId: traceId || 'no-trace',
                timestamp: entry.timestamp || new Date().toISOString(),
                level: entry.level,
                module: entry.module || 'unknown',
                message: entry.message,
                context: entry.context || null
            }) + '\n';
            const buf = Buffer.from(line, 'utf8');

            // 检查是否需要滚动（按大小）
            if (this._currentSize + buf.length > this._config.FILE_MAX_SIZE_BYTES && this._currentSize > 0) {
                this._rollFile();
            }

            const filename = this._getCurrentFilename();
            const filepath = path.join(this._dir, filename);
            fs.appendFileSync(filepath, buf);
            this._currentSize += buf.length;
            this._totalWritten++;
            return true;
        } catch (e) {
            this._totalErrors++;
            return false;
        }
    }

    /**
     * 批量写入（接收 debugPersister 转发的 batch）
     * @param {Array<{traceId, timestamp, level, module, message, context}>} batch
     * @returns {number} 成功写入的条数
     */
    writeBatch(batch) {
        if (!Array.isArray(batch) || batch.length === 0) return 0;
        let success = 0;
        for (const item of batch) {
            const entry = {
                timestamp: item.timestamp,
                level: item.level,
                module: item.module,
                message: item.message,
                context: item.context
            };
            if (this.write(item.traceId, entry)) success++;
        }
        return success;
    }

    /**
     * 清理过期文件（超过 RETENTION_DAYS）
     */
    cleanup() {
        try {
            this._ensureDir();
            const files = fs.readdirSync(this._dir);
            const cutoff = Date.now() - this._config.RETENTION_DAYS * 24 * 60 * 60 * 1000;
            let removed = 0;
            for (const f of files) {
                if (!f.startsWith(FALLBACK_FILE_PREFIX) || !f.endsWith(FALLBACK_FILE_EXT)) continue;
                const filepath = path.join(this._dir, f);
                const stat = fs.statSync(filepath);
                if (stat.mtimeMs < cutoff) {
                    fs.unlinkSync(filepath);
                    removed++;
                }
            }
            return { removed, scanned: files.length };
        } catch (e) {
            this._totalErrors++;
            return { removed: 0, scanned: 0, error: e.message };
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            enabled: true,
            dir: this._dir,
            currentDate: this._currentDate,
            currentSeq: this._currentSeq,
            currentSize: this._currentSize,
            fileMaxSizeBytes: this._config.FILE_MAX_SIZE_BYTES,
            retentionDays: this._config.RETENTION_DAYS,
            totalWritten: this._totalWritten,
            totalErrors: this._totalErrors
        };
    }
}

module.exports = {
    DebugFallbackWriter,
    formatDate,
    FALLBACK_FILE_PREFIX,
    FALLBACK_FILE_EXT
};
