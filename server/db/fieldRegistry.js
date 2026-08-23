/**
 * fieldRegistry.js — 字段注册表逻辑层
 * 数据定义在fieldRegistryData.js，此文件提供查询/校验/生成功能
 */
const { REGISTRY } = require('./fieldRegistryData');

const FIELD_TYPES = {
    text: 'TEXT', integer: 'INTEGER', boolean: 'BOOLEAN',
    real: 'REAL', jsonb: 'JSONB', timestamptz: 'TIMESTAMPTZ'
};

/**
 * 从注册表自动生成extractor函数
 * 替代手写的extractXxxFields函数，确保字段默认值与注册表一致
 */
function generateExtractor(tableName) {
    const tableDef = REGISTRY[tableName];
    if (!tableDef) return null;

    return function(data) {
        const result = {};
        for (const [colName, colDef] of Object.entries(tableDef.columns)) {
            if (colDef.noExtract || colDef.pk) {
                if (colName === 'id') result.id = data.id;
                continue;
            }
            // 支持字段映射：extractorSource指定从业务对象的哪个字段读取
            // 用于PG列名与业务字段名不一致的场景（如targetChapterCount←targetChapters）
            const sourceField = colDef.extractorSource || colName;
            const value = data[sourceField];
            const transform = colDef.extractorTransform;
            if (transform === 'bool') {
                result[colName] = value ? true : false;
            } else if (transform === 'boolNotFalse') {
                result[colName] = value !== false;
            } else if (transform === 'nullish') {
                result[colName] = value ?? colDef.extractorDefault;
            } else if (transform === 'jsonOrString') {
                const fallback = JSON.parse(colDef.extractorDefault || '[]');
                result[colName] = typeof value === 'string' ? value : JSON.stringify(value || fallback);
            } else if (transform === 'timestamp') {
                // 空值/空字符串/无效日期一律返回当前时间（陷阱#33: timestamptz列不接受空字符串）
                if (!value || value === '') {
                    result[colName] = new Date().toISOString();
                } else {
                    const ts = new Date(value);
                    result[colName] = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
                }
            } else {
                result[colName] = value !== undefined && value !== null ? value : colDef.extractorDefault;
            }
        }
        result.data = JSON.stringify(data);
        return result;
    };
}

/**
 * 校验PG schema与注册表的一致性
 * 返回 { status, issues[] }
 */
function validateRegistryVsPgSchema(tableName, pgColumns) {
    const tableDef = REGISTRY[tableName];
    if (!tableDef) return { status: 'unregistered', issues: [] };

    const issues = [];
    const pgSet = new Set(pgColumns.map(c => c.toLowerCase()));
    const regColumns = Object.entries(tableDef.columns);

    for (const [colName] of regColumns) {
        if (!pgSet.has(colName.toLowerCase())) {
            issues.push({
                severity: 'CRITICAL', column: colName,
                message: `Registry defines "${colName}" but PG table "${tableName}" has no such column`
            });
        }
    }

    const regSet = new Set(regColumns.map(([k]) => k.toLowerCase()));
    for (const pgCol of pgColumns) {
        if (!regSet.has(pgCol.toLowerCase()) &&
            !['createdat', 'updatedat', 'data'].includes(pgCol.toLowerCase())) {
            issues.push({
                severity: 'WARN', column: pgCol,
                message: `PG table "${tableName}" has column "${pgCol}" but registry does not define it`
            });
        }
    }

    return {
        status: issues.some(i => i.severity === 'CRITICAL') ? 'critical' : 'ok',
        issues
    };
}

/** 获取表的所有索引列 */
function getIndexedColumns(tableName) {
    const tableDef = REGISTRY[tableName];
    if (!tableDef) return [];
    return Object.entries(tableDef.columns)
        .filter(([, def]) => def.indexed)
        .map(([name]) => name);
}

/** 获取表的所有可提取列（排除data/createdAt/updatedAt） */
function getExtractableColumns(tableName) {
    const tableDef = REGISTRY[tableName];
    if (!tableDef) return [];
    return Object.entries(tableDef.columns)
        .filter(([, def]) => !def.noExtract && !def.pk)
        .map(([name, def]) => ({ name, default: def.extractorDefault, transform: def.extractorTransform }));
}

/** 获取所有注册的表名 */
function getRegisteredTables() {
    return Object.keys(REGISTRY);
}

/** 获取store类型到PG表名的映射 */
function getStoreTypeMapping() {
    const mapping = {};
    for (const [pgTable, def] of Object.entries(REGISTRY)) {
        mapping[def.storeType] = pgTable;
    }
    return mapping;
}

module.exports = {
    REGISTRY, FIELD_TYPES, generateExtractor,
    validateRegistryVsPgSchema, getIndexedColumns,
    getExtractableColumns, getRegisteredTables, getStoreTypeMapping
};
