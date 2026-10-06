/* ------------------------------------------------------------------ *
 * Heavy-element nucleosynthesis on the nuclide chart: the little live
 * arithmetic of nucleosynthesis.html. Nothing here integrates a network.
 *
 * r process: along each isotopic chain (n,gamma) and (gamma,n) balance,
 * Arnould, Goriely and Takahashi, Phys. Rep. 450 (2007) 97,
 * arXiv:0705.4512, Eq. (24):
 *
 *   Y(Z,A+1)/Y(Z,A) = n_n (2 pi hbar^2/(m kT))^(3/2)
 *                     G(Z,A+1)/(2 G(Z,A)) exp(S_n(Z,A+1)/kT),
 *
 * with m = m_u (the value behind the 34.075 of their Eq. (25)) and G = 1
 * for every nucleus (ground-state spins and excited states left out).
 * The isotope with the largest share in each chain is the r path; their
 * Eq. (25) gives the S_n where it sits, S_a^0.
 *
 * Masses: AME2020 where both masses of an S_n are measured, otherwise
 * FRDM(2012), never one of each. A chain runs to the last nucleus with
 * S_2n > 0 in that table (the two-neutron drip line).
 *
 * s process: drawn by a rule, not computed. From 56Fe a stable nucleus
 * captures; the product, if stable, captures again; if radioactive with a
 * terrestrial half-life below LONG it decays by its main NUBASE2020 mode
 * (beta- or EC), above LONG it is drawn as capturing. 209Bi(n,g)210Bi(b-)210Po(alpha)206Pb closes the path.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';
  var HBARC = 197.3269804;          // MeV fm (CODATA 2018)
  var MU = 931.49410242;            // MeV, atomic mass unit (CODATA 2018)
  var KB = 8.617333262e-11;         // MeV/K (CODATA 2018, exact)
  var LONG = Math.log10(10 * 3.15576e7);   // log10 of 10 years in s: drawing rule of the s path

  var T = null;
  function init(o) {
    var ame = new Map(), nuc = new Map(), stableA = {};
    for (var i = 0; i < o.AME.length; i++) { var r = o.AME[i]; ame.set(r[0] * 1000 + r[1], { M: r[2] / 1000, est: r[4] }); }
    for (i = 0; i < o.NUC.length; i++) {
      r = o.NUC[i]; nuc.set(r[0] * 1000 + r[1], r);
      if (r[3] != null && r[3] >= 15) (stableA[r[0] + r[1]] = stableA[r[0] + r[1]] || []).push(r[0]);
    }
    T = { ame: ame, nuc: nuc, stableA: stableA, Mn: ame.get(1).M, frdm: o.FRDM };
    return T;
  }
  function frdmM(Z, N) {
    var c = T.frdm[Z]; if (!c) return null;
    var k = N - c[0];
    return k >= 0 && k < c[1].length ? c[1][k] : null;
  }
  function ameM(Z, N) { var a = T.ame.get(Z * 1000 + N); return a && !a.est ? a.M : null; }
  // S_n(Z,N) in MeV and its source, both masses from one table
  function Sn(Z, N) {
    var a1 = ameM(Z, N), a0 = ameM(Z, N - 1);
    if (a1 != null && a0 != null) return { S: a0 + T.Mn - a1, src: 'ame' };
    var t1 = frdmM(Z, N), t0 = frdmM(Z, N - 1);
    if (t1 != null && t0 != null) return { S: t0 + T.Mn - t1, src: 'frdm' };
    return null;
  }
  // S_2n(Z,N) from FRDM(2012) alone (the drip line is FRDM's, never AME and FRDM mixed)
  function S2n(Z, N) { var a = frdmM(Z, N), b = frdmM(Z, N - 2); return a != null && b != null ? b + 2 * T.Mn - a : null; }
  function kT(T9) { return KB * 1e9 * T9; }
  // the one line: ln Y(Z,A+1)/Y(Z,A), S_n = S_n(Z,A+1) in MeV, n_n in cm^-3, G = 1
  function lnSaha(SnA1, T9, nn) {
    var t = kT(T9);
    return Math.log(nn * Math.pow(2 * Math.PI * HBARC * HBARC / (MU * t), 1.5) * 1e-39 / 2) + SnA1 / t;
  }
  // Arnould et al. (2007) Eq. (25), MeV
  function Sa0(T9, log10nn) { return (34.075 - log10nn + 1.5 * Math.log10(T9)) * T9 / 5.04; }

  // one chain: shares P (sum 1), the path isotope (largest share), the drip line
  function chain(Z, T9, log10nn) {
    var c = T.frdm[Z]; if (!c) return null;
    var N0 = c[0], N1 = c[0] + c[1].length - 1, Nd = null;
    while (ameM(Z, N0 - 1) != null) N0--;
    for (var N = N0 + 2; N <= N1; N++) { var s2 = S2n(Z, N); if (s2 != null && s2 > 0) Nd = N; }
    if (Nd == null) return null;
    var nn = Math.pow(10, log10nn), Ns = [N0], lnY = [0], sn = [null], srcs = [null];
    for (N = N0 + 1; N <= Nd; N++) {
      var s = Sn(Z, N); if (!s) break;
      lnY.push(lnY[lnY.length - 1] + lnSaha(s.S, T9, nn));
      Ns.push(N); sn.push(s.S); srcs.push(s.src);
    }
    var mx = -Infinity, im = 0, i;
    for (i = 0; i < lnY.length; i++) if (lnY[i] > mx) { mx = lnY[i]; im = i; }
    var P = [], tot = 0;
    for (i = 0; i < lnY.length; i++) { P.push(Math.exp(lnY[i] - mx)); tot += P[i]; }
    for (i = 0; i < P.length; i++) P[i] /= tot;
    return { Z: Z, N: Ns, P: P, Sn: sn, src: srcs, ipeak: im, Npeak: Ns[im], Ppeak: P[im], Ndrip: Nd };
  }
  function path(T9, log10nn, Zmin, Zmax) {
    var out = [];
    for (var Z = Zmin; Z <= Zmax; Z++) { var c = chain(Z, T9, log10nn); if (c) out.push(c); }
    return out;
  }
  // beta-decay end point of mass A from the neutron-rich side: the lowest-Z stable or primordial
  // isobar (T1/2 >= 1e15 s) with Z' >= Z; null if A has none (A > 209)
  function stableIsobar(Z, A) {
    var zs = T.stableA[A]; if (!zs) return null;
    var best = null;
    for (var i = 0; i < zs.length; i++) if (zs[i] >= Z && (best == null || zs[i] < best)) best = zs[i];
    return best;
  }
  // the drawn s path: list of steps [Z, N, Z', N', kind] with kind 'n' (capture), 'b' (beta-), 'e' (EC/beta+), 'a' (alpha)
  function sPath() {
    var st = function (Z, N) { var r = T.nuc.get(Z * 1000 + N); return r && r[3] != null && r[3] >= 15; };
    var row = function (Z, N) { return T.nuc.get(Z * 1000 + N); };
    var out = [], Z = 26, N = 30, guard = 0;
    while (guard++ < 2000) {
      if (Z === 83 && N === 126) {                     // 209Bi: the end of the s path
        out.push([83, 126, 83, 127, 'n'], [83, 127, 84, 126, 'b'], [84, 126, 82, 124, 'a']);
        break;
      }
      out.push([Z, N, Z, N + 1, 'n']); N++;
      while (!st(Z, N)) {
        var r = row(Z, N);
        if (!r || guard++ > 2000) return out;
        if (r[3] != null && r[3] > LONG) { out.push([Z, N, Z, N + 1, 'n']); N++; continue; }
        if (r[4] === 'B+') { out.push([Z, N, Z - 1, N + 1, 'e']); Z--; N++; }      // electron capture or beta+
        else { out.push([Z, N, Z + 1, N - 1, 'b']); Z++; N--; }
      }
    }
    return out;
  }

  var NUCLEO = { init: init, Sn: Sn, S2n: S2n, kT: kT, lnSaha: lnSaha, Sa0: Sa0, chain: chain, path: path,
    stableIsobar: stableIsobar, sPath: sPath, LONG: LONG, HBARC: HBARC, MU: MU, KB: KB };
  if (typeof module !== 'undefined' && module.exports) module.exports = NUCLEO; else root.NUCLEO = NUCLEO;
})(this);
