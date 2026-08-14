---
theme: seriph
title: "FUSION: getting an agent to drive nuclear-physics codes correctly"
info: "A general agent writes a plausible FRESCO deck with the wrong radius convention. FUSION fixes each code's domain knowledge, and a benchmark with a stated tolerance, into a skill."
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

# Getting an agent to drive nuclear-physics codes

<div style="text-align:center; margin-top: 6px">
<p style="font-size:1.05rem">and being able to show that it did not get the number wrong</p>
</div>

<div style="text-align:center; margin-top: 46px">
<span class="meta">Jin Lei　Department of Physics, Tongji University　jinl@tongji.edu.cn</span>
</div>

<div style="text-align:center; margin-top: 12px">
<a href="/talk/zh/" class="meta lang-switch">中文版</a>
</div>

<!--
Central message: this talk is not a software demo. It is about a verifiability problem and one way of solving it.

Opening: what I usually present here is reaction theory. This is the other face of the same problem. We all run codes written by other people, and deciding whether the output is right has never been made systematic.

Timing: 0:00 to 0:40.

Transition: let me start with a question.
-->

---
layout: center
---

# Running a nuclear-physics code you have never run takes four steps

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

<div class="takeaway mt-12">Only the fourth step is physics.</div>

<!--
Central message: most of the work of running a code is not physics, and the one step that is has no tool support at all.

What to say: ask the audience to recall their first FRESCO or TALYS run. The first three steps cost time. They hurt, but they are bounded, and when you are stuck you know you are stuck. The fourth is different: no error, no progress bar, no signal of any kind.

Timing: 0:40 to 2:00.

Transition: the difference between the first three and the fourth is not one of difficulty.
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
Central message: the only dangerous failure mode is the one that does not announce itself.

What to say: this is the pivot of the whole talk. Failures in the first three steps are self-reporting. Failure in the fourth is silent. And in our field most input errors are of the fourth kind: the code accepts the deck, finishes, and returns something with the right dimensions, a sensible shape, and the right order of magnitude.

Timing: 2:00 to 3:00.

Transition: here is the specific one that every student in my group hits in their first year.
-->

---

# One concrete trap: the radius convention

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

The fix is one token: `ap=0` on the `type=0` line. That line is mandatory even for a neutron, because declaring the radius convention is exactly what it does.

</div>

<div class="takeaway mt-8">This is not a disagreement about physics. It is two notations meeting inside one input file.</div>

<!--
Central message: a purely notational mismatch is enough to break the calculation, and it appears in no paper.

What to say: Koning and Delaroche of course state how their radii are defined. The FRESCO manual of course states how it builds radii. Both facts are public. No document anywhere tells you that joining them requires ap=0. That knowledge lives in the heads of people who have used both.

Timing: 3:00 to 4:30.

Transition: so what happens if you leave that token out.
-->

---

# What happens if you leave it out

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

This one code has at least two more of the same kind. Put the surface term `W_d` in `p1` of the `type=2` line instead of `p4` and it becomes a real surface well, so absorption quietly drops. Omit the `type=0` line and the radius convention is never declared at all.

</div>

<!--
Central message: the cost of the error is 22%, and every observable signal says "success".

What to say: dwell on 22% for a moment. It is not an order of magnitude, which anyone would catch. It is not one part in ten thousand, which nobody would care about. It sits exactly in the band where you will believe it and it will ruin your conclusion.

If there are experimentalists present: that is larger than the systematic uncertainty on many measurements.

Timing: 4:30 to 6:00.

Transition: now put a general-purpose AI into this situation.
-->

---

# A general agent fails here specifically

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="box-gap">

Ask one for a FRESCO deck and it hands you a file that **looks entirely correct**. The deck runs. The cross section is 20% wrong. Nothing warns you.

</div>

<div class="fig-caption" style="margin-top:20px; line-height:1.8">
It is not that it does not know the physics. It recites Koning and Delaroche better than I do, and it knows the FRESCO namelist structure. What it lacks is the seam, which was never written down anywhere.
</div>

</div>

<div v-click>

<div class="kami-card-accent">
<div class="ui-label">Why this is worse than a person making the same mistake</div>
<div style="margin-top:12px; line-height:1.9; font-size:0.95rem">
A student who makes this mistake gets caught in a group meeting and fixes it.<br><br>
An agent hands you the result in exactly the same confident register it uses when it is right, and it will do the same thing again next week, because it has nowhere to remember this.
</div>
</div>

</div>

</div>

<!--
Central message: the failure mode of a general agent lands in the most dangerous category, and it does not accumulate experience.

What to say: keep the wording careful here. Do not name a model and do not make it sound like mockery. This is not a capability gap. A larger model does the same thing, because what is missing is not reasoning, it is an oral convention that never entered any training corpus.

Timing: 6:00 to 7:30.

Transition: so the question becomes where that kind of knowledge should live.
-->

---
layout: fact
---

# The fix is not a larger model

<div style="max-width: 800px; margin: 36px auto 0">

<div class="box-idea">

Write each code's domain knowledge down, together with **one benchmark carrying a stated tolerance**, in a form that can be read, audited, and edited by someone else.

</div>

<p style="margin-top: 28px; font-size:1rem; line-height:1.85; color: var(--olive)">What is missing is not reasoning. It is the things nobody wrote down: this code's notational conventions, its silent failure modes, and one known answer, so that a person can check that this build reproduces it.</p>

</div>

<!--
Central message: the one sentence the audience must leave with.

What to say: slow down. The weight is on "a benchmark carrying a stated tolerance". Most people get to the first half on their own; the second half is what separates this from prompt engineering. Without a benchmark you have only changed the way you trust an AI.

Timing: 7:30 to 8:30.

Transition: FUSION is one implementation of that sentence.
-->

---
layout: section
---

# 2. What FUSION does

<!--
Timing: 8:30. Move through quickly.
-->

---

# One code, one expert skill

<div class="grid grid-cols-3 gap-5 mt-10">

<div class="kami-card">
<div class="ui-label">01 Install</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Build from the author's own upstream source, not from a cached copy</div>
</div>

<div class="kami-card">
<div class="ui-label">02 Write</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Generate input in this code's conventions, seams included</div>
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
<div class="ui-label">05 Recognise</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Know this code's documented silent failure modes</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">06 Verify</div>
<div class="fig-caption" style="margin-top:10px; line-height:1.7">Check against a known answer, with the tolerance written down</div>
</div>

</div>

<div class="takeaway mt-10">The first five decide whether it is usable. The sixth decides whether you can trust it.</div>

<!--
Central message: a skill is not a prompt. It is a chain from install to verification whose endpoint is a number someone else can re-check.

What to say: stress that step six is not on the same footing as the rest. Any serious wrapper does the first five. The sixth is the extra cost this project agrees to pay, and it is the only step that converts convenience into credibility.

Timing: 8:40 to 10:00.

Transition: rather than describe what a skill looks like, here is one.
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
<div v-click class="fig-caption">Plain Markdown and shell. No weights, no binaries</div>
<div v-click class="fig-caption">Can be reviewed, disputed, and changed by pull request</div>
<div v-click class="fig-caption">Can be printed and taped to a student's desk</div>
</div>

<!--
Central message: let the audience see for themselves that this is auditable prose, not a black box.

What to say: this is the most important slide in part two. The first reaction of a physics audience to AI is "I cannot check it", and this slide answers that head on. Point out that the text stands on its own as teaching material for a new student, with no agent involved.

Timing: 10:00 to 11:30.

Transition: how many of these exist now.
-->

---

# Which codes are covered

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

**20** skills drive a specific code. **6** more: SFRESCO fitting, EXFOR retrieval, offline corpus search, two personal research wikis, and one that sets FUSION up. **26** in total.

</div>

<div class="fig-caption" style="line-height:1.8">
Admission has exactly three criteria, stated in CLAUDE.md: publicly obtainable, builds from source on the target platform, and has a published paper.<br><br>A skill ships only with an honest benchmark tier.
</div>

</div>

<!--
Central message: coverage is organised by physics area, and admission has a bar.

What to say: do not read the table. Pick two codes from whatever the audience actually works on.

Consistency reminder: 20 means code skills, 26 means all skills. Never mix the two in one sentence.

Timing: 11:30 to 12:30.

Transition: there is a question everyone asks at this point.
-->

---

# Not tied to one agent, or to one model

<div class="grid grid-cols-2 gap-8 mt-8">

<div>

<div class="ui-label">All three common agents load them</div>

<div class="mt-4" style="font-size:0.92rem">

| Agent | Entry | Status |
|---|---|---|
| opencode | `SKILL.md` | verified, zero config |
| Claude Code | `SKILL.md` | verified |
| Codex | `AGENTS.md` | format only, not tested end to end |

</div>

<div class="fig-caption" style="margin-top:16px">Skills are directories, not plugins, so porting costs almost nothing.</div>

</div>

<div>

<div class="box-idea">

The base is opencode, so it runs on whatever model you can reach: **DeepSeek, Qwen, GLM**, as readily as Claude or GPT.

</div>

<div class="kami-card" style="margin-top:22px">
<div class="ui-label">The Phase 0 acceptance test ran on one of those</div>
<div style="margin-top:10px; font-size:0.95rem; line-height:1.8">
On deepseek-chat, independently author a FRESCO deck for n+<sup>90</sup>Zr elastic scattering. It agrees with the reference calculation to <b>4 to 5 significant figures</b>.
</div>
</div>

</div>

</div>

<!--
Central message: no dependence on any one vendor's model, and the acceptance test was run on an open Chinese model.

What to say: answer this before anyone asks. The deeper point is that externalising the domain knowledge into the skill lowers the demand on the model rather than raising it.

Timing: 12:30 to 13:30.

Transition: enough description. Let me run it.
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
Central message: one sentence of natural language covers seven jobs: find the parameters, write the deck, compile, run, parse, find the data, plot.

What to say: read the sentence out loud, pause for two seconds, then switch. Let the audience notice that it contains no filename, no path, and no parameter.

Demo notes: check the terminal font size before switching. If nothing substantive happens within 30 seconds, cut to the recording. Do not explain and do not apologise.

Timing: 13:30 to 24:00, ten and a half minutes. The figure slide follows immediately.

Transition: afterwards, come back and say that the interesting part was not that it ran, but what it did after it ran.
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

If the demo fails: cut to the recording, say "the network is not cooperating, here is the edited version" and move on. Do not debug live.

Four beats to call out while it runs:
1. It sources the KD02 parameters from Koning's own kd02.f already on disk, rather than rewriting the formulas from memory
2. It emits ap=0
3. It runs a step-size and partial-wave convergence check
4. It queries EXFOR and reports that there is no measurement at 50 MeV
-->

---

# What the demo produced

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
Central message: the demo produced more than a curve. It also produced the sentence "there is no data here".

What to say: describe the figure first, zero free parameters, neither energy fitted. Then move to the third card: the task named 50 MeV, EXFOR has nothing at 50 MeV, so it recomputed at the two energies that do have measurements and reported the gap as part of the answer.

That is what someone doing research would do at this step: hand back the absence as a result rather than quietly substituting the nearest energy. Hold this slide an extra ten seconds.

Timing: 24:00 to 25:30, immediately after the demo.

Transition: which leaves the question of why you should believe that green curve.
-->

---
layout: section
---

# 4. Why you should believe it

<!--
Timing: 25:30.

This part is the academic centre of the talk. Everything before it was about convenience; everything from here is about trust. If you are short on time, cut part five, not this.
-->

---

# Two tiers of evidence, declared on every skill

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">Tier 1　14 skills</div>
<div style="margin-top:12px; font-size:0.97rem; line-height:1.85">
The code's own distribution ships reference values or a test suite, and the skill reproduces them.<br><br>
Several do so <b>byte for byte</b>, not "within uncertainty".
</div>
</div>

<div class="kami-card">
<div class="ui-label">Tier 2　6 skills</div>
<div style="margin-top:12px; font-size:0.97rem; line-height:1.85">
The code ships no reference output at all. So something else pins it: cross-platform reproduction, a physics invariant, or an independent analytic solution.<br><br>
The evidence chain changes. Having none is not allowed.
</div>
</div>

</div>

<div class="box-idea mt-10">

The grading is public. Each skill states in its own `references/verification.md` which tier it is, what pinned it, what the tolerance is, and which failure modes are known.

</div>

<!--
Central message: credibility is graded, published, and checkable line by line, not asserted as "we tested it".

What to say: Tier 2 is the interesting column. Many codes ship no reference output, and the honest response is not to lower the bar but to change the evidence chain. Two concrete examples on the next slide.

Timing: 25:30 to 27:00.

Transition: an abstract grading scheme convinces nobody.
-->

---

# Two examples

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

<div class="fig-caption" style="margin-top:14px">The unpatched gcc build agreeing bit for bit with the patched clang build is what proves the patch changed portability, not physics.</div>

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

<div class="fig-caption" style="margin-top:14px">The −5.7% is written down as it stands. A reconstruction with no fit should carry a residual of that size; hiding it would be the problem.</div>

</div>

</div>

<!--
Central message: concrete benchmarks convince where a grading table does not, and the residuals are published.

What to say: spell out the CNOK argument, it is a clean piece of logic. Two patches were needed to compile on macOS. How do you prove the patches did not change the physics? Make the unpatched gcc build and the patched clang build agree bit for bit.

Volunteer the −5.7% rather than being asked about it. That is where trust is built.

Timing: 27:00 to 29:00.

Transition: there is a stronger check available, using a second code.
-->

---

# Cross-check with a second solver

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

The two solvers are **structurally unrelated**: one is a complex-scaled Lagrange-Laguerre basis expansion, the other is Numerov integration on the real axis. They share no code, no discretisation, and no treatment of boundary conditions.

</div>

<div class="fig-caption" style="margin-top:18px; line-height:1.8">
So agreement to six figures rules out not rounding error, but implementation error on either side.
</div>

</div>

</div>

<!--
Central message: convergence shows the calculation is stable; independent implementations agreeing shows it is right.

What to say: this slide lands hardest with anyone who does numerics. A convergence study is a self-consistency check and can only exclude discretisation error. Only a structurally different solver excludes implementation error. The W = 0 line is a third, independent kind of evidence: a physics identity.

Timing: 29:00 to 30:30.

Transition: how deep does verification actually go? Here is one I did not expect.
-->

---

# How deep verification goes

<div class="box-gap mt-6">

Checking the KD02 parameterisation value by value against Koning's own `kd02.f`, CH89 matches to machine precision across the 39 pinned values, while **KD02 stops at about 7 digits**.

</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div v-click>

<div class="ui-label">The reason, found</div>

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
Which means <b>the more accurate of the two is the skill's implementation, and the residual belongs to the Fortran</b>.
<br><br>
At the three or four meaningful digits of a global potential this is irrelevant. But once written down, anything above 2×10⁻⁷ is a real bug.
</div>

</div>

</div>

<!--
Central message: chase a reference value all the way down and you find that the reference has a story of its own, which is exactly what tells you where to set the tolerance.

What to say: this is my favourite find in the project, so relax the delivery a little. It shows how far "reproduce the reference" goes when taken seriously. The conclusion matters more than the anecdote: because the origin of those seven digits is understood, the tolerance can be set at 2e-7, and anything above it is a genuine error.

For a numerics-minded audience, hold this slide an extra fifteen seconds.

Timing: 30:30 to 32:00.

Transition: there is one more layer, which is letting a second AI attack our own work.
-->

---

# Every skill is attacked by a second AI before it ships

<div class="fig-caption mt-4">An adversarial pass runs on each skill before release. It is not ceremony. Here is what it actually caught.</div>

<div class="grid grid-cols-3 gap-5 mt-8">

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">TALYS</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
<code>run_talys.sh</code> could <b>run a stale deck and report success</b>. With an empty source directory and a leftover workdir, the copy failed silently under <code>|| true</code>, TALYS ran the previous <code>talys.inp</code>, and it exited 0.
</div>
<div class="fig-caption" style="margin-top:12px">The exact class of false positive the skill exists to prevent, inside the skill's own harness.</div>
</div>

<div v-click class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">GiBUU</div>
<div style="margin-top:10px; font-size:0.9rem; line-height:1.75">
A selftest marker used a regex alternation (<code>non-numeric\|not finite</code>) inside a <code>case</code> statement, and <code>case</code> matches globs, not regexes.
<br><br>
<b>It could never fire.</b>
</div>
<div class="fig-caption" style="margin-top:12px">A test that has never failed and a test that does not exist are the same object.</div>
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
Central message: a verification system will also fool itself, so there has to be a layer whose only job is to attack it.

What to say: do not rush these three. They build more credibility than anything else in the talk because they are self-incriminating. Say the TALYS one plainly: this project exists to prevent false positives, and a false positive was sitting in its own script.

If someone asks who verifies the verifier: answer honestly that nobody does, which is why there are also cross-platform builds and physics identities. No single layer is sufficient.

Timing: 32:00 to 34:00.

Transition: cross-platform work produced an unexpected finding of its own.
-->

---

# Platform differences are evidence, not noise

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
<div class="ui-label">So the verifier changed its anchor</div>
<div style="margin-top:12px; font-size:0.95rem; line-height:1.85">
Platform-sensitive multiplicities are no longer treated as ground truth. The checks anchor on conservation laws instead.<br><br>
The same pass also caught an old rule that assigned baryon number zero to light-nucleus PDG codes.
</div>
</div>

<div class="fig-caption" style="margin-top:18px">104 of 104 tests pass on Linux.</div>

</div>

</div>

<div class="takeaway mt-8">Verified on one platform only, that 25% would have been written into the documentation as ground truth.</div>

<!--
Central message: building on two platforms is not engineering fastidiousness. It tells you which numbers are physics and which are implementation.

What to say: this example sharpens the question of what may serve as a benchmark at all. Multiplicities here are platform-dependent and disqualified; conservation laws are exact integers and qualify. That judgement is only available if you have run both platforms.

Timing: 34:00 to 35:30.

Transition: with all that said, one limitation matters more than the rest.
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
Central message: state the boundary of what this can do, and hand responsibility back.

What to say: deliver this in the plainest possible register, with nothing defensive in it. It removes tooling errors for you. It has not made a single physics judgement on your behalf.

This slide earns more trust with senior colleagues than everything before it combined.

Timing: 35:30 to 36:30.

Transition: that covers the codes. Now the other half, the literature.
-->

---
layout: section
---

# 5. The offline literature layer

<!--
Timing: 36:30. This part can be compressed if you are running late, but keep the map slide.
-->

---

# 61,167 pages, offline, read with grep

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="kami-card">
<div class="ui-label">The corpus</div>
<div style="margin-top:12px; font-size:0.95rem; line-height:1.85">
61,059 arXiv nucl-th papers, one page each, plus 108 topic pages, plus a citation layer and a semantic-relation layer.
<br><br>
No server, no API key, no network.
</div>
</div>

<div class="box-gap" style="margin-top:18px">

Those pages are machine-generated summaries and **they can be wrong**. Cite the paper, never the page.

</div>

</div>

<div>

<div class="ui-label">A real task, given one PDF</div>

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
Central message: the value of this layer is that it is offline and checkable, and its two limits belong on the same slide.

What to say: the rhythm here is capability, then boundary, immediately. Do not separate them and do not defer the limits to the end of the talk.

Timing: 36:30 to 38:30.

Transition: this corpus has one more form worth looking at.
-->

---
layout: center
---

<div style="text-align:center">
<img src="./figures/corpus-map.png" class="kami-img" style="max-height: 400px; margin: 0 auto" />
<div class="fig-caption" style="margin-top:14px">A citation projection of 55,850 papers. The terrain is a paper-density field, one dot is one paper with area proportional to citations inside the corpus, and the place names are PhySH topics.</div>
</div>

<!--
Central message: the corpus has structure, and the structure can be seen.

What to say: let them look for five seconds before saying anything. Then point at two regions they will recognise: where reaction theory sits, where lattice QCD sits.

Timing: 38:30 to 39:30.

Transition: one design decision in this figure is worth its own slide.
-->

---

# Not one citation edge is drawn

<div class="grid gap-8 mt-8" style="grid-template-columns: 1fr 1fr;">

<div>

<div class="box-idea">

The citation graph is used only as a **layout constraint**. The visible output is a density map.

</div>

<div style="margin-top:18px; font-size:0.93rem; line-height:1.85">
This is not an aesthetic choice. A citation network at this scale, drawn as a force-directed node-link diagram, degenerates into a hairball. That is a property of the objective function, and no amount of parameter tuning rescues it.
</div>

<div class="fig-caption" style="margin-top:16px; line-height:1.8">
The field avoids the full graph at this scale: Connected Papers draws only the ego graph of a seed paper, Open Knowledge Maps caps each map at 100 papers, VOSviewer renders about 100 nodes at the 100k scale. Paperscape, the one project that really does draw a whole corpus, takes exactly this no-edges route.
</div>

</div>

<div>

<div class="kami-card">
<div class="ui-label">Identity is carried by place names, not by colour</div>
<div style="margin-top:12px; font-size:0.92rem; line-height:1.8">
The five background regions come from clustering topic centroids and are only an aid. Five is the ceiling that passes an all-pairs contrast-accessibility check.
<br><br>
The names keep the figure readable in black-and-white print and under colour-vision deficiency, which is why it can go straight into a paper.
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
Central message: every design decision in this figure has a reason, and the reasons are checkable rather than matters of taste.

What to say: state the hairball point with confidence, it is a known property of force-directed layouts. The QCD example is the good one: a topic spread across the whole map is not a place, it is a language.

Timing: 39:30 to 41:00.

Transition: finally, what does not work yet.
-->

---

# What does not work yet

<div class="grid grid-cols-2 gap-6 mt-8">

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">Cold-start installs are the least tested part</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
Of the twenty codes, only FRESCO has been installed from a genuinely empty cache. Expect a missing dependency on another machine.
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">The first two commands fail on a mainland network</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
Measured on a university network on 2026-08-13: github.com answered 0 of 6 connection attempts and the clone died after 132 seconds. A proxy is needed. A mirror is the open problem.
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">Disk and platform</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
TALYS wants about 11 GB, 8.6 GB of it a structure database, so do not start with it. Windows is not built, and the macOS and Linux binaries are unsigned.
</div>
</div>

<div class="kami-card">
<div class="ui-label" style="color: var(--color-gap)">Exactly one person has used it</div>
<div style="margin-top:10px; font-size:0.92rem; line-height:1.8">
v0.1.0 is the first public build. It works and its author uses it daily, and nobody else has used it at all.
</div>
</div>

</div>

<div class="takeaway mt-12">What breaks on your machine is the thing this release is for.</div>

<!--
Central message: list the known potholes in one go rather than leaving people to find them.

What to say: this slide can go faster, but do not drop any of the four. The network one in particular will be the first thing most of this room hits.

Timing: 41:00 to 42:30.

Transition: so what is the report I most want.
-->

---

# The report worth the most

<div class="box-gap mt-10" style="max-width: 820px">

**A result that looked right and was wrong.**

</div>

<div style="max-width: 820px; margin-top: 22px; font-size:1rem; line-height:1.9">
The whole reason this project exists is that a general agent writes a plausible FRESCO deck with the wrong radius convention. If FUSION does something of that kind, send me the deck, the number, and what it should have been.
</div>

<div class="fig-caption" style="margin-top:20px; line-height:1.8">
It is the failure I fear most and the one least likely to be reported, because by definition it looks like a success.
</div>

<div class="grid grid-cols-3 gap-5 mt-10">
<div class="kami-card">
<div class="ui-label">Second</div>
<div style="margin-top:8px; font-size:0.92rem">A code that will not install, with the error, your OS, and your compiler</div>
</div>
<div class="kami-card">
<div class="ui-label">Third</div>
<div style="margin-top:8px; font-size:0.92rem">Anything that felt stupid</div>
</div>
<div class="kami-card">
<div class="ui-label">And</div>
<div style="margin-top:8px; font-size:0.92rem">Which code you wish had a skill</div>
</div>
</div>

<!--
Central message: define the most valuable kind of report explicitly, and lower the barrier to sending it.

What to say: emphasise the third one. Every awkward thing in the first-run flow was found by one person trying it and saying so plainly.

Timing: 42:30 to 43:30.

Transition: back to the question I opened with.
-->

---
layout: center
---

<div style="text-align:center">
<div class="fusion-mark" style="font-size:2.4rem; margin-bottom:34px">FU <span style="letter-spacing:-0.04em"><span style="color:#2f7fb8">&#9656;</span><span style="color:#c8791a">&#9666;</span></span> SION</div>

<div style="max-width: 780px; margin: 0 auto">

<div class="box-idea">

The hard step in running a nuclear-physics code was never getting it to run. It was knowing that it ran correctly.

</div>

<p style="margin-top: 30px; font-size:1rem; line-height:1.9">That has always been solved by knowledge passed around inside one group by word of mouth.<br>It can now be written down, checked, and taken further by someone else.</p>

</div>

<div style="margin-top: 40px">
<span class="meta">github.com/jinleiphys/FUSION　·　vibeinscience.com　·　MIT　·　jinl@tongji.edu.cn</span>
</div>

</div>

<!--
Central message: lift the contribution from tooling to method, and stop.

What to say: do not restate the skill count or the corpus size. Make one point: this kind of knowledge used to live only in a group's oral tradition, and it disappeared whenever someone changed field or graduated. Now it has a form that can be inspected and inherited.

If there is time, add: that is also why it is open. Something only I can verify does not deserve to be called verified.

Timing: 43:30 to 45:00, then questions.
-->

---
layout: section
---

# Backup

---

# Every check run on n+<sup>90</sup>Zr

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

**1301.640 and 1299.19 are not comparable.** Two runs, different configurations: the first is the end-to-end result for the full KD02 potential, the second pair is two solvers checked against each other in one common configuration. Each row answers its own question. No row is ground truth for the others.

</div>

<!--
This slide exists to answer one question: someone who has read the project website will have seen 1301.640 mb given as the final result, while slide 19 shows the 1299.19 pair.

The answer: these are two different checks, not two versions of one number. The generator-versus-hand-built row proves omp.py wrote the deck correctly. The COLOSS-versus-FRESCO row proves two independent implementations agree. The two runs use different configurations, so the numbers should not match.

If pressed on where the difference comes from: COLOSS's own cross-code benchmark procedure turns the spin-orbit term off, its verification.md states vsov=0.0, because that is the configuration in which the two codes are directly comparable. And 0.19% is the right order for the spin-orbit contribution to a total reaction cross section.

Do not present that as a verified conclusion.
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

# Install and network

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

Both commands need GitHub and usually fail on a mainland-China network. Nothing after them touches the network: codes are fetched from their own upstreams on first use, and the corpus is already in the clone.

</div>

<div class="fig-caption" style="line-height:1.8">
The clone is about 229 MB, nearly all of it the knowledge base. For the skills without the corpus, skip the clone and point the agent at the skills directory URL instead.<br><br>
Requirements: git, make, gfortran, a C++ compiler, python3. Individual skills pull their own extra dependencies and say so first.
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

Both steps are in the fusion-web repository and can be reproduced directly: `scripts/kb_citemap.py` and `scripts/kb_citemap_render.py`.

</div>

---

# If asked: how is this different from a general coding assistant

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="kami-card">
<div class="ui-label">General assistant</div>
<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
· Knowledge comes from training data and cannot be reviewed or edited<br>
· No benchmark, so no way to judge this particular output<br>
· Every conversation starts from zero; corrections do not accumulate<br>
· Confidence is uncorrelated with correctness
</div>
</div>

<div class="kami-card kami-card-accent">
<div class="ui-label">A skill</div>
<div style="margin-top:12px; font-size:0.93rem; line-height:1.85">
· Knowledge is Markdown in a repository: readable, auditable, patchable<br>
· Each skill carries one known answer and a stated tolerance<br>
· A trap found once is written down and everyone gets it<br>
· The tier and the known failure modes are declared up front
</div>
</div>

</div>

<div class="takeaway mt-10">The difference is not the model. It is where the knowledge lives, and whether anyone is accountable for it being right.</div>
