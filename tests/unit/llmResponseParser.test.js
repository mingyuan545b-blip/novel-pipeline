const { stripThinkTags, normalizeMessageContent } = require('../../server/services/llmResponseParser');

describe('llmResponseParser', () => {
    describe('stripThinkTags', () => {
        test('returns content unchanged when no think tags', () => {
            expect(stripThinkTags('Hello world')).toBe('Hello world');
        });

        test('strips think block and returns content after', () => {
            const input = '<think reasoning here</think >Actual content';
            expect(stripThinkTags(input)).toBe('Actual content');
        });

        test('returns content before think when no closing tag', () => {
            const input = 'Before think<think ongoing reasoning';
            expect(stripThinkTags(input)).toBe('Before think');
        });

        test('handles null input', () => {
            expect(stripThinkTags(null)).toBeNull();
        });

        test('handles undefined input', () => {
            expect(stripThinkTags(undefined)).toBeUndefined();
        });

        test('handles non-string input', () => {
            expect(stripThinkTags(123)).toBe(123);
        });

        test('handles empty string', () => {
            expect(stripThinkTags('')).toBe('');
        });

        test('handles think block with attributes', () => {
            const input = '<think type="reasoning" hidden text</think >Result text';
            expect(stripThinkTags(input)).toBe('Result text');
        });

        test('returns content before think when after is empty', () => {
            const input = 'Pre content<think reasoning</think >';
            expect(stripThinkTags(input)).toBe('Pre content');
        });
    });

    describe('normalizeMessageContent', () => {
        test('handles null message', () => {
            expect(() => normalizeMessageContent(null)).not.toThrow();
        });

        test('handles undefined message', () => {
            expect(() => normalizeMessageContent(undefined)).not.toThrow();
        });

        test('converts array content to string', () => {
            const msg = {
                content: [
                    { type: 'text', text: 'Hello ' },
                    { type: 'text', text: 'World' }
                ]
            };
            normalizeMessageContent(msg);
            expect(msg.content).toBe('Hello \nWorld');
        });

        test('filters non-text blocks', () => {
            const msg = {
                content: [
                    { type: 'image', url: 'http://example.com' },
                    { type: 'text', text: 'Only text' }
                ]
            };
            normalizeMessageContent(msg);
            expect(msg.content).toBe('Only text');
        });

        test('falls back to reasoning_content when content is empty', () => {
            const msg = { content: '', reasoning_content: 'Reasoning text' };
            normalizeMessageContent(msg);
            expect(msg.content).toBe('Reasoning text');
        });

        test('falls back to reasoning_content array', () => {
            const msg = {
                content: null,
                reasoning_content: [{ type: 'text', text: 'Chain of thought' }]
            };
            normalizeMessageContent(msg);
            expect(msg.content).toBe('Chain of thought');
        });

        test('strips think tags from content', () => {
            const msg = { content: '<think reasoning</think >Actual output' };
            normalizeMessageContent(msg);
            expect(msg.content).toBe('Actual output');
        });

        test('preserves string content without think tags', () => {
            const msg = { content: 'Normal content' };
            normalizeMessageContent(msg);
            expect(msg.content).toBe('Normal content');
        });
    });
});
