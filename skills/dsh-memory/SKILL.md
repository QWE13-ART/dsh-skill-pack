---
name: dsh-memory
version: 1.0.0
description: 记忆一体化技能——DSH 记忆全生命周期：写（engram 跨会话持久记忆，拼音 topic_key 中文检索铁律）、读（viking 检索注入，token 预算防上下文膨胀）、维护（艾宾浩斯衰减，旧记忆降权）、语义（CONTEXT 词汇表共享领域语言）、复盘（会话复盘沉淀教训库）。记忆用户偏好/项目决策/踩坑经验、跨会话回想、压缩后恢复上下文、记忆库膨胀维护、项目术语混乱、大任务完成后复盘时使用。存得对、找得到、不膨胀、不误导。
displayName: 记忆
slug: memory
license: MIT
tags: [memory, engram, viking, recall, ebbinghaus, decay, context, lexicon, session-review, persistence]
# 由 5 套合并：dsh-engram-memory + viking-memory-guide + dsh-memory-decay + dsh-context-language + dsh-session-review
# 合并日期：2026-08-28，保留全部精华，原 5 套已归档至 E:\DSH-Data\skill-backup-20260828
---

# 记忆（一体化）

DSH 记忆系统的完整生命周期：**写对 → 找得到 → 不膨胀 → 不误导 → 持续沉淀**。让记忆真正成为"第二大脑"，而不是一个越堆越乱、检索全靠运气的仓库。

## 记忆全生命周期路由

| 环节 | 后端/载体 | 本节 |
|---|---|---|
| **写**（存记忆）| engram（`mcp-engram`，22 工具，本地 SQLite `~/.engram/engram.db`）| §1 |
| **读**（检索/注入）| viking（`mcp__viking__*`，`http://127.0.0.1:1933/mcp` 常驻）| §2 |
| **维护**（衰减/健康）| memory_engine.py（艾宾浩斯遗忘曲线）| §3 |
| **语义**（词汇表）| `E:\DSH-Data\.dsh\evolution\CONTEXT.md` + 项目根 CONTEXT.md | §4 |
| **复盘**（沉淀教训）| `E:\DSH-Data\scripts\dsh-session-review.py` → failure_lessons.jsonl | §5 |

> **双后端分工**：engram 管**写入与生命周期**（偏好/决策/教训/承诺，带拼音 topic_key 中文可搜）；viking 管**检索注入**（带 token 预算，防上下文膨胀）。两者是互补后端，不是二选一。记忆分层见 §6。

---

## §1 写记忆（engram 规范）

### 1.1 什么时候存（主动）

| 时机 | 存什么 | 示例 |
|---|---|---|
| 用户明确说"记住..." | 原话要点 | mem_save 用户邮箱/偏好 |
| 完成重要任务后 | 经验/踩坑（What/Why/Learned）| 修复某 bug 的根因 |
| 项目决策拍板 | 决策 + 理由 | 技术选型结论 |
| 用户纠正你时 | 纠正内容 | "我不喜欢X，以后用Y" |
| 跨会话承诺 | 承诺事项 | "下次做 Z" |

### 1.2 存记忆铁律（中文检索关键——FTS5 不分词！）

1. **`content` 参数**：中文正文直接写（title 也中文）。
2. **`topic_key` 必须带拼音/英文关键词**（空格分隔）——这是中文能被搜到的**唯一通道**（FTS5 unicode61 中文不分词，实测确认）：
   - 存"用户 QQ 邮箱" → topic_key: `qqmail youxiang`
   - 存"微信抖音接入需求" → topic_key: `weixin douyin xiaoxi`
   - 存"DSH 断链修复" → topic_key: `junction duanlian fix`
3. **`type` 用结构化值**：preference / decision / lesson / fact / promise。
4. **必填参数**：`title` + `content` + `type`；**topic_key 强烈建议**（中文可搜性）。

### 1.3 会话生命周期（压缩后不丢）

- 长会话开始 → `mem_session_start`
- 重要节点 → `mem_save`（不是等结束）
- 结束 → `mem_session_end` + `mem_session_summary`（压缩后上下文可恢复）

### 1.4 其他 engram 工具

| 工具 | 用途 |
|---|---|
| mem_timeline | 回溯"当时怎么做的" |
| mem_pin / mem_unpin | 置顶/取消置顶重要记忆（pin = 豁免衰减）|
| mem_judge | 新旧记忆冲突（用户改主意时）|
| mem_stats | 记忆统计 |
| mem_update / mem_delete | 更正/清理 |

### 1.5 写记忆边界

- engram 是**记忆库**，不是文件系统/数据库——结构化数据存文件，经验/偏好存 engram。
- 别用 mem_save 存临时中间结果（污染记忆库）；只存有长期价值的。
- 敏感凭据（API key/授权码）不主动存入（除非用户明确要求）。
- 需要持久化的信息 → 用 `remember`/`mem_save` 写入，而不是靠复制进回复。

---

## §2 检索与注入（viking 规范，防上下文膨胀）

OpenViking 是 DSH 的记忆检索后端（viking MCP server，`http://127.0.0.1:1933/mcp`）。它**自带 token 预算能力**，膨胀通常是因为调用方式不对。按本规范执行可把记忆相关上下文压到预算内。

### 2.1 拉记忆：用 search 的 context 模式（带预算）

- ✅ 正确：
  ```
  mcp__viking__search(
    query="<检索词>",
    mode="context",          # 关键：注入就绪 + 自动预算裁剪
    max_tokens=1600,         # 预算上限（默认 1600，不够再调）
    purpose="chat",          # 或 "coding"
    detail="auto"            # auto/abstract/overview/full
  )
  ```
- ❌ 避免：`find(query, limit=10)` 裸拉摘要列表——**无预算**，10 条摘要可占数千 token
- ❌ 避免：`search` 用 `mode="list"` 后把结果全文展开进对话

### 2.2 预算纪律

- 记忆注入**默认 ≤1600 tokens**（OpenViking `DEFAULT_MAX_TOKENS`）；确需更多再显式 `max_tokens`
- 一次检索最多拉 5-8 条，不要 limit 10+ 全拉
- 多轮对话里**不要重复检索同一主题**——上一轮的记忆结果仍在上下文里

### 2.3 用完即弃

- 工具返回的记忆内容**只用于当轮决策**，不要复制进你的回复/后续消息
- 需要持久化的信息 → 用 `remember` 写入，而不是靠复制

### 2.4 中文检索（engram mem_search 口径）

1. **中文先转拼音/英文再搜**（模型自动转换）：搜"微信"→ `query: weixin`；搜"断链"→ `query: junction`。
2. 英文/拼音直接搜。
3. 搜不到 → 放宽：换关键词/单字/拼音变体；还不行才说"无相关记忆"。
4. 关键任务开工前**先 mem_search 相关记忆**（避免重复踩坑）。

### 2.5 上下文膨胀自检

如果对话上下文仍然膨胀：检查是否在系统提示/历史里出现了大段记忆原文（那说明违反了"用完即弃"）→ 用 `forget` 清掉过时条目。

---

## §3 记忆衰减维护（艾宾浩斯遗忘曲线）

> 移植自 Emmimal/memory-decay-engine（MIT，纯 Python 零依赖）。解决：engram/viking 记忆库**无衰减**——长期运行旧记忆不降权，检索噪声膨胀。

### 3.1 核心算法（EbbinghausMemoryEngine）

```
保留度 = f(经过轮数, 回忆频率)
- 每次回忆 → stability 非线性增加（间隔重复式强化，衰减曲线变平）
- 从不回忆 → 按基础 stability 衰减（遗忘曲线）
- 基于显式逻辑轮计数器（不用墙钟）→ 可复现
```

实现文件：本技能根目录 `memory_engine.py`（复制自上游，MIT）。
接口（真实签名）：`register(mem_id, content, current_turn, is_foundational=False)` / `recall(mem_id, current_turn)` / `step(current_turn)` / `is_present(mem_id)` / `working_set_size()`。

### 3.2 何时执行衰减

| 时机 | 动作 |
|---|---|
| 会话结束复盘时 | 对本次涉及的记忆做一次 `recall`（强化）|
| 记忆库 > 200 条 或 检索噪声明显 | 跑衰减引擎：把 `working_set` 外的记忆标记为低优先级 |
| 每周维护 | 检查记忆库：低保留度记忆 → 归档或删除（先问用户）|

### 3.3 与 engram 集成

- engram 每条记忆的 `hits`（回忆次数）作为 stability 输入
- 检索时：`mem_search` 结果按（相关性 × 保留度）重排——衰减后的记忆排后
- 删除策略：保留度 < 阈值 → 建议归档（`mem_pin` 相反操作是低优先化），**不自动删除**（用户隐私底线：删记忆先问）

### 3.4 衰减边界

- 衰减只影响**排序/优先级**，不自动删记忆（删除需用户确认）
- 核心记忆（用户明确"记住"的）可用 `mem_pin` 豁免衰减（stability 锁定）
- 纯本地运行，零网络依赖

---

## §4 语义层（CONTEXT 词汇表，共享领域语言）

> 移植自 mattpocock/skills（MIT）的 `CONTEXT.md` 机制 + `domain-modeling` skill。README 称之为"repo 里最酷的技术"：开发者和领域专家说不同语言 → agent 被丢进项目只能瞎猜行话。共享语言修的就是这个。
>
> 示例：改前 "There's a problem when a lesson inside a section of a course is made 'real' (i.e. given a spot in the file system)"；改后 "There's a problem with the materialization cascade"——这种简洁**每个会话都省 token**，且越用越值钱。

### 4.1 核心原则

1. **共享语言 = 项目词汇表**——agent 和用户对同一概念用同一个词，不各说各话。
2. **简洁是资产**——一个准确术语替代一段解释，会话省 token、省理解、省返工。
3. **命名一致**——变量、函数、文件名都用词汇表术语，代码库对 agent 可导航。
4. **歧义即记录**——任何术语出现歧义立即写进「已解决歧义」，不靠记忆。
5. **活的文档**——词汇表随项目演化，会话中发现新词/歧义就更新（内联维护，不是批处理）。

### 4.2 CONTEXT 文件结构（三部分）

存放在 `E:\DSH-Data\.dsh\evolution\CONTEXT.md`（跨项目主词汇表）；项目专用词放项目根 `CONTEXT.md`（若项目已有，沿用；主词汇表指针指向它）。

**1. 词汇表（Language：核心）**
```markdown
## Language

**<术语>**:
<一句定义，领域语言，不用代码黑话>
_Avoid_: <同义但已废弃的词 / 容易混淆的词>
```
- 每个正式术语一条：**定义必须一句说完**（能说清就不啰嗦）
- `_Avoid_` 列出**禁止使用的同义词**（防 agent 乱换词）
- 示例：
  ```
  **Issue tracker**:
  托管仓库 issue 的工具：GitHub Issues、Linear 或本地 .scratch/ 约定。
  _Avoid_: backlog manager, backlog backend, issue host
  ```

**2. 关系（Relationships）**
```markdown
## Relationships

- 一个 **A** 包含多个 **B**
- 一个 **B** 携带一个 **C**
```
- 只记**有导航价值**的关系（agent 靠它理解结构）；每条一行，A 是上层概念

**3. 已解决歧义（Flagged ambiguities）**
```markdown
## Flagged ambiguities

- "<旧词>" 之前既指 <含义1> 又指 <含义2>。已解决：<含义1> 用 **X**，<含义2> 用 **Y**。
```
- 记录**曾混淆过**的词和**最终如何解决**；价值：下次遇到旧词，agent 直接知道映射，不重复踩坑

### 4.3 维护流程（内联，不是批处理）

**什么时候更新**（触发即改，绝不攒着）：
- 访谈/讨论中出现**新领域词** → 加词汇表条目（先问用户定义，不自己编）
- 发现**两个词指同一事物** → 定一个正式词，另一个进 `_Avoid_`
- 用户纠正了某个说法 → 立即更新词汇表（用户纠正 > 一切，同 dsh-self-evolution §1⑧）
- 会话中发现**同一个词两种理解** → 写进已解决歧义
- 任务涉及的项目没有 CONTEXT.md → 主动建议建立（一次访谈即可起步，≤10 条起步）

**更新规则**：
- 每次会话结束前，把本次新增/修改的术语**汇总给用户确认**（防 agent 编词）
- 文件 ≤300 行；超了把过时词移入归档段（只归档不删除）
- 损坏恢复：解析失败 → 重命名 `.bak-<日期>` 重建（不静默丢数据）

### 4.4 使用规则（读和用）

1. **探索代码库前先读 CONTEXT.md**——先有领域心智模型，再读代码
2. **命名用它**：新建变量/函数/文件时，优先用词汇表术语（命名一致是最大收益）
3. **说人话**：与用户沟通、写报告、写文档时用正式术语，不用自创说法
4. **问题用它**：访谈（dsh-grilling）中提问用术语，用户秒懂
5. **遇到没定义的词**：先问用户"这个词指什么？"，不猜；答案进词汇表

### 4.5 与记忆库的关系

词汇表是**项目语义记忆**的骨架：事实记忆（engram/viking）存**事件**，词汇表存**概念**，两者互补。经验教训用词汇表术语写（教训可检索性靠一致命名）。

---

## §5 会话复盘沉淀（经验沉淀闭环）

> 复盘器：`E:\DSH-Data\scripts\dsh-session-review.py`（读 append-only 事件流 zstd 解压 → 轨迹摘要 → 失败检测 → 沉淀 failure_lessons.jsonl）。

### 5.1 什么时候复盘

| 时机 | 说明 |
|---|---|
| 大任务完成（8+ 步）| 回看轨迹，沉淀可复用经验 |
| 会话结束前 | 收尾总结 |
| 委派 OpenHands 回收后 | 事件流审计（ActionEvent 证据）|
| 连续失败/诡异错误 | 找失败模式 |

### 5.2 怎么复盘（3 步）

1. **跑复盘器**（对最新会话）：`python E:\DSH-Data\scripts\dsh-session-review.py`
   或指定会话文件（.jsonl.zstd）：`python E:\DSH-Data\scripts\dsh-session-review.py <路径> --no-write`
2. **读输出**：工具调用序列 / 错误事件 / token 统计 / 失败模式。
3. **沉淀**：脚本自动把失败教训追加到 `E:\DSH-Data\.dsh\evolution\failure_lessons.jsonl`（dsh-self-evolution DeLM 教训库，跨会话共享）。有价值的新经验也手动补一条。

### 5.3 教训库格式（追加）

```json
{"role":"<分类>","task_type":"<类型>","lesson":"<可执行教训>","ts":<时间戳>,"hits":0,"source":"<来源>"}
```

- `lesson` 必须是**可执行的反面教训**（"写文件前先确认父目录存在"），不是现象描述。
- `role` 分类：tool-error / schema-contract / path-error / network-timeout / env-config / claim-mismatch 等。
- 教训库是 append-only；更正旧教训用 hits 机制（dsh-self-evolution 管理）。

### 5.4 复盘发现的典型问题 → 动作

| 复盘发现 | 动作 |
|---|---|
| 工具失败 ≥2 且相关 | 查根因（dsh-debugging），修复后重验 |
| `Input validation error` | 读 schema 再传参（dsh-mcp-usage 铁律）|
| 路径类错误 | 核实现实路径（断链 junction/目录迁移）|
| 假完成嫌疑（无真实动作）| dsh-verification 结论对照 + ActionEvent 审计 |

复盘是**只读分析**：不修改产物，只沉淀教训。

---

## §6 记忆分层与边界

| 层 | 载体 | 内容 | 衰减豁免 |
|---|---|---|---|
| **项目语义** | CONTEXT.md | 术语/关系/歧义 | 永不衰减（活文档）|
| **事实/经验** | engram / viking | 偏好/决策/教训/承诺 | 可 pin 豁免 |
| **教训库** | failure_lessons.jsonl | 失败教训（append-only）| hits 强化 |

**总边界**：
- 记忆库 vs 文件系统：结构化数据存文件，经验/偏好存记忆。
- 只存有长期价值：临时中间结果不存。
- 敏感凭据不主动存（除非用户明确要求）。
- 衰减只降权不删；删除必须先问用户。
- 写类记忆操作前先想"未来的自己（白纸）能否独立理解"——写清楚、可独立理解。

## 质量红线

- ❌ 中文记忆不带拼音/英文 topic_key（FTS5 不分词 → 存了搜不到）
- ❌ 检索用裸 `find(limit=10)` / 无预算展开全文（上下文膨胀）
- ❌ 记忆结果复制进回复/后续消息（违反用完即弃）
- ❌ 多轮重复检索同一主题（浪费预算）
- ❌ 不衰减的记忆库（长期运行检索噪声膨胀）
- ❌ 衰减自动删记忆（删除必须用户确认）
- ❌ 自己编术语定义（定义必须用户确认）
- ❌ 用户纠正后不更新词汇表（纠正 > 一切）
- ❌ 删除旧词不归档（只归档不删除）
- ❌ 大任务完成后不复盘（教训不沉淀，同类错误复发）

---

## 参考文件

- 无独立 references（5 套均为单文件 SKILL.md，精华已全部并入正文）
- `memory_engine.py` — 艾宾浩斯衰减引擎实现（复制自上游 Emmimal/memory-decay-engine，MIT，本技能根目录）

## 上游参考

- Emmimal/memory-decay-engine（⭐9，MIT，艾宾浩斯+基准对比）
- sachitrafa/YourMemory（⭐264，艾宾浩斯 MCP 版，偏重，参考其稳定性公式）
- mattpocock/skills（MIT）CONTEXT.md 机制 + domain-modeling
- engram / OpenViking（DSH 记忆后端）

> 注：本技能合并自 5 套（dsh-engram-memory / viking-memory-guide / dsh-memory-decay / dsh-context-language / dsh-session-review）。原 dsh-context-language 的「与其他 skill 联动」指向已统一为整合后的技能名（dsh-verification / dsh-self-evolution / dsh-grilling / dsh-memory）。
