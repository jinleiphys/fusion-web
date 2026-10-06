/* ------------------------------------------------------------------ *
 * Nilsson model: the modified oscillator (MO) for axially deformed nuclei.
 *
 * Hamiltonian (Ragnarsson & Nilsson, Shapes and Shells in Nuclear Structure,
 * Cambridge 2005, Sec. 8.3 to 8.5; identical to Moller et al., At. Data Nucl.
 * Data Tables 109-110 (2016) 1, Eq. (vosc) at gamma = 0), in the stretched
 * coordinates xi = x (M w_perp/hbar)^1/2, zeta = z (M w_z/hbar)^1/2,
 *   w_perp = w0 (1 + eps/3),  w_z = w0 (1 - 2 eps/3):
 *
 *   H = T + 1/2 hbar w0 rho_t^2 [1 - 2/3 eps P2(cos th_t) + 2 eps4 P4(cos th_t)]
 *       - kappa hbar w00 [2 l_t.s + mu (l_t^2 - <l_t^2>_N)],   <l_t^2>_N = N(N+3)/2
 *
 * w0 = w0(eps, eps4) conserves the volume inside every equipotential surface,
 * w00 = w0(0, 0) = 41 A^(-1/3) MeV / hbar. kappa, mu per oscillator shell N from
 * Bengtsson & Ragnarsson, Nucl. Phys. A 436 (1985) 14, as tabulated in Table 6.2 of
 * Shapes and Shells (the N >= 8 row is used for all higher N).
 *
 * Basis: stretched spherical oscillator |N l Lambda Sigma>, Omega = Lambda + Sigma.
 * Kinetic + eps term: diagonal in N_t; inside a shell it equals
 *   hbar w0 [(N + 3/2) - 2/3 eps rho^2 P2]   (Shapes and Shells p. 120),
 * so with eps4 = 0 each (N, Omega) block is exact on its own (no truncation).
 * The eps4 term hbar w0 eps4 rho^2 P4 is potential only. rho^2 P4 = r^4 P4 / r^2 is not a
 * polynomial in the coordinates, so it couples every pair of shells of equal parity
 * (N' - N = 0, +-2, +-4, ...); all shells N <= Nmax of one parity are diagonalized together.
 * Energies are returned in units of hbar w0(eps, eps4).
 *
 * Plain script: defines window.NILSSON in a browser, module.exports in Node.
 * tests/check_nilsson.jl solves the same Hamiltonian in a Cartesian basis.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  // Bengtsson & Ragnarsson (1985), via Shapes and Shells Table 6.2: [kappa, mu] for N = 0..8
  var BR = {
    p: [[0.120, 0.00], [0.120, 0.00], [0.105, 0.00], [0.090, 0.30], [0.065, 0.57], [0.060, 0.65], [0.054, 0.69], [0.054, 0.69], [0.054, 0.60]],
    n: [[0.120, 0.00], [0.120, 0.00], [0.105, 0.00], [0.090, 0.25], [0.070, 0.39], [0.062, 0.43], [0.062, 0.34], [0.062, 0.26], [0.062, 0.26]]
  };
  function kmu(q, N) { return BR[q][Math.min(N, 8)]; }
  var LNAME = 'spdfghijklmnoqrt';
  var HBARC = 197.3269804, MNUC = 938.918;   // MeV fm, mean nucleon mass (MeV)

  // ---------- small special functions
  var LF = [0];
  for (var i = 1; i < 300; i++) LF[i] = LF[i - 1] + Math.log(i);
  function lf(n) { return LF[n]; }
  // log Gamma at integer or half-integer x > 0
  function lgam(x) {
    if (Math.abs(x - Math.round(x)) < 1e-9) return LF[Math.round(x) - 1];
    var s = 0.5 * Math.log(Math.PI);
    for (var k = 0.5; k < x - 0.25; k += 1) s += Math.log(k);
    return s;
  }
  // Clebsch-Gordan <j1 m1 j2 m2 | J M>, all arguments doubled (Racah formula)
  function cg2(j1, m1, j2, m2, J, M) {
    if (m1 + m2 !== M) return 0;
    if (J < Math.abs(j1 - j2) || J > j1 + j2 || (j1 + j2 + J) % 2) return 0;
    if (Math.abs(m1) > j1 || Math.abs(m2) > j2 || Math.abs(M) > J) return 0;
    if ((j1 + m1) % 2 || (j2 + m2) % 2 || (J + M) % 2) return 0;
    var a = (j1 + j2 - J) / 2, b = (j1 - j2 + J) / 2, c = (-j1 + j2 + J) / 2, d = (j1 + j2 + J) / 2 + 1;
    var pre = 0.5 * (Math.log(J + 1) + lf(a) + lf(b) + lf(c) - lf(d) +
      lf((j1 + m1) / 2) + lf((j1 - m1) / 2) + lf((j2 + m2) / 2) + lf((j2 - m2) / 2) + lf((J + M) / 2) + lf((J - M) / 2));
    var k0 = Math.max(0, (j2 - J - m1) / 2, (j1 - J + m2) / 2), k1 = Math.min(a, (j1 - m1) / 2, (j2 + m2) / 2), s = 0;
    for (var k = k0; k <= k1; k++) {
      var den = lf(k) + lf(a - k) + lf((j1 - m1) / 2 - k) + lf((j2 + m2) / 2 - k) + lf((J - j2 + m1) / 2 + k) + lf((J - j1 - m2) / 2 + k);
      s += (k % 2 ? -1 : 1) * Math.exp(pre - den);
    }
    return s;
  }
  // <l' L | P_k | l L> = sqrt((2l+1)/(2l'+1)) <l 0 k 0|l' 0> <l L k 0|l' L>
  function angP(lp, l, k, L) {
    return Math.sqrt((2 * l + 1) / (2 * lp + 1)) * cg2(2 * l, 0, 2 * k, 0, 2 * lp, 0) * cg2(2 * l, 2 * L, 2 * k, 0, 2 * lp, 2 * L);
  }

  // Gauss-Hermite nodes/weights (Newton on orthonormal Hermite functions)
  function gaussHermite(n) {
    var x = new Float64Array(n), w = new Float64Array(n), m = (n + 1) >> 1, z = 0, pp = 0, PIM4 = Math.pow(Math.PI, -0.25);
    for (var i = 0; i < m; i++) {
      if (i === 0) z = Math.sqrt(2 * n + 1) - 1.85575 * Math.pow(2 * n + 1, -0.16667);
      else if (i === 1) z -= 1.14 * Math.pow(n, 0.426) / z;
      else if (i === 2) z = 1.86 * z - 0.86 * x[0];
      else if (i === 3) z = 1.91 * z - 0.91 * x[1];
      else z = 2 * z - x[i - 2];
      for (var it = 0; it < 100; it++) {
        var p1 = PIM4, p2 = 0, p3;
        for (var j = 0; j < n; j++) { p3 = p2; p2 = p1; p1 = z * Math.sqrt(2 / (j + 1)) * p2 - Math.sqrt(j / (j + 1)) * p3; }
        pp = Math.sqrt(2 * n) * p2;
        var z1 = z; z = z1 - p1 / pp;
        if (Math.abs(z - z1) < 1e-15) break;
      }
      x[i] = z; x[n - 1 - i] = -z; w[i] = 2 / (pp * pp); w[n - 1 - i] = w[i];
    }
    return { x: x, w: w };
  }
  function gaussLegendre(n) {
    var x = new Float64Array(n), w = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0;
      for (var it = 0; it < 100; it++) {
        var p1 = 1, p2 = 0, p3;
        for (var j = 1; j <= n; j++) { p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1);
        var z1 = z; z = z1 - p1 / pp;
        if (Math.abs(z - z1) < 1e-15) break;
      }
      x[i] = z; w[i] = 2 / ((1 - z * z) * pp * pp);
    }
    return { x: x, w: w };
  }
  var GH = gaussHermite(64), GL = gaussLegendre(96);

  function legendre(k, u) {
    var p0 = 1, p1 = u;
    if (k === 0) return 1;
    for (var j = 2; j <= k; j++) { var p2 = ((2 * j - 1) * u * p1 - (j - 1) * p0) / j; p0 = p1; p1 = p2; }
    return p1;
  }

  // radial oscillator function R_Nl(rho), int R^2 rho^2 drho = 1, positive at the origin
  function radial(N, l, r) {
    var n = (N - l) / 2, a = l + 0.5, x = r * r, L0 = 1, L1 = 1 + a - x, L = n === 0 ? 1 : L1;
    for (var k = 1; k < n; k++) { L = ((2 * k + 1 + a - x) * L1 - (k + a) * L0) / (k + 1); L0 = L1; L1 = L; }
    var lnN = 0.5 * (Math.log(2) + lf(n) - lgam(n + l + 1.5));
    return Math.exp(lnN - 0.5 * x) * Math.pow(r, l) * L;
  }
  // <N' l'| rho^2 |N l>, exact by Gauss-Hermite (even integrand, polynomial times exp(-rho^2))
  var R2 = new Map();
  function rho2(Np, lp, N, l) {
    var key = Np + ',' + lp + ',' + N + ',' + l, v = R2.get(key);
    if (v !== undefined) return v;
    var s = 0;
    for (var i = 0; i < GH.x.length; i++) {
      var r = GH.x[i], e = Math.exp(r * r);
      s += GH.w[i] * e * radial(Np, lp, r) * radial(N, l, r) * r * r * r * r;
    }
    s *= 0.5;
    R2.set(key, s); R2.set(N + ',' + l + ',' + Np + ',' + lp, s);
    return s;
  }

  // ---------- volume conservation: w0(eps, eps4)/w00 (Shapes and Shells Sec. 8.4-8.5)
  function shapeF(eps, eps4, u) { return 1 - 2 / 3 * eps * legendre(2, u) + 2 * eps4 * legendre(4, u); }
  function omegaRatio(eps, eps4) {
    var I = 0;
    for (var i = 0; i < GL.x.length; i++) {
      var f = shapeF(eps, eps4, GL.x[i]);
      if (!(f > 0)) return NaN;
      I += GL.w[i] * Math.pow(f, -1.5);
    }
    return Math.cbrt(I / (2 * (1 + eps / 3) * Math.sqrt(1 - 2 * eps / 3)));
  }

  // ---------- symmetric eigenproblem: Householder + QL (JAMA tred2/tql2)
  function eigSym(A, n) {
    var V = [], d = new Float64Array(n), e = new Float64Array(n), i, j, k, f, g, h;
    for (i = 0; i < n; i++) { V.push(new Float64Array(n)); for (j = 0; j < n; j++) V[i][j] = A[i * n + j]; }
    for (j = 0; j < n; j++) d[j] = V[n - 1][j];
    for (i = n - 1; i > 0; i--) {
      var scale = 0; h = 0;
      for (k = 0; k < i; k++) scale += Math.abs(d[k]);
      if (scale === 0) {
        e[i] = d[i - 1];
        for (j = 0; j < i; j++) { d[j] = V[i - 1][j]; V[i][j] = 0; V[j][i] = 0; }
      } else {
        for (k = 0; k < i; k++) { d[k] /= scale; h += d[k] * d[k]; }
        f = d[i - 1]; g = Math.sqrt(h); if (f > 0) g = -g;
        e[i] = scale * g; h -= f * g; d[i - 1] = f - g;
        for (j = 0; j < i; j++) e[j] = 0;
        for (j = 0; j < i; j++) {
          f = d[j]; V[j][i] = f; g = e[j] + V[j][j] * f;
          for (k = j + 1; k <= i - 1; k++) { g += V[k][j] * d[k]; e[k] += V[k][j] * f; }
          e[j] = g;
        }
        f = 0;
        for (j = 0; j < i; j++) { e[j] /= h; f += e[j] * d[j]; }
        var hh = f / (h + h);
        for (j = 0; j < i; j++) e[j] -= hh * d[j];
        for (j = 0; j < i; j++) {
          f = d[j]; g = e[j];
          for (k = j; k <= i - 1; k++) V[k][j] -= (f * e[k] + g * d[k]);
          d[j] = V[i - 1][j]; V[i][j] = 0;
        }
      }
      d[i] = h;
    }
    for (i = 0; i < n - 1; i++) {
      V[n - 1][i] = V[i][i]; V[i][i] = 1; h = d[i + 1];
      if (h !== 0) {
        for (k = 0; k <= i; k++) d[k] = V[k][i + 1] / h;
        for (j = 0; j <= i; j++) {
          g = 0;
          for (k = 0; k <= i; k++) g += V[k][i + 1] * V[k][j];
          for (k = 0; k <= i; k++) V[k][j] -= g * d[k];
        }
      }
      for (k = 0; k <= i; k++) V[k][i + 1] = 0;
    }
    for (j = 0; j < n; j++) { d[j] = V[n - 1][j]; V[n - 1][j] = 0; }
    V[n - 1][n - 1] = 1; e[0] = 0;
    // tql2
    for (i = 1; i < n; i++) e[i - 1] = e[i];
    e[n - 1] = 0;
    f = 0; var tst1 = 0, eps = Math.pow(2, -52);
    for (var l = 0; l < n; l++) {
      tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
      var m = l;
      while (m < n) { if (Math.abs(e[m]) <= eps * tst1) break; m++; }
      if (m > l) {
        do {
          g = d[l]; var p = (d[l + 1] - g) / (2 * e[l]), r = Math.hypot(p, 1); if (p < 0) r = -r;
          d[l] = e[l] / (p + r); d[l + 1] = e[l] * (p + r);
          var dl1 = d[l + 1]; h = g - d[l];
          for (i = l + 2; i < n; i++) d[i] -= h;
          f += h; p = d[m];
          var c = 1, c2 = c, c3 = c, el1 = e[l + 1], s = 0, s2 = 0;
          for (i = m - 1; i >= l; i--) {
            c3 = c2; c2 = c; s2 = s;
            g = c * e[i]; h = c * p; r = Math.hypot(p, e[i]);
            e[i + 1] = s * r; s = e[i] / r; c = p / r; p = c * d[i] - s * g;
            d[i + 1] = h + s * (c * g + s * d[i]);
            for (k = 0; k < n; k++) { h = V[k][i + 1]; V[k][i + 1] = s * V[k][i] + c * h; V[k][i] = c * V[k][i] - s * h; }
          }
          p = -s * s2 * c3 * el1 * e[l] / dl1; e[l] = s * p; d[l] = c * p;
        } while (Math.abs(e[l]) > eps * tst1);
      }
      d[l] = d[l] + f; e[l] = 0;
    }
    // sort ascending, eigenvectors as rows
    var idx = []; for (i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return d[a] - d[b]; });
    var E = new Float64Array(n), vecs = [];
    for (i = 0; i < n; i++) {
      E[i] = d[idx[i]];
      var v = new Float64Array(n);
      for (k = 0; k < n; k++) v[k] = V[k][idx[i]];
      vecs.push(v);
    }
    return { E: E, V: vecs };
  }

  // ---------- basis and Hamiltonian
  // states |N l Lambda Sigma> with Omega = om2/2 > 0, for the listed shells
  function basis(om2, shells) {
    var B = [];
    shells.forEach(function (N) {
      for (var l = N % 2; l <= N; l += 2) {
        [1, -1].forEach(function (s2) {
          var L = (om2 - s2) / 2;
          if (L >= 0 && L <= l) B.push({ N: N, l: l, L: L, s2: s2 });
        });
      }
    });
    return B;
  }
  function hamiltonian(q, eps, eps4, om2, shells, wr) {
    var B = basis(om2, shells), n = B.length, H = new Float64Array(n * n);
    var r00 = 1 / wr;   // w00 / w0: the kappa terms are fixed in units of hbar w00
    for (var a = 0; a < n; a++) {
      var A = B[a];
      for (var b = a; b < n; b++) {
        var Bb = B[b], v = 0;
        if (A.s2 === Bb.s2 && A.L === Bb.L) {
          if (A.N === Bb.N) {
            if (a === b) v += A.N + 1.5;
            if (eps !== 0 && Math.abs(A.l - Bb.l) <= 2) v += -2 / 3 * eps * rho2(A.N, A.l, Bb.N, Bb.l) * angP(A.l, Bb.l, 2, A.L);
          }
          if (eps4 !== 0 && Math.abs(A.l - Bb.l) <= 4) v += eps4 * rho2(A.N, A.l, Bb.N, Bb.l) * angP(A.l, Bb.l, 4, A.L);
        }
        if (A.N === Bb.N && A.l === Bb.l) {
          var km = kmu(q, A.N), ls = 0;
          if (a === b) ls = A.L * A.s2 / 2;
          else if (Bb.L === A.L + 1 && A.s2 === 1 && Bb.s2 === -1) ls = 0.5 * Math.sqrt((A.l - A.L) * (A.l + A.L + 1));
          else if (A.L === Bb.L + 1 && Bb.s2 === 1 && A.s2 === -1) ls = 0.5 * Math.sqrt((Bb.l - Bb.L) * (Bb.l + Bb.L + 1));
          var l2 = a === b ? A.l * (A.l + 1) - A.N * (A.N + 3) / 2 : 0;
          v += -km[0] * r00 * (2 * ls + km[1] * l2);
        }
        H[a * n + b] = v; H[b * n + a] = v;
      }
    }
    return { H: H, B: B, n: n };
  }

  // asymptotic labels [N nz Lambda] available for (N, Omega)
  function asymptotic(N, om2) {
    var out = [];
    for (var nz = 0; nz <= N; nz++) {
      var np = N - nz;
      [(om2 - 1) / 2, (om2 + 1) / 2].forEach(function (L) { if (L <= np && (np - L) % 2 === 0) out.push({ nz: nz, L: L }); });
    }
    return out;
  }

  /* All levels of species q at (eps, eps4) for shells N <= Nmax.
     With eps4 = 0 every (N, Omega) block is solved on its own (exact);
     otherwise (or with forceCoupled) the shells of one parity are coupled, and the curve id is
     the rank inside the (Omega, parity) block, continuous along any path in (eps, eps4).
     Each level: E (hbar w0), om2, par, curve id (stable along the deformation axis), vec, B. */
  function solve(q, eps, eps4, Nmax, forceCoupled) {
    var wr = omegaRatio(eps, eps4), levels = [], coupled = forceCoupled != null ? !!forceCoupled : eps4 !== 0;
    for (var om2 = 1; om2 <= 2 * Nmax + 1; om2 += 2) {
      for (var par = 0; par < 2; par++) {
        var groups = [];
        var sh = []; for (var N = par; N <= Nmax; N += 2) if (2 * N + 1 >= om2) sh.push(N);
        if (!sh.length) continue;
        if (coupled) groups.push(sh); else sh.forEach(function (N) { groups.push([N]); });
        groups.forEach(function (g) {
          var h = hamiltonian(q, eps, eps4, om2, g, wr);
          if (!h.n) return;
          var r = eigSym(h.H, h.n);
          for (var k = 0; k < h.n; k++) {
            levels.push({ q: q, E: r.E[k], om2: om2, par: par, id: om2 + ':' + par + ':' + (coupled ? 'c' : g[0]) + ':' + k, vec: r.V[k], B: h.B, shells: g, eps: eps, eps4: eps4 });
          }
        });
      }
    }
    levels.sort(function (a, b) { return a.E - b.E; });
    return { levels: levels, wr: wr, Nmax: Nmax, coupled: coupled };
  }

  /* Label the levels of one (Omega, parity) block from the eigenvectors of the pure-eps2 (N, Omega)
     blocks at the same eps2. Inside one such block levels never cross, so the k-th lowest is
     adiabatically connected to the k-th asymptotic state: descending nz for prolate, ascending
     for oblate. At eps2 = 0 the spherical label n l j is used.
     Assignment rule: greedy and one-to-one. All (level, candidate) overlaps^2 are sorted, largest
     first, and a pair is accepted when neither the level nor the candidate is taken yet; so a level
     may receive a candidate that is not its own largest overlap. Each level keeps labWeight (the
     overlap^2 of its label) and labBest (its largest overlap^2 with any candidate); it is flagged
     labAmbiguous, and its label text ends in "?", when labWeight < 0.5 or labWeight < labBest. */
  function labelBlock(levelsOfBlock) {
    var L0 = levelsOfBlock[0], q = L0.q, eps = L0.eps, om2 = L0.om2, B = L0.B, cand = [];
    var wr = omegaRatio(eps, 0);
    L0.shells.forEach(function (N) {
      var h = hamiltonian(q, eps, 0, om2, [N], wr), r = eigSym(h.H, h.n);
      var asy = asymptotic(N, om2);
      asy.sort(function (a, b) { return eps >= 0 ? b.nz - a.nz : a.nz - b.nz; });
      for (var k = 0; k < h.n; k++) {
        var w = new Float64Array(B.length);
        for (var i = 0, j = 0; i < B.length; i++) if (B[i].N === N) w[i] = r.V[k][j++];
        var lab;
        if (Math.abs(eps) < 1e-12) {
          // spherical: dominant l, j from <l.s>
          var best = 0, bl = 0, ls = 0;
          for (i = 0; i < h.n; i++) if (r.V[k][i] * r.V[k][i] > best) { best = r.V[k][i] * r.V[k][i]; bl = h.B[i].l; }
          ls = ljExpect(r.V[k], h.B);
          var j2 = bl === 0 ? 1 : (ls > 0 ? 2 * bl + 1 : 2 * bl - 1);
          lab = { sph: true, N: N, l: bl, j2: j2, nr: (N - bl) / 2 };
        } else lab = { N: N, nz: asy[k].nz, L: asy[k].L };
        cand.push({ w: w, lab: lab });
      }
    });
    // overlaps and greedy assignment
    var pairs = [];
    levelsOfBlock.forEach(function (lv, a) {
      cand.forEach(function (c, b) {
        var s = 0; for (var i = 0; i < B.length; i++) s += lv.vec[i] * c.w[i];
        pairs.push([s * s, a, b]);
      });
    });
    pairs.sort(function (x, y) { return y[0] - x[0]; });
    var usedA = {}, usedB = {}, best = {};
    pairs.forEach(function (p) { if (!(best[p[1]] >= p[0])) best[p[1]] = p[0]; });
    pairs.forEach(function (p) {
      if (usedA[p[1]] || usedB[p[2]]) return;
      usedA[p[1]] = usedB[p[2]] = true;
      var lv = levelsOfBlock[p[1]];
      lv.lab = cand[p[2]].lab; lv.labWeight = p[0];
    });
    levelsOfBlock.forEach(function (lv, a) {
      lv.labBest = best[a] || 0;
      lv.labAmbiguous = !!lv.lab && (lv.labWeight < 0.5 || lv.labWeight < lv.labBest - 1e-12);
    });
    levelsOfBlock.forEach(function (lv) { lv.label = labelText(lv); });
  }
  function ljExpect(v, B) {
    var s = 0;
    for (var a = 0; a < B.length; a++) for (var b = 0; b < B.length; b++) {
      var A = B[a], C = B[b], ls = 0;
      if (A.l !== C.l || A.N !== C.N) continue;
      if (a === b) ls = A.L * A.s2 / 2;
      else if (C.L === A.L + 1 && A.s2 === 1 && C.s2 === -1) ls = 0.5 * Math.sqrt((A.l - A.L) * (A.l + A.L + 1));
      else if (A.L === C.L + 1 && C.s2 === 1 && A.s2 === -1) ls = 0.5 * Math.sqrt((C.l - C.L) * (C.l + C.L + 1));
      s += v[a] * v[b] * ls;
    }
    return s;
  }
  function labelText(lv) {
    var o = lv.om2 + '/2' + (lv.par ? '−' : '+'), b = lv.lab;
    if (!b) return o;
    var q = lv.labAmbiguous ? '?' : '';
    if (b.sph) return o + ' (' + (b.nr + 1) + LNAME[b.l] + b.j2 + '/2)' + q;
    return o + '[' + (b.N > 9 || b.nz > 9 || b.L > 9 ? b.N + ',' + b.nz + ',' + b.L : '' + b.N + b.nz + b.L) + ']' + q;
  }
  // label every level of a solution (or only those whose block contains a wanted id)
  function label(sol, only) {
    var blocks = {};
    sol.levels.forEach(function (lv) {
      var key = lv.id.split(':').slice(0, 3).join(':');
      (blocks[key] = blocks[key] || []).push(lv);
    });
    for (var key in blocks) {
      if (only && !blocks[key].some(function (lv) { return only(lv); })) continue;
      labelBlock(blocks[key]);
    }
    return sol;
  }

  /* Decomposition of a level into |N l_t j_t Omega> components of the STRETCHED spherical basis
     (weights sum to 1). l_t, j_t are angular momenta in the stretched coordinates (xi, eta, zeta),
     not the laboratory l, j: at eps2 != 0 a 100% "1s1/2" entry is the stretched-frame s state, which
     in the laboratory is an elongated Gaussian with l > 0 admixtures (the N = 0 level at eps2 = 0.6
     has laboratory l = 0 probability 0.96, not 1). At eps2 = 0 the two coincide. */
  function sphericalComponents(lv) {
    var out = {};
    lv.B.forEach(function (s, i) {
      [2 * s.l + 1, 2 * s.l - 1].forEach(function (j2) {
        if (j2 < 1 || j2 < lv.om2) return;
        var c = cg2(2 * s.l, 2 * s.L, 1, s.s2, j2, lv.om2);
        if (!c) return;
        var key = s.N + ',' + s.l + ',' + j2;
        out[key] = (out[key] || 0) + c * lv.vec[i];
      });
    });
    var list = [];
    for (var k in out) {
      var p = k.split(',').map(Number);
      list.push({ N: p[0], l: p[1], j2: p[2], w: out[k] * out[k], name: ((p[0] - p[1]) / 2 + 1) + LNAME[p[1]] + p[2] + '/2' });
    }
    list.sort(function (a, b) { return b.w - a.w; });
    return list;
  }

  // spherical modified-oscillator energy in hbar w00 (closed form, Shapes and Shells Sec. 6.4)
  function sphericalE(q, N, l, j2) {
    var km = kmu(q, N), ls = j2 === 2 * l + 1 ? l / 2 : -(l + 1) / 2;
    return N + 1.5 - km[0] * (2 * ls + km[1] * (l * (l + 1) - N * (N + 3) / 2));
  }

  // starting basis size: the oscillator shell holding the n-th particle plus a margin. With eps4 = 0
  // the blocks are exact and the margin only has to cover the shells drawn. With eps4 != 0 the
  // margin (6 shells, 8 for |eps4| > 0.07) is only a start: it is NOT converged at large
  // deformation (166Er n at eps2 0.6, eps4 -0.10: 3e-4 hbar w0 off), so use converge() below.
  function nmaxFor(q, count, eps4) {
    var c = 0, N = 0;
    while (c < count) { c += (N + 1) * (N + 2); N++; }
    return Math.min(16, Math.max(N + 1, 3) + (!eps4 ? 2 : Math.abs(eps4) > 0.07 ? 8 : 6));
  }

  /* Basis converged at this deformation: grow Nmax by two shells (one per parity) until the 13
     levels around the last filled one move by less than tol (hbar w0), then use the larger basis.
     err is that last change, an estimate of the remaining error (convergence is rapid, so it is
     an overestimate). With eps4 = 0 the blocks are exact: err = 0. Capped at Nmax = cap. */
  function converge(q, count, eps, eps4, tol, cap) {
    tol = tol || 1e-4; cap = cap || 26;
    var N = nmaxFor(q, count, eps4);
    if (!eps4) return { Nmax: N, err: 0, exact: true, sol: solve(q, eps, eps4, N) };
    var k = lastIndex(null, count), a = solve(q, eps, eps4, N, true), b, err = Infinity;
    while (N + 2 <= cap) {
      b = solve(q, eps, eps4, N + 2, true);
      err = 0;
      for (var i = Math.max(0, k - 6); i <= Math.min(a.levels.length - 1, k + 6); i++) err = Math.max(err, Math.abs(a.levels[i].E - b.levels[i].E));
      N += 2; a = b;
      if (err < tol) break;
    }
    return { Nmax: N, err: err, exact: false, converged: err < tol, sol: a };
  }

  // fill: index of the last occupied level for count particles (two per Omega level)
  function lastIndex(sol, count) { return count > 0 ? Math.ceil(count / 2) - 1 : -1; }

  // spin-summed density at stretched (rho, u = cos theta_t), up to 1/(2 pi)
  function makeDensity(lv) {
    var terms = lv.B.map(function (s, i) {
      return { N: s.N, l: s.l, L: s.L, up: s.s2 === 1, c: lv.vec[i], norm: Math.sqrt((2 * s.l + 1) / 2 * Math.exp(lf(s.l - s.L) - lf(s.l + s.L))) };
    }).filter(function (t) { return Math.abs(t.c) > 1e-10; });
    return function (rho, u) {
      var up = 0, dn = 0, st = Math.sqrt(Math.max(0, 1 - u * u));
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i], y = t.norm * plm(t.l, t.L, u, st) * radial(t.N, t.l, rho) * t.c;
        if (t.up) up += y; else dn += y;
      }
      return up * up + dn * dn;
    };
  }
  // associated Legendre P_l^m(u) with the Condon-Shortley phase, m >= 0
  function plm(l, m, u, st) {
    var pmm = 1, fact = 1;
    for (var i = 1; i <= m; i++) { pmm *= -fact * st; fact += 2; }
    if (l === m) return pmm;
    var pm1 = u * (2 * m + 1) * pmm;
    if (l === m + 1) return pm1;
    var p = 0;
    for (var ll = m + 2; ll <= l; ll++) { p = (u * (2 * ll - 1) * pm1 - (ll + m - 1) * pmm) / (ll - m); pmm = pm1; pm1 = p; }
    return p;
  }

  // physical scales: hbar w00 = 41 A^(-1/3) MeV; oscillator lengths b = (hbar/M w)^1/2
  function scales(A, eps, eps4) {
    var hw00 = 41 * Math.pow(A, -1 / 3), wr = omegaRatio(eps, eps4), hw0 = hw00 * wr;
    var b0 = HBARC / Math.sqrt(MNUC * hw0);
    return { hw00: hw00, hw0: hw0, wr: wr, bperp: b0 / Math.sqrt(1 + eps / 3), bz: b0 / Math.sqrt(1 - 2 * eps / 3) };
  }

  /* Equipotential surface through R0 at the sphere, in units of R0, as a function of the
     stretched polar angle: returns {x (cylinder radius), z}. Volume 4 pi/3 R0^3 by construction. */
  function surface(eps, eps4, thT) {
    var u = Math.cos(thT), f = shapeF(eps, eps4, u), k = 1 / omegaRatio(eps, eps4);
    return { x: k * Math.sin(thT) / Math.sqrt(f * (1 + eps / 3)), z: k * u / Math.sqrt(f * (1 - 2 * eps / 3)) };
  }
  // beta_lambda of that surface, Moller et al. (2016) Eq. (betaconv):
  // beta_l = sqrt(4 pi (2l+1)) int r P_l du / int r du  (u = cos theta in the laboratory frame)
  function betas(eps, eps4) {
    var M = 4000, p = [], i;
    for (i = 0; i <= M; i++) { var s = surface(eps, eps4, Math.PI * i / M), r = Math.hypot(s.x, s.z); p.push({ r: r, u: s.z / r }); }
    var I0 = 0, I2 = 0, I4 = 0;
    for (i = 0; i < M; i++) {
      var du = p[i].u - p[i + 1].u, rm = 0.5 * (p[i].r + p[i + 1].r), um = 0.5 * (p[i].u + p[i + 1].u);
      I0 += rm * du; I2 += rm * legendre(2, um) * du; I4 += rm * legendre(4, um) * du;
    }
    return { beta2: Math.sqrt(20 * Math.PI) * I2 / I0, beta4: Math.sqrt(36 * Math.PI) * I4 / I0 };
  }

  // ground-state K^pi of an odd-A nucleus from the last odd nucleon
  function predictK(Z, N, eps, eps4) {
    if ((Z + N) % 2 === 0) return null;
    var q = Z % 2 ? 'p' : 'n', count = q === 'p' ? Z : N;
    var cv = converge(q, count, eps, eps4), sol = cv.sol;
    var k = lastIndex(sol, count), lv = sol.levels[k];
    label(sol, function (x) { return x === lv; });
    return { q: q, level: lv, K2: lv.om2, par: lv.par, label: lv.label, sol: sol, err: cv.err };
  }

  var NILSSON = {
    BR: BR, kmu: kmu, cg2: cg2, radial: radial, rho2: rho2, angP: angP, omegaRatio: omegaRatio, shapeF: shapeF,
    eigSym: eigSym, basis: basis, hamiltonian: hamiltonian, asymptotic: asymptotic, solve: solve, label: label,
    sphericalComponents: sphericalComponents, sphericalE: sphericalE, nmaxFor: nmaxFor, converge: converge, lastIndex: lastIndex,
    makeDensity: makeDensity, scales: scales, surface: surface, betas: betas, predictK: predictK, LNAME: LNAME
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NILSSON; else root.NILSSON = NILSSON;
})(this);
