const http = require('http');

const SERVER_PROMPT = `你是小说创作流水线中的【初审员】。你的职责是审核正文内容与素材库的一致性。

工作流程：
1. 阅读正文内容
2. 去素材库检索相关素材（人物、装备、战力、关系等）
3. 比对正文与素材库设定是否一致

审核要点：
- 人物设定是否与素材库一致（性格、外貌、能力等）
- 装备描述是否与素材库匹配
- 战力体系是否合理且一致
- 人物关系是否正确
- 世界观设定是否被遵守
- 是否有逻辑矛盾

输出JSON格式：
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "summary": "审核总结"
}`;

const TOOLS = [
    {
        name: 'first_review',
        description: '审核正文与素材库的一致性',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '章节正文' },
                materials: { type: 'string', description: '相关素材JSON' }
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
                    response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {}, prompts: {} }, serverInfo: { name: '@aipy-pro/first-review', version: '1.0.0' } } };
                } else if (msg.method === 'tools/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } };
                } else if (msg.method === 'tools/call') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `初审Agent已接收审核任务。` }] } };
                } else if (msg.method === 'prompts/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { prompts: [{ name: 'addition-system-instruction', description: '初审附加系统提示词', arguments: [] }] } };
                } else if (msg.method === 'prompts/get') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { description: '初审系统提示词', messages: [{ role: 'user', content: { type: 'text', text: SERVER_PROMPT } }] } };
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
