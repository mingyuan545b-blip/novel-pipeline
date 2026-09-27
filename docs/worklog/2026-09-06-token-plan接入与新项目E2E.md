# Token Plan网关接入 + 新项目全流程E2E 工作日志
> 目标：接入阿里云Token Plan(qwen3.8-flash) → 新建项目跑通 大纲→素材→3章流水线→素材库更新→归档 → 前端数据关联验证。开始：2026-09-06。状态：进行中。

## 已证实事实（每条带证据）
- [09-06] **根因实锤：Windows User级环境变量残留旧38字符ALIYUN_CODING_API_KEY**，dotenv默认不覆盖已存在变量 → .env新key永不生效。证据：node检key长度=38(env) vs .env文件内=116；`[Environment]::GetEnvironmentVariable(...,'User')`长度38。
  - 修复：server/index.js + scripts/serverStart.js 的 dotenv.config 加 `override:true`（.env成为唯一事实源）。
  - 遗留：User级旧变量本身未删（全局配置改动需用户确认；override后已无害，但建议删）。
- [09-06] 用户提供的sk-sp-key在旧端点 `coding.dashscope.aliyuncs.com/v1` 被拒：chat/completions→invalid_api_key，Anthropic协议/v1/messages与/v1/models→405 "Coding Plan is currently only available for Coding Agents"。DeepSeek key也已失效(401)。
- [09-06] **正确网关=`https://token-plan.cn-beijing.maas.aliyuncs.com`**（读自用户~/.claude/settings.json，Claude Code同源）：
  - `/apps/anthropic/v1/messages` → 200（Claude Code协议）
  - `/compatible-mode/v1/chat/completions` → 200（**OpenAI兼容，novel-pipeline零代码改动接入**）
- [09-06] .env已配置：ALIYUN_CODING_BASE_URL=token-plan网关compatible-mode + MODEL=qwen3.8-flash。
- [09-06] 全链路验证PASS：tmp_verify_aliyun.js → max 0.6s / flash 0.4s，finish=stop，enable_thinking:false被尊重（无思考爆炸，#94不适用此网关）。
- [09-06] qwen3.8-flash不在CONTEXT_BUDGET_MODELS表 → 走default(32K/输出4K)。保守可用；Phase1.1收口时补flash/max条目并与MODEL_BUDGETS合并单一数据源。
- [09-06 E2E-run1] 新项目"仙师好评"(f48c77ad)全流程4.6min（本地27B同流程120min）：素材24s✅ 大纲13s✅ 第2章✅2761字1.8min含素材库更新；第1章❌2170字/第3章❌1715字，均"3轮审核未过(writer)"。
- [09-06 根因确诊] 字数类退回的重试回路失效（**与本地RUN3三连败同根因，模型无关**）：
  - 排除项：writer预算32768充足；网关尊重enable_thinking:false（探测实测reasoning=0）；非速度问题。
  - 病根①：ch1(2157字≥rejectMin2000)第2轮起被升级为reviser，但reviser角色=精准修改，扩写指令仅一句含糊规则4 → 只+13字(2170)，第3轮0变化，平台期耗死3轮。
  - 病根②：ch3(1715<2000)走writer重写路径，_appendRoundContext有"扩展每个场景"类指令但无数学量 → flash照写~1715不变。
  - 结论：flash/27B级模型不会从含糊指令自主扩足，必须显式数学量+结构化清单。
- [09-06 修复] 新建统一构建器 `steps/expansionInstructionBuilder.js`（唯一判定源，符合项目统一构建器惯例）：缺口字数+30%余量新增目标+三手法清单(对话扩写/感官补全/情节利用)+模式区分(reviser只增不删/writer以原稿为基础)+输出前自查。接入两处消费方：writerPromptBuilder._appendRoundContext（rewrite模式）+ reviserPrompt.buildReviserContext（revise模式，resolveConfig取word配置）。单测12/12绿+相关套件39/39绿。文件行数52/184/132全部≤200铁律内。
- [09-06 三档字数设计确认] targetMin=2500(通过线)/rejectMin=2000(硬拒线)/之间=reviser可救区。设计合理，缺的是救区的扩写执行力。

## 当前进展
- ✅ Phase0 密钥接入+连通验证（含根因定位：环境变量遮蔽+端点迁移）
- 🔄 新建项目E2E：**projectId=f48c77ad-f289-4166-ab64-e1143be0a014**（仙师好评_云端E2E_2026-09-061523）
  - ✅ 素材生成24.0s（本地27B对比：1799s被取消）✅ 大纲13.0s质量在线 🔄 第1章流水线 taskId=task_1788708255864_kt8t0k
- [09-06 rerun-v2] 抢救区修复生效实证：ch1走"writer拒→reviser扩写"路径，2264→**2702字**（+438，扩写指令被服从）。新拦截点=first-review hardBlock"敏感词拦截"（命中词"摸胸"×1，flash写的擦边玩笑）。
- [09-06 根因④] 敏感词反馈只说"发现1处"不含命中词→返修员无从修起（两轮无效）。审计系统(auditMethods/hardBlockChecks)均带命中词，唯pipeline侧firstReviewChecks不带——**两套系统未对齐（PROJECT_STANDARDS原则8违例）**。修复：反馈带命中词列表+改写指引。
- [09-06 根因⑤] 重跑即熔断："流水线熔断暂停"。熔断器`isTripped && round>=5`用**绝对轮次**，而startRound=chapter.round+1跨run累计（重置前已到7+）→续跑章节首个告警即停线。修复：改相对轮次`(round-startRound+1)>=5`；解锁走官方`POST /api/chapters/:id/reset`（清round/内容/级联+重置metrics与熔断器）。
- [09-06 根因⑥] v4重跑：reviser首轮扩写+0字（2257→2257）却标passed，白烧轮次（flash扩写服从性波动：v2同路径+438）。修复：**步内升级重试**——reviser.js在扩写任务未达标时立即带失败事实重试一次（buildEscalationNote明示差距+作废警告），取更长者；判定函数needsExpansionRetry/buildEscalationNote入统一构建器。单测49/49绿。
- [09-06 UI修复] 用户报告执行日志无章节/轮次+5个归档步骤英文无图标：①persistPipelineLog单点补chapterNumber ②executeStep落盘打round标 ③前端pipelineConstants补5步骤中文名+图标（素材整理🗂️/素材登记📇/知识抽取🧠/一致性校验⚖️/伏笔预算更新🪝）④服务端AGENT_ROLE_NAMES同步补齐。前端测试26/26绿。
- [09-06 新发现待办] genre标签异常：ASSEMBLE日志genreLabel="万界debug·反套路喜剧"（crossplane题材的label）但项目subGenre=high-martial-comedy且styleProfile.genre="高武"——agentPromptAssembler的genre解析路径疑似用了detectGenre(styleProfile)而非resolveGenreFromProject（违反sop/01原则3），连带worldScope模块hook报错"getWorldScopeForPrompt is not a function"。P1待查。
- [09-06 v5结果] ch1三轮：1618→1618→**2213字**（第3轮attempt=2升级标记生效+595字），但maxRounds=3耗尽仍<2500 → failed；ch3被reset后重跑仍writer字数不足+WR-IN-005级联。**漏斗机制全部验证工作，只差轮次预算**。
- [09-06 网关探测] 同请求两次输出不同（167/129字）→ token-plan网关**无响应缓存、temperature=0.8生效**；R1/R2同字数属巧合或模型吸引子，非缓存。
- [09-06 状态调整] 项目settings.chapterRounds已3→5（官方PUT接口）；tmp_rerun_chapters.js的maxRounds已3→5。当前章节态：ch1 outlined wc=2213 round=3（**在抢救区≥2000，续跑即走reviser扩写+步内重试**）；ch2 material-updated wc=2761 ✅；ch3 outlined wc=0 round=0（等ch1的material-manager落库解WR-IN-005）。
- [09-06 小bug记录] ①章节reset接口cascadeCleanup报"materialIndex is not a constructor"（非阻塞，重置主流程成功）②genre标签异常（万界debug·反套路喜剧，见上）③runAgent日志budget=128000（flash按128K解析，CONTEXT_BUDGET_MODELS无flash条目但走了别的解析路径，Phase1.1收口时一并查）。
- [09-06 安全] 用户提供的sk-sp-key已明文出现在对话中，E2E验证完成后应提醒用户到百炼控制台轮换；Windows User级环境变量残留旧38字符ALIYUN_CODING_API_KEY（override:true后无害，建议用户删除，属全局配置改动需确认）。
- 🔄 全量单测后台跑：`output/unit-full-0906.log`
- ⬜ 前端数据关联验证（项目/章节/素材/实体中心/知识库/电路图/藏经阁/审核记录各页面API）
- ⬜ 提交（dotenv override×2 + expansionInstructionBuilder + 2消费方 + 单测 + tmp脚本，走五关门禁）+ SESSION-STATE刷新
- ⬜ 用户提出的待办：pipeline"前章失败即暂停后续章"策略开关（生产模式下第N+1章不应踩在未approved的第N章草稿上）

## 恢复锚点（下个窗口从这里继续，按顺序执行）

**第一条命令（续跑ch1，不要reset！ch1当前2213字在抢救区，round=4起步直接走reviser扩写）：**
```bash
cd C:\Users\mingy\Desktop\trae\novel-pipeline
curl -s -m 10 http://localhost:3001/api/health   # 服务挂了才: npm run restart
node scripts/tmp_rerun_chapters.js f48c77ad-f289-4166-ab64-e1143be0a014 1
```
- ch1 approved后 → `node scripts/tmp_rerun_chapters.js f48c77ad-f289-4166-ab64-e1143be0a014 3`（ch3的WR-IN-005依赖ch1素材落库，必须先ch1后ch3）
- ch1若仍字数卡死：查 `node scripts/debugQueryTaskLog.js <taskId>`；服务器日志grep "salvage\|Reviser saved\|步内重试"
- 3章全过后全链路验证：`node scripts/verifyNewProject.js f48c77ad-f289-4166-ab64-e1143be0a014` + 前端数据关联检查（见"当前进展"⬜项）
- **全部验证通过后**：走五关门禁提交全部改动（清单见下），刷新SESSION-STATE，提醒用户轮换key+删User级旧环境变量

**未提交改动清单（16文件，全部测试绿：单测3459+/相关套件190+49/前端26）：**
- 修复类：server/index.js与scripts/serverStart.js（dotenv override）、orchestratorRoundHelpers.js（relative熔断轮次+context.round下传）、orchestrator.js（传startRound）、orchestratorStepLoop.js（抢救区升级+countWords口径）、orchestratorHelpers.js（persistLog补chapterNumber）、orchestratorStepHandlers.js（落盘打round标）、firstReviewChecks.js（敏感词反馈带命中词）、reviser.js（步内升级重试）、reviserPrompt.js（扩写指令注入+expansionTask下传）、writerPromptBuilder.js（rewrite扩写指令）
- 新增：server/services/pipeline/steps/expansionInstructionBuilder.js（统一构建器）+ tests/unit/expansionInstructionBuilder.test.js
- UI：client/src/pages/pipeline/pipelineConstants.js（5步骤中文名+图标）、server/services/fileOutput.js（AGENT_ROLE_NAMES补5）
- 文档：docs/AI-HANDOVER-PRD.md、docs/INDEX.md（注册）、本worklog
- tmp脚本（不提交或归scripts/tmp/）：tmp_e2e_aliyun_newproject.js、tmp_rerun_chapters.js
- .env不进git（已gitignore确认）

**关键数据：**
- E2E项目：f48c77ad-f289-4166-ab64-e1143be0a014（仙师好评_云端E2E）；ch1=0343cb08-3b35-4455-ac6b-d31bddef0a51、ch2=e85b7f46-3ebb-47cf-8cea-89dd38aeff52(✅2761字)、ch3=a7d536b1-9712-4c00-b0fa-96a600d980d3
- LLM：token-plan网关 `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` + qwen3.8-flash（.env的ALIYUN_CODING_BASE_URL）；同key的Anthropic路径=/apps/anthropic（Claude Code自用）
- 服务：后端3001健康(PG)；重启后必须确认startedAt变化（override:true已让.env生效）
