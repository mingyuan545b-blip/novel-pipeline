/**
 * apiContractExtractor 单元测试
 *
 * 验证前端API调用提取、后端路由提取、契约比对的正确性
 * 注意：extractFrontendCalls/extractBackendRoutes依赖项目根目录，
 *      测试中使用真实项目文件验证；compareContracts使用构造数据测试
 */
const path = require('path');

describe('apiContractExtractor', () => {
    let extractor;

    beforeEach(() => {
        jest.resetModules();
        extractor = require('../../scripts/apiContractExtractor');
    });

    describe('extractFrontendCalls', () => {
        test('应正确提取前端API调用', () => {
            const calls = extractor.extractFrontendCalls();
            expect(calls.length).toBeGreaterThan(0);
            // 验证每个调用都有必要字段
            for (const call of calls) {
                expect(call).toHaveProperty('method');
                expect(call).toHaveProperty('path');
                expect(call).toHaveProperty('file');
                expect(call).toHaveProperty('line');
                expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(call.method);
                expect(call.path).toMatch(/^\//);
            }
        });

        test('模板字面量中的查询表达式不得产生假断裂（G3 回归）', () => {
            const calls = extractor.extractFrontendCalls();
            const tracesCall = calls.find(c => c.file.endsWith('pipelineApi.js') && c.path.includes('/worldscope/') && c.path.includes('/traces'));
            expect(tracesCall).toBeDefined();
            // 原 bug：`.../traces${query ? `?${query}` : ''}` 在第一个单引号处截断
            expect(tracesCall.path).not.toContain('?');
            expect(tracesCall.path).not.toContain(': ');
        });

        test('真实前后端契约必须零断裂（门禁即断言）', () => {
            const broken = extractor.compareContracts(
                extractor.extractFrontendCalls(),
                extractor.extractBackendRoutes()
            );
            expect(broken.map(b => `${b.file}:${b.line} ${b.method} ${b.path}`)).toEqual([]);
        });

        test('应正确解析变量引用（${EC}等）', () => {
            const calls = extractor.extractFrontendCalls();
            // otherApi.js中使用了const EC = '/entity-center'等变量
            // 验证已知变量已被解析（路径中不应包含${EC}、${KB}等未解析的const变量引用）
            const knownVars = ['EC', 'KB', 'PUB', 'PIPE', 'CH', 'MAT', 'REV', 'AGT', 'GUIDE', 'SET', 'LIB'];
            const unresolved = calls.filter(c => {
                return knownVars.some(v => c.path.includes('${' + v + '}'));
            });
            expect(unresolved).toHaveLength(0);
        });
    });

    describe('extractBackendRoutes', () => {
        test('应正确提取后端路由定义', () => {
            const routes = extractor.extractBackendRoutes();
            expect(routes.length).toBeGreaterThan(0);
            for (const route of routes) {
                expect(route).toHaveProperty('method');
                expect(route).toHaveProperty('path');
                expect(route).toHaveProperty('file');
                expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(route.method);
                expect(route.path).toMatch(/^\//);
            }
        });
    });

    describe('ROUTE_PREFIXES（G3 回归）', () => {
        test('前缀不得为空串（空串=挂在根路径，历史上正是该 bug 的形态）', () => {
            const { ROUTE_PREFIXES } = require('../../scripts/apiContractRoutePrefixes');
            const empties = Object.entries(ROUTE_PREFIXES).filter(([, v]) => v === '');
            expect(empties).toEqual([]);
        });

        test('关键路由文件的前缀必须与真实挂载一致', () => {
            const { ROUTE_PREFIXES } = require('../../scripts/apiContractRoutePrefixes');
            expect(ROUTE_PREFIXES['server/routes/worldscopeRoutes.js']).toBe('/api/pipeline');
            expect(ROUTE_PREFIXES['server/routes/pipeline/tokenLedgerRoutes.js']).toBe('/api/pipeline');
            expect(ROUTE_PREFIXES['server/routes/debugRoutes.js']).toBe('/api/debug');
        });
    });

    describe('compareContracts', () => {
        test('应正确匹配前端调用和后端路由', () => {
            const frontendCalls = [
                { method: 'GET', path: '/projects', file: 'test', line: 1 },
                { method: 'GET', path: '/projects/123', file: 'test', line: 2 },
                { method: 'POST', path: '/projects', file: 'test', line: 3 },
            ];
            const backendRoutes = [
                { method: 'GET', path: '/api/projects', file: 'test', line: 1 },
                { method: 'GET', path: '/api/projects/:id', file: 'test', line: 2 },
                { method: 'POST', path: '/api/projects', file: 'test', line: 3 },
            ];
            const broken = extractor.compareContracts(frontendCalls, backendRoutes);
            expect(broken).toHaveLength(0);
        });

        test('应检测出断裂（前端调用但后端无路由）', () => {
            const frontendCalls = [
                { method: 'GET', path: '/projects', file: 'test', line: 1 },
                { method: 'PUT', path: '/projects/123/targets', file: 'test', line: 2 },
            ];
            const backendRoutes = [
                { method: 'GET', path: '/api/projects', file: 'test', line: 1 },
            ];
            const broken = extractor.compareContracts(frontendCalls, backendRoutes);
            expect(broken).toHaveLength(1);
            expect(broken[0].method).toBe('PUT');
            expect(broken[0].path).toBe('/projects/123/targets');
        });

        test('应正确处理模板字符串变量${var}', () => {
            const frontendCalls = [
                { method: 'GET', path: '/entity-center/entity-registry/abc', file: 'test', line: 1 },
            ];
            const backendRoutes = [
                { method: 'GET', path: '/api/entity-center/entity-registry/:id', file: 'test', line: 1 },
            ];
            const broken = extractor.compareContracts(frontendCalls, backendRoutes);
            expect(broken).toHaveLength(0);
        });

        test('应正确处理尾部斜杠差异', () => {
            const frontendCalls = [
                { method: 'GET', path: '/chapters', file: 'test', line: 1 },
            ];
            const backendRoutes = [
                { method: 'GET', path: '/api/chapters/', file: 'test', line: 1 },
            ];
            const broken = extractor.compareContracts(frontendCalls, backendRoutes);
            expect(broken).toHaveLength(0);
        });

        test('应正确处理HTTP方法不匹配', () => {
            const frontendCalls = [
                { method: 'DELETE', path: '/projects/123', file: 'test', line: 1 },
            ];
            const backendRoutes = [
                { method: 'GET', path: '/api/projects/:id', file: 'test', line: 1 },
            ];
            const broken = extractor.compareContracts(frontendCalls, backendRoutes);
            expect(broken).toHaveLength(1);
        });

        test('应正确处理多参数路径', () => {
            const frontendCalls = [
                { method: 'GET', path: '/pipeline/output-paths/proj1/ch1', file: 'test', line: 1 },
            ];
            const backendRoutes = [
                { method: 'GET', path: '/api/pipeline/output-paths/:projectId/:chapterId', file: 'test', line: 1 },
            ];
            const broken = extractor.compareContracts(frontendCalls, backendRoutes);
            expect(broken).toHaveLength(0);
        });

        test('空数组应返回空结果', () => {
            const broken = extractor.compareContracts([], []);
            expect(broken).toHaveLength(0);
        });
    });
});
