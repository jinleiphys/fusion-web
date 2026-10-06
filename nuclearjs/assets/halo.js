/* ------------------------------------------------------------------ *
 * Core + one nucleon: a bound state at a prescribed separation energy.
 *
 * Two-body Hamiltonian in the relative coordinate r (core to nucleon):
 *   H = -hbar^2/(2 mu) d2/dr2 + hbar^2 l(l+1)/(2 mu r^2) + U(r)
 *   U(r) = -D f(r) + Vls r0^2 (1/r) df/dr <l.s> + Vc(r)      (Vc for a proton only)
 *   f(r) = 1/(1 + exp((r - R)/a)),  R = r0 Ac^(1/3)
 *   Vc  = Zc e^2/r outside Rc = R, uniformly charged sphere inside
 *   mu  = m_N M_c/(m_N + M_c), M_c the nuclear mass of the core
 * The depth D is the only free number: it is adjusted until the state with
 * nr radial nodes sits at E = -S. Spin-orbit strength, radius and
 * diffuseness are held fixed.
 *
 * Numerics. Beyond r_out = R + 25 a the nuclear potential is below
 * 1e-9 MeV and dropped, so there the bound state is exactly
 *   u(r) = b W_{-eta, l+1/2}(2 kappa r),  kappa = sqrt(2 mu S)/hbar,
 *   eta = Zc e^2 mu/(hbar^2 kappa)  (eta = 0 for a neutron),
 * with b the asymptotic normalization coefficient (ANC). For eta = 0 the
 * Whittaker function is e^{-x} times a finite polynomial in 1/x (x = kappa r);
 * for eta > 0 it is evaluated from its Laplace integral representation
 * (DLMF 13.16.5). Inside r_out: Numerov on a uniform grid.
 * Depth by bisection on a node count: the number of zeros on (0, inf) of the
 * regular solution at fixed E equals the number of bound states below E
 * (Sturm). Zeros inside r_out are counted on the grid; whether one more
 * lies beyond r_out follows from the sign of the growing component, read off
 * the discrete Wronskian with the exact decaying tail. The bound state itself
 * is outward Numerov to R joined to inward Numerov started on the exact tail,
 * so the matching constant is b directly. Normalization and moments add the
 * tail integral to infinity on a logarithmic grid, so no box radius enters.
 *
 * Plain script: window.HALO in a browser, module.exports in Node.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var HBARC = 197.3269804, E2 = 1.439964547;
  var MASS = { n: 939.5654205, p: 938.2720882 };

  // ln Gamma, Lanczos (g = 7, 9 terms), relative error ~1e-15 for x > 0
  var LC = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    var s = LC[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) s += LC[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
  }

  /* W_{-eta, l+1/2}(z), z = 2 kappa r. Returned as {m, e} with W = m * exp(e), so that
     neither the far tail nor small z over- or underflows.
     eta = 0: W = e^{-x} sum_k (l+k)!/(k!(l-k)!) (2x)^{-k}, x = z/2  (DLMF 10.49.12).
     eta > 0: W = z^{-eta} e^{-z/2} J/Gamma(l+1+eta),
              J = int_0^inf e^{-s} s^{l+eta} (1 + s/z)^{l-eta} ds, with s = w^2, Simpson. */
  var NW = 400, WMAX = 9.5;
  function whittaker(eta, l, z) {
    if (eta === 0) {
      var x = z / 2, sum = 0, c = 1;
      for (var k = 0; k <= l; k++) {
        if (k > 0) c *= (l + k) * (l - k + 1) / k;          // (l+k)!/(k!(l-k)!)
        sum += c / Math.pow(2 * x, k);
      }
      return { m: sum, e: -x };
    }
    var a = l + eta, b = l - eta, h = WMAX / NW, J = 0;
    for (var i = 1; i <= NW; i++) {
      var w = i * h, s = w * w;
      var g = 2 * Math.exp(-s + (2 * a + 1) * Math.log(w) + b * Math.log1p(s / z));
      J += (i === NW ? 1 : (i % 2 ? 4 : 2)) * g;
    }
    J *= h / 3;
    return { m: J, e: -eta * Math.log(z) - z / 2 - lgamma(l + 1 + eta) };
  }

  function setup(c) {
    var Ac = c.Zc + c.Nc;
    // optional overrides (quasifree.js): c.mq, c.Mc masses in MeV of the bound particle and the core,
    // c.zq its charge (an alpha cluster: zq = 2). Absent, the behaviour is the original one.
    var mq = c.mq != null ? c.mq : MASS[c.q], Mc = c.Mc != null ? c.Mc : c.Zc * MASS.p + c.Nc * MASS.n - c.Bc;
    var mu = mq * Mc / (mq + Mc);
    var r0 = c.r0 != null ? c.r0 : 1.27, a = c.a != null ? c.a : 0.67;
    var Vls = c.Vls != null ? c.Vls : 22, h = c.h || 0.02;
    var R = r0 * Math.cbrt(Ac), Rc = R;
    var rout = R + 25 * a, n = Math.round(rout / h);
    rout = n * h;
    var C = HBARC * HBARC / (2 * mu);                      // hbar^2/(2 mu), MeV fm^2
    var zz = c.zq != null ? c.zq * c.Zc : (c.q === 'p' ? c.Zc : 0);
    var j = c.j2 / 2, ls = 0.5 * (j * (j + 1) - c.l * (c.l + 1) - 0.75);
    var r = new Float64Array(n + 2), f = new Float64Array(n + 2), rest = new Float64Array(n + 2);
    for (var i = 0; i <= n + 1; i++) {
      var x = i * h, e = Math.exp((x - R) / a);
      r[i] = x; f[i] = 1 / (1 + e);
      var dfr = i === 0 ? 0 : -e / (a * (1 + e) * (1 + e)) / x;
      var vc = zz ? (x < Rc ? zz * E2 / (2 * Rc) * (3 - x * x / (Rc * Rc)) : zz * E2 / x) : 0;
      rest[i] = Vls * r0 * r0 * dfr * ls + vc;
    }
    var kappa = Math.sqrt(c.S / C), eta = zz * E2 / (2 * C * kappa);
    return { c: c, mu: mu, Mc: Mc, R: R, Rc: Rc, a: a, r0: r0, Vls: Vls, h: h, n: n, rout: rout, C: C,
      r: r, f: f, rest: rest, kappa: kappa, eta: eta, E: -c.S, l: c.l, m: Math.round(R / h) };
  }

  function k2arr(G, D, out) {
    var ll = G.l * (G.l + 1);
    out[0] = 0;
    for (var i = 1; i <= G.n + 1; i++) out[i] = (G.E + D * G.f[i] - G.rest[i]) / G.C - ll / (G.r[i] * G.r[i]);
    return out;
  }
  function start(l) { return Math.max(1, Math.ceil(Math.sqrt(l * (l + 1) / 1.2))); }

  // exact tail at grid points n-1 and n (relative values, common scale)
  function tailPair(G) {
    var w1 = whittaker(G.eta, G.l, 2 * G.kappa * G.r[G.n - 1]), w2 = whittaker(G.eta, G.l, 2 * G.kappa * G.r[G.n]);
    return { d1: w1.m, d2: w2.m * Math.exp(w2.e - w1.e), e1: w1.e };
  }

  // number of bound states below E for depth D (zeros of the regular solution on (0, inf))
  function count(G, D, k2, T) {
    k2arr(G, D, k2);
    var h2 = G.h * G.h / 12, n = G.n, i0 = start(G.l);
    var u0 = Math.pow((i0 - 1) * G.h, G.l + 1), u1 = Math.pow(i0 * G.h, G.l + 1), cnt = 0;
    for (var i = i0; i < n; i++) {
      var u2 = (2 * u1 * (1 - 5 * h2 * k2[i]) - u0 * (1 + h2 * k2[i - 1])) / (1 + h2 * k2[i + 1]);
      if ((u2 < 0 && u1 > 0) || (u2 > 0 && u1 < 0)) cnt++;
      u0 = u1; u1 = u2;
      if (Math.abs(u1) > 1e200) { u0 *= 1e-200; u1 *= 1e-200; }
    }
    // u0 = phi(n-1), u1 = phi(n). phi = alpha g + beta d beyond r_out; the discrete Wronskian
    // phi(n-1) d(n) - phi(n) d(n-1) = alpha (g(n-1) d(n) - g(n) d(n-1)) has the sign of -alpha.
    var w = u0 * T.d2 - u1 * T.d1;
    if (u1 !== 0 && (-w > 0) !== (u1 > 0)) cnt++;          // growing part of opposite sign: one more zero
    return cnt;
  }

  function solve(c) {
    var G = setup(c), k2 = new Float64Array(G.n + 2), T = tailPair(G);
    var lo = 0, hi = 400;
    if (count(G, lo, k2, T) > c.nr) return { ok: false, why: 'bound without a central well', G: G };
    if (count(G, hi, k2, T) <= c.nr) return { ok: false, why: 'no depth below 400 MeV binds it', G: G };
    for (var it = 0; it < 200 && hi - lo > 1e-12 * hi; it++) {
      var mid = 0.5 * (lo + hi);
      if (count(G, mid, k2, T) > c.nr) hi = mid; else lo = mid;
    }
    var D = 0.5 * (lo + hi);
    k2arr(G, D, k2);
    // outward to m, inward from the exact tail to m
    var n = G.n, m = G.m, h2 = G.h * G.h / 12, i0 = start(G.l), i;
    var out = new Float64Array(n + 1), inn = new Float64Array(n + 1);
    for (i = 1; i <= i0; i++) out[i] = Math.pow(i * G.h, G.l + 1);
    for (i = i0; i < m + 1; i++) out[i + 1] = (2 * out[i] * (1 - 5 * h2 * k2[i]) - out[i - 1] * (1 + h2 * k2[i - 1])) / (1 + h2 * k2[i + 1]);
    inn[n] = T.d2; inn[n - 1] = T.d1;
    for (i = n - 1; i > m - 1; i--) inn[i - 1] = (2 * inn[i] * (1 - 5 * h2 * k2[i]) - inn[i + 1] * (1 + h2 * k2[i + 1])) / (1 + h2 * k2[i - 1]);
    // log-derivative mismatch at m (diagnostic; zero at an eigenstate up to O(h^4))
    var ldo = (out[m + 1] - out[m - 1]) / (2 * G.h * out[m]), ldi = (inn[m + 1] - inn[m - 1]) / (2 * G.h * inn[m]);
    var sc = inn[m] / out[m], u = new Float64Array(n + 1);
    for (i = 0; i <= n; i++) u[i] = i <= m ? out[i] * sc : inn[i];
    // u is now on the tail's scale: u(r) = W(2 kappa r) * exp(T.e1) for r >= r_out (relative).
    // inner integrals, Simpson (n even or not: composite trapezoid with end correction is enough at h = 0.02)
    var s0 = 0, s2 = 0, s4 = 0;
    for (i = 1; i < n; i++) { var u2i = u[i] * u[i], r2 = G.r[i] * G.r[i]; s0 += u2i; s2 += u2i * r2; s4 += u2i * r2 * r2; }
    var hn = 0.5 * u[n] * u[n], rn2 = G.rout * G.rout;
    s0 = (s0 + hn) * G.h; s2 = (s2 + hn * rn2) * G.h; s4 = (s4 + hn * rn2 * rn2) * G.h;
    // tail on a log grid r = r_out e^s, Simpson; d(r) relative to its value scale exp(T.e1)
    var tl = tail(G, T.e1);
    var t0 = 0, t2 = 0, t4 = 0;
    for (i = 0; i < tl.r.length; i++) {
      var wq = tl.wq[i], d2 = tl.d[i] * tl.d[i], rr2 = tl.r[i] * tl.r[i];
      t0 += wq * d2; t2 += wq * d2 * rr2; t4 += wq * d2 * rr2 * rr2;
    }
    var norm = s0 + t0, nrm = Math.sqrt(norm);
    // sign: positive near the origin
    var sg = 1;
    for (i = 1; i < n; i++) if (Math.abs(u[i]) > 1e-8 * nrm) { sg = Math.sign(u[i]); break; }
    for (i = 0; i <= n; i++) u[i] *= sg / nrm;
    for (i = 0; i < tl.d.length; i++) tl.d[i] *= sg / nrm;
    // ANC: u(r) = b W(2 kappa r) for r >= r_out
    var b = sg * Math.exp(-T.e1) / nrm;
    var inner = s0 / norm;
    return {
      ok: true, G: G, D: D, V0: -D, u: u, tail: tl, kappa: G.kappa, eta: G.eta, mu: G.mu,
      r2: (s2 + t2) / norm, r4: (s4 + t4) / norm, rms: Math.sqrt((s2 + t2) / norm),
      pOut: 1 - (function () { var p = 0; for (var k = 1; k <= G.m; k++) p += u[k] * u[k]; return p * G.h; })(),
      inner: inner, anc: b, mismatch: ldo - ldi, R: G.R,
    };
  }

  // tail grid r_out .. r_out + 45/kappa (plus 60 fm), logarithmic, Simpson weights; d relative to exp(e1)
  function tail(G, e1) {
    var rmax = G.rout + 45 / G.kappa + 60, L = Math.log(rmax / G.rout), N = 1200;
    var ds = L / N, r = new Float64Array(N + 1), d = new Float64Array(N + 1), wq = new Float64Array(N + 1);
    for (var i = 0; i <= N; i++) {
      var x = G.rout * Math.exp(i * ds), w = whittaker(G.eta, G.l, 2 * G.kappa * x);
      r[i] = x; d[i] = w.m * Math.exp(w.e - e1);
      wq[i] = (i === 0 || i === N ? 1 : (i % 2 ? 4 : 2)) * ds / 3 * x;  // dr = r ds
    }
    return { r: r, d: d, wq: wq };
  }

  /* Matter radius of core + nucleon about the total centre of mass (point nucleons):
     the core centre sits at -r/A, the nucleon at (A_c/A) r, so
       A <r^2>_A = A_c (<r^2>_c + <r^2>/A^2) + (A_c/A)^2 <r^2>
       <r^2>_A   = (A_c/A) <r^2>_c + (A_c/A^2) <r^2>. */
  function matterR2(Ac, r2c, r2) { var A = Ac + 1; return Ac / A * r2c + Ac / (A * A) * r2; }

  // radial density of the orbital on one combined grid: inner (every k-th point) + tail
  function profile(sol, every) {
    var G = sol.G, rs = [], u = [];
    for (var i = 0; i < G.n; i += every || 1) { rs.push(G.r[i]); u.push(sol.u[i]); }
    for (i = 0; i < sol.tail.r.length; i++) { rs.push(sol.tail.r[i]); u.push(sol.tail.d[i]); }
    return { r: rs, u: u };
  }

  /* Core density about the centre of mass of core + nucleon. The core centre sits at d = -r/A, so its
     density is the intrinsic one folded with the recoil distribution of d, which is the orbital's
     probability scaled by 1/A. For spherical densities the angular average is exact:
       rho'(R) = sum_i w_i K(R, d_i),  K(R, d) = [F(R+d) - F(|R-d|)] / (2 R d),  F(y) = int_0^y r rho(r) dr,
     with w_i the orbital's probability on its full grid (inner Numerov points plus the exact tail out to
     r_out + 45/kappa + 60 fm), renormalized to sum 1, and d_i = r_i/A. Nothing is cut at a display
     threshold: the fold conserves the core's particle number and adds <r^2>/A^2 to its <R^2> exactly
     (up to quadrature); a display cutoff, if any, is the caller's, applied to the result.
     core = { r: uniform grid (r[0] = 0), rho: [rho_1, rho_2, ...] }, scale s draws the core as
     rho_s(r) = s^-3 rho(r/s) (same particle number, rms times s). Rgrid: radii at which to evaluate.
     Returns { rho: [Float64Array per input density], wsum: quadrature sum before renormalizing,
     d2: <d^2> used }. */
  function foldCore(sol, A, core, Rgrid, scale) {
    var s = scale || 1, p = profile(sol, 1), m = p.r.length, w = new Float64Array(m), d = new Float64Array(m);
    var wsum = 0, d2 = 0, i, k;
    for (i = 0; i < m; i++) {
      var lo = p.r[Math.max(0, i - 1)], hi = p.r[Math.min(m - 1, i + 1)];
      w[i] = p.u[i] * p.u[i] * 0.5 * (hi - lo);
      d[i] = p.r[i] / A;
      wsum += w[i];
    }
    for (i = 0; i < m; i++) { w[i] /= wsum; d2 += w[i] * d[i] * d[i]; }
    var g = core.r, h = g[1] - g[0], ng = g.length - 1, out = [];
    for (var q = 0; q < core.rho.length; q++) {
      var rho = core.rho[q], F = new Float64Array(ng + 1);
      for (k = 1; k <= ng; k++) F[k] = F[k - 1] + 0.5 * h * (g[k] * rho[k] + g[k - 1] * rho[k - 1]);
      // F_s(y) = F(y/s)/s
      var Fat = function (y) { var f = y / s / h; if (f >= ng) return F[ng] / s; var j = Math.floor(f), t = f - j; return (F[j] * (1 - t) + F[j + 1] * t) / s; };
      var res = new Float64Array(Rgrid.length);
      for (k = 0; k < Rgrid.length; k++) {
        var R = Math.max(Rgrid[k], 1e-3 * h), acc = 0;
        for (i = 1; i < m; i++) {
          if (w[i] === 0) continue;
          var di = d[i];
          acc += w[i] * (Fat(R + di) - Fat(Math.abs(R - di))) / (2 * R * di);
        }
        res[k] = acc;
      }
      out.push(res);
    }
    return { rho: out, wsum: wsum, d2: d2 };
  }

  /* The cases. Orbital = the measured ground-state J^pi of NUBASE2020 read as one nucleon
     outside a spherical core (parenthesized, i.e. tentative, for 31Ne and 37Mg). nr = radial nodes. */
  var CASES = [
    { id: '11Be', Z: 4, N: 7, q: 'n', l: 0, j2: 1, nr: 1, kind: 'halo' },
    { id: '19C', Z: 6, N: 13, q: 'n', l: 0, j2: 1, nr: 1, kind: 'halo' },
    { id: '15C', Z: 6, N: 9, q: 'n', l: 0, j2: 1, nr: 1, kind: 'halo' },
    { id: '31Ne', Z: 10, N: 21, q: 'n', l: 1, j2: 3, nr: 1, kind: 'halo' },
    { id: '37Mg', Z: 12, N: 25, q: 'n', l: 1, j2: 3, nr: 1, kind: 'halo' },
    { id: '8B', Z: 5, N: 3, q: 'p', l: 1, j2: 3, nr: 0, kind: 'halo' },
    { id: '13C', Z: 6, N: 7, q: 'n', l: 1, j2: 1, nr: 0, kind: 'reference' },
    { id: '17O', Z: 8, N: 9, q: 'n', l: 2, j2: 5, nr: 0, kind: 'reference' },
  ];
  // separation energy and core binding from the NUBASE rows [Z, N, sym, log T, mode, B/A, est, J, year]
  function fromTable(NUC, cs) {
    var B = function (Z, N) {
      if (Z + N === 1) return 0;
      for (var i = 0; i < NUC.length; i++) if (NUC[i][0] === Z && NUC[i][1] === N) return NUC[i][5] * (Z + N);
      return null;
    };
    var Zc = cs.q === 'p' ? cs.Z - 1 : cs.Z, Nc = cs.q === 'n' ? cs.N - 1 : cs.N;
    var Ba = B(cs.Z, cs.N), Bc = B(Zc, Nc);
    return { Zc: Zc, Nc: Nc, Bc: Bc, S: Ba - Bc, q: cs.q, l: cs.l, j2: cs.j2, nr: cs.nr };
  }

  var HALO = { solve: solve, whittaker: whittaker, lgamma: lgamma, matterR2: matterR2, profile: profile, foldCore: foldCore, CASES: CASES, fromTable: fromTable, MASS: MASS, HBARC: HBARC, E2: E2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = HALO; else root.HALO = HALO;
})(this);
