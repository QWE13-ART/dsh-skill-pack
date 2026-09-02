---
name: dsh-rules-full
version: 1.0.0
description: 本机 DSH 历史完整约定与事故复盘（AGENTS.md 精简前的全文索引）。涉及插件开发/重启/配置修改/崩溃排查/事故复盘/JSON 配置/junction/预检流程/runtime.log 时加载。包含：AGENTS.md 被精简掉的 §0.1 报错作用域完整表、§0.2 能力边界细节、§0.3 插件生态全史（pnpm 事故/junction 规范/发布流程）、§7 环境事故复盘、§8 工具发现完整记录、裸探 MCP server 脚本。
displayName: 本机完整规则史
slug: rules-full
license: MIT
tags: [rules, history, plugin, cordis, junction, pnpm, runtime-log, preflight, 插件, 重启, 配置, 事故复盘]
---

# 本机 DSH 完整规则史（AGENTS.md 精简版的历史全文入口）

本技能是 `AGENTS.md`（精简版，~27KB）的**历史细节层**。AGENTS.md 只留每轮必须执行的红线；
这里的完整历史（63KB）按需加载。**三层披露**：① catalog 名字+描述（永远在）→ ② 本 SKILL.md
摘要+指针（触发时）→ ③ `~/.dsh/reference/agents-full.md` 全文（真正要细节时 read）。

## 何时加载本技能

- 涉及 **插件开发 / 重启 / cordis.patch.yml 修改 / 配置 JSON 修改**（先读 §0.3 执行要点）
- 涉及 **崩溃排查 / runtime.log 定位 / 预检流程**（先读 §0.3 执行要点）
- 需要 **AGENTS.md 精简前的完整记录**（事故复盘、调研细节、发布历史）
- 需要 **裸探 stdio MCP server** 的完整脚本（§8）

## 关键执行要点（从完整历史提炼，AGENTS.md 也有，这里是全版）

### §0.3 插件生态执行要点
- 🔥 **自研插件必须用 junction**：`profile\node_modules\<插件>` 若是实体副本，只改源目录不重启等于没改。查 `(Get-Item <path> -Force).LinkType`。
- 🔥 **DSH 运行时，任何包管理器都不许动 profile 的 node_modules**（pnpm 事故曾删掉共享依赖源头 → 5 插件全崩）。正确做法 = 手工对齐四处 + 自建 junction：
  ① `package.json` dependencies 加 `"<名>": "file:E:/DSH-Data/<名>"`；
  ② `dsh.profile.bundles` 数组加名字；
  ③ `desktop-plugins.lock.json` plugins 数组加条目（enabled/compatible，字段照抄已有条目）；
  ④ `node_modules\<名>` → Junction → 源目录；源目录 `node_modules\@deepseek-ai` → Junction → `profile\node_modules\@deepseek-ai`（24 包权威源）。
  **装前先快照 node_modules**（顶层包数 / junction 清单 / @deepseek-ai 子包数）。
- 🔥 **改 JSON 配置永远用 `edit` 字面插入，绝不用 `ConvertTo-Json` 重写**（PS5.1 写 BOM → JSON.parse 崩 → 工具 363→24）。校验用 `node -e "JSON.parse(require('fs').readFileSync(f,'utf8'))"`，并查前 3 字节。`ConvertTo-Json` 会重排整个文件。
- 🔥 **lock 条目字段别凭印象编**：真实结构 `{name, requested, version, managedByDesktop, bundled, enabled, compatibility:{status,reasons}}`。
- 🔥 **重启前预检**：`node E:\DSH-Data\scripts\preflight-all.mjs`（8 个自研插件）。用真 cordis Context（`new Context()` → `root.plugin(mod, cfg)` → `await fiber` → 抓 apply 抛错 + 查 `fiber.state === 2`）。**两个判据都要看**（inject 缺服务时 await 正常返回不抛错，只有 state 是 0）。⚠️ 不许 fake ctx（比真实宿主宽松 = 没测）。
- 🔥 **`ctx.config` 不存在**：config 是 apply 第二参。`ctx` 上任何未声明属性撞 ReflectService 兜底 trap。可选读服务用 `ctx.get(name)`。
- 🔥 **`inject` 只有两种形式**：数组 `["a"]` 或 `{服务名: intercept配置}`。`{required:[],optional:[]}` 不存在，会被当成等一个名为 required 的服务 → 永不加载。
- 🔥 **`provide(name, value, check)` 第三参必须是函数或省略**——传 `true` 会让 L1309 抛错 → 永远 state=0（曾误报 28/35 插件"未激活"）。
- 🔥 **`cordis.patch.yml` 格式**：真实是 `- insert:` 包一层 ＋ `name:`，不是 `- id:` ＋ `plugin:`。写前 grep 一个能工作的插件照抄。验的是运行不是登记。
- 🔥 **读 `runtime.log` 先用 `bootId` 圈定本次 boot 行号范围**（范围外报错看着再像也不是真因）。位置：`%APPDATA%\@deepseek-ai\dsh-desktop\logs\runtime.log`。判定装载了什么用 `cordis_inspect_query(host/Tool/listTools)`。
- 🔥 **bundle 入口解析**：同时支持 `main` 与 `exports["."]`（只看 main 会把 @linxin666/dsh-skins、@liustack/modlens 误报缺失）。

### git 双锁（6/6 自研仓）
- ① .gitignore 含 `.npmrc` + `.codegraph/`；② gitleaks 8.30.1 pre-commit hook（模板 `E:\DSH-Data\scripts\pre-commit`）。
- ⚠️ gitleaks 默认 allowlist 放行文档示例 key——验 hook 用真实形状载荷（`ghp_`/`npm_` 前缀）。
- ⚠️ winget 装的 gitleaks 只进用户级 PATH，已运行 DSH 进程内裸命令不可用（启动时快照环境变量），脚本写绝对路径。
- 🔑 push 认证：`GH_TOKEN`（HKCU:\Environment）走 `https://oauth2:<token>@github.com/...`；`x-access-token:` 前缀会被拒。DSH 子进程内 `$env:GH_TOKEN` 为空，必须从注册表读。
- 📦 npm publish：临时 npmrc（`$env:TEMP` 随机名，`npm --userconfig` 指定）→ publish → finally 删除 → `npm view <pkg> version` 复核。项目内 .npmrc 会被 git add -A 提交 → push protection 拒绝。

### §7 环境事故复盘（完整版见 agents-full.md）
- **2026-08-29 show-media 事故**：`ctx.systemPrompt` 无 inject → plugin tree 崩溃 → 回退 desktop-builtins（工具大量消失）。修复：`inject = ["tools", "fs", "systemPrompt"]`（npm install 会覆盖此补丁）。
- **2026-08-30 三次 120s 超时**：MCP 子进程「静默退出」拖死 startup。带 junction 共享依赖的目录禁止 npm install（教训 #17）。
- **2026-08-31 pnpm 事故**：DSH 运行中跑 pnpm add → 重算依赖树 → 撞文件占用 → EPERM 半途中断 → 删掉共享依赖源头、bundles 33→55、残留 *_tmp_*。回滚三处后重启恢复。
- **bundles 数组改动必须重启 DSH 才生效**（bundle 层 boot 时组装）。
- 密钥绝不写进 cordis 配置（env 纯字符串不展开 `${VAR}`）。用 `.secrets/` + ACL + .gitignore。

### §8 工具发现完整记录
- **裸探 stdio MCP server 的真实工具名**（完整脚本在 agents-full.md §8）：
  ```powershell
  $in="$env:TEMP\p_in.txt"
  Set-Content $in '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"p","version":"1"}}}
  {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' -Encoding utf8
  $p=Start-Process <node.exe> -ArgumentList <shim>,serve,--mcp -RedirectStandardInput $in `
    -RedirectStandardOutput "$env:TEMP\p_out.txt" -NoNewWindow -PassThru
  Start-Sleep 12; if(!$p.HasExited){$p.Kill()}; Get-Content "$env:TEMP\p_out.txt" -Raw
  ```
- **tools_search 分词 bug 已修**（2026-08-31）：BM25 把连字符/下划线当词内字符 → 工具名整 token 不可搜。已修（双写子词），修后 `"playwright"` → 24 个。搜索 0 ≠ 不存在。
- **search_repositories 的坑**：`stars:>N` 与多关键词组合静默返回 0；`repo:` 限定符 Validation Failed。用 `owner/name` 精确查。

## 全文指针

完整历史（63KB，本 SKILL.md 的展开版）：`~/.dsh/reference/agents-full.md`
- §0 溯源铁律完整论证（821 轮门禁调研数据、dump 字段真相）
- §0.1 报错作用域完整表（11 行）+ 归属核验六连错复盘
- §0.2 能力边界（363 工具、listTools vs 配置、自主性定位表）
- §0.3 插件生态全史（发布状态表、junction 规范、pnpm 事故、预检、JSON 配置坑）
- §1-§5、§7-§9 全部细节
- 相关：`~/.dsh/reference/cordis-pitfalls.md`（配置坑 + 事故复盘细节）
