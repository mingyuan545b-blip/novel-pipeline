const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('chapterStateMachine', () => {
    const { isValidTransition, validateTransition, getNextState, VALID_TRANSITIONS } = require('../server/services/chapterStateMachine');

    describe('isValidTransition', () => {
        it('outlined → written is valid', () => {
            assert.equal(isValidTransition('outlined', 'written'), true);
        });

        it('outlined → first-reviewing is invalid', () => {
            assert.equal(isValidTransition('outlined', 'first-reviewing'), false);
        });

        it('first-reviewing → second-reviewing is valid', () => {
            assert.equal(isValidTransition('first-reviewing', 'second-reviewing'), true);
        });

        it('first-reviewing → written (rework) is valid', () => {
            assert.equal(isValidTransition('first-reviewing', 'written'), true);
        });

        it('approved → material-updated is valid', () => {
            assert.equal(isValidTransition('approved', 'material-updated'), true);
        });

        it('material-updated → outlined (reset) is valid', () => {
            assert.equal(isValidTransition('material-updated', 'outlined'), true);
        });

        it('same state is valid (idempotent)', () => {
            assert.equal(isValidTransition('outlined', 'outlined'), true);
        });

        it('permanently-skipped → outlined (reset) is valid', () => {
            assert.equal(isValidTransition('permanently-skipped', 'outlined'), true);
        });

        it('approved → written is invalid', () => {
            assert.equal(isValidTransition('approved', 'written'), false);
        });

        it('unknown state has no valid transitions', () => {
            assert.equal(isValidTransition('unknown-state', 'outlined'), false);
        });
    });

    describe('validateTransition', () => {
        it('returns valid:true for legal transition', () => {
            const result = validateTransition('outlined', 'written');
            assert.equal(result.valid, true);
        });

        it('returns valid:false with error for illegal transition', () => {
            const result = validateTransition('approved', 'written');
            assert.equal(result.valid, false);
            assert.ok(result.error);
            assert.ok(result.allowedTargets);
        });
    });

    describe('getNextState', () => {
        it('write-complete from outlined → written', () => {
            assert.equal(getNextState('outlined', 'write-complete'), 'written');
        });

        it('first-review-pass from first-reviewing → second-reviewing', () => {
            assert.equal(getNextState('first-reviewing', 'first-review-pass'), 'second-reviewing');
        });

        it('first-review-fail from first-reviewing → written', () => {
            assert.equal(getNextState('first-reviewing', 'first-review-fail'), 'written');
        });

        it('reset from approved → outlined', () => {
            assert.equal(getNextState('approved', 'reset'), 'outlined');
        });

        it('invalid event returns null', () => {
            assert.equal(getNextState('outlined', 'nonexistent-event'), null);
        });

        it('event from wrong state returns null', () => {
            assert.equal(getNextState('outlined', 'first-review-pass'), null);
        });
    });

    describe('completeness check', () => {
        it('all states in STATE_LABELS', () => {
            const states = Object.keys(VALID_TRANSITIONS);
            const { STATE_LABELS } = require('../server/services/chapterStateMachine');
            for (const s of states) {
                assert.ok(STATE_LABELS[s], `Missing label for state: ${s}`);
            }
        });
    });
});

describe('shouldOverrideReviewRejection', () => {
    const { shouldOverrideReviewRejection } = require('../server/services/pipeline/fullPipeline');

    it('returns no override when stepResult is passed', () => {
        const result = shouldOverrideReviewRejection({ passed: true }, '', 0, 0, [], {});
        assert.equal(result.override, false);
    });

    it('returns no override when stepResult is null', () => {
        const result = shouldOverrideReviewRejection(null, '', 0, 0, [], {});
        assert.equal(result.override, false);
    });

    it('overrides word count hallucination', () => {
        const stepResult = {
            passed: false,
            feedback: {
                summary: '字数不足，低于最低要求',
                issues: []
            }
        };
        const result = shouldOverrideReviewRejection(stepResult, '', 3000, 2200, [], {});
        assert.equal(result.override, true);
        assert.ok(result.reason.includes('幻觉'));
    });

    it('does not override word count when system count is below minimum', () => {
        const stepResult = {
            passed: false,
            feedback: {
                summary: '字数不足，低于最低要求',
                issues: []
            }
        };
        const result = shouldOverrideReviewRejection(stepResult, '', 1500, 2200, [], {});
        assert.equal(result.override, false);
    });

    it('does not override when no rejection reason matches', () => {
        const stepResult = {
            passed: false,
            feedback: {
                summary: '情节不够紧凑',
                issues: []
            }
        };
        const result = shouldOverrideReviewRejection(stepResult, '', 1500, 2200, [], {});
        assert.equal(result.override, false);
    });
});

describe('isFoundationMaterial', () => {
    const { isFoundationMaterial } = require('../server/db/jsonStore');

    it('returns false for null', () => {
        assert.equal(isFoundationMaterial(null), false);
    });

    it('returns true for isFoundation=true', () => {
        assert.equal(isFoundationMaterial({ type: 'character', id: 't1', isFoundation: true }), true);
    });

    it('returns false for isFoundation=false', () => {
        assert.equal(isFoundationMaterial({ type: 'worldview', id: 't2', isFoundation: false }), false);
    });

    it('returns false for material with sourceChapter', () => {
        assert.equal(isFoundationMaterial({ type: 'worldview', id: 't3', sourceChapter: 'ch1' }), false);
    });

    it('returns true for worldview without parentPlane', () => {
        assert.equal(isFoundationMaterial({ type: 'worldview', id: 't4' }), true);
    });

    it('returns false for worldview with parentPlane', () => {
        assert.equal(isFoundationMaterial({ type: 'worldview', id: 't5', parentPlane: 'sp1' }), false);
    });

    it('returns true for faction with parentPlane=null', () => {
        assert.equal(isFoundationMaterial({ type: 'faction', id: 't6', parentPlane: null }), true);
    });

    it('returns false for faction with parentPlane set', () => {
        assert.equal(isFoundationMaterial({ type: 'faction', id: 't7', parentPlane: 'sp1' }), false);
    });

    it('returns true for institution with parentPlane=null', () => {
        assert.equal(isFoundationMaterial({ type: 'institution', id: 't8', parentPlane: null }), true);
    });

    it('stops recursion at depth 5', () => {
        const mat = { type: 'character', id: 'deep', parentFaction: 'nonexistent' };
        assert.equal(isFoundationMaterial(mat, new Set(), 6), false);
    });
});
