# FUSION 报告源码

核物理同行的正式邀请报告，45 分钟，中英双版，kami 编辑风（羊皮纸底 + 墨蓝单色）。
构建产物提交在 `../talk/`，线上是 `vibeinscience.com/talk/`。

## 为什么产物要提交进仓库

fusion-web 没有 GitHub Actions，Pages 直接服务分支根目录。所以这里跟 `~/Desktop/talks`
那个仓库的做法相反：**那边推源码由 CI 构建，这边推构建产物**。改了 slides 之后必须
`npm run build`，否则线上不会变。

## 用法

```bash
npm install
npm run dev          # 预览中文版
npm run dev:en       # 预览英文版
npm run present      # 演讲者模式，左屏幻灯右屏讲稿
npm run build        # 构建两版并写入 ../talk/zh 和 ../talk/en
npm run pdf          # 导出两份 PDF（不进仓库）
```

`npm run build` 里的 `--base` 是 `/talk/zh/` 和 `/talk/en/`，改了目录结构就要同步改。

## 文件

| 文件 | 说明 |
|---|---|
| `slides-zh.md` / `slides-en.md` | 两版正文，29 张正文 + 5 张备用，结构完全对应 |
| `style.css` | kami 主题，末尾四条本地覆盖：说明性 caption 左对齐、文字版 mark、核素标签不大写、语言切换链接 |
| `fonts.css` + `fonts/` | 自托管的 Newsreader 和 Inter |
| `global-bottom.vue` | 页码，正文 29 页才显示 |
| `setup/shortcuts.ts` | 激光笔支持。没有它，翻页笔会跳过 v-click 直接翻页 |
| `vite.config.ts` | 让 dev 模式能解析 `<img src="./figures/...">` |
| `figures/` | `corpus-map.png` 在用；`case-kd02-exfor.png` 暂时没用上，见下 |

## 字体是自托管的，不要改回 Google

slidev 默认会从 `fonts.googleapis.com` 拉字体，而且会把 `Songti SC`、`Georgia`、
`monospace` 这些系统字体也当成 Google 字体去请求。两个问题：整站声明的"无外部请求"
被破坏，以及国内网络下 Google Fonts 拉不到，字体会掉回系统默认。

所以两版 frontmatter 都写了 `provider: 'none'`，Newsreader 和 Inter 的 woff2 存在
`fonts/`，由 `fonts.css` 声明，`style.css` 第一行 `@import` 引入。中文字体不自托管
（体积太大），落到 Songti SC / PingFang SC。

`favicon` 指向 `/assets/logo-nav.png`，也是为了避开 slidev 默认的 jsdelivr 图标。

重新抓字体的话，取 Google Fonts 的 css2 接口（要带桌面 UA 才给 woff2），把每个
`@font-face` 里的 URL 换成本地路径写进 `fonts.css`。

## 结构

论点是一句话：**修法不是更大的模型，是把领域知识连同一条带容差的基准固化下来。**
全部 29 页挂在这句话上。

| 段 | 页 | 时间 |
|---|---|---|
| 一、危险的成功（四步 → 半径约定 → 22% → 论点） | 1-7 | 0:00-8:30 |
| 二、FUSION 怎么做（六件事 → SKILL.md 原文 → 覆盖面 → 不绑定） | 8-12 | 8:30-13:30 |
| 三、现场演示 | 13-14 | 13:30-25:30 |
| 四、凭什么信它（分级 → 例子 → 互检 → 单精度 → 对抗审查 → 平台 → 划界） | 15-22 | 25:30-36:30 |
| 五、离线文献层（语料 → 地图 → 不画边） | 23-26 | 36:30-41:00 |
| 六、边界与邀请 | 27-29 | 41:00-45:00 |
| 备用 | 30-34 | 提问用 |

每页讲稿写在该页末尾的注释块里：中心信息、讲什么、时间、转场。`npm run present` 能看到。

## 演示（第 13-14 页）

交给它的原话：

> 算 50 MeV 的 n+⁹⁰Zr 弹性散射，用 KD02 全局光学势，然后跟 EXFOR 上有的实验数据比一下。

要点出的四个节点：

1. 参数取自本地的 Koning 原始 `kd02.f`，不是凭记忆重写公式
2. 它写出 `ap=0`
3. 做步长与分波数收敛检查
4. 查 EXFOR，然后报告 50 MeV 没有数据

**必须先录一份剪好的备份**，命名 `demo-n90zr.mp4`。现场 30 秒内没有实质进展就切录屏，
不解释、不道歉、不现场调试。

## 数字口径

- **20** = 驱动具体程序的技能；**26** = 全部技能。全场不要混用
- 61,167 页 = 61,059 篇论文页 + 108 主题页；地图投影的是 55,850 篇
- Tier 1 共 14 份，Tier 2 共 6 份

## 两个待办

1. **`figures/case-kd02-exfor.png` 还没用上。** 它是演示那一步的产物：KD02 零自由参数
   预测对 EXFOR，24 MeV 和 55 MeV 两个面板，而 50 MeV 没有面板因为那个能量没有测量。
   演示后面缺一个视觉锚点，这张图正好补上，代价是正文变 30 页，`global-bottom.vue`
   要同步改。
2. **第 18 页只引了跨求解器互检的一对数字**（COLOSS 1299.188 mb / FRESCO 1299.191 mb）。
   `skills/fresco/SKILL.md` 另有一处写着同一体系 `sigma_R = 1301.64017 mb`（`omp.py`
   生成的 deck 与手写 deck 一致），两者差 0.19%，应来自不同设置。现场若可能被问到，
   请先确认两个数各自的计算条件。
