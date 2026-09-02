---
name: dsh-sia
description: SIA 自改进框架（arXiv 2605.27276 官方实现）。需要对 AI 系统/Agent 做自主性能改进、跑基准任务自进化时使用：Meta→Target→Feedback 三 agent 循环，自动改进 Target 的 harness 与权重。
version: 1.0.0
---

# SIA（Self-Improving AI）自改进循环

> 官方实现：hexo-ai/sia（PyPI sia-agent 0.6.0，MIT，**Alpha**），论文 arXiv 2605.27276（已核验存在，2,129⭐，未见发表）。
> 已安装：`E:\SIA\venv`（E 盘，独立 venv）。**零运行痕迹，从未跑过。**
> 🔴 **只用论文摘要口径**：LawBench **+25.1%** vs SOTA、GPU kernel **快 12.4%**（1,017 vs 1,161 μs）、去噪 **+20.4%** vs SOTA。
> README 那套「+56.6% / -91.9% / +502%」虚高 2~25 倍且与自家论文摘要矛盾——**禁止引用**。

## 架构（三 agent 循环）

1. **Meta-Agent**：读任务描述 → 生成初始 Target Agent
2. **Target Agent**：尝试完成任务 → 记录动作与结果
3. **Feedback/Improvement Agent**：审查 Target 日志 → 识别改进 → 更新 Target
→ 迭代循环，自主提升任务表现

## 何时使用

- 需要对某个任务/流程做**自主性能改进**（不是单次修复）
- 有可度量的基准（跑分/正确率/耗时），能判断"是否变好"
- DSH 定期自检：某个重复任务表现不佳 → 用 SIA 循环改进

## 运行方式

⚠️ 旧版此处的 `--provider` / `--model` **不存在**（`sia run --help` 实测）。真实契约：

```powershell
$env:PYTHONIOENCODING='utf-8'   # 必须，否则 PS5.1 下 banner 的 • 触发 gbk 崩溃
E:\SIA\venv\Scripts\sia.exe run --task gpqa --max_gen 1 --sandbox docker --no-web
```

- 任务：`--task {gpqa,lawbench,longcot-chess,spaceship-titanic}` 或 `--task_dir <目录>`
- 代数：`--max_gen`（下划线，默认 3）
- 模型走 **profile**，不用 flag：`--meta-agent-profile` / `--target-agent-profile`
  （profile 内含 agent_impl + model + provider，值为名字或 `.json` 路径）
- `--focus harness`（默认）| `weights`（需 vllm+tinker，本机不具备）

## 与既有能力的分工

| 场景 | 用 |
|---|---|
| 自主改进某任务性能 | dsh-self-evolution §3（SIA 循环）|
| 失败教训复用 | dsh-self-evolution §1 |
| 记忆衰减管理 | dsh-memory §3 |
| 认知调试 | dsh-self-evolution §2 |
| 产物验证 | dsh-verification |

## 边界（隐私与成本）

- 🔴 **`--sandbox` 默认 `none` = agent 生成的代码直接在宿主执行**。不受信任任务
  **必须 `--sandbox docker`**——⚠️ **本机 docker MISS**，现在跑等于裸奔。
- SIA 循环会**多次调用 LLM**（Meta/Target/Feedback × N 代）——先确认余额，`--max_gen 1` 起步
- 默认**只针对任务目录**改进，不碰 DSH 核心代码；改进不自动合并生产代码

## 参考

- 论文：arxiv.org/abs/2605.27276（**只引摘要数字**）
- 源码：`E:\agent-refs\sia-main`（已核验存在）
- **代码读物笔记：`E:\DSH-Data\research-github\sia-code-notes.md`**（带 文件:行号，可复查）
