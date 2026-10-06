// The liquid drop for binding.html: the Bethe-Weizsaecker formula, its least-squares fit to the AME2020
// binding energies, energy release from measured masses, and the drop's drip lines. Plain script, also
// require-able from Node (tests/check_binding.js).
//
//   B_exp(Z,N) = Z*Delta(1H) + N*Delta(n) - Delta(Z,N)      atomic mass excesses (window.AME), keV -> MeV.
//                This is AME's own convention: B/A from it equals AME2020's printed B/A column to its rounding.
//   B_LDM(Z,N) = a_v A - a_s A^(2/3) - a_c C(Z)/A^(1/3) - a_a (N-Z)^2/A + a_p delta/A^(1/2)
//                C(Z) = Z(Z-1) (default) or Z^2;  delta = +1 even-even, 0 odd A, -1 odd-odd.
//
// The fit is linear in (a_v, a_s, a_c, a_a, a_p): unweighted least squares on B (MeV), every nuclide with a
// measured mass (AME's # estimates excluded) and A >= amin. Unweighted because the model misses by MeV
// (rms about 3 MeV) while the mass uncertainties in the fit set are far smaller (sigmaStats: median about
// 6 keV, largest below 1 MeV in the default set), so weighting by them would let a handful of precisely
// measured nuclei decide the fit. Closed form: the 5x5 normal equations, columns scaled to unit
// norm first, solved by Gaussian elimination with partial pivoting.
(function (root) {
  "use strict";
  const NAMES = ["volume", "surface", "Coulomb", "asymmetry", "pairing"];

  function delta(Z, N) { return Z % 2 === 0 && N % 2 === 0 ? 1 : Z % 2 === 1 && N % 2 === 1 ? -1 : 0; }
  // the five basis functions, signs included, so that B_LDM = sum_k c_k f_k with all c_k > 0
  function basis(Z, N, form) {
    const A = Z + N, C = form === "zz" ? Z * Z : Z * (Z - 1);
    return [A, -Math.pow(A, 2 / 3), -C / Math.cbrt(A), -(N - Z) * (N - Z) / A, delta(Z, N) / Math.sqrt(A)];
  }
  function terms(Z, N, c, form) { const f = basis(Z, N, form); return f.map((v, k) => v * c[k]); }
  function ldm(Z, N, c, form) { const f = basis(Z, N, form); let s = 0; for (let k = 0; k < 5; k++) s += f[k] * c[k]; return s; }

  // measured and estimated binding energies from window.AME rows [Z, N, Delta keV, sigma keV, est, ...]
  function build(AME) {
    let dn = 0, dh = 0;
    for (const r of AME) { if (r[0] === 0 && r[1] === 1) dn = r[2]; if (r[0] === 1 && r[1] === 0) dh = r[2]; }
    const list = [], M = new Map();
    for (const r of AME) {
      const Z = r[0], N = r[1], A = Z + N;
      if (A < 2) continue;
      const o = { Z, N, A, B: (Z * dh + N * dn - r[2]) / 1000, s: r[3] / 1000, est: !!r[4], dA: r[2] / A };
      list.push(o); M.set(Z * 1000 + N, o);
    }
    return { list, get: (Z, N) => (Number.isInteger(Z) && Number.isInteger(N) && Z >= 0 && N >= 0 && N < 1000 ? M.get(Z * 1000 + N) || null : null) };
  }

  function solve(G, b) {                       // Gaussian elimination, partial pivoting, n x n
    const n = b.length, a = G.map((r, i) => r.concat([b[i]]));
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
      [a[i], a[p]] = [a[p], a[i]];
      for (let j = i + 1; j < n; j++) { const f = a[j][i] / a[i][i]; for (let k = i; k <= n; k++) a[j][k] -= f * a[i][k]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = a[i][n]; for (let k = i + 1; k < n; k++) s -= a[i][k] * x[k]; x[i] = s / a[i][i]; }
    return x;
  }
  const inFit = (o, amin) => !o.est && o.A >= amin;
  function fit(list, opt) {
    const amin = opt.amin, form = opt.form;
    const rows = list.filter((o) => inFit(o, amin));
    const F = rows.map((o) => basis(o.Z, o.N, form));
    const sc = [0, 1, 2, 3, 4].map((k) => Math.sqrt(F.reduce((s, f) => s + f[k] * f[k], 0)));
    const G = [0, 1, 2, 3, 4].map(() => [0, 0, 0, 0, 0]), b = [0, 0, 0, 0, 0];
    for (let i = 0; i < rows.length; i++) {
      const f = F[i].map((v, k) => v / sc[k]);
      for (let j = 0; j < 5; j++) { b[j] += f[j] * rows[i].B; for (let k = 0; k < 5; k++) G[j][k] += f[j] * f[k]; }
    }
    const c = solve(G, b).map((v, k) => v / sc[k]);
    return { c, n: rows.length, rms: rms(list, c, opt) };
  }
  // rms of B_exp - B_LDM over the same nuclei the fit uses
  function rms(list, c, opt) {
    let s = 0, n = 0;
    for (const o of list) if (inFit(o, opt.amin)) { const r = o.B - ldm(o.Z, o.N, c, opt.form); s += r * r; n++; }
    return Math.sqrt(s / n);
  }

  // the integer Z of largest B_LDM at fixed A, pairing left out: the drop's valley floor. This is the most
  // bound isobar, not the beta-stability line (smallest atomic mass at fixed A), which differs by the n-H
  // mass difference times (N - Z); the page uses it only as the reference line of the drop's curve.
  function valleyZ(A, c, form) {
    const c0 = c.slice(0, 4).concat([0]);
    let best = 1, bv = -Infinity;
    for (let Z = 1; Z < A; Z++) { const v = ldm(Z, A - Z, c0, form); if (v > bv) { bv = v; best = Z; } }
    return best;
  }
  // B/A along that valley, as a smooth curve of A
  function curve(A, c, form) { const c0 = c.slice(0, 4).concat([0]), Z = valleyZ(A, c, form); return ldm(Z, A - Z, c0, form) / A; }

  // The drop's drip lines for element Z. A nucleus is bound against neutron emission when S_n = B(Z,N) -
  // B(Z,N-1) > 0 and S_2n = B(Z,N) - B(Z,N-2) > 0; the neutron drip line is the largest such N. With pairing,
  // S_n zigzags, so an odd-N isotope can be unbound while heavier even-N ones are bound: the walk does not stop
  // at the first negative S_n. It goes up from the valley floor until S_2n <= 0 at two consecutive N (S_2n
  // carries no odd-even zigzag and falls steadily with N in the drop, so nothing beyond is bound) and returns
  // the largest bound N it met. Proton side likewise with S_p = B(Z,N) - B(Z-1,N), S_2p = B(Z,N) - B(Z-2,N),
  // walking down in N; the smallest bound N.
  function dripZ(Z, c, form) {
    const B = (z, n) => ldm(z, n, c, form);
    let N0 = 1;                                                    // start on the valley floor
    while (valleyZ(Z + N0, c, form) < Z) N0++;
    const nb = (N) => B(Z, N) - B(Z, N - 1) > 0 && B(Z, N) - B(Z, N - 2) > 0;
    const s2n = (N) => B(Z, N) - B(Z, N - 2);
    let nDrip = N0;
    for (let N = N0; N < 1000; N++) { if (nb(N)) nDrip = N; if (s2n(N) <= 0 && s2n(N + 1) <= 0) break; }
    const pb = (N) => B(Z, N) - B(Z - 1, N) > 0 && B(Z, N) - B(Z - 2, N) > 0;
    const s2p = (N) => B(Z, N) - B(Z - 2, N);
    let pDrip = N0;
    for (let N = N0; N >= 1; N--) { if (pb(N)) pDrip = N; if (N <= 2 || (s2p(N) <= 0 && s2p(N - 1) <= 0)) break; }
    return { Z, nDrip, pDrip };
  }
  function drip(c, form, Zmax) { const out = []; for (let Z = 8; Z <= Zmax; Z++) out.push(dripZ(Z, c, form)); return out; }

  // mean B_exp - B_LDM of the fitted nuclei within one proton of the valley floor at their A, and six or
  // more protons away, separately on the proton-rich (Z above the floor) and neutron-rich side
  function edge(list, c, opt) {
    const g = { near: [0, 0], pRich: [0, 0], nRich: [0, 0] };
    for (const o of list) {
      if (!inFit(o, opt.amin)) continue;
      const d = o.Z - valleyZ(o.A, c, opt.form), r = o.B - ldm(o.Z, o.N, c, opt.form);
      const k = Math.abs(d) <= 1 ? "near" : d >= 6 ? "pRich" : d <= -6 ? "nRich" : null;
      if (k) { g[k][0] += r; g[k][1]++; }
    }
    const out = {};
    for (const k in g) out[k] = g[k][1] ? { mean: g[k][0] / g[k][1], n: g[k][1] } : null;
    return out;
  }

  // Is each magic number a ridge of the residual? Mean B_exp - B_LDM of the fitted nuclei along the line
  // N = v (or Z = v) for v = m - 3 ... m + 3; the magic number is a ridge when its line has the largest mean.
  function ridges(list, c, opt) {
    const out = [];
    for (const ax of ["N", "Z"]) for (const m of [8, 20, 28, 50, 82, 126]) {
      const means = [];
      for (let v = m - 3; v <= m + 3; v++) {
        let s = 0, k = 0;
        for (const o of list) if (inFit(o, opt.amin) && o[ax] === v) { s += o.B - ldm(o.Z, o.N, c, opt.form); k++; }
        if (k) means.push([v, s / k, k]);
      }
      const at = means.find((x) => x[0] === m);
      if (!at) continue;
      const peak = means.reduce((a, x) => (x[1] > a[1] ? x : a));
      out.push({ ax, m, mean: at[1], peak: peak[0], peakMean: peak[1], ridge: peak[0] === m });
    }
    return out;
  }

  // mass uncertainties (MeV) of the fit set: median, fraction above 1 keV, largest
  function sigmaStats(list, opt) {
    const s = list.filter((o) => inFit(o, opt.amin)).map((o) => o.s).sort((a, b) => a - b);
    const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { n: s.length, median: m, above1keV: s.filter((v) => v > 0.001).length / s.length, max: s[s.length - 1] };
  }

  // measured masses: at how many A is the most bound isobar (largest B) not the lightest one (smallest
  // atomic mass, i.e. smallest mass excess)?
  function isobarStats(list) {
    const by = new Map();
    for (const o of list) if (!o.est) { if (!by.has(o.A)) by.set(o.A, []); by.get(o.A).push(o); }
    let nA = 0, nDiff = 0;
    for (const [, iso] of by) {
      nA++;
      const b = iso.reduce((a, o) => (o.B > a.B ? o : a)), m = iso.reduce((a, o) => (o.dA < a.dA ? o : a));
      if (b !== m) nDiff++;
    }
    return { nA, nDiff };
  }

  // Q = sum B(final) - sum B(initial): neutrons and protons as particles have B = 0 in this bookkeeping
  // (atomic masses, so electrons balance when Z is conserved). parts: [[Z, N, count], ...]
  function Q(T, initial, final) {
    let q = 0;
    for (const [sign, parts] of [[-1, initial], [1, final]]) for (const [Z, N, k] of parts) {
      if (Z + N < 2) continue;
      const o = T.get(Z, N); if (!o) return null;
      q += sign * (k || 1) * o.B;
    }
    return q;
  }
  // the same with the drop's B (no measured masses needed)
  function Qdrop(c, form, initial, final) {
    let q = 0;
    for (const [sign, parts] of [[-1, initial], [1, final]]) for (const [Z, N, k] of parts) if (Z + N >= 2) q += sign * (k || 1) * ldm(Z, N, c, form);
    return q;
  }

  // Benzaid, Bentridi, Kerraci, Amrani, Nucl. Sci. Tech. 31, 9 (2020), Eqs. (6), (7): their Eq. (1) is this
  // formula with C(Z) = Z^2 and pairing a_p delta/A^(1/2); the paper says only that delta "may be a negative,
  // null or positive contribution", so the +1/0/-1 assignment used here is the usual one, inferred, not
  // stated. Least squares on B, AME2016, all 2497 nuclides and the 2166 with A >= 50. Copied from the
  // excerpt data/binding/benzaid2020_nst31_9.txt (tests/check_binding.py finds every digit string in it).
  // They are not the least-squares minimum of their own formula (tests/check_binding.py).
  const BENZAID = { form: "zz", all: [14.9297, 15.0580, 0.6615, 21.6091, 10.1744], a50: [14.6433, 14.0788, 0.6442, 21.0680, 11.5398] };

  const BW = { NAMES, delta, basis, terms, ldm, build, fit, rms, valleyZ, curve, edge, ridges, sigmaStats, isobarStats, dripZ, drip, Q, Qdrop, BENZAID, solve };
  if (typeof module !== "undefined" && module.exports) module.exports = BW; else root.BW = BW;
})(this);
