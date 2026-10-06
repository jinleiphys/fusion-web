/* ------------------------------------------------------------------ *
 * The deuteron and the np force: Argonne v18 in the np channels.
 *
 * Potential: a line-by-line port of R. B. Wiringa's av18pot.f (subroutines av18pw, av18op, empot,
 * consts, lpot = 1: full v18 with the full electromagnetic interaction), the file distributed with
 * Wiringa, Stoks and Schiavilla, Phys. Rev. C 51, 38 (1995) and saved in data/deuteron/av18pot.f.
 * Constants are the code's (consts), not the slightly rounded ones of the paper's Table I.
 * tests/check_deuteron.jl calls the original Fortran (gfortran, real*8 constants) instead of this port.
 *
 * Kinetic energy hbar^2/(2 M_r), M_r = M_p M_n/(M_p + M_n), and E_d = kappa^2/(2 M_r): the paper's
 * nonrelativistic kinematics (Sec. III).
 *
 * Bound state (3S1-3D1, T = 0): matrix Numerov on a uniform grid; two regular solutions outward from
 * r = 0, two decaying solutions inward from rmax started on the free asymptotic functions
 * e^{-kappa r} and e^{-kappa r}(1 + 3/(kappa r) + 3/(kappa r)^2); E from the zero of the 4x4
 * matching determinant (it has zeros at the eigenvalues and no poles), bracketed by a scan.
 * Scattering: outward Numerov, K matrix from Riccati-Bessel functions at two points beyond the
 * range, S = (1 + iK)(1 - iK)^-1, nuclear-bar phases (Stapp, Ypsilantis, Metropolis):
 *   S11 = cos 2eps e^{2i d1}, S22 = cos 2eps e^{2i d2}, S12 = i sin 2eps e^{i(d1 + d2)}.
 *
 * Plain script: window.DEUT in a browser, module.exports in Node.
 * ------------------------------------------------------------------ */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- consts (av18pot.f, lpot < 100)
  const C = { hc: 197.327053, mpi0: 134.9739, mpic: 139.5675, mp: 938.27231, mn: 939.56563, alpha: 1 / 137.035989, mup: 2.7928474, mun: -1.9130427 };
  const MR = C.mp * C.mn / (C.mp + C.mn);
  const H2M = C.hc * C.hc / (2 * MR);            // hbar^2/(2 M_r), MeV fm^2

  // ---------------------------------------------------------------- av18op (strong part, operator format)
  function av18op(r) {
    const vnn = new Float64Array(19);             // 1-based like the Fortran
    const small = 1e-4;
    const mpi = (C.mpi0 + 2 * C.mpic) / 3, mu0 = C.mpi0 / C.hc, muc = C.mpic / C.hc, mu = mpi / C.hc;
    const fsq = 0.075, cpi = 2.1, rws = 0.5, aiws = 5;
    const x = mu * r, x0 = mu0 * r, xc = muc * r;
    let ypi0, tpi0, ypic, tpic, tpi;
    if (r <= small) {
      tpi = 3 * cpi ** 2 * r / mu ** 3;
      ypi0 = (C.mpi0 / C.mpic) ** 2 * (C.mpi0 / 3) * cpi * r / mu0;
      tpi0 = 3 * cpi * ypi0 / mu0 ** 2;
      ypic = (C.mpic / 3) * cpi * r / muc;
      tpic = 3 * cpi * ypic / muc ** 2;
    } else {
      const rcut = 1 - Math.exp(-cpi * r * r);
      const ypi = Math.exp(-x) * rcut / x;
      tpi = (1 + (3 + 3 / x) / x) * ypi * rcut;    // average pion mass, without f^2: the TPE-like shape T_pi^2
      ypi0 = (C.mpi0 / C.mpic) ** 2 * (C.mpi0 / 3) * Math.exp(-x0) * rcut / x0;
      tpi0 = (1 + (3 + 3 / x0) / x0) * ypi0 * rcut;
      ypic = (C.mpic / 3) * Math.exp(-xc) * rcut / xc;
      tpic = (1 + (3 + 3 / xc) / xc) * ypic * rcut;
    }
    ypi0 *= fsq; ypic *= fsq; tpi0 *= fsq; tpic *= fsq;
    const tpi2 = tpi * tpi;
    const ws = 1 / (1 + Math.exp((r - rws) * aiws));
    const ws0 = 1 / (1 + Math.exp(-rws * aiws));
    const wsp = ws * (1 + aiws * Math.exp(-rws * aiws) * ws0 * r);
    const wsx = ws * x, wsx2 = wsx * x;
    const dypi00 = (C.mpi0 / C.mpic) ** 2 * (C.mpi0 / 3) * cpi / mu0;
    const dypic0 = (C.mpic / 3) * cpi / muc;
    const ypi0p = ypi0 - fsq * dypi00 * ws * r / ws0;
    const ypicp = ypic - fsq * dypic0 * ws * r / ws0;
    const p11pp = -7.62701 * tpi2 + 1815.4920 * wsp + 1847.8059 * wsx2 + ypi0p;
    const p11np = -7.62701 * tpi2 + 1813.5315 * wsp + 1847.8059 * wsx2 - ypi0p + 2 * ypicp;
    const p11nn = -7.62701 * tpi2 + 1811.5710 * wsp + 1847.8059 * wsx2 + ypi0p;
    const pt1pp = 1.07985 * tpi2 - 190.0949 * wsx - 811.2040 * wsx2 + tpi0;
    const pt1np = 1.07985 * tpi2 - 190.0949 * wsx - 811.2040 * wsx2 - tpi0 + 2 * tpic;
    const pt1nn = 1.07985 * tpi2 - 190.0949 * wsx - 811.2040 * wsx2 + tpi0;
    const pls1 = -0.62697 * tpi2 - 570.5571 * wsp + 819.1222 * wsx2;
    const pl211 = 0.06709 * tpi2 + 342.0669 * wsp - 615.2339 * wsx2;
    const pls21 = 0.74129 * tpi2 + 9.3418 * wsp - 376.4384 * wsx2;
    const p10 = -8.62770 * tpi2 + 2605.2682 * wsp + 441.9733 * wsx2 - ypi0p - 2 * ypicp;
    const pt0 = 1.485601 * tpi2 - 1126.8359 * wsx + 370.1324 * wsx2 - tpi0 - 2 * tpic;
    const pls0 = 0.10180 * tpi2 + 86.0658 * wsp - 356.5175 * wsx2;
    const pl210 = -0.13201 * tpi2 + 253.4350 * wsp - 1.0076 * wsx2;
    const pls20 = 0.07357 * tpi2 - 217.5791 * wsp + 18.3935 * wsx2;
    const p01pp = -11.27028 * tpi2 + 3346.6874 * wsp - 3 * ypi0p;
    const p01np = -10.66788 * tpi2 + 3126.5542 * wsp - 3 * (-ypi0p + 2 * ypicp);
    const p01nn = -11.27028 * tpi2 + 3342.7664 * wsp - 3 * ypi0p;
    const pl201 = 0.12472 * tpi2 + 16.7780 * wsp;
    const p00 = -2.09971 * tpi2 + 1204.4301 * wsp - 3 * (-ypi0p - 2 * ypicp);
    const pl200 = -0.31452 * tpi2 + 217.4559 * wsp;
    const p11 = (p11pp + p11nn + p11np) / 3, p11cd = (0.5 * (p11pp + p11nn) - p11np) / 6;
    const pt1 = (pt1pp + pt1nn + pt1np) / 3, pt1cd = (0.5 * (pt1pp + pt1nn) - pt1np) / 6;
    const p01 = (p01pp + p01nn + p01np) / 3, p01cd = (0.5 * (p01pp + p01nn) - p01np) / 6, p01cs = (p01pp - p01nn) / 4;
    vnn[1] = 0.0625 * (9 * p11 + 3 * p10 + 3 * p01 + p00);
    vnn[2] = 0.0625 * (3 * p11 - 3 * p10 + p01 - p00);
    vnn[3] = 0.0625 * (3 * p11 + p10 - 3 * p01 - p00);
    vnn[4] = 0.0625 * (p11 - p10 - p01 + p00);
    vnn[5] = 0.25 * (3 * pt1 + pt0);
    vnn[6] = 0.25 * (pt1 - pt0);
    vnn[7] = 0.25 * (3 * pls1 + pls0);
    vnn[8] = 0.25 * (pls1 - pls0);
    vnn[9] = 0.0625 * (9 * pl211 + 3 * pl210 + 3 * pl201 + pl200);
    vnn[10] = 0.0625 * (3 * pl211 - 3 * pl210 + pl201 - pl200);
    vnn[11] = 0.0625 * (3 * pl211 + pl210 - 3 * pl201 - pl200);
    vnn[12] = 0.0625 * (pl211 - pl210 - pl201 + pl200);
    vnn[13] = 0.25 * (3 * pls21 + pls20);
    vnn[14] = 0.25 * (pls21 - pls20);
    vnn[15] = 0.25 * (3 * p11cd + p01cd);
    vnn[16] = 0.25 * (p11cd - p01cd);
    vnn[17] = pt1cd;
    vnn[18] = p01cs;
    // the one-pion-exchange part alone, for the page's decomposition (same terms as above with every
    // short-range strength set to zero and I = 0): ypi0p, ypicp, tpi0, tpic enter only through OPE
    vnn.ope = { p10: -ypi0p - 2 * ypicp, pt0: -tpi0 - 2 * tpic, p01np: -3 * (-ypi0p + 2 * ypicp), p11np: -ypi0p + 2 * ypicp, pt1np: -tpi0 + 2 * tpic };
    return vnn;
  }

  // ---------------------------------------------------------------- empot (lpot = 1, full EM)
  function empot(r) {
    const vem = new Float64Array(15);
    const small = 1e-5, b = 4.27, br = b * r, pi = Math.acos(-1), me = 0.510999, mr = C.mp * C.mn / (C.mp + C.mn);
    const gamma = 0.577216, beta = 0.0189, hc = C.hc, alpha = C.alpha, mp = C.mp, mn = C.mn, mup = C.mup, mun = C.mun;
    let fcoulr, ftr3, flsr3, kr;
    if (r < small) {
      fcoulr = 5 * b / 16; ftr3 = b ** 3 * br ** 2 / 720; flsr3 = b ** 3 / 48; kr = me * small / hc;
    } else {
      const e = Math.exp(-br);
      fcoulr = (1 - (1 + 11 * br / 16 + 3 * br ** 2 / 16 + br ** 3 / 48) * e) / r;
      ftr3 = (1 - (1 + br + br ** 2 / 2 + br ** 3 / 6 + br ** 4 / 24 + br ** 5 / 144) * e) / r ** 3;
      flsr3 = (1 - (1 + br + br ** 2 / 2 + 7 * br ** 3 / 48 + br ** 4 / 48) * e) / r ** 3;
      kr = me * r / hc;
    }
    const fivp = -gamma - 5 / 6 + Math.abs(Math.log(kr)) + 6 * pi * kr / 8;
    const fdelta = b ** 3 * (1 + br + br ** 2 / 3) * Math.exp(-br) / 16;
    const fnpr = b ** 3 * (15 + 15 * br + 6 * br ** 2 + br ** 3) * Math.exp(-br) / 384;
    vem[1] = alpha * hc * fcoulr;
    vem[2] = -alpha * hc ** 3 * fdelta / (4 * mp ** 2);
    vem[3] = -(vem[1] ** 2) / mp;
    vem[4] = 2 * alpha * vem[1] * fivp / (3 * pi);
    vem[5] = alpha * hc * beta * fnpr;
    vem[6] = -alpha * hc ** 3 * mup ** 2 * fdelta / (6 * mp ** 2);
    vem[7] = -alpha * hc ** 3 * mun ** 2 * fdelta / (6 * mn ** 2);
    vem[8] = -alpha * hc ** 3 * mup * mun * fdelta / (6 * mn * mp);
    vem[9] = -alpha * hc ** 3 * mup ** 2 * ftr3 / (4 * mp ** 2);
    vem[10] = -alpha * hc ** 3 * mun ** 2 * ftr3 / (4 * mn ** 2);
    vem[11] = -alpha * hc ** 3 * mup * mun * ftr3 / (4 * mp * mn);
    vem[12] = -alpha * hc ** 3 * (4 * mup - 1) * flsr3 / (2 * mp ** 2);
    vem[13] = 0;
    vem[14] = -alpha * hc ** 3 * mun * flsr3 / (2 * mn * mr);
    return vem;
  }

  /* ---------------------------------------------------------------- av18pw
     l, s, j, t, t1z, t2z as in the Fortran (t1z = +1 proton, -1 neutron). Returns [v11, v12, v22]
     (MeV); v12 = v22 = 0 for a single channel. opt: { tensor: scale of the strong tensor term
     (default 1), em: false drops the whole EM part, mm: false drops only the magnetic-moment terms
     (keeps C1(np)) }. */
  function av18pw(l, s, j, t, t1z, t2z, r, opt) {
    opt = opt || {};
    const vnn = av18op(r);
    const s1ds2 = 4 * s - 3, t1dt2 = 4 * t - 3, t12 = 3 * t1z * t2z - t1dt2;
    let vc = vnn[1] + t1dt2 * vnn[2] + s1ds2 * vnn[3] + s1ds2 * t1dt2 * vnn[4] + t12 * vnn[15] + s1ds2 * t12 * vnn[16] + (t1z + t2z) * vnn[18];
    let vt = (vnn[5] + t1dt2 * vnn[6] + t12 * vnn[17]) * (opt.tensor == null ? 1 : opt.tensor);
    let vls = vnn[7] + t1dt2 * vnn[8];
    const vl2 = vnn[9] + t1dt2 * vnn[10] + s1ds2 * vnn[11] + s1ds2 * t1dt2 * vnn[12];
    const vls2 = vnn[13] + t1dt2 * vnn[14];
    if (opt.em !== false) {
      const vem = empot(r), mm = opt.mm !== false ? 1 : 0;
      const tz = t1z + t2z;
      if (tz < 0) { vc += mm * s1ds2 * vem[7]; vt += mm * vem[10]; }
      else if (tz === 0) { vc += vem[5] + mm * s1ds2 * vem[8]; vt += mm * vem[11]; vls += mm * vem[14]; }
      else { vc += vem[1] + vem[2] + vem[3] + vem[4] + mm * s1ds2 * vem[6]; vt += mm * vem[9]; vls += mm * vem[12]; }
    }
    if (s === 1 && j > l) {
      const s12m = -2 * (j - 1) / (2 * j + 1), s12 = Math.sqrt(36 * j * (j + 1)) / (2 * j + 1), s12p = -2 * (j + 2) / (2 * j + 1);
      const lsm = j - 1, lsp = -(j + 2);
      return [vc + s12m * vt + lsm * vls + l * (l + 1) * vl2 + lsm * lsm * vls2, s12 * vt,
              vc + s12p * vt + lsp * vls + (l + 2) * (l + 3) * vl2 + lsp * lsp * vls2];
    }
    let s12 = 0;
    if (s === 1 && l === j) s12 = 2;
    if (l === j + 1) s12 = -2 * (j + 2) / (2 * j + 1);
    const ls = (j * (j + 1) - l * (l + 1) - s * (s + 1)) / 2;
    return [vc + s12 * vt + ls * vls + l * (l + 1) * vl2 + ls * ls * vls2, 0, 0];
  }

  // the np channels of the page: [l, s, j, t, coupled]
  const CH = { "1S0": [0, 0, 0, 1, false], "3S1": [0, 1, 1, 0, true] };
  const np = (ch, r, opt) => av18pw(CH[ch][0], CH[ch][1], CH[ch][2], CH[ch][3], 1, -1, r, opt);

  // ---------------------------------------------------------------- small 2x2 / 4x4 helpers
  function inv2(a, b, c, d) { const det = a * d - b * c; return [d / det, -b / det, -c / det, a / det]; }
  function det4(m) {                               // Gaussian elimination with partial pivoting
    const a = m.map((row) => row.slice());
    let det = 1;
    for (let k = 0; k < 4; k++) {
      let p = k; for (let i = k + 1; i < 4; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
      if (a[p][k] === 0) return 0;
      if (p !== k) { const t = a[p]; a[p] = a[k]; a[k] = t; det = -det; }
      det *= a[k][k];
      for (let i = k + 1; i < 4; i++) { const f = a[i][k] / a[k][k]; for (let j = k; j < 4; j++) a[i][j] -= f * a[k][j]; }
    }
    return det;
  }
  function null4(m) {                              // null vector of a (numerically) singular 4x4: x4 = 1
    const a = m.map((row) => row.slice());
    const piv = [];
    let row = 0;
    for (let col = 0; col < 4 && row < 4; col++) {
      let p = row; for (let i = row + 1; i < 4; i++) if (Math.abs(a[i][col]) > Math.abs(a[p][col])) p = i;
      const t = a[p]; a[p] = a[row]; a[row] = t;
      piv.push(col);
      for (let i = row + 1; i < 4; i++) { const f = a[i][col] / a[row][col]; for (let j = col; j < 4; j++) a[i][j] -= f * a[row][j]; }
      row++;
      if (row === 3) break;                        // rank 3: the last row is ~0, drop it
    }
    // back substitution on the 3x4 upper triangle with x3 = 1 (columns 0, 1, 2 pivots)
    const x = [0, 0, 0, 1];
    for (let i = 2; i >= 0; i--) { let s = a[i][3]; for (let j = i + 1; j < 3; j++) s += a[i][j] * x[j]; x[i] = -s / a[i][i]; }
    return x;
  }

  // ---------------------------------------------------------------- the 3S1-3D1 bound state
  // Riccati-Hankel functions for imaginary momentum (decaying): l = 0 and l = 2
  const hk0 = (z) => Math.exp(-z);
  const hk2 = (z) => Math.exp(-z) * (1 + 3 / z + 3 / (z * z));

  /* opt: { h (fm, default 0.01), rmax (40), rm (matching radius, 2 fm), tensor (1), em (true), mm (true),
            Bmin, Bmax (scan range in MeV, 1e-8 to 80: a state bound by less than Bmin is reported as not resolved,
            bound: false, not as absent) } */
  /* the potential matrix on the grid (the expensive part). The unscaled potential and the strong T = 0
     tensor function v_t = v5 - 3 v6 are cached per (h, rmax, em, mm); a tensor scale lam then only adds
     (lam - 1) v_t S12, with S12 = 0, sqrt 8, -2 in the 3S1, 3S1-3D1, 3D1 entries (av18pw's s12m, s12, s12p
     at J = 1), the same as av18pw with vt scaled. */
  const BMIN = 1e-8;                               // the smallest binding the search resolves, MeV
  const RCAP = 2000;                               // the largest box, fm
  const GCACHE = new Map();
  function baseGrid(h, rmax, opt) {
    const key = [h, rmax, opt.em !== false, opt.mm !== false].join();
    if (GCACHE.has(key)) return GCACHE.get(key);
    const n = Math.round(rmax / h), r = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) r[i] = i * h;
    const v11 = new Float64Array(n + 1), v12 = new Float64Array(n + 1), v22 = new Float64Array(n + 1), vt = new Float64Array(n + 1);
    const o = { em: opt.em, mm: opt.mm };
    for (let i = 0; i <= n; i++) {
      const x = i ? r[i] : 0, v = np("3S1", x, o), w = av18op(x);
      v11[i] = v[0]; v12[i] = v[1]; v22[i] = v[2]; vt[i] = w[5] - 3 * w[6];
    }
    const G = { h, n, r, v11, v12, v22, vt, rmax: n * h };
    if (GCACHE.size > 8) GCACHE.delete(GCACHE.keys().next().value);
    GCACHE.set(key, G);
    return G;
  }
  function grid(opt) {
    const B = baseGrid(opt.h || 0.01, opt.rmax || 40, opt), lam = opt.tensor == null ? 1 : opt.tensor;
    if (lam === 1) return B;
    const n = B.n, v12 = new Float64Array(n + 1), v22 = new Float64Array(n + 1), s8 = Math.sqrt(8);
    for (let i = 0; i <= n; i++) { v12[i] = B.v12[i] + (lam - 1) * s8 * B.vt[i]; v22[i] = B.v22[i] - 2 * (lam - 1) * B.vt[i]; }
    return Object.assign({}, B, { v12, v22 });
  }
  /* is the deuteron bound at tensor scale lam? (a sign change of the matching determinant between
     B = Bmin and 80 MeV); and the critical scale where it stops being bound, by bisection */
  function isBound(lam, Bmin) {
    const G = grid({ tensor: lam, rmax: 70 }), m = Math.round(2 / G.h);
    let prev = matchDet(G, 80, m);
    const lo = Math.log(Bmin || BMIN), hi = Math.log(80);
    for (let k = 1; k <= 70; k++) { const F = matchDet(G, Math.exp(hi + (lo - hi) * k / 70), m); if (Math.sign(F) !== Math.sign(prev)) return true; prev = F; }
    return false;
  }
  function lambdaC() {
    let a = 0.5, b = 1;                              // unbound at a, bound at b
    for (let it = 0; it < 16; it++) { const c = 0.5 * (a + b); if (isBound(c)) b = c; else a = c; }
    return 0.5 * (a + b);
  }
  // W = (V + B)/H2M + diag(0, 6/r^2): psi'' = W psi (E = -B)
  function Wat(G, i, B) {
    const r = G.r[i];
    return [(G.v11[i] + B) / H2M, G.v12[i] / H2M, (G.v22[i] + B) / H2M + (i ? 6 / (r * r) : 0)];
  }
  // matrix Numerov: T_n = (1 - h^2/12 W_n) psi_n; T_{n+1} = 12 psi_n - 10 T_n - T_{n-1}
  // psi is a 2x2 matrix [[u_a, u_b], [w_a, w_b]] stored as [u_a, u_b, w_a, w_b]
  function numerov(G, B, i0, i1, init0, init1, keep) {
    const h12 = G.h * G.h / 12, dir = i1 > i0 ? 1 : -1;
    const T = (i, p) => { const W = Wat(G, i, B); return [p[0] - h12 * (W[0] * p[0] + W[1] * p[2]), p[1] - h12 * (W[0] * p[1] + W[1] * p[3]), p[2] - h12 * (W[1] * p[0] + W[2] * p[2]), p[3] - h12 * (W[1] * p[1] + W[2] * p[3])]; };
    const psiOf = (i, t) => {                      // psi = (1 - h^2/12 W)^-1 T
      const W = Wat(G, i, B), m = inv2(1 - h12 * W[0], -h12 * W[1], -h12 * W[1], 1 - h12 * W[2]);
      return [m[0] * t[0] + m[1] * t[2], m[0] * t[1] + m[1] * t[3], m[2] * t[0] + m[3] * t[2], m[2] * t[1] + m[3] * t[3]];
    };
    let tm = init0.T || T(i0, init0), p = init1, t = T(i0 + dir, p);
    const out = keep ? [] : null;
    if (keep) { out[i0] = init0.slice(0, 4); out[i0 + dir] = p; }
    for (let i = i0 + dir; i !== i1; i += dir) {
      const tn = [12 * p[0] - 10 * t[0] - tm[0], 12 * p[1] - 10 * t[1] - tm[1], 12 * p[2] - 10 * t[2] - tm[2], 12 * p[3] - 10 * t[3] - tm[3]];
      tm = t; t = tn; p = psiOf(i + dir, t);
      if (keep) out[i + dir] = p;
      // rescale both columns together when they grow (keeps the ratio, i.e. the solution space)
      const s = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]), Math.abs(p[3]));
      if (s > 1e100 && !keep) { const f = 1 / s; for (let k = 0; k < 4; k++) { p[k] *= f; t[k] *= f; tm[k] *= f; } }
    }
    return keep ? out : { last: p, prev: psiOf(i1 - dir, tm) };
  }
  function outward(G, B, m, keep) {
    const h = G.h, z = [0, 0, 0, 0]; z.T = [0, 0, 0, 0];      // T_0 = 0: psi(0) = 0 and W psi -> 0 for l = 0, 2
    return numerov(G, B, 0, m + 1, z, [h, 0, 0, h * h * h], keep);
  }
  function inward(G, B, m, keep) {
    const k = Math.sqrt(B / H2M), n = G.n;
    const a = (i) => [hk0(k * G.r[i]), 0, 0, hk2(k * G.r[i])];
    return numerov(G, B, n, m - 1, a(n), a(n - 1), keep);
  }
  function matchDet(G, B, m) {
    const o = outward(G, B, m);                    // o.prev = psi(m), o.last = psi(m + 1)
    const om = o.prev, om1 = o.last;
    const ii = numerovPair(G, B, m);
    const col = (v) => { const s = Math.hypot(...v); return v.map((x) => x / s); };
    const A = [col([om[0], om[2], om1[0], om1[2]]), col([om[1], om[3], om1[1], om1[3]]), col([ii.m[0], ii.m[2], ii.m1[0], ii.m1[2]]), col([ii.m[1], ii.m[3], ii.m1[1], ii.m1[3]])];
    return det4([[A[0][0], A[1][0], A[2][0], A[3][0]], [A[0][1], A[1][1], A[2][1], A[3][1]], [A[0][2], A[1][2], A[2][2], A[3][2]], [A[0][3], A[1][3], A[2][3], A[3][3]]]);
  }
  // inward solutions at m and m + 1
  function numerovPair(G, B, m) {
    const r2 = inward(G, B, m + 1);                // stops at m: last = psi(m), prev = psi(m + 1)
    return { m: r2.last, m1: r2.prev };
  }

  function bound(opt) {
    opt = Object.assign({ h: 0.01, rmax: 40, rm: 2 }, opt || {});
    const G = grid(opt);
    const m = Math.round(opt.rm / G.h);
    const f = (B) => matchDet(G, B, m);
    // scan for a sign change, deepest first (the deuteron is the only bound state)
    const Bs = [], nB = 80, lo = Math.log(opt.Bmin || BMIN), hi = Math.log(opt.Bmax || 80);
    for (let k = 0; k <= nB; k++) Bs.push(Math.exp(hi + (lo - hi) * k / nB));
    let a = null, b = null, fa, fb, prevB = Bs[0], prevF = f(Bs[0]);
    for (let k = 1; k <= nB; k++) {
      const F = f(Bs[k]);
      if (F === 0 || Math.sign(F) !== Math.sign(prevF)) { a = Bs[k]; b = prevB; fa = F; fb = prevF; break; }
      prevB = Bs[k]; prevF = F;
    }
    if (a == null) return { bound: false, G };
    // Illinois false position on [a, b]
    let side = 0;
    for (let it = 0; it < 200 && Math.abs(b - a) > 1e-14 * b; it++) {
      const c = (a * fb - b * fa) / (fb - fa), fc = f(c);
      if (fc === 0) { a = b = c; break; }
      if (Math.sign(fc) === Math.sign(fb)) { b = c; fb = fc; if (side === -1) fa /= 2; side = -1; }
      else { a = c; fa = fc; if (side === 1) fb /= 2; side = 1; }
    }
    const B = 0.5 * (a + b);
    /* the box: rmax >= 16/kappa, else solve again in a larger box, bracketing near the B just found (a wide scan
       would start the inward solutions at e^{-kappa rmax} = 0). Beyond rmax the tail is added analytically (wave()),
       but without the 1/r^3 magnetic-moment tensor, which still feeds the D wave out there: near threshold that
       moves Q (0.4 % at tensor x 0.73 between 400 and 2000 fm). The box is capped at RCAP; a capped solution is
       flagged (capped: true) and its Q and eta are approximate. */
    const kap = Math.sqrt(B / H2M), need = Math.ceil(16 / kap);
    if (Math.min(RCAP, need) > G.rmax + 1e-9) return bound(Object.assign({}, opt, { rmax: Math.min(RCAP, need), Bmin: B / 1.5, Bmax: B * 1.5 }));
    return Object.assign({ bound: true, B, G, capped: need > G.rmax + 1e-9 }, wave(G, B, m));
  }

  // wave functions, normalization and observables at the eigenvalue
  function wave(G, B, m) {
    const O = outward(G, B, m, true), I = inward(G, B, m, true);
    // coefficients: O c = I d at m and m + 1
    const M = [[O[m][0], O[m][1], -I[m][0], -I[m][1]], [O[m][2], O[m][3], -I[m][2], -I[m][3]],
               [O[m + 1][0], O[m + 1][1], -I[m + 1][0], -I[m + 1][1]], [O[m + 1][2], O[m + 1][3], -I[m + 1][2], -I[m + 1][3]]];
    const sc = [1, 1, 1, 1].map((_, j) => Math.hypot(M[0][j], M[1][j], M[2][j], M[3][j]));
    const Ms = M.map((row) => row.map((v, j) => v / sc[j]));
    const xs = null4(Ms), x = xs.map((v, j) => v / sc[j]);
    const n = G.n, u = new Float64Array(n + 1), w = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const P = i <= m ? O[i] : I[i], c0 = i <= m ? x[0] : x[2], c1 = i <= m ? x[1] : x[3];
      u[i] = P[0] * c0 + P[1] * c1; w[i] = P[2] * c0 + P[3] * c1;
    }
    // Simpson (n even)
    const simpson = (fn) => { let s = fn(0) + fn(n); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fn(i); return s * G.h / 3; };
    const kap = Math.sqrt(B / H2M);
    /* the free tail beyond rmax: there u = a e^{-kr} and w = d e^{-kr}(1 + 3/kr + 3/(kr)^2) exactly (the inward
       columns start on these functions; the 1/r^3 magnetic tail is neglected out there), integrated in
       z = 2 kappa (r - rmax) from 0 to 60 by Simpson. Negligible for the deuteron (rmax = 16/kappa), essential near
       threshold, where rmax is capped at 400 fm. */
    const a = x[2], d = x[3], R = G.rmax, NZ = 3000, dz = 60 / NZ;
    let tN = 0, tD = 0, tr2 = 0, tQ = 0;
    for (let k = 0; k <= NZ; k++) {
      const z = k * dz, r = R + z / (2 * kap), y = kap * r, e = Math.exp(-2 * kap * R - z), f = 1 + 3 / y + 3 / (y * y);
      const wt = (k === 0 || k === NZ ? 1 : k % 2 ? 4 : 2) * dz / 3 / (2 * kap);
      const uu = a * a * e, ww = d * d * e * f * f, uw = a * d * e * f;
      tN += wt * (uu + ww); tD += wt * ww; tr2 += wt * r * r * (uu + ww); tQ += wt * r * r * (Math.SQRT2 / 10 * uw - ww / 20);
    }
    const N2 = simpson((i) => u[i] * u[i] + w[i] * w[i]) + tN;
    const sgn = u[Math.round(1.5 / G.h)] < 0 ? -1 : 1;
    const nrm = sgn / Math.sqrt(N2), n2 = 1 / N2;
    for (let i = 0; i <= n; i++) { u[i] *= nrm; w[i] *= nrm; }
    const AS = a * nrm, AD = d * nrm;                // inward columns started as pure e^{-kr} and h2(kr) at rmax
    const PD = simpson((i) => w[i] * w[i]) + tD * n2;
    const r2 = simpson((i) => G.r[i] * G.r[i] * (u[i] * u[i] + w[i] * w[i])) + tr2 * n2;
    const Q = Math.SQRT2 / 10 * simpson((i) => G.r[i] * G.r[i] * u[i] * w[i]) - simpson((i) => G.r[i] * G.r[i] * w[i] * w[i]) / 20 + tQ * n2;
    const tail = tN * n2;                            // probability beyond rmax
    const mus = C.mup + C.mun;
    const mu = mus - 1.5 * (mus - 0.5) * PD;
    return { kappa: kap, u, w, r: G.r, h: G.h, PD, Q, rd: 0.5 * Math.sqrt(r2), r2, mu, AS, AD, eta: AD / AS, m, tail };
  }

  // <V> split into the EM part and the rest, and <T> = -B - <V>
  function expectations(sol, opt) {
    const G = sol.G, n = G.n, u = sol.u, w = sol.w;
    const em = new Float64Array(n + 1), all = new Float64Array(n + 1), ope = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const r = G.r[i];
      const vf = [G.v11[i], G.v12[i], G.v22[i]];
      const vs = np("3S1", r, Object.assign({}, opt, { em: false }));
      const q = (v) => v[0] * u[i] * u[i] + 2 * v[1] * u[i] * w[i] + v[2] * w[i] * w[i];
      all[i] = q(vf); em[i] = q(vf) - q(vs);
    }
    const simpson = (a) => { let s = a[0] + a[n]; for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * a[i]; return s * G.h / 3; };
    const V = simpson(all), VEM = simpson(em);
    return { V, VEM, T: -sol.B - V };
  }

  /* ---------------------------------------------------------------- the deuteron density
     psi_M = (u/r) Y00 chi_1M + (w/r) [Y2 x chi_1]^1_M. Summed over spins, the density of the relative
     coordinate is axially symmetric:
       rho_M(r, theta) = [u^2 + w^2 + (3M^2 - 2)(sqrt2 u w - w^2/2) P2(cos theta)] / (4 pi r^2)
     (tests/check_deuteron.jl checks it against an explicit Clebsch-Gordan sum over the spin states).
     Its quadrupole moment, (1/4) of that of the relative coordinate per nucleon, is Q above for M = 1. */
  function density(u, w, M, c) {
    const P2 = 0.5 * (3 * c * c - 1);
    return u * u + w * w + (3 * M * M - 2) * (Math.SQRT2 * u * w - 0.5 * w * w) * P2;   // times 1/(4 pi r^2)
  }

  // ---------------------------------------------------------------- scattering
  // Riccati-Bessel: jh = x j_l(x) ~ sin(x - l pi/2), nh = -x y_l(x) ~ cos(x - l pi/2)
  function rb(l, x) {
    const s = Math.sin(x), c = Math.cos(x);
    if (l === 0) return [s, c];
    if (l === 2) return [(3 / (x * x) - 1) * s - 3 * c / x, (3 / (x * x) - 1) * c + 3 * s / x];
    throw new Error("l");
  }
  /* kinematics: k in fm^-1 from T_lab (MeV), nonrelativistic as in the paper: a neutron beam on a proton,
     E_cm = T M_p/(M_p + M_n) = T M_r/M_n, k^2 = E_cm/(hbar^2/2M_r). (For np the relativistic c.m. momentum
     differs from this by less than 1e-7 up to 350 MeV: for nearly equal masses the two agree.) */
  function kOf(T) { return Math.sqrt(T * MR / C.mn / H2M); }
  /* phases at momentum k (fm^-1) in channel "1S0" or "3S1" (coupled with 3D1). opt: { h (0.01), R (match, 20 fm),
     em, mm, tensor }. Returns degrees: { d } or { d1, d2, eps } (nuclear bar), and K. */
  function phases(ch, k, opt) {
    opt = Object.assign({ h: 0.01, R: 20 }, opt || {});
    const h = opt.h, n = Math.round(opt.R / h), E = k * k * H2M, h12 = h * h / 12;
    if (!CH[ch][4]) {
      // single channel, l = 0
      let um = 0, uc = h, tm = 0, tc;
      const W = (r) => (np(ch, r, opt)[0] - E) / H2M;
      tc = uc * (1 - h12 * W(h));
      for (let i = 1; i < n; i++) {
        const tn = 12 * uc - 10 * tc - tm; tm = tc; tc = tn; um = uc; uc = tn / (1 - h12 * W((i + 1) * h));
      }
      const r1 = (n - 1) * h, r2 = n * h, a = rb(0, k * r1), b = rb(0, k * r2);
      // u = A (jh + K nh): u1/u2 = (j1 + K n1)/(j2 + K n2)
      const K = (um * b[0] - uc * a[0]) / (uc * a[1] - um * b[1]);
      return { d: Math.atan(K) * 180 / Math.PI, K };
    }
    // coupled 3S1-3D1
    const V = new Array(n + 1);
    for (let i = 1; i <= n; i++) V[i] = np(ch, i * h, opt);
    const Wm = (i) => { const r = i * h, v = V[i]; return [(v[0] - E) / H2M, v[1] / H2M, (v[2] - E) / H2M + 6 / (r * r)]; };
    const T = (i, p) => { const W = Wm(i); return [p[0] - h12 * (W[0] * p[0] + W[1] * p[2]), p[1] - h12 * (W[0] * p[1] + W[1] * p[3]), p[2] - h12 * (W[1] * p[0] + W[2] * p[2]), p[3] - h12 * (W[1] * p[1] + W[2] * p[3])]; };
    const psiOf = (i, t) => { const W = Wm(i), m = inv2(1 - h12 * W[0], -h12 * W[1], -h12 * W[1], 1 - h12 * W[2]); return [m[0] * t[0] + m[1] * t[2], m[0] * t[1] + m[1] * t[3], m[2] * t[0] + m[3] * t[2], m[2] * t[1] + m[3] * t[3]]; };
    let tm = [0, 0, 0, 0], p = [h, 0, 0, h * h * h], t = T(1, p), pm = null;
    for (let i = 1; i < n; i++) {
      const tn = [0, 1, 2, 3].map((q) => 12 * p[q] - 10 * t[q] - tm[q]);
      tm = t; t = tn; pm = p; p = psiOf(i + 1, t);
      const s = Math.max(...p.map(Math.abs));
      if (s > 1e50) for (let q = 0; q < 4; q++) { p[q] /= s; t[q] /= s; tm[q] /= s; pm[q] /= s; }
    }
    // psi(r) = J(r) A + N(r) B at r1 = (n-1)h and r2 = nh; per column c and channel a:
    // psi_a,c(r) = j_a(r) A_ac + n_a(r) B_ac  =>  2 equations per (a, c) for (A_ac, B_ac)
    const r1 = (n - 1) * h, r2 = n * h, L = [0, 2];
    const A = [0, 0, 0, 0], Bm = [0, 0, 0, 0];
    for (let a = 0; a < 2; a++) {
      const x1 = rb(L[a], k * r1), x2 = rb(L[a], k * r2), dt = x1[0] * x2[1] - x1[1] * x2[0];
      for (let c = 0; c < 2; c++) {
        const y1 = pm[2 * a + c], y2 = p[2 * a + c];
        A[2 * a + c] = (y1 * x2[1] - y2 * x1[1]) / dt;
        Bm[2 * a + c] = (x1[0] * y2 - x2[0] * y1) / dt;
      }
    }
    const Ai = inv2(A[0], A[1], A[2], A[3]);
    let K = [Bm[0] * Ai[0] + Bm[1] * Ai[2], Bm[0] * Ai[1] + Bm[1] * Ai[3], Bm[2] * Ai[0] + Bm[3] * Ai[2], Bm[2] * Ai[1] + Bm[3] * Ai[3]];
    const K12 = 0.5 * (K[1] + K[2]);
    return Object.assign(barPhases(K[0], K12, K[3]), { K: [K[0], K12, K[3]], asym: Math.abs(K[1] - K[2]) });
  }
  /* S = (1 + iK)(1 - iK)^-1 for real symmetric K (2x2), then the bar parametrization (degrees).
     d1, d2 are defined mod 180 deg; they are put on the branch nearest ref1, ref2 (continuity in energy),
     and only then is eps read from S12 = i sin 2eps e^{i(d1 + d2)}, whose sign depends on that branch. */
  function barPhases(k11, k12, k22, ref1, ref2) {
    const dr = 1 - k11 * k22 + k12 * k12, di = -(k11 + k22), dd = dr * dr + di * di;   // det(1 - iK)
    // numerators: S11 = (1 + i k11)(1 - i k22) + (i k12)(i k12), S12 = (1 + i k11)(i k12) + (i k12)(1 - i k11)
    const n11 = [1 + k11 * k22 - k12 * k12, k11 - k22], n22 = [1 + k11 * k22 - k12 * k12, k22 - k11], n12 = [0, 2 * k12];
    const div = (a) => [(a[0] * dr + a[1] * di) / dd, (a[1] * dr - a[0] * di) / dd];
    const s11 = div(n11), s22 = div(n22), s12 = div(n12);
    const deg = 180 / Math.PI;
    const near = (x, ref) => { if (ref == null) return x; while (x - ref > 90) x -= 180; while (x - ref < -90) x += 180; return x; };
    const d1 = near(0.5 * Math.atan2(s11[1], s11[0]) * deg, ref1), d2 = near(0.5 * Math.atan2(s22[1], s22[0]) * deg, ref2);
    const ph = -(d1 + d2) / deg;
    const s2e = s12[0] * Math.sin(ph) + s12[1] * Math.cos(ph);          // Im(S12 e^{-i(d1 + d2)})
    const c2e = Math.hypot(s11[0], s11[1]);
    return { d1, d2, eps: 0.5 * Math.atan2(s2e, c2e) * deg };
  }

  /* phase-shift curves on an increasing energy list, continuous in energy (each phase is defined mod 180
     deg; 3S1 starts at 180 deg at threshold because the deuteron is bound: Levinson's theorem) */
  function curves(Ts, opt) {
    const out = { T: Ts.slice(), "1S0": [], "3S1": [], eps1: [], "3D1": [] };
    let p1 = 60, p3 = opt && opt.unbound ? 0 : 180, pd = 0;   // opt.unbound: no bound state, 3S1 starts at 0
    for (const T of Ts) {
      const k = kOf(T), s = phases("1S0", k, opt), c = phases("3S1", k, opt);
      while (s.d - p1 > 90) s.d -= 180; while (s.d - p1 < -90) s.d += 180;
      const b = barPhases(c.K[0], c.K[1], c.K[2], p3, pd);
      p1 = s.d; p3 = b.d1; pd = b.d2;
      out["1S0"].push(p1); out["3S1"].push(p3); out["3D1"].push(pd); out.eps1.push(b.eps);
    }
    return out;
  }

  /* effective range: k cot(delta) = -1/a + r k^2/2 + v k^4 ..., least-squares in k^2 on a few small
     momenta (cubic in k^2); delta the 1S0 phase or the nuclear-bar 3S1 phase */
  function effRange(ch, opt) {
    const ks = [], ys = [];
    for (let i = 1; i <= 8; i++) {
      const k = 0.005 * i;
      const p = phases(ch, k, opt), d = (ch === "1S0" ? p.d : p.d1) * Math.PI / 180;
      ks.push(k * k); ys.push(k / Math.tan(d));
    }
    // fit y = c0 + c1 x + c2 x^2 + c3 x^3
    const n = 4, Ata = Array.from({ length: n }, () => new Array(n).fill(0)), Aty = new Array(n).fill(0);
    for (let i = 0; i < ks.length; i++) { const row = [1, ks[i], ks[i] ** 2, ks[i] ** 3]; for (let a = 0; a < n; a++) { Aty[a] += row[a] * ys[i]; for (let b = 0; b < n; b++) Ata[a][b] += row[a] * row[b]; } }
    for (let k = 0; k < n; k++) { for (let i = k + 1; i < n; i++) { const f = Ata[i][k] / Ata[k][k]; for (let j = k; j < n; j++) Ata[i][j] -= f * Ata[k][j]; Aty[i] -= f * Aty[k]; } }
    const c = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = Aty[i]; for (let j = i + 1; j < n; j++) s -= Ata[i][j] * c[j]; c[i] = s / Ata[i][i]; }
    return { a: -1 / c[0], r: 2 * c[1] };
  }

  /* ---------------------------------------------------------------- toy: one square well, l = 0
     V = -V0 for r < R. Bound when sqrt(V0/H2M) R > pi/2; then x = kR in (pi/2, pi) with
     x cot x = -y, x^2 + y^2 = V0 R^2/H2M (y = kappa R). u = sin(kr) inside, sin(kR) e^{-kappa(r - R)} outside. */
  function toy(V0, R) {
    const X2 = V0 * R * R / H2M, X = Math.sqrt(Math.max(0, X2));
    const res = { V0, R, X, bound: X > Math.PI / 2 };
    // scattering length at zero energy: a = R - tan(X R/R)/... = R (1 - tan X / X)
    res.a = R * (1 - Math.tan(X) / X);
    if (!res.bound) return res;
    let lo = Math.PI / 2, hi = Math.min(Math.PI, X);
    const f = (x) => x / Math.tan(x) + Math.sqrt(Math.max(0, X2 - x * x));
    for (let it = 0; it < 200; it++) { const mid = 0.5 * (lo + hi); if (f(mid) > 0) lo = mid; else hi = mid; }
    const x = 0.5 * (lo + hi), y = Math.sqrt(X2 - x * x), k = x / R, kap = y / R;
    // normalization: int_0^R sin^2 + sin^2(kR)/(2 kappa)
    const sR = Math.sin(x), Iin = R / 2 - Math.sin(2 * x) / (4 * k), Iout = sR * sR / (2 * kap), N = Iin + Iout;
    // <r^2>: inside int r^2 sin^2(kr), outside sin^2(kR) int_R^inf r^2 e^{-2 kappa (r - R)}
    const r2in = R ** 3 / 6 - (R * R / (4 * k) - 1 / (8 * k ** 3)) * Math.sin(2 * x) - R * Math.cos(2 * x) / (4 * k * k);
    const r2out = sR * sR * (R * R / (2 * kap) + R / (2 * kap * kap) + 1 / (4 * kap ** 3));
    return Object.assign(res, { B: kap * kap * H2M, k, kappa: kap, Pout: Iout / N, rms: Math.sqrt((r2in + r2out) / N), rd: 0.5 * Math.sqrt((r2in + r2out) / N), norm: 1 / Math.sqrt(N), sR });
  }
  function toyU(T, r) { return T.norm * (r < T.R ? Math.sin(T.k * r) : T.sR * Math.exp(-T.kappa * (r - T.R))); }
  // the well depth that binds by B at radius R
  function toyDepth(B, R) {
    const kap = Math.sqrt(B / H2M);
    let lo = (Math.PI / 2) ** 2 * H2M / (R * R), hi = Math.PI ** 2 * H2M / (R * R);
    for (let it = 0; it < 200; it++) { const mid = 0.5 * (lo + hi); const t = toy(mid, R); if (t.bound && t.kappa > kap) hi = mid; else lo = mid; }
    return 0.5 * (lo + hi);
  }

  const DEUT = { BMIN, RCAP, C, MR, H2M, av18op, empot, av18pw, np, grid, bound, isBound, lambdaC, expectations, density, phases, barPhases, kOf, curves, effRange, toy, toyU, toyDepth, rb };
  if (typeof module !== "undefined" && module.exports) module.exports = DEUT; else root.DEUT = DEUT;
})(typeof window !== "undefined" ? window : this);
