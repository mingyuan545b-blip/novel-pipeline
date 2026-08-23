export const API_BASE = '/api';

export const PROVIDER_LIST = [
    { key: 'aliyunCoding', name: '阿里云百炼(Coding Plan)', color: '#ff6a00', models: ['qwen3.6-plus'], needsGroupId: false, defaultModel: 'qwen3.6-plus' },
    { key: 'openai', name: 'OpenAI', color: '#10a37f', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'], needsGroupId: false, defaultModel: 'gpt-4o' },
    { key: 'deepseek', name: 'DeepSeek', color: '#4d6bfe', models: ['deepseek-chat', 'deepseek-reasoner'], needsGroupId: false, defaultModel: 'deepseek-chat' },
    { key: 'qwen', name: '通义千问', color: '#6f42c1', models: ['qwen-max', 'qwen-max-latest', 'qwen-plus', 'qwen-plus-latest', 'qwen-turbo', 'qwen-turbo-latest', 'qwen-long'], needsGroupId: false, defaultModel: 'qwen-max' },
    { key: 'zhipu', name: '智谱AI', color: '#3b5998', models: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-airx', 'glm-4-long', 'glm-4-flash', 'glm-4-flashx'], needsGroupId: false, defaultModel: 'glm-4-plus' },
    { key: 'moonshot', name: '月之暗面', color: '#8b5cf6', models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'], needsGroupId: false, defaultModel: 'moonshot-v1-128k' },
    { key: 'siliconflow', name: '硅基流动', color: '#f97316', models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/Qwen3-235B-A22B', 'Qwen/Qwen3-32B', 'Qwen/Qwen3.5-27B'], needsGroupId: false, defaultModel: 'deepseek-ai/DeepSeek-V3' },
    { key: 'custom', name: '自定义', color: '#888', models: [], needsGroupId: false, defaultModel: '' }
];

export const AGENT_TYPES = [
    { key: 'writer', label: '执笔人' },
    { key: 'first-review', label: '初审' },
    { key: 'second-review', label: '复审' },
    { key: 'final-editor', label: '定稿人' },
    { key: 'material-manager', label: '素材管理' },
    { key: 'consolidator', label: '整合编辑' }
];

export function getProvider(key) {
    return PROVIDER_LIST.find(p => p.key === key) || PROVIDER_LIST[0];
}
