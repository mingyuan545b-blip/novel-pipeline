/**
 * processGuard.test.js
 * 测试进程守护模块
 */
const { isPortInUse, waitForPortFree, guardPort } = require('../../server/utils/processGuard');
const net = require('net');

describe('processGuard', () => {

    describe('isPortInUse', () => {
        test('returns false for unused port', async () => {
            const result = await isPortInUse(59999);
            expect(result).toBe(false);
        });

        test('returns true for occupied port', async () => {
            const server = net.createServer();
            await new Promise(resolve => server.listen(59998, '127.0.0.1', resolve));
            const result = await isPortInUse(59998);
            expect(result).toBe(true);
            await new Promise(resolve => server.close(resolve));
        });
    });

    describe('waitForPortFree', () => {
        test('resolves true when port is free', async () => {
            const result = await waitForPortFree(59997, 1000);
            expect(result).toBe(true);
        });

        test('resolves false when port stays occupied', async () => {
            const server = net.createServer();
            await new Promise(resolve => server.listen(59996, '127.0.0.1', resolve));
            const result = await waitForPortFree(59996, 500);
            expect(result).toBe(false);
            await new Promise(resolve => server.close(resolve));
        });
    });

    describe('guardPort', () => {
        test('returns cleared when port is free', async () => {
            const result = await guardPort(59995);
            expect(result.cleared).toBe(true);
            expect(result.killedPid).toBeNull();
            expect(result.error).toBeNull();
        });
    });
});
