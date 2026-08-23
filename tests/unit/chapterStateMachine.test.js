const assert = require('node:assert/strict');

describe('chapterStateMachine', () => {
    const { isValidTransition, validateTransition, getNextState, VALID_TRANSITIONS, STATE_LABELS } = require('../../server/services/chapterStateMachine');

    describe('isValidTransition', () => {
        test('outlined → written is valid', () => {
            assert.equal(isValidTransition('outlined', 'written'), true);
        });

        test('outlined → first-reviewing is invalid', () => {
            assert.equal(isValidTransition('outlined', 'first-reviewing'), false);
        });

        test('first-reviewing → second-reviewing is valid', () => {
            assert.equal(isValidTransition('first-reviewing', 'second-reviewing'), true);
        });

        test('first-reviewing → written (rework) is valid', () => {
            assert.equal(isValidTransition('first-reviewing', 'written'), true);
        });

        test('approved → material-updated is valid', () => {
            assert.equal(isValidTransition('approved', 'material-updated'), true);
        });

        test('material-updated → outlined (reset) is valid', () => {
            assert.equal(isValidTransition('material-updated', 'outlined'), true);
        });

        test('same state is valid (idempotent)', () => {
            assert.equal(isValidTransition('outlined', 'outlined'), true);
        });

        test('cooldown-waiting → outlined (reset) is valid', () => {
            assert.equal(isValidTransition('cooldown-waiting', 'outlined'), true);
        });

        test('approved → written is invalid', () => {
            assert.equal(isValidTransition('approved', 'written'), false);
        });

        test('unknown state has no valid transitions', () => {
            assert.equal(isValidTransition('unknown-state', 'outlined'), false);
        });
    });

    describe('validateTransition', () => {
        test('returns valid:true for legal transition', () => {
            const result = validateTransition('outlined', 'written');
            assert.equal(result.valid, true);
        });

        test('returns valid:false with error for illegal transition', () => {
            const result = validateTransition('approved', 'written');
            assert.equal(result.valid, false);
            assert.ok(result.error);
            assert.ok(result.allowedTargets);
        });
    });

    describe('getNextState', () => {
        test('write-complete from outlined → written', () => {
            assert.equal(getNextState('outlined', 'write-complete'), 'written');
        });

        test('first-review-pass from first-reviewing → second-reviewing', () => {
            assert.equal(getNextState('first-reviewing', 'first-review-pass'), 'second-reviewing');
        });

        test('first-review-fail from first-reviewing → written', () => {
            assert.equal(getNextState('first-reviewing', 'first-review-fail'), 'written');
        });

        test('reset from approved → outlined', () => {
            assert.equal(getNextState('approved', 'reset'), 'outlined');
        });

        test('invalid event returns null', () => {
            assert.equal(getNextState('outlined', 'nonexistent-event'), null);
        });

        test('event from wrong state returns null', () => {
            assert.equal(getNextState('outlined', 'first-review-pass'), null);
        });
    });

    describe('completeness check', () => {
        test('all states in STATE_LABELS', () => {
            const states = Object.keys(VALID_TRANSITIONS);
            for (const s of states) {
                assert.ok(STATE_LABELS[s], `Missing label for state: ${s}`);
            }
        });
    });
});
