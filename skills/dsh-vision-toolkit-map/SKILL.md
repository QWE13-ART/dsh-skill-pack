---
name: dsh-vision-toolkit-map
description: 本机 15 个 vision_* 工具的实测能力边界表与真实归属。要看图/读截图/定位界面元素/比对设计稿/取色/裁剪/呈现图片给用户时使用。含参数契约差异（paths 数组 vs image 字符串 vs region 字符串）、工具由哪个插件实现、曾误判失效的三个工具、后端 429 真因与解法。
version: 2.0.0
---

# 视觉工具实测能力图（2026-08-27 逐个实调）

> ⚠️ **本文件名有误导性**：这些工具**几乎全部不属于** `@anionex/dsh-vision-toolkit`，
> 而属于 **`dsh-vision-router`**。见下方"零、归属"一节。名字保留是为了不断链。

## 零、归属（先看这个，2026-08-27 外部审计抓出的最大错误）

🔥 **我曾把 15 个工具全写成 `@anionex/dsh-vision-toolkit` 提供，错了。**

**判定方法（唯一可靠）**：拿 `tools_schema <名>` 返回的 **description 原文**，
去各候选插件的源码里 `Select-String` 反查，逐字命中的那个才是真实现。

实测结果：
```
tools_schema vision_ground 的 description
  == dsh-vision-router\index.js L6103 的 description  逐字相同 ✅
  != toolkit\lib\tools.js L188 的 description（"analyzed image coordinates"，措辞完全不同）
```

| 工具 | 真实注册者 | 位置 |
|---|---|---|
| `vision_describe` | `dsh-vision-router` | `index.js` L5193 |
| `vision_bootstrap` | `dsh-vision-router` | L5699 |
| `vision_materialize` | `dsh-vision-router` | L5870 |
| **`vision_ground`** | **`dsh-vision-router`** | **L6103** |
| **`vision_detect`** | **`dsh-vision-router`** | **L6193** |
| `vision_crop` | `dsh-vision-router` | L6259 |
| `vision_present` | `dsh-vision-router` | L6335 |
| `vision_pixel_diff` | `dsh-vision-router` | L6392 |
| **`vision_colors`** | **`dsh-vision-router`** | **L6535**（sharp 量化，**不是** `dominant_colors.py`） |
| `vision_ocr` | `dsh-vision-router` | L6564 |
| `vision_long_screenshot_ocr` | `dsh-vision-router` | L6639 |
| `vision_trace` | `dsh-vision-router` | L6832 |
| `vision_extract_foreground` | `dsh-vision-router` | L6891 |
| `vision_html_screenshot` | `dsh-vision-router` | L6932 |
| `vision_toolkit_activate` | `@anionex/dsh-vision-toolkit` | `lib/exposure.js` L108 |

`deepToolDefs.push` 在 router 里出现 **15 次**；`ground.py` / `detect.py` /
`parseLocationOutput` 在 router 里各出现 **0 次**。

⚠️ **toolkit 的那套工具当前根本没激活**——`exposure.js` L108-110 说明它们要靠
`vision_toolkit_activate` 或加载 vision skill 才暴露。**同名不同物，别混。**

> ⚠️ **下表 ✅ 是本机实际调用结果；但 `vision_ground`/`vision_detect`/`vision_colors`
> 那三行的"正常"结论来自直跑 toolkit 的 Python 脚本，
> 而真实实现是 router 的 JS —— 那些证据对这三个工具无效，已在下文标注。**
> 测试图：560×340 PNG，含蓝色标题栏、红圆/绿方/黄三角、随机验证码 `8T41QG`、算式 `17 x 3 = ?`

---

## 一、参数契约（三种形状，最易踩）

⚠️ **同一工具族参数名不统一。猜必错，且报错不提示正确形状。**

| 形状 | 工具 | 写法 |
|---|---|---|
| `paths` **数组** | `vision_describe` | `paths: ["E:\\dir\\x.png"]` |
| `image` **字符串** | `vision_ocr` `vision_crop` `vision_present` `vision_colors` `vision_ground` `vision_detect` | `image: "E:\\dir\\x.png"` |
| `region` **字符串** | `vision_crop` | `region: "220,70,310,160"`（**不是**四个独立参数） |

实测报错样本（都不说真正原因）：
```
vision_describe(paths: "x.png")     → "provide 1-4 images via paths and/or attachmentIds"  ← 不提"要数组"
vision_crop(x1:220, y1:70, ...)     → 'invalid region "undefined"'                          ← 不提"叫 region"
vision_present(images: [...])       → "file_path must be a non-empty string"                ← 不提"叫 image"
```

→ **铁律：调 vision_* 前先 `tools_schema <确切名>`。**

中文路径可靠写法（转义 unicode）：
```
paths: ["E:\\\u65b0\u5efa\u6587\u4ef6\u5939\\x.png"]
```

---

## 二、实测结果表

### ✅ 可靠（已验证）

| 工具 | 实测证据 |
|---|---|
| **`vision_describe`** | 认出红圆/绿方/黄三角 + 算式答案 51 + **提问里未提示的"标题栏蓝色"** → 真在看像素 |
| **`vision_ocr`** | `engine:"vision"`，随机验证码 `8T41QG` **一字不差**，含中文行 |
| **`vision_crop`** | `region:"220,70,310,160"` → 落盘 90×90 / 675 bytes PNG |
| **`vision_present`** | 图真的呈现在会话 UI，返回 `attachmentId: sha256:f969...`、`safePresentation:true` |

### ⚠️ 曾误判为失效，实测全部正常（**本表最重要的一段**）

| 工具 | 初次观测 | 真因（2026-08-27 读真实实现 + 真工具复现，已定案）|
|---|---|---|
| **`vision_ground`** | `{x1:0,y1:0,x2:560,y2:340}` 整图 | 🔥 **模型输出的坐标不可信**，代码无 bug（详见下节） |
| **`vision_detect`** | `{elements:[]}` 空数组 | 🔥 **prompt 明确教模型返回 `[]`**，代码把空数组当合法结果 |
| **`vision_colors`** | 漏掉红绿黄 | ✅ **按设计工作**：主色量化，不是物体取色器 |

Pillow 逐像素真值对照（`bbox` 严格阈值实测）：
```
red px=(31,81,99,149)   green px=(131,81,199,149)   yellow px=(231,81,299,149)
```

## 一、真因定案（第六次追查，这次有决定性实验）

前五次归因全错（见文末）。第六次终于走了唯一有效的路径：**读真实实现 + 用真工具复现**。

### 决定性实验：同一张图，再调一次真工具

**`vision_describe`（后端完全正常）**：认出三个图形、颜色、左中右顺序**全对**，
但给的框是 `红[40,200,150,380] 绿[170,200,280,380] 黄[300,200,410,380]`
——**y2=380 超出图高 340**，y 系统性偏移 ~119px。
模型自己还补了一句"坐标是视觉估算的，精确坐标需要图像处理软件"。

**`vision_ground "the yellow triangle"`（成功复现异常）**：
```
返回 (357,208,494,340)     真值 (231,81,299,149)
x 偏 126px   y 偏 127px   y2 正好顶到 340 = 图高上限（clamp 截断的痕迹）
```

### 真因：VLM 不会做精确像素定位，代码只是忠实转发

```js
// index.js L6131-6144：拿到模型返回的框，只做边界 clamp，不做合理性校验
const vision = await answerVisionForTool(exec, bytes, mediaType, instruction)
const box = parseBox(extractJson(vision.text))
let clamped = { x1: max(0,min(box.x1,width-1)), ..., y2: max(1,min(box.y2,height)) }
```

- **`answerVisionForTool` 返回什么，就用什么。** 模型编的坐标 = 工具的输出。
- L6145 的 retry **只在框太小时触发**（`x2-x1 < 2 || y2-y1 < 2`），
  **框太大、框错位、框等于整图 → 全部静默通过**。
- 所以初次那个整图框 `(0,0,560,340)`：**模型返回的就是整图**，代码照实转发。
  这不是"退化成整图的兜底"，是**没有任何上限校验**。

**`vision_detect` 的空数组同理，而且更明确**——prompt 亲口教它这么答：
```js
// index.js L1369 visionDetectInstruction
'- if nothing matches, return {"elements":[]}.'
// index.js L1430 normalizeDetectResult：无条件返回，空数组是合法结果
return { width, height, elements }
```
模型没识别出"图形"这个中文类别 → 老实返回 `[]` → 代码判定合法 → 用户看到空数组。

### 结论

| 判断 | 定案 |
|---|---|
| 代码有 bug 吗 | **没有**。解析严格、clamp 正确、失败路径都 throw |
| 后端故障吗 | **没有**。`vision_describe` 语义全对，后端健康 |
| 那问题在哪 | **VLM 的空间定位能力本身**。语义强、像素坐标弱 |
| 是偶发吗 | **不是，可稳定复现**。两次调用两次错，只是错法不同 |

🔥 **能力边界（这才是该写进文档的东西）**：
- ✅ `vision_ground` / `vision_detect` 能告诉你**有什么、大致在哪个区域**
- ❌ **不能**给可点击的精确坐标；误差可达 **100+ px**，可能越界后被 clamp 到边缘
- → **要真实可点坐标，用 `mcp__windows__Snapshot` 或 `mcp__playwright__browser_snapshot`**
  （UI 树是结构化数据，不是视觉估算）
- → 要精确像素，用 Pillow / sharp 自己算
- → 用 `vision_ground` 结果之前，**先做合理性检查**：框是否≈整图？是否顶到边界？
  宽高比是否荒谬？这些代码不替你查

⚠️ **`vision_detect` 返回 `[]` 时先换英文类别词再试**（"图形" → "colored shapes"），
空数组常常只是模型没听懂类别，不是图里真没东西。

---

**以下是被推翻的旧结论，保留作为归因错误的记录。**

🔥 **旧的"免责证据"全部作废（2026-08-27 外部审计推翻）。**

我当时读的链路是 **toolkit 的 Python 链路**：
`coordinate_order()` → `_normalize_box` → `parse_matches` → `parseLocationOutput` → `runtime.ground()`。
**但这三个工具不走那条路。** 真实实现是 `dsh-vision-router\index.js` 的纯 JS：
`readImageBytes` → 自拼 prompt → `answerVisionForTool` → `extractJson` → `parseBox` → clamp。
router 里 `ground.py` / `detect.py` / `parseLocationOutput` 各出现 **0 次**。

→ **所以下列说法全部撤回**：
- ❌「全链路逐环读源码验证，无一处缺陷」——读的是**另一个插件**的链路
- ❌「代码里没有任何退化成整图的兜底分支」——**结论巧合正确但推理无效**；
  真实实现确实没有"退化"分支，但原因是**它连上限校验都没有**
- ❌「直跑 ground.py / detect.py 复现」——**对这三个工具永远复现不了任何行为，是死路**
- ❌「`vision_colors` 是 `dominant_colors.py`、45×45 降采样」——真实实现是 router
  L6535 的 **sharp 量化**；那个 py 的 `--max-pixels` 默认也是 **96** 不是 45
- ❌「真因是后端瞬时故障」——后端健康，是 VLM 定位能力本身
- ❌「现场已丢，永远查不出真因」——**再调一次工具就复现了**

`logs\vision-router\vision-router.log` 实查：**ERROR 0 条**，747 条 404/401 全是
**DEBUG 级 model discovery**（列模型目录），`ocr`/`infer`/`attempted`/`chat/completions`
各 **0 次** —— **该日志在结构上不记录任何单次推理调用**。这是**可观测性缺口**。
💡 **但它不重要**：这类问题**不需要日志，直接重调工具就能复现**。
我却因为"现场丢了"停止追查——**把可复现的问题当成了不可追溯的偶发。**

→ **正确排查路径（唯一有效）**：
```
读 dsh-vision-router\index.js L6103+ 的 vision_ground 实现
  关注 answerVisionForTool 的返回、extractJson / parseBox 的失败分支、
       clamp 与 degenerate-sliver 重试在异常输入下的行为
```
要复现就**直接再调一次真工具**并留存 `artifacts\` 产物，或在 router handler 外包一层日志。

🔥 **这一段的元教训（比工具表本身更重要）**：
我在追同一个根因时连犯**五次**归因错误，每次都"顺理成章"：
1. 断言 `VISION_MODEL` 为空 → 实际是 `gemini-3.7-flash`；
2. 断言模型返回的框是错的 → 实际误差 <1%，我**拿记忆当真值**；
3. 断言 `upstream.js` guard 解析失配 → guard 只包 prompt，解析器严格且正确；
4. 断言"后端瞬时故障"，拿 404/401 当证据 → 那些是 **DEBUG 级 model discovery**，
   该日志 **ERROR 0 条**、不记任何单次推理调用；
5. 断言"那是另一个插件的日志、toolkit 不写日志所以现场丢失" → **归属搞反了**，
   这些工具**本来就属于 vision-router**，那就是对的插件的日志。

**⑤ 藏在纠正 ④ 的那段话里**——我一边写"不要用错插件的日志定罪"，
一边正在把工具归给错的插件。

🔥 **真正的根本原因，前五次都没碰到：我从头到尾没验过"这个工具由谁实现"。**
①②③ 读错了源码文件，④⑤ 读错了日志归属，**全都源于同一个未经检验的前提**。
一次归属核验就能同时拦掉全部五次。

→ **铁律：谈任何"X 正常/X 坏了/X 的真因是…"之前，先做归属核验：**
```
tools_schema <工具名>  →  取 description 原文
Select-String -Path <各候选插件源码> -SimpleMatch '<description 的一段>'
逐字命中的那个插件才是真实现；再谈它的代码路径和日志。
```
**这一步做完，才有资格谈根因。** 这条已写进 `dsh-capability-selfcheck`。

**看到异常输出时，"工具坏了"是最省事的结论，也最容易错。**
先直跑底层、再查后端日志，两步都做完才有资格判定。

### ⬜ 仍未测（诚实标注）

`vision_pixel_diff`（像素比对）/ `vision_long_screenshot_ocr`（长截图分块）/
`vision_html_screenshot`（渲染 html 截图）/ `vision_trace`（矢量化）/
`vision_extract_foreground`（抠背景）/ `vision_bootstrap` / `vision_materialize` /
`vision_toolkit_activate` / `modlens_read_image`

---

## 三、选型速查

| 问题 | 用什么 | 说明 |
|---|---|---|
| 「这行字是什么」 | `vision_ocr` | — |
| 「界面长什么样/好不好看/布局对不对」 | `vision_describe` | `vision_ocr` 只给字，给不了视觉判断 |
| 「某个控件在哪、坐标多少」 | **优先** `mcp__windows__Snapshot` UI 树 | 结构化数据，不依赖视觉后端可用性；`vision_ground` 也准但受后端影响 |
| 「界面上有几个按钮」 | **优先** `mcp__windows__Snapshot` | 同上；`vision_detect` 可用作补充 |
| 「放大看细节」 | `vision_crop` → 再 `vision_describe` 裁剪产物 | — |
| 「把生成的图给用户看」 | **`vision_present`（强制）** | `read_image` 是给模型看的，不呈现给用户 |
| 「主色调/背景色是什么」 | `vision_colors` | 这是它的正确用途 |
| 「那个小图标是什么颜色」 | `vision_describe` | `vision_colors` 会漏掉小面积物体 |

---

## 四、后端与预算（会决定成败）

**⚠️ 视觉后端有整轮时间预算。** 耗尽会收到系统提示"不要再调用视觉工具"。
→ **一轮里别连发**。先想清楚问什么，一次问全（`vision_describe` 的 question 可以问 3-4 个点）。

**⚠️ 遇 `ok:false` + `VISION_RATE_LIMITED` 别改写问法重试**——工具描述明确禁止，
auth/限流/宕机改问法都没用。去查后端配置。

**真因案例（2026-08-27 定案）**：5 个后端全是 `http:ovh/*` 全 429。
`dsh-vision-router` 默认后端是 OVHcloud **免注册匿名层，2 次/分钟/IP**
（`presets/ovh.yaml` 写明）。五个模型名看着像五条备用路，**实际共用一个 IP 配额 = 假冗余**。

**解法**（改 `settings.yaml`，**不是** `cordis.patch.yml`）：
```yaml
vision-router:
  onboardingSeen: true
  httpProviders:
    - name: 魔搭 ModelScope
      baseURL: https://api-inference.modelscope.cn/v1
      model: Qwen/Qwen3-VL-8B-Instruct
      apiKeyEnv: MODELSCOPE_API_KEY      # 只存引用名，值不落盘
      maxTokens: 16384
```
**改完必须重启 DSH。** 生效判据：`vision_ocr` 返回 `engine:"vision"`（之前是 `engine:"none"`）。

备用后端预设：`dsh-vision-router\presets\` 下有 dashscope / openrouter / ovh /
siliconflow / zhipu，换供应商照抄对应 yaml。

---

## 五、产物落盘位置

所有 artifact 写到**工作目录下**：
```
<workdir>\.dsh-vision-router\artifacts\<name>-<hash>-<op>.png
```
`crop` / `ground`(带标注框) / `present` 都在这。**排查时去这里看实际产出**，
比只读返回 JSON 可靠——`vision_ground` 那次就是看标注图才确认它框了整张图。
