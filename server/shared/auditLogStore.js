'use strict';

/**
 * 审计日志独立持久化组件（Q7）
 *
 * 职责：
 * 1. 接收 auditLog.log() 推送的审计条目
 * 2. PG 可用时归档到独立表 audit_logs（与 debug_logs 物理分离）
 * 3. PG 不可用时 fallback 到独立文件 audit-fallback/*.log
 * 4. 提供查询接口（优先 PG，回退内存）
 *
 * 设计权衡：
 * - 审计日志与调试日志职责分离：审计用于追溯关键业务操作，调试用于排查技术问题
 * - 独立表/独立文件：避免审计日志被调试日志淹没
 * - 内存仍保留最近 500 条（向后兼容现有 query API）
 *
 * 文件位置：server/shared/auditLogStore.js
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const MEMORY_RETENTION = 500;
const FALLBACK_DIR_NAME = 'audit-fallback';
const FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const AUDIT_TABLE = 'audit_logs';
const FALLBACK_FILE_PREFIX = 'audit';
const FALLBACK_FILE_EXT = '.log';

class AuditLogStore {
    constructor() {
        this._pool = null;
        this._fallbackDir = null;
        this._fallbackCurrentSize = 0;
        this._fallbackCurrentSeq = 0;
        this._currentDate = null;
        this._totalWritten = 0;
        this._totalErrors = 0;
        this._fallbackWritten = 0;
        this._dirEnsured = false;
    }

    /**
     * 注入 PG 连接池
     */
    attachPool(pool) {
        this._pool = pool;
    }

    /**
     * 设置 fallback 目录（应用启动期调用）
     */
    setFallbackDir(dataDir) {
        this._fallbackDir = path.join(dataDir, FALLBACK_DIR_NAME);
    }

    /**
     * 持久化一条审计日志
     * @param {Object} entry - auditLog.log() 返回的条目
     */
    async persist(entry) {
        // 优先 PG
        if (this._pool) {
            try {
                await this._writeToPg(entry);
                this._totalWritten++;
                return;
            } catch (e) {
                this._totalErrors++;
                logger.warn('auditLogStore', `[AUDIT] PG write failed, fallback to file: ${e.message}`);
            }
        }
        // fallback 文件
        this._writeToFallback(entry);
    }

    /**
     * 写入 PG audit_logs 表
     */
    async _writeToPg(entry) {
        const client = await this._pool.connect();
        try {
            await client.query(`
                INSERT INTO ${AUDIT_TABLE} (id, action, project_id, user_id, timestamp, summary, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [
                entry.id,
                entry.action,
                entry.projectId,
                entry.userId,
                entry.timestamp,
                entry.summary,
                JSON.stringify(entry.metadata || {})
            ]);
        } finally {
            client.release();
        }
    }

    /**
     * 写入 fallback 文件（NDJSON）
     */
    _writeToFallback(entry) {
        if (!this._fallbackDir) return;
        try {
            if (!this._dirEnsured) {
                if (!fs.existsSync(this._fallbackDir)) {
                    fs.mkdirSync(this._fallbackDir, { recursive: true });
                }
                this._dirEnsured = true;
            }
            const today = new Date().toISOString().slice(0, 10);
            if (this._currentDate !== today) {
                this._currentDate = today;
                this._fallbackCurrentSeq = 0;
                this._fallbackCurrentSize = 0;
            }
            const line = JSON.stringify(entry) + '\n';
            const buf = Buffer.from(line, 'utf8');
            if (this._fallbackCurrentSize + buf.length > FILE_MAX_SIZE_BYTES && this._fallbackCurrentSize > 0) {
                this._fallbackCurrentSeq++;
                this._fallbackCurrentSize = 0;
            }
            const filename = `${FALLBACK_FILE_PREFIX}-${today}-${this._fallbackCurrentSeq}${FALLBACK_FILE_EXT}`;
            fs.appendFileSync(path.join(this._fallbackDir, filename), buf);
            this._fallbackCurrentSize += buf.length;
            this._fallbackWritten++;
        } catch (e) {
            this._totalErrors++;
            // fallback 失败不得影响业务流
        }
    }

    /**
     * 查询 PG 中的审计日志
     */
    async queryArchived(options = {}) {
        if (!this._pool) return [];
        try {
            const conditions = [];
            const params = [];
            if (options.action) { params.push(options.action); conditions.push(`action = $${params.length}`); }
            if (options.projectId) { params.push(options.projectId); conditions.push(`project_id = $${params.length}`); }
            if (options.since) { params.push(options.since); conditions.push(`timestamp >= $${params.length}`); }
            const limit = options.limit || 100;
            params.push(limit);
            const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const result = await this._pool.query(
                `SELECT * FROM ${AUDIT_TABLE} ${where} ORDER BY timestamp DESC LIMIT $${params.length}`,
                params
            );
            return result.rows.map(r => ({
                id: r.id,
                action: r.action,
                projectId: r.project_id,
                userId: r.user_id,
                timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
                summary: r.summary,
                metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
            }));
        } catch (e) {
            this._totalErrors++;
            logger.warn('auditLogStore', `[AUDIT] query failed: ${e.message}`);
            return [];
        }
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            pgEnabled: !!this._pool,
            fallbackDir: this._fallbackDir,
            totalWritten: this._totalWritten,
            totalErrors: this._totalErrors,
            fallbackWritten: this._fallbackWritten
        };
    }
}

const auditLogStore = new AuditLogStore();

module.exports = {
    AuditLogStore,
    auditLogStore,
    AUDIT_TABLE,
    FALLBACK_DIR_NAME,
    MEMORY_RETENTION
};
