---
theme: seriph
title: "FUSION: getting an agent to run nuclear-physics codes correctly"
info: "A general agent writes a plausible FRESCO deck with the wrong radius convention. FUSION puts code knowledge and a benchmark with a stated tolerance into an auditable skill."
author: "Jin Lei"
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

# Getting an agent to run nuclear-physics codes correctly

<div style="text-align:center; margin-top: 6px">
<p style="font-size:1.05rem">with evidence that the result survived a check</p>
</div>

<div style="text-align:center; margin-top: 46px">
<span class="meta">Jin Lei　Department of Physics, Tongji University　jinl@tongji.edu.cn</span>
</div>

<div style="text-align:center; margin-top: 12px">
<a href="/talk/zh/" class="meta lang-switch">中文版</a>
</div>

<!--
Central message: I am not presenting software features. I am asking how to know that a calculation did not fail silently.

Opening: I usually speak about reaction theory. Today I am taking a different route. Most nuclear-physics codes were written by someone else. Getting one to run is not enough; I still need to know whether its result is right. Until now, that judgement has stayed in people's heads rather than in a checkable procedure.

Timing: 0:00 to 0:40.

Transition: start with what happens when someone runs an unfamiliar code for the first time.
-->

---
layout: center
---

# A first run of an unfamiliar nuclear-physics code has four stages

<div class="grid grid-cols-4 gap-5 mt-12">

<div class="kami-card">
<div class="ui-label">Step 1</div>
<div style="font-size:1.05rem; margin-top:8px">Find the source</div>
<div class="fig-caption" style="margin-top:10px">Author's page, an appendix, or an email request</div>
</div>

<div class="kami-card">
<div class="ui-label">Step 2</div>
<div style="font-size:1.05rem; margin-top:8px">Make it compile</div>
<div class="fig-caption" style="margin-top:10px">Compiler versions, dependencies, platform quirks</div>
</div>

<div class="kami-card">
<div class="ui-label">Step 3</div>
<div style="font-size:1.05rem; margin-top:8px">Write the input</div>
<div class="fig-caption" style="margin-top:10px">A 300-page manual, or no manual at all</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">Step 4</div>
<div style="font-size:1.05rem; margin-top:8px">Decide if the answer is right</div>
<div class="fig-caption" style="margin-top:10px">Nothing tells you</div>
</div>

</div>

<div class="takeaway mt-12">The first three manage the code. The fourth tests the physics.</div>

<!--
Central message: the first three stages announce failure. The fourth does not.

What to say: a first FRESCO or TALYS run takes time because the source, build, and input format are unfamiliar. But when one of those stages fails, you know it. A wrong result followed by a clean exit is different.

Timing: 0:40 to 2:00.

Transition: the difference is whether failure exposes itself.
-->

---
layout: fact
---

# The first three steps are an annoyance

# <span style="color: var(--color-gap)">The fourth is a hazard</span>

<div style="max-width: 760px; margin: 40px auto 0">
<p style="font-size:1.05rem; line-height:1.85">If it does not compile, you know you failed.<br>If the input is wrong enough that the code refuses to start, you know you failed.<br><br><b>If the input is wrong and the code runs anyway, you do not know.</b></p>
</div>

<!--
Central message: an unannounced failure is the dangerous one.

What to say: compilation stops. An unreadable input also stops. The hard case is different: the code accepts the deck, finishes normally, and returns a result with the right units, a sensible shape, and the right order of magnitude.

Timing: 2:00 to 3:00.

Transition: here is a trap that new group members can easily hit.
-->

---

# A trap that still lets the code finish: the radius convention

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">How FRESCO builds radii</div>

```
R = r0 * (Ap^1/3 + At^1/3)
```

<div class="fig-caption" style="margin-top:12px">Both projectile and target enter the radius</div>
</div>

<div class="kami-card">
<div class="ui-label">How KD02 and CH89 define radii</div>

```
R = r0 * At^1/3
```

<div class="fig-caption" style="margin-top:12px">Target only, the standard convention for global potentials</div>
</div>

</div>

<div class="box-idea mt-8">

Only one change is needed: write `ap=0` on the `type=0` line. A neutron run still needs that line because it declares the radius convention.

</div>

<div class="takeaway mt-8">The physics is unchanged. The two radius conventions were not joined correctly.</div>

<!--
Central message: both sides are correct on their own, yet the combined input is wrong.

What to say: Koning and Delaroche state their radius definition, and the FRESCO manual states how the code builds a radius. Both rules are public, but the original documents do not put the handoff in one place. The missing sentence is `ap=0`.

Timing: 3:00 to 4:30.

Transition: what happens when that sentence is omitted.
-->

---

# Omit `ap=0` and the code still reports success

<div class="grid grid-cols-3 gap-6 mt-10">

<div v-click class="kami-card">
<div class="ui-label">Radii</div>
<div style="font-size:2.4rem; font-weight:500; color: var(--color-gap); margin-top:8px">+22%</div>
<div class="fig-caption" style="margin-top:10px">For a nucleon projectile, every radius is about 22% too large</div>
</div>

<div v-click class="kami-card">
<div class="ui-label">The code</div>
<div style="font-size:2.4rem; font-weight:500; margin-top:8px">Exits cleanly</div>
<div class="fig-caption" style="margin-top:10px">No warning, no non-zero exit status</div>
</div>

<div v-click class="kami-card">
<div class="ui-label">The cross section</div>
<div style="font-size:2.4rem; font-weight:500; margin-top:8px">Looks fine</div>
<div class="fig-caption" style="margin-top:10px">Right units, right angular shape, right magnitude</div>
</div>

</div>

<div v-click class="box-gap mt-10">

This code has at least two more silent errors. Put the surface term `W_d` in `p1` of the `type=2` line instead of `p4` and it becomes a real surface well, reducing the absorption. Omit the entire `type=0` line and no radius convention is declared.

</div>

<!--
Central message: the radii are about 22% too large, while every visible signal says "success".

What to say: pause here. A 22% radius error is not an order-of-magnitude failure that is obvious at a glance, and it is not a negligible last digit. The code can still return a smooth, plausible angular distribution.

Timing: 4:30 to 6:00.

Transition: now see what a general agent does with the same task.
-->

---

# A general agent can return a false success here

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="box-gap">

Ask for a FRESCO deck and it returns a file that **looks entirely correct**. The deck runs, the cross section is 20% wrong, and no warning appears.

</div>

<div class="fig-caption" style="margin-top:20px; line-height:1.8">
It knows the Koning-Delaroche formula and the FRESCO namelist. What is missing is the sentence that joins those two rules.
</div>

</div>

<div v-click>

<div class="kami-card-accent">
<div class="ui-label">Why this error is hard to catch</div>
<div style="margin-top:12px; line-height:1.9; font-size:0.95rem">
A student's mistake can be discussed in a group meeting and recorded.<br><br>
An agent's tone does not change with correctness. Unless the rule enters a reusable document, the next run starts from the same gap.
</div>
</div>

</div>

</div>

<!--
Central message: a general agent can present a silent failure as a completed task.

What to say: do not name or mock a model. The derivation is already there. The small rule needed where the two conventions meet was never delivered with either code.

Timing: 6:00 to 7:30.

Transition: the remaining question is where that knowledge should live.
-->

---
layout: fact
---

# Model size is not the fix

<div style="max-width: 800px; margin: 36px auto 0">

<div class="box-idea">

Write the code knowledge down and add **one benchmark with a stated tolerance**. Other people can read, audit, and edit it.

</div>

<p style="margin-top: 28px; font-size:1rem; line-height:1.85; color: var(--olive)">The document must state the notation, the silent failure modes, and one known answer. Then the current build can be checked against it.</p>

</div>

<!--
Central message: the main sentence of the talk.

What to say: slow down. The weight is on "a benchmark with a stated tolerance". Writing experience into instructions is not enough. Without a known answer, the user still has to choose whether to trust the output.

Timing: 7:30 to 8:30.

Transition: FUSION follows this rule.
-->

---
layout: section
---

# 2. What FUSION does

<!--
Timing: 8:30. Move through quickly.
-->

---

# One expert skill for each code

<div class="grid grid-cols-3 gap-5 mt-10">

<div class="kami-card">
<div class="ui-label">01 Install</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Build from the author's own upstream source, not from a cached copy</div>
</div>

<div class="kami-card">
<div class="ui-label">02 Write</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Generate input in this code's conventions, including the rules where conventions meet</div>
</div>

<div class="kami-card">
<div class="ui-label">03 Run</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">With the right working directory and runtime preconditions</div>
</div>

<div class="kami-card">
<div class="ui-label">04 Parse</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Read the output format and pull out the column you actually wanted</div>
</div>

<div class="kami-card">
<div class="ui-label">05 Inspect</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Check this code's documented silent failure modes</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">06 Verify</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Check against a known answer, with the tolerance written down</div>
</div>

</div>

<div class="takeaway mt-10">The first five make the code usable. The sixth supplies evidence.</div>

<!--
Central message: a skill runs from installation to verification and finishes with a number someone else can check.

What to say: the first five answer whether the code is usable. The sixth answers why the result should be believed. The tolerance must appear in the document; "tests passed" is not enough.

Timing: 8:40 to 10:00.

Transition: read the source rather than describing it.
-->

---

# A skill is a document, not a model

<div class="ui-label">skills/fresco/SKILL.md, verbatim</div>

<div class="kami-card" style="margin-top:14px">
<div style="font-size:0.88rem; line-height:1.85; color: var(--charcoal)">
<b>Why to use it rather than typing the parameters.</b> The formulas are not the hard part; the handoff into FRESCO is. Three things go wrong silently, meaning the deck runs and prints a plausible cross section that is wrong:
<br><br>
<b>· The radius convention.</b> FRESCO builds radii as <code>R = r0*(Ap^1/3 + At^1/3)</code>, while KD02 and CH89 are both defined on <code>R = r0*At^1/3</code>. The fix is <code>ap=0</code> in the <code>type=0</code> line, which the script always emits. Get it wrong on a nucleon projectile and every radius is about 22% too large.
<br><br>
<b>· The surface term is imaginary.</b> <code>W_d</code> goes in <code>p4</code> of the <code>type=2</code> line, not <code>p1</code>. In <code>p1</code> it becomes a real surface well and the absorption quietly drops.
</div>
</div>

<div class="grid grid-cols-3 gap-5 mt-8">
<div v-click class="fig-caption">Only Markdown and shell, with no weights or binaries</div>
<div v-click class="fig-caption">Anyone can review it and submit a pull request</div>
<div v-click class="fig-caption">It can also be printed and given to a new student</div>
</div>

<!--
Central message: a skill is an ordinary document, not a black box.

What to say: read this source text to the audience. It requires no trust in a model, and a new student can use it without an agent.

Timing: 10:00 to 11:30.

Transition: how many such skills exist now.
-->

---

# Which codes are covered now

<div class="mt-6" style="font-size:0.93rem">

| Area | Codes |
|---|---|
| Reactions, optical model | FRESCO (with SFRESCO fitting), COLOSS, CCFULL, pikoe, NLAT, CNOK, SIDES, SWANLOP |
| Structure, ab initio | GSM, KSHELL, NuclearToolkit.jl, Sky3D |
| Fission, statistical | CGMF, TALYS |
| Astrophysics, R-matrix | AZURE2, SkyNet |
| Heavy-ion, equation of state | SMASH, GiBUU, Thermal-FIST, vHLLE |

</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="box-idea">

There are **20** skills for specific codes. **6** more cover SFRESCO fitting, EXFOR retrieval, offline corpus search, two personal research wikis, and first-run setup. **26** in total.

</div>

<div class="fig-caption" style="line-height:1.8">
Admission has three criteria: publicly obtainable, builds from source on the target platform, and has a published paper.<br><br>No stated benchmark tier means no release.
</div>

</div>

<!--
Central message: the codes are organised by physics problem, and admission has explicit criteria.

What to say: do not read the table. Pick two codes that match the audience, for example FRESCO and COLOSS for reactions or SMASH and vHLLE for heavy ions.

Consistency reminder: 20 means code skills, 26 means all skills. Never mix the two in one sentence.

Timing: 11:30 to 12:30.

Transition: answer the direct question of whether this is tied to one agent.
-->

---

# The agent and the model can both change

<div class="grid grid-cols-2 gap-8 mt-8">

<div>

<div class="ui-label">Three agent entry points</div>

<div class="mt-4" style="font-size:0.92rem">

| Agent | Entry | Status |
|---|---|---|
| opencode | `SKILL.md` | verified, zero config |
| Claude Code | `SKILL.md` | verified |
| Codex | `AGENTS.md` | format only, not tested end to end |

</div>

<div class="fig-caption" style="margin-top:16px">The same directory carries `SKILL.md` and `AGENTS.md` entry points.</div>

</div>

<div>

<div class="box-idea">

The base is opencode, which can connect to different model providers without changing the skill.

</div>

<div class="kami-card" style="margin-top:22px">
<div class="ui-label">Phase 0 acceptance test</div>
<div style="margin-top:10px; font-size:0.95rem; line-height:1.8">
The Phase 0 test used deepseek-chat to write an independent FRESCO deck for n+<sup>90</sup>Zr elastic scattering. It agrees with the reference calculation to <b>4 to 5 significant figures</b>.
</div>
</div>

</div>

</div>

<!--
Central message: the skills do not depend on one model vendor, and Phase 0 was accepted on deepseek-chat.

What to say: state the acceptance result directly. The code knowledge lives outside the model, so changing models does not require a new skill.

Timing: 12:30 to 13:30.

Transition: run it now.
-->

---
layout: section
---

# 3. Live demonstration

<div style="max-width: 680px; margin: 30px auto 0; text-align:left">

<div class="kami-card-accent">
<div class="ui-label">What it is given, in words</div>
<div style="margin-top:12px; font-size:1.02rem; line-height:1.8">
Compute n+<sup>90</sup>Zr elastic scattering at 50 MeV with the KD02 global optical potential, and compare with whatever EXFOR data exists.
</div>
</div>

</div>

<!--
Central message: one sentence leads to parameter retrieval, input writing, compilation, execution, parsing, data retrieval, and plotting.

What to say: read the sentence, pause for two seconds, then switch. It contains no filename, path, or parameter.

Demo notes: check the terminal font size before switching. If nothing substantive happens within 30 seconds, cut to the recording. Do not explain and do not apologise.

Timing: 13:30 to 24:00, ten and a half minutes. The figure slide follows immediately.

Transition: after the demo, return here and show what it delivered.
-->

---
layout: center
---

<div style="text-align:center">
<div class="ui-label">Live demonstration</div>
<h1 style="margin-top:20px">Switch to the terminal</h1>
<p style="margin-top:24px; color: var(--olive)">Backup recording: <code>demo-n90zr.mp4</code></p>
</div>

<!--
Placeholder only. Normally you never stop here.

If the demo fails: cut to the recording, say only "the network is not cooperating, here is the edited version", and continue. Do not debug live.

Four beats to call out while it runs:
1. It sources the KD02 parameters from Koning's own kd02.f already on disk, rather than rewriting the formulas from memory
2. It emits ap=0
3. It runs a step-size and partial-wave convergence check
4. It queries EXFOR and reports that there is no measurement at 50 MeV
-->

---

# What the demo delivered

<div class="fig-caption" style="text-align:left; margin-bottom:10px">Green is the zero-free-parameter prediction of the KD02 global optical potential, pink points are EXFOR measurements. Each panel was recomputed at its own measured energy.</div>

<img src="./figures/case-kd02-exfor.png" class="kami-img" style="width:100%; max-height:262px; object-fit:contain" />

<div class="grid grid-cols-3 gap-5 mt-4">

<div class="kami-card" style="padding:14px 18px">
<div class="ui-label nocaps">Left · 24 MeV</div>
<div style="margin-top:6px; font-size:0.87rem">Enriched <sup>90</sup>Zr, all angles. Median ratio <b>0.89</b></div>
</div>

<div class="kami-card" style="padding:14px 18px">
<div class="ui-label nocaps">Right · 55 MeV</div>
<div style="margin-top:6px; font-size:0.87rem">Natural Zr, forward angles. χ²/N = <b>0.75</b></div>
</div>

<div class="kami-card kami-card-accent" style="padding:14px 18px">
<div class="ui-label nocaps">Middle · 50 MeV</div>
<div style="margin-top:6px; font-size:0.87rem"><b>No panel, nothing measured at that energy</b></div>
</div>

</div>

<!--
Central message: the demo delivered a curve and the sentence "there is no data here".

What to say: start with the figure. Both energies are zero-free-parameter calculations. Then show the third card: EXFOR has no 50 MeV measurement, so the calculation was repeated at the two measured energies and the gap was reported.

No data is not a failed task, and the nearest energy cannot be passed off as 50 MeV. Hold this slide for ten more seconds.

Timing: 24:00 to 25:30, immediately after the demo.

Transition: the next question is why that green curve should be trusted.
-->

---
layout: section
---

# 4. Why these results should be believed

<!--
Timing: 25:30.

This part is about evidence. If time is short, cut part five, not this section.
-->

---

# Two tiers of evidence, declared in every code skill

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">Tier 1　14 skills</div>
<div style="margin-top:12px; font-size:0.97rem; line-height:1.85">
The code distribution ships reference values or a test suite, and the skill reproduces them.<br><br>
Several match <b>byte for byte</b>, not merely within uncertainty.
</div>
</div>

<div class="kami-card">
<div class="ui-label">Tier 2　6 skills</div>
<div style="margin-top:12px; font-size:0.97rem; line-height:1.85">
The code has no reference output, so another check is used: cross-platform reproduction, a physics invariant, or an independent analytic solution.<br><br>
If no reference output exists, the substitute check must be stated.
</div>
</div>

</div>

<div class="box-idea mt-10">

The grading is public. Each code skill states its tier, evidence, tolerance, and known failure modes in `SKILL.md` or `references/verification.md`.

</div>

<!--
Central message: the evidence is public, graded, and checkable line by line, not reduced to "tested".

What to say: many codes ship no reference output. Tier 2 changes the verification method without lowering the standard. The next slide gives two cases.

Timing: 25:30 to 27:00.

Transition: look at two actual benchmarks.
-->

---

# What two benchmarks look like

<div class="grid grid-cols-2 gap-8 mt-6">

<div>

<div class="ui-label" style="color: var(--color-evidence)">Tier 1 · CNOK</div>

<div class="kami-card" style="margin-top:12px">
<div style="font-size:0.93rem; line-height:1.8">
<sup>16</sup>C minus one neutron on <sup>12</sup>C at 239 MeV/u. Stripping and diffractive-dissociation cross sections:
<br><br>
<code style="font-size:0.85rem">60.086689 / 18.056073 / 78.142761 mb</code>
<br><br>
Bit-identical across <b>four builds</b>: macOS/clang patched at -O2 and -O0, Linux/gcc unpatched and patched. The stripping channel matches the paper's 60.087 mb exactly.
</div>
</div>

<div class="fig-caption" style="margin-top:14px">Bit-identical unpatched gcc and patched clang builds show that the patch changed portability, not the physics result.</div>

</div>

<div>

<div class="ui-label" style="color: var(--color-evidence)">Tier 2 · vHLLE and AZURE2</div>

<div class="kami-card" style="margin-top:12px">
<div style="font-size:0.93rem; line-height:1.8">
vHLLE ships no reference output, so it is checked against <b>closed-form Gubser flow</b> rather than against its own output.
<br><br>
AZURE2 reconstructs <sup>16</sup>O(p,γ)<sup>17</sup>F from the nine parameters in the paper's table with <b>no fitting</b>: S(90 keV) differs by −5.7%, and χ²/N = 1.53 against measured data.
</div>
</div>

<div class="fig-caption" style="margin-top:14px">The −5.7% is reported as it stands rather than absorbed by a fit.</div>

</div>

</div>

<!--
Central message: one case is bit-identical; the other reports its residual unchanged.

What to say: CNOK needed two macOS patches. The check is direct: the unpatched gcc build and the patched clang build agree bit for bit.

State the AZURE2 −5.7% directly rather than reporting only χ²/N.

Timing: 27:00 to 29:00.

Transition: another solver provides a further check.
-->

---

# Use a second solver

<div class="grid gap-8 mt-8" style="grid-template-columns: 3fr 2fr;">

<div>

<div class="ui-label nocaps">n+<sup>90</sup>Zr elastic scattering, 50 MeV, KD02</div>

<div class="mt-4" style="font-size:0.93rem">

| Check | Result |
|---|---|
| Radial step halved twice | stable to **9 significant figures** |
| Matching radius and partial-wave limit doubled | unchanged |
| COLOSS (complex-scaled Lagrange-Laguerre) | 1299.188 mb |
| FRESCO (Numerov coupled channels) | 1299.191 mb |
| Agreement | **6 significant figures** |
| Setting W = 0 | absorption vanishes exactly, flux conserved |

</div>

</div>

<div>

<div class="box-evidence">

The two solvers follow **different numerical routes**: one uses a complex-scaled Lagrange-Laguerre basis expansion, the other Numerov integration on the real axis. They share neither code nor discretisation.

</div>

<div class="fig-caption" style="margin-top:18px; line-height:1.8">
Agreement to six figures tests implementation errors that a one-code convergence study cannot see.
</div>

</div>

</div>

<!--
Central message: convergence tests one implementation; a cross-code calculation also tests the implementation itself.

What to say: step-size and cutoff checks test discretisation. A solver that follows a different numerical route adds a check on implementation errors. Setting W = 0 and recovering zero absorption adds a physics identity.

Timing: 29:00 to 30:30.

Transition: next, show how the tolerance was set.
-->

---

# How the tolerance was set

<div class="box-gap mt-6">

Checking the KD02 parameterisation value by value against Koning's own `kd02.f`, CH89 matches to machine precision across the 39 pinned values, while **KD02 stops at about 7 digits**.

</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div v-click>

<div class="ui-label">Where the difference comes from</div>

<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
That <code>kd02.f</code> is single precision wherever Fortran lets it be. The declarations say <code>real*8</code>, which does not make the arithmetic double:
<br><br>
literals are truncated, so <code>59.30</code> enters as <code>59.2999992370605</code>; <code>1./3.</code> is a single-precision divide; and <code>real(N-Z)</code> carries no kind argument, so it drops to <code>real(4)</code>.
</div>

</div>

<div v-click>

<div class="box-evidence">

Recompile the reference `kd02.f` with `-fdefault-real-8` and the two agree to **16 digits**.

</div>

<div style="margin-top:14px; font-size:0.9rem; line-height:1.8">
The result is direct: <b>the skill's implementation is more accurate, and the residual comes from the Fortran</b>.
<br><br>
The three or four physically meaningful digits are unaffected. Once the source is known, any difference above 2×10⁻⁷ is a real bug.
</div>

</div>

</div>

<!--
Central message: the tolerance comes from the measured precision of the reference code.

What to say: explain why the comparison stops at seven digits, then show the sixteen-digit agreement after `-fdefault-real-8`. End at 2e-7: once the source is known, the tolerance has a basis.

Hold this slide for fifteen more seconds.

Timing: 30:30 to 32:00.

Transition: code can test itself, but the verification scripts also need an attacker.
-->

---

# Before release, another AI searches for false positives

<div class="fig-caption mt-4">Every code skill gets an adversarial pass before release. All three errors below were found in those passes.</div>

<div class="grid grid-cols-3 gap-5 mt-8">

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">TALYS</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
<code>run_talys.sh</code> could <b>run a stale deck and report success</b>. With an empty source directory and a leftover workdir, the copy failed silently under <code>|| true</code>, TALYS ran the previous <code>talys.inp</code>, and it exited 0.
</div>
<div class="fig-caption" style="margin-top:12px">The skill was written to prevent this false positive, yet its own script contained one.</div>
</div>

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">GiBUU</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
A selftest marker used a regex alternation (<code>non-numeric\|not finite</code>) inside a <code>case</code> statement, and <code>case</code> matches globs, not regexes.
<br><br>
<b>It could never fire.</b>
</div>
<div class="fig-caption" style="margin-top:12px">A check that can never fail is no check.</div>
</div>

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">SMASH</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
The identity and ctest selftest blocks were <b>fabricating their own fixture</b>: they synthesised a stamp from <code>head -1</code> of the real build's stamp, but the Linux build predated it, so the file did not exist and the synthetic stamp collapsed to one line.
</div>
<div class="fig-caption" style="margin-top:12px">Eight cases were failing against an input the fixture had invented. Only the move to Linux exposed it.</div>
</div>

</div>

<!--
Central message: verification scripts can also report false success, so they must be tested.

What to say: explain all three. TALYS ran stale input, the GiBUU check could never fire, and the SMASH fixture fabricated the wrong input. Verification scripts cannot be assumed correct.

If someone asks who verifies the verifier: answer honestly that nobody does, which is why there are also cross-platform builds and physics identities. No single layer is sufficient.

Timing: 32:00 to 34:00.

Transition: moving the same checks to another platform exposed another problem.
-->

---

# A second platform shows which quantity to pin

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="ui-label">SMASH, Au+Au transport</div>

<div class="box-gap" style="margin-top:12px">

With identical source, input, and random seed, some particle multiplicities differ by up to **25%** between macOS and Linux.

</div>

<div class="box-evidence" style="margin-top:18px">

Baryon number **B = 788** and charge **Q = 316** are exact integers on both platforms and do not move at all.

</div>

</div>

<div v-click>

<div class="kami-card-accent">
<div class="ui-label">The verifier moved to conservation laws</div>
<div style="margin-top:12px; font-size:0.95rem; line-height:1.85">
Platform-sensitive multiplicities are no longer treated as ground truth. The checks use conservation laws instead.<br><br>
The same pass caught an old rule that assigned baryon number zero to light-nucleus PDG codes.
</div>
</div>

<div class="fig-caption" style="margin-top:18px">104 of 104 tests pass on Linux.</div>

</div>

</div>

<div class="takeaway mt-8">With one platform only, those multiplicities would have been recorded as ground truth.</div>

<!--
Central message: cross-platform checks decide which quantities may serve as benchmarks.

What to say: the multiplicities change with platform and cannot be benchmarks. B and Q remain exact integers on both and can. That conclusion requires both platforms.

Timing: 34:00 to 35:30.

Transition: state the boundary now.
-->

---
layout: fact
---

# A benchmark certifies that this build reproduces a known result

# <span style="color: var(--color-gap)">It does not certify that your calculation is right</span>

<div style="max-width: 760px; margin: 40px auto 0">
<p style="font-size:1.05rem; line-height:1.85">Which optical potential, how the continuum is truncated, whether the energy range is appropriate: all still yours.<br><br><b>The physics is still yours.</b></p>
</div>

<!--
Central message: benchmarks cover the tool layer; physics judgement remains with the user.

What to say: state the boundary directly. A benchmark can test the build and known failure modes. It cannot choose the optical potential, continuum cutoff, or energy range.

Timing: 35:30 to 36:30.

Transition: the codes are covered. Move to the offline literature layer.
-->

---
layout: section
---

# 5. The offline literature layer

<!--
Timing: 36:30. This part can be compressed if you are running late, but keep the map slide.
-->

---

# 61,167 local pages, readable with grep

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="kami-card">
<div class="ui-label">The corpus</div>
<div style="margin-top:12px; font-size:0.95rem; line-height:1.85">
61,059 arXiv nucl-th papers, one page each, plus 108 topic pages, plus a citation layer and a semantic-relation layer.
<br><br>
Read locally, with no server or API key and no network during search.
</div>
</div>

<div class="box-gap" style="margin-top:18px">

These pages are machine-generated summaries and **can be wrong**. Cite the original paper, not the page.

</div>

</div>

<div>

<div class="ui-label">An actual task, given one PDF</div>

<div style="margin-top:12px; font-size:0.92rem; line-height:1.8">
The input was Abu-Ibrahim <i>et al.</i>, <i>PRC</i> <b>77</b>, 034607, reaction cross sections of carbon isotopes on a proton target. Fully offline, zero external calls.
<br><br>
The corpus resolved it to <code>0710.4193</code>; the citation graph returned the <b>8 papers</b> it cites and the <b>5</b> citing it, including the group's own predecessor and the <sup>22</sup>C two-neutron halo work. The digest supplied checkable numbers: σ<sub>R</sub> = 432 mb for p+<sup>12</sup>C at 40 MeV.
</div>

<div class="box-gap" style="margin-top:16px">

**Limit:** citation edges are counted only inside this corpus. The RIKEN measurements are not nucl-th, so "cited by 5" understates the real count.

</div>

</div>

</div>

<!--
Central message: the offline corpus provides checkable leads and has explicit limits.

What to say: present the capability and the limits together. The summaries can be wrong, and the citation graph covers only this corpus.

Timing: 36:30 to 38:30.

Transition: now view the corpus as a map.
-->

---
layout: center
---

<div style="text-align:center">
<img src="./figures/corpus-map.png" class="kami-img" style="max-height: 400px; margin: 0 auto" />
<div class="fig-caption" style="margin-top:14px">A citation projection of 55,850 papers. The terrain is a paper-density field, one dot is one paper with area proportional to citations inside the corpus, and the place names are PhySH topics.</div>
</div>

<!--
Central message: citation structure divides the corpus into recognisable regions.

What to say: let them look for five seconds before saying anything. Then point at two regions they will recognise: where reaction theory sits, where lattice QCD sits.

Timing: 38:30 to 39:30.

Transition: the next slide answers one question, why no edges are drawn.
-->

---

# Not one citation edge is drawn

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="box-idea">

Citation relations only **set the layout**. The visible result is a density map.

</div>

<div style="margin-top:18px; font-size:0.93rem; line-height:1.85">
The projection is not drawn this way for appearance. At this scale, a force-directed node-link drawing becomes a hairball, and further parameter tuning does not fix it.
</div>

<div class="fig-caption" style="margin-top:16px; line-height:1.8">
Related tools also avoid a fully connected view: Connected Papers draws only the ego graph of a seed paper, Open Knowledge Maps caps each map at 100 papers, and VOSviewer renders about 100 nodes at the 100k scale. Paperscape likewise omits edges when drawing a whole corpus.
</div>

</div>

<div>

<div class="kami-card">
<div class="ui-label">Identity is carried by place names, not by colour</div>
<div style="margin-top:12px; font-size:0.92rem; line-height:1.8">
The five background regions come from clustering topic centroids and are only an aid. Five is the ceiling that passes an all-pairs contrast-accessibility check.
<br><br>
The names keep the figure readable in black-and-white print and under colour-vision deficiency.
</div>
</div>

<div class="kami-card" style="margin-top:18px">
<div class="ui-label">Only topics that genuinely cluster get a name</div>
<div style="margin-top:12px; font-size:0.92rem; line-height:1.8">
<code>quantum-chromodynamics</code> has 7,327 papers spread across the whole figure, so it is not labelled. It is a common language, not a place.
<br><br>
Eligibility is decided by a dispersion ratio at 0.78, not by hand.
</div>
</div>

</div>

</div>

<!--
Central message: this slide explains why edges are omitted and how place names are selected.

What to say: explain the hairball first, then QCD. A topic spread over the whole map is not a place and should not receive a place name.

Timing: 39:30 to 41:00.

Transition: finally, what does not work yet.
-->

---

# What is not ready yet

<div class="grid grid-cols-2 gap-6 mt-8">

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">Cold-start installs have the least testing</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
Of the twenty codes, only FRESCO has completed a full install from an empty cache. Other codes will probably miss a dependency on a new machine.
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">Campus test: the first two commands failed</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
Measured on a university network on 2026-08-13: all six github.com connection attempts failed and the clone exited after 132 seconds. A proxy is currently needed; the mirror remains unresolved.
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">Disk and platform</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
TALYS needs about 11 GB, including an 8.6 GB structure database, so do not try it first. There is no Windows build, and the macOS and Linux binaries are unsigned.
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">Only the author has used it so far</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
v0.1.0 is the first public build. The author uses it daily, but no external user has completed a test.
</div>
</div>

</div>

<div class="takeaway mt-12">The next task is to learn where it breaks on other machines.</div>

<!--
Central message: state all known problems directly.

What to say: move quickly, but keep all four. Put the network issue second because it appears during the first install.

Timing: 41:00 to 42:30.

Transition: state which report I want most.
-->

---

# The report I want most

<div class="box-gap mt-10" style="max-width: 820px">

**A result that looked right and was wrong.**

</div>

<div style="max-width: 820px; margin-top: 22px; font-size:1rem; line-height:1.9">
A general agent can write a FRESCO deck with the wrong radius convention that still runs normally. If FUSION returns such a result, send me the deck, the number it produced, and the correct value.
</div>

<div class="fig-caption" style="margin-top:20px; line-height:1.8">
I fear this failure most, and it is the hardest report to receive because it looks like success.
</div>

<div class="grid grid-cols-3 gap-5 mt-10">
<div class="kami-card">
<div class="ui-label">Install failure</div>
<div style="margin-top:8px; font-size:0.92rem">A code that will not install, with the error, your OS, and your compiler</div>
</div>
<div class="kami-card">
<div class="ui-label">Awkward use</div>
<div style="margin-top:8px; font-size:0.92rem">Anything that felt awkward</div>
</div>
<div class="kami-card">
<div class="ui-label">Missing code</div>
<div style="margin-top:8px; font-size:0.92rem">Which code you wish had a skill</div>
</div>
</div>

<!--
Central message: tell the audience which reports are most useful.

What to say: ask for anything that feels awkward. First-time users see problems in the first-run flow that regular users no longer notice.

Timing: 42:30 to 43:30.

Transition: return to the opening question.
-->

---
layout: center
---

<div style="text-align:center">
<div class="fusion-mark" style="font-size:2.4rem; margin-bottom:34px">FU <span style="letter-spacing:-0.04em"><span style="color:#2f7fb8">&#9656;</span><span style="color:#c8791a">&#9666;</span></span> SION</div>

<div style="max-width: 780px; margin: 0 auto">

<div class="box-idea">

The hard part of running a nuclear-physics code is not starting it. It is knowing whether the result is right.

</div>

<p style="margin-top: 30px; font-size:1rem; line-height:1.9">That knowledge used to pass by word of mouth inside a group.<br>It can now be written down, checked, and edited by the people who come next.</p>

</div>

<div style="margin-top: 40px">
<span class="meta">github.com/jinleiphys/FUSION　·　vibeinscience.com　·　MIT　·　jinl@tongji.edu.cn</span>
</div>

</div>

<!--
Central message: end in one sentence, with no more tooling detail.

What to say: do not repeat the skill count or corpus size. Make one point: oral knowledge is lost; a document can be checked and changed.

If there is time, add: something only I can inspect cannot be called verified.

Timing: 43:30 to 45:00, then questions.
-->

---
layout: section
---

# Backup

---

# Checks run on n+<sup>90</sup>Zr

<div class="mt-4" style="font-size:0.83rem">

| Check | Question | Result |
|---|---|---|
| `omp.py` deck vs hand-built deck | did the generator write it right | σ<sub>R</sub> = 1301.64017 mb, identical |
| Radial step halved twice | has it converged | stable to 9 figures |
| Matching radius, l<sub>max</sub> doubled | is the cutoff far enough | unchanged |
| COLOSS vs FRESCO | do two implementations agree | 1299.188 vs 1299.191 mb, 6 figures |
| Setting W = 0 | is flux conserved | absorption vanishes exactly |
| Against EXFOR | how far from experiment | 0.89 median at 24 MeV, χ²/N = 0.75 at 55 |
| Against 39 pinned values | are the parameters right | KD02 to 7 digits, CH89 exact |

</div>

<div class="box-idea mt-4" style="font-size:0.9rem">

**1301.640 and 1299.19 are not comparable.** They come from two runs with different configurations. The first checks the complete KD02 path end to end; the second checks two solvers in one common configuration. Each row answers its own question.

</div>

<!--
This slide explains why the project website gives 1301.640 mb while the main talk also shows the 1299.19 pair.

They are two checks, not two versions of one number. The generated-versus-hand-built row checks `omp.py`; the COLOSS-versus-FRESCO row checks two implementations. The configurations differ, so the numbers cannot be compared directly.

If pressed on the source of the difference: the complete configurations from that run were not recorded, so the source has not been verified. Do not guess.
-->

---

# The full list of 26 skills

<div class="grid grid-cols-2 gap-8 mt-6" style="font-size:0.88rem">

<div>

<div class="ui-label">Drive a specific code (20)</div>

| Area | Codes |
|---|---|
| Reactions, optical model | FRESCO, COLOSS, CCFULL, pikoe, NLAT, CNOK, SIDES, SWANLOP |
| Structure, ab initio | GSM, KSHELL, NuclearToolkit.jl, Sky3D |
| Fission, statistical | CGMF, TALYS |
| Astrophysics, R-matrix | AZURE2, SkyNet |
| Heavy-ion, EoS | SMASH, GiBUU, Thermal-FIST, vHLLE |

</div>

<div>

<div class="ui-label">The rest (6)</div>

<div style="margin-top:10px; line-height:2">
· SFRESCO, chi-squared fitting and MINUIT search<br>
· exfor-data, EXFOR retrieval and parsing<br>
· kb-search, offline corpus search<br>
· literature-wiki, personal literature wiki<br>
· research-profile, personal research portfolio<br>
· fusion-setup, first-run initialisation
</div>

<div class="box-idea" style="margin-top:20px">

Admission: publicly obtainable, builds from source on the target platform, has a published paper. All three, or it does not ship.

</div>

</div>

</div>

---

# Network requirements during installation

<div class="mt-8" style="font-size:0.93rem">

```bash
# 1. FUSION itself
git clone https://github.com/jinleiphys/FUSION.git && cd FUSION

# 2. the CLI, into the clone
curl -fsSL https://github.com/jinleiphys/FUSION/releases/latest/download/fusion-darwin-arm64.tar.gz | tar -xz
xattr -d com.apple.quarantine fusion          # macOS only

# 3. work
./fusion
```

</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="box-gap">

Both commands need GitHub and usually fail on a mainland-China network. Installing a code for the first time also needs its upstream source. The corpus is already in the clone, so searching it is offline.

</div>

<div class="fig-caption" style="line-height:1.8">
The clone is about 229 MB, nearly all of it the knowledge base. If only the skills are needed, skip the clone and point the agent at the skills directory URL.<br><br>
Requirements are git, make, gfortran, a C++ compiler, and python3. Each skill states any extra dependency before installation.
</div>

</div>

---

# How the corpus map is computed

<div class="grid grid-cols-2 gap-8 mt-8">

<div>

<div class="ui-label">Step 1: layout</div>

<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
Citation adjacency → truncated SVD to 32 dimensions → t-SNE to two dimensions.
<br><br>
Minimum degree 2, perplexity 200, row-normalised, no co-occurrence association. About 90 seconds for 61k nodes.
</div>

</div>

<div>

<div class="ui-label">Step 2: rendering</div>

<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
The terrain is the density field, binned and Gaussian-blurred. Dot area is proportional to citations inside the corpus. Place names are drawn from PhySH topics with a dispersion ratio at or below 0.78.
<br><br>
Pure Python standard library, runs locally.
</div>

</div>

</div>

<div class="box-idea mt-10">

Both steps are in the fusion-web repository: `scripts/kb_citemap.py` and `scripts/kb_citemap_render.py`.

</div>

---

# If asked: how does this differ from a general coding assistant

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">General assistant in this test</div>
<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
· It supplied a deck, not a separate document containing the code rules<br>
· It gave no known answer or tolerance for checking the deck<br>
· Unless a correction enters the shared document, it must be repeated next time<br>
· Tone gives no information about correctness
</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">A skill</div>
<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
· Knowledge is repository Markdown that can be reviewed and edited<br>
· Each code skill carries one known answer and a stated tolerance<br>
· A discovered error is written into the shared document<br>
· The benchmark tier and known failure modes are stated directly
</div>
</div>

</div>

<div class="takeaway mt-10">The difference is not the model. It is where the knowledge lives and how the result is checked.</div>
