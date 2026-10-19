const globals = require('globals');
const localPlugin = require('./eslint-rules');
const securityPlugin = require('eslint-plugin-security');
const jestPlugin = require('eslint-plugin-jest');

const EXEMPT_FILES = [
    'server/db/database-pg.js',
    'server/db/store-pg.js',
    'server/db/pgSchema.js',
    'server/db/pgSchemaEntity.js',
    'server/db/store.js',
    'server/db/jsonStore.js',
    'server/db/knowledgeSchema.js',
    'server/db/database.js',
    'server/db/migrations/**/*.js',
    'server/db/migrateEntityRegistry.js',
    'server/services/publishers/fanqiePublisher.js',
    'server/services/publishers/PublisherBase.js',
    'server/services/publishers/index.js',
    'server/config/characterStateSchemas.js',
];

// R1违规AST选择器：检测store.getItem/queryItems/listItems调用
// 对应PROJECT_STANDARDS第9条：Agent必须通过DataContext读取数据
const R1_RESTRICTED_SYNTAX = [
    {
        selector: "CallExpression[callee.object.name='store'][callee.property.name='getItem']",
        message: 'PROJECT_STANDARDS R1违规：Agent不得直接调用 store.getItem()，必须通过 DataContext 委托方法读取数据',
    },
    {
        selector: "CallExpression[callee.object.name='store'][callee.property.name='queryItems']",
        message: 'PROJECT_STANDARDS R1违规：Agent不得直接调用 store.queryItems()，必须通过 DataContext 委托方法读取数据',
    },
    {
        selector: "CallExpression[callee.object.name='store'][callee.property.name='listItems']",
        message: 'PROJECT_STANDARDS R1违规：Agent不得直接调用 store.listItems()，必须通过 DataContext 委托方法读取数据',
    },
];

// R2违规AST选择器：检测res.status().json()直接调用
// 对应方向E：内联响应统一，必须使用res.apiOk/res.apiError/res.apiList
// 豁免：middleware/apiResponse.js（实现层）、middleware/errorHandler.js（兜底层）
const R2_RESTRICTED_SYNTAX = [
    {
        selector: "CallExpression[callee.object.callee.property.name='status'][callee.property.name='json']",
        message: 'PROJECT_STANDARDS R2违规：禁止直接调用 res.status().json()，必须使用 res.apiOk() / res.apiError() / res.apiList() 统一响应格式',
    },
];

module.exports = [
    {
        ignores: ['server/scripts/**', 'server/__tests__/**']
    },
    {
        files: ['server/**/*.js'],
        plugins: { local: localPlugin, security: securityPlugin },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
            'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true }],
            'no-empty': ['error', { allowEmptyCatch: false }],
            'no-restricted-syntax': ['error', ...R2_RESTRICTED_SYNTAX],
            // Security baseline. The noisy rules stay off until the legacy
            // baseline is triaged; CI runs with --max-warnings=0.
            'security/detect-eval-with-expression': 'error',
            'security/detect-child-process': 'off',
            'security/detect-non-literal-fs-filename': 'off',
            'security/detect-object-injection': 'off'
        }
    },
    // R1规则：只对Agent业务逻辑目录生效（steps和infinite）
    // 对应PROJECT_STANDARDS第9条：Agent必须通过DataContext读取数据
    // 使用ESLint内置no-restricted-syntax规则，兼容mcp_eslint
    {
        files: [
            'server/services/pipeline/steps/**/*.js',
            'server/services/pipeline/infinite/**/*.js'
        ],
        rules: {
            'no-restricted-syntax': ['error', ...R1_RESTRICTED_SYNTAX]
        }
    },
    // R2豁免：middleware实现层（apiResponse.js/errorHandler.js）允许 res.status().json
    // 原因：这些文件是统一响应格式的底层实现，res.apiOk/res.apiError 内部依赖 res.status().json
    {
        files: [
            'server/middleware/apiResponse.js',
            'server/middleware/errorHandler.js'
        ],
        rules: {
            'no-restricted-syntax': 'off'
        }
    },
    // R1白名单排除：编排层和数据写入层允许直接调用store
    // 白名单来源：scripts/projectStandardsRules.js 的 R1_WHITELIST
    {
        files: [
            'server/services/pipeline/steps/material*.js',
            'server/services/pipeline/infinite/*.js'
        ],
        rules: {
            'no-restricted-syntax': 'off'
        }
    },
    {
        files: ['server/services/genres/**/*.js'],
        rules: {
            'max-lines': 'off',
            'max-lines-per-function': 'off'
        }
    },
    {
        files: EXEMPT_FILES,
        rules: {
            'max-lines': 'off'
        }
    },
    {
        files: ['server/scripts/**/*.js', 'server/__tests__/**/*.js', 'server/tests/**/*.js', 'tests/**/*.js'],
        rules: {
            'max-lines': 'off',
            'max-lines-per-function': 'off',
            'no-empty': 'off'
        }
    },
    // Test-quality rules: catch empty/conditional green tests.
    // `npm run lint` does not include tests, so legacy violations do not block
    // CI until `npm run lint:tests` is adopted.
    {
        files: ['tests/**/*.js', 'server/__tests__/**/*.js'],
        plugins: { jest: jestPlugin },
        // 自定义测试块别名：让插件认识它们（否则 dbTest(...) 内的 expect 会被误判为
        // "Expect must be inside of a test block"）。新增别名时在此登记，单一入口。
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'jest/expect-expect': ['error', {
                assertFunctionNames: [
                    'expect',
                    'assert',
                    'assert.equal',
                    'assert.strictEqual',
                    'assert.deepEqual',
                    'assert.deepStrictEqual',
                    'assert.ok',
                    'assert.throws',
                    'assert.rejects',
                    'assert.match',
                    'assert.doesNotThrow'
                ]
            }],
            'jest/no-conditional-expect': 'error',
            // 自定义测试块别名（如 dbTest = 环境相关时才跑的 test/skip 包装）：
            // 不登记的话，其内部的 expect 会被误判为"Expect must be inside of a test block"
            'jest/no-standalone-expect': ['error', { additionalTestBlockFunctions: ['dbTest'] }],
            'jest/no-identical-title': 'error',
            'jest/valid-expect': 'error',
            'jest/no-test-prefixes': 'error'
        }
    }
];
