const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_PROMPT = `你是小说创作流水线中的【执笔人】。你的职责是根据章节大纲和素材库中的素材进行小说正文创作。

工作流程：
1. 阅读章节设定（大纲、场景需求、人物安排）
2. 从素材库中检索对应素材（世界观、人物卡、装备、关系等）
3. 基于素材进行创作，确保内容与已有设定一致
4. 创作时注意伏笔的埋设和回收

创作要求：
- 严格遵循素材库中的设定，不得随意篡改已有设定
- 人物性格、关系必须与素材库一致
- 战力体系必须与素材库匹配
- 场景描写需要参考素材库中的名场面设定
- 适当埋设伏笔，为后续章节做铺垫
- 字数要求：每章3000-5000字

输出格式：直接输出小说正文内容`;

const TOOLS = [
    {
        name: 'write_chapter',
        description: '根据章节大纲和素材库创作小说正文',
        inputSchema: {
            type: 'object',
            properties: {
                chapterNumber: { type: 'number', description: '章节号' },
                title: { type: 'string', description: '章节标题' },
                outline: { type: 'string', description: '章节大纲' },
                materials: { type: 'string', description: '相关素材JSON' },
                previousChapter: { type: 'string', description: '上一章内容摘要' },
                reviewFeedback: { type: 'string', description: '审核反馈（修改时使用）' }
            },
            required: ['chapterNumber', 'title', 'outline']
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
                    response = {
                        jsonrpc: '2.0',
                        id: msg.id,
                        result: {
                            protocolVersion: '2024-11-05',
                            capabilities: { tools: {}, prompts: {} },
                            serverInfo: { name: '@aipy-pro/writer', version: '1.0.0' }
                        }
                    };
                } else if (msg.method === 'tools/list') {
                    response = {
                        jsonrpc: '2.0',
                        id: msg.id,
                        result: { tools: TOOLS }
                    };
                } else if (msg.method === 'tools/call') {
                    response = {
                        jsonrpc: '2.0',
                        id: msg.id,
                        result: {
                            content: [{ type: 'text', text: `执笔人已接收创作任务，请通过Web UI流水线执行完整创作流程。章节信息：${JSON.stringify(msg.params?.arguments || {})}` }]
                        }
                    };
                } else if (msg.method === 'prompts/list') {
                    response = {
                        jsonrpc: '2.0',
                        id: msg.id,
                        result: {
                            prompts: [
                                {
                                    name: 'addition-system-instruction',
                                    description: '执笔人附加系统提示词',
                                    arguments: []
                                }
                            ]
                        }
                    };
                } else if (msg.method === 'prompts/get') {
                    response = {
                        jsonrpc: '2.0',
                        id: msg.id,
                        result: {
                            description: '执笔人系统提示词',
                            messages: [
                                { role: 'user', content: { type: 'text', text: SERVER_PROMPT } }
                            ]
                        }
                    };
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
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(0, () => {
    const port = server.address().port;
    console.log(port);
});
