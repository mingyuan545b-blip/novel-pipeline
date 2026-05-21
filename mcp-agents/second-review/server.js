const http = require('http');

const SERVER_PROMPT = `你是小说创作流水线中的【复审员】。你的职责是审核正文的逻辑、字数和风格。

审核要点：
- 情节逻辑是否通顺
- 前后章节是否连贯
- 字数是否达标（3000-5000字/章）
- 文风是否统一
- 节奏是否合理
- 是否有重复或冗余内容
- 伏笔回收是否合理
- 对话是否自然

输出JSON格式：
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "summary": "审核总结",
  "wordCount": 实际字数,
  "styleScore": 风格评分1-10
}`;

const TOOLS = [
    {
        name: 'second_review',
        description: '复审正文逻辑、字数和风格',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '章节正文' },
                firstReviewResult: { type: 'string', description: '初审结果' }
            },
            required: ['content']
        }
    }
];

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const msg = JSON.parse(body);
                let response;
                if (msg.method === 'initialize') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {}, prompts: {} }, serverInfo: { name: '@aipy-pro/second-review', version: '1.0.0' } } };
                } else if (msg.method === 'tools/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } };
                } else if (msg.method === 'tools/call') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `复审Agent已接收审核任务。` }] } };
                } else if (msg.method === 'prompts/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { prompts: [{ name: 'addition-system-instruction', description: '复审附加系统提示词', arguments: [] }] } };
                } else if (msg.method === 'prompts/get') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { description: '复审系统提示词', messages: [{ role: 'user', content: { type: 'text', text: SERVER_PROMPT } }] } };
                } else {
                    response = { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } };
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else { res.writeHead(404); res.end('Not Found'); }
});

server.listen(0, () => { console.log(server.address().port); });
