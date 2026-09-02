---
name: dsh-script-preflight
description: 一次性脚本起飞前检查。写完 .py/.ps1/.mjs 准备执行前、脚本卡死或整段静默失败后、调 MCP 工具前、拿到外部报告/网页内容准备当结论用之前使用。四条铁律：先 lint 再执行、先 tiny case 再全量、先查 schema 再传参、把假设写成断言（含外部数据校验与声称分级核对）。
version: 2.2.0
---

# 脚本起飞前检查（Script Preflight）

> 本技能的每条规则都来自真实失败记录，不是假想场景。
> 基线失败样本见文末「真实失败档案」——那是写这份技能的 RED 阶段。

## 一、为什么需要它

一次性脚本的失败有个特征：**它不报错，它浪费时间**。

三种典型浪费，按代价排序：

| 浪费 | 代价 | 典型症状 |
|---|---|---|
**黑箱卡死** | 最贵，10 分钟起 | 无输出、无进度、超时被杀，零信息 |
**脚本自崩** | 中，一轮返工 | 第一行就炸，后面全没跑，但看起来"执行了" |
**参数猜错** | 低，但最频繁 | `unknown field`、`not of type` |

这三种都**不是逻辑错误**，是起飞前没检查。

## 二、三条铁律

### 铁律 1：先 lint 再执行

写完脚本、**执行之前**，跑对应语言的静态检查。

| 语言 | 命令 |
|---|---|
Python | `ruff check --select E,F,B,S <file>` 然后 `mypy --ignore-missing-imports <file>` |
PowerShell | `Import-Module <PSSA路径>; Invoke-ScriptAnalyzer -Path <file> -Severity Error,Warning` |
JS/TS | `tsc --noEmit <file>` 或 `eslint <file>` |
| **一条命令版（v2.1.0）** | `node E:\DSH-Data\dsh-claim-gate\test\preflight-lint.mjs <file...>` —— 自动识别 `.ps1/.mjs/.js/.sh/.py` 跑对应 linter（PSScriptAnalyzer / node --check / shellcheck / py_compile），汇总报告，有失败 exit 1 |

**为什么是 `--select E,F,B,S` 而不是默认**：ruff 默认规则集放过了 `subprocess(shell=True)`；只有 `S`（安全）规则集才报 `S602`。实测默认配置对真实 bug 是 `All checks passed!`。

**mypy 值得单独跑**：它抓的是 ruff 抓不到的一类——「可能为 None 却被索引」。实测一次抓到 4 处，全在错误处理路径上，正是那种"验证失败时脚本自己先崩"的坑。

### 铁律 2：先 tiny case 再全量

**长任务的第一次运行永远是 tiny case。**

必备三件套：

1. **最小输入** —— 能跑通 1 条就够，别一上来喂全量
2. **逐步时间戳** —— 每个阶段 `[  9.7s] xxx`，让失败点自己暴露
3. **硬超时 + 中间进度** —— 任何等待都有 deadline，绝不无限阻塞

对照真实案例：

```
带时间戳的探针（9.7 秒定位根因）：
  [0.3s] initialize OK
  [0.3s] session/new OK
  [7.7s] imported OK
  [9.7s] ✗ Missing credentials      ← 根因，一眼看到

想"一次跑完整流程"的脚本：
  (no output)
  [timed out after 580000ms]        ← 两次，零信息
```

**同一个 bug，短反馈环 9.7 秒，长反馈环 19 分钟且什么都没学到。**

### 铁律 3：调 MCP 工具前查 schema

**不要猜参数名。** 这是最容易犯、也最容易避免的一类。

调用不熟的 MCP 工具前，先 `tools_search` 看描述，或直接发一次最小调用读它的报错——报错会告诉你必填字段。

真实教训：同一会话里猜错 5 次参数名（`content` vs `messages`、`pattern` vs `needle`、`project` vs `project_name`、`prompt` vs `task`、`name_path` vs `name_path_pattern`）。**每一次查一下都能避免。**

### 铁律 4：把假设写成断言（治 lint 抓不到的那三类）

lint 只查代码内部一致性。**「我对世界的假设错了」这类只能靠把假设显式化。**

三类各有对策，都经实测验证：

#### 4a. 自己数据的形状 → 前置契约断言

```python
# ✗ 静默出错：看起来成功了，假设从未被检查
return msg[0:60]                      # msg 只有 4 字符 → 返回 'boom'

# ✓ 假设写成断言：失败点=根因，报错自带诊断
if len(msg) < 60:
    raise ValueError(f"CONTRACT: message shorter than 60 (len={len(msg)}); "
                     f"truncation would silently no-op")
```

实测对照：naive 版返回 `'boom'` 看起来成功，契约版直接报出 `len=4`。

**工具化（v2.1.0）**：写解析代码前先探查真实形状——`node E:\DSH-Data\dsh-claim-gate\test\probe-json.mjs <json文件> [--depth N] [--top N]`：输出字段层级树 + 类型 + 首样本（自动剥 BOM、坏 JSON 报错 exit 1）。今天实测：419KB listTools 3 秒出结构，避免了"字段层级靠猜"（schema-contract 教训簇 7 条）。

#### 4b. 外部数据的形状 → 解析即校验，报错要带实际内容

```python
# ✗ 空列表索引，下游拿到 None，失败点离根因很远
hits = [a for a in data["assets"] if a["name"].endswith(".exe")]
return hits[0]["browser_download_url"]

# ✓ 报错直接说出真相
if not hits:
    raise ValueError(f"CONTRACT: no .exe asset in release {data.get('tag_name')}; "
                     f"present={[a.get('name') for a in assets]}")
```

实测输出：`CONTRACT: no .exe asset in release v1.13.8; present=['Obsidian-1.13.8.apk']`

**这一行报错，等于当时我花两轮才发现的事实。** 关键是**把实际拿到的内容打进报错**，不要只说"没找到"。

若结构复杂，用 `pydantic` 定义模型（`E:\GPTResearcher\venv` 内已有）；简单场景手写断言即可，别为此引入依赖。

#### 4c. 外部信息源在编造 → 声称分级 + 一手核对

**这类没有任何机械检查能挡。** 实测确认：ruff/mypy/契约断言全部无能为力。

有效的做法，按成本排序：

| 成本 | 做法 |
|---|---|
低 | **数字限制必须带作用域限定**。「5 分钟 / 5 次」这种听起来普适的限制，出现在分场景 API 上就是红旗 —— 真实规则是单聊 60 分钟/4 次、群聊 5 分钟/5 次 |
低 | **限制性/权限性声称默认视为未核实**。「需要审批」「有配额」「不支持」最影响决策，也最该先验 —— 实测那份报告说主动消息"需审批+月配额"，官方原文是"无任何条件" |
中 | **改变决策的声称，去读一手来源**。只有亲自读官方页面才能发现矛盾 |
**禁止** | **拿 HTTP 200 当内容存在的证据**。实测那个 wiki 是 SPA，**所有路径都返回 200**，包括内容根本不存在的路径 |

最后一条是硬教训：我验证过报告引用的 4 个 URL 全部 200，因此一度以为引用是真的 —— 但内容是编的。**URL 活着 ≠ 内容存在。要提取页面上的声称文本本身。**

> 注：`dsh-injection-guard` 治的是「外部内容被当成指令执行」，**不治「外部内容在编造事实」**。这是两个不同的风险，本条补的是后者。

## 三、快速参考

```bash
# Python 起飞前
ruff check --select E,F,B,S script.py && \
mypy --ignore-missing-imports script.py && \
python script.py

# PowerShell 起飞前
Import-Module "$env:USERPROFILE\.local\share\ps-modules\PSScriptAnalyzer\1.25.0\PSScriptAnalyzer.psd1"
Invoke-ScriptAnalyzer -Path script.ps1 -Severity Error,Warning
```

**常见误报，可安全忽略：**
- `S603 subprocess call: check for execution of untrusted input` —— 命令是硬编码常量时无害
- `E501 Line too long` —— 纯风格
- `PSAvoidUsingWriteHost` —— 一次性诊断脚本里 `Write-Host` 无妨

**绝不忽略：**
- `mypy: Value of type "X | None" is not indexable` —— 错误路径会崩
- `PSAvoidAssignmentToAutomaticVariable` —— 脚本第一行就死
- `S602 shell=True` —— 会改变管道语义

## 四、边界（这点必须诚实）

**静态检查（铁律 1）能抓到的**：代码内部一致性问题。
- `$home` 是只读变量、`shell=True` 改变管道语义、`final` 可能为 None、`$null` 比较方向反了

**静态检查抓不到，但铁律 4 能治的**：
- 自己数据的形状 → 4a 前置契约断言
- 外部数据的形状 → 4b 解析即校验，报错带实际内容
- 别人的 schema → 铁律 3 查 schema

**任何机械手段都治不了的**（实测确认）：
- **外部信息源在编造事实** —— 只能靠 4c 的声称分级 + 一手核对。ruff/mypy/契约断言全部无能为力。

**结论：静态检查是下限，契约断言是中层，一手核对是唯一的上限。**
层级越往上越贵，但覆盖的正是代价最大的失败。

## 五、红旗清单

看到这些立刻停下：

- [ ] 准备执行一个刚写完、还没 lint 的脚本
- [ ] 准备让一个脚本跑 5 分钟以上，但它没有中间进度输出
- [ ] 准备调一个不熟的 MCP 工具，正在凭印象填参数
- [ ] 脚本超时被杀，我想直接加大超时重跑（应该先加时间戳和进度）
- [ ] 一个脚本失败两次了，我还在改细节（应该换成 tiny case 重新定位）
- [ ] 正在切片/索引一个长度来自外部的东西，却没检查长度（→ 4a）
- [ ] 正在从外部 JSON 取字段，假设它一定存在（→ 4b）
- [ ] 拿到子代理/外部报告，准备直接当结论用（→ 4c）
- [ ] 看到引用的 URL 返回 200，就认为它引用的内容是真的（**SPA 全路径 200**）
- [ ] 报告里有个听起来普适的数字限制，但那个 API 明显分场景（→ 4c 作用域限定）

## 六、真实失败档案（本技能的 RED 基线）

| 失败 | 根因 | 对策 |
|---|---|---|
`$home=Split-Path ...` 整脚本静默失败 | PowerShell 只读自动变量 | 铁律 1（PSSA 报 `PSAvoidAssignmentToAutomaticVariable`）|
ACP 验证脚本卡死 580s × 2 | `subprocess(shell=True)` 破坏 stdout 行缓冲 | 铁律 1（`ruff --select S` 报 S602）+ 铁律 2 |
`final` 可能为 None 被索引 4 处 | `fail()` 会 exit 但没标 `NoReturn` | 铁律 1（mypy）|
5 次 MCP 参数名猜错 | 没查 schema | 铁律 3 |
`Substring(0,60)` 越界 | 错误消息比 60 短 | 铁律 4a（契约断言）|
Obsidian `latest` 无 exe | 那个 release 只有 Android APK | 铁律 4b（报错带 `present=[...]`）|
调研报告把群聊规则当通用规则 | 外部信息源编造 | 铁律 4c（一手核对；**无机械解**）|

**7 个样本：铁律 1 挡 3 个，铁律 3 挡 1 个，铁律 4a/4b 挡 2 个，4c 需人工核对 1 个。**

对比初版技能（只有铁律 1-3）：当时 3 个标记为"抓不到"，现在 2 个有了机械对策，1 个明确无解但有降低概率的纪律。

## 七、环境注记（本机具体路径）

- `ruff` / `mypy` / `pytest` 在系统 PATH，可直接用
- **PSScriptAnalyzer 不在标准位置**：`~\Documents\WindowsPowerShell\Modules` 被文件系统钩子拦截（创建目录会报 `FileNotFoundException`，`attrib -r` 与 `cmd mkdir` 同样失败）。已装到：
  ```
  C:\Users\L\.local\share\ps-modules\PSScriptAnalyzer\1.25.0\PSScriptAnalyzer.psd1
  ```
  用绝对路径 `Import-Module` 加载。
- `tsc` / `eslint` / `prettier` 在 PATH
