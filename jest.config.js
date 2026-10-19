module.exports = {
    testEnvironment: 'node',
    // Restrict discovery to tests/ so stale Stryker sandboxes under
    // .stryker-tmp are never picked up by `npm test`.
    roots: ['<rootDir>/tests'],
    testMatch: ['**/tests/**/*.test.js'],
    testTimeout: 30000,
    // 覆盖率统计口径（E4 / 2026-10-19）：**全量 server 代码**，不再是 80 文件白名单。
    // 旧口径把 chapterAuditor / validationEngine / technique* / worldScope / craft* /
    // blindJudge / holdoutAssigner 等 F1–F11 肇事子系统全部排除在外 ——
    // 于是"语句覆盖 91%"只描述约 8.5% 的后端代码，而最危险的区域从不进覆盖率账本。
    // 门禁分工：
    //   1) jest global 阈值：全量真实水位（只升不降）
    //   2) 重点文件 per-file 阈值：保留（关键路径更严）
    //   3) 每文件"只升不降"：scripts/verifyCoverageRatchet.js + docs/coverage-baseline.json
    collectCoverageFrom: ['server/**/*.js'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '^<rootDir>/server/tests/',
        '^<rootDir>/server/__tests__/',
        '^<rootDir>/server/scripts/',
        '^<rootDir>/server/docs/'
    ],
    transform: {},
    moduleFileExtensions: ['js', 'json'],
    // 统一模块解析路径（避免 server/node_modules 与根目录 node_modules 多实例问题）
    // 背景：server/package.json 独立声明 axios/express，导致 server/node_modules/{axios,express}
    // 与根目录 node_modules/{axios,express} 是独立实例，jest.mock 只能 mock 其中一个。
    // 此映射强制所有 require 解析到根目录单一实例，使 jest.mock 全局生效。
    moduleNameMapper: {
        '^axios$': '<rootDir>/node_modules/axios',
        '^express$': '<rootDir>/node_modules/express'
    },
    // 覆盖率基线阈值（P3任务建立，防止覆盖率退化）
    // 策略：全局基线略低于当前实际值；关键模块设较高阈值；0%模块暂不强制
    // 详见 docs/MAINTENANCE.md 第五节「覆盖率基线」
    coverageThreshold: {
        // 全局基线（S5升级：实际 Stmts 94.35% / Branches 83.88% / Funcs 94.4% / Lines 96.45%）
        // 注意：jest global threshold 计算含未测试文件，实际阈值校验值低于 All files 行
        // E4 / 2026-10-19：口径改为**全量 server**后的真实水位（此前 91/78/83/93 描述的是
        // 80 文件白名单，约占后端 8.5%）。数值为 jest 实测 global 值向下取整。
        // 之后只许上升：单文件粒度由 scripts/verifyCoverageRatchet.js 守着。
        global: {
            statements: 42,
            branches: 31,
            functions: 39,
            lines: 46
        },
        // S5: core/pipeline 独立阈值（实际 Stmts 98.9% / Branches 86.7% / Funcs 95.8% / Lines 99.4%，留3%缓冲）
        './server/core/pipeline/': {
            statements: 95,
            branches: 83,
            functions: 92,
            lines: 96
        },
        // S5: middleware 独立阈值（实际 Stmts 96.8% / Branches 93.7% / Funcs 95.8% / Lines 97.3%，留3%缓冲）
        './server/middleware/': {
            statements: 92,
            branches: 90,
            functions: 92,
            lines: 94
        },
        // 关键模块基线（已高覆盖，防止退化）
        // E4 / 2026-10-19：口径放宽到全量后，目录内新增文件拉低了聚合值，
        // 按实测水位重设（config funcs 86.18 / shared stmts 89.62 / shared funcs 85.35）。
        './server/config/': {
            statements: 85,
            branches: 75,
            functions: 86,
            lines: 85
        },
        './server/shared/': {
            statements: 89,
            branches: 80,
            functions: 85,
            lines: 90
        },
        // Q1: 告警引擎覆盖率阈值（S1 拆分为目录，按子文件设阈值）
        './server/shared/alertRules/index.js': {
            statements: 95,
            branches: 90,
            functions: 85,
            lines: 95
        },
        './server/shared/alertRules/alertEngine.js': {
            statements: 95,
            branches: 90,
            functions: 85,
            lines: 95
        },
        './server/shared/alertRules/constants.js': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100
        },
        // Q2: 错误分类器高覆盖率阈值
        './server/shared/errorClassifier.js': {
            statements: 100,
            branches: 95,
            functions: 100,
            lines: 100
        },
        // G7: fallback writer 覆盖率阈值
        './server/shared/debugFallbackWriter.js': {
            statements: 90,
            branches: 80,
            functions: 100,
            lines: 90
        },
        './server/db/dbHelpers.js': {
            statements: 90,
            branches: 85,
            functions: 95,
            lines: 90
        },
        './server/db/storeCommon.js': {
            statements: 85,
            branches: 85,
            functions: 95,
            lines: 85
        },
        './server/services/llmRequestBuilder.js': {
            statements: 95,
            branches: 95,
            functions: 100,
            lines: 95
        },
        './server/services/llmResponseParser.js': {
            statements: 95,
            branches: 85,
            functions: 100,
            lines: 95
        },
        './server/services/llmRetryUtils.js': {
            statements: 95,
            branches: 90,
            functions: 100,
            lines: 95
        },
        './server/services/materialIntegrityCheck.js': {
            statements: 95,
            branches: 95,
            functions: 100,
            lines: 95
        },
        './server/services/materialIntegrityHelpers.js': {
            statements: 95,
            branches: 95,
            functions: 100,
            lines: 95
        },
        './server/services/materialValidator.js': {
            statements: 90,
            branches: 80,
            functions: 100,
            lines: 90
        },
        './server/services/genreConfig.js': {
            statements: 75,
            branches: 55,
            functions: 85,
            lines: 75
        },
        './server/services/genreDetectorHelpers.js': {
            statements: 85,
            branches: 85,
            functions: 100,
            lines: 85
        },
        './server/services/chapterStatus.js': {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
        },
        './server/services/contentCleaners.js': {
            statements: 85,
            branches: 70,
            functions: 100,
            lines: 85
        },
        './server/services/rateLimiter.js': {
            statements: 75,
            branches: 60,
            functions: 80,
            lines: 75
        },
        './server/services/tokenBucketLimiter.js': {
            statements: 80,
            branches: 65,
            functions: 75,
            lines: 80
        },
        // R7: 阶段九新增覆盖率阈值（基于实际测量值留缓冲防退化）
        './server/services/healthCheckers.js': {
            statements: 80,
            branches: 60,
            functions: 95,
            lines: 80
        },
        './server/services/healthMonitor.js': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95
        },
        './server/services/contextTruncator.js': {
            statements: 85,
            branches: 80,
            functions: 95,
            lines: 95
        },
        './server/services/materialLifecycleService.js': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95
        },
        './server/services/foreshadowGuard.js': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95
        },
        './server/services/characterArcGuard.js': {
            statements: 95,
            branches: 75,
            functions: 95,
            lines: 95
        },
        './server/services/genres/genreValidator.js': {
            statements: 95,
            branches: 85,
            functions: 95,
            lines: 95
        },
        // S1-S5: 阶段十新增覆盖率阈值（基于实际测量值留缓冲防退化）
        './server/services/reviewCircuitBreaker.js': {
            statements: 90, branches: 85, functions: 95, lines: 90
        },
        './server/services/reviewRemediation.js': {
            statements: 95, branches: 90, functions: 95, lines: 95
        },
        './server/services/llmConfig.js': {
            statements: 95, branches: 90, functions: 95, lines: 95
        },
        './server/routes/chapters.js': {
            statements: 90, branches: 75, functions: 85, lines: 90
        },
        './server/routes/materials.js': {
            statements: 75, branches: 65, functions: 95, lines: 80
        },
        './server/routes/reviews.js': {
            statements: 95, branches: 90, functions: 95, lines: 95
        },
        './server/routes/projects/crudRoutes.js': {
            statements: 85, branches: 55, functions: 90, lines: 85
        },
        './server/routes/projects/graphRoutes.js': {
            statements: 95, branches: 90, functions: 95, lines: 95
        },
        './server/routes/projects/projectConfigRoutes.js': {
            statements: 95, branches: 80, functions: 95, lines: 95
        },
        './server/routes/projects/styleRoutes.js': {
            statements: 95, branches: 90, functions: 95, lines: 95
        },
        './server/routes/projects/cleanupRoutes.js': {
            statements: 75, branches: 60, functions: 70, lines: 80
        },
        './server/routes/projects/initializeRoutes.js': {
            statements: 95, branches: 75, functions: 95, lines: 95
        }
    }
};
