/* gammadecay.js: electromagnetic transitions of nuclei.
 *
 * Model (stated in full on gamma.html):
 *   Rate of a transition of multipolarity sigma L (sigma = E or M) between nuclear states, long-wavelength limit:
 *     lambda(sigma L) = 8 pi (L + 1) / (L [(2L + 1)!!]^2) * (1/hbar) * (E/hbar c)^(2L + 1) * B(sigma L)
 *   with B(EL) in e^2 fm^(2L) and B(ML) in mu_N^2 fm^(2L - 2); e^2 = alpha hbar c, mu_N = e hbar / 2 m_p c.
 *   Weisskopf single-particle units, radius R = 1.2 A^(1/3) fm (the convention of the W.u. values printed
 *   in ENSDF and in the B(E2) tables, which tests/check_gamma.js reproduces):
 *     B_W(EL) = (1 / 4 pi) [3 / (L + 3)]^2 (1.2 A^(1/3))^(2L)                  e^2 fm^(2L)
 *     B_W(ML) = (10 / pi)  [3 / (L + 3)]^2 (1.2 A^(1/3))^(2L - 2)              mu_N^2 fm^(2L - 2)
 *   The partial gamma half-life of one gamma out of a level: t_gamma = T_level * (sum over all branches of
 *   I_gamma (1 + alpha)) / I_gamma, divided by the isomeric-transition fraction when the level also decays
 *   otherwise; a mixed transition splits as 1 / (1 + delta^2) (lower L) and delta^2 / (1 + delta^2) (upper L).
 *   Conversion coefficients alpha are those printed in ENSDF (BrIcc); nothing here computes one.
 *
 *   Radiation pattern of a pure multipole (L, M): intensity per solid angle |X_LM(theta)|^2, X_LM = L Y_LM /
 *   sqrt(L(L + 1)) the vector spherical harmonic, normalised to 1 over the sphere; the same for EL and ML,
 *   whose far fields differ by a quarter turn of the polarisation: E ~ X_LM for ML, E ~ n x X_LM for EL.
 *
 *   Gamma-gamma angular correlation of a cascade J_i -(L1)-> J -(L2)-> J_f, pure multipoles, no
 *   perturbation: W(theta) = sum_k A_k P_k(cos theta), A_k = F_k(L1 L1 J_i J) F_k(L2 L2 J_f J),
 *     F_k(L L' J_f J_i) = (-1)^(J_f + J_i - 1) sqrt((2k + 1)(2L + 1)(2L' + 1)(2J_i + 1)) (L L' k; 1 -1 0) {L L' k; J_i J_i J_f}
 *   (Frauenfelder and Steffen). tests/check_gamma.py computes W independently by summing over magnetic
 *   substates with Clebsch-Gordan coefficients and Wigner d functions.
 *
 * Plain script: window.GAMMA in a browser, module.exports in Node.
 */
(function (root) {
  'use strict';
  // CODATA 2018
  // hbar c from the exact SI h, c, e (197.32698045930 MeV fm; CODATA prints 197.3269804)
  var HBARC = 6.62607015e-34 * 299792458 / (2 * Math.PI * 1.602176634e-13) * 1e15;
  var ALPHA = 1 / 137.035999084;      // fine-structure constant
  var HBAR = 6.582119569e-22;         // MeV s
  var MP = 938.27208816;              // proton mass, MeV
  var CFM = 2.99792458e23;            // c in fm/s
  var LN2 = Math.LN2;
  var R0 = 1.2;                       // fm, radius convention of the Weisskopf unit

  function dfact(n) { var p = 1; for (var k = n; k > 1; k -= 2) p *= k; return p; }
  var FACT = [1];
  for (var i = 1; i <= 170; i++) FACT[i] = FACT[i - 1] * i;
  function fact(n) { if (n < 0 || n !== Math.round(n)) return NaN; return FACT[n]; }

  // ---------- rates and Weisskopf units
  // B_W in e^2 fm^(2L) (E) or mu_N^2 fm^(2L-2) (M)
  function weisskopfB(sig, L, A) {
    var f = Math.pow(3 / (L + 3), 2), R = R0 * Math.cbrt(A);
    return sig === 'E' ? f * Math.pow(R, 2 * L) / (4 * Math.PI) : 10 / Math.PI * f * Math.pow(R, 2 * L - 2);
  }
  // lambda (1/s) for B in the units above, E in MeV
  function rate(sig, L, E, B) {
    var k = E / HBARC;                                  // fm^-1
    var c = 8 * Math.PI * (L + 1) / (L * Math.pow(dfact(2 * L + 1), 2));
    // e^2 / hbar = alpha c (fm/s per fm^0); mu_N^2 = e^2 (hbar c / 2 m_p c^2)^2
    var b = sig === 'E' ? B : B * Math.pow(HBARC / (2 * MP), 2);
    return c * ALPHA * CFM * Math.pow(k, 2 * L + 1) * b;
  }
  function weisskopfRate(sig, L, E, A) { return rate(sig, L, E, weisskopfB(sig, L, A)); }
  function weisskopfT(sig, L, E, A) { return LN2 / weisskopfRate(sig, L, E, A); }
  // B(E2) up (0+ -> 2+, e^2 b^2) -> down in W.u.; general spin factor (2J_i + 1)/(2J_f + 1) for the reverse
  function be2UpToWu(be2up, A, Ji, Jf) {
    Ji = Ji == null ? 0 : Ji; Jf = Jf == null ? 2 : Jf;
    return be2up * 1e4 * (2 * Ji + 1) / (2 * Jf + 1) / weisskopfB('E', 2, A);
  }

  // ---------- multipolarity strings as ENSDF prints them: "E2", "M1+E2", "[E3]", "E2(+M3)", "(M1)", "E0+M1+E2",
  // and "M1,E2", which means M1 or E2 (not determined), not a mixture
  function parseMult(s) {
    if (!s) return null;
    var tent = /[\[(]/.test(s), t = s.replace(/[\[\]()]/g, '');
    if (t.indexOf(',') >= 0) {
      var alt = t.match(/[EM]\d/g);
      return alt ? { list: [], alt: alt, e0: false, tentative: true } : null;
    }
    var m = t.match(/[EM]\d/g);
    if (!m) return null;
    var out = [], e0 = false;
    for (var i = 0; i < m.length && out.length < 2; i++) { if (m[i] === 'E0') e0 = true; else out.push({ sig: m[i][0], L: +m[i][1] }); }
    if (!out.length) return e0 ? { list: [], e0: true, tentative: tent } : null;
    return { list: out, e0: e0, tentative: tent };
  }

  // ENSDF limit flags -> the direction in which the true rate (and B) lies relative to the one computed:
  // +1: true value larger (the computed B is a lower limit), -1: smaller (an upper limit), 0: approximate
  var LOWER = { LT: 1, LE: 1 }, UPPER = { GT: 1, GE: 1 };
  function tDir(f) { return LOWER[f] ? +1 : UPPER[f] ? -1 : f === 'AP' ? 0 : null; }     // T < x: rate > computed
  function iDir(f) { return LOWER[f] ? -1 : UPPER[f] ? +1 : f === 'AP' ? 0 : null; }     // own I < x: rate < computed
  function combine(ds) {
    var up = false, dn = false, ap = false;
    for (var i = 0; i < ds.length; i++) { if (ds[i] === 1) up = true; else if (ds[i] === -1) dn = true; else if (ds[i] === 0) ap = true; }
    return up && dn ? 'none' : up ? '>' : dn ? '<' : ap ? '~' : '=';
  }

  // partial gamma rates of the gammas out of one level and B in W.u. for each multipole component.
  // lev: { T (s), Tlim, IT (%, or null), g: [{ E keV, RI, RIlim, TI, TIlim, CC, M, MR, MRlim, BW }] }, A mass number.
  // Per gamma { lam, t, rel, parts: [{ sig, L, frac, lam, Bwu, tW }], ... }: rel is the relation of the true B to the
  // printed one ('=', '>' lower limit, '<' upper limit, '~' approximate, 'none' no bound), from the limit flags on the
  // level half-life, on this gamma's intensity and on the other branches' intensities. A pure E0 branch carries no
  // photon: its total intensity enters the branching, it gets no B. A multipolarity left blank in ENSDF but with one
  // printed B(XL)W is taken as that XL (fromBW).
  function levelStrengths(lev, A) {
    if (!(lev.T > 0) || !isFinite(lev.T)) return { why: 'no half-life' };
    var tot = 0, Ig = [], It = [], dI = [], pms = [];
    for (var i = 0; i < lev.g.length; i++) {
      var g = lev.g[i], cc = g.CC == null ? 0 : g.CC, pm = parseMult(g.M), fromBW = false;
      if (!pm && g.BW && Object.keys(g.BW).length === 1) {
        var k0 = Object.keys(g.BW)[0];
        pm = { list: [{ sig: k0[0], L: +k0[1] }], e0: false, tentative: true }; fromBW = true;
      }
      var e0only = !!(pm && pm.e0 && !pm.list.length), ig, it, lim;
      if (g.RI != null) { ig = g.RI; it = g.RI * (1 + cc); lim = g.RIlim; }
      else if (g.TI != null) { it = g.TI; ig = g.TI / (1 + cc); lim = g.TIlim; }
      else if (lev.g.length === 1) { ig = 1; it = 1 + cc; lim = ''; }
      else return { why: 'branching not complete' };
      if (e0only) ig = 0;
      tot += it; Ig.push(ig); It.push(it); dI.push(lim || ''); pms.push({ pm: pm, fromBW: fromBW, e0only: e0only });
    }
    var lamLevel = LN2 / lev.T * (lev.IT != null ? lev.IT / 100 : 1);
    var out = [];
    for (var j = 0; j < lev.g.length; j++) {
      var gg = lev.g[j], pmj = pms[j].pm, parts = [];
      if (pms[j].e0only) { out.push({ lam: 0, t: Infinity, rel: '=', parts: [], e0only: true, e0: true }); continue; }
      var lam = lamLevel * Ig[j] / tot;
      // limits on the total photon rate of this gamma: the level half-life, this intensity, and every other branch (an
      // upper-limited other branch means the true total is smaller, so this rate is larger). When the only limits are on
      // other branches, the bound is within their share of the decays: 'within' (a fraction), printed with the bound.
      // A limit on delta does not touch the total rate, only how it splits (per component, below).
      var ds = [tDir(lev.Tlim), iDir(dI[j])], share = 0;
      for (var o = 0; o < lev.g.length; o++) if (o !== j && dI[o]) { var d = iDir(dI[o]); ds.push(d === null ? null : d === 0 ? 0 : -d); share += It[o] / tot; }
      var rel = combine(ds), within = (rel !== '=' && combine(ds.slice(0, 2)) === '=') ? share : null;
      if (pmj && pmj.list.length) {
        var d2 = gg.MR != null ? gg.MR * gg.MR : null;
        if (pmj.list.length === 1) parts.push({ sig: pmj.list[0].sig, L: pmj.list[0].L, frac: 1 });
        else if (d2 != null) {
          // delta is the ratio of the higher to the lower multipole amplitude whatever the printed order ("E2+M1")
          var lo = pmj.list[0].L <= pmj.list[1].L ? pmj.list[0] : pmj.list[1], hi = lo === pmj.list[0] ? pmj.list[1] : pmj.list[0];
          parts.push({ sig: lo.sig, L: lo.L, frac: 1 / (1 + d2) });
          parts.push({ sig: hi.sig, L: hi.L, frac: d2 / (1 + d2) });
        }
        parts = parts.filter(function (q) { return q.frac > 0; });          // delta = 0 printed: the lower multipole only
        // |delta| < x (LT, LE): the lower multipole has more than 1/(1 + x^2) of the photon rate, the higher less than
        // x^2/(1 + x^2); |delta| > x the reverse; AP approximate. Combined with the limits on the total rate.
        var dl = parts.length === 2 && gg.MRlim ? (LOWER[gg.MRlim] ? +1 : UPPER[gg.MRlim] ? -1 : 0) : null;
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k], E = gg.E / 1000;
          p.rel = dl === null ? rel : combine(ds.concat([dl === 0 ? 0 : k === 0 ? dl : -dl]));
          // a limit on the total of a mixed transition leaves the minor component's limit to the range of delta, which
          // is not propagated
          p.deltaDependent = dl === null && rel !== '=' && within === null && parts.length === 2 && p.frac < 0.5;
          p.lam = lam * p.frac;
          p.Bwu = p.lam / weisskopfRate(p.sig, p.L, E, A);
          p.tW = weisskopfT(p.sig, p.L, E, A);
        }
      }
      out.push({ lam: lam, t: LN2 / lam, rel: rel, within: within, parts: parts, fromBW: pms[j].fromBW,
        mixedNoDelta: !!(pmj && pmj.list.length === 2 && gg.MR == null), alt: !!(pmj && pmj.alt),
        e0: !!(pmj && pmj.e0), deltaFromComment: gg.MRsrc === 'comment' });
    }
    return { rows: out };
  }
  // the relation of the partial half-life and of the hindrance is the reverse of that of B
  function flipRel(r) { return r === '>' ? '<' : r === '<' ? '>' : r; }

  // ---------- radiation pattern
  // associated Legendre P_l^m(x), m >= 0, Condon-Shortley phase (Numerical Recipes plgndr)
  function plm(l, m, x) {
    var pmm = 1;
    if (m > 0) { var s = Math.sqrt((1 - x) * (1 + x)), f = 1; for (var i = 1; i <= m; i++) { pmm *= -f * s; f += 2; } }
    if (l === m) return pmm;
    var pmmp1 = x * (2 * m + 1) * pmm;
    if (l === m + 1) return pmmp1;
    var pll = 0;
    for (var ll = m + 2; ll <= l; ll++) { pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m); pmm = pmmp1; pmmp1 = pll; }
    return pll;
  }
  // theta part of Y_lm, normalised: y(theta) with Y_lm = y(theta) e^{i m phi}
  function ylmTheta(l, m, th) {
    var am = Math.abs(m);
    var n = Math.sqrt((2 * l + 1) / (4 * Math.PI) * fact(l - am) / fact(l + am));
    return n * plm(l, am, Math.cos(th));
  }
  // y, dy/dtheta and y / sin(theta), from recurrences with no division by sin(theta) (exact at the poles):
  //   dP_l^m/dtheta = [P_l^(m+1) - (l + m)(l - m + 1) P_l^(m-1)] / 2,  P_l^(-1) = -P_l^1 / (l(l + 1))
  //   P_l^m / sin(theta) = -[P_(l-1)^(m+1) + (l + m)(l + m - 1) P_(l-1)^(m-1)] / (2m),  m >= 1
  // (Condon-Shortley phase; both checked against finite differences and against tests/check_gamma.py)
  function pl(l, m, x) { return m < 0 || m > l || l < 0 ? 0 : plm(l, m, x); }
  function yParts(L, M, th) {
    var am = Math.abs(M), x = Math.cos(th);
    var n = Math.sqrt((2 * L + 1) / (4 * Math.PI) * fact(L - am) / fact(L + am));
    var pm1 = am > 0 ? pl(L, am - 1, x) : -pl(L, 1, x) / (L * (L + 1));
    var dy = n * 0.5 * (pl(L, am + 1, x) - (L + am) * (L - am + 1) * pm1);
    var ys = am === 0 ? 0 : -n * (pl(L - 1, am + 1, x) + (L + am) * (L + am - 1) * pl(L - 1, am - 1, x)) / (2 * am);
    return { y: n * pl(L, am, x), dy: dy, ys: ys };
  }
  // |X_LM(theta)|^2, normalised to 1 over the sphere (independent of phi and of E/M)
  function pattern(L, M, th) {
    var p = yParts(L, M, th);
    return (M * M * p.ys * p.ys + p.dy * p.dy) / (L * (L + 1));
  }
  // real far field at direction (theta, phi) and phase wt: [E_theta, E_phi], unnormalised
  // ML: E ~ X_LM = e^{iM phi} [-M y/sin th, -i dy] / sqrt(L(L+1));  EL: E ~ n x X_LM = e^{iM phi} [i dy, -M y/sin th] / sqrt(L(L+1))
  // (components along theta-hat and phi-hat; n x theta-hat = phi-hat, n x phi-hat = -theta-hat)
  function field(sig, L, M, th, ph, wt) {
    var p = yParts(L, M, th), a = M * ph - wt, c = Math.cos(a), s = Math.sin(a), n = 1 / Math.sqrt(L * (L + 1));
    // Re[(x + i y) e^{ia}] = x cos a - y sin a
    if (sig === 'M') return [-n * M * p.ys * c, n * p.dy * s];   // X_LM
    return [-n * p.dy * s, -n * M * p.ys * c];                    // n x X_LM
  }
  // maximum of the pattern on a grid, for sampling and scaling
  function patternMax(L, M) {
    var mx = 0;
    for (var i = 0; i <= 720; i++) mx = Math.max(mx, pattern(L, M, Math.PI * i / 720));
    return mx;
  }

  // ---------- angular momentum algebra (Racah's formulas; arguments may be half-integers)
  function isInt(x) { return Math.abs(x - Math.round(x)) < 1e-9; }
  function tri(a, b, c) { return a + b - c >= -1e-9 && a - b + c >= -1e-9 && -a + b + c >= -1e-9 && isInt(a + b + c); }
  function delta(a, b, c) {
    return fact(Math.round(a + b - c)) * fact(Math.round(a - b + c)) * fact(Math.round(-a + b + c)) / fact(Math.round(a + b + c + 1));
  }
  function threeJ(j1, j2, j3, m1, m2, m3) {
    if (Math.abs(m1 + m2 + m3) > 1e-9 || !tri(j1, j2, j3)) return 0;
    if (Math.abs(m1) > j1 || Math.abs(m2) > j2 || Math.abs(m3) > j3) return 0;
    if (!isInt(j1 + m1) || !isInt(j2 + m2) || !isInt(j3 + m3)) return 0;
    var R = Math.round;
    var pre = Math.sqrt(delta(j1, j2, j3) * fact(R(j1 + m1)) * fact(R(j1 - m1)) * fact(R(j2 + m2)) * fact(R(j2 - m2)) * fact(R(j3 + m3)) * fact(R(j3 - m3)));
    var kmin = Math.max(0, R(j2 - j3 - m1), R(j1 - j3 + m2)), kmax = Math.min(R(j1 + j2 - j3), R(j1 - m1), R(j2 + m2)), s = 0;
    for (var k = kmin; k <= kmax; k++) {
      s += (k % 2 ? -1 : 1) / (fact(k) * fact(R(j3 - j2 + k + m1)) * fact(R(j3 - j1 + k - m2)) * fact(R(j1 + j2 - j3 - k)) * fact(R(j1 - k - m1)) * fact(R(j2 - k + m2)));
    }
    var ph = R(j1 - j2 - m3);
    return (ph % 2 ? -1 : 1) * pre * s;
  }
  function sixJ(j1, j2, j3, j4, j5, j6) {
    if (!tri(j1, j2, j3) || !tri(j1, j5, j6) || !tri(j4, j2, j6) || !tri(j4, j5, j3)) return 0;
    var R = Math.round;
    var pre = Math.sqrt(delta(j1, j2, j3) * delta(j1, j5, j6) * delta(j4, j2, j6) * delta(j4, j5, j3));
    var a = [R(j1 + j2 + j3), R(j1 + j5 + j6), R(j4 + j2 + j6), R(j4 + j5 + j3)];
    var b = [R(j1 + j2 + j4 + j5), R(j2 + j3 + j5 + j6), R(j3 + j1 + j6 + j4)];
    var tmin = Math.max.apply(null, a), tmax = Math.min.apply(null, b), s = 0;
    for (var t = tmin; t <= tmax; t++) {
      s += (t % 2 ? -1 : 1) * fact(t + 1) / (fact(t - a[0]) * fact(t - a[1]) * fact(t - a[2]) * fact(t - a[3]) * fact(b[0] - t) * fact(b[1] - t) * fact(b[2] - t));
    }
    return pre * s;
  }
  // F_k(L L' J_f J_i), Frauenfelder-Steffen convention
  function Fk(k, L, Lp, Jf, Ji) {
    var ph = Math.round(Jf + Ji - 1);
    return (ph % 2 ? -1 : 1) * Math.sqrt((2 * k + 1) * (2 * L + 1) * (2 * Lp + 1) * (2 * Ji + 1)) * threeJ(L, Lp, k, 1, -1, 0) * sixJ(L, Lp, k, Ji, Ji, Jf);
  }
  // pure-multipole cascade J_i -(L1)-> J -(L2)-> J_f: A_k for even k up to the allowed maximum
  function correlation(Ji, J, Jf, L1, L2) {
    if (!tri(Ji, L1, J) || !tri(J, L2, Jf)) return null;
    // k <= 2 L1, 2 L2, 2J; the 6j symbols vanish by themselves beyond 2J
    var kmax = 2 * Math.min(L1, L2, 3);
    var A = [1];
    for (var k = 2; k <= kmax; k += 2) A.push(Fk(k, L1, L1, Ji, J) * Fk(k, L2, L2, Jf, J));
    return A;                                            // A[0] = A_0 = 1, A[1] = A_2, A[2] = A_4, ...
  }
  function legendre(n, x) { var p0 = 1, p1 = x; if (n === 0) return 1; for (var k = 2; k <= n; k++) { var p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } return p1; }
  function corrW(A, th) { var c = Math.cos(th), s = 0; for (var i = 0; i < A.length; i++) s += A[i] * legendre(2 * i, c); return s; }
  // the same W as 1 + a2 cos^2 + a4 cos^4 + a6 cos^6 (normalised to 1 at 90 degrees)
  // Legendre P_2k as power series in x = cos theta
  var PCOEF = [[1], [-0.5, 0, 1.5], [3 / 8, 0, -30 / 8, 0, 35 / 8], [-5 / 16, 0, 105 / 16, 0, -315 / 16, 0, 231 / 16]];
  function powerForm(A) {
    var c = [0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < A.length; i++) for (var j = 0; j < PCOEF[i].length; j++) c[j] += A[i] * PCOEF[i][j];
    return { a2: c[2] / c[0], a4: c[4] / c[0], a6: c[6] / c[0] };
  }
  // the lowest multipoles a gamma between spins Ji and Jf can carry: L >= max(1, |Ji - Jf|)
  function lowestL(Ji, Jf) { return Math.max(1, Math.round(Math.abs(Ji - Jf))); }
  // "4+", "(3/2)-", "1/2-,3/2-" -> { J, parity, tentative } from the first value
  function parseJ(s) {
    if (!s) return null;
    var m = s.match(/(\d+)(?:\/(2))?\s*\)?\s*([+-])?/);
    if (!m) return null;
    var J = m[2] ? +m[1] / 2 : +m[1];
    return { J: J, p: m[3] || '', tent: /[(,]/.test(s) || s.indexOf('[') >= 0 };
  }

  var GAMMA = {
    HBARC: HBARC, ALPHA: ALPHA, HBAR: HBAR, MP: MP, R0: R0,
    dfact: dfact, weisskopfB: weisskopfB, rate: rate, weisskopfRate: weisskopfRate, weisskopfT: weisskopfT, be2UpToWu: be2UpToWu,
    parseMult: parseMult, levelStrengths: levelStrengths, flipRel: flipRel,
    plm: plm, ylmTheta: ylmTheta, pattern: pattern, field: field, patternMax: patternMax,
    threeJ: threeJ, sixJ: sixJ, Fk: Fk, correlation: correlation, corrW: corrW, powerForm: powerForm, legendre: legendre,
    lowestL: lowestL, parseJ: parseJ
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GAMMA; else root.GAMMA = GAMMA;
})(this);
