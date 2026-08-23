const { PROVIDER_DEFAULTS } = require('./systemConfig');
const { DEFAULT_MODEL } = require('./modelResolver');

const PROVIDERS = {
    aliyunCoding: {
        id: 'aliyunCoding',
        aliases: ['aliyun-coding', 'aliyun_coding', 'aliyun'],
        name: '阿里云百炼(Coding Plan)',
        baseURL: PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL,
        models: [DEFAULT_MODEL],
        defaultModel: DEFAULT_MODEL,
        needsGroupId: false,
        envKey: 'ALIYUN_CODING_API_KEY',
        envModel: 'ALIYUN_CODING_MODEL',
        envBaseURL: 'ALIYUN_CODING_BASE_URL',
        tpmLimit: 500000
    },
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        baseURL: PROVIDER_DEFAULTS.DEEPSEEK_BASE_URL,
        models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-pro'],
        defaultModel: 'deepseek-chat',
        needsGroupId: false,
        envKey: 'DEEPSEEK_API_KEY',
        envModel: 'DEEPSEEK_MODEL',
        envBaseURL: 'DEEPSEEK_BASE_URL'
    },
    siliconflow: {
        id: 'siliconflow',
        name: '硅基流动',
        baseURL: PROVIDER_DEFAULTS.SILICONFLOW_BASE_URL,
        models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/Qwen3-235B-A22B', 'Qwen/Qwen3-32B', 'Qwen/Qwen3.5-27B'],
        defaultModel: 'deepseek-ai/DeepSeek-V3',
        needsGroupId: false,
        envKey: 'SILICONFLOW_API_KEY',
        envModel: 'SILICONFLOW_MODEL'
    },
    zhipu: {
        id: 'zhipu',
        name: '智谱AI',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-airx', 'glm-4-long', 'glm-4-flash', 'glm-4-flashx'],
        defaultModel: 'glm-4-plus',
        needsGroupId: false,
        envKey: 'ZHIPU_API_KEY',
        envModel: 'ZHIPU_MODEL'
    },
    moonshot: {
        id: 'moonshot',
        name: '月之暗面',
        baseURL: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
        defaultModel: 'moonshot-v1-128k',
        needsGroupId: false,
        envKey: 'MOONSHOT_API_KEY',
        envModel: 'MOONSHOT_MODEL'
    },
    custom: {
        id: 'custom',
        name: '自定义',
        baseURL: '',
        models: [],
        defaultModel: '',
        needsGroupId: false
    }
};

const DEFAULT_STEP_ASSIGNMENTS = {
    aliyunCoding: ['writer', 'reader', 'reviser', 'intent-planner', 'material-manager', 'material-organizer', 'polisher', 'first-review', 'second-review', 'fast-review', 'final-editor']
};

module.exports = { PROVIDERS, DEFAULT_STEP_ASSIGNMENTS };
