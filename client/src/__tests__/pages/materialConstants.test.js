import { describe, it, expect } from 'vitest';
import {
    buildDomainTree, toBeijingTime, MATERIAL_TYPE_ICONS,
    MATERIAL_TYPE_LABELS, DOMAIN_CATEGORIES, ARCHIVE_STATUS_LABELS,
    QUEST_STATUS_LABELS, TIMELINE_EVENT_LABELS, IMPORTANCE_LABELS
} from '../../pages/materials/materialConstants';

describe('materialConstants', () => {
    describe('MATERIAL_TYPE_ICONS', () => {
        it('should have icon for each common type', () => {
            ['worldview', 'character', 'equipment', 'relationship', 'faction'].forEach(type => {
                expect(MATERIAL_TYPE_ICONS[type]).toBeTruthy();
            });
        });
    });

    describe('MATERIAL_TYPE_LABELS', () => {
        it('should have label for each icon type', () => {
            Object.keys(MATERIAL_TYPE_ICONS).forEach(type => {
                expect(MATERIAL_TYPE_LABELS[type]).toBeTruthy();
            });
        });
    });

    describe('DOMAIN_CATEGORIES', () => {
        it('should have world, subplane, craft categories', () => {
            expect(DOMAIN_CATEGORIES.world).toBeDefined();
            expect(DOMAIN_CATEGORIES.subplane).toBeDefined();
            expect(DOMAIN_CATEGORIES.craft).toBeDefined();
        });

        it('world should include worldview and character', () => {
            expect(DOMAIN_CATEGORIES.world).toContain('worldview');
            expect(DOMAIN_CATEGORIES.world).toContain('character');
        });
    });

    describe('buildDomainTree', () => {
        it('should return empty structure for empty array', () => {
            const result = buildDomainTree([]);
            expect(result.mainWorld).toBeDefined();
            expect(result.subPlanes).toEqual([]);
            expect(result.craftRules).toBeDefined();
        });

        it('should place worldview in mainWorld others', () => {
            const mats = [{ id: 'w1', type: 'worldview', name: '修仙界' }];
            const result = buildDomainTree(mats);
            expect(result.mainWorld.others.length).toBe(1);
            expect(result.mainWorld.others[0].name).toBe('修仙界');
        });

        it('should place sub-plane in subPlanes', () => {
            const mats = [{ id: 'sp1', type: 'sub-plane', name: '秘境' }];
            const result = buildDomainTree(mats);
            expect(result.subPlanes.length).toBe(1);
            expect(result.subPlanes[0].name).toBe('秘境');
        });

        it('should place faction in mainWorld', () => {
            const mats = [{ id: 'f1', type: 'faction', name: '天机阁' }];
            const result = buildDomainTree(mats);
            expect(result.mainWorld.factions.f1).toBeDefined();
            expect(result.mainWorld.factions.f1.name).toBe('天机阁');
        });

        it('should place craft types in craftRules', () => {
            const mats = [{ id: 'c1', type: 'foreshadowing', name: '伏笔1' }];
            const result = buildDomainTree(mats);
            expect(result.craftRules.byType.foreshadowing).toBeDefined();
            expect(result.craftRules.byType.foreshadowing.length).toBe(1);
            expect(result.craftRules.total).toBe(1);
        });

        it('should place character under faction', () => {
            const mats = [
                { id: 'f1', type: 'faction', name: '天机阁' },
                { id: 'ch1', type: 'character', name: '张三', parentFaction: 'f1' }
            ];
            const result = buildDomainTree(mats);
            expect(result.mainWorld.factions.f1.characters.length).toBe(1);
        });

        it('should place faction under sub-plane', () => {
            const mats = [
                { id: 'sp1', type: 'sub-plane', name: '秘境' },
                { id: 'f1', type: 'faction', name: '秘境宗', parentPlane: 'sp1' }
            ];
            const result = buildDomainTree(mats);
            expect(result.subPlanes[0].factions.f1).toBeDefined();
        });
    });

    describe('toBeijingTime', () => {
        it('should return unknown for null', () => {
            expect(toBeijingTime(null)).toBe('未知时间');
        });

        it('should return unknown for undefined', () => {
            expect(toBeijingTime(undefined)).toBe('未知时间');
        });

        it('should format ISO string to Beijing time', () => {
            const result = toBeijingTime('2026-01-15T10:30:00Z');
            expect(result).toContain('2026');
            expect(result).toContain('18');
        });
    });

    describe('ARCHIVE_STATUS_LABELS', () => {
        it('should have retire, deprecate, recycle', () => {
            expect(ARCHIVE_STATUS_LABELS.retire).toBe('已淘汰');
            expect(ARCHIVE_STATUS_LABELS.deprecate).toBe('已废弃');
            expect(ARCHIVE_STATUS_LABELS.recycle).toBe('已回收');
        });
    });

    describe('QUEST_STATUS_LABELS', () => {
        it('should have planned, active, completed, abandoned', () => {
            expect(QUEST_STATUS_LABELS.planned).toBeTruthy();
            expect(QUEST_STATUS_LABELS.active).toBeTruthy();
            expect(QUEST_STATUS_LABELS.completed).toBeTruthy();
            expect(QUEST_STATUS_LABELS.abandoned).toBeTruthy();
        });
    });

    describe('TIMELINE_EVENT_LABELS', () => {
        it('should have plot, character, world labels', () => {
            expect(TIMELINE_EVENT_LABELS.plot).toBeTruthy();
            expect(TIMELINE_EVENT_LABELS.character).toBeTruthy();
            expect(TIMELINE_EVENT_LABELS.world).toBeTruthy();
        });
    });

    describe('IMPORTANCE_LABELS', () => {
        it('should have low, normal, high, critical', () => {
            expect(IMPORTANCE_LABELS.low).toBe('低');
            expect(IMPORTANCE_LABELS.normal).toBe('普通');
            expect(IMPORTANCE_LABELS.high).toBe('高');
            expect(IMPORTANCE_LABELS.critical).toBe('关键');
        });
    });
});
