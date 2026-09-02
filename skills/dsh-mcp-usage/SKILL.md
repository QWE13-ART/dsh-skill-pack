---
name: dsh-mcp-usage
description: DSH 14 个 MCP 工具使用规范。涉及浏览器、代码、Git、记忆、邮件、桌面控制、子代理等工具选择时使用；MCP 参数契约铁律（读 schema 再传参）；防止工具误用/参数错配/能力边界混淆。
version: 1.0.0
---

# DSH MCP 使用规范（14 个 MCP 全景）

> 目标：模型拿到任务先选**正确的 MCP + 正确的参数**，不猜参数、不混用能力边界。

## 一、MCP 全景（14 个，按域分类）

### 浏览器 / 网页
| MCP | 能力 | 用在哪 |
|---|---|---|
| `mcp-playwright` | navigate/click/type/screenshot/网络抓取（24 工具）| 网页操作、填表、抓取、登录流程 |

### 代码 / 工程
| MCP | 能力 | 用在哪 |
|---|---|---|
| `mcp-serena` | 符号级代码理解/编辑/LSP（26 工具）| 跨文件引用、符号查找、精准编辑 |
| `mcp-git` | git 操作（13 工具）| 提交/分支/日志 |
| `mcp-github` | GitHub API（44 工具）| 仓库/PR/Issue |

### 记忆
| MCP | 能力 | 用在哪 |
|---|---|---|
| `mcp-engram` | 跨会话持久记忆（22 工具）| mem_save/mem_search/mem_timeline |
| `mcp-viking`（若挂载）| 记忆检索 | 旧记忆查询 |

### 邮件
| MCP | 能力 | 用在哪 |
|---|---|---|
| `mcp-email` | QQ 邮箱 IMAP/SMTP（14 工具）| 读/搜/发/整理邮件 |

### 桌面 / 系统
| MCP | 能力 | 用在哪 |
|---|---|---|
| `mcp-windows` | Windows 桌面控制（20 工具）| 鼠标/键盘/截图/App 启动/注册表/进程 |
| `mcp-open-design` | 本地设计软件 | 设计文件操作 |

### 子代理 / 推理
| MCP | 能力 | 用在哪 |
|---|---|---|
| `mcp-openhands` | OpenHands 子代理（8 工具，**全部 `openhands_` 前缀**）| 委派长任务（openhands_create_conversation / openhands_run_task / openhands_get_result / openhands_audit_conversation / openhands_retry_clone）|
| `mcp-sequential-thinking` | 结构化多步推理 | 复杂决策 |
| `mcp-reasonix` | 推理 | 深度推理 |
| `mcp-context7` | 库文档检索 | 第三方库用法 |
| `mcp-deeptutor` | 教学 | 讲解概念 |
| `mcp-security-audit` | 安全审计 | 代码/依赖风险 |

## 二、参数契约铁律（血泪教训，必须遵守）

1. **先读 schema 再传参**——调任何 MCP 工具前，先看工具定义（DSH 工具列表里
   有 input schema）。不知道参数名/必填项就传，必踩 `Input validation error`。
2. **服务端联合类型 → 发 oneOf 而非 anyOf**（context7 实测教训）。
3. **多命令 CLI 的 MCP 必须带子命令参数**（如 email 必须 `stdio`、
   github 必须 `run github-api`）——DSH 配置里已写好，不要改。
4. **engram 系工具参数名**：`mem_save` 用 `content`（不是 `text`）；
   `mem_search` 用 `query`。
5. **超时重试**：工具超时（`toolCallTimeoutMs` 120s）先看错误再重试，
   不要盲目重发同一参数（违背 dsh-karpathy-guidelines 的"不猜"）。
6. **白名单**：发邮件前先查 `list_allowed_recipients`；QQ 机器人入站
   通道无出站工具，别找不存在的 `qq_send`。

## 三、能力边界（别混用）

| 想要 | 用 | 不要用 |
|---|---|---|
| 操作网页 | mcp-playwright | mcp-windows（那是桌面原生）|
| 操作桌面程序 | mcp-windows | mcp-playwright（只管网页）|
| 记忆用户偏好 | mcp-engram mem_save | 邮件（不是记忆）|
| 委派长任务 | mcp-openhands | 自己死磕 |
| 查库文档 | mcp-context7 | 凭记忆猜 API |

## 四、MCP 故障排查（工具报错时）

1. 报 `Connection closed` / `MODULE_NOT_FOUND` → MCP 进程没起来：
   查 DSH runtime.log 对应 server 行；插件文件缺失需重装（见下）。
2. 报 `validation error` → 参数契约问题：读 schema，别猜。
3. 超时 → 任务本身重（如 GitHub 大仓库）→ 缩小范围，不是 MCP 坏了。
4. **pnpm add 后断链检查**：MCP 依赖（@playwright/mcp 等）在
   `E:\NodeTools\node_modules`——缺失时 `npm install --prefix E:\NodeTools @playwright/mcp`；
   宿主链接断链跑 `E:\DSH-Data\scripts\fix-junctions.py`。
