const GUIDE_DATA = {
    quickStart: {
        title: '快速开始',
        steps: [
            { step: 1, title: '配置API Key', description: '进入【设置】页面，填入阿里云百炼 API Key，点击测试连接确认可用', page: '/settings' },
            { step: 2, title: '一键生成小说', description: '进入【仪表盘】页面，点击新建项目，选择"模板一键生成"模式\n只需输入：小说名称 + 题材 + 核心元素\nAI将自动生成：世界观、人物卡、战力体系、主线任务、时间线、章节大纲', page: '/' },
            { step: 3, title: '设置写作风格', description: '进入【风格模板】页面，选择或创建写作风格模板\n支持：系统预设（5种） / 导入文本分析 / 从已定稿章节自动学习\n将风格应用到项目后，执笔人将严格按照风格规则创作', page: '/style-templates' },
            { step: 4, title: '启动流水线', description: '在流水线页面，选择要创作的章节，设置轮次数，启动自动化流水线\n流水线自动执行：执笔人→初审→复审→定稿→素材更新\n复审会检查风格符合度，不达标会打回重写', page: '/pipeline' },
            { step: 5, title: '审核与定稿', description: '流水线会自动经过5个Agent环节，你可以在各环节查看和手动干预\n定稿通过后，任务自动标记完成，时间线自动更新', page: '/pipeline' },
            { step: 6, title: '漫剧制作', description: '切换到漫剧模块，配置ComfyUI连接，创建工作流\n使用分镜管理编排画面，渲染队列生成图片和视频，最终导出漫剧', page: '/comic/config' }
        ]
    },
    templateGuide: {
        title: '模板一键生成',
        description: '只需3个输入，AI自动完成全部设定',
        inputs: [
            { name: '小说名称', required: true, description: '你的小说标题' },
            { name: '题材/类型', required: true, description: '10种预设题材可选，也支持自定义输入', options: ['玄幻修仙', '都市异能', '科幻未来', '武侠江湖', '灵异悬疑', '网游虚拟', '历史穿越', '奇幻冒险', '都市商战', '言情古言'] },
            { name: '核心元素', required: false, description: '根据题材自动推荐元素标签，最多选5个，也可自定义输入' },
            { name: '目标章节数', required: false, description: '默认100章' },
            { name: '目标字数', required: false, description: '如"300万"' },
            { name: '写作风格', required: false, description: '6种预设风格可选' },
            { name: '基调', required: false, description: '5种基调预设' },
            { name: '叙事视角', required: false, description: '4种视角预设' },
            { name: '世界设定方向', required: false, description: '如：末世废土、星际帝国' },
            { name: '核心冲突', required: false, description: '如：人类vs异族' },
            { name: '主题', required: false, description: '如：成长、自由、正义' }
        ],
        outputs: [
            { type: '素材库', count: '15-25条', items: ['世界观设定', '人物卡(5-8个)', '装备/道具(3-5件)', '人物关系网(2-3组)', '战力体系', '金句/热梗(5-8个)', '名场面(3-5个)', '主角成长史', '伏笔设计(5-8个)'] },
            { type: '主线任务', count: '3-5条', items: ['含2-4个子任务/条', '逻辑关联形成剧情链', '自动关联章节'] },
            { type: '时间线', count: '10-20条', items: ['7种事件类型', '关键事件标记', '故事内时间+地点'] },
            { type: '章节大纲', count: '前10章', items: ['每章200-500字大纲', '场景+人物+事件+伏笔'] }
        ]
    },
    styleTemplateGuide: {
        title: '写作风格模板',
        description: '定义风格规则，确保执笔人严格按风格创作',
        concepts: [
            { name: '为什么需要风格模板？', description: '没有风格模板时，执笔人使用默认风格写作，每次输出风格可能不一致。有了风格模板后，执笔人的每次创作都会被注入8条风格规则+禁止写法+风格示例，复审也会检查风格符合度。' },
            { name: '模板格式如何确保严格执行？', description: '风格模板包含8个维度规则，每个维度都是具体可执行的指令：\n1. 句式风格 - 控制句子长度、节奏、常用句式\n2. 段落风格 - 控制段落长度、结构、留白\n3. 对话风格 - 控制对话比例、风格、表达方式\n4. 描写风格 - 控制描写侧重、手法、细节程度\n5. 情感表达 - 控制内敛/外放、表达手法\n6. 节奏控制 - 控制快慢分布、高潮频率\n7. 词汇风格 - 控制常用词、修辞手法\n8. 禁止写法 - 严格禁止出现的写法（违反则复审打回）\n\n加上风格示例（few-shot），执笔人会模仿示例的写作方式。' },
            { name: '三种获取风格的方式', description: '1. 系统预设：5种内置风格（热血爽文/暗黑深沉/轻松幽默/唯美文艺/硬核写实）\n2. 导入分析：粘贴喜欢的小说文本（≥500字），AI自动分析提取风格规则\n3. 自动学习：从项目已定稿章节中学习风格，AI分析已有正文的写作特征' }
        ],
        workflow: [
            { step: 1, action: '创建或选择风格模板', description: '在风格模板页面，选择预设、导入分析或手动创建' },
            { step: 2, action: '应用到项目', description: '点击"应用到项目"按钮，将风格绑定到当前项目' },
            { step: 3, action: '启动流水线', description: '执笔人创作时自动注入风格规则，复审检查风格符合度' },
            { step: 4, action: '持续优化', description: '定稿几章后，使用"自动学习"从已定稿正文优化风格模板' }
        ]
    },
    aipyProGuide: {
        title: 'AiPy Pro 操作指南',
        description: '如何通过AiPy Pro调度自动化工作流',
        steps: [
            { step: 1, title: '安装MCP扩展', description: '将mcp-agents目录下的各Agent扩展复制到AiPy Pro扩展目录\nWindows: C:\\Users\\用户名\\AppData\\Roaming\\aipy-pro\\extensions\nmacOS: ~/Library/Application Support/aipy-pro/extensions\nLinux: ~/.config/aipy-pro/extensions' },
            { step: 2, title: '在AiPy Pro中描述需求', description: '在AiPy Pro对话中输入你的小说需求，例如：\n"我要写一部修仙小说，主角从凡人开始，经历各种磨难最终成仙。世界观包含五大洲，有完整的修炼体系。"\n\nAiPy Pro会自动调用对应的MCP工具来执行任务。' },
            { step: 3, title: '使用MCP工具调用', description: '可用工具：\n- write_chapter: 创作章节\n- first_review: 初审（素材比对）\n- second_review: 复审（逻辑字数+风格检查）\n- final_edit: 定稿（裁定+IP方向）\n- manage_materials: 素材管理\n\nAiPy Pro会按流水线顺序自动调度这些工具。' },
            { step: 4, title: '监控与干预', description: '在Web UI的流水线页面可以实时查看每个Agent的执行状态，也可以手动触发某个步骤或修改Agent设定。' }
        ]
    },
    pipelineFlow: {
        title: '流水线执行流程',
        flow: [
            { step: '一键生成/手动创建', agent: '用户', description: '输入名称+题材+元素，AI自动生成素材库、任务、时间线、大纲' },
            { step: '设置风格模板', agent: '用户', description: '选择/创建风格模板并应用到项目，确保执笔人按风格创作' },
            { step: '执笔人创作', agent: '执笔人', description: '阅读章节设定+风格规则→检索素材库→按风格创作正文' },
            { step: '初审审核', agent: '初审', description: '阅读正文→检索素材库比对→审核一致性' },
            { step: '复审审核', agent: '复审', description: '审核逻辑、字数、风格符合度（有风格模板时额外检查）' },
            { step: '定稿裁定', agent: '定稿人', description: '审核初审复审结果→裁定通过/驳回→IP方向规划→自动更新任务状态' },
            { step: '素材更新', agent: '素材管理员', description: '阅读定稿正文→更新/创建素材→自动创建时间线事件' },
            { step: '下一轮/下一章', agent: '系统', description: '未通过则重写，通过则进入下一章' }
        ]
    },
    comicGuide: {
        title: '漫剧模块操作指南',
        description: '从小说到漫剧的完整制作流程',
        steps: [
            { step: 1, title: '配置ComfyUI', description: '进入【ComfyUI配置】页面\n1. 设置ComfyUI安装路径（如 C:\\Romc7.9）\n2. 点击"启动ComfyUI"等待连接成功\n3. 确认VRAM显示正常\n4. 配置显存回收策略（建议：自动回收，空闲120秒，VRAM阈值75%）', page: '/comic/config' },
            { step: 2, title: '管理工作流', description: '进入【工作流管理】页面\n1. 系统内置LTX 2.3文生图和图生视频工作流\n2. 可调整参数：步数、CFG、maxShift、baseShift、视频长度、采样器\n3. 也可导入自定义ComfyUI工作流JSON', page: '/comic/workflows' },
            { step: 3, title: '创建分镜', description: '进入【分镜管理】页面\n1. 选择项目，为每个章节创建分镜\n2. 每个分镜包含：场景描述、角色、对白、镜头指示\n3. 可从小说章节内容自动生成分镜草稿\n4. 配置角色设计（文生图生成角色参考图）', page: '/comic/storyboard' },
            { step: 4, title: '生成画面', description: '在分镜管理页面操作：\n1. 角色设计：使用文生图生成角色参考图\n2. 场景图：使用文生图生成每个分镜的场景\n3. 视频：使用图生视频将场景图转为视频（25帧）\n4. 帧预览：播放/暂停/拖拽查看视频帧', page: '/comic/storyboard' },
            { step: 5, title: '渲染队列', description: '进入【渲染队列】页面\n1. 批量提交渲染任务\n2. 查看渲染进度和状态\n3. 渲染完成后预览结果', page: '/comic/render' },
            { step: 6, title: '导出漫剧', description: '进入【漫剧导出】页面\n1. 选择要导出的分镜\n2. 配置导出格式（视频/图片序列）\n3. 添加字幕、转场效果\n4. 导出最终漫剧作品', page: '/comic/export' }
        ],
        tips: [
            { title: '显存管理', description: '生成任务完成后，建议开启自动显存回收。手动回收可点击"释放显存"按钮。VRAM使用超过75%时会自动释放。' },
            { title: 'LTX 2.3模型要求', description: 'LTX 2.3需要：\n- UNET: LTX-2.3-distilled-Q8_0.gguf\n- Text Encoder: gemma_3_12B_it_fp8 + ltx-2.3_text_projection_bf16\n- VAE: LTX23_video_vae_bf16（128通道，不是ae.safetensors）' },
            { title: '角色一致性', description: '使用角色备份系统保存角色参考图，确保同一角色在不同分镜中外观一致。' }
        ]
    },
    agentRoles: {
        title: 'Agent角色说明',
        roles: [
            { name: '执笔人', type: 'writer', description: '负责根据章节大纲、素材库和风格模板创作正文', input: '章节大纲 + 素材库 + 风格模板规则', output: '小说正文（3000-5000字/章）', styleAware: true },
            { name: '初审', type: 'first-review', description: '审核正文与素材库的一致性', input: '正文 + 素材库', output: '审核结果（通过/问题/建议）' },
            { name: '复审', type: 'second-review', description: '审核逻辑、字数和风格符合度', input: '正文 + 初审结果 + 风格模板', output: '审核结果（通过/问题/建议/风格评分）', styleAware: true },
            { name: '定稿人', type: 'final-editor', description: '最高裁定权限，控制IP方向和进度，自动更新任务状态', input: '正文 + 初审 + 复审', output: '裁定结果 + IP方向 + 素材更新指引 + 任务状态更新' },
            { name: '素材管理员', type: 'material-manager', description: '管理和更新素材库，自动创建时间线事件', input: '定稿正文 + 素材更新指引', output: '素材更新/创建列表 + 时间线事件' }
        ]
    }
};

module.exports = { GUIDE_DATA };
