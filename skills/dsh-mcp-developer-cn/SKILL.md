---
name: dsh-mcp-developer-cn
version: 2.0.0
description: 一体化 MCP（Model Context Protocol）开发技能——从设计到实现到测试评估到发布的全流程。构建 MCP Server、把内部/外部 API 封装成 Agent 可用工具、设计工具 Schema、配置鉴权与安全边界、排查客户端调用失败、创建评估集时使用。中英双语工作流，覆盖 Python（FastMCP）与 TypeScript（MCP SDK）。核心方法论：以 Agent 任务为中心设计工具面（3-10 个任务型工具而非镜像 REST API），描述即路由面，显式 not-exposed 列表做威胁建模，用真实客户端跑 Agent 评估闭环。
displayName: MCP 开发助手
slug: mcp-developer-cn
license: MIT
tags: [mcp, model-context-protocol, mcp-server, mcp-client, tool-design, typescript, python, fastmcp, zod, pydantic, json-rpc, ai-agent]
# 由 5 套合并：dsh-mcp-builder(Anthropic官方) + dsh-mcp-developer + dsh-mcp-server-spec + dsh-mcp-tool-developer + dsh-mcp-app-developer-cn
# 合并日期：2026-08-28，保留全部精华，原 5 套已归档至 E:\DSH-Data\skill-backup-20260828
---

# MCP 开发助手（一体化）

开发 MCP（Model Context Protocol）Server / Client，让 LLM 通过**设计良好**的工具与外部服务交互。MCP Server 的质量 = 它让 LLM 完成真实任务的能力，不是 endpoint 覆盖率。

**核心理念**：MCP Server 是"**非人用户的界面**"——工具少而任务化，描述是给"在不确定性下做选择的模型"读的路由面，不是给开发者看的 API 文档。

---

## 何时使用本技能

- 构建新的 MCP Server（从零或包装现有 API）
- 把 REST/内部 API 封装成 Agent 工具
- 设计工具 Schema / 资源 / 提示模板
- 配置传输（stdio / SSE / Streamable HTTP）、鉴权与安全边界
- 排查"客户端看得到工具但调用失败"等联调问题
- 为 MCP Server 创建评估集（验证 Agent 真能用）
- 发布到 registry / 部署

## 何时**不**用本技能

MCP 是"给外部客户端提供工具"的跨进程协议。这些场景不要用它，成本高于收益：

- **只是给自己写个脚本/CLI** — 直接写脚本。MCP 的价值在被别的 Agent 客户端复用，单机自用是纯开销。
- **扩展本机 DSH 的能力** — 走 Cordis 插件（`cordis-plugin-development` 造动态插件、`editing-cordis-compositions` 改组成）。同进程内注册工具，没有 JSON-RPC 与子进程开销。
- **只是要调用已装好的 MCP 工具** — 那是使用侧，看 `dsh-mcp-usage`（参数契约、工具选择），本技能是开发侧。
- **需求其实是"一个函数"** — 一个工具面只有 1-2 个动作且无鉴权/无状态时，先问是否该做成对方代码库里的一个库函数。
- **造技能而非造工具** — 技能是给模型读的流程文档，工具是可执行接口。看 `dsh-anthropic-skill-creator` / `dsh-skill-writing`。

---

## 标准工作流（六步闭环）

1. **分析需求** — 识别数据源、需要的工具、目标客户端；确认谁在代表谁行动（终端用户账号 / 服务账号 / 多租户）、产品最危险的动作（删除/发送/支付/权限变更）
2. **设计工具面（先设计后编码）** — 按 §设计原则，产出 3-10 个任务型工具 + not-exposed 列表
3. **初始化项目** — `npx @modelcontextprotocol/create-server my-server`（TS）或 `pip install mcp` + scaffold（Python）
4. **实现** — 注册工具/资源/提示；配置传输与鉴权；Zod/Pydantic 校验；可读错误
5. **测试** — `npx @modelcontextprotocol/inspector` 协议合规 + Agent 评估闭环（§测试与评估）
6. **部署** — 打包、鉴权/限流、环境变量、监控、registry 发布

> **反馈回路（铁律）**：Schema 校验失败 → 看 Zod/Pydantic 报错 → 改 Schema → 重跑 inspector；工具调用返回畸形响应 → 查传输序列化 → 改 handler → 重测。禁止"绕过报错"。

---

## 设计原则（§先设计后编码，最关键的差异点）

每个 SaaS 都在发 MCP Server，多数把 REST API 甩成 40 个工具然后看 Agent 抓瞎。**按任务设计，不按 endpoint 设计。**

1. **从 Agent 任务出发，不镜像端点**。列出 Agent 真正会被要求做的 5-8 件事（"报销单"、"找上季度报告"、"归纳工单历史"），每件做成一个工具——哪怕内部要调 4 个 API。镜像端点 = 让 Agent 替你编排；任务型 = 替 Agent 做编排。
2. **工具面保持小**。每个工具都会稀释每次调用的选择准确率。目标 ≤10；超过 ~15 按工作流拆成可独立加载的 Server。合并 list/get/search 变体为一个带参数的工具。
3. **描述即路由面**。描述是模型选工具时唯一看到的东西。公式：做什么（一句）· 何时用它/何时该用兄弟工具 · 返回什么。检验：仅凭描述，模型能在两个最接近的工具间选对吗？
4. **为上下文窗口设计返回**。返回 Agent 需要的 6 个字段，不是 API 的 60 个；保留稳定 ID 供链式调用；分页显式 `has_more`；默认响应 ≤~2k tokens，详情可选。
5. **错误要可行动**。Agent 只会重试它看得懂的："date must be YYYY-MM-DD" 胜过 "400 Bad Request"。每个错误指名出错参数 + 修复方法。
6. **画安全边界**。每个能力分类：**expose**（读/建，低爆炸半径）· **expose gated**（破坏性/对外——要求显式确认参数，文档注明客户端应展示审批）· **never expose**（鉴权变更、不可恢复删除、批量导出他人数据）。never 清单随 spec 交付并附理由。
7. **诚实指定鉴权**。每终端用户 OAuth（Agent 代表用户、继承其权限）vs API key（服务账号——那 per-tool 作用域更重要）。写明 token 生命周期、吊销、会话中途过期怎么办。

**Not-exposed 列表**：spec 里最重要的一节。一个没有它的 MCP Server 没做过威胁建模。每个能力一行理由，按 API 契约一样评审。

---

## 实现指南

### 推荐技术栈
- **语言**：TypeScript（SDK 质量高、执行环境兼容性好、模型擅长生成 TS、静态类型+lint 友好）优先；Python（FastMCP）作为强替代
- **传输**：远程 Server 用 **Streamable HTTP**（无状态 JSON，简单可扩展）；本地 Server 用 **stdio**。SSE 用于传统远程部署。

### TypeScript 最小示例（Zod 校验）
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "my-server", version: "1.1.0" });

// 工具：带校验的输入 Schema
server.tool(
  "get_weather",
  "Fetch current weather for a location",
  {
    location: z.string().min(1).describe("City name or coordinates"),
    units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  },
  async ({ location, units }) => {
    const data = await fetchWeather(location, units);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);

// 资源提供器
server.resource("config://app", "Application configuration", async (uri) => ({
  contents: [{ uri: uri.href, text: JSON.stringify(getConfig()), mimeType: "application/json" }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Python 最小示例（Pydantic 校验）
```python
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

mcp = FastMCP("my-server")

class WeatherInput(BaseModel):
    location: str = Field(..., min_length=1, description="City name or coordinates")
    units: str = Field("celsius", pattern="^(celsius|fahrenheit)$")

@mcp.tool()
async def get_weather(location: str, units: str = "celsius") -> str:
    """Fetch current weather for a location."""
    data = await fetch_weather(location, units)
    return str(data)

@mcp.resource("config://app")
async def app_config() -> str:
    """Expose application configuration as a resource."""
    return json.dumps(get_config())

if __name__ == "__main__":
    mcp.run()  # defaults to stdio
```

**预期调用流**：`Client → {method:"tools/call", params:{name, arguments}}` → `Server → {result:{content:[...]}}`（合法 JSON-RPC 2.0）

### 每个工具的要素
- **输入 Schema**：Zod/Pydantic，含约束 + 清晰描述 + 字段描述里带示例
- **输出 Schema**：尽量定义 `outputSchema` / `structuredContent`（现代 SDK 特性），帮客户端理解处理结果
- **实现**：async/await；可行动错误；分页；现代 SDK 同时返回 text content + structured data
- **Annotations**：`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`

### 完整实现指南（按需加载）
- [TS 实现模式与示例](./references/typescript.md)
- [Python 实现模式与示例](./references/python.md)
- [MCP 最佳实践总纲](./references/best-practices.md)（命名/响应格式/分页/传输选择/安全与错误标准）
- [协议参考（JSON-RPC 2.0 / 生命周期）](./references/protocol.md)
- [TS SDK 参考](./references/typescript-sdk.md) · [Python SDK 参考](./references/python-sdk.md)
- [工具定义与执行](./references/tools.md) · [资源/URI/模板](./references/resources.md)

---

## 硬性约束

### MUST DO
- 正确实现 JSON-RPC 2.0
- 所有输入用 Schema 校验（Zod/Pydantic）
- 用正确传输（stdio/HTTP/SSE）
- 全面错误处理 + 可行动错误信息
- 实现鉴权与授权
- 记录协议消息便于调试
- 彻底测协议合规
- 文档化 Server 能力

### MUST NOT DO
- 跳过工具输入校验
- 在资源内容里暴露敏感数据
- 忽略协议版本兼容
- 同步代码混 async 传输
- 硬编码凭据/密钥
- 返回非结构化错误给客户端
- 无限流就部署
- 跳过安全控制

---

## 测试与评估

### 1. 协议合规测试
- **TS**：`npm run build` 验证编译 → `npx @modelcontextprotocol/inspector`
- **Python**：`python -m py_compile your_server.py` → MCP Inspector
- 确认工具出现、Schema 接受合法输入、错误响应是合法 JSON-RPC 2.0

### 2. Agent 评估闭环（验证"真能用"，非仅 schema 合法）
Schema 合法 ≠ Agent 能用。评估证明工具集真的工作：
1. **工具检视**：列出可用工具，理解能力
2. **内容探索**：用只读操作探索可用数据
3. **生成 10 个问题**：复杂、真实、Agent 需要多步工具调用才能回答
4. **答案验证**：自己先解一遍确认答案可校验

问题要求：独立 / 只读 / 复杂（多工具调用）/ 真实 / 可字符串比对验证 / 答案稳定。

**输出 XML 格式**：
```xml
<evaluation>
  <qa_pair>
    <question>...</question>
    <answer>3</answer>
  </qa_pair>
</evaluation>
```
- [完整评估指南](./references/evaluation.md)（含脚本）
- 运行：`scripts/evaluation.py` + `scripts/requirements.txt` + `scripts/example_evaluation.xml` 样例

> 测试计划：10-15 个覆盖各任务的真实 Agent prompt，跑真实客户端；**某个工具描述被误选两次 → 重写描述，而不是写文档绕过**。

---

## 常见陷阱与修正

| 问题 | 修正 |
|---|---|
| LLM 用错参数 | 改进描述 + 在描述字段加示例（LLM 读描述决定怎么调） |
| 大输入超时 | 输入大小校验 + 分页；流式返回大响应而非缓冲 |
| 返回 60 个字段撑爆上下文 | 只返回 Agent 需要的字段，默认 ≤2k tokens |
| 40 个 endpoint 工具 | 按 Agent 任务合并成 3-10 个任务型工具 |
| 客户端看得到但调用失败 | 握手/Schema/超时三条排查：先看 inspector 握手、再看 Schema 是否合法、再看超时与序列化 |

---

## 输出格式与验收（中文工作流）

每次输出按任务需要组合：
1. **理解确认**：一句话说明目标、对象和限制
2. **可用成品**：直接给方案、脚本、表格、命令或结构化结果
3. **判断依据**：解释关键选择，不堆砌概念
4. **验收清单**：给出用户可自行检查的标准
5. **下一步**：只列最值得继续做的 1-3 项

信息不足时明确假设，最多追问 3 个关键参数；先给结果再解释关键取舍；涉及外部系统区分"规划建议"与"已经执行"；高风险动作提示影响范围/备份/人工确认点。

---

## 反模式（快速自检）

- [ ] 别镜像 REST API —— 40 个 endpoint 工具是 #1 失败原因
- [ ] 别给开发者写描述（"wraps the /v2/items endpoint"）——写给选工具的模型
- [ ] 别返回完整 API payload —— 上下文窗口是稀缺资源
- [ ] 别把破坏性动作无门控暴露（"客户端会小心"是借口）
- [ ] 别跳过 not-exposed 列表 —— 没有它 = 没做威胁建模
- [ ] 别不跑 Agent 测试计划就交付 —— schema 合法和 Agent 可用是两回事
- [ ] 别在描述/日志/错误里泄露密钥
- [ ] 写入型工具要支持幂等、预览和人工确认

---

## 参考文档索引

| 文件 | 内容 |
|---|---|
| `references/server-spec.md` | 设计 spec 完整方法论（任务型工具/not-exposed/auth 决策/测试计划） |
| `references/best-practices.md` | MCP 最佳实践总纲（命名/响应/分页/传输/安全） |
| `references/typescript.md` | TS 完整实现指南（结构/package.json/tsconfig/质量清单） |
| `references/python.md` | Python/FastMCP 完整实现指南（初始化/Pydantic/质量清单） |
| `references/evaluation.md` | 评估创建完整指南 + 脚本用法 |
| `references/protocol.md` | 协议/消息类型/生命周期/JSON-RPC 2.0 |
| `references/typescript-sdk.md` | TS SDK 细节 |
| `references/python-sdk.md` | Python SDK 细节 |
| `references/tools.md` | 工具定义/Schema/执行 |
| `references/resources.md` | 资源提供器/URI/模板 |
| `references/system-prompt.md` | 完整执行规则（中文） |
| `references/examples.md` | 高质量调用示例（中文） |
| `references/checklist.md` | 交付前检查清单（中文） |
| `references/anti-patterns-cn.md` | 常见错误与修正（中文） |
| `references/tool-developer.md` | 原 tool-developer 全量参考 |
| `scripts/evaluation.py` | 评估运行脚本 |
| `scripts/connections.py` | 连接辅助脚本 |
| `scripts/example_evaluation.xml` | 评估 XML 样例 |
| `scripts/requirements.txt` | 脚本依赖 |

---

## 安全边界

- MCP 只是能力协议，不自动解决业务授权
- 禁止在工具描述、日志、错误中泄露密钥
- 写入/删除/支付/发信/发布/权限变更需显式确认
- 工具可访问文件、网络、执行代码——权限审查不可省
- 涉及外部系统时，未执行/未联网/未验证绝不描述成已完成
