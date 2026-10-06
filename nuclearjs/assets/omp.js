/* ------------------------------------------------------------------ *
 * Elastic scattering of n, p, d and alpha on a spin-0 nucleus in a complex
 * optical potential.
 *
 * Potentials (each transcribed from a source that was read, see below):
 *   n, p   Koning-Delaroche, Nucl. Phys. A 713, 231 (2003), transcribed from
 *          FUSION/skills/fresco/scripts/omp.py, pinned to Koning's kd02.f;
 *          OMP.kd02SelfTest() re-checks the same reference table.
 *   d      Han, Shi, Shen, Phys. Rev. C 74, 044615 (2006), Eqs. (1)-(13) and Table I.
 *   alpha  Avrigeanu, Avrigeanu, Manailescu, Phys. Rev. C 90, 044612 (2014), Table II
 *          (arXiv:1406.1656v2 source).
 *   U(r) = -V f_V - i W f_W + 4 i a_D W_D f_D' + Vc(r)
 *          + (V_so + i W_so) lso^2 (1/r) f_so' [j(j+1) - l(l+1) - s(s+1)]   (lso^2 = 2 fm^2)
 * f = Woods-Saxon, R = r A_target^(1/3), uniform-sphere Coulomb with rc.
 *
 * Kinematics: relativistic by default (ECIS / FRESCO RELA='c' prescription, see
 * kinematics()), non-relativistic on request; masses in amu.
 *
 * Numerics: Numerov for each (l, j) on a uniform grid, matched at two outer
 * points to Coulomb functions F_l, G_l from Steed's method (CF1 + CF2,
 * Barnett), which reduce to Riccati-Bessel functions for neutrons.
 * tests/check_omp.py benchmarks all of it against FRESCO.
 * Plain script: window.OMP in a browser, module.exports in Node.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var HBARC = 197.3269804, E2 = 1.439964547, AMU = 931.49410242;
  var MP = 1.007276467, MN = 1.008664916;      // proton, neutron masses in amu
  var MD = 2.013553213, MA = 4.001506179;      // deuteron, alpha (nuclear) masses in amu, CODATA 2018
  var LSO2 = 2.0;                               // (hbar / m_pi c)^2 in fm^2, the FRESCO/ECIS convention

  // ---------- KD02, verbatim from omp.py (k0 = 1 neutron, 2 proton)
  function kd02(k0, Z, A, E) {
    var N = A - Z, p = {};
    var rv = 1.3039 - 0.4054 * Math.pow(A, -1 / 3), av = 0.6778 - 1.487e-4 * A;
    var v4 = 7.0e-9, w2 = 73.55 + 0.0795 * A;
    var rvd = 1.3424 - 0.01585 * Math.cbrt(A);
    var d2 = 0.0180 + 3.802e-3 / (1.0 + Math.exp((A - 156.0) / 8.0)), d3 = 11.5;
    var vso1 = 5.922 + 0.0030 * A, vso2 = 0.0040;
    var rvso = 1.1854 - 0.647 * Math.pow(A, -1 / 3), avso = 0.59;
    var wso1 = -3.1, wso2 = 160.0;
    var ef, v1, v2, v3, w1, d1, avd, rc;
    if (k0 === 1) {
      ef = -11.2814 + 0.02646 * A;
      v1 = 59.30 - 21.0 * (N - Z) / A - 0.024 * A;
      v2 = 7.228e-3 - 1.48e-6 * A; v3 = 1.994e-5 - 2.0e-8 * A;
      w1 = 12.195 + 0.0167 * A; d1 = 16.0 - 16.0 * (N - Z) / A;
      avd = 0.5446 - 1.656e-4 * A; rc = 0.0;
    } else {
      ef = -8.4075 + 0.01378 * A;
      v1 = 59.30 + 21.0 * (N - Z) / A - 0.024 * A;
      v2 = 7.067e-3 + 4.23e-6 * A; v3 = 1.729e-5 + 1.136e-8 * A;
      w1 = 14.667 + 0.009629 * A; avd = 0.5187 + 5.205e-4 * A;
      d1 = 16.0 + 16.0 * (N - Z) / A;
      rc = 1.198 + 0.697 * Math.pow(A, -2 / 3) + 12.994 * Math.pow(A, -5 / 3);
    }
    var f = E - ef;
    var vcoul = 0;
    if (k0 === 2) { var Vc = 1.73 / rc * Z / Math.cbrt(A); vcoul = Vc * v1 * (v2 - 2.0 * v3 * f + 3.0 * v4 * f * f); }
    p.V = v1 * (1.0 - v2 * f + v3 * f * f - v4 * f * f * f) + vcoul; p.rv = rv; p.av = av;
    p.W = w1 * f * f / (f * f + w2 * w2); p.rw = rv; p.aw = av;
    p.Wd = d1 * f * f * Math.exp(-d2 * f) / (f * f + d3 * d3); p.rwd = rvd; p.awd = avd;
    p.Vso = vso1 * Math.exp(-vso2 * f); p.rso = rvso; p.aso = avso;
    p.Wso = wso1 * f * f / (f * f + wso2 * wso2); p.rwso = rvso; p.awso = avso;
    p.rc = rc; p.Ef = ef;
    return p;
  }
  // reference values from omp.py REF (pinned against kd02.f at 2e-7 relative)
  var KD02_REF = [
    [1, 40, 90, 50.0, { V: 3.52745232840509e1, rv: 1.21343729971235, av: 6.64416999963578e-1, W: 4.76045094564224, Wd: 3.79359457368308, rwd: 1.27136968601378, awd: 5.29696010373300e-1, Vso: 4.89227835015655, rso: 1.04102563940947, Wso: -3.69963635034609e-1 }],
    [1, 6, 12, 100.0, { V: 2.55477975284590e1, W: 8.54376405860909, Wd: 1.40870504651899, Vso: 3.82240307783717, Wso: -1.00678559902166 }],
    [2, 40, 90, 50.0, { V: 4.16495727992617e1, W: 5.18999382890647, Wd: 4.91344329353643, awd: 5.65545004094020e-1, Vso: 4.92630351911307, rc: 1.23989500249849 }],
    [2, 82, 208, 25.0, { V: 5.33598902967944e1, W: 1.71846316737771, Wd: 9.79598258672243, rc: 1.21963389857862 }],
    [2, 20, 40, 65.0, { V: 3.51067049083420e1, W: 7.13654881513690, Wd: 3.18854959228917, rc: 1.28536690319541 }],
  ];
  function kd02SelfTest() {
    var worst = 0;
    KD02_REF.forEach(function (c) {
      var p = kd02(c[0], c[1], c[2], c[3]);
      for (var k in c[4]) worst = Math.max(worst, Math.abs(p[k] - c[4][k]) / Math.max(1e-12, Math.abs(c[4][k])));
    });
    return worst;
  }

  /* ---------- deuteron: Han, Shi, Shen, PRC 74, 044615 (2006). Eqs. (2)-(13), Table I; E = deuteron lab energy.
     Eq. (5),(6) write the spin-orbit term with L.S, so it enters the 2 l.s form used here as V_SO/2, W_SO/2.
     (hbar/m_pi c)^2 is not given numerically in the paper; 2.0 fm^2 is used, as everywhere here.
     Eq. (7) prints 0.7720448 Z_d Z / R_C (3 - r^2/R_C^2) inside and 1.440975 Z_d Z / r outside: the two
     do not join at R_C (1.440975/2 = 0.7204875), so the continuous uniform sphere with this file's e^2 is used.
     Eq. (9) has no floor: for N > Z W_D turns negative (emissive) above roughly 150 MeV on 208Pb; kept as printed. */
  function hss06(Z, A, E) {
    var N = A - Z, a13 = Math.cbrt(A), I = (N - Z) / A;
    return {
      V: 82.18 - 0.148 * E - 0.000886 * E * E - 34.811 * I + 1.058 * Z / a13, rv: 1.174, av: 0.809,
      W: Math.max(0, -4.916 + 0.0555 * E + 0.0000442 * E * E + 35.0 * I), rw: 1.563, aw: 0.700 + 0.045 * a13,
      Wd: 20.968 - 0.0794 * E - 43.398 * I, rwd: 1.328, awd: 0.465 + 0.045 * a13,
      Vso: 3.703 / 2, rso: 1.234, aso: 0.813, Wso: -0.206 / 2, rwso: 1.234, awso: 0.813,
      rc: 1.698,
    };
  }
  /* ---------- alpha: Avrigeanu, Avrigeanu, Manailescu, PRC 90, 044612 (2014), Table II, for 45 <= A <= 209,
     E < 50 MeV (lab). The table prints no floor on W_V and W_D; both are clipped at 0 here (TALYS's alphaomp 6
     does the same), since the linear forms go negative outside the fitted window. No spin-orbit (spin 0). */
  function avr14(Z, A, E) {
    var a13 = Math.cbrt(A), za = Z / a13;
    var E2 = (2.59 + 10.4 / A) * Z / (2.66 + 1.36 * a13), E1 = -3.03 - 0.762 * a13 + 1.24 * E2;
    var E3 = 22.2 + 0.181 * za, E4 = 29.1 - 0.22 * za;
    var V = E <= E3 ? 165 + 0.733 * za - 2.64 * E : 116.5 + 0.337 * za - 0.453 * E;
    var rv = E <= 25 ? 1.18 + 0.012 * E : 1.48;
    var av = E <= E2 ? 0.631 + (0.016 - 0.001 * E2) * za : E <= E4 ? 0.631 + 0.016 * za - 0.001 * za * E
      : 0.684 - 0.016 * za - (0.0026 - 0.00026 * za) * E;
    var Wd = E <= E1 ? 4 : E <= E2 ? 22.2 + 4.57 * a13 - 7.446 * E2 + 6 * E : 22.2 + 4.57 * a13 - 1.446 * E;
    var rwd = (A <= 152 || A >= 190) ? 1.52 : Math.max(1.74 - 0.01 * E, 1.52);
    return {
      V: V, rv: rv, av: av, W: Math.max(0, 2.73 - 2.88 * a13 + 1.11 * E), rw: 1.34, aw: 0.50,
      Wd: Math.max(0, Wd), rwd: rwd, awd: 0.729 - 0.074 * a13,
      Vso: 0, rso: 1, aso: 1, Wso: 0, rwso: 1, awso: 1, rc: 1.3,
    };
  }
  // projectiles: mass (amu), charge, spin, global potential
  var PROJ = {
    n: { m: MN, Z: 0, s: 0.5, pot: 'kd02', name: 'neutron' },
    p: { m: MP, Z: 1, s: 0.5, pot: 'kd02', name: 'proton' },
    d: { m: MD, Z: 1, s: 1, pot: 'hss06', name: 'deuteron' },
    a: { m: MA, Z: 2, s: 0, pot: 'avr14', name: 'alpha' },
  };
  // published fit ranges (target A, lab energy in MeV); outside them the formulas are extrapolated.
  // KD02: FIT_RANGE in omp.py. HSS06: abstract, 12 <= A <= 209, threshold to 200 MeV.
  // AVR14: Table II caption, 45 <= A <= 209, E < 50 MeV.
  var POT = {
    kd02: { A: [24, 209], E: [0.001, 200], label: 'Koning-Delaroche (KD02)', cite: 'Nucl. Phys. A 713, 231 (2003)' },
    hss06: { A: [12, 209], E: [0, 200], label: 'Han-Shi-Shen', cite: 'Phys. Rev. C 74, 044615 (2006)' },
    avr14: { A: [45, 209], E: [0, 50], label: 'Avrigeanu et al.', cite: 'Phys. Rev. C 90, 044612 (2014)' },
  };
  function potential(proj, Z, A, E) {
    if (proj === 'n') return kd02(1, Z, A, E);
    if (proj === 'p') return kd02(2, Z, A, E);
    if (proj === 'd') return hss06(Z, A, E);
    if (proj === 'a') return avr14(Z, A, E);
    throw new Error('unknown projectile ' + proj);
  }
  function fitRange(proj, A, E) {
    var f = POT[PROJ[proj].pot], w = [];
    if (A < f.A[0] || A > f.A[1]) w.push('A');
    if (E < f.E[0] || E > f.E[1]) w.push('E');
    return { ok: !w.length, out: w, range: f };
  }

  // ---------- complex arithmetic on [re, im]
  function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function cdiv(a, b) { var d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }

  /* ---------- Coulomb functions F_l, G_l and derivatives, l = 0..lmax, at rho (Steed's method)
     Recurrences (Abramowitz & Stegun 14.2): with R_L = sqrt(1 + eta^2/L^2), S_L = L/rho + eta/L,
       u'_L = R_L u_{L-1} - S_L u_L,   u'_{L-1} = S_L u_{L-1} - R_L u_L.
     CF1 gives F'_lmax / F_lmax, F is recurred down (unnormalized), CF2 gives
     H+'/H+ = p + i q at L = 0 with a = 1 + i eta, c = i eta, the Wronskian F'G - FG' = 1 fixes the scale,
     and G is recurred up. */
  function coulomb(eta, rho, lmax) {
    var L, it;
    // CF1 and the downward recursion start at Ls >= lmax beyond the classical turning point
    // (rho < eta + sqrt(eta^2 + Ls(Ls+1))), where F_Ls has no nodes and is positive, so the seed +tiny has the
    // right sign. Seeding at an lmax below the turning point flips every F_L and G_L when F_lmax < 0 there.
    var tiny = 1e-300;
    function S(L) { return L / rho + eta / L; }
    function R2(L) { return 1 + eta * eta / (L * L); }
    var Ls = Math.max(lmax, Math.ceil(Math.sqrt(Math.max(0, rho * (rho - 2 * eta)))) + 2);
    var f = S(Ls + 1), C = f, D = 0;
    if (f === 0) f = C = tiny;
    for (it = 1; it < 100000; it++) {
      var Lk = Ls + it;
      var a = -R2(Lk), b = S(Lk) + S(Lk + 1);
      D = b + a * D; if (D === 0) D = tiny; D = 1 / D;
      C = b + a / C; if (C === 0) C = tiny;
      var del = C * D; f *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    if (it >= 100000) throw new Error('coulomb: CF1 did not converge');
    // f is F'_Ls/F_Ls; recur F down to 0
    var F = new Float64Array(Ls + 1), Fp = new Float64Array(Ls + 1);
    F[Ls] = 1e-200; Fp[Ls] = f * F[Ls];
    for (L = Ls; L >= 1; L--) {
      var RL = Math.sqrt(R2(L)), SL = S(L);
      F[L - 1] = (SL * F[L] + Fp[L]) / RL;
      Fp[L - 1] = SL * F[L - 1] - RL * F[L];
      if (Math.abs(F[L - 1]) > 1e200) { for (var s = L - 1; s <= Ls; s++) { F[s] *= 1e-200; Fp[s] *= 1e-200; } }
    }
    if (Ls > lmax) { F = F.slice(0, lmax + 1); Fp = Fp.slice(0, lmax + 1); }
    // CF2 at L = 0: H'/H = i(1 - eta/rho) + (i/rho) * ac / (2(rho - eta + i) + (a+1)(c+1) / (2(rho - eta + 2i) + ...))
    var pq = cf2(eta, rho);
    var p = pq[0], q = pq[1];
    var f0 = Fp[0] / F[0], gam = (f0 - p) / q;
    var F0 = (F[0] < 0 ? -1 : 1) / Math.sqrt(q * (1 + gam * gam));
    var scale = F0 / F[0];
    var G = new Float64Array(lmax + 1), Gp = new Float64Array(lmax + 1);
    for (L = 0; L <= lmax; L++) { F[L] *= scale; Fp[L] *= scale; }
    G[0] = gam * F[0]; Gp[0] = (p * gam - q) * F[0];
    for (L = 1; L <= lmax; L++) {
      var RL2 = Math.sqrt(R2(L)), SL2 = S(L);
      G[L] = (SL2 * G[L - 1] - Gp[L - 1]) / RL2;
      Gp[L] = RL2 * G[L - 1] - SL2 * G[L];
    }
    return { F: F, Fp: Fp, G: G, Gp: Gp };
  }
  // continued fraction for H+'/H+ at L = 0, evaluated by complex modified Lentz
  function cf2(eta, rho) {
    var tiny = 1e-300;
    var a = [1, eta], c = [0, eta];                     // a = 1 + i eta, c = i eta
    // term_k: numerator (a+k)(c+k), denominator 2(rho - eta + (k+1) i)
    var b0 = [2 * (rho - eta), 2];
    var num0 = cmul(a, c);
    // value = num0 / (b0 + num1/(b1 + ...)), Lentz on the fraction t = b0 + num1/(b1 + ...)
    var fr = b0.slice(), Cc = fr.slice(), Dd = [0, 0], k;
    for (k = 1; k < 200000; k++) {
      var nk = cmul([a[0] + k, a[1]], [c[0] + k, c[1]]);
      var bk = [2 * (rho - eta), 2 * (k + 1)];
      Dd = [bk[0] + nk[0] * Dd[0] - nk[1] * Dd[1], bk[1] + nk[0] * Dd[1] + nk[1] * Dd[0]];
      if (Dd[0] === 0 && Dd[1] === 0) Dd = [tiny, 0];
      Dd = cdiv([1, 0], Dd);
      Cc = [bk[0] + cdiv(nk, Cc)[0], bk[1] + cdiv(nk, Cc)[1]];
      if (Cc[0] === 0 && Cc[1] === 0) Cc = [tiny, 0];
      var del = cmul(Cc, Dd);
      fr = cmul(fr, del);
      if (Math.abs(del[0] - 1) + Math.abs(del[1]) < 1e-16) break;
    }
    if (k >= 200000) throw new Error('coulomb: CF2 did not converge (rho too small for this eta)');
    var t = cdiv(num0, fr);                            // ac / (...)
    // (i/rho) * t
    var it_ = [-t[1] / rho, t[0] / rho];
    return [it_[0], 1 - eta / rho + it_[1]];
  }

  // Coulomb phase shifts sigma_l = arg Gamma(l + 1 + i eta)
  function lgammaComplex(x, y) {                       // ln Gamma(x + i y), Lanczos g=7, x > 0.5
    var g = 7, cf = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    x -= 1;
    var sr = cf[0], si = 0;
    for (var i = 1; i < 9; i++) { var dr = x + i, d = dr * dr + y * y; sr += cf[i] * dr / d; si -= cf[i] * y / d; }
    var tr = x + g + 0.5, ti = y;
    // (z+0.5) ln t - t + ln sqrt(2pi) + ln s, with z = x + i y
    var lnt = [0.5 * Math.log(tr * tr + ti * ti), Math.atan2(ti, tr)];
    var zr = x + 0.5, zi = y;
    var re = zr * lnt[0] - zi * lnt[1] - tr + 0.5 * Math.log(2 * Math.PI) + 0.5 * Math.log(sr * sr + si * si);
    var im = zr * lnt[1] + zi * lnt[0] - ti + Math.atan2(si, sr);
    return [re, im];
  }
  function coulombPhases(eta, lmax) {
    var s = new Float64Array(lmax + 1);
    s[0] = lgammaComplex(1, eta)[1];
    for (var l = 1; l <= lmax; l++) s[l] = s[l - 1] + Math.atan2(eta, l);
    return s;
  }

  /* ---------- Clebsch-Gordan <j1 m1 j2 m2 | J M>, all arguments doubled (integers), Racah formula
     in log-factorials so that l of a few hundred is fine */
  var LF = [0];
  function lfact(n) { for (var i = LF.length; i <= n; i++) LF.push(LF[i - 1] + Math.log(i)); return LF[n]; }
  function cg(j1, m1, j2, m2, J, M) {
    if (m1 + m2 !== M || J < Math.abs(j1 - j2) || J > j1 + j2 || Math.abs(m1) > j1 || Math.abs(m2) > j2 || Math.abs(M) > J) return 0;
    if ((j1 + j2 + J) % 2 || (j1 + m1) % 2 || (j2 + m2) % 2 || (J + M) % 2) return 0;
    var a = (j1 + j2 - J) / 2, b = (j1 - j2 + J) / 2, c = (-j1 + j2 + J) / 2;
    var pre = 0.5 * (Math.log(J + 1) + lfact(a) + lfact(b) + lfact(c) - lfact((j1 + j2 + J) / 2 + 1)
      + lfact((j1 + m1) / 2) + lfact((j1 - m1) / 2) + lfact((j2 + m2) / 2) + lfact((j2 - m2) / 2) + lfact((J + M) / 2) + lfact((J - M) / 2));
    var s = 0;
    for (var k = 0; k < 1000; k++) {
      var d1 = a - k, d2 = (j1 - m1) / 2 - k, d3 = (j2 + m2) / 2 - k, d4 = (J - j2 + m1) / 2 + k, d5 = (J - j1 - m2) / 2 + k;
      if (d1 < 0 || d2 < 0 || d3 < 0) break;
      if (d4 < 0 || d5 < 0) continue;
      s += (k % 2 ? -1 : 1) * Math.exp(pre - lfact(k) - lfact(d1) - lfact(d2) - lfact(d3) - lfact(d4) - lfact(d5));
    }
    return s;
  }

  /* ---------- kinematics
     'nr'  : mu = m1 m2/(m1+m2), E_cm = E_lab m2/(m1+m2), k^2 = 2 mu E_cm / hbar^2.
     'rel' : the prescription of ECIS (routines lecl and khco, lo(8) with lo(95), the flags TALYS sets
             with its default `relativistic y`; this is also FRESCO 3.x RELA='c'):
               s = (m1+m2)^2 + 2 m2 E_lab,  hbar^2 k^2 = m2^2 E_lab (E_lab + 2 m1) / s   (exact c.m. momentum)
               mu -> E1 E2/(E1+E2), the reduced total energy, E_i the c.m. total energies,
             in front of the nuclear and the Coulomb potential (so also in eta). The radial equation is
               u'' + [k^2 - (2 mu_rel/hbar^2) U(r) - l(l+1)/r^2] u = 0.
     Masses in amu, rest energies m*amu. Returns {k, mu (MeV, the one multiplying U), Ecm (kinetic, MeV), Eeff = hbar^2 k^2/(2 mu)}. */
  function kinematics(m1, m2, E, kin, amu, hbarc) {
    var M1 = m1 * amu, M2 = m2 * amu, k, mu, Ecm;
    if (kin === 'rel') {
      var s = (M1 + M2) * (M1 + M2) + 2 * M2 * E, W = Math.sqrt(s);
      k = Math.sqrt(M2 * M2 * E * (E + 2 * M1) / s) / hbarc;
      var E1 = (s + M1 * M1 - M2 * M2) / (2 * W), E2 = (s - M1 * M1 + M2 * M2) / (2 * W);
      mu = E1 * E2 / W; Ecm = W - M1 - M2;
    } else {
      mu = M1 * M2 / (M1 + M2); Ecm = E * M2 / (M1 + M2);
      k = Math.sqrt(2 * mu * Ecm) / hbarc;
    }
    return { k: k, mu: mu, Ecm: Ecm, Eeff: hbarc * hbarc * k * k / (2 * mu) };
  }

  /* ---------- the calculation
     opt: { proj: 'n'|'p'|'d'|'a', Z, A, E (lab MeV), mt (target mass amu, default A), mp (projectile mass,
            default PROJ), lmax (auto),
            kin: 'rel' (default) | 'nr', P (potential, default the global set of this projectile),
            scaleW (multiplies all imaginary parts), so (0/1 spin-orbit), h (fm), rmatch (fm), rplot (fm),
            wave (default true: keep the field-weighted radial waves for fieldCoeffs) }
     Spin-orbit, all spins: U_so = (V_so + i W_so) lso^2 (1/r) df/dr [j(j+1) - l(l+1) - s(s+1)], i.e. the
     FRESCO TYPE=3 form factor times 2 l.s; potentials written with l.s (the deuteron set) enter with V_so/2. */
  function solve(opt) {
    var proj = opt.proj, Zt = opt.Z, At = opt.A, E = opt.E, pr = PROJ[proj];
    var mp = opt.mp || pr.m, mt = opt.mt || At, Zp = pr.Z, s2 = Math.round(2 * pr.s);
    var P = opt.P || potential(proj, Zt, At, E);
    var scaleW = opt.scaleW == null ? 1 : opt.scaleW, so = opt.so == null ? 1 : opt.so;
    // physical constants, overridable so a benchmark can use another code's values exactly
    var hbarc = opt.hbarc || HBARC, e2 = opt.e2 || E2, amu = opt.amu || AMU;
    var kin = opt.kin || 'rel';
    var K = kinematics(mp, mt, E, kin, amu, hbarc);
    var k = K.k, mu = K.mu;
    var eta = Zp * Zt * e2 * mu / (hbarc * hbarc * k);   // Coulomb with the same mu_rel as the nuclear part (ECIS lo(96) = F)
    var C = hbarc * hbarc / (2 * mu);                  // hbar^2/2mu, MeV fm^2
    var Eeff = K.Eeff;
    var A13 = Math.cbrt(At);
    var Rv = P.rv * A13, Rw = P.rw * A13, Rd = P.rwd * A13, Rso = P.rso * A13, Rwso = P.rwso * A13, Rc = (P.rc || 1.2) * A13;
    // Numerov step: 0.05 fm, finer at high energy so kh <= 0.05 (at 100 MeV, h = 0.05 gives
    // 1e-5 S-matrix errors and percent-level errors at back angles; tests/check_omp.py)
    var h = opt.h || Math.min(0.05, 0.05 / k);
    var Rmax = Math.max(Rv, Rw, Rd, Rso);
    var amax = Math.max(P.av, P.aw, P.awd);
    var rmatch = opt.rmatch || Math.max(Rmax + 12 * amax, (2 * eta + 6) / k, 15);
    var lmax = opt.lmax != null ? opt.lmax : Math.ceil(k * (Rmax + 8) + 8);
    var rplot = Math.max(rmatch, opt.rplot || 0);
    var n = Math.ceil(rplot / h), im = Math.round(rmatch / h);
    var keepWave = opt.wave !== false;
    var r = new Float64Array(n + 1);
    for (var i = 0; i <= n; i++) r[i] = i * h;
    // Woods-Saxon f = 1/(1 + e^t), t = (x - R)/a, and df/dx = -f(1 - f)/a, both written so that no
    // exponential overflows: on the long Coulomb grids (alpha + 208Pb at 1 MeV, rmatch 255 fm) e^t reaches
    // Infinity and e^t/(1 + e^t)^2 became Inf/Inf = NaN
    function ws(x, R, a) { var t = (x - R) / a; if (t > 0) { var e = Math.exp(-t); return e / (1 + e); } return 1 / (1 + Math.exp(t)); }
    function dws(x, R, a) { return -ws(x, R, a) * ws(2 * R - x, R, a) / a; }   // 1 - f(t) = f(-t)
    // central (complex) and spin-orbit radial forms
    var Ur = new Float64Array(n + 1), Ui = new Float64Array(n + 1), SOr = new Float64Array(n + 1), SOi = new Float64Array(n + 1);
    for (i = 1; i <= n; i++) {
      var x = r[i];
      var vc = Zp ? (x < Rc ? Zp * Zt * e2 / (2 * Rc) * (3 - x * x / (Rc * Rc)) : Zp * Zt * e2 / x) : 0;
      Ur[i] = -P.V * ws(x, Rv, P.av) + vc;
      Ui[i] = scaleW * (-P.W * ws(x, Rw, P.aw) + 4 * P.awd * P.Wd * dws(x, Rd, P.awd));
      if (s2) {
        SOr[i] = so * P.Vso * LSO2 * dws(x, Rso, P.aso) / x;
        SOi[i] = so * scaleW * P.Wso * LSO2 * dws(x, Rwso, P.awso) / x;
      }
    }
    var cou1 = coulomb(eta, k * r[im - 1], lmax), cou2 = coulomb(eta, k * r[im], lmax);
    var sig = coulombPhases(eta, lmax);
    // the wave shown is the spin-non-flip component for the largest projection m = s along the beam;
    // its partial wave l carries the weight (2l+1) |<l 0 s s|j s>|^2 for each j
    var S = [], ul = [];
    var h2 = h * h / 12;
    var kr = new Float64Array(n + 1), ki = new Float64Array(n + 1), uR = new Float64Array(n + 1), uI = new Float64Array(n + 1);
    for (var l = 0; l <= lmax; l++) {
      var Sl = [], wr = keepWave ? new Float64Array(n + 1) : null, wi = keepWave ? new Float64Array(n + 1) : null;
      for (var kk = 0; kk <= s2; kk++) {
        var j2 = 2 * l - s2 + 2 * kk;                   // 2j, j = l - s + kk
        if (j2 < Math.abs(2 * l - s2)) { Sl.push(null); continue; }
        var X = (j2 * (j2 + 2) - s2 * (s2 + 2)) / 4 - l * (l + 1);     // j(j+1) - l(l+1) - s(s+1) = 2 l.s
        // k2(r) = (Eeff - U)/C - l(l+1)/r^2, complex
        for (i = 1; i <= n; i++) {
          kr[i] = (Eeff - Ur[i] - X * SOr[i]) / C - l * (l + 1) / (r[i] * r[i]);
          ki[i] = (-Ui[i] - X * SOi[i]) / C;
        }
        // Numerov, regular solution started at i0 where l(l+1)/(12 i^2) < 0.1
        var i0 = Math.max(1, Math.ceil(Math.sqrt(l * (l + 1) / 1.2)));
        uR.fill(0); uI.fill(0);
        for (i = 1; i <= i0; i++) uR[i] = Math.pow(i * h, l + 1);
        for (i = i0; i < n; i++) {
          // u_{i+1} (1 + h2 k_{i+1}) = 2 u_i (1 - 5 h2 k_i) - u_{i-1} (1 + h2 k_{i-1}), complex
          var a0r = 1 - 5 * h2 * kr[i], a0i = -5 * h2 * ki[i], amr = 1 + h2 * kr[i - 1], ami = h2 * ki[i - 1];
          var apr = 1 + h2 * kr[i + 1], api = h2 * ki[i + 1];
          var nr_ = 2 * (a0r * uR[i] - a0i * uI[i]) - (amr * uR[i - 1] - ami * uI[i - 1]);
          var ni_ = 2 * (a0r * uI[i] + a0i * uR[i]) - (amr * uI[i - 1] + ami * uR[i - 1]);
          var dd = apr * apr + api * api;
          uR[i + 1] = (nr_ * apr + ni_ * api) / dd; uI[i + 1] = (ni_ * apr - nr_ * api) / dd;
          if (Math.abs(uR[i + 1]) + Math.abs(uI[i + 1]) > 1e150) for (var q = 0; q <= i + 1; q++) { uR[q] *= 1e-150; uI[q] *= 1e-150; }
        }
        // two-point match: u = N (H- - S H+), H+- = G +- i F
        var Hp1 = [cou1.G[l], cou1.F[l]], Hm1 = [cou1.G[l], -cou1.F[l]];
        var Hp2 = [cou2.G[l], cou2.F[l]], Hm2 = [cou2.G[l], -cou2.F[l]];
        // scale u and H to O(1) first: far beyond grazing |u| ~ 1e130 and |G| ~ 1e30, and the complex
        // division below squares the products (overflow to Infinity at l ~ 90 for p + 208Pb at 30 MeV)
        var su = 1 / (Math.abs(uR[im]) + Math.abs(uI[im])), sh = 1 / (Math.abs(cou2.G[l]) + Math.abs(cou2.F[l]));
        var u1 = [uR[im - 1] * su, uI[im - 1] * su], u2 = [uR[im] * su, uI[im] * su];
        Hp1 = [Hp1[0] * sh, Hp1[1] * sh]; Hm1 = [Hm1[0] * sh, Hm1[1] * sh]; Hp2 = [Hp2[0] * sh, Hp2[1] * sh]; Hm2 = [Hm2[0] * sh, Hm2[1] * sh];
        var num = [cmul(Hm1, u2)[0] - cmul(Hm2, u1)[0], cmul(Hm1, u2)[1] - cmul(Hm2, u1)[1]];
        var den = [cmul(Hp1, u2)[0] - cmul(Hp2, u1)[0], cmul(Hp1, u2)[1] - cmul(Hp2, u1)[1]];
        var Sj = cdiv(num, den);
        Sl.push(Sj);
        if (keepWave) {
          // normalize so that u -> (i/2)(H- - S H+) asymptotically: equals F_l when S = 1
          var target = [cou2.G[l] - (Sj[0] * cou2.G[l] - Sj[1] * cou2.F[l]), -cou2.F[l] - (Sj[0] * cou2.F[l] + Sj[1] * cou2.G[l])];
          target = [-0.5 * target[1], 0.5 * target[0]];   // multiply by i/2
          var c2 = cg(2 * l, 0, s2, s2, j2, s2), w = (2 * l + 1) * c2 * c2;
          var nrm = cdiv(target, [uR[im], uI[im]]), pr_ = w * nrm[0], pi_ = w * nrm[1];
          for (i = 0; i <= n; i++) { wr[i] += pr_ * uR[i] - pi_ * uI[i]; wi[i] += pr_ * uI[i] + pi_ * uR[i]; }
        }
      }
      S.push(Sl); ul.push(keepWave ? [wr, wi] : null);
    }
    // reaction and total cross sections (fm^2 -> mb: x10), (2j+1)/(2s+1) weights
    var sR = 0, sT = 0;
    for (l = 0; l <= lmax; l++) for (kk = 0; kk <= s2; kk++) {
      var Sx = S[l][kk]; if (!Sx) continue;
      var g = (2 * l - s2 + 2 * kk + 1) / (s2 + 1);
      sR += g * (1 - Sx[0] * Sx[0] - Sx[1] * Sx[1]);
      sT += g * (1 - Sx[0]);
    }
    sR *= Math.PI / (k * k) * 10; sT *= 2 * Math.PI / (k * k) * 10;
    // never hand back NaN or Infinity as a result: the caller must see the failure
    var bad = !isFinite(sR) || !isFinite(sT) || !isFinite(k) || !isFinite(eta);
    for (l = 0; l <= lmax && !bad; l++) for (kk = 0; kk <= s2; kk++) { var Sb = S[l][kk]; if (Sb && !(isFinite(Sb[0]) && isFinite(Sb[1]))) { bad = true; break; } }
    if (bad) throw new Error('omp.solve: non-finite S-matrix or cross section (' + proj + ' Z=' + Zt + ' A=' + At + ' E=' + E + ' MeV)');
    var res = { opt: opt, P: P, proj: proj, spin: s2 / 2, kin: kin, k: k, eta: eta, Ecm: K.Ecm, mu: mu, lmax: lmax, sigma: sig, S: S,
      ul: ul, r: r, h: h, n: n, rmatch: rmatch, sigR: sR, sigTot: Zp ? null : sT,
      R: { v: Rv, d: Rd, so: Rso, c: Rc }, Ur: Ur, Ui: Ui };
    if (s2 === 1) {                                    // spin 1/2: j = l + 1/2 and j = l - 1/2, as before
      res.Sp = S.map(function (x) { return x[1]; });
      res.Sm = S.map(function (x) { return x[0] || [1, 0]; });
    }
    return res;
  }

  /* ---------- the numerics scatter.html uses: the field is drawn over a square of half-width HALF, so the
     radial waves are integrated to rplot = HALF sqrt(2) + 1 and the partial-wave sum runs to k rplot + 12
     (the wave must converge at every drawn point, not only the S-matrix). h and rmatch: solve() defaults.
     tests/check_omp.py compares these settings with converged ones. */
  function viewNumerics(proj, Z, A, E, kin, P) {
    P = P || potential(proj, Z, A, E);
    var R = P.rv * Math.cbrt(A), HALF = Math.max(3.6 * R, 24), rplot = HALF * Math.SQRT2 + 1;
    var k = kinematics(PROJ[proj].m, A, E, kin || 'rel', AMU, HBARC).k;
    return { R: R, HALF: HALF, rplot: rplot, lmax: Math.ceil(k * rplot + 12) };
  }

  // Legendre P_l(x) and P_l^1(x) = sqrt(1-x^2) dP_l/dx (no Condon-Shortley phase), l = 0..lmax
  function legendre(x, lmax) {
    var P = new Float64Array(lmax + 1), P1 = new Float64Array(lmax + 1);
    P[0] = 1; if (lmax > 0) P[1] = x;
    for (var l = 2; l <= lmax; l++) P[l] = ((2 * l - 1) * x * P[l - 1] - (l - 1) * P[l - 2]) / l;
    var s = Math.sqrt(Math.max(0, 1 - x * x));
    P1[0] = 0;
    for (l = 1; l <= lmax; l++) P1[l] = s > 1e-12 ? l * (P[l - 1] - x * P[l]) / s : 0;
    return { P: P, P1: P1 };
  }

  /* ---------- amplitudes and observables, projectile spin s on a spin-0 target (no tensor force, l conserved):
       f_{m'm}(theta) = f_C delta_{m'm}
          + sum_{l,j} sqrt(4 pi (2l+1))/(2ik) e^{2i sigma_l} (S_lj - 1) <l 0 s m|j m> <l m-m' s m'|j m> Y_{l,m-m'}(theta, 0)
     (z along the beam, scattering in the x-z plane with phi = 0, y = k_in x k_out: the Madison frame).
       dsigma/dOmega = (1/(2s+1)) sum |f_{m'm}|^2
       iT11 = i Tr(f tau11 f^+)/Tr(f f^+),  tau11 = sqrt(3/(s(s+1))) S_{+1},  S_{+1} = -(S_x + i S_y)/sqrt(2)
     For s = 1/2 this gives A_y = sqrt(2) iT11; tests/check_omp.py compares iT11 with FRESCO for s = 1/2 and 1.
     sqrt(4pi(2l+1)) Y_{l,mu}(theta,0) = (2l+1) Q_l^|mu| (x) times (-1)^mu for mu > 0, with
     Q_l^mu = sqrt((l-mu)!/(l+mu)!) P_l^mu (no Condon-Shortley phase in P_l^mu). */
  function angular(res, thetasDeg) {
    var k = res.k, eta = res.eta, L = res.lmax, sig = res.sigma, s2 = Math.round(2 * res.spin), ns = s2 + 1;
    var out = { theta: thetasDeg, dsdo: [], ruth: [], ratio: [], ay: [], it11: [] };
    // coefficients c[l][a][b] (a = m' index, b = m index; m = -s + index), angle independent
    var coef = [];
    for (var l = 0; l <= L; l++) {
      var e2s = [Math.cos(2 * sig[l]), Math.sin(2 * sig[l])], cl = [];
      for (var a = 0; a < ns; a++) {
        var row = [];
        for (var b = 0; b < ns; b++) {
          var m2 = 2 * b - s2, mp2 = 2 * a - s2, mu2 = m2 - mp2, sr = 0, si = 0;
          if (Math.abs(mu2) <= 2 * l) for (var kk = 0; kk <= s2; kk++) {
            var Sx = res.S[l][kk]; if (!Sx) continue;
            var j2 = 2 * l - s2 + 2 * kk;
            var c = cg(2 * l, 0, s2, m2, j2, m2) * cg(2 * l, mu2, s2, mp2, j2, m2);
            sr += c * (Sx[0] - 1); si += c * Sx[1];
          }
          // times e^{2 i sigma} / (2 i k), and the Y sign (-1)^mu for mu > 0
          var t = cmul(e2s, [sr, si]), sg = (mu2 > 0 && (mu2 / 2) % 2) ? -1 : 1;
          row.push([sg * t[1] / (2 * k), -sg * t[0] / (2 * k)]);
        }
        cl.push(row);
      }
      coef.push(cl);
    }
    var Q = [new Float64Array(L + 1), new Float64Array(L + 1), new Float64Array(L + 1)];
    var f = [], tau = [];
    for (a = 0; a < ns; a++) { f.push([]); for (b = 0; b < ns; b++) f[a].push([0, 0]); }
    // tau11 matrix elements <b+1|tau11|b> (index space), real
    var sp = s2 / 2;
    for (b = 0; b < ns; b++) { var mb = -sp + b; tau.push(b + 1 < ns ? Math.sqrt(3 / (sp * (sp + 1))) * (-1 / Math.SQRT2) * Math.sqrt((sp - mb) * (sp + mb + 1)) : 0); }
    for (var t = 0; t < thetasDeg.length; t++) {
      var th = thetasDeg[t] * Math.PI / 180, x = Math.cos(th), sn = Math.sin(th);
      for (var mu = 0; mu <= Math.min(2, s2); mu++) {
        var q = Q[mu]; q.fill(0);
        if (mu > L) continue;
        q[mu] = mu === 0 ? 1 : mu === 1 ? sn / Math.SQRT2 : Math.sqrt(6) / 4 * sn * sn;
        if (mu + 1 <= L) q[mu + 1] = Math.sqrt(2 * mu + 1) * x * q[mu];
        for (l = mu + 2; l <= L; l++) q[l] = ((2 * l - 1) * x * q[l - 1] - Math.sqrt((l - 1) * (l - 1) - mu * mu) * q[l - 2]) / Math.sqrt(l * l - mu * mu);
      }
      var s2h = Math.sin(th / 2) * Math.sin(th / 2), ruth = 0, fc = [0, 0];
      if (eta > 0) {
        var ph = -eta * Math.log(s2h) + 2 * sig[0], mag = -eta / (2 * k * s2h);
        fc = [mag * Math.cos(ph), mag * Math.sin(ph)];
        ruth = (eta * eta) / (4 * k * k * s2h * s2h) * 10;
      }
      var tot = 0;
      for (a = 0; a < ns; a++) for (b = 0; b < ns; b++) {
        var mu_ = Math.abs(b - a), fr = a === b ? fc[0] : 0, fi = a === b ? fc[1] : 0, qq = Q[mu_];
        for (l = mu_; l <= L; l++) { var cc = coef[l][a][b], w = (2 * l + 1) * qq[l]; fr += cc[0] * w; fi += cc[1] * w; }
        f[a][b][0] = fr; f[a][b][1] = fi; tot += fr * fr + fi * fi;
      }
      // Tr(f tau f^+) = sum_{a, b} f[a][b+1] tau_b conj(f[a][b])
      var trr = 0, tri = 0;
      for (a = 0; a < ns; a++) for (b = 0; b + 1 < ns; b++) {
        var u = f[a][b + 1], v = f[a][b];
        trr += tau[b] * (u[0] * v[0] + u[1] * v[1]); tri += tau[b] * (u[1] * v[0] - u[0] * v[1]);
      }
      var ds = tot / ns * 10, it11 = s2 ? -tri / tot : 0;      // i * (trr + i tri) / tot, real part
      out.dsdo.push(ds); out.ruth.push(ruth); out.ratio.push(eta > 0 ? ds / ruth : null);
      out.it11.push(it11); out.ay.push(s2 === 1 ? Math.SQRT2 * it11 : null);
    }
    return out;
  }

  /* Wave function in the scattering plane, spin quantized along the beam, spin-non-flip part of the
     largest projection m = s:
       psi(r, theta) = (1/kr) sum_l i^l e^{i sigma_l} [sum_j (2l+1) |<l 0 s s|j s>|^2 u_lj] P_l(cos theta)
     with u -> (i/2)(H- - S H+) normalized so that u = F_l when S = 1, hence psi = e^{ikz} for no potential
     (for s = 1/2 the bracket is (l+1) u+ + l u-). fieldCoeffs folds the l-dependent phases into radial arrays
     once; field() then evaluates psi at (r, cos theta) by linear interpolation in r, summing l <= kr + 6 (kr)^(1/3) + 12. */
  function fieldCoeffs(res) {
    var L = res.lmax, n = res.n, cR = [], cI = [];
    for (var l = 0; l <= L; l++) {
      var ph = l * Math.PI / 2 + res.sigma[l], c = Math.cos(ph), s = Math.sin(ph);
      var w = res.ul[l], xr = new Float64Array(n + 1), xi = new Float64Array(n + 1);
      for (var i = 0; i <= n; i++) { xr[i] = c * w[0][i] - s * w[1][i]; xi[i] = s * w[0][i] + c * w[1][i]; }
      cR.push(xr); cI.push(xi);
    }
    return { cR: cR, cI: cI, P: new Float64Array(L + 1), res: res };
  }
  function field(fc, r, ct, out) {
    var res = fc.res, n = res.n, P = fc.P;
    r = Math.max(1e-3, r);
    // F_l(kr) dies beyond the turning point l ~ kr over a width ~ (kr)^(1/3): waves with l > kr + 6 (kr)^(1/3) + 12
    // are dropped at this r (tests/check_field.js: no loss of accuracy against the full sum)
    var kr = res.k * r, L = Math.min(res.lmax, Math.ceil(kr + 6 * Math.cbrt(kr) + 12));
    var g = r / res.h, i0 = Math.min(n - 1, Math.floor(g)), t = g - i0;
    P[0] = 1; if (L > 0) P[1] = ct;
    for (var l = 2; l <= L; l++) P[l] = ((2 * l - 1) * ct * P[l - 1] - (l - 1) * P[l - 2]) / l;
    var sr = 0, si = 0;
    for (l = 0; l <= L; l++) {
      var a = fc.cR[l], b = fc.cI[l];
      sr += (a[i0] + (a[i0 + 1] - a[i0]) * t) * P[l];
      si += (b[i0] + (b[i0 + 1] - b[i0]) * t) * P[l];
    }
    out[0] = sr / (res.k * r); out[1] = si / (res.k * r);
    return out;
  }

  /* The surface grid scatter.html draws: NG x NG points over [-HALF, HALF]^2 (x across, z along the beam,
     row index iz runs downstream), psi written to re[iz*NG + ix], im[...].
     stride 2 (the draft while a slider is dragged): psi is summed on every other point only, and the rest is
     interpolated in psi e^{-ikz}, i.e. with the incident plane-wave phase taken out. Averaging psi itself
     between points 2 dz apart multiplies a plane wave by cos(k dz) (alpha + 208Pb at 200 MeV, dz = 0.263 fm:
     |psi|^2 = 0.002 at the midpoints, a false shadow). NG must be odd.
     Taking out e^{ikz} makes the incident wave exact, not the scattered one: a wave running backward or
     sideways still varies on the scale 1/(2k), and with the absorption switched off (W x 0) the standing
     waves it forms are not resolved by a k dx rule alone (d + 208Pb, 10 MeV, NG 161, k dx = 0.305: 1.06% of
     the interpolated points off by a factor 2 in |psi|^2). So the draft is checked a posteriori: psi is also
     summed exactly on a lattice of about 1/7 of the interpolated points (ix + 3 iz = 0 mod 7, inside the drawn
     disc |r| < 0.99 HALF), and the draft is kept only if every one of them is within DRAFT_TOL of the exact
     |psi|^2 wherever |psi|^2 > DRAFT_FLOOR (fainter points are the clamped darkest colour); otherwise the
     remaining points are summed too and the full grid is returned. The k dx bound below stays as a cheap
     first gate. fieldGrid returns the stride actually used. tests/check_field.js runs both rules over a scan
     of projectile, target, energy, W multiplier, spin-orbit and grid (section 3), against the full grid. */
  var DRAFT_KDX = 0.35, DRAFT_TOL = 0.25, DRAFT_FLOOR = 0.05;
  function draftStride(k, NG, HALF) { return k * 2 * HALF / (NG - 1) <= DRAFT_KDX ? 2 : 1; }
  function fieldGrid(fc, NG, HALF, stride, re, im, info) {
    var o = [0, 0], k = fc.res.k, ix, iz, v;
    stride = stride === 2 ? 2 : 1;
    var zOf = function (iz) { return (iz / (NG - 1) - 0.5) * 2 * HALF; };
    var xOf = function (ix) { return (ix / (NG - 1) - 0.5) * 2 * HALF; };
    function exact(ix, iz) {
      var x = xOf(ix), z = zOf(iz), r = Math.sqrt(x * x + z * z);
      field(fc, r, r > 0 ? z / r : 1, o);
      return o;
    }
    for (iz = 0; iz < NG; iz += stride) {
      for (ix = 0; ix < NG; ix += stride) {
        exact(ix, iz); v = iz * NG + ix; re[v] = o[0]; im[v] = o[1];
      }
    }
    if (stride === 2) {
      // along x (same z) the incident phase is constant: plain average
      for (iz = 0; iz < NG; iz += 2) for (ix = 1; ix < NG; ix += 2) {
        v = iz * NG + ix; re[v] = 0.5 * (re[v - 1] + re[v + 1]); im[v] = 0.5 * (im[v - 1] + im[v + 1]);
      }
      // along z: average psi e^{-ikz} of the two neighbours (z -+ dz), then put e^{ikz} back:
      // psi = (psi_- e^{ik dz} + psi_+ e^{-ik dz}) / 2, exact for a plane wave along the beam
      var dz = 2 * HALF / (NG - 1), c = Math.cos(k * dz), s = Math.sin(k * dz);
      for (iz = 1; iz < NG; iz += 2) for (ix = 0; ix < NG; ix++) {
        v = iz * NG + ix;
        var ar = re[v - NG], ai = im[v - NG], br = re[v + NG], bi = im[v + NG];
        re[v] = 0.5 * ((ar * c - ai * s) + (br * c + bi * s));
        im[v] = 0.5 * ((ai * c + ar * s) + (bi * c - br * s));
      }
      // a-posteriori check on the sample lattice
      var nS = 0, worst = 0, R2 = 0.99 * 0.99 * HALF * HALF;
      for (iz = 0; iz < NG; iz++) for (ix = (7 - (3 * iz) % 7) % 7; ix < NG; ix += 7) {
        if (iz % 2 === 0 && ix % 2 === 0) continue;
        var xx = xOf(ix), zz = zOf(iz);
        if (xx * xx + zz * zz > R2) continue;
        v = iz * NG + ix;
        var J = re[v] * re[v] + im[v] * im[v];
        exact(ix, iz); re[v] = o[0]; im[v] = o[1];
        var I = o[0] * o[0] + o[1] * o[1];
        nS++;
        if (Math.max(I, J) > DRAFT_FLOOR) worst = Math.max(worst, Math.abs(J / Math.max(I, 1e-12) - 1));
      }
      if (info) { info.sampled = nS; info.worst = worst; }
      if (worst > DRAFT_TOL) {
        for (iz = 0; iz < NG; iz++) for (ix = (iz % 2 === 0 ? 1 : 0); ix < NG; ix += (iz % 2 === 0 ? 2 : 1)) {
          exact(ix, iz); v = iz * NG + ix; re[v] = o[0]; im[v] = o[1];
        }
        stride = 1;
      }
    }
    return stride;
  }

  // point-Coulomb Rutherford cross section (mb/sr) at c.m. angle theta (deg) for lab energy E, kinematics kin
  // ('rel' or 'nr', as in kinematics()); used to put measured cross sections on the ratio scale at their own energy
  function rutherford(proj, Zt, mt, E, thetaDeg, kin) {
    var pr = PROJ[proj], K = kinematics(pr.m, mt, E, kin || 'rel', AMU, HBARC);
    var eta = pr.Z * Zt * E2 * K.mu / (HBARC * HBARC * K.k), s2 = Math.pow(Math.sin(thetaDeg * Math.PI / 360), 2);
    return eta * eta / (4 * K.k * K.k * s2 * s2) * 10;
  }

  var OMP = { fieldCoeffs: fieldCoeffs, field: field, fieldGrid: fieldGrid, draftStride: draftStride, DRAFT_KDX: DRAFT_KDX, DRAFT_TOL: DRAFT_TOL, DRAFT_FLOOR: DRAFT_FLOOR, rutherford: rutherford, kd02: kd02, kd02SelfTest: kd02SelfTest, hss06: hss06, avr14: avr14,
    potential: potential, fitRange: fitRange, viewNumerics: viewNumerics, PROJ: PROJ, POT: POT, kinematics: kinematics, cg: cg,
    coulomb: coulomb, coulombPhases: coulombPhases, solve: solve,
    angular: angular, legendre: legendre, LSO2: LSO2, AMU: AMU, MP: MP, MN: MN, MD: MD, MA: MA };
  if (typeof module !== 'undefined' && module.exports) module.exports = OMP; else root.OMP = OMP;
})(this);
