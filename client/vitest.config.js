import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/__tests__/setup.js'],
        include: ['src/__tests__/**/*.test.{js,jsx}'],
        css: false,
        pool: 'forks',
        poolOptions: {
            forks: { maxForks: 2, minForks: 1 }
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov'],
            include: [
                'src/hooks/**/*.{js,jsx}',
                'src/store/**/*.{js,jsx}',
                'src/shared/**/*.{js,jsx}',
                'src/pages/**/use*.{js,jsx}',
                'src/pages/**/pipelineConstants.js',
                'src/pages/**/metricsUtils.js',
                'src/pages/**/*Constants.js',
                'src/pages/**/*constants.js'
            ],
            exclude: [
                'src/__tests__/**',
                'src/**/*.test.{js,jsx}',
                'src/**/*.spec.{js,jsx}',
                'src/hooks/queries/index.js',
                'src/hooks/useAppInit.js'
            ],
            thresholds: {
                lines: 38,
                branches: 22,
                functions: 42
            }
        }
    }
});
