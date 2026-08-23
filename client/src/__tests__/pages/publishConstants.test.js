import { describe, it, expect } from 'vitest';
import {
    TABS, MULTI_PLATFORMS, defaultConfig, DEFAULT_ACCOUNT,
    DEFAULT_INTERACTION, STATUS_LABELS, LOGIN_STATUS_MAP, DEFAULT_LOGIN_BADGE
} from '../../pages/publish/publishConstants';

describe('publishConstants', () => {
    describe('TABS', () => {
        it('should have 4 tabs', () => {
            expect(TABS.length).toBe(4);
        });

        it('should have key and label for each tab', () => {
            TABS.forEach(t => {
                expect(t.key).toBeTruthy();
                expect(t.label).toBeTruthy();
            });
        });
    });

    describe('MULTI_PLATFORMS', () => {
        it('should have fanqie as first platform', () => {
            expect(MULTI_PLATFORMS[0].key).toBe('fanqie');
        });

        it('should have writerUrl for each platform', () => {
            MULTI_PLATFORMS.forEach(p => {
                expect(p.writerUrl).toBeTruthy();
            });
        });
    });

    describe('defaultConfig', () => {
        it('should have mode as immediate', () => {
            expect(defaultConfig.mode).toBe('immediate');
        });

        it('should have scheduleInterval as 30', () => {
            expect(defaultConfig.scheduleInterval).toBe(30);
        });
    });

    describe('DEFAULT_ACCOUNT', () => {
        it('should have platformId as fanqie', () => {
            expect(DEFAULT_ACCOUNT.platformId).toBe('fanqie');
        });
    });

    describe('DEFAULT_INTERACTION', () => {
        it('should have type as comment', () => {
            expect(DEFAULT_INTERACTION.type).toBe('comment');
        });
    });

    describe('STATUS_LABELS', () => {
        it('should have published, pending, failed', () => {
            expect(STATUS_LABELS.published).toBe('已发布');
            expect(STATUS_LABELS.pending).toBe('待发布');
            expect(STATUS_LABELS.failed).toBe('失败');
        });
    });

    describe('LOGIN_STATUS_MAP', () => {
        it('should have logged-in status', () => {
            expect(LOGIN_STATUS_MAP['logged-in'].text).toBe('已登录');
        });

        it('should have text and color for each status', () => {
            Object.values(LOGIN_STATUS_MAP).forEach(v => {
                expect(v.text).toBeTruthy();
                expect(v.color).toBeTruthy();
            });
        });
    });

    describe('DEFAULT_LOGIN_BADGE', () => {
        it('should have text', () => {
            expect(DEFAULT_LOGIN_BADGE.text).toBe('未检测');
        });
    });
});
