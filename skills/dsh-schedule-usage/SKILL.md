---
version: 1.0.0
name: dsh-schedule-usage
description: schedule 定时提醒工具使用规范。用户要求定时提醒/延时提醒/周期提醒时使用。覆盖 schedule_create（after_seconds 延时 / at 绝对时间 / every_seconds 固定速率）与 schedule_list / schedule_delete。
---

# DSH schedule 定时提醒使用规范

> 适配自 @deepseek-ai/dsh-schedule（官方内置工具引导）。
> 提供 3 个会话级工具管理**持久提醒**：延时、绝对时间、固定速率。

## 一、工具契约（官方 schema 实证）

```
schedule_create(after_seconds? | at? | every_seconds?, prompt, time_zone?)
→ ScheduleId + scheduledAt (RFC 3339 UTC) + state: "scheduled"|"overdue"

schedule_list() → 活动记录数组（含 state 与 deliveryMode: "session-local"）

schedule_delete(id) → { id, deleted: true|false }
```

**三选一铁律**：`after_seconds`、`at`、`every_seconds` **有且只有一项**。

## 二、三种触发方式

| 方式 | 参数 | 说明 | 示例 |
|------|------|------|------|
| 延时 | `after_seconds`（正整数） | N 秒后提醒一次 | 30 分钟后：1800 |
| 绝对时间 | `at`（RFC3339 字符串 或 {date,time,time_zone}） | 指定时刻提醒一次 | "2026-08-27T20:00:00+08:00" |
| 固定速率 | `every_seconds`（≥300，即≥5分钟） | 周期重复提醒 | 每 10 分钟：600 |

**时间格式严格性**：
- 字符串形式：`YYYY-MM-DDTHH:mm:ss[.S|.SS|.SSS](Z|±HH:MM)`——必须带 Z 或数值偏移量。
- 本地形式：`{ date, time, time_zone }`——`time_zone` 必须显式给出
  （`UTC` 或合法 IANA 时区，如 `Asia/Shanghai`）；**缺 time_zone 直接拒绝**。
- `after` 存储 afterSeconds；`at` 不保留偏移量/本地字段；`every` 存 everySeconds。

## 三、模型体验要点

1. **时区**：`time_zone` 必须显式传——schedule 绝不从模型上下文/会话头/进程时区推断。
   挂载 `dsh-time-context` 后模型可理解"本地时区"的自然语言，但**仍须显式传参**。
2. **最小间隔**：`every_seconds` 至少 300 秒（5 分钟），更频繁会被拒
   （错误码 `frequency_too_high`）。
3. **提醒送达**：到期时 agent idle 后开启一个普通后续轮次——显示在正常
   对话流中，**无独立 UI/回执**。表示 follow-up 已入队，不代表模型成功或已读。
4. **持久化**：`schedule_list` 前如持久化不确定会返回
   `persistence_uncertain`——重试 list 再信结果。

## 四、什么时候用

| 场景 | 用/不用 |
|------|--------|
| "30 分钟后提醒我……" | ✅ after_seconds |
| "明早 9 点提醒我……" | ✅ at + time_zone |
| "每 10 分钟检查一次……" | ✅ every_seconds（≥300s） |
| 一次性无提醒的普通任务 | ❌ |

## 五、错误码速查（官方封闭领域）

`invalid_prompt` / `invalid_selector`（三选一违规）/ `invalid_rule` /
`invalid_time_zone`（缺时区/非法时区）/ `not_future`（目标非未来）/
`time_out_of_range` / `frequency_too_high`（<5 分钟）/
`corrupt_schedule_log` / `persistence_uncertain` / `internal_error`

## 六、反模式

- ❌ 三选一传多个（after+at 同传）
- ❌ `at` 不带时区或偏移量
- ❌ `every_seconds` 小于 300
- ❌ 传过去时刻（not_future 拒绝）
- ❌ 删除时传错 id（先 schedule_list 拿准确 id）
