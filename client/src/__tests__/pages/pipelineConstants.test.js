import { describe, test, expect } from 'vitest';
import {
    PIPELINE_STEPS, OUTPUT_TABS, AGENT_LABELS, STATUS_ORDER,
    buildPipelineSteps, buildOutputTabs, safeStr, formatTime,
    getStepStatus, isStepOutputVisible
} from '../../pages/pipeline/pipelineConstants';

describe('pipelineConstants', () => {
    test('PIPELINE_STEPS has novel steps', () => {
        expect(PIPELINE_STEPS.novel.length).toBeGreaterThan(0);
        expect(PIPELINE_STEPS.novel[0].key).toBe('intent-planner');
    });

    test('OUTPUT_TABS has novel tabs', () => {
        expect(OUTPUT_TABS.novel.length).toBeGreaterThan(0);
        expect(OUTPUT_TABS.novel[0].key).toBe('intentPlannerOutput');
    });

    test('AGENT_LABELS has required keys', () => {
        expect(AGENT_LABELS.writer).toBe('执笔人');
        expect(AGENT_LABELS['final-editor']).toBe('定稿人');
    });

    test('STATUS_ORDER has expected order', () => {
        expect(STATUS_ORDER[0]).toBe('outlined');
        expect(STATUS_ORDER).toContain('approved');
    });
});

describe('buildPipelineSteps', () => {
    test('returns default steps when no config', () => {
        const steps = buildPipelineSteps(null);
        expect(steps).toEqual(PIPELINE_STEPS.novel);
    });

    test('replaces reviews with fast-review when skipSecondReview', () => {
        const steps = buildPipelineSteps({ skipSecondReview: true });
        const hasFastReview = steps.some(s => s.key === 'fast-review');
        expect(hasFastReview).toBe(true);
        const hasSecondReview = steps.some(s => s.key === 'second-review');
        expect(hasSecondReview).toBe(false);
    });
});

describe('buildOutputTabs', () => {
    test('returns default tabs when no config', () => {
        const tabs = buildOutputTabs(null);
        expect(tabs).toEqual(OUTPUT_TABS.novel);
    });

    test('replaces review tabs when skipSecondReview', () => {
        const tabs = buildOutputTabs({ skipSecondReview: true });
        const hasFastReview = tabs.some(t => t.key === 'firstReviewOutput' && t.agentKey === 'fast-review');
        expect(hasFastReview).toBe(true);
    });
});

describe('safeStr', () => {
    test('returns empty string for null', () => expect(safeStr(null)).toBe(''));
    test('returns empty string for undefined', () => expect(safeStr(undefined)).toBe(''));
    test('returns string as-is', () => expect(safeStr('hello')).toBe('hello'));
    test('converts number to string', () => expect(safeStr(42)).toBe('42'));
    test('converts boolean to string', () => expect(safeStr(true)).toBe('true'));
    test('converts object to JSON', () => expect(safeStr({ a: 1 })).toBe('{"a":1}'));
});

describe('formatTime', () => {
    test('returns empty string for null', () => expect(formatTime(null)).toBe(''));
    test('formats date correctly', () => {
        const result = formatTime('2024-01-15T10:30:45');
        expect(result).toContain('2024');
        expect(result).toContain('10:30:45');
    });
});

describe('getStepStatus', () => {
    test('returns pending when no chapter selected', () => {
        expect(getStepStatus('writer', null, {})).toBe('pending');
    });

    test('returns done for approved chapter', () => {
        expect(getStepStatus('writer', { status: 'approved' }, {})).toBe('done');
    });

    test('returns done for material-updated chapter', () => {
        expect(getStepStatus('writer', { status: 'material-updated' }, {})).toBe('done');
    });

    test('returns active when step matches currentStep', () => {
        expect(getStepStatus('writer', { status: 'outlined' }, { currentStep: 'writer' })).toBe('active');
    });

    test('returns done for writer when status is written', () => {
        expect(getStepStatus('writer', { status: 'written' }, {})).toBe('done');
    });

    test('returns pending for writer when status is outlined', () => {
        expect(getStepStatus('writer', { status: 'outlined' }, { currentStep: 'intent-planner' })).toBe('pending');
    });
});

describe('isStepOutputVisible', () => {
    test('returns false when no chapter selected', () => {
        expect(isStepOutputVisible('writerOutput', null)).toBe(false);
    });

    test('returns true for approved chapter', () => {
        expect(isStepOutputVisible('writerOutput', { status: 'approved' })).toBe(true);
    });

    test('returns true for intentPlannerOutput when outlined', () => {
        expect(isStepOutputVisible('intentPlannerOutput', { status: 'outlined' })).toBe(true);
    });

    test('returns true for writerOutput when written', () => {
        expect(isStepOutputVisible('writerOutput', { status: 'written' })).toBe(true);
    });
});
