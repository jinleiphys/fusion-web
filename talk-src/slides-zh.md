---
theme: seriph
title: "FUSION：让 agent 把核物理程序跑对"
info: "通用 agent 会写出能跑但错的核物理输入卡。FUSION 把程序知识和一条带容差的基准写进可审查的技能。"
author: "金磊 Jin Lei"
background: none
favicon: '/assets/logo-nav.png'
transition: fade
mdc: true
fonts:
  provider: 'none'
  sans: 'Inter'
  serif: 'Newsreader, Source Serif 4, TsangerJinKai02, Source Han Serif SC, Songti SC, Georgia, serif'
  mono: 'JetBrains Mono, SF Mono, Consolas, monospace'
  local: 'Newsreader'
drawings:
  persist: false
---

<div style="text-align:center; margin: 0 auto 34px">
<div class="fusion-mark" style="font-size:3.2rem">FU <span style="letter-spacing:-0.04em"><span style="color:#2f7fb8">&#9656;</span><span style="color:#c8791a">&#9666;</span></span> SION</div>
</div>

# 让 agent 把核物理程序跑对

<div style="text-align:center; margin-top: 6px">
<p style="font-size:1.05rem">还要拿得出它没有算错的证据</p>
</div>

<div style="text-align:center; margin-top: 46px">
<span class="meta">金磊　同济大学物理科学与工程学院　jinl@tongji.edu.cn</span>
</div>

<div style="text-align:center; margin-top: 12px">
<a href="/talk/en/" class="meta lang-switch">English version</a>
</div>

<!--
中心信息：我不讲软件功能，讲怎么知道一份计算没有在沉默地出错。

开场话术：我平时讲反应理论，今天换一个入口。核物理程序大多不是自己写的。把程序跑起来不算完，还得知道结果对不对。这个判断一直靠经验，没有被写成一套能检查的东西。

时间：0:00 到 0:40。

转场：先看第一次跑一个陌生程序时，人到底在忙什么。
-->

---
layout: center
---

# 第一次跑一个陌生的核物理程序，要过四关

<div class="grid grid-cols-4 gap-5 mt-12">

<div class="kami-card">
<div class="ui-label">第一步</div>
<div style="font-size:1.05rem; margin-top:8px">找到源码</div>
<div class="fig-caption" style="margin-top:10px">作者主页、附录、邮件索取</div>
</div>

<div class="kami-card">
<div class="ui-label">第二步</div>
<div style="font-size:1.05rem; margin-top:8px">编译通过</div>
<div class="fig-caption" style="margin-top:10px">编译器版本、依赖、平台差异</div>
</div>

<div class="kami-card">
<div class="ui-label">第三步</div>
<div style="font-size:1.05rem; margin-top:8px">写对输入</div>
<div class="fig-caption" style="margin-top:10px">300 页手册，或者没有手册</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">第四步</div>
<div style="font-size:1.05rem; margin-top:8px">判断结果对不对</div>
<div class="fig-caption" style="margin-top:10px">没有人告诉你</div>
</div>

</div>

<div class="takeaway mt-12">前三步在管程序，第四步才在管物理。</div>

<!--
中心信息：前三步都有明确的失败信号，第四步没有。

讲什么：第一次跑 FRESCO 或 TALYS，找源码、编译、学输入格式都很费时间，但卡住时自己知道。结果算错却照常退出，才真的危险。

时间：0:40 到 2:00。

转场：区别不在难度，在于失败会不会自己暴露。
-->

---
layout: fact
---

# 前三步是麻烦

# <span style="color: var(--color-gap)">第四步是危险</span>

<div style="max-width: 720px; margin: 40px auto 0">
<p style="font-size:1.05rem; line-height:1.85">编译不过，你知道自己失败了。<br>输入写错到程序拒绝运行，你也知道自己失败了。<br><br><b>输入写错但程序照常运行，你不知道。</b></p>
</div>

<!--
中心信息：不报错的失败最危险。

讲什么：编译失败会停，输入格式错到不能读也会停。真正难抓的是另一种情况：程序接受输入，正常跑完，还给出一个量纲、形状和数量级都像样的结果。

时间：2:00 到 3:00。

转场：看一个组里新人很容易踩到的坑。
-->

---

# 一个会让程序照常跑完的坑：半径约定

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">FRESCO 怎么造半径</div>

```
R = r0 * (Ap^1/3 + At^1/3)
```

<div class="fig-caption" style="margin-top:12px">投射粒子和靶核都进入半径</div>
</div>

<div class="kami-card">
<div class="ui-label">KD02 和 CH89 怎么定义半径</div>

```
R = r0 * At^1/3
```

<div class="fig-caption" style="margin-top:12px">只有靶核，这是全局光学势的通行约定</div>
</div>

</div>

<div class="box-idea mt-8">

只改一处：在 `type=0` 那一行写 `ap=0`。中子入射也不能省，因为这行声明的就是半径约定。

</div>

<div class="takeaway mt-8">物理没变，错在两套半径记号没有接上。</div>

<!--
中心信息：两边各自都写对了，接在一起却会错。

讲什么：Koning 和 Delaroche 给出了自己的半径定义，FRESCO 手册也写了程序怎样造半径。两条规则都公开，但原来的文档没有把接缝放在同一处。真正缺的就是 `ap=0` 这一句。

时间：3:00 到 4:30。

转场：漏掉这一句，程序会怎样。
-->

---

# 漏掉 `ap=0`，程序照样成功

<div class="grid grid-cols-3 gap-6 mt-10">

<div v-click class="kami-card">
<div class="ui-label">半径</div>
<div style="font-size:2.4rem; font-weight:500; color: var(--color-gap); margin-top:8px">+22%</div>
<div class="fig-caption" style="margin-top:10px">核子入射时，每一个半径都偏大约 22%</div>
</div>

<div v-click class="kami-card">
<div class="ui-label">程序</div>
<div style="font-size:2.4rem; font-weight:500; margin-top:8px">正常退出</div>
<div class="fig-caption" style="margin-top:10px">没有警告，没有非零返回码</div>
</div>

<div v-click class="kami-card">
<div class="ui-label">截面</div>
<div style="font-size:2.4rem; font-weight:500; margin-top:8px">看上去合理</div>
<div class="fig-caption" style="margin-top:10px">量纲对，角分布形状对，数量级对</div>
</div>

</div>

<div v-click class="box-gap mt-10">

这个程序里至少还有两种沉默错误：把面项 `W_d` 写进 `type=2` 的 `p1` 而不是 `p4`，它会变成实的面势阱，吸收随之下降；漏掉整行 `type=0`，半径约定就没有声明。

</div>

<!--
中心信息：半径偏大约 22%，程序给出的信号却全是"成功"。

讲什么：这里停一下。半径偏大约 22%，不是一眼就能抓住的数量级错误，也绝不是可以忽略的小数尾差。程序仍会给出一条看起来顺眼的角分布。

时间：4:30 到 6:00。

转场：再看通用 agent 会怎么处理。
-->

---

# 通用 agent 会在这里给出一个假成功

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="box-gap">

让它写一份 FRESCO 输入卡，它会交出一个**看起来完全正确**的文件。deck 能跑，截面错 20%，全程没有警告。

</div>

<div class="fig-caption" style="margin-top:20px; line-height:1.8">
它知道 Koning-Delaroche 公式，也知道 FRESCO 的 namelist。缺的是两套规则接在一起时要补的那一句。
</div>

</div>

<div v-click>

<div class="kami-card-accent">
<div class="ui-label">为什么这种错误更难发现</div>
<div style="margin-top:12px; line-height:1.9; font-size:0.95rem">
学生犯错，组会上被问到就会留下记录。<br><br>
agent 的语气不会随答案对错而变。如果规则没有写进可复用的文档，下一次还得从头猜。
</div>
</div>

</div>

</div>

<!--
中心信息：通用 agent 会把沉默错误包装成一次正常完成的任务。

讲什么：不要点名，也不要嘲讽模型。公式推导不缺。缺的是两套约定相接时那条小规则，原来的文档没有把它交付出来。

时间：6:00 到 7:30。

转场：问题只剩一个，这类知识放在哪里。
-->

---
layout: fact
---

# 修法不在模型大小

<div style="max-width: 780px; margin: 36px auto 0">

<div class="box-idea">

把程序知识写成文档，再放进**一条带容差的基准**。别人能读，能审，也能直接改。

</div>

<p style="margin-top: 28px; font-size:1rem; line-height:1.85; color: var(--olive)">文档要写清程序的记号、沉默错误和一个已知答案。这样才能检查眼前这次构建有没有把它复现出来。</p>

</div>

<!--
中心信息：全场的主句。

讲什么：慢一点说。重点是"带容差的基准"。只把经验写成提示还不够；没有已知答案，仍然只能选择相信它。

时间：7:30 到 8:30。

转场：FUSION 按这句话来做。
-->

---
layout: section
---

# 二、FUSION 怎么做

<!--
时间：8:30。快速过。
-->

---

# 每个程序配一份专家技能

<div class="grid grid-cols-3 gap-5 mt-10">

<div class="kami-card">
<div class="ui-label">01 装</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">从作者自己的上游源码构建，不是从缓存里拷一份</div>
</div>

<div class="kami-card">
<div class="ui-label">02 写</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">按这个程序的记号约定生成输入，包括所有接缝</div>
</div>

<div class="kami-card">
<div class="ui-label">03 跑</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">带上正确的工作目录和运行时前提</div>
</div>

<div class="kami-card">
<div class="ui-label">04 读</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">解析输出格式，取出真正要的那一列</div>
</div>

<div class="kami-card">
<div class="ui-label">05 查</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">检查这个程序已知的沉默失败模式</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">06 验</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">对着一个已知答案检查，容差写在文档里</div>
</div>

</div>

<div class="takeaway mt-10">前五步让程序能用，第六步给结果找证据。</div>

<!--
中心信息：技能从安装一直写到验证，终点是一个别人能复核的数字。

讲什么：前五步解决能不能用，第六步回答凭什么信。容差必须直接写在文档里，不能只说"测试通过"。

时间：8:40 到 10:00。

转场：不抽象讲，直接看原文。
-->

---

# 技能就是文档，不是模型

<div class="ui-label">skills/fresco/SKILL.md，原文</div>

<div class="kami-card" style="margin-top:14px">
<div style="font-size:0.88rem; line-height:1.85; color: var(--charcoal)">
<b>为什么要用这个脚本，而不是自己敲参数。</b>公式不是难点，难点是接进 FRESCO 的那一步。有三件事会静默出错，也就是说 deck 照样能跑，并打印出一个看似合理但错误的截面：
<br><br>
<b>· 半径约定。</b>FRESCO 造半径用 <code>R = r0*(Ap^1/3 + At^1/3)</code>，而 KD02 和 CH89 都定义在 <code>R = r0*At^1/3</code> 上。修正是 <code>type=0</code> 那行里的 <code>ap=0</code>，脚本总是会写出这一行。核子入射时弄错，每个半径都会大约 22% 偏大。
<br><br>
<b>· 面项是虚的。</b><code>W_d</code> 进 <code>type=2</code> 行的 <code>p4</code>，不是 <code>p1</code>。写进 <code>p1</code> 它就变成一个实的面势阱，吸收会悄悄下降。
</div>
</div>

<div class="grid grid-cols-3 gap-5 mt-8">
<div v-click class="fig-caption">只有 Markdown 和 shell，没有权重或二进制</div>
<div v-click class="fig-caption">谁都能审，发现错误可以直接提 pull request</div>
<div v-click class="fig-caption">也可以打印出来，直接给新学生用</div>
</div>

<!--
中心信息：技能是普通文档，不是黑盒。

讲什么：把这段原文读给听众看。它不需要相信某个模型，新学生不用 agent 也能照着读。

时间：10:00 到 11:30。

转场：现在有多少份这样的技能。
-->

---

# 现在覆盖哪些程序

<div class="mt-6" style="font-size:0.93rem">

| 领域 | 程序 |
|---|---|
| 反应、光学模型 | FRESCO（含 SFRESCO 拟合）、COLOSS、CCFULL、pikoe、NLAT、CNOK、SIDES、SWANLOP |
| 结构、从头算 | GSM、KSHELL、NuclearToolkit.jl、Sky3D |
| 裂变、统计模型 | CGMF、TALYS |
| 核天体、R 矩阵 | AZURE2、SkyNet |
| 重离子输运、状态方程 | SMASH、GiBUU、Thermal-FIST、vHLLE |

</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="box-idea">

具体程序有 **20** 份技能。另有 **6** 份：SFRESCO 拟合、EXFOR 实验数据检索、离线语料检索、两份个人研究 wiki 维护和一份初始化。合计 **26**。

</div>

<div class="fig-caption" style="line-height:1.8">
收录门槛只有三条：公开可获取、能从源码在目标平台构建、有已发表论文。<br><br>不能明确写出基准等级，就不发布。
</div>

</div>

<!--
中心信息：程序按物理问题来列，收录有明确门槛。

讲什么：不要念表格。按听众方向挑两个程序即可，例如反应里的 FRESCO 和 COLOSS，重离子里的 SMASH 和 vHLLE。

口径提醒：全场统一，20 是程序技能，26 是全部技能，不要混。

时间：11:30 到 12:30。

转场：再回答一个直接的问题，它是不是绑死在某个 agent 上。
-->

---

# Agent 可以换，模型也可以换

<div class="grid grid-cols-2 gap-8 mt-8">

<div>

<div class="ui-label">三个 agent 入口</div>

<div class="mt-4" style="font-size:0.92rem">

| Agent | 入口 | 状态 |
|---|---|---|
| opencode | `SKILL.md` | 已验证，零配置 |
| Claude Code | `SKILL.md` | 已验证 |
| Codex | `AGENTS.md` | 仅格式，未端到端测试 |

</div>

<div class="fig-caption" style="margin-top:16px">同一目录保留 `SKILL.md` 和 `AGENTS.md` 两个入口。</div>

</div>

<div>

<div class="box-idea">

底座是 opencode，可以接不同供应商的模型，技能内容不用跟着改。

</div>

<div class="kami-card" style="margin-top:22px">
<div class="ui-label">Phase 0 验收</div>
<div style="margin-top:10px; font-size:0.95rem; line-height:1.8">
Phase 0 用 deepseek-chat 独立写出 n+<sup>90</sup>Zr 弹性散射的 FRESCO 输入卡，结果与参考计算一致到 <b>4 到 5 位有效数字</b>。
</div>
</div>

</div>

</div>

<!--
中心信息：技能不依赖某一家模型，Phase 0 用 deepseek-chat 验收。

讲什么：直接说验收事实。程序知识写在模型外，换模型时不用重写技能。

时间：12:30 到 13:30。

转场：现在跑一次。
-->

---
layout: section
---

# 三、现场演示

<div style="max-width: 640px; margin: 30px auto 0; text-align:left">

<div class="kami-card-accent">
<div class="ui-label">交给它的原话</div>
<div style="margin-top:12px; font-size:1.02rem; line-height:1.8">
算 50 MeV 的 n+<sup>90</sup>Zr 弹性散射，用 KD02 全局光学势，然后跟 EXFOR 上有的实验数据比一下。
</div>
</div>

</div>

<!--
中心信息：一句自然语言，后面是找参数、写输入、编译、运行、解析、找数据和作图。

讲什么：把原话念完，停两秒再切屏。这句话没有文件名、路径或参数。

演示注意：屏幕切过去之前先确认终端字号足够大。如果 30 秒内没有实质进展，直接切录屏，不要解释，不要道歉。

时间：13:30 到 24:00，共 10 分半。演示后面紧跟着产出图那一页。

转场：演示结束后回到这里，直接看它最后交了什么。
-->

---
layout: center
---

<div style="text-align:center">
<div class="ui-label">现场演示</div>
<h1 style="margin-top:20px">切换到终端</h1>
<p style="margin-top:24px; color: var(--olive)">备份录屏：<code>demo-n90zr.mp4</code></p>
</div>

<!--
这一页只是占位，正常情况下不会停留。

如果演示失败：切到录屏，只说"网络不太配合，我放剪好的版本"，然后继续。不要现场调试。

演示要覆盖的四个节点，讲的时候点出来：
1. 它自己去找 KD02 参数，用的是本地那份 Koning 原始 kd02.f，不是凭记忆重写公式
2. 它写出 ap=0
3. 它做了步长和分波数的收敛检查
4. 它去查 EXFOR，然后告诉你 50 MeV 没有数据
-->

---

# 演示最后交出来的图

<div class="fig-caption" style="text-align:left; margin-bottom:10px">绿线是 KD02 全局光学势的零自由参数预测，粉点是 EXFOR 实测。两个面板各自按它的实验能量重新算过。</div>

<img src="./figures/case-kd02-exfor.png" class="kami-img" style="width:100%; max-height:262px; object-fit:contain" />

<div class="grid grid-cols-3 gap-5 mt-4">

<div class="kami-card" style="padding:14px 18px">
<div class="ui-label nocaps">左 · 24 MeV</div>
<div style="margin-top:6px; font-size:0.87rem">富集 <sup>90</sup>Zr，全角度。中位比 <b>0.89</b></div>
</div>

<div class="kami-card" style="padding:14px 18px">
<div class="ui-label nocaps">右 · 55 MeV</div>
<div style="margin-top:6px; font-size:0.87rem">天然 Zr，只有前角。χ²/N = <b>0.75</b></div>
</div>

<div class="kami-card kami-card-accent" style="padding:14px 18px">
<div class="ui-label nocaps">中间 · 50 MeV</div>
<div style="margin-top:6px; font-size:0.87rem"><b>没有这一格，那个能量没有测量</b></div>
</div>

</div>

<!--
中心信息：演示交出的不只是一条曲线，还有一句"这里没有数据"。

讲什么：先讲图，两个能量都是零自由参数计算。再看第三张卡：任务给的是 50 MeV，EXFOR 没有这个能量的数据，所以它在两个有数据的能量重算，并把空缺写出来。

"没有数据"不是失败，也不能拿最近的能量冒充。这里多停十秒。

时间：24:00 到 25:30，接在演示后面。

转场：接下来的问题是，这条绿线凭什么可信。
-->

---
layout: section
---

# 四、这些结果凭什么信

<!--
时间：25:30。

这一部分讲证据。时间不够就压缩第五部分，不要压这里。
-->

---

# 两级证据，写在每份程序技能里

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">Tier 1　14 份</div>
<div style="margin-top:12px; font-size:0.97rem; line-height:1.85">
程序发行版带有参考值或测试套件，技能把它们复现出来。<br><br>
其中几份做到<b>逐位相同</b>，不只是在误差范围内一致。
</div>
</div>

<div class="kami-card">
<div class="ui-label">Tier 2　6 份</div>
<div style="margin-top:12px; font-size:0.97rem; line-height:1.85">
程序没有参考输出，就换一条证据：跨平台复现、物理恒等式或独立解析解。<br><br>
没有参考输出，也必须把替代检查写清楚。
</div>
</div>

</div>

<div class="box-idea mt-10">

分级是公开的。每份程序技能在 `SKILL.md` 或 `references/verification.md` 里写清等级、证据、容差和已知失败模式。

</div>

<!--
中心信息：证据分级公开，能逐条查，不靠一句"测试过了"。

讲什么：很多程序不带参考输出。Tier 2 不降低标准，只换验证办法。下一页看两个例子。

时间：25:30 到 27:00。

转场：看两个实际基准。
-->

---

# 两个基准长什么样

<div class="grid grid-cols-2 gap-8 mt-6">

<div>

<div class="ui-label" style="color: var(--color-evidence)">Tier 1 · CNOK</div>

<div class="kami-card" style="margin-top:12px">
<div style="font-size:0.93rem; line-height:1.8">
<sup>16</sup>C 剥去一个中子，239 MeV/u 打 <sup>12</sup>C。剥离与衍射解离截面：
<br><br>
<code style="font-size:0.85rem">60.086689 / 18.056073 / 78.142761 mb</code>
<br><br>
在<b>四种不同构建</b>下逐位相同：macOS/clang 打补丁的 -O2 与 -O0，Linux/gcc 未打补丁与打补丁。剥离道与论文里的 60.087 mb 精确吻合。
</div>
</div>

<div class="fig-caption" style="margin-top:14px">未打补丁的 gcc 与打补丁的 clang 逐位相同，说明补丁改的是可移植性，不是物理结果。</div>

</div>

<div>

<div class="ui-label" style="color: var(--color-evidence)">Tier 2 · vHLLE 与 AZURE2</div>

<div class="kami-card" style="margin-top:12px">
<div style="font-size:0.93rem; line-height:1.8">
vHLLE 不带参考输出，于是拿<b>闭式 Gubser 流</b>去对，而不是拿它自己的输出去对。
<br><br>
AZURE2 用论文表格里的 9 个参数直接重建 <sup>16</sup>O(p,γ)<sup>17</sup>F，<b>不做任何拟合</b>：S(90 keV) 偏差 −5.7%，对实测数据 χ²/N = 1.53。
</div>
</div>

<div class="fig-caption" style="margin-top:14px">−5.7% 原样写在文档里，没有被拟合吸收掉。</div>

</div>

</div>

<!--
中心信息：一个例子逐位相同，另一个把残差原样公开。

讲什么：CNOK 为 macOS 加了两个补丁。验证办法很直接：未打补丁的 gcc 构建和打补丁的 clang 构建给出逐位相同的结果。

AZURE2 的 −5.7% 要主动说，不要只报 χ²/N。

时间：27:00 到 29:00。

转场：还可以换一个求解器来查。
-->

---

# 再换一个求解器

<div class="grid gap-8 mt-8" style="grid-template-columns: 3fr 2fr;">

<div>

<div class="ui-label nocaps">n+<sup>90</sup>Zr 弹性散射，50 MeV，KD02</div>

<div class="mt-4" style="font-size:0.93rem">

| 检查 | 结果 |
|---|---|
| 积分步长连续减半两次 | 稳定到 **9 位有效数字** |
| 匹配半径与分波数加倍 | 结果不变 |
| COLOSS（复标度 Lagrange-Laguerre） | 1299.188 mb |
| FRESCO（Numerov 耦合道） | 1299.191 mb |
| 两者一致 | **6 位有效数字** |
| 令 W = 0 | 吸收精确归零，通量守恒 |

</div>

</div>

<div>

<div class="box-evidence">

两个求解器走的是**不同数值路线**：一个用复标度 Lagrange-Laguerre 基展开，一个在实轴上做 Numerov 积分。它们不共享代码和离散化。

</div>

<div class="fig-caption" style="margin-top:18px; line-height:1.8">
一致到 6 位，检查了单个程序的收敛测试看不到的实现错误。
</div>

</div>

</div>

<!--
中心信息：收敛检查只看一个实现，交叉计算还能查实现本身。

讲什么：步长和截断检查只能查离散化。换一个数值路线不同的求解器，可以再查一层实现错误。令 W = 0 后吸收归零，是另一条物理恒等式检查。

时间：29:00 到 30:30。

转场：下一页看容差怎么定出来。
-->

---

# 容差是怎么定出来的

<div class="box-gap mt-6">

把 KD02 参数化对着 Koning 自己的 `kd02.f` 逐值核对，39 个钉住的值里，CH89 精确到机器精度，**KD02 只到大约 7 位就停住了**。

</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div v-click>

<div class="ui-label">差别来自哪里</div>

<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
那份 <code>kd02.f</code> 凡是 Fortran 允许的地方都是单精度。变量声明是 <code>real*8</code>，但这并不让运算变成双精度：
<br><br>
字面量被截断，<code>59.30</code> 进去变成 <code>59.2999992370605</code>；<code>1./3.</code> 是一次单精度除法；<code>real(N-Z)</code> 没带 kind，掉回 <code>real(4)</code>。
</div>

</div>

<div v-click>

<div class="box-evidence">

把参考的 `kd02.f` 用 `-fdefault-real-8` 重新编译，两边吻合到 **16 位**。

</div>

<div style="margin-top:14px; font-size:0.9rem; line-height:1.8">
结果很明确：<b>技能里的实现更准，残差来自那份 Fortran</b>。
<br><br>
物理上用到的三四位不受影响。来源查清以后，任何超过 2×10⁻⁷ 的偏差都是真 bug。
</div>

</div>

</div>

<!--
中心信息：容差不是拍脑袋定的，它来自参考程序的实际精度。

讲什么：先讲 7 位为什么停住，再讲 `-fdefault-real-8` 后的 16 位。最后落到 2e-7：来源查清，容差才有依据。

这一页可以多停 15 秒。

时间：30:30 到 32:00。

转场：程序能自检，验证脚本也得有人专门找错。
-->

---

# 发布前，换一个 AI 专门找假阳性

<div class="fig-caption mt-4">每份程序技能发布前都做一次对抗审查。下面三条都是真抓到的错误。</div>

<div class="grid grid-cols-3 gap-5 mt-8">

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">TALYS</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
<code>run_talys.sh</code> 会跑一份<b>旧的输入卡然后报告成功</b>。源目录为空加上遗留的工作目录，拷贝因为 <code>|| true</code> 静默失败，TALYS 跑了上一次的 <code>talys.inp</code>，退出码 0。
</div>
<div class="fig-caption" style="margin-top:12px">技能本来要防这种假阳性，自己的脚本里却先出现了一次。</div>
</div>

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">GiBUU</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
一个自检标记在 <code>case</code> 语句里用了正则的或（<code>non-numeric\|not finite</code>），而 <code>case</code> 匹配的是通配符不是正则。
<br><br>
<b>它永远不可能触发。</b>
</div>
<div class="fig-caption" style="margin-top:12px">一个永远不会失败的检查，等于没有检查。</div>
</div>

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">SMASH</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
身份校验和 ctest 自检块在<b>伪造自己的输入</b>：用真实构建戳记的 <code>head -1</code> 合成一个戳记，而 Linux 构建早于该戳记，文件根本不存在，合成结果塌缩成一行。
</div>
<div class="fig-caption" style="margin-top:12px">八个用例是对着一个被自己发明出来的输入失败的。移到 Linux 上才暴露。</div>
</div>

</div>

<!--
中心信息：验证脚本也会制造假成功，所以它也要被验证。

讲什么：三条都讲清。TALYS 跑旧输入，GiBUU 的检查永远不会触发，SMASH 的测试输入是自己合成错的。它们说明检查脚本不能默认可信。

如果有人问"那审查者本身怎么保证"，诚实回答：保证不了，所以还有跨平台和物理恒等式两层，任何单层都不足够。

时间：32:00 到 34:00。

转场：把同一套检查搬到另一个平台，又发现了一个问题。
-->

---

# 跨平台跑一遍，才知道该钉哪个量

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="ui-label">SMASH，Au+Au 输运</div>

<div class="box-gap" style="margin-top:12px">

源码、输入、随机种子完全相同，部分粒子多重性在 macOS 与 Linux 之间最多相差 **25%**。

</div>

<div class="box-evidence" style="margin-top:18px">

而重子数 **B = 788** 与电荷 **Q = 316** 在两个平台上都是精确的整数，一动不动。

</div>

</div>

<div v-click>

<div class="kami-card-accent">
<div class="ui-label">验证器改查守恒律</div>
<div style="margin-top:12px; font-size:0.95rem; line-height:1.85">
不再把依赖平台的多重性当标准答案，改查守恒律。<br><br>
同一次检查还发现，旧规则会把轻核的 PDG 编码判成重子数 0。
</div>
</div>

<div class="fig-caption" style="margin-top:18px">Linux 上 104 项测试全部通过。</div>

</div>

</div>

<div class="takeaway mt-8">只跑一个平台，这组多重性就会被误写成标准答案。</div>

<!--
中心信息：跨平台检查决定哪些量能当基准。

讲什么：多重性随平台变，不能当基准；B 和 Q 在两边都是精确整数，可以当基准。这个判断必须跑过两个平台才有。

时间：34:00 到 35:30。

转场：这里把边界说清楚。
-->

---
layout: fact
---

# 基准证明的是这次构建复现了一个已知结果

# <span style="color: var(--color-gap)">它不证明你的计算是对的</span>

<div style="max-width: 720px; margin: 40px auto 0">
<p style="font-size:1.05rem; line-height:1.85">选哪个光学势，怎么切断连续态，能量范围合不合适，这些还是你的事。<br><br><b>物理仍然是你的。</b></p>
</div>

<!--
中心信息：基准管工具层，物理判断仍由使用者负责。

讲什么：直接讲边界。基准能查构建和已知错误，不能替人选择光学势、连续态截断或能量范围。

时间：35:30 到 36:30。

转场：程序讲完，再看离线文献层。
-->

---
layout: section
---

# 五、离线的文献层

<!--
时间：36:30。这一部分如果超时可以压缩，但地图那页值得留。
-->

---

# 61,167 页都在本地，grep 就能读

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="kami-card">
<div class="ui-label">语料</div>
<div style="margin-top:12px; font-size:0.95rem; line-height:1.85">
61,059 篇 arXiv nucl-th 论文，一篇一页，加 108 个主题页，再加引用层和语义关系层。
<br><br>
本地直接读，不用服务器或 API key，检索时不联网。
</div>
</div>

<div class="box-gap" style="margin-top:18px">

这些页面是机器生成的摘要，**会错**。写论文要引原文，不能引这里的页面。

</div>

</div>

<div>

<div class="ui-label">一个实际任务：只给一篇 PDF</div>

<div style="margin-top:12px; font-size:0.92rem; line-height:1.8">
输入是 Abu-Ibrahim 等，<i>PRC</i> <b>77</b>, 034607，碳同位素在质子靶上的反应截面。全程离线，零外部调用。
<br><br>
语料先把它定位到 <code>0710.4193</code>，引用网络给出它引的 <b>8 篇</b>和引它的 <b>5 篇</b>，其中包括同组前作和 <sup>22</sup>C 双中子晕的工作。现成摘要里带着可以直接核对的数字：p+<sup>12</sup>C 在 40 MeV 的 σ<sub>R</sub> = 432 mb。
</div>

<div class="box-gap" style="margin-top:16px">

<b>限制：</b>引用边只在这批语料内统计。RIKEN 的实验论文不属于 nucl-th，所以"被引 5 次"低估了真实引用量。

</div>

</div>

</div>

<!--
中心信息：离线语料能给出可核对的线索，也有明确边界。

讲什么：能力和限制放在一起讲。摘要会错，引用边也只覆盖这批语料。

时间：36:30 到 38:30。

转场：把这批语料画出来看。
-->

---
layout: center
---

<div style="text-align:center">
<img src="./figures/corpus-map.png" class="kami-img" style="max-height: 400px; margin: 0 auto" />
<div class="fig-caption" style="margin-top:14px">55,850 篇论文的引用投影。地形是论文密度场，一个点是一篇论文，面积正比于语料内被引次数，地名取自 PhySH 主题。</div>
</div>

<!--
中心信息：引用关系把语料分成了可以辨认的区域。

讲什么：先让听众看 5 秒再说话。然后指出几个他们认识的区域，比如做反应的那一片在哪里，格点 QCD 在哪里。

时间：38:30 到 39:30。

转场：下一页只解释一件事，为什么不画边。
-->

---

# 一条引用边都没有画

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="box-idea">

引用关系只负责**决定布局**，最后看到的是密度地图。

</div>

<div style="margin-top:18px; font-size:0.93rem; line-height:1.85">
这样画不是为了好看。这个量级的引用网络一旦画成力导向节点连线图，就会变成毛球，继续调参数也解决不了。
</div>

<div class="fig-caption" style="margin-top:16px; line-height:1.8">
同类工具也在避开全图连线：Connected Papers 只画种子论文的 ego 图，Open Knowledge Maps 每图上限 100 篇，VOSviewer 在 10 万篇规模下只渲染 100 个节点。Paperscape 绘制全语料时同样不画边。
</div>

</div>

<div>

<div class="kami-card">
<div class="ui-label">身份由地名承担，不由颜色承担</div>
<div style="margin-top:12px; font-size:0.92rem; line-height:1.8">
底色的 5 个大区是主题质心聚类自动划分的，只作辅助。5 是能通过全配对可达性检查的上限。
<br><br>
地名让这张图在黑白印刷和色觉缺陷下仍然可读。
</div>
</div>

<div class="kami-card" style="margin-top:18px">
<div class="ui-label">只有真正聚集的主题才拿地名</div>
<div style="margin-top:12px; font-size:0.92rem; line-height:1.8">
<code>quantum-chromodynamics</code> 有 7,327 篇，横跨全图，所以不标注。它是通用语言，不是地点。
<br><br>
资格由离散度比值判定，阈值 0.78，不是人工挑选。
</div>
</div>

</div>

</div>

<!--
中心信息：这一页解释为什么不画边，以及地名怎样选。

讲什么：先讲毛球，再讲 QCD。一个横跨全图的主题不是地点，所以不该拿地名。

时间：39:30 到 41:00。

转场：最后讲清楚它现在还不行的地方。
-->

---

# 现在还没有做好的地方

<div class="grid grid-cols-2 gap-6 mt-8">

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">冷启动安装测得最少</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
二十个程序里，只有 FRESCO 真正从空缓存完整安装过。换一台机器，其他程序很可能缺依赖。
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">校园网实测：前两步失败</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
2026-08-13 在校园网实测：github.com 六次连接全部失败，clone 在 132 秒后退出。当前需要代理，镜像还没解决。
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">磁盘与平台</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
TALYS 约占 11 GB，其中 8.6 GB 是结构数据库，不要先试它。Windows 还没有构建，macOS 和 Linux 二进制都未签名。
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">目前只有作者实际用过</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
v0.1.0 是第一个公开版本。作者每天在用，还没有外部用户完成测试。
</div>
</div>

</div>

<div class="takeaway mt-12">下一步要补的，就是它在别人机器上会坏在哪里。</div>

<!--
中心信息：把已知问题一次说清。

讲什么：可以讲快一点，但四条都保留。网络问题放在第二条，因为第一次安装先会碰到它。

时间：41:00 到 42:30。

转场：接着说我最想收到什么反馈。
-->

---

# 我最想收到的反馈

<div class="box-gap mt-10" style="max-width: 800px">

**一个看起来对、但其实错的结果。**

</div>

<div style="max-width: 800px; margin-top: 22px; font-size:1rem; line-height:1.9">
通用 agent 会写出半径约定错误、却能正常运行的 FRESCO 输入卡。如果 FUSION 也给出这种结果，请把输入卡、算出的数字和正确值发给我。
</div>

<div class="fig-caption" style="margin-top:20px; line-height:1.8">
我最怕这种失败，也最难等到报告，因为它看上去就是成功。
</div>

<div class="grid grid-cols-3 gap-5 mt-10">
<div class="kami-card">
<div class="ui-label">安装失败</div>
<div style="margin-top:8px; font-size:0.92rem">装不上的程序，带上报错、系统和编译器版本</div>
</div>
<div class="kami-card">
<div class="ui-label">使用别扭</div>
<div style="margin-top:8px; font-size:0.92rem">任何让你觉得别扭的地方</div>
</div>
<div class="kami-card">
<div class="ui-label">缺少程序</div>
<div style="margin-top:8px; font-size:0.92rem">你希望哪个程序也有一份技能</div>
</div>
</div>

<!--
中心信息：直接告诉听众，什么反馈最有用。

讲什么："任何让你觉得别扭的地方"也要报。第一次运行流程里的问题，往往只有第一次用的人看得见。

时间：42:30 到 43:30。

转场：回到开头。
-->

---
layout: center
---

<div style="text-align:center">
<div class="fusion-mark" style="font-size:2.4rem; margin-bottom:34px">FU <span style="letter-spacing:-0.04em"><span style="color:#2f7fb8">&#9656;</span><span style="color:#c8791a">&#9666;</span></span> SION</div>

<div style="max-width: 760px; margin: 0 auto">

<div class="box-idea">

跑一个核物理程序，难的不是启动，是知道结果对不对。

</div>

<p style="margin-top: 30px; font-size:1rem; line-height:1.9">过去靠组内口传。<br>现在可以写进文档，让别人检查，也让后来的人接着改。</p>

</div>

<div style="margin-top: 40px">
<span class="meta">github.com/jinleiphys/FUSION　·　vibeinscience.com　·　MIT　·　jinl@tongji.edu.cn</span>
</div>

</div>

<!--
中心信息：一句话收住，不再讲工具细节。

讲什么：不要再报技能数量或语料规模。只讲一件事：口传经验会丢，文档可以检查，也可以继续改。

如果还有时间，加一句：只有我自己能检查的东西，不能叫验证。

时间：43:30 到 45:00，然后进入提问。
-->

---
layout: section
---

# 备用材料

---

# n+<sup>90</sup>Zr 做过哪些检查

<div class="mt-4" style="font-size:0.83rem">

| 检查 | 它回答的问题 | 结果 |
|---|---|---|
| `omp.py` 生成的 deck 对手写 deck | 生成器有没有写错 | σ<sub>R</sub> = 1301.64017 mb，完全一致 |
| 积分步长连续减半两次 | 离散化收敛了吗 | 稳定到 9 位有效数字 |
| 匹配半径与分波数加倍 | 截断够不够远 | 结果不变 |
| COLOSS 对 FRESCO | 两个独立实现一致吗 | 1299.188 vs 1299.191 mb，6 位 |
| 令 W = 0 | 通量守恒吗 | 吸收精确归零 |
| 对 EXFOR | 跟实验差多少 | 24 MeV 中位比 0.89；55 MeV χ²/N = 0.75 |
| 对 39 个钉住的参数值 | 势参数本身对不对 | KD02 到 7 位，CH89 到机器精度 |

</div>

<div class="box-idea mt-4" style="font-size:0.9rem">

**1301.640 和 1299.19 不能直接相比**。它们来自配置不同的两次运行：前者检查完整 KD02 的端到端流程，后者检查两个求解器在同一配置下是否一致。每一行回答各自的问题。

</div>

<!--
这一页回答项目网站上的 1301.640 mb 和正文里的 1299.19 为什么同时存在。

答法：这是两次检查，不是同一个数的两个版本。生成器对手写 deck 检查 `omp.py`，COLOSS 对 FRESCO 检查两个实现。两次配置不同，数值不能直接比。

如果继续追问差别来自哪里：这次运行没有留下完整配置记录，差别来源没有核实。不要猜。
-->

---

# 26 份技能的完整清单

<div class="grid grid-cols-2 gap-8 mt-6" style="font-size:0.88rem">

<div>

<div class="ui-label">驱动具体程序（20）</div>

| 领域 | 程序 |
|---|---|
| 反应、光学模型 | FRESCO、COLOSS、CCFULL、pikoe、NLAT、CNOK、SIDES、SWANLOP |
| 结构、从头算 | GSM、KSHELL、NuclearToolkit.jl、Sky3D |
| 裂变、统计 | CGMF、TALYS |
| 核天体、R 矩阵 | AZURE2、SkyNet |
| 重离子、状态方程 | SMASH、GiBUU、Thermal-FIST、vHLLE |

</div>

<div>

<div class="ui-label">其余（6）</div>

<div style="margin-top:10px; line-height:2">
· SFRESCO，卡方拟合与 MINUIT 搜索<br>
· exfor-data，EXFOR 实验数据检索与解析<br>
· kb-search，离线语料检索<br>
· literature-wiki，个人文献库维护<br>
· research-profile，个人研究档案维护<br>
· fusion-setup，首次运行的初始化
</div>

<div class="box-idea" style="margin-top:20px">

收录门槛：公开可获取、能从源码在目标平台构建、有已发表论文。三条缺一不可。

</div>

</div>

</div>

---

# 安装时会碰到的网络问题

<div class="mt-8" style="font-size:0.93rem">

```bash
# 1. FUSION 本体
git clone https://github.com/jinleiphys/FUSION.git && cd FUSION

# 2. CLI，解压进这个 clone
curl -fsSL https://github.com/jinleiphys/FUSION/releases/latest/download/fusion-darwin-arm64.tar.gz | tar -xz
xattr -d com.apple.quarantine fusion          # 仅 macOS

# 3. 开始工作
./fusion
```

</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="box-gap">

上面两条命令都要访问 GitHub，在国内校园网上通常会失败。首次安装各程序时还要访问各自上游；语料已经在 clone 里，检索不需要联网。

</div>

<div class="fig-caption" style="line-height:1.8">
clone 约 229 MB，几乎全是语料。只用技能、不用语料时，可以跳过 clone，直接把 agent 指向 skills 目录的 URL。<br><br>
依赖是 git、make、gfortran、C++ 编译器和 python3。额外依赖由各技能在安装前说明。
</div>

</div>

---

# 语料地图怎样计算

<div class="grid grid-cols-2 gap-8 mt-8">

<div>

<div class="ui-label">第一步：布局</div>

<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
引用邻接矩阵 → 截断 SVD 降到 32 维 → t-SNE 投到二维。
<br><br>
最小度数 2，perplexity 200，行归一化，不使用共现关联。61k 个节点约 90 秒。
</div>

</div>

<div>

<div class="ui-label">第二步：渲染</div>

<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
密度场做分箱加高斯模糊得到地形；点面积正比于语料内被引次数；地名从 PhySH 主题里按离散度比值 ≤ 0.78 筛出来。
<br><br>
纯 Python 标准库，本地可跑。
</div>

</div>

</div>

<div class="box-idea mt-10">

两步都在 fusion-web 仓库里：`scripts/kb_citemap.py` 和 `scripts/kb_citemap_render.py`。

</div>

---

# 如果有人问：它和通用 AI 编程助手有什么区别

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">这次测试里的通用助手</div>
<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
· 只交了一份输入卡，没有另附程序规则<br>
· 没有给出已知答案和容差，输入卡无从复核<br>
· 纠正若不写回共享文档，下一次还要重讲<br>
· 语气不能用来判断结果是否正确
</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">技能</div>
<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
· 知识是仓库里的 Markdown，可以直接审阅和修改<br>
· 每份程序技能带一个已知答案和明确容差<br>
· 发现一次错误，就把它写进共享文档<br>
· 基准等级和已知失败模式直接写明
</div>
</div>

</div>

<div class="takeaway mt-10">区别不在模型，在知识放在哪里，结果用什么来检查。</div>
