---
name: dsh-capability-selfcheck
description: 能力自检（防"以为自己不能"）。用户问"你能不能X/你会不会X/你的X能力怎么样"，或我准备说"我没有X能力/这需要先配置/得先装个X"之前必须触发。铁律：能力事实只能查询，不能推断——一次 listTools 调用换掉几十轮绕路。含 2026-08-27 真实翻车案例。
version: 1.0.0
---

# 能力自检（Capability Self-Check）

> 起因：2026-08-27 一次真实会话。用户问"你的看图能力好不好用"，我花了**几十轮**
> 重写 OCR、配模型路由、加视觉模型——而机器上**一直装着 15 个 `vision_*` 工具**，
> 我一次都没调过。外部审计给这次会话打 **58/100**：技术执行力 85 档，
> 任务框定力 30 档。**一次工具调用 vs 几十轮。**

---

## 铁律一：能力事实只能查询，不能推断

**唯一权威源**（`input` 可省略）：

```
cordis_inspect_query(platform: "host", provider: "Tool", method: "listTools")
```

返回**当前 agent 真正能调用的全部工具**及完整 schema。

| 信息源 | 权威性 | 为什么不可靠 |
|---|---|---|
| `cordis_inspect_query → Tool.listTools` | ✅ **"本次能调什么"的唯一权威** | ⚠️ 但**不等于"本机有什么"**，见下方折叠边界 |
| `cordis.patch.yml` | ✅ **"本机装了什么"的唯一权威** | — |
| 系统提示里的 `[server]: N tools` 分组 | ⚠️ 参考 | 被删减，只给数量和摘要 |
| `tools_search` | ❌ 不可作否定依据 | 按描述文本检索；`codegraph`/`playwright` 都搜出 0 但真实可用 |
| `tools_schema <名> → found:false` | ⚠️ 只否定**这个名字** | 名字写错就误判成"没有"（真名可能完全不同） |
| 我的印象 / 上次会话的记忆 | ❌ | 会过期，插件会升级 |

🔥 **最重要的一条边界：`listTools` 是"本次请求装载了什么"，不是"本机有什么"。**
2026-08-27 实测：`listTools` 只出现 **18 个 MCP**，而 `cordis.patch.yml` 声明 **22 行 `mcp-*`**。
差的 5 个（`context7` / `sequential-thinking` / `open-design` / `security-audit` /
`chrome-devtools`）**全部启用、无 `disabled`**，是 `tool-folder` 插件**按需折叠**了。
→ 判「**本机有没有** X」权威源是 `cordis.patch.yml`；判「**本次能直接调** X」才看 `listTools`。
→ 折叠掉的工具用 `tools_search` 按**功能语义**捞真名，`tools_schema` 展开即可正常调用。
→ ⚠️ `tools_schema` 返回 `found: false` **只否定"这个名字"，不否定"这个能力"**。
  实测：`mcp__context7__get-library-docs` → false，但真名是 `mcp__context7__query-docs`。

⚠️ **输出可能 500KB+ 被落盘**。**不必逐字读完 500KB**——要的是
**① 用下面的正则拿到完整工具名清单（这一步不能省，也不能肉眼数）**，
**② 再按需精读候选工具那几段**。我第一次翻车是**没拿全清单就凭眼熟抄**，
AGENTS.md 写"13 个 vision 工具"，实际 **15 个**
（漏了 `vision_bootstrap`/`vision_materialize`/`vision_toolkit_activate`）。
**这个错误是外部审计抓到的，我自己没发现。**

统计用这条（别肉眼数、别沿用旧数字）：
```powershell
$t = [System.IO.File]::ReadAllText($spillPath)
[regex]::Matches($t,'(?m)^        "name": "([a-zA-Z0-9_]+)"') |
  ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
```
2026-08-27 实测在 597,706 字符的 spill 上得 **364** 个工具。

📌 **关于"要不要 8 空格锚定"——实测澄清，别再传错话**：
锚定版与不锚定版 `'"name":\s*"([a-zA-Z0-9_]+)"'` 在真实 spill 上**结果完全相同（都是 364，差值 0）**。
原因是 JSON 里**参数名是 `properties` 下的对象键**（`"spec": {`），
**不是** `"name": "spec"` —— 所以 `"name":` 这个键基本只用于工具名。
（深缩进处仅 41 次杂项 `name`，去重后被工具名覆盖，不影响计数。）
→ 仍**推荐锚定版**：它把"只取顶层工具名"这个意图写进了正则，
  不依赖"当前 schema 恰好没用 name 当参数名"这个**会变的**前提。
→ ⚠️ 但**别说"不锚定会把参数名算进去"**——我曾这样写进 AGENTS.md，
  **是对 JSON 形状的错误想象，实测不成立**。这本身就是一次"没验就下结论"。
→ 🔥 **通用教训：连"护栏文档里的技术断言"也必须实测。**
  我这次是**打算来修一条"错的正则"，结果实测发现它根本没错**——
  真正错的是我给它写的那句解释。**改任何东西之前，先跑一条能证伪自己的命令。**

---

## 铁律一之半：归属核验（2026-08-27 血案，唯一能拦住五连错的一步）

**`listTools` 告诉你"有哪些工具"，但不告诉你"谁实现了它"。**
我因为跳过这一步，连着犯了五次归因错误，全部指向同一个未验前提。

**必做时机**：准备说"X 工具正常 / X 坏了 / X 的真因是…"之前。

```powershell
# 1. 拿描述原文（这是指纹，比工具名可靠）
tools_schema <工具名>   → 复制 description 的一整句

# 2. 去各候选插件源码里反查，逐字命中的才是真实现
Select-String -Path "<插件A>\index.js","<插件B>\lib\*.js" -SimpleMatch '<那一句>'
```

**实测案例**：
```
vision_ground 的 description
  ✅ 逐字命中 dsh-vision-router\index.js L6103
  ❌ toolkit\lib\tools.js L188 措辞完全不同（"analyzed image coordinates"）
→ 结论：14/15 个 vision_* 属 router，仅 vision_toolkit_activate 属 toolkit
→ 而且 toolkit 那套要 vision_toolkit_activate 才暴露，当前根本没激活
```

**同名不同物是常态**，尤其同领域插件共存时。归属搞错的后果：

| 我做了什么 | 结果 |
|---|---|
| 读了 toolkit 的 Python 链路 | 写下"全链路无缺陷"——**读的是另一个插件** |
| 直跑 `ground.py` 精确 | 写下"工具正常"——**工具不执行那个脚本** |
| 翻 `vision-router.log` 找 404 | 编出"后端故障"——**那日志 ERROR 0 条、不记 per-call** |
| 发现日志归属可疑 | 又编出"toolkit 不写日志"——**归属恰好反了** |

⚠️ **别信这些"看起来像归属"的线索**：包名相似、目录里有同名脚本、日志目录存在、
甚至我自己上一轮写的文档。**只有 description 逐字比对算证据。**

💡 **反向线索也要看**：产物落在 `.dsh-vision-router\artifacts\`——**目录名就写着归属**，
我四轮没注意。排查时先看产物路径、进程命令行、注册函数（`deepToolDefs.push` 等）。

## 铁律二：报错的作用域不能外推

**这是 2026-08-27 那次失误的真正形状，比"忘了查工具"严重得多。**

我看到：
```
[image unavailable: image/png; model "ark-code-latest" does not declare image input]
```

这条报错**只证明一件事**：主模型的请求体不接受 image part。

我推出的结论：**"我没有看图能力"** ← **越界了**

正确推理：
```
模型 image input ≠ agent 视觉能力
主模型不收图  →  只说明主模型不收图
独立工具链是否能看图  →  是另一个问题，必须另外查
```

**危险之处：这个否定从未被说出口。** 它以"那我得想办法搞一个看图能力"的形式
变成了行动计划。AGENTS.md §0 防的是"说出'本机没有X'"，**防不住藏在行动前提里的否定**。

→ **能力自查必须是显式动作，不能是推理副产品。**

**通用检查表**：拿到一条报错，先问「它的作用域是什么」：

| 报错 | 只证明 | 不证明 |
|---|---|---|
| `model does not declare image input` | 主模型请求体不收图 | agent 不能看图 |
| `MISSING_CREDENTIAL` | 该解析路径没拿到值 | 机器上没有这个 key |
| `429` | 当前配额/并发被限 | 额度耗尽或 key 无效（401 才是无效） |
| `tools_search: total 0` | 描述文本没命中关键词 | 工具不存在 |
| `exit 0` | 进程正常退出 | 操作真的做成了 |

---

## 触发时机（硬性）

**必须**在以下时刻**先**跑自检：

1. 用户问「你能不能X」「你会不会X」「你的X能力怎么样」「X 好不好用」
2. 我准备说「我没有X能力」「我看不到X」「这需要先配置X」「得先装个X」
3. 我准备**新建**一个能力（写 MCP server / 配 provider / 装插件）
4. 我准备说「本机没有X」这类存在性否定（AGENTS.md §0）

---

## 标准流程

```
① 查权威工具表
   cordis_inspect_query(host / Tool / listTools)
   → 用锚定正则拿全工具名清单（不能肉眼数）；再精读候选工具那几段
   → ⚠️ 这只告诉你"本次能调什么"。要判"本机装没装"另查 cordis.patch.yml

② 读参数契约（别猜）
   tools_schema <确切名>
   ⚠️ 同一工具族的参数名可能不一致！实测反例：
      vision_describe → paths: 数组
      vision_ocr / vision_crop / vision_present → image: 字符串
      vision_crop 的区域是 region: "x1,y1,x2,y2" 字符串，不是四个独立参数
   猜错的代价：报错信息往往不提示正确形状（vision_describe 传裸字符串
   只说 "provide 1-4 images"，完全不提"要数组"）

③ 最小实调验证（这步不能省）
   拿一个判据明确的输入实际调一次。
   ⚠️ 判据必须不可猜：用随机验证码，别用"你好世界"
   ⚠️ 注意整轮预算：视觉后端一轮里连发会耗尽，先想清楚问什么

④ 三种结果三种走法
   成功        → 直接回答用户，附实测证据。结束。
   参数错      → 回 ② 读 schema，别改写问法瞎试
   后端失败    → 读配置找真因（见 AGENTS.md §2.1.1 的 OVH 假冗余案例）
                 别改写问法重试——auth/限流/宕机改问法都没用

⑤ 只有 ④ 暴露出真实缺口，才考虑新建能力
   且必须先说清：现有链路缺什么、为什么补不了、新建的边界在哪
```

---

## 反面清单（这次会话真实踩的）

| 错误 | 正确 |
|---|---|
| 看到模型不收图 → 直接开始造 OCR | 先 `listTools` 查有没有现成的 |
| 改模型路由 → 直接写 `cordis.patch.yml` | 先确认权威源是 `settings.yaml`（插件注册 settings namespace 就归它） |
| 拿到 500KB listTools → 挑眼熟的抄 | 先用锚定正则拿全清单，再精读候选那几段 |
| `tools_schema` 回 `found:false` → 断言"没这能力" | 只能断言"这个名字没装载"；换 `tools_search` 按语义捞真名 |
| `listTools` 里没有 → 断言"本机没装" | `listTools` 是本次装载量；存在性看 `cordis.patch.yml` |
| 照抄护栏文档里的技术断言 | **连自己写的护栏也要实测**——我曾把"不锚定会算进参数名"写进 AGENTS.md，实测不成立 |
| 猜 `vision_crop(x1,y1,x2,y2)` | `tools_schema` 看到是 `region: "x1,y1,x2,y2"` |
| 现有方案靠用户提醒才发现 | 角色倒置。用户不该充当环境索引 |

---

## 自评盲区（必须外部审计）

**我发现不了自己的事实错误。** 本次"13 vs 15"是子智能体抓的。

→ 给用户重要结论前，触发 `dsh-verification`；大任务收尾派子智能体独立审计
（模板见 `dsh-memory §5`）。**自评不可信不是谦辞，是实测结论。**
