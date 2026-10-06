/* ------------------------------------------------------------------ *
 * Neutron resonances: single-level Breit-Wigner cross sections from ENDF resonance parameters, Doppler
 * broadening by the psi-chi functions, and the statistics of level spacings and widths.
 *
 * Cross sections (ENDF-6 Formats Manual, BNL-203218-2018-INRE, Sec. D.1.1, the SLBW formulas; here summed over
 * all levels with no interference between levels in capture, i.e. "multi-level" only in the sense of a sum):
 *   k = 2.196771e-3 * AWRI/(AWRI+1) * sqrt(E)          (1/(1e-12 cm), E lab in eV)
 *   sigma_p = (4 pi/k^2) sum_l (2l+1) sin^2 phi_l       phi_0 = rho', phi_1 = rho' - atan(rho'), rho' = k AP
 *   Gamma_n(E) = Gamma_n(|E_r|) P_l(rho)/P_l(rho_r)     P_0 = rho, P_1 = rho^3/(1+rho^2), rho = k a,
 *                                                       a = 0.123 AWRI^(1/3) + 0.08 (NAPS = 0)
 *   sigma_n = sigma_p + (pi/k^2) sum_r g_J [Gn^2 cos 2phi - 2 Gn (Gg+Gf) sin^2 phi + 2 (E-E_r) Gn sin 2phi] / [(E-E_r)^2 + G^2/4]
 *   sigma_g = (pi/k^2) sum_r g_J Gn Gg / [(E-E_r)^2 + G^2/4],  g_J = (2J+1)/(2(2I+1))
 * The resonance energy is not shifted (E_r' = E_r): ENDF's Reich-Moore parameters carry no shift, and for l = 0
 * the shift factor vanishes.
 * Doppler (free gas, Bethe-Placzek): 1/(1+x^2) -> psi(x, xi), x/(1+x^2) -> chi(x, xi), x = 2(E-E_r)/G (chi here is
 * defined as the broadened x/(1+x^2), half of the chi of Bethe and Placzek, whose natural limit is 2x/(1+x^2)),
 * xi = G/Delta, Delta = sqrt(4 E_r k T / AWRI); psi + i chi = (xi sqrt(pi)/2) w((x + i) xi/2), w the Faddeeva
 * function (Weideman, SIAM J. Numer. Anal. 31, 1497 (1994), N = 32, for |z| < 6; Laplace continued fraction to |z| = 12;
 * the three-term asymptotic series beyond).
 * Plain script: window.RES in a browser, module.exports in Node.
 * ------------------------------------------------------------------ */
(function (root) {
  "use strict";
  var KB = 8.617333262e-5, HBAR = 6.582119569e-16;   // eV/K, eV s (CODATA 2018)
  var SQPI = Math.sqrt(Math.PI);

  // ---------- Faddeeva w(z), Im z >= 0
  var WN = 32, WL = Math.sqrt(WN / Math.SQRT2), WA = (function () {
    var M = 2 * WN, M2 = 2 * M, f = new Float64Array(M2), i, k;
    // f on k = -M+1 .. M-1 preceded by a zero, then fftshift: the real DFT of the shifted array
    var g = [0];
    for (k = -M + 1; k <= M - 1; k++) { var t = WL * Math.tan(k * Math.PI / M / 2); g.push(Math.exp(-t * t) * (WL * WL + t * t)); }
    for (i = 0; i < M2; i++) f[i] = g[(i + M) % M2];
    var a = new Float64Array(WN + 1);
    for (var n = 1; n <= WN; n++) { var s = 0; for (i = 0; i < M2; i++) s += f[i] * Math.cos(2 * Math.PI * n * i / M2); a[n] = s / M2; }
    var out = []; for (n = WN; n >= 1; n--) out.push(a[n]);      // highest power first
    return out;
  })();
  function faddeeva(x, y) {                          // returns [Re w, Im w] for z = x + i y, y >= 0
    var r2 = x * x + y * y, a, b;
    if (r2 >= 144) {                                 // asymptotic: (i/(sqrt(pi) z)) (1 + 1/(2 z^2) + 3/(4 z^4)), error < 2e-6 relative
      var ur = x / r2, ui = -y / r2;                 // 1/z
      var u2r = ur * ur - ui * ui, u2i = 2 * ur * ui, u4r = u2r * u2r - u2i * u2i, u4i = 2 * u2r * u2i;
      var sr = 1 + 0.5 * u2r + 0.75 * u4r, si = 0.5 * u2i + 0.75 * u4i;
      var qr = ur * sr - ui * si, qi = ur * si + ui * sr;   // (1/z) * series
      return [-qi / SQPI, qr / SQPI];
    }
    if (r2 >= 36) {                                  // continued fraction, 12 levels: |w - wofz| < 2e-13 here
      var cr = 0, ci = 0;
      for (var n = 12; n >= 1; n--) {
        a = x - cr; b = y - ci; var d = a * a + b * b; cr = (n / 2) * a / d; ci = -(n / 2) * b / d;
      }
      a = x - cr; b = y - ci; var dd = a * a + b * b;   // i/(sqrt(pi) (a + i b)) = (b + i a)/(sqrt(pi)|.|^2)
      return [b / (SQPI * dd), a / (SQPI * dd)];
    }
    // Z = (L + i z)/(L - i z); L + i z = (L - y) + i x, L - i z = (L + y) - i x
    var nr = WL - y, ni = x, dr = WL + y, di = -x, den = dr * dr + di * di;
    var Zr = (nr * dr + ni * di) / den, Zi = (ni * dr - nr * di) / den;
    var pr = 0, pi = 0;
    for (var k = 0; k < WA.length; k++) { var t = pr * Zr - pi * Zi + WA[k]; pi = pr * Zi + pi * Zr; pr = t; }
    // w = 2 p/(L - i z)^2 + (1/sqrt(pi))/(L - i z)
    var ir = dr / den, ii = -di / den;              // 1/(L - i z)
    var i2r = ir * ir - ii * ii, i2i = 2 * ir * ii;
    return [2 * (pr * i2r - pi * i2i) + ir / SQPI, 2 * (pr * i2i + pi * i2r) + ii / SQPI];
  }
  function psichi(x, xi) {                           // Doppler line shapes; xi = Infinity gives the natural shapes
    if (!(xi < 1e8)) return [1 / (1 + x * x), x / (1 + x * x)];
    var w = faddeeva(x * xi / 2, xi / 2), c = xi * SQPI / 2;
    return [c * w[0], c * w[1]];
  }

  // ---------- a set of resonances from RES_DATA
  function prepare(D, opts) {
    opts = opts || {};
    var m = D.meta, R = D.res.filter(function (r) { return (opts.l == null || r[0] === opts.l); });
    var awr = m.blocks[0].AWRI, n = R.length;
    var ch = 0.123 * Math.cbrt(awr) + 0.08;          // channel radius for the penetrabilities (NAPS = 0), 1e-12 cm
    var P = { awr: awr, a: ch, ap: m.blocks.map(function (b) { return b.APL || m.AP; }), spi: m.SPI, n: n,
      l: new Int8Array(n), E: new Float64Array(n), J: new Float64Array(n), Gn: new Float64Array(n), Gg: new Float64Array(n),
      Gf: new Float64Array(n), g: new Float64Array(n), Pr: new Float64Array(n), ls: m.blocks.map(function (b) { return b.l; }) };
    for (var i = 0; i < n; i++) {
      var r = R[i];
      P.l[i] = r[0]; P.E[i] = r[1]; P.J[i] = r[2]; P.Gn[i] = Math.abs(r[3]); P.Gg[i] = r[4]; P.Gf[i] = Math.abs(r[5]) + Math.abs(r[6]);
      P.g[i] = (2 * r[2] + 1) / (2 * (2 * m.SPI + 1));
      P.Pr[i] = pen(r[0], kOf(P, Math.abs(r[1])) * ch);
    }
    return P;
  }
  function kOf(P, E) { return 2.196771e-3 * P.awr / (P.awr + 1) * Math.sqrt(E); }
  function pen(l, rho) { return l === 0 ? rho : rho * rho * rho / (1 + rho * rho); }
  function hsPhase(l, rho) { return l === 0 ? rho : rho - Math.atan(rho); }
  function gammaN(P, i, E) { return P.Gn[i] * pen(P.l[i], kOf(P, E) * P.a) / P.Pr[i]; }
  function doppler(P, i, T) { return T > 0 && P.E[i] > 0 ? Math.sqrt(4 * P.E[i] * KB * T / P.awr) : 0; }

  /* sigma at lab energy E (eV), temperature T (K): { tot, el, cap, fis, pot } in barns.
     opt.only: index of one resonance (the others left out, potential scattering kept). */
  function sigma(P, E, T, opt) {
    var k = kOf(P, E), pk = Math.PI / (k * k), rho = k * P.a, out = { el: 0, cap: 0, fis: 0, pot: 0 };
    var ph = [], s2 = [], c2 = [], sn2 = [];
    for (var q = 0; q < P.ls.length; q++) {
      var l = P.ls[q], p = hsPhase(l, k * P.ap[q]);
      ph[l] = p; s2[l] = Math.sin(p) * Math.sin(p); c2[l] = Math.cos(2 * p); sn2[l] = Math.sin(2 * p);
      out.pot += 4 * pk * (2 * l + 1) * s2[l];
    }
    var pr0 = pen(0, rho), pr1 = pen(1, rho);
    var i0 = 0, i1 = P.n;
    if (opt && opt.only != null) { i0 = opt.only; i1 = opt.only + 1; }
    for (var i = i0; i < i1; i++) {
      var l2 = P.l[i], Gn = P.Gn[i] * (l2 === 0 ? pr0 : pr1) / P.Pr[i], G = Gn + P.Gg[i] + P.Gf[i];
      var x = 2 * (E - P.E[i]) / G, D = T > 0 && P.E[i] > 0 ? Math.sqrt(4 * P.E[i] * KB * T / P.awr) : 0;
      var ps, ch;
      // far from E_r (beyond 100 (Delta + G)) the Doppler shapes equal the natural ones to 1.5 (Delta/(E-E_r))^2 < 2e-4 relative
      if (D > 0 && Math.abs(E - P.E[i]) < 100 * (D + G)) { var pc = psichi(x, G / D); ps = pc[0]; ch = pc[1]; } else { ps = 1 / (1 + x * x); ch = x * ps; }
      var s0 = 4 * pk * P.g[i] * Gn / G;             // peak total of the resonance (sigma_0)
      out.cap += s0 * P.Gg[i] / G * ps;
      out.fis += s0 * P.Gf[i] / G * ps;
      out.el += s0 * ((Gn / G - 2 * s2[l2]) * ps + sn2[l2] * ch);
    }
    out.el += out.pot;
    out.tot = out.el + out.cap + out.fis;
    return out;
  }

  // ---------- one resonance in closed form
  function peak(P, i) {                              // at E = E_r, T = 0, from that resonance alone
    var E = P.E[i], k = kOf(P, E), lam2 = 1 / (k * k);  // lambda-bar^2 in barns (1e-24 cm^2)
    var Gn = P.Gn[i], G = Gn + P.Gg[i] + P.Gf[i];
    return { lambdaBar_fm: 1e-12 / k * 1e13, sigma0: 4 * Math.PI * lam2 * P.g[i] * Gn / G, sigmaCap: 4 * Math.PI * lam2 * P.g[i] * Gn * P.Gg[i] / (G * G),
      G: G, tau_s: HBAR / G };
  }
  /* integral of the capture line over E for one resonance, Gamma_n frozen at E_r: (pi/2) sigma0 G Gg/G = 2 pi^2 lambda-bar^2 g Gn Gg/G */
  function capArea(P, i) { var p = peak(P, i); return Math.PI / 2 * p.sigmaCap * p.G; }

  // ---------- capture resonance integral, int sigma_g dE/E over [Ea, Eb]
  /* capture is a plain sum over levels, so the integral is the sum of one-level integrals. Each is done in two
     variables in which the integrand is smooth, so that Simpson's rule converges fast: near the level
     t = asinh((E - E_r)/w), w = max(G/2, Delta), for |t| <= TMAX and |E - E_r| <= E_r/2 (a Lorentzian becomes 1/cosh t),
     and beyond that
     ln E (the tails, int sigma d ln E). Levels outside [Ea, Eb] are done in ln E alone. */
  var RIG = { tmax: 7.5, ht: 0.1, nlog: 150 };
  function simp(j, n) { return j === 0 || j === n ? 1 : (j % 2 ? 4 : 2); }   // Simpson weights, n even
  function trapLog(P, i, a, b, T, n) {               // int_a^b sigma_i dE/E = int sigma_i d(ln E), Simpson
    if (!(b > a)) return 0;
    var la = Math.log(a), h = (Math.log(b) - la) / n, s = 0;
    for (var j = 0; j <= n; j++) { var c = sigma(P, Math.exp(la + j * h), T, { only: i }).cap; s += c * simp(j, n); }
    return s * h / 3;
  }
  function levelIntegral(P, i, Ea, Eb, T) {
    var G = P.Gn[i] + P.Gg[i] + P.Gf[i], w = Math.max(G / 2, doppler(P, i, T)), Er = P.E[i];
    if (Er <= Ea || Er >= Eb) return trapLog(P, i, Ea, Eb, T, RIG.nlog);
    // the t window stays within E_r/2 of E_r: further out 1/E and Gamma_n(E) vary on the scale of E, which ln E follows
    var t0 = -Math.min(RIG.tmax, Math.asinh(Math.min(Er - Ea, Er / 2) / w)), t1 = Math.min(RIG.tmax, Math.asinh(Math.min(Eb - Er, Er / 2) / w));
    var n = 2 * Math.max(4, Math.ceil((t1 - t0) / RIG.ht / 2)), h = (t1 - t0) / n, s = 0;
    for (var j = 0; j <= n; j++) {
      var t = t0 + j * h, E = Er + w * Math.sinh(t);
      var c = sigma(P, E, T, { only: i }).cap / E * w * Math.cosh(t);
      s += c * simp(j, n);
    }
    s *= h / 3;
    var e0 = Er + w * Math.sinh(t0), e1 = Er + w * Math.sinh(t1);
    var nh = 2 * Math.round(RIG.nlog / 4);
    return s + trapLog(P, i, Ea, e0, T, nh) + trapLog(P, i, e1, Eb, T, nh);
  }
  function resonanceIntegral(P, Ea, Eb, T, only) {
    var s = 0, i0 = only == null ? 0 : only, i1 = only == null ? P.n : only + 1;
    for (var i = i0; i < i1; i++) s += levelIntegral(P, i, Ea, Eb, T);
    return s;
  }


  /* the narrow-resonance self-shielded capture integral. In a mixture with a background (dilution) cross section
     sigma_b per absorber atom, the standard narrow-resonance form of the flux is
       phi(E) = (sigma_p + sigma_b)/(sigma_t(E) + sigma_b) * 1/E,
     with sigma_p the absorber's potential scattering (here 4 pi AP^2), so that phi -> 1/E between resonances; and
       I_eff(sigma_b) = int sigma_g (sigma_p + sigma_b)/(sigma_t + sigma_b) dE/E,  sigma_b -> infinity gives the resonance integral.
     shieldGrid builds a quadrature once per temperature: [Ea, Eb] is cut into cells at the midpoints between levels;
     each cell is integrated by Simpson's rule in t = asinh((E - E_r)/w) of its own level within E_r/2 of E_r, and
     in ln E for the rest of the cell. It stores the nodes, the weights for dE and sigma_t, sigma_g at the nodes;
     ieff then sums for any sigma_b. */
  function shieldGrid(P, Ea, Eb, T, ht) {
    ht = ht || 0.2;
    var lev = [];
    for (var i = 0; i < P.n; i++) if (P.E[i] > Ea && P.E[i] < Eb) lev.push(i);
    lev.sort(function (x, y) { return P.E[x] - P.E[y]; });
    var E = [], W = [];
    function addLog(a, b) {                         // int over [a, b] in ln E: dE = E d(ln E)
      if (!(b > a)) return;
      var n = 2 * Math.max(2, Math.ceil(Math.log(b / a) / 0.01 / 2)), h = Math.log(b / a) / n;
      for (var j = 0; j <= n; j++) { var e = a * Math.exp(j * h); E.push(e); W.push(simp(j, n) * h / 3 * e); }
    }
    function addT(Er, w, a, b) {                     // int over [a, b] in t
      var t0 = Math.asinh((a - Er) / w), t1 = Math.asinh((b - Er) / w);
      var n = 2 * Math.max(2, Math.ceil((t1 - t0) / ht / 2)), h = (t1 - t0) / n;
      for (var j = 0; j <= n; j++) { var t = t0 + j * h; E.push(Er + w * Math.sinh(t)); W.push(simp(j, n) * h / 3 * w * Math.cosh(t)); }
    }
    if (!lev.length) addLog(Ea, Eb);
    for (var k = 0; k < lev.length; k++) {
      var q = lev[k], Er = P.E[q], G = P.Gn[q] + P.Gg[q] + P.Gf[q], w = Math.max(G / 2, doppler(P, q, T));
      var a = k ? 0.5 * (P.E[lev[k - 1]] + Er) : Ea, b = k < lev.length - 1 ? 0.5 * (Er + P.E[lev[k + 1]]) : Eb;
      var ta = Math.max(a, Er / 2), tb = Math.min(b, 1.5 * Er);
      addLog(a, ta); addT(Er, w, ta, tb); addLog(tb, b);
    }
    var st = new Float64Array(E.length), sg = new Float64Array(E.length);
    for (var j = 0; j < E.length; j++) { var x = sigma(P, E[j], T); st[j] = x.tot; sg[j] = x.cap; }
    return { E: E, W: W, tot: st, cap: sg };
  }
  function sigmaPot(P) { return 4 * Math.PI * P.ap[0] * P.ap[0]; }   // b (AP in 1e-12 cm): the E -> 0 hard-sphere value
  function ieff(g, sigb, sigp) {
    var s = 0;
    for (var j = 0; j < g.E.length; j++) s += g.W[j] * g.cap[j] * (isFinite(sigb) ? (sigp + sigb) / (g.tot[j] + sigb) : 1) / g.E[j];
    return s;
  }
  /* branching of the compound level: gamma, neutron, fission; outcome(u) for u uniform in [0, 1) */
  function branching(P, i, E) {
    var Gn = E == null ? P.Gn[i] : gammaN(P, i, E), G = Gn + P.Gg[i] + P.Gf[i];
    return { g: P.Gg[i] / G, n: Gn / G, f: P.Gf[i] / G };
  }
  function outcome(b, u) { return u < b.g ? "g" : u < b.g + b.n ? "n" : "f"; }
  /* a subset of levels (indices kept in .idx), for sums that only need the levels near a window */
  function subset(P, keep) {
    var idx = []; for (var i = 0; i < P.n; i++) if (keep(P.E[i], P.l[i])) idx.push(i);
    var Q = { awr: P.awr, a: P.a, ap: P.ap, spi: P.spi, ls: P.ls, n: idx.length, idx: idx };
    ["l", "E", "J", "Gn", "Gg", "Gf", "g", "Pr"].forEach(function (k) { Q[k] = new P[k].constructor(idx.length); for (var j = 0; j < idx.length; j++) Q[k][j] = P[k][idx[j]]; });
    return Q;
  }

  // ---------- statistics
  var wigner = function (s) { return Math.PI / 2 * s * Math.exp(-Math.PI * s * s / 4); };
  var poisson = function (s) { return Math.exp(-s); };
  function lgamma(x) {                               // Lanczos, g = 7, x > 0
    var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1; var a = c[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function digamma(x) {                              // recurrence to x >= 8, then the asymptotic series
    var r = 0;
    while (x < 8) { r -= 1 / x; x += 1; }
    var f = 1 / (x * x);
    return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
  }
  /* chi-squared density with nu degrees of freedom for x = Gamma/<Gamma> (mean 1) */
  function ptPdf(x, nu) { var h = nu / 2; return Math.exp(h * Math.log(h) + (h - 1) * Math.log(x) - h * x - lgamma(h)); }
  /* maximum-likelihood nu of a scaled chi-squared (a gamma distribution of shape nu/2, scale free):
     ln(nu/2) - digamma(nu/2) = ln(mean x) - mean(ln x), solved by bisection on a log scale */
  function fitNu(x) {
    var mx = 0, ml = 0; for (var i = 0; i < x.length; i++) { mx += x[i]; ml += Math.log(x[i]); }
    mx /= x.length; ml /= x.length;
    var rhs = Math.log(mx) - ml;
    var lo = 0.01, hi = 100;
    for (var it = 0; it < 200; it++) { var m = Math.sqrt(lo * hi), f = Math.log(m / 2) - digamma(m / 2) - rhs; if (f > 0) lo = m; else hi = m; }
    return Math.sqrt(lo * hi);
  }
  /* least-squares line through the staircase N(E_i) = i (i = 1..n): returns { D, N0 } with N = N0 + E/D */
  function staircase(E) {
    var n = E.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) { sx += E[i]; sy += i + 1; sxx += E[i] * E[i]; sxy += E[i] * (i + 1); }
    var b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return { D: 1 / b, N0: (sy - b * sx) / n };
  }
  function spacings(E, D) { var s = []; for (var i = 1; i < E.length; i++) s.push((E[i] - E[i - 1]) / D); return s; }
  /* Kolmogorov-Smirnov distance of a sample to a cdf */
  function ksDist(x, cdf) {
    var s = x.slice().sort(function (a, b) { return a - b; }), n = s.length, d = 0;
    for (var i = 0; i < n; i++) { var F = cdf(s[i]); d = Math.max(d, Math.abs(F - i / n), Math.abs((i + 1) / n - F)); }
    return d;
  }
  var wignerCdf = function (s) { return 1 - Math.exp(-Math.PI * s * s / 4); };
  var poissonCdf = function (s) { return 1 - Math.exp(-s); };

  /* thin-sample-free first-collision capture yield of a slab of n atoms/b: (1 - e^{-n sigma_t}) sigma_g/sigma_t */
  function yield1(sig, n) { return (1 - Math.exp(-n * sig.tot)) * sig.cap / sig.tot; }

  var RES = { KB: KB, HBAR: HBAR, faddeeva: faddeeva, psichi: psichi, prepare: prepare, kOf: kOf, pen: pen, gammaN: gammaN,
    doppler: doppler, sigma: sigma, peak: peak, capArea: capArea, resonanceIntegral: resonanceIntegral, RIG: RIG, shieldGrid: shieldGrid, ieff: ieff, sigmaPot: sigmaPot, branching: branching, outcome: outcome, subset: subset,
    wigner: wigner, poisson: poisson, wignerCdf: wignerCdf, poissonCdf: poissonCdf, lgamma: lgamma, digamma: digamma,
    ptPdf: ptPdf, fitNu: fitNu, staircase: staircase, spacings: spacings, ksDist: ksDist, yield1: yield1 };
  if (typeof module !== "undefined" && module.exports) module.exports = RES; else root.RES = RES;
})(this);
