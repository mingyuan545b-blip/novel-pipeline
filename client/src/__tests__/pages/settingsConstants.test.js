import { describe, it, expect } from 'vitest';
import { getProvider, PROVIDER_LIST, AGENT_TYPES } from '../../pages/settings/settingsConstants';

describe('settingsConstants', () => {
    describe('PROVIDER_LIST', () => {
        it('should have aliyunCoding as first provider', () => {
            expect(PROVIDER_LIST[0].key).toBe('aliyunCoding');
        });

        it('should not contain minimax or lmstudio', () => {
            const keys = PROVIDER_LIST.map(p => p.key);
            expect(keys).not.toContain('minimax');
            expect(keys).not.toContain('lmstudio');
        });

        it('should have defaultModel for each provider', () => {
            const nonCustom = PROVIDER_LIST.filter(p => p.key !== 'custom');
            expect(nonCustom.length).toBeGreaterThan(0);
            const missing = nonCustom.filter(p => !p.defaultModel).map(p => p.key);
            expect(missing).toEqual([]);   // 失败时直接列出缺 defaultModel 的 provider
        });

        it('should have models array for each provider', () => {
            PROVIDER_LIST.forEach(p => {
                expect(Array.isArray(p.models)).toBe(true);
            });
        });
    });

    describe('getProvider', () => {
        it('should return matching provider', () => {
            const result = getProvider('aliyunCoding');
            expect(result.key).toBe('aliyunCoding');
            expect(result.name).toBe('阿里云百炼(Coding Plan)');
        });

        it('should return first provider for unknown key', () => {
            const result = getProvider('unknown');
            expect(result.key).toBe('aliyunCoding');
        });

        it('should return first provider for empty key', () => {
            const result = getProvider('');
            expect(result.key).toBe('aliyunCoding');
        });
    });

    describe('AGENT_TYPES', () => {
        it('should have at least 4 agent types', () => {
            expect(AGENT_TYPES.length).toBeGreaterThanOrEqual(4);
        });

        it('should have writer as first agent type', () => {
            expect(AGENT_TYPES[0].key).toBe('writer');
        });

        it('should have key and label for each type', () => {
            AGENT_TYPES.forEach(a => {
                expect(a.key).toBeTruthy();
                expect(a.label).toBeTruthy();
            });
        });
    });
});
