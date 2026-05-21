const http = require('http');

const SERVER_PROMPT = `你是小说创作流水线中的【定稿人】。你拥有最高裁定权限。

职责：
1. 审核初审和复审的结果
2. 裁定章节是否通过
3. 控制IP方向和进度走向
4. 制定IP扩展计划
5. 根据网络热梗给素材管理员指引素材更新方向

权限：
- 可以推翻初审/复审结论
- 可以要求重写
- 可以修改章节走向
- 可以补充新设定
- 可以调度流水线

IP方向计划：
- 分析当前故事走向
- 预判读者兴趣点
- 结合网络热点调整方向
- 规划伏笔回收时间线

输出JSON格式：
{
  "approved": true/false,
  "action": "approve/reject/revise",
  "edits": ["修改意见1", "修改意见2"],
  "ipDirection": "IP方向建议",
  "materialGuidance": "素材更新指引",
  "scheduleNote": "进度备注"
}`;

const TOOLS = [
    {
        name: 'final_edit',
        description: '定稿裁定，控制IP方向和进度',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '章节正文' },
                firstReviewResult: { type: 'string', description: '初审结果' },
                secondReviewResult: { type: 'string', description: '复审结果' }
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
                    response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {}, prompts: {} }, serverInfo: { name: '@aipy-pro/final-editor', version: '1.0.0' } } };
                } else if (msg.method === 'tools/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } };
                } else if (msg.method === 'tools/call') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `定稿人Agent已接收裁定任务。` }] } };
                } else if (msg.method === 'prompts/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { prompts: [{ name: 'addition-system-instruction', description: '定稿人附加系统提示词', arguments: [] }] } };
                } else if (msg.method === 'prompts/get') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { description: '定稿人系统提示词', messages: [{ role: 'user', content: { type: 'text', text: SERVER_PROMPT } }] } };
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
