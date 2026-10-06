/* doublebeta.js: the simple live math of doublebeta.html (double beta decay, 2nu and 0nu).
 *
 * Units: kinetic energies in m_e c^2 inside the spectrum functions (K, T0), MeV at the interface; masses in eV.
 * Model (stated in full on the page):
 *   Q_bb = Delta(Z, A) - Delta(Z + 2, A), atomic mass excesses (AME2020), so the electron masses cancel.
 *   Isobar parabolas: M(Z) = c Z^2 + b Z + m0 + delta s, s = +1 for odd Z, -1 for even Z (even A), fitted by unweighted
 *     least squares to the measured AME2020 mass excesses of one isobar within w charges of its lowest member.
 *   2nu summed-electron spectrum, the closed form of the Primakoff-Rosen approximation (F(Z, eps) p eps -> const * eps^2
 *     for each electron, closure for the neutrino phase space, no angular correlation):
 *       dN/dK ∝ K (K^4 + 10 K^3 + 40 K^2 + 60 K + 30) (T0 - K)^5,   K = summed kinetic energy, T0 = Q_bb / m_e c^2.
 *     The polynomial is (30/K) ∫_0^K (k + 1)^2 (K - k + 1)^2 dk; tests/check_doublebeta.py derives it in exact arithmetic.
 *     A second shape keeps the Fermi function of beta.html for each electron (assets/betadecay.js, F0 L0, daughter
 *     charge Z + 2, R = 1.2 A^(1/3) fm): dN/dK ∝ (T0 - K)^5 ∫_0^K F p1 eps1 F p2 eps2 dk1.
 *   0nu: a line at K = T0.
 *   Detector response: a Gaussian of constant width sigma (its value at Q), FWHM = 2 sqrt(2 ln 2) sigma.
 *   0nu half-life, light Majorana exchange in the convention of Kotila and Iachello (PRC 85, 034316 (2012)):
 *       1 / T = G0 g_A^4 |M|^2 (m_bb / m_e)^2,   G0 their G_0nu^(0) (1e-15 / yr), g_A = 1.27 as the experiments use.
 *   2nu, Barabash (Universe 6, 159 (2020)) Eq. (5): 1 / T = G2 (M_eff)^2, M_eff = g_A^2 m_e c^2 M_2nu, so M_eff = (G2 T)^(-1/2).
 *   Effective Majorana mass, as NuFIT 6.0 (JHEP 12 (2024) 216) writes it:
 *       m_bb = | m1 c12^2 c13^2 + m2 s12^2 c13^2 e^(i a2) + m3 s13^2 e^(i a3) |,
 *     NO: m1 = m0, m2 = sqrt(m0^2 + dm21), m3 = sqrt(m0^2 + dm3l);  IO: m3 = m0, m2 = sqrt(m0^2 - dm3l), m1 = sqrt(m2^2 - dm21).
 *     Over the two free phases the sum of three positive lengths a_i ranges from max(0, 2 max a_i - sum a_i) to sum a_i.
 *
 * Plain script: window.DBMATH in a browser (needs window.BETA), module.exports in Node.
 */
(function (root) {
  'use strict';
  var BETA = typeof module !== 'undefined' && module.exports ? require('./betadecay.js') : root.BETA;
  var ME = BETA.ME;                         // MeV
  var ME_MEV = ME * 1e9;                    // m_e c^2 in meV
  var FWHM = 2 * Math.sqrt(2 * Math.LN2);

  // ---------- Gauss-Legendre on [0, 1] (the routine of betadecay.js is private; same algorithm)
  function gl(n) {
    var x = new Float64Array(n), w = new Float64Array(n);
    for (var i = 0; i < Math.ceil(n / 2); i++) {
      var z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp, z1;
      do {
        var p1 = 1, p2 = 0;
        for (var j = 1; j <= n; j++) { var p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1);
        z1 = z; z = z1 - p1 / pp;
      } while (Math.abs(z - z1) > 1e-15);
      x[i] = 0.5 * (1 - z); x[n - 1 - i] = 0.5 * (1 + z);
      w[i] = w[n - 1 - i] = 1 / ((1 - z * z) * pp * pp);
    }
    return { x: x, w: w };
  }
  var G8 = gl(8), G24 = gl(24), G48 = gl(48);
  function integ(f, a, b, g, nsub) {     // composite Gauss-Legendre
    g = g || G24; nsub = nsub || 1;
    var s = 0, h = (b - a) / nsub;
    for (var k = 0; k < nsub; k++) for (var i = 0; i < g.x.length; i++) s += g.w[i] * f(a + h * (k + g.x[i]));
    return s * h;
  }

  // ---------- erf / erfc: Taylor series below 1.5, Lentz continued fraction for erfc above (rel. error ~1e-15)
  function erfc(x) {
    if (x < 0) return 2 - erfc(-x);
    if (x < 1.5) {
      var s = 0, t = x, n = 0;
      while (Math.abs(t) > 1e-17 * Math.abs(s) || n < 3) { s += t / (2 * n + 1); n++; t *= -x * x / n; if (n > 200) break; }
      return 1 - 2 / Math.sqrt(Math.PI) * s;
    }
    // erfc(x) = exp(-x^2)/sqrt(pi) * 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + 2/(x + ...)))))
    var tiny = 1e-300, f = x, C = x, D = 0;
    for (var k = 1; k < 5000; k++) {
      var a = k / 2;
      D = x + a * D; if (Math.abs(D) < tiny) D = tiny; D = 1 / D;
      C = x + a / C; if (Math.abs(C) < tiny) C = tiny;
      var d = C * D; f *= d;
      if (Math.abs(d - 1) < 1e-16) break;
    }
    return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
  }
  function Phi(x) { return 0.5 * erfc(-x / Math.SQRT2); }          // standard normal CDF

  // ---------- Q values and the isobar parabolas
  function ameMap(rows) {                   // AME rows [Z, N, Delta keV, sigma keV, est]
    var m = new Map();
    for (var i = 0; i < rows.length; i++) m.set(rows[i][0] + ',' + (rows[i][0] + rows[i][1]), { d: rows[i][2], u: rows[i][3], est: !!rows[i][4] });
    return m;
  }
  function delta(map, Z, A) { var r = map.get(Z + ',' + A); return r ? r.d : null; }
  function qbb(map, Z, A) { var a = delta(map, Z, A), b = delta(map, Z + 2, A); return a == null || b == null ? null : a - b; }   // keV
  function qb(map, Z, A) { var a = delta(map, Z, A), b = delta(map, Z + 1, A); return a == null || b == null ? null : a - b; }    // keV

  // least squares for M = c Z^2 + b Z + m0 + delta s (normal equations, 4 x 4, Gaussian elimination with pivoting)
  function fitIsobar(pts) {
    var n = 4, A = [], y = [];
    for (var i = 0; i < n; i++) { A.push([0, 0, 0, 0]); y.push(0); }
    for (var k = 0; k < pts.length; k++) {
      var z = pts[k].Z - pts[k].Zref, s = pts[k].Z % 2 ? 1 : -1, v = [z * z, z, 1, s];
      for (var i2 = 0; i2 < n; i2++) { y[i2] += v[i2] * pts[k].d; for (var j = 0; j < n; j++) A[i2][j] += v[i2] * v[j]; }
    }
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      var t = A[c]; A[c] = A[p]; A[p] = t; var ty = y[c]; y[c] = y[p]; y[p] = ty;
      for (var r2 = c + 1; r2 < n; r2++) {
        var f = A[r2][c] / A[c][c];
        for (var j2 = c; j2 < n; j2++) A[r2][j2] -= f * A[c][j2];
        y[r2] -= f * y[c];
      }
    }
    var x = [0, 0, 0, 0];
    for (var c2 = n - 1; c2 >= 0; c2--) { var s2 = y[c2]; for (var j3 = c2 + 1; j3 < n; j3++) s2 -= A[c2][j3] * x[j3]; x[c2] = s2 / A[c2][c2]; }
    var res = 0;
    for (var k2 = 0; k2 < pts.length; k2++) { var e = model(x, pts[k2].Z, pts[k2].Zref) - pts[k2].d; res += e * e; }
    return { c: x[0], b: x[1], m0: x[2], delta: x[3], Zref: pts.length ? pts[0].Zref : 0, rms: Math.sqrt(res / pts.length), n: pts.length };
  }
  function model(x, Z, Zref) { var z = Z - Zref; return x[0] * z * z + x[1] * z + x[2] + x[3] * (Z % 2 ? 1 : -1); }
  // the fitted parabola of one parity class (odd: s = +1) at a continuous Z
  function parabola(fit, Z, odd) { var z = Z - fit.Zref; return fit.c * z * z + fit.b * z + fit.m0 + (odd ? fit.delta : -fit.delta); }
  // the isobar points used for a fit: measured masses within w charges of the lowest member
  function isobarPoints(map, A, w) {
    var zf = null, dmin = Infinity;
    for (var Z = 0; Z <= A; Z++) { var r = map.get(Z + ',' + A); if (r && r.d < dmin) { dmin = r.d; zf = Z; } }
    var pts = [];
    for (var Z2 = zf - w; Z2 <= zf + w; Z2++) { var r2 = map.get(Z2 + ',' + A); if (r2 && !r2.est) pts.push({ Z: Z2, d: r2.d, Zref: zf }); }
    return { pts: pts, zfloor: zf, dmin: dmin };
  }

  // ---------- spectra (K, T0 in m_e c^2)
  function prPoly(K) { return K * ((((K + 10) * K + 40) * K + 60) * K + 30); }
  function prShape(K, T0) { return K <= 0 || K >= T0 ? 0 : prPoly(K) * Math.pow(T0 - K, 5); }
  // the shape is a polynomial of degree 10: 8-point Gauss-Legendre is exact
  function prNorm(T0) { return integ(function (K) { return prShape(K, T0); }, 0, T0, G8, 1); }
  // the same with the F0 L0 Fermi function of betadecay.js for each electron (daughter charge Zd, mass number A)
  function fermiPart(eps, Zd, Rn) { var p = Math.sqrt(eps * (eps + 2)), W = 1 + eps; return BETA.fermi('rel', Zd, W, Rn, 1, p) * p * W; }
  function fermiInner(K, Zd, A) {
    var Rn = BETA.radius(A) / BETA.LC;
    // k1 = K (1 - cos t) / 2 clusters the nodes at both ends, where p ~ sqrt(k)
    return integ(function (t) { var k1 = K * (1 - Math.cos(t)) / 2; return fermiPart(k1, Zd, Rn) * fermiPart(K - k1, Zd, Rn) * K * Math.sin(t) / 2; }, 0, Math.PI, G48, 1);
  }
  function fermiShape(K, T0, Zd, A) { return K <= 0 || K >= T0 ? 0 : fermiInner(K, Zd, A) * Math.pow(T0 - K, 5); }

  // a normalized 2nu spectrum in MeV: {pdf(E) per MeV, Q}; kind 'pr' or 'fermi' (the latter tabulated on n points)
  function spectrum2nu(Q, kind, Zd, A, n) {
    var T0 = Q / ME;
    if (kind !== 'fermi') {
      var N = prNorm(T0);
      return { Q: Q, kind: 'pr', pdf: function (E) { return prShape(E / ME, T0) / (N * ME); } };
    }
    n = n || 160;
    // table on a grid clustered at both ends (u in [0, pi]); linear interpolation of the shape
    var xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
    for (var i = 0; i <= n; i++) { var K = T0 * (1 - Math.cos(Math.PI * i / n)) / 2; xs[i] = K; ys[i] = fermiShape(K, T0, Zd, A); }
    // interpolate g = shape / (K (T0 - K)^5), which is smooth, then restore the factors; its end values from the inner
    // integral itself (shape / K -> inner / K at K -> 0, shape / (T0 - K)^5 -> inner at K -> T0)
    var gs = new Float64Array(n + 1);
    gs[0] = fermiInner(1e-9 * T0, Zd, A) / (1e-9 * T0);
    gs[n] = fermiInner(T0 * (1 - 1e-12), Zd, A) / T0;
    for (var i2 = 1; i2 < n; i2++) gs[i2] = ys[i2] / (xs[i2] * Math.pow(T0 - xs[i2], 5));
    var shape = function (K) {
      if (K <= 0 || K >= T0) return 0;
      var u = Math.acos(1 - 2 * K / T0) / Math.PI * n, j = Math.min(n - 1, Math.floor(u));
      var f = (K - xs[j]) / (xs[j + 1] - xs[j]);
      return (gs[j] + f * (gs[j + 1] - gs[j])) * K * Math.pow(T0 - K, 5);
    };
    var Nf = integ(shape, 0, T0, G24, 40);
    return { Q: Q, kind: 'fermi', pdf: function (E) { return shape(E / ME) / (Nf * ME); }, shape: shape };
  }
  // the Gaussian-smeared density at E (MeV), constant sigma (MeV)
  function smeared(sp, E, sigma) {
    if (!(sigma > 0)) return sp.pdf(E);
    var a = Math.max(0, E - 8 * sigma), b = Math.min(sp.Q, E + 8 * sigma);
    if (b <= a) return 0;
    var nsub = Math.max(1, Math.ceil((b - a) / (sigma * 1.5)));
    return integ(function (K) { var z = (E - K) / sigma; return sp.pdf(K) * Math.exp(-0.5 * z * z); }, a, b, G24, nsub) / (sigma * Math.sqrt(2 * Math.PI));
  }
  function smearedLine(E, Q, sigma) { var z = (E - Q) / sigma; return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI)); }
  // fraction of 2nu decays whose smeared energy falls in [lo, hi] (MeV)
  function frac2nu(sp, sigma, lo, hi) {
    var a = Math.max(0, lo - 9 * sigma), b = Math.min(sp.Q, hi + 9 * sigma);
    if (b <= a) return 0;
    var nsub = Math.max(4, Math.ceil((b - a) / (sigma * 1.5)));
    return integ(function (K) { return sp.pdf(K) * (Phi((hi - K) / sigma) - Phi((lo - K) / sigma)); }, a, b, G24, Math.min(nsub, 4000));
  }
  function frac0nu(Q, sigma, lo, hi) { return Phi((hi - Q) / sigma) - Phi((lo - Q) / sigma); }
  // the ROI: Q +- FWHM / 2
  function roi(Q, fwhm) { return [Q - fwhm / 2, Q + fwhm / 2]; }

  // ---------- 0nu and 2nu rate relations
  // 1/T (1/yr); G15 in 1e-15 / yr, M dimensionless, mbb in meV
  function invT0nu(G15, M, mbb, gA) { var r = mbb / ME_MEV; return G15 * 1e-15 * Math.pow(gA, 4) * M * M * r * r; }
  function mbbFromT(T, G15, M, gA) { return ME_MEV / (gA * gA * M * Math.sqrt(G15 * 1e-15 * T)); }   // meV
  function MfromLimit(T, G15, mbb, gA) { return ME_MEV / (gA * gA * mbb * Math.sqrt(G15 * 1e-15 * T)); }
  function meff2nu(G21, T) { return 1 / Math.sqrt(G21 * 1e-21 * T); }

  // ---------- effective Majorana mass (eV); p = {s12, s13, dm21 (eV^2), dm3l (eV^2)}
  function masses(m0, ord, p) {
    if (ord === 'NO') return [m0, Math.sqrt(m0 * m0 + p.dm21), Math.sqrt(m0 * m0 + p.dm3l)];
    var m2 = Math.sqrt(m0 * m0 - p.dm3l);
    return [Math.sqrt(m2 * m2 - p.dm21), m2, m0];
  }
  function terms(m0, ord, p) {
    var m = masses(m0, ord, p), c13 = 1 - p.s13;
    return [m[0] * (1 - p.s12) * c13, m[1] * p.s12 * c13, m[2] * p.s13];
  }
  function mbb(m0, ord, p, a2, a3) {
    var a = terms(m0, ord, p), re = a[0] + a[1] * Math.cos(a2) + a[2] * Math.cos(a3), im = a[1] * Math.sin(a2) + a[2] * Math.sin(a3);
    return Math.hypot(re, im);
  }
  function mbbRange(m0, ord, p) {
    var a = terms(m0, ord, p), s = a[0] + a[1] + a[2], mx = Math.max(a[0], a[1], a[2]);
    return [Math.max(0, 2 * mx - s), s];
  }
  // NuFIT parameters -> {s12, s13, dm21, dm3l} at the best fit, or the corners/grid of the 3 sigma box
  function nuParams(nf, ord, which) {
    var o = nf[ord], g = function (k, v) { return k === 'dm21' ? v * 1e-5 : k === 'dm3l' ? v * 1e-3 : v; };
    if (which === 'bf') return [{ s12: o.s12.bf, s13: o.s13.bf, dm21: g('dm21', o.dm21.bf), dm3l: g('dm3l', o.dm3l.bf) }];
    var n = which || 3, out = [], lin = function (k, i) { return g(k, o[k].lo3 + (o[k].hi3 - o[k].lo3) * i / (n - 1)); };
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) for (var k = 0; k < n; k++) for (var l = 0; l < n; l++)
      out.push({ s12: lin('s12', i), s13: lin('s13', j), dm21: lin('dm21', k), dm3l: lin('dm3l', l) });
    return out;
  }
  function mbbBand(m0, ord, plist) {
    var lo = Infinity, hi = 0;
    for (var i = 0; i < plist.length; i++) { var r = mbbRange(m0, ord, plist[i]); if (r[0] < lo) lo = r[0]; if (r[1] > hi) hi = r[1]; }
    return [lo, hi];
  }

  // ---------- event sampling (energies in MeV); u() a uniform random number generator
  function rejection(f, fmax, a, b, u) { for (var t = 0; t < 10000; t++) { var x = a + (b - a) * u(); if (u() * fmax <= f(x)) return x; } return (a + b) / 2; }
  function sampler2nu(sp, n) {
    n = n || 1200;
    var Q = sp.Q, c = new Float64Array(n + 1);
    for (var i = 1; i <= n; i++) { var a = Q * (i - 1) / n, b = Q * i / n; c[i] = c[i - 1] + integ(sp.pdf, a, b, G8, 1); }
    var tot = c[n];
    return function (u) {
      var t = u() * tot, lo = 0, hi = n;
      while (hi - lo > 1) { var m = (lo + hi) >> 1; if (c[m] < t) lo = m; else hi = m; }
      var fr = c[hi] > c[lo] ? (t - c[lo]) / (c[hi] - c[lo]) : 0;
      return Q * (lo + fr) / n;
    };
  }
  // split a summed kinetic energy K (MeV) between the two electrons: density (eps1 + 1)^2 (eps2 + 1)^2 in m_e units
  function splitElectrons(K, u) {
    var k = K / ME, f = function (x) { var v = (x + 1) * (k - x + 1); return v * v; };
    var fm = Math.pow(k / 2 + 1, 4), x = rejection(f, fm, 0, k, u);
    return [x * ME, (k - x) * ME];
  }
  // split the neutrino energy R (MeV): density w1^2 w2^2
  function splitNeutrinos(R, u) {
    var f = function (x) { var v = x * (R - x); return v * v; };
    var x = rejection(f, Math.pow(R / 2, 4), 0, R, u);
    return [x, R - x];
  }

  var DBMATH = {
    ME: ME, ME_MEV: ME_MEV, FWHM: FWHM, erfc: erfc, Phi: Phi, gl: gl, integ: integ,
    ameMap: ameMap, delta: delta, qbb: qbb, qb: qb, fitIsobar: fitIsobar, parabola: parabola, isobarPoints: isobarPoints,
    prPoly: prPoly, prShape: prShape, prNorm: prNorm, fermiInner: fermiInner, fermiShape: fermiShape,
    spectrum2nu: spectrum2nu, smeared: smeared, smearedLine: smearedLine, frac2nu: frac2nu, frac0nu: frac0nu, roi: roi,
    invT0nu: invT0nu, mbbFromT: mbbFromT, MfromLimit: MfromLimit, meff2nu: meff2nu,
    masses: masses, terms: terms, mbb: mbb, mbbRange: mbbRange, nuParams: nuParams, mbbBand: mbbBand,
    sampler2nu: sampler2nu, splitElectrons: splitElectrons, splitNeutrinos: splitNeutrinos
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DBMATH; else root.DBMATH = DBMATH;
})(this);
