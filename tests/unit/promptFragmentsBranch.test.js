/**
 * promptFragments.js branch coverage tests
 * Covers: resolve, resolveWithProject, render, renderWithProject,
 *         renderForStyleProfile, buildCreationStandards, buildCreationStandardsWithProject
 */
jest.mock('../../server/services/genreConfig', () => ({
    detectGenre: jest.fn(),
    getGenreById: jest.fn()
}));

jest.mock('../../server/store', () => ({
    queryItems: jest.fn()
}));

const { detectGenre, getGenreById } = require('../../server/services/genreConfig');
const store = require('../../server/store');
const pf = require('../../server/config/promptFragments');

const MOCK_GENRE = {
    id: 'test-genre',
    label: 'Test Genre',
    characterProfile: {
        protagonistTags: ['姓名', '年龄'],
        protagonistWordCount: 500,
        protagonistExample: '主角示例文本',
        supportingTags: ['姓名'],
        supportingWordCount: 300,
        supportingExample: '配角示例',
        npcTags: ['姓名'],
        npcWordCount: 100,
        npcExample: '',
        supportingWriterPrinciples: '深度写作原则',
        worldviewTemplate: '世界观模板',
        namingTemplate: '命名模板',
        flavorTemplate: '风味模板'
    },
    materialRules: {
        worldview: '必须包含世界边界',
        'power-system': '必须包含升级条件',
        foreshadowing: '必须包含回收窗口'
    }
};

const MINIMAL_GENRE = {
    id: 'minimal-genre',
    label: 'Minimal'
};

describe('promptFragments.resolve', () => {
    test('resolves all variables from genre with full profile', () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        const vars = pf.resolve('test-genre');
        expect(vars.PROTAGONIST_TAGS).toBe('姓名\n年龄');
        expect(vars.PROTAGONIST_WORD_COUNT).toBe(500);
        expect(vars.PROTAGONIST_EXAMPLE).toBe('主角示例文本');
        expect(vars.SUPPORTING_TAGS).toBe('姓名');
        expect(vars.SUPPORTING_WORD_COUNT).toBe(300);
        expect(vars.NPC_TAGS).toBe('姓名');
        expect(vars.NPC_WORD_COUNT).toBe(100);
        expect(vars.WORLDVIEW_RULE).toBe('必须包含世界边界');
        expect(vars.POWER_SYSTEM_RULE).toBe('必须包含升级条件');
        expect(vars.FORESHADOWING_RULE).toBe('必须包含回收窗口');
        expect(vars.IS_DEPTH_PROFILE).toBe(true);
        expect(vars.WORLDVIEW_TEMPLATE).toBe('世界观模板');
        expect(vars.NAMING_TEMPLATE).toBe('命名模板');
        expect(vars.FLAVOR_TEMPLATE).toBe('风味模板');
    });

    test('uses defaults for genre without profile', () => {
        getGenreById.mockReturnValue(MINIMAL_GENRE);
        const vars = pf.resolve('minimal-genre');
        expect(vars.PROTAGONIST_TAGS).toBe('');
        expect(vars.PROTAGONIST_WORD_COUNT).toBe(400);
        expect(vars.SUPPORTING_WORD_COUNT).toBe(250);
        expect(vars.NPC_WORD_COUNT).toBe(80);
        expect(vars.WORLDVIEW_RULE).toBe('必须包含 边界条件 + 违反后果');
        expect(vars.IS_DEPTH_PROFILE).toBe(false);
    });

    test('handles null genre', () => {
        getGenreById.mockReturnValue(null);
        const vars = pf.resolve('nonexistent');
        expect(vars.PROTAGONIST_WORD_COUNT).toBe(400);
        expect(vars.PROTAGONIST_TAGS).toBe('');
    });
});

describe('promptFragments.resolveWithProject', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    test('returns base vars when no projectId', async () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        const vars = await pf.resolveWithProject('test-genre', null);
        expect(vars.PROTAGONIST_EXAMPLE).toBe('主角示例文本');
    });

    test('replaces protagonist example from entity-registry', async () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        store.queryItems.mockResolvedValue([
            { roleLevel: 'protagonist', content: 'A'.repeat(100) },
            { roleLevel: 'supporting', content: 'B'.repeat(50) }
        ]);
        const vars = await pf.resolveWithProject('test-genre', 'proj-1');
        expect(vars.PROTAGONIST_EXAMPLE).toBe('A'.repeat(100));
        expect(vars.SUPPORTING_EXAMPLE).toBe('B'.repeat(50));
    });

    test('keeps base example when entity content too short', async () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        store.queryItems.mockResolvedValue([
            { roleLevel: 'protagonist', content: 'short' }
        ]);
        const vars = await pf.resolveWithProject('test-genre', 'proj-1');
        expect(vars.PROTAGONIST_EXAMPLE).toBe('主角示例文本');
    });

    test('returns base vars when store returns empty', async () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        store.queryItems.mockResolvedValue([]);
        const vars = await pf.resolveWithProject('test-genre', 'proj-1');
        expect(vars.PROTAGONIST_EXAMPLE).toBe('主角示例文本');
    });

    test('returns base vars when store throws', async () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        store.queryItems.mockRejectedValue(new Error('DB error'));
        const vars = await pf.resolveWithProject('test-genre', 'proj-1');
        expect(vars.PROTAGONIST_EXAMPLE).toBe('主角示例文本');
    });
});

describe('promptFragments.render', () => {
    test('replaces all known variables', () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        const template = '{{PROTAGONIST_TAGS}}-{{PROTAGONIST_WORD_COUNT}}';
        const result = pf.render(template, 'test-genre');
        expect(result).toBe('姓名\n年龄-500');
    });

    test('leaves unknown variables as-is', () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        const template = '{{UNKNOWN_VAR}}-{{PROTAGONIST_WORD_COUNT}}';
        const result = pf.render(template, 'test-genre');
        expect(result).toBe('{{UNKNOWN_VAR}}-500');
    });
});

describe('promptFragments.renderWithProject', () => {
    test('replaces variables with project data', async () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        store.queryItems.mockResolvedValue([]);
        const template = '{{PROTAGONIST_WORD_COUNT}}-{{SUPPORTING_WORD_COUNT}}';
        const result = await pf.renderWithProject(template, 'test-genre', 'proj-1');
        expect(result).toBe('500-300');
    });
});

describe('promptFragments.renderForStyleProfile', () => {
    test('detects genre from styleProfile and renders', () => {
        detectGenre.mockReturnValue('test-genre');
        getGenreById.mockReturnValue(MOCK_GENRE);
        const template = '{{PROTAGONIST_WORD_COUNT}}';
        const result = pf.renderForStyleProfile(template, { key: 'test-genre' });
        expect(result).toBe('500');
    });
});

describe('promptFragments.buildCreationStandards', () => {
    test('renders CREATION_STANDARDS_TEMPLATE', () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        const result = pf.buildCreationStandards('test-genre');
        expect(result).toContain('姓名\n年龄');
        expect(result).toContain('500');
        expect(result).toContain('深度写作原则');
    });
});

describe('promptFragments.buildCreationStandardsWithProject', () => {
    test('renders template with project data', async () => {
        getGenreById.mockReturnValue(MOCK_GENRE);
        store.queryItems.mockResolvedValue([]);
        const result = await pf.buildCreationStandardsWithProject('test-genre', 'proj-1');
        expect(result).toContain('姓名\n年龄');
    });
});
