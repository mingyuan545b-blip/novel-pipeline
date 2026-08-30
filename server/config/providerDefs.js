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
    lmstudio: {
        id: 'lmstudio',
        aliases: ['lm-studio', 'lm_studio', 'local'],
        name: 'LM Studio(本地)',
        baseURL: '',
        models: ['qwen3.8-27b'],
        defaultModel: 'qwen3.8-27b',
        needsGroupId: false,
        envKey: 'LMSTUDIO_API_KEY',
        envModel: 'LMSTUDIO_MODEL',
        envBaseURL: 'LMSTUDIO_BASE_URL',
        // llama.cpp系本地服务的思考模型无法用API参数关闭思考，
        // 必须在末条user消息追加该标记（陷阱#94：思考吃光max_tokens导致正文为空）。
        // 实测复杂prompt下软标记可能失效（8184思考tokens），需同时在system追加硬指令双保险
        noThinkMarker: ' /no_think',
        noThinkSystemDirective: '【输出纪律】直接输出最终结果，禁止输出任何思考过程、分析或自我对话。',
        // 本地模型生成速度远低于云端（约6tok/s），单次请求超时放宽到30分钟
        requestTimeoutMs: 1800000
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

// 步骤分配按对象键顺序匹配（首个有API Key的provider生效）：
// lmstudio在前=配置了LMSTUDIO_API_KEY时全流程优先走本地模型；
// 未配置则自动落到aliyunCoding云端（向后兼容）。
const DEFAULT_STEP_ASSIGNMENTS = {
    lmstudio: ['writer', 'reader', 'reviser', 'intent-planner', 'material-manager', 'material-organizer', 'polisher', 'first-review', 'second-review', 'fast-review', 'final-editor'],
    aliyunCoding: ['writer', 'reader', 'reviser', 'intent-planner', 'material-manager', 'material-organizer', 'polisher', 'first-review', 'second-review', 'fast-review', 'final-editor']
};

module.exports = { PROVIDERS, DEFAULT_STEP_ASSIGNMENTS };
