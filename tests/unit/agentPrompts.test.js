const {
    getAgentPrompt,
    getAgentTemplate,
    CONSTRAINT_PRESETS,
    NOVEL_DEFAULT_CONSTRAINTS,
    deduplicateSystemPrompt
} = require('../../server/services/prompts/index');

const { FALLBACK_AGENT_TEMPLATES } = require('../../server/services/prompts/promptBuilder');

const store = require('../../server/store');

describe('agentPrompts - getAgentTemplate', () => {
    let listItemsSpy;

    beforeEach(() => {
        listItemsSpy = jest.spyOn(store, 'listItems').mockResolvedValue([]);
    });

    afterEach(() => {
        listItemsSpy.mockRestore();
    });

    test('should return fallback template for writer', async () => {
        const template = await getAgentTemplate('writer', 'novel');
        expect(template).not.toBeNull();
        expect(template.agentType).toBe('writer');
        expect(template.system).toBeDefined();
        expect(template.tool).toBeDefined();
        expect(template.role).toBeDefined();
    });

    test('should return fallback template for first-review', async () => {
        const template = await getAgentTemplate('first-review', 'novel');
        expect(template).not.toBeNull();
        expect(template.agentType).toBe('first-review');
    });

    test('should return fallback template for all standard agent types', async () => {
        const agentTypes = ['writer', 'reviser', 'first-review', 'second-review', 'final-editor', 'material-manager', 'fast-review', 'intent-planner'];
        for (const type of agentTypes) {
            const template = await getAgentTemplate(type, 'novel');
            expect(template).not.toBeNull();
            expect(template.agentType).toBe(type);
        }
    });

    test('should return null for unknown agent type', async () => {
        const template = await getAgentTemplate('nonexistent-agent', 'novel');
        expect(template).toBeNull();
    });

    test('should prefer mode-specific template from store over fallback', async () => {
        const customTemplate = {
            agentType: 'writer',
            mode: 'novel',
            system: 'custom novel writer',
            role: 'user',
            tool: 'writer'
        };
        listItemsSpy.mockResolvedValue([customTemplate]);
        const template = await getAgentTemplate('writer', 'novel');
        expect(template).not.toBeNull();
        expect(template.system).toBe('custom novel writer');
    });
});

describe('agentPrompts - getAgentPrompt output structure', () => {
    let listItemsSpy;
    let getItemSpy;

    beforeEach(() => {
        listItemsSpy = jest.spyOn(store, 'listItems').mockResolvedValue([]);
        getItemSpy = jest.spyOn(store, 'getItem').mockResolvedValue(null);
    });

    afterEach(() => {
        listItemsSpy.mockRestore();
        getItemSpy.mockRestore();
    });

    test('should return object with system, role, and tool fields for writer', async () => {
        const prompt = await getAgentPrompt('writer', 'novel');
        expect(prompt).not.toBeNull();
        expect(prompt).toHaveProperty('system');
        expect(prompt).toHaveProperty('role');
        expect(prompt).toHaveProperty('tool');
    });

    test('should return object with system, role, and tool fields for first-review', async () => {
        const prompt = await getAgentPrompt('first-review', 'novel');
        expect(prompt).not.toBeNull();
        expect(prompt).toHaveProperty('system');
        expect(prompt).toHaveProperty('role');
        expect(prompt).toHaveProperty('tool');
    });

    test('should return null for unknown agent type', async () => {
        const prompt = await getAgentPrompt('nonexistent-agent', 'novel');
        expect(prompt).toBeNull();
    });

    test('should include _buildLog when project is provided', async () => {
        const prompt = await getAgentPrompt('writer', 'novel', 'proj1');
        expect(prompt).toHaveProperty('_buildLog');
        expect(Array.isArray(prompt._buildLog)).toBe(true);
    });

    test('should include _buildLog even without project', async () => {
        const prompt = await getAgentPrompt('writer', 'novel');
        expect(prompt).toHaveProperty('_buildLog');
    });
});

describe('agentPrompts - different agent types return different prompts', () => {
    let listItemsSpy;
    let getItemSpy;

    beforeEach(() => {
        listItemsSpy = jest.spyOn(store, 'listItems').mockResolvedValue([]);
        getItemSpy = jest.spyOn(store, 'getItem').mockResolvedValue(null);
    });

    afterEach(() => {
        listItemsSpy.mockRestore();
        getItemSpy.mockRestore();
    });

    test('should return different system prompts for writer vs first-review', async () => {
        const writerPrompt = await getAgentPrompt('writer', 'novel');
        const reviewPrompt = await getAgentPrompt('first-review', 'novel');
        expect(writerPrompt.system).not.toBe(reviewPrompt.system);
    });

    test('should return different tool for writer vs reviewer', async () => {
        const writerPrompt = await getAgentPrompt('writer', 'novel');
        const reviewPrompt = await getAgentPrompt('first-review', 'novel');
        expect(writerPrompt.tool).toBe('writer');
        expect(reviewPrompt.tool).toBe('reviewer');
    });

    test('should return different system for first-review vs second-review', async () => {
        const firstReview = await getAgentPrompt('first-review', 'novel');
        const secondReview = await getAgentPrompt('second-review', 'novel');
        expect(firstReview.system).not.toBe(secondReview.system);
    });

    test('should return different system for material-manager vs writer', async () => {
        const writerPrompt = await getAgentPrompt('writer', 'novel');
        const materialPrompt = await getAgentPrompt('material-manager', 'novel');
        expect(writerPrompt.system).not.toBe(materialPrompt.system);
        expect(materialPrompt.tool).toBe('material-manager');
    });
});

describe('agentPrompts - novel mode', () => {
    let listItemsSpy;
    let getItemSpy;

    beforeEach(() => {
        listItemsSpy = jest.spyOn(store, 'listItems').mockResolvedValue([]);
        getItemSpy = jest.spyOn(store, 'getItem').mockResolvedValue(null);
    });

    afterEach(() => {
        listItemsSpy.mockRestore();
        getItemSpy.mockRestore();
    });

    test('should return prompt for writer in novel mode', async () => {
        const prompt = await getAgentPrompt('writer', 'novel');
        expect(prompt).not.toBeNull();
        expect(prompt.system.length).toBeGreaterThan(0);
    });

    test('should return prompt for fast-review in novel mode', async () => {
        const prompt = await getAgentPrompt('fast-review', 'novel');
        expect(prompt).not.toBeNull();
    });
});

describe('agentPrompts - FALLBACK_AGENT_TEMPLATES', () => {
    test('should contain all standard agent types', () => {
        const expectedTypes = ['writer', 'reviser', 'first-review', 'second-review', 'final-editor', 'material-manager', 'fast-review', 'intent-planner'];
        for (const type of expectedTypes) {
            expect(FALLBACK_AGENT_TEMPLATES).toHaveProperty(type);
        }
    });

    test('each template should have agentType, system, role, and tool', () => {
        for (const [key, template] of Object.entries(FALLBACK_AGENT_TEMPLATES)) {
            expect(template).toHaveProperty('agentType');
            expect(template).toHaveProperty('system');
            expect(template).toHaveProperty('role');
            expect(template).toHaveProperty('tool');
        }
    });
});

describe('agentPrompts - CONSTRAINT_PRESETS', () => {
    test('should contain base constraint presets', () => {
        expect(Object.keys(CONSTRAINT_PRESETS).length).toBeGreaterThan(0);
    });

    test('should contain key constraint IDs', () => {
        expect(CONSTRAINT_PRESETS).toHaveProperty('no-derailment');
        expect(CONSTRAINT_PRESETS).toHaveProperty('character-consistency');
        expect(CONSTRAINT_PRESETS).toHaveProperty('worldview-consistency');
    });

    test('each preset should have label and desc', () => {
        for (const [id, preset] of Object.entries(CONSTRAINT_PRESETS)) {
            expect(preset).toHaveProperty('label');
            expect(preset).toHaveProperty('desc');
        }
    });
});

describe('agentPrompts - NOVEL_DEFAULT_CONSTRAINTS', () => {
    test('NOVEL_DEFAULT_CONSTRAINTS should be a non-empty array', () => {
        expect(Array.isArray(NOVEL_DEFAULT_CONSTRAINTS)).toBe(true);
        expect(NOVEL_DEFAULT_CONSTRAINTS.length).toBeGreaterThan(0);
    });
});

describe('agentPrompts - deduplicateSystemPrompt', () => {
    test('should remove duplicate word count instructions on separate lines', () => {
        const input = '第一段：\n【字数要求】目标2200字。\n第二段：\n【字数要求】目标2200字。';
        const result = deduplicateSystemPrompt(input, 'writer', {});
        const count = (result.match(/【字数要求】/g) || []).length;
        expect(count).toBe(1);
    });

    test('should collapse multiple blank lines', () => {
        const input = 'line1\n\n\n\nline2';
        const result = deduplicateSystemPrompt(input, 'writer', {});
        expect(result).not.toContain('\n\n\n');
    });

    test('should collapse multiple spaces', () => {
        const input = 'word1    word2';
        const result = deduplicateSystemPrompt(input, 'writer', {});
        expect(result).not.toContain('    ');
    });

    test('should not modify text without duplicates', () => {
        const input = 'Unique content without any duplicates at all.';
        const result = deduplicateSystemPrompt(input, 'writer', {});
        expect(result).toContain('Unique content without any duplicates at all.');
    });
});
