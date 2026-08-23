import { defineConfig } from 'vitest/config';

/**
 * Vitest配置 - 用于mcp_vitest工具分析测试覆盖率
 * 兼容现有Jest测试文件（.test.js）
 * Jest和Vitest共享describe/it/expect API，无需修改测试代码
 */
export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/**/*.test.js'],
        exclude: ['node_modules/**', 'server/scripts/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json'],
            include: [
                'server/services/pipeline/**/*.js',
                'server/services/dataContext*.js',
                'scripts/verifyProjectStandards.js',
                'scripts/projectStandardsRules.js',
            ],
            exclude: ['**/*.test.js', '**/__mocks__/**'],
        },
    },
});
