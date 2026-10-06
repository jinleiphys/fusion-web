/* fusionbarrier.js: the simple models of fusionbarrier.html (heavy-ion fusion near the Coulomb barrier).
 *
 * Nothing here is a coupled-channels calculation. Three closed or nearly closed pieces:
 *   barrier   V(r) = Z_P Z_T e^2 / r - V0 / (1 + exp((r - R0)/a)),  R0 = r0 (A_P^(1/3) + A_T^(1/3)),
 *             the bare potential of CCFULL (Hagino, Rowley, Kruppa, CPC 123, 143 (1999), Eq. (vn) and the point
 *             Coulomb of its function vc), with CCFULL's constants e^2 = hbar c / 137, hbar c = 197.329 MeV fm,
 *             reduced mass A_P A_T / (A_P + A_T) x 938 MeV, so that the barrier can be compared with the one CCFULL
 *             prints. V_B, R_B: the top of V(r) (Newton on V'(r) = 0 after an inward scan), hbar omega =
 *             hbar sqrt(|V''(R_B)| / mu).
 *   Wong      sigma(E) = (hbar omega R_B^2 / 2E) ln[1 + exp(2 pi (E - V_B) / hbar omega)] (C. Y. Wong, PRL 31, 766
 *             (1973); Hagino and Takigawa, Prog. Theor. Phys. 128, 1061 (2012), arXiv:1209.6435, Appendix B): parabolic barrier,
 *             R_B and hbar omega taken independent of l. Its barrier distribution in closed form:
 *             d2(E sigma)/dE2 = pi R_B^2 (2 pi / hbar omega) s (1 - s),  s = 1 / (1 + exp(-2 pi (E - V_B)/hbar omega)).
 *   coupling  eigenchannels, sigma = sum_k w_k sigma_Wong(E; barrier k) (Hagino and Takigawa 2012):
 *     rotor     (deformed target, 2+ energy set to zero: the sudden limit, their Sec. 4.1): orientation average over x = cos(theta) in [0, 1] with
 *               weight dx, each orientation with its own barrier from V(r, theta) =
 *                 Z_P Z_T e^2 / r + (3 Z_P Z_T e^2 / 5) (R_T^2 / r^3) (beta2 + (2/7) sqrt(5/pi) beta2^2) Y20
 *                 + (3 Z_P Z_T e^2 / 9) (R_T^4 / r^5) (beta4 + (9/(7 sqrt(pi))) beta2^2) Y40
 *                 - V0 / (1 + exp((r - R0 - R_T (beta2 Y20 + beta4 Y40)) / a)),   R_T = r_T A_T^(1/3),
 *               the operator CCFULL couples written at a fixed orientation (its paper, Sec. 3.1; the second-order
 *               lambda = 4 Coulomb coefficient is 9/(7 sqrt(pi)) as in ccfull.f, function fct4: the paper's 9/7 is a
 *               misprint; the coefficients are (lambda + 2)/2 times the integral of Y20^2 Y_lambda0); Gauss-Legendre,
 *               48 points.
 *     vibrator  (spherical target, one phonon of each mode, linear coupling, excitation energies kept: not the
 *               sudden limit; eigenbarriers from the coupling matrix with finite excitation energy as in their
 *               Sec. 4.3, Fig. 9, but at one radius): the matrix
 *                 M = [[0, F_1, F_2, ...], [F_1, e_1, 0, ...], [F_2, 0, e_2, ...], ...],
 *                 F_i = (beta_i / sqrt(4 pi)) [ -R_T dV_N/dr + (3 / (2 lambda_i + 1)) Z_P Z_T e^2 R_T^lambda_i / r^(lambda_i + 1) ]
 *               evaluated once, at the bare barrier radius R_B (constant-coupling approximation, our simplification),
 *               is diagonalised: barriers V_B + lambda_k, weights w_k = |U_0k|^2, R_B and hbar omega of the bare
 *               barrier. The coupling strengths are CCFULL's linear ones (its paper, Sec. 3.2).
 * Plain script: window.FB in a browser, module.exports in Node.
 */
(function (root) {
  'use strict';
  var HBARC = 197.329, E2 = 197.329 / 137, MN = 938, PI = Math.PI;
  var FB = { HBARC: HBARC, E2: E2, MN: MN };

  var Y20 = function (x) { return Math.sqrt(5 / (16 * PI)) * (3 * x * x - 1); };
  var Y40 = function (x) { return 3 / (16 * Math.sqrt(PI)) * (35 * x * x * x * x - 30 * x * x + 3); };
  FB.Y20 = Y20; FB.Y40 = Y40;

  // a system from the page parameters {AP, ZP, AT, ZT, V0, r0, a, rT}
  FB.make = function (p) {
    var c = function (A) { return Math.cbrt(A); };
    return { AP: p.AP, ZP: p.ZP, AT: p.AT, ZT: p.ZT, V0: p.V0, a: p.a, R0: p.r0 * (c(p.AP) + c(p.AT)), RT: p.rT * c(p.AT),
             mu: p.AP * p.AT / (p.AP + p.AT) * MN, zz: p.ZP * p.ZT * E2 };
  };
  // Woods-Saxon value and its first two r-derivatives, radius shifted by dR
  FB.ws = function (s, r, dR) {
    var e = Math.exp((r - s.R0 - (dR || 0)) / s.a), f = 1 / (1 + e);
    return [-s.V0 * f, s.V0 * e * f * f / s.a, s.V0 * e * (1 - e) * f * f * f / (s.a * s.a)];
  };
  // V, V', V'' at r for orientation x = cos(theta) (beta2 = beta4 = 0: the bare potential)
  FB.pot = function (s, r, x, b2, b4) {
    b2 = b2 || 0; b4 = b4 || 0;
    var y2 = Y20(x), y4 = Y40(x);
    var c2 = 0.6 * s.zz * s.RT * s.RT * (b2 + (2 / 7) * Math.sqrt(5 / PI) * b2 * b2) * y2;
    // 9/(7 sqrt(pi)) as in ccfull.f (function fct4: beta4t + 9 beta2t^2 / 7 / sqrt(pi)); the CCFULL paper prints 9/7
    var c4 = (1 / 3) * s.zz * Math.pow(s.RT, 4) * (b4 + 9 / (7 * Math.sqrt(PI)) * b2 * b2) * y4;
    var n = FB.ws(s, r, s.RT * (b2 * y2 + b4 * y4));
    var r2 = r * r;
    return [s.zz / r + c2 / (r2 * r) + c4 / (r2 * r2 * r) + n[0],
            -s.zz / r2 - 3 * c2 / (r2 * r2) - 5 * c4 / (r2 * r2 * r2) + n[1],
            2 * s.zz / (r2 * r) + 12 * c2 / (r2 * r2 * r) + 30 * c4 / (r2 * r2 * r2 * r) + n[2]];
  };
  // top of the barrier: scan inward from 50 fm for V' changing sign (as CCFULL's potshape does), then Newton on V'
  FB.barrier = function (s, x, b2, b4) {
    var f = function (r) { return FB.pot(s, r, x, b2, b4); };
    var r = 50, d0 = f(r)[1];
    while (r > 1) { var r1 = r - 0.25, d1 = f(r1)[1]; if (d0 * d1 <= 0) break; r = r1; d0 = d1; }
    var lo = r - 0.25, hi = r, m = 0.5 * (lo + hi);
    for (var i = 0; i < 100; i++) {                 // Newton, falling back to bisection when it leaves the bracket
      var v = f(m), nm = m - v[1] / v[2], newton = nm > lo && nm < hi;
      if (!newton) nm = 0.5 * (lo + hi);
      if (f(nm)[1] > 0) lo = nm; else hi = nm;
      var done = (newton && Math.abs(nm - m) < 1e-11) || hi - lo < 1e-11;
      m = nm;
      if (done) break;
    }
    var t = f(m);
    return { B: t[0], R: m, hw: HBARC * Math.sqrt(Math.abs(t[2]) / s.mu) };
  };
  // log(1 + e^x) without overflow
  var softplus = function (x) { return x > 30 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x)); };
  // Wong cross section in mb (10 mb = 1 fm^2)
  FB.wong = function (E, b) { return 10 * b.hw * b.R * b.R / (2 * E) * softplus(2 * PI * (E - b.B) / b.hw); };
  // its d2(E sigma)/dE2 in mb/MeV, closed form
  FB.wongD = function (E, b) {
    var s = 1 / (1 + Math.exp(-2 * PI * (E - b.B) / b.hw));
    return 10 * PI * b.R * b.R * (2 * PI / b.hw) * s * (1 - s);
  };
  // channel sets: [{w, B, R, hw, ...}]
  FB.sigma = function (ch, E) { var t = 0; for (var i = 0; i < ch.length; i++) t += ch[i].w * FB.wong(E, ch[i]); return t; };
  FB.D = function (ch, E) { var t = 0; for (var i = 0; i < ch.length; i++) t += ch[i].w * FB.wongD(E, ch[i]); return t; };
  // three-point difference of E sigma(E) with step dE, as the measured D(E) is made
  FB.pointD = function (sig, E, dE) { return ((E + dE) * sig(E + dE) - 2 * E * sig(E) + (E - dE) * sig(E - dE)) / (dE * dE); };

  // Gauss-Legendre nodes and weights on [0, 1]
  FB.gauss = function (n) {
    var xs = [], ws = [];
    for (var i = 1; i <= n; i++) {
      var z = Math.cos(PI * (i - 0.25) / (n + 0.5)), pp = 0;
      for (var it = 0; it < 100; it++) {
        var p1 = 1, p2 = 0;
        for (var j = 1; j <= n; j++) { var p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1);
        var dz = p1 / pp; z -= dz;
        if (Math.abs(dz) < 1e-15) break;
      }
      xs.push(0.5 * (1 - z)); ws.push(1 / ((1 - z * z) * pp * pp));
    }
    return { x: xs, w: ws };
  };
  // rigid rotor, sudden limit: one barrier per orientation
  FB.orient = function (s, b2, b4, n) {
    var g = FB.gauss(n || 48), out = [];
    for (var i = 0; i < g.x.length; i++) {
      var b = FB.barrier(s, g.x[i], b2, b4);
      out.push({ w: g.w[i], B: b.B, R: b.R, hw: b.hw, x: g.x[i] });
    }
    out.sort(function (p, q) { return p.x - q.x; });
    return out;
  };
  // symmetric eigenproblem (cyclic Jacobi): returns {val, vec} with vec[i][k] the i-th component of eigenvector k
  FB.eigh = function (A) {
    var n = A.length, a = A.map(function (r) { return r.slice(); }), v = [];
    for (var i = 0; i < n; i++) { v.push([]); for (var j = 0; j < n; j++) v[i].push(i === j ? 1 : 0); }
    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
      if (off < 1e-30) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        var th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), sn = Math.sin(th);
        for (var k = 0; k < n; k++) {
          var akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - sn * akq; a[k][q] = sn * akp + c * akq;
        }
        for (k = 0; k < n; k++) {
          var apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - sn * aqk; a[q][k] = sn * apk + c * aqk;
        }
        for (k = 0; k < n; k++) {
          var vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - sn * vkq; v[k][q] = sn * vkp + c * vkq;
        }
      }
    }
    return { val: a.map(function (r, i) { return r[i]; }), vec: v };
  };
  // coupling strength of one phonon mode at r (linear nuclear + Coulomb, CCFULL Sec. 3.2)
  FB.F = function (s, m, r) {
    var dVN = FB.ws(s, r)[1];
    return m.beta / Math.sqrt(4 * PI) * (-s.RT * dVN + 3 / (2 * m.lam + 1) * s.zz * Math.pow(s.RT, m.lam) / Math.pow(r, m.lam + 1));
  };
  // vibrational eigenchannels, constant coupling at the bare barrier radius
  FB.eigen = function (s, modes) {
    var b0 = FB.barrier(s, 0);
    var n = modes.length + 1, M = [];
    for (var i = 0; i < n; i++) { M.push([]); for (var j = 0; j < n; j++) M[i].push(0); }
    modes.forEach(function (m, i) { var F = FB.F(s, m, b0.R); M[0][i + 1] = M[i + 1][0] = F; M[i + 1][i + 1] = m.E; });
    var e = FB.eigh(M), out = [];
    for (var k = 0; k < n; k++) out.push({ w: e.vec[0][k] * e.vec[0][k], B: b0.B + e.val[k], R: b0.R, hw: b0.hw, lam: e.val[k] });
    out.sort(function (p, q) { return p.B - q.B; });
    return { ch: out, M: M, bare: b0 };
  };
  // fusion Q value from AME2020 mass excesses (keV): Q = Delta(P) + Delta(T) - Delta(CN), in MeV
  FB.Q = function (AME, zp, np, zt, nt) {
    var d = function (z, n) { for (var i = 0; i < AME.length; i++) if (AME[i][0] === z && AME[i][1] === n) return AME[i][2]; return NaN; };
    return (d(zp, np) + d(zt, nt) - d(zp + zt, np + nt)) / 1000;
  };
  // linear interpolation in log sigma of a tabulated excitation function (CCFULL output)
  FB.interpLog = function (Es, ss, E) {
    if (E <= Es[0]) return ss[0];
    if (E >= Es[Es.length - 1]) return ss[ss.length - 1];
    var lo = 0, hi = Es.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (Es[m] <= E) lo = m; else hi = m; }
    var t = (E - Es[lo]) / (Es[hi] - Es[lo]);
    return Math.exp((1 - t) * Math.log(ss[lo]) + t * Math.log(ss[hi]));
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = FB; else root.FB = FB;
})(this);
