import { describe, it, expect } from 'vitest';
import { AGENT_ICONS, AGENT_COLORS, TABS } from '../../pages/agents/agentConstants';

describe('agentConstants', () => {
    describe('AGENT_ICONS', () => {
        it('should have icon for writer', () => {
            expect(AGENT_ICONS.writer).toBeTruthy();
        });

        it('should have icon for all standard agents', () => {
            const standardAgents = ['writer', 'first-review', 'second-review', 'final-editor', 'material-manager'];
            standardAgents.forEach(agent => {
                expect(AGENT_ICONS[agent]).toBeTruthy();
            });
        });
    });

    describe('AGENT_COLORS', () => {
        it('should have color for writer', () => {
            expect(AGENT_COLORS.writer).toBeTruthy();
        });

        it('should have color for all standard agents', () => {
            const standardAgents = ['writer', 'first-review', 'second-review', 'final-editor', 'material-manager'];
            standardAgents.forEach(agent => {
                expect(AGENT_COLORS[agent]).toBeTruthy();
            });
        });
    });

    describe('TABS', () => {
        it('should have 4 tabs', () => {
            expect(TABS.length).toBe(4);
        });

        it('should have agents as first tab', () => {
            expect(TABS[0].key).toBe('agents');
        });

        it('should have key and label for each tab', () => {
            TABS.forEach(t => {
                expect(t.key).toBeTruthy();
                expect(t.label).toBeTruthy();
            });
        });
    });
});
