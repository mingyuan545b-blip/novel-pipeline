const axios = require('axios');
const { getRateLimiter } = require('./rateLimiter');

const PROVIDERS = {
    minimax: {
        name: 'MiniMax',
        baseURL: 'https://api.minimaxi.com/v1',
        models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M1', 'MiniMax-Text-01'],
        needsGroupId: true,
        defaultModel: 'MiniMax-M2.7'
    },
    openai: {
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
        needsGroupId: false,
        defaultModel: 'gpt-4o'
    },
    deepseek: {
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com',
        models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-pro'],
        needsGroupId: false,
        defaultModel: 'deepseek-chat'
    },
    lmstudio: {
        name: 'LM Studio (本地)',
        baseURL: 'http://localhost:1234/v1',
        models: [],
        needsGroupId: false,
        defaultModel: ''
    },
    zhipu: {
        name: '智谱AI',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-airx', 'glm-4-long', 'glm-4-flash', 'glm-4-flashx'],
        needsGroupId: false,
        defaultModel: 'glm-4-plus'
    },
    moonshot: {
        name: '月之暗面',
        baseURL: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
        needsGroupId: false,
        defaultModel: 'moonshot-v1-128k'
    },
    siliconflow: {
        name: '硅基流动',
        baseURL: 'https://api.siliconflow.cn/v1',
        models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/Qwen3-235B-A22B', 'Qwen/Qwen3-32B', 'Qwen/Qwen3.5-27B'],
        needsGroupId: false,
        defaultModel: 'deepseek-ai/DeepSeek-V3'
    },
    aliyunCoding: {
        name: '阿里云百炼(Coding Plan)',
        baseURL: 'https://coding.dashscope.aliyuncs.com/v1',
        models: ['qwen3.6-plus'],
        needsGroupId: false,
        defaultModel: 'qwen3.6-plus'
    },
    custom: {
        name: '自定义',
        baseURL: '',
        models: [],
        needsGroupId: false,
        defaultModel: ''
    }
};

function getProviders() {
    return Object.entries(PROVIDERS).map(([key, val]) => ({
        key,
        name: val.name,
        baseURL: val.baseURL,
        models: val.models,
        needsGroupId: val.needsGroupId,
        defaultModel: val.defaultModel
    }));
}

function getProviderConfig(providerKey) {
    return PROVIDERS[providerKey] || null;
}

const llmConfig = require('./llmConfig');

function resolveConfig(apiConfig) {
    return llmConfig.resolveConfig(apiConfig);
}

async function chat(messages, options = {}) {
    if (options.apiConfig) {
        console.log(`[LLM-DEBUG] apiConfig input: provider=${options.apiConfig.provider}, model=${options.apiConfig.model}, baseURL=${options.apiConfig.baseURL}`);
    } else {
        console.log(`[LLM-DEBUG] apiConfig is ${options.apiConfig}, will use resolveStepConfig`);
    }
    const config = resolveConfig(options.apiConfig);
    console.log(`[LLM-DEBUG] resolved config: provider=${config.provider}, model=${config.model}, baseURL=${config.baseURL}`);
    const isLMStudio = config.provider === 'lmstudio';
    if (!config.apiKey && !isLMStudio) throw new Error('API Key not configured');
    if (isLMStudio && !config.baseURL) throw new Error('LM Studio baseURL not configured');

    const limiter = getRateLimiter(config.provider, { rpm: options.rpm, burst: options.burst });
    await limiter.acquire();

    const providerInfo = PROVIDERS[config.provider];
    const isMiniMax = config.provider === 'minimax';
    const maxRetries = options.maxRetries ?? 5;
    const retryDelay = options.retryDelay ?? 20000;

    const payload = {
        model: options.model || config.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 8192,
        stream: false
    };

    if (options.enableThinking === false) {
        payload.enable_thinking = false;
    }

    if (isMiniMax && config.groupId) {
        payload.group_id = config.groupId;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
    };

    if (isMiniMax && config.groupId) {
        headers['x-group-id'] = config.groupId;
    }

    const url = `${config.baseURL}/chat/completions`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(url, payload, { headers, timeout: options.timeout || 600000 });
            const data = response.data;
            const choice = data.choices?.[0];
            const msg = choice?.message;

            console.log(`[LLM] Provider: ${config.provider}, Model: ${data.model || config.model}, Finish: ${choice?.finish_reason}`);
            console.log(`[LLM] Content length: ${msg?.content?.length || 0}`);

            if (msg) {
                if (Array.isArray(msg.content)) {
                    msg.content = msg.content
                        .filter(block => block.type === 'text' && block.text)
                        .map(block => block.text)
                        .join('\n');
                    console.log(`[LLM] Converted array content to string, length: ${msg.content.length}`);
                }
                if (!msg.content && msg.reasoning_content) {
                    if (Array.isArray(msg.reasoning_content)) {
                        msg.reasoning_content = msg.reasoning_content
                            .filter(block => block.type === 'text' && block.text)
                            .map(block => block.text)
                            .join('\n');
                    }
                    msg.content = String(msg.reasoning_content);
                }
                if (msg.content && typeof msg.content === 'string') {
                    const thinkEnd = msg.content.indexOf('</think');
                    if (thinkEnd !== -1) {
                        const afterThink = msg.content.substring(thinkEnd);
                        const closeTag = afterThink.indexOf('>');
                        if (closeTag !== -1) {
                            const extracted = afterThink.substring(closeTag + 1).trim();
                            if (extracted.length > 0) {
                                msg.content = extracted;
                            } else {
                                const thinkStart = msg.content.indexOf('<think');
                                if (thinkStart > 0) {
                                    msg.content = msg.content.substring(0, thinkStart).trim();
                                }
                            }
                        }
                    } else if (msg.content.includes('<think')) {
                        const thinkStart = msg.content.indexOf('<think');
                        const beforeThink = msg.content.substring(0, thinkStart).trim();
                        if (beforeThink.length > 0) {
                            msg.content = beforeThink;
                        }
                    }
                }
            }

            if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
                const statusMsg = data.base_resp.status_msg || 'unknown error';
                const statusCode = data.base_resp.status_code;
                if ((statusCode === 2064 || statusCode === 529) && attempt < maxRetries) {
                    const delay = retryDelay * Math.pow(1.5, attempt - 1);
                    console.log(`[LLM] Server overloaded (code:${statusCode}), retry ${attempt}/${maxRetries} in ${Math.round(delay/1000)}s...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw new Error(`API returned error: ${statusMsg} (code: ${statusCode})`);
            }

            return data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error(`API 请求超时(600s)，请检查网络或减少请求内容长度`);
            }
            if (error.message.startsWith('API returned error')) throw error;

            const errMsg = error.response?.data?.error?.message
                || error.response?.data?.base_resp?.status_msg
                || error.response?.data?.message
                || error.message;
            const statusCode = error.response?.data?.error?.code
                || error.response?.data?.base_resp?.status_code
                || error.response?.status;

            const isOverloaded = statusCode === 529 || statusCode === 2064
                || (errMsg && (errMsg.includes('负载较高') || errMsg.includes('overloaded') || errMsg.includes('rate limit')));

            const isContextOverflow = errMsg && (
                errMsg.includes('context_length_exceeded') || errMsg.includes('maximum context length')
                || errMsg.includes('token limit exceeded') || errMsg.includes('too many tokens')
                || errMsg.includes('input is too long') || errMsg.includes('上下文长度超')
                || errMsg.includes('context window') && errMsg.includes('exceed')
                || errMsg.includes('reduce the length') && errMsg.includes('input')
                || (statusCode === 400 && errMsg.includes('context_length'))
            );

            if (isOverloaded && attempt < maxRetries) {
                const delay = retryDelay * Math.pow(1.5, attempt - 1);
                console.log(`[LLM] Server overloaded (code:${statusCode}), retry ${attempt}/${maxRetries} in ${Math.round(delay/1000)}s...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            if (isContextOverflow && !isOverloaded) {
                console.error(`[LLM] Context overflow detected: ${errMsg}`);
                const err = new Error(`CONTEXT_OVERFLOW: ${errMsg}`);
                err.isContextOverflow = true;
                err.statusCode = statusCode;
                throw err;
            }

            console.error(`[LLM] API Error: ${errMsg}, status: ${error.response?.status}`);
            throw new Error(`API Error (${config.provider}/${config.model}, code:${statusCode || 'unknown'}): ${errMsg}`);
        }
    }
}

async function testConnection(apiConfig) {
    try {
        let resolved = { ...apiConfig };
        if (!resolved.apiKey) {
            const p = resolved.provider;
            if (p === 'aliyunCoding') { resolved.apiKey = process.env.ALIYUN_CODING_API_KEY || ''; if (!resolved.model) resolved.model = process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus'; if (!resolved.baseURL) resolved.baseURL = 'https://coding.dashscope.aliyuncs.com/v1'; }
            else if (p === 'minimax') { resolved.apiKey = process.env.MINIMAX_API_KEY || ''; if (!resolved.model) resolved.model = process.env.MINIMAX_MODEL || 'MiniMax-M2.7'; if (!resolved.baseURL) resolved.baseURL = 'https://api.minimaxi.com/v1'; if (!resolved.groupId) resolved.groupId = process.env.MINIMAX_GROUP_ID || ''; }
            else if (p === 'lmstudio') { resolved.apiKey = 'lmstudio'; if (!resolved.model) resolved.model = process.env.LMSTUDIO_MODEL || 'default'; if (!resolved.baseURL) resolved.baseURL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'; }
            else if (p === 'siliconflow') { resolved.apiKey = process.env.SILICONFLOW_API_KEY || ''; if (!resolved.baseURL) resolved.baseURL = 'https://api.siliconflow.cn/v1'; }
            else if (p === 'deepseek') { resolved.apiKey = process.env.DEEPSEEK_API_KEY || ''; if (!resolved.baseURL) resolved.baseURL = 'https://api.deepseek.com'; }
        }
        const config = resolveConfig(resolved);
        if (!config.apiKey) return { success: false, message: 'API Key not configured' };
        const agentName = resolved?.agentLabel || config.provider;
        const modelName = config.model;
        const result = await chat(
            [{ role: 'system', content: '你必须严格按照指定格式回复，不要添加任何额外内容。' },
             { role: 'user', content: `严格按此格式回复，不要添加其他内容：我是${agentName}，我使用的是${modelName}模型` }],
            { maxTokens: 500, temperature: 0.01, apiConfig: resolved }
        );
        const content = result.choices?.[0]?.message?.content || '(empty response)';
        const actualModel = result.model || modelName;
        return {
            success: true,
            message: content,
            provider: config.provider,
            model: actualModel,
            agentLabel: agentName,
            response: content
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    getProviders,
    getProviderConfig,
    resolveConfig,
    chat,
    testConnection,
    PROVIDERS
};
