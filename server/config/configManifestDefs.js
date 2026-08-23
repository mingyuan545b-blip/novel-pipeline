const { PROVIDER_DEFAULTS, SERVER_DEFAULTS } = require('./systemConfig');
const { DEFAULT_MODEL } = require('./modelResolver');

const CONFIG_MANIFEST = [
    { key: 'LLM_PROVIDER', label: 'LLM提供商', category: 'llm', required: true, sensitive: false, default: PROVIDER_DEFAULTS.DEFAULT_PROVIDER, description: '当前使用的LLM提供商', recommendation: '设为 aliyunCoding（阿里云百炼Coding Plan）' },
    { key: 'ALIYUN_CODING_API_KEY', label: '阿里云百炼API密钥', category: 'llm', required: true, sensitive: true, default: '', description: '全系统唯一LLM密钥，删除后所有AI生成功能报废', recommendation: '在阿里云百炼控制台获取，以sk-sp-开头' },
    { key: 'ALIYUN_CODING_MODEL', label: '阿里云模型', category: 'llm', required: false, sensitive: false, default: DEFAULT_MODEL, description: '阿里云百炼使用的模型名称', recommendation: `默认 ${DEFAULT_MODEL}` },
    { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API密钥', category: 'llm', required: false, sensitive: true, default: '', description: 'DeepSeek API密钥（备选provider）', recommendation: '如使用DeepSeek则配置' },
    { key: 'DEEPSEEK_MODEL', label: 'DeepSeek模型', category: 'llm', required: false, sensitive: false, default: 'deepseek-chat', description: 'DeepSeek使用的模型名称' },
    { key: 'SILICONFLOW_API_KEY', label: '硅基流动API密钥', category: 'llm', required: false, sensitive: true, default: '', description: '硅基流动API密钥（备选provider）' },
    { key: 'REQUEST_SECRET', label: 'API认证密钥', category: 'security', required: false, sensitive: true, default: '', description: '前后端API通信认证密钥，未配置时每次重启随机生成', recommendation: '设为固定值以避免重启后需重新登录' },
    { key: 'ENCRYPTION_SECRET', label: '加密密钥', category: 'security', required: false, sensitive: true, default: '', description: 'API Key加密存储密钥，未配置时API Key明文存储', recommendation: '至少32字符的强随机字符串' },
    { key: 'PORT', label: '服务器端口', category: 'server', required: false, sensitive: false, default: String(SERVER_DEFAULTS.DEFAULT_PORT), description: '后端服务监听端口' },
    { key: 'USE_PG', label: '使用PostgreSQL', category: 'database', required: false, sensitive: false, default: 'false', description: 'true=PostgreSQL, false=JSON文件存储' },
    { key: 'DATABASE_URL', label: '数据库连接字符串', category: 'database', required: false, sensitive: true, default: '', description: 'PostgreSQL连接字符串（USE_PG=true时必填）', recommendation: '格式: postgresql://user:pass@host:5432/dbname' },
    { key: 'LOG_LEVEL', label: '日志级别', category: 'logging', required: false, sensitive: false, default: 'info', description: '日志输出级别', recommendation: '可选: debug, info, warn, error' }
];

module.exports = { CONFIG_MANIFEST };
