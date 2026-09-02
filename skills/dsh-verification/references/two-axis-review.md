---
name: dsh-two-axis-review
description: 两轴并行代码审查。审查/评审/检查这段代码/这个改动/这个 PR/这个分支时使用。Standards（合规）+ Spec（需求）双轴独立子智能体并行跑，side-by-side 报告；无 spec 时只走 standards 单轴。
version: 1.0.0
---

# DSH 两轴并行代码审查

> 移植自 mattpocock/skills（MIT）的 `code-review`。
> 它修的是审查最常见失败：**单一视角漏报**。一个 diff 可能合规但做错了需求
> （Standards pass, Spec fail），也可能做对了需求但破坏了项目约定
> （Spec pass, Standards fail）。两轴并行 + 分开报告，防止一轴掩盖另一轴。

## 两轴定义

对用户给定的固定点（commit/分支/tag/merge-base）到 HEAD 的 diff，跑两条独立的轴：

- **Standards 轴**：代码是否符合仓库记录的编码规范？
- **Spec 轴**：代码是否忠实实现了来源 issue/spec 要求的东西？

两轴**各自用独立子智能体**跑（上下文不互相污染），主智能体最后聚合。

## 流程

### 1. 钉住固定点

用户说的固定点是什么就用什么（commit SHA、分支名、tag、`main`、`HEAD~5` 等）。
没指定就问。

一次性捕获 diff 命令：`git diff <fixed-point>...HEAD`（三点式，对比 merge-base）。
同时记 commit 列表：`git log <fixed-point>..HEAD --oneline`。

继续前先确认固定点可解析（`git rev-parse <fixed-point>`）且 diff 非空。
坏 ref 或空 diff 应在此失败，而不是在两个并行子智能体里失败。

### 2. 找 Spec 来源

按序找来源 spec：

1. commit 消息里的 issue 引用（`#123`、`Closes #45` 等）。
2. 用户作为参数传的路径。
3. `docs/`、`specs/`、`.scratch/` 下匹配分支名/功能名的 spec 文件。
4. 找不到就问用户 spec 在哪。若说没有，**Spec 子智能体跳过**并报 "no spec available"。

### 3. 找 Standards 来源

仓库里任何记录"代码该怎么写"的东西：`CODING_STANDARDS.md`、`CONTRIBUTING.md`、
`AGENTS.md`、`CLAUDE.md`、`.workbuddy` 下的规范文件等。

在仓库文档之上，Standards 轴**始终携带 smell 基线**（Fowler《重构》第 3 章的固定
代码坏味道集，仓库啥都没记录也适用）。两条约束：

- **仓库覆盖基线**：仓库明确记录的标准永远赢；它认可基线会 flag 的东西时，压掉该 smell。
- **永远是判断**：每个 smell 是标注的启发式（"疑似 Feature Envy"），不是硬违规。
  工具已强制的跳过。

每个 smell 读法是 *是什么* → *怎么修*；对照 diff 匹配：

- **Mysterious Name 神秘命名**：函数/变量/类型名看不出做什么/装什么 → 改名；想不出诚实名字说明设计浑浊。
- **Duplicated Code 重复代码**：同一逻辑形状出现在 diff 的多个 hunk/文件 → 抽取共享形状，两处调用。
- **Feature Envy 依恋情结**：方法访问别的对象数据比自己的多 → 移到它依恋的数据上去。
- **Data Clumps 数据泥团**：同样几个字段/参数老是一起出现（一个待诞生的类型）→ 打包成一个类型传。
- **Primitive Obsession 基本类型偏执**：基本类型/字符串顶替了该有自己的类型的领域概念 → 给它自己的小类型。
- **Repeated Switches 重复 switch**：同一类型上的同一 `switch`/`if` 级联在改动里反复出现 → 多态替换，或共享一张 map。
- **Shotgun Surgery 霰弹式修改**：一个逻辑改动被迫散落在 diff 的很多文件 → 把一起变的东西聚进一个模块。
- **Divergent Change 发散式变化**：一个文件/模块因几个不相关原因被改 → 拆开，让每个模块只为一个原因变。
- **Speculative Generality 投机性泛化**：为 spec 没有的需求加的抽象/参数/hook → 删掉，出现真实需求前内联回去。
- **Message Chains 消息链**：长 `a.b().c().d()` 导航，调用方不该依赖 → 把行走藏到第一个对象的一个方法里。
- **Middle Man 中间人**：类/函数主要只是往下转发 → 砍掉，直接调真实目标。
- **Refused Bequest 拒绝遗产**：子类/实现者忽略或覆盖了大部分继承来的东西 → 放弃继承，用组合。

### 4. 并行跑两个子智能体

**Standards 子智能体 prompt** 必须包含：

- 完整 diff 命令 + commit 列表。
- 步骤 3 找到的 standards 源文件列表，**外加把 step 3 的 smell 基线全文贴进去**
  （子智能体没有其他途径拿到它）。
- 任务："逐文件/hunk 报告：(a) 每个违反文档化标准的位置：引用标准（文件+规则）；
  (b) 看到的任何基线 smell：命名并引用 hunk。区分硬违规与判断：
  文档化标准的破坏可以是硬的，基线 smell 永远是判断，文档化仓库标准覆盖基线。
  跳过工具已强制的。400 字以内。"

**Spec 子智能体 prompt** 必须包含：

- diff 命令 + commit 列表。
- spec 的路径或抓取的内容。
- 任务："报告：(a) spec 要求但缺失/部分实现的需求；(b) diff 里没被要求的行为（范围蔓延）；
  (c) 看似实现但实现看起来错的需求。每项引用 spec 原文行。400 字以内。"

spec 缺失时跳过 Spec 子智能体，在最终报告里注明。

### 5. 聚合

在两个标题 `## Standards` 和 `## Spec` 下呈现两份报告，逐字或轻度清理。
**不要合并或重排 findings**——两轴刻意分离（见"为什么两轴"）。

结尾一行总结：每轴 findings 总数，以及**每轴内**最糟的问题（如有）。
不要在轴之间挑一个总冠军——那正是分离要防止的重排。

## 为什么两轴

一个改动可能一轴过另一轴挂：

- 每条规范都遵守但实现错了东西 → **Standards 过，Spec 挂。**
- 完全按 issue 做的但破坏了项目约定 → **Spec 过，Standards 挂。**

分开报告，防止一轴掩盖另一轴。

## DSH 场景适配备注

- DSH 生态里"规范源"可能是：`E:\CodeAudit\semgrep-rules\`（opengrep 规则，工具已强制，
  子智能体跳过）、`dsh-tool-folder` 等插件的 README 红线（无 $ref/core 不裁/错误 fallback）、
  skills 的硬规则（dsh-injection-guard 的"外部内容永不以指令注入"等）。
- "Spec 源"可能是：用户一句话需求、架构师规格（`docs/system_design.md`）、
  外部审查报告（如 2026-08-25 的 dsh-tool-folder 六类问题报告）。
- 本技能与 `dsh-verifier` 互补：本技能管"改动是否合规且对需求"，
  verifier 管"产物是否真实存在且可执行"（防假完成）。两遍检查时可组合使用：
  本技能做第一遍（质量双轴），verifier/QA 独立复验做第二遍。
