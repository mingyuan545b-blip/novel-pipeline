'use strict';

/**
 * G2 测试：apiRegistry 数据完整性 + apiSelfCheck 多文件挂载校验
 *
 * 覆盖：
 *   - ROUTE_MOUNTS 包含 /api/debug（之前缺失）
 *   - 多文件挂载点（pipeline/character-states/debug）的 extraFiles 字段存在
 *   - getRouteFiles 返回主文件 + extraFiles
 *   - runApiSelfCheck 通过（所有声明文件实际存在）
 */

const path = require('path');
const fs = require('fs');
const { ROUTE_MOUNTS, getRouteFiles, getRouteFilePath } = require('../../server/config/apiRegistry');
const { runApiSelfCheck } = require('../../server/startupChecks/apiSelfCheck');

const SERVER_ROOT = path.join(__dirname, '..', '..', 'server');

describe('G2: apiRegistry 数据完整性', () => {
    test('ROUTE_MOUNTS 包含 /api/debug 挂载点', () => {
        expect(ROUTE_MOUNTS['/api/debug']).toBeDefined();
        expect(ROUTE_MOUNTS['/api/debug'].file).toBe('routes/debugRoutes.js');
    });

    test('ROUTE_MOUNTS 包含所有核心挂载点', () => {
        const required = ['/api/auth', '/api/health', '/api/projects', '/api/chapters', '/api/pipeline', '/api/debug'];
        for (const m of required) {
            expect(ROUTE_MOUNTS[m]).toBeDefined();
        }
    });

    test('多文件挂载点声明 extraFiles 数组', () => {
        const multiFileMounts = ['/api/pipeline', '/api/character-states', '/api/debug'];
        for (const m of multiFileMounts) {
            const entry = ROUTE_MOUNTS[m];
            expect(Array.isArray(entry.extraFiles)).toBe(true);
            expect(entry.extraFiles.length).toBeGreaterThan(0);
        }
    });

    test('getRouteFiles 返回主文件 + extraFiles', () => {
        const pipelineFiles = getRouteFiles('/api/pipeline');
        expect(pipelineFiles.length).toBeGreaterThanOrEqual(3);
        // 主文件在前
        expect(pipelineFiles[0]).toContain('pipeline.js');
        // extraFiles 在后
        expect(pipelineFiles.some(f => f.includes('contextCommanderRoutes.js'))).toBe(true);
        expect(pipelineFiles.some(f => f.includes('worldscopeRoutes.js'))).toBe(true);
    });

    test('getRouteFiles 对未知挂载点返回空数组', () => {
        expect(getRouteFiles('/api/nonexistent')).toEqual([]);
    });

    test('getRouteFilePath 仍返回主文件（向后兼容）', () => {
        const mainFile = getRouteFilePath('/api/debug');
        expect(mainFile).toContain('debugRoutes.js');
    });

    test('ROUTE_MOUNTS 所有声明的路由文件实际存在', () => {
        const missing = [];
        for (const [mountPath] of Object.entries(ROUTE_MOUNTS)) {
            const files = getRouteFiles(mountPath);
            for (const f of files) {
                if (!fs.existsSync(f)) missing.push(`${mountPath} → ${path.relative(SERVER_ROOT, f)}`);
            }
        }
        expect(missing).toEqual([]);
    });
});

describe('G2: apiSelfCheck 多文件挂载校验', () => {
    test('runApiSelfCheck 通过（无错误）', () => {
        const result = runApiSelfCheck();
        expect(result.passed).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test('runApiSelfCheck 检查的文件数 > 31（含 extraFiles）', () => {
        const result = runApiSelfCheck();
        // 31 个挂载点的主文件 + 5 个 extraFiles（pipeline 2 + character-states 2 + debug 1）
        expect(result.details.routeFiles).toBeGreaterThanOrEqual(36);
    });
});
