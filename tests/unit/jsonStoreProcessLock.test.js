/**
 * jsonStoreHelpers 多进程锁分支（E4：把"环境残留决定覆盖率"改为"测试确定覆盖"）
 *
 * 背景：_registerProcess() 的行为取决于 data/.jsonstore.pid 的内容、以及该 PID 是否存活。
 * 此前没有任何测试覆盖这些分支 → 同一份代码两次覆盖率可差 6~7pp（棘轮因此误报退化）。
 * 本测试用 mock process.kill 显式构造"存活/已退出"两种情形，使覆盖率**确定性**。
 */
const fs = require('fs');
const path = require('path');

jest.mock('../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

const logger = require('../../server/shared/logger');
const { DATA_DIR, _registerProcess, _unregisterProcess } = require('../../server/db/jsonStoreHelpers');

const PID_FILE = path.join(DATA_DIR, '.jsonstore.pid');
let backup = null;

beforeAll(() => { backup = fs.existsSync(PID_FILE) ? fs.readFileSync(PID_FILE, 'utf8') : null; });
afterAll(() => {
    if (backup !== null) fs.writeFileSync(PID_FILE, backup);
    else if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
});
beforeEach(() => jest.clearAllMocks());

describe('_registerProcess 多进程锁', () => {
    test('无锁文件：写入当前 PID，不告警', () => {
        // 注意：data/.jsonstore.pid 是**跨并行 worker 共享**的文件，直接删会造成竞态
        // （实测：别的 worker 在我 unlink 之后又写入，告警分支被误触发 → 用例不稳定）。
        // 因此这里 mock 掉"存在性判断"，用例完全自洽。
        const realExists = fs.existsSync;
        const exists = jest.spyOn(fs, 'existsSync').mockImplementation((p) => (p === PID_FILE ? false : realExists(p)));
        try {
            expect(() => _registerProcess()).not.toThrow();
            expect(logger.warn).not.toHaveBeenCalledWith('jsonStore', expect.stringContaining('另一个Node进程'));
        } finally { exists.mockRestore(); }
        expect(realExists(PID_FILE)).toBe(true);
    });

    test('锁文件属于**存活**的其它进程：上报多进程告警', () => {
        fs.writeFileSync(PID_FILE, '12345');
        const kill = jest.spyOn(process, 'kill').mockImplementation(() => true);
        try {
            _registerProcess();
            expect(kill).toHaveBeenCalledWith(12345, 0);
            expect(logger.warn).toHaveBeenCalledWith('jsonStore', expect.stringContaining('另一个Node进程'));
            expect(fs.readFileSync(PID_FILE, 'utf8').trim()).toBe(String(process.pid));
        } finally { kill.mockRestore(); }
    });

    test('锁文件属于**已退出**的进程：不告警，直接接管', () => {
        fs.writeFileSync(PID_FILE, '999999');
        const kill = jest.spyOn(process, 'kill').mockImplementation(() => { throw new Error('ESRCH'); });
        try {
            _registerProcess();
            expect(logger.warn).not.toHaveBeenCalledWith('jsonStore', expect.stringContaining('另一个Node进程'));
            expect(fs.readFileSync(PID_FILE, 'utf8').trim()).toBe(String(process.pid));
        } finally { kill.mockRestore(); }
    });

    test('锁文件已是本进程 PID：不告警', () => {
        fs.writeFileSync(PID_FILE, String(process.pid));
        _registerProcess();
        expect(logger.warn).not.toHaveBeenCalledWith('jsonStore', expect.stringContaining('另一个Node进程'));
    });

    test('_unregisterProcess 删除锁文件', () => {
        fs.writeFileSync(PID_FILE, String(process.pid));
        expect(() => _unregisterProcess()).not.toThrow();
        expect(fs.existsSync(PID_FILE)).toBe(false);
    });
});
