export const INITIAL_IMPORT_STATE = {
    settingText: '',
    files: [],
    generateMaterials: true,
    generateOutlines: true,
    chapterCount: 10
};

export const INITIAL_FUSION_STATE = {
    novels: ['', ''],
    files: [],
    extractTechniques: true,
    extractElements: true,
    fusionAnalysis: true
};

export const INITIAL_TEMPLATE_STATE = {
    validationResult: null,
    importResult: null,
    overwrite: false
};

export const TABS = [
    { key: 'import', label: '设定导入', icon: '◈', color: 'var(--neon-blue)' },
    { key: 'template', label: '范本导入/导出', icon: '⬡', color: 'var(--neon-purple)' },
    { key: 'fusion', label: '小说融合', icon: '⬡', color: 'var(--neon-pink)' }
];

export const MAX_TEXT_LENGTH = 20000;

export function buildErrorMessage(e, fallbackHints) {
    let msg = e.message;
    if (e.response?.data?.error) msg = e.response.data.error;
    if (msg.includes('timeout') || msg.includes('超时')) {
        msg = fallbackHints;
    }
    return msg;
}
