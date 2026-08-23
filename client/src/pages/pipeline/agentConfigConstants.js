/**
 * agentConfigConstants — Agent步骤与Provider配置
 * defaultModel从PROVIDER_DEFAULTS派生，不再独立硬编码
 */
export const PROVIDER_DEFAULTS = {
    aliyunCoding: { model: 'qwen3.6-plus', baseURL: 'https://coding.dashscope.aliyuncs.com/v1' },
    siliconflow: { model: 'deepseek-ai/DeepSeek-V3', baseURL: 'https://api.siliconflow.cn/v1' },
    deepseek: { model: 'deepseek-chat', baseURL: 'https://api.deepseek.com' },
    qwen: { model: 'qwen-max', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    custom: { model: '', baseURL: '' },
};

const DEFAULT_PROVIDER = 'aliyunCoding';

export const AGENT_STEPS = [
    { step: 'writer', label: '执笔人', defaultProvider: DEFAULT_PROVIDER },
    { step: 'reviser', label: '返修员', defaultProvider: DEFAULT_PROVIDER },
    { step: 'intent-planner', label: '意图规划', defaultProvider: DEFAULT_PROVIDER },
    { step: 'first-review', label: '初审', defaultProvider: DEFAULT_PROVIDER },
    { step: 'second-review', label: '复审', defaultProvider: DEFAULT_PROVIDER },
    { step: 'final-editor', label: '定稿人', defaultProvider: DEFAULT_PROVIDER },
    { step: 'material-manager', label: '素材管理员', defaultProvider: DEFAULT_PROVIDER },
    { step: 'polisher', label: '润色师', defaultProvider: DEFAULT_PROVIDER },
    { step: 'fast-review', label: '快审', defaultProvider: DEFAULT_PROVIDER },
    { step: 'reader', label: '阅读者', defaultProvider: DEFAULT_PROVIDER },
].map(s => ({ ...s, defaultModel: PROVIDER_DEFAULTS[s.defaultProvider]?.model || '' }));

export const PROVIDER_OPTIONS = [
    { value: 'aliyunCoding', label: '阿里云百炼(Coding Plan)' },
    { value: 'siliconflow', label: '硅基流动' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'qwen', label: '通义千问' },
    { value: 'custom', label: '自定义' },
];
