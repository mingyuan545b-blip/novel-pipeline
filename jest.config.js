module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    testTimeout: 30000,
    collectCoverageFrom: [
        'server/config/systemConfigDefs.js',
        'server/config/systemConfig.js',
        'server/config/envValidator.js',
        'server/config/configManifest.js',
        'server/config/providerRegistry.js',
        'server/config/genreEntitySchemas.js',
        'server/config/promptFragments.js',
        'server/config/stateSchemaUtils.js',
        'server/db/storeCommon.js',
        'server/db/dbHelpers.js',
        'server/shared/errors.js',
        'server/shared/logger.js',
        // Q1: 告警引擎纳入覆盖率统计（S1 拆分为目录，统计入口 + 引擎类）
        'server/shared/alertRules/index.js',
        'server/shared/alertRules/alertEngine.js',
        'server/shared/alertRules/constants.js',
        // Q2: 错误分类器纳入覆盖率统计
        'server/shared/errorClassifier.js',
        // G7: fallback writer 纳入覆盖率统计
        'server/shared/debugFallbackWriter.js',
        'server/services/rateLimiter.js',
        'server/services/tokenBucketLimiter.js',
        'server/services/contentCleaners.js',
        'server/services/chapterStatus.js',
        'server/services/llmRequestBuilder.js',
        'server/services/llmRetryUtils.js',
        'server/services/llmResponseParser.js',
        'server/services/llmConfig.js',
        'server/services/materialIntegrityCheck.js',
        'server/services/materialIntegrityHelpers.js',
        'server/services/remediationHelpers.js',
        'server/services/prompts/constraintDedupe.js',
        'server/services/prompts/constraintInjector.js',
        'server/services/pipeline/initialMaterialHelpers.js',
        'server/services/pipeline/pipelineUtils.js',
        'server/services/pipeline/volumeHelpers.js',
        'server/services/pipeline/outlineRhythmMatchers.js',
        'server/services/pipeline/pipelineConfig.js',
        'server/services/pipeline/pipelineContractDefs.js',
        'server/services/pipeline/pipelineContract.js',
        'server/services/pipeline/pipelineOutputContract.js',
        'server/services/pipeline/outputContractDefs.js',
        'server/services/pipeline/pipelinePollutionGuard.js',
        'server/services/pipeline/pipelinePreflight.js',
        'server/services/pipeline/dataFlowSpec.js',
        'server/services/reviewRemediation.js',
        'server/services/llm.js',
        'server/services/pipeline/outlineTemplateExpander/templateEntityAssocHelpers.js',
        'server/services/genreConfig.js',
        'server/services/genreDetectorHelpers.js',
        'server/services/materialValidator.js',
        // R7: 阶段九新增覆盖率统计（R1-R5 源文件 + genreValidator）
        'server/services/healthCheckers.js',
        'server/services/healthMonitor.js',
        'server/services/contextTruncator.js',
        'server/services/materialLifecycleService.js',
        'server/services/foreshadowGuard.js',
        'server/services/characterArcGuard.js',
        'server/services/genres/genreValidator.js',
        // S1-S5: 阶段十新增覆盖率统计（核心服务 + 路由层）
        'server/services/reviewCircuitBreaker.js',
        'server/services/reviewRemediation.js',
        'server/services/llmConfig.js',
        'server/routes/chapters.js',
        'server/routes/materials.js',
        'server/routes/reviews.js',
        'server/routes/projects/crudRoutes.js',
        'server/routes/projects/graphRoutes.js',
        'server/routes/projects/projectConfigRoutes.js',
        'server/routes/projects/styleRoutes.js',
        'server/routes/projects/cleanupRoutes.js',
        'server/routes/projects/initializeRoutes.js',
        // 阶段十一 S4: core/pipeline 纳入覆盖率统计（S5 已设独立阈值）
        'server/core/pipeline/**/*.js',
        // 阶段十一 S6: middleware 全量纳入覆盖率统计
        'server/middleware/apiResponse.js',
        'server/middleware/auth.js',
        'server/middleware/debugRateLimit.js',
        'server/middleware/errorContextHelper.js',
        'server/middleware/errorHandler.js',
        'server/middleware/httpMetricsMiddleware.js',
        'server/middleware/inputSanitizer.js',
        'server/middleware/responseFormatter.js',
        'server/middleware/securityHeaders.js',
        'server/middleware/sensitiveFilter.js',
        'server/middleware/traceIdMiddleware.js',
        'server/middleware/validators.js'
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
        global: {
            statements: 91,
            branches: 78,
            functions: 83,
            lines: 93
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
        './server/config/': {
            statements: 85,
            branches: 75,
            functions: 90,
            lines: 85
        },
        './server/shared/': {
            statements: 90,
            branches: 80,
            functions: 95,
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
