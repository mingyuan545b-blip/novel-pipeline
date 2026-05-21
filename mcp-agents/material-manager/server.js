const http = require('http');

const SERVER_PROMPT = `你是小说创作流水线中的【素材管理员】。你的职责是管理和更新素材库。

工作流程：
1. 阅读定稿后的正文
2. 检查是否有需要更新的素材
3. 创造新出现的素材条目
4. 根据定稿人指引搜索网络热梗/新词/名场景
5. 更新素材库

素材类型：
- worldview: 世界观（只更新不重建）
- character: 人物卡
- equipment: 装备
- relationship: 人物关系
- power-system: 战力体系
- catchphrase: 金句/热梗/抽象词
- famous-scene: 名场面/场景
- growth-history: 成长史
- foreshadowing: 伏笔
- sub-plane: 次位面
- faction: 势力
- institution: 机构
- other: 其他

【层级归属铁律 - 违反即拦截，系统拒绝创建无归属素材】
素材层级结构：
  主世界 → 势力(faction, parentPlane=null) → 人物(character, parentFaction=势力ID)
  次位面(sub-plane) → 势力(faction, parentPlane=次位面ID) → 人物(character, parentFaction=势力ID, parentPlane=次位面ID)

创建新素材时必须包含归属字段：
- faction(势力): 必须有parentPlane（主世界势力parentPlane=null，次位面势力parentPlane=次位面素材ID）
- character(人物): 必须有parentFaction（所属势力素材ID）；若势力属于次位面，还必须有parentPlane
- institution(机构): 必须有parentPlane
- equipment(道具): 若属于次位面，需有parentPlane
- sub-plane(次位面): 无需parentPlane

禁止创建无归属的势力或人物。缺失归属字段的素材将被系统拒绝创建。

更新规则：
- 世界观只做增量更新，不覆盖已有设定
- 其他素材记录初始状态和当前变化
- 每次更新记录变更原因
- 搜索网络热梗时关注与题材相关的内容

输出JSON格式：
{
  "updates": [
    {
      "type": "素材类型",
      "name": "素材名称",
      "action": "create/update",
      "content": "素材内容",
      "reason": "更新原因",
      "parentPlane": "所属位面ID（faction/character/institution必填，主世界为null）",
      "parentFaction": "所属势力ID（character必填）"
    }
  ],
  "newMaterials": [],
  "trendingSearch": "搜索到的热梗/新词"
}`;

const TOOLS = [
    {
        name: 'manage_materials',
        description: '管理和更新素材库',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '定稿正文' },
                materialGuidance: { type: 'string', description: '定稿人素材更新指引' },
                existingMaterials: { type: 'string', description: '现有素材库JSON' }
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
                    response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {}, prompts: {} }, serverInfo: { name: '@aipy-pro/material-manager', version: '1.0.0' } } };
                } else if (msg.method === 'tools/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } };
                } else if (msg.method === 'tools/call') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `素材管理员Agent已接收素材更新任务。` }] } };
                } else if (msg.method === 'prompts/list') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { prompts: [{ name: 'addition-system-instruction', description: '素材管理员附加系统提示词', arguments: [] }] } };
                } else if (msg.method === 'prompts/get') {
                    response = { jsonrpc: '2.0', id: msg.id, result: { description: '素材管理员系统提示词', messages: [{ role: 'user', content: { type: 'text', text: SERVER_PROMPT } }] } };
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
