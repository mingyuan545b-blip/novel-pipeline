/**
 * usePublish hook tests — tests re-exports
 */
import { MULTI_PLATFORMS, defaultConfig, TABS, DEFAULT_ACCOUNT, DEFAULT_INTERACTION } from '../../pages/publish/usePublish';

describe('usePublish re-exports', () => {
    test('MULTI_PLATFORMS is defined', () => { expect(MULTI_PLATFORMS).toBeDefined(); });
    test('defaultConfig is defined', () => { expect(defaultConfig).toBeDefined(); });
    test('TABS is defined', () => { expect(TABS).toBeDefined(); });
    test('DEFAULT_ACCOUNT is defined', () => { expect(DEFAULT_ACCOUNT).toBeDefined(); });
    test('DEFAULT_INTERACTION is defined', () => { expect(DEFAULT_INTERACTION).toBeDefined(); });
});
