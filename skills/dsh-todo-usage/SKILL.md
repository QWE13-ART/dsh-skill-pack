---
version: 1.0.0
name: dsh-todo-usage
description: todo_write 工具使用规范。多步骤任务执行中需要跟踪进度、标记进行中/完成、任务清单管理时使用。DSH 官方任务清单工具的正确用法与状态机约定。
---

# DSH todo_write 使用规范

> 适配自 @deepseek-ai/dsh-tool-todo（官方内置工具引导）。
> 修的是第二失败模式：**"任务做到一半忘了还有几步 / 卡在哪一步"**——todo 是
> 会话内最轻量的进度锚点，让模型和用户都能一眼看到"做到哪了"。

## 一、工具契约（官方 schema 实证）

```
todo_write(todos: [{content: string, status: "pending"|"in_progress"|"completed"}])
→ { todos: [...], counts: {pending, inProgress, completed} }
```

**铁律（来自官方源码描述）**：
1. **全量替换**：`todos` 是完整任务列表，每次调用**替换**上一次的列表——不是增量追加。
   所以每次更新都要带上当前所有任务（含已完成）。
2. **最多一个 in_progress**（串行时）：官方默认策略 `AT MOST ONE`——同时只有一个
   任务标记 `in_progress`；并行场景（并发子代理/后台命令）才允许多个。
3. **完成即标记**：任务一完成立刻 `completed`，不要攒着批量标。
4. **留白规则**：只有全部任务完成时才允许没有 `in_progress` 项。
5. **琐碎任务跳过**：单步任务（一句话能做完）不建 todo，避免噪音。

## 二、状态机

```
pending ──开始──▶ in_progress ──完成──▶ completed
                 ▲   │
                 └───┘（回退：发现做错了，改回 pending 或直接修正）
```

- `pending`：未开始（排队中）
- `in_progress`：正在做（唯一）
- `completed`：已完成

## 三、什么时候用

| 场景 | 用/不用 |
|------|--------|
| 多步骤任务（≥3 步） | ✅ 必建 |
| 长会话跨轮次推进 | ✅ 必建（防"做到哪了"失忆） |
| 需要用户看到进度 | ✅ 建 |
| 单步/琐碎任务 | ❌ 跳过 |

## 四、最佳实践

1. **任务粒度**：每项是一条短祈使句（"写测试"、"修 bug"、"跑验证"），
   能独立完成、能独立判断成败。
2. **开始即建**：任务开工时先写 todo 全量列表，再逐项推进。
3. **每步更新**：完成一项就调一次 todo_write（带完整新列表），
   保持会话状态行实时反映进度。
4. **与 executing-plans 协同**：有书面计划时，计划任务清单 ↔ todo 状态
   一一对应，todo 是计划执行的实时投影。
5. **返回值利用**：每次调用返回 counts，向用户播报
   `"N pending, M in progress, K completed"`。

## 五、反模式

- ❌ 追加式使用（官方是全量替换——漏带旧任务=任务丢失）
- ❌ 多个 in_progress（串行场景）
- ❌ 做完不标 completed
- ❌ 单步任务也建 todo
