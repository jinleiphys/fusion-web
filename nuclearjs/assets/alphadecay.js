/* alphadecay.js: alpha decay as tunnelling through the Coulomb barrier.
 *
 * Model (stated in full on alpha.html):
 *   Q_alpha (atomic masses) from AME2020, rct1 Q(a) with its covariance-based uncertainty (window.ALPHA_Q,
 *   Z >= 50); elsewhere from the NUBASE2020 binding energies, Q = B(Z-2, N-2) + B(4He) - B(Z, N), whose
 *   4-decimal B/A leave Q uncertain by up to (2A) x 5e-5 MeV. Plus the electron-screening shift
 *   dE = (65.3 Z^(7/5) - 80.0 Z^(2/5)) eV of the parent (Z) so the nucleus, not the atom, supplies the
 *   kinetic energy.
 *   Two-body problem in the c.m. frame with the reduced mass of alpha + daughter nucleus, so the
 *   recoil is exact and needs no separate correction.
 *   Sharp surface at R = r0 (A_d^(1/3) + 4^(1/3)). Inside, a flat well of depth V0 (alpha kinetic
 *   energy Q + V0, wave number K). Outside, point Coulomb 2 Z_d e^2 / r plus centrifugal.
 *   Decay rate of the quasi-stationary state (interior sin(Kr), outgoing Coulomb wave outside,
 *   value and slope matched at R):
 *     lambda = S * (2 hbar / (mu R)) * K^2 k / (K^2 + k^2 (G'/G)^2) * 1 / (F_l^2 + G_l^2)   (exact barrier)
 *   and its WKB limit, k G'/G -> -kappa_R, k / (F^2 + G^2) -> kappa_R exp(-2 int_R^b kappa dr):
 *     lambda = S * nu * P,  nu = hbar K / (2 mu R) = v_in / (2R),
 *     P = [4 K kappa_R / (K^2 + kappa_R^2)] * exp(-2 int_R^b kappa dr)   (Langer, l(l+1) -> (l+1/2)^2)
 *   S is a preformation factor, one constant fitted to the even-even 0+ -> 0+ ground-state decays.
 *
 * Coulomb functions under the barrier: Steed's method (copied from assets/omp.js so this file stands
 * alone) starts F, G beyond the outer turning point, and Numerov carries them inward to kR, where G
 * grows (the dominant solution, so the inward recursion is stable). F picks up an admixture of order
 * eps*G; F^2 + G^2 is unaffected at that order. tests/check_alpha_coulomb.py checks against mpmath.
 *
 * Plain script: window.ALPHA in a browser, module.exports in Node.
 */
(function (root) {
  'use strict';
  // CODATA 2018
  var HBARC = 197.3269804;            // MeV fm
  var E2 = HBARC / 137.035999084;     // e^2 = 1.43996... MeV fm
  var AMU = 931.49410242;             // MeV
  var MN = 939.56542052;              // neutron
  var MH = 1.00782503223 * AMU;       // 1H atom
  var ME = 0.51099895;                // electron
  var CFM = 2.99792458e23;            // c in fm/s
  var LN2 = Math.LN2;

  // ---------- Gauss-Legendre nodes on [0, 1]
  function gaussLegendre(n) {
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
  var GL = gaussLegendre(48);

  // ---------- masses and Q
  // NUC: NUBASE2020 rows (binding energies, for the reduced mass and the fallback Q); AQ: AME2020 Q_alpha rows
  // [Z, N, Q keV, unc keV, estimated] (window.ALPHA_Q), used for Q whenever present
  function massTable(NUC, AQ) {
    var T = new Map();
    for (var i = 0; i < NUC.length; i++) {
      var r = NUC[i];
      if (r[5] != null) T.set(r[0] + ',' + r[1], { B: r[5] * (r[0] + r[1]), est: !!r[6], row: r });
    }
    T.qa = new Map();
    if (AQ) for (var j = 0; j < AQ.length; j++) T.qa.set(AQ[j][0] + ',' + AQ[j][1], AQ[j]);
    return T;
  }
  function screening(Z) { return (65.3 * Math.pow(Z, 1.4) - 80.0 * Math.pow(Z, 0.4)) * 1e-6; }   // MeV
  // Q_alpha (atomic masses), MeV, with a 1-sd uncertainty dQsd:
  //   src 'AME2020': rct1 Q(a) and its uncertainty (est: AME marks it '#', from systematics);
  //   src 'B/A': from the NUBASE2020 binding energies; each B = A (B/A) carries a rounding error of at most
  //   A * 5e-5 MeV, uniform, so dQsd = sqrt(sum A_i^2) 5e-5 / sqrt(3) and dQmax = sum A_i * 5e-5 (rounding only).
  // QB, dQmaxB: the B/A route, always returned when the binding energies exist, for comparison.
  function qAlpha(T, Z, N) {
    var p = T.get(Z + ',' + N), d = T.get((Z - 2) + ',' + (N - 2)), a = T.get('2,2');
    if (!p || !d || !a) return null;
    var A = Z + N, QB = d.B + a.B - p.B, dQmaxB = (A + (A - 4) + 4) * 5e-5;
    var out = { QB: QB, dQmaxB: dQmaxB, Bp: p.B, Bd: d.B, Ba: a.B };
    var qa = T.qa && T.qa.get(Z + ',' + N);
    if (qa) { out.Q = qa[2] / 1000; out.dQsd = qa[3] / 1000; out.est = !!qa[4]; out.src = 'AME2020'; }
    else {
      out.Q = QB; out.dQmax = dQmaxB; out.dQsd = Math.sqrt(A * A + (A - 4) * (A - 4) + 16) * 5e-5 / Math.sqrt(3);
      out.est = p.est || d.est; out.src = 'B/A';
    }
    return out;
  }
  // nuclear masses (MeV) for the reduced mass
  function nucMass(Z, N, B) { return Z * MH + N * MN - B - Z * ME; }

  // ---------- spin-parity and the lowest allowed l
  function parseJ(s) {
    if (!s) return null;
    var tent = /[()#]/.test(s);
    var t = s.replace(/[()#*]/g, '').trim().split(/[ ,]/)[0];
    var m = t.match(/^(\d+)(\/2)?([+-])?$/);
    if (!m) return null;
    return { j2: m[2] ? +m[1] : 2 * +m[1], par: m[3] === '+' ? 1 : m[3] === '-' ? -1 : 0, tent: tent };
  }
  /* The lowest l of a ground-state to ground-state alpha transition J_p -> J_d + l (the alpha has 0+):
     |J_p - J_d| <= l <= J_p + J_d and (-1)^l = pi_p pi_d.
       null                          either J unknown: l not determined
       { l, tent }                   allowed; tent when a J or parity is tentative or a parity unknown
       { forbidden: true, why, ... } no l satisfies both (e.g. 1- -> 0-, 0- -> 4+), or the two spins differ by a
                                     half integer: there is no g.s. -> g.s. alpha transition to compute */
  function lMin(Jp, Jd) {
    if (!Jp || !Jd) return null;
    var lo = Math.abs(Jp.j2 - Jd.j2) / 2, hi = (Jp.j2 + Jd.j2) / 2;
    if (lo !== Math.floor(lo)) return { forbidden: true, why: 'spins differ by a half integer', tent: Jp.tent || Jd.tent };
    var known = Jp.par !== 0 && Jd.par !== 0;
    for (var l = lo; l <= hi; l++) {
      if (!known || (l % 2 === 0 ? 1 : -1) === Jp.par * Jd.par) return { l: l, tent: Jp.tent || Jd.tent || !known };
    }
    return { forbidden: true, why: 'parity: no l from ' + lo + ' to ' + hi + ' has the parity change required', tent: Jp.tent || Jd.tent, lAM: lo };
  }

  // ---------- barrier geometry and the WKB integral
  // V(r) - Q = Q (b - r)(r - a) / r^2 for r >= R, with C = hbar^2 L2 / (2 mu), L2 = (l+1/2)^2 or l(l+1)
  function roots(Q, Zd, mu, L2) {
    var c1 = 2 * Zd * E2, C = HBARC * HBARC * L2 / (2 * mu), s = Math.sqrt(c1 * c1 + 4 * Q * C);
    return { b: (c1 + s) / (2 * Q), a: (c1 - s) / (2 * Q) };
  }
  // int_R^b kappa dr; r = b - s^2 turns the integrand into 2 k s^2 sqrt(r - a) / r, smooth on [0, sqrt(b-R)]
  function wkbIntegral(Q, Zd, mu, R, L2) {
    var k = Math.sqrt(2 * mu * Q) / HBARC, rt = roots(Q, Zd, mu, L2);
    if (rt.b <= R) return { I: 0, b: rt.b, kappaR: 0, k: k, above: true };
    var S = Math.sqrt(rt.b - R), I = 0;
    for (var i = 0; i < GL.x.length; i++) {
      var s = S * GL.x[i], r = rt.b - s * s;
      I += GL.w[i] * 2 * k * s * s * Math.sqrt(r - rt.a) / r;
    }
    I *= S;
    return { I: I, b: rt.b, kappaR: k * Math.sqrt((rt.b - R) * (R - rt.a)) / R, k: k, above: false };
  }

  // ---------- Coulomb functions: Steed (copy of assets/omp.js, A&S 14.2 recurrences, CF1 + CF2)
  function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function cdiv(a, b) { var d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }
  function steed(eta, rho, lmax) {
    var L, it, tiny = 1e-300;
    function S(L) { return L / rho + eta / L; }
    function R2(L) { return 1 + eta * eta / (L * L); }
    var f = S(lmax + 1), C = f, D = 0;
    if (f === 0) f = C = tiny;
    for (it = 1; it < 100000; it++) {
      var Lk = lmax + it, a = -R2(Lk), b = S(Lk) + S(Lk + 1);
      D = b + a * D; if (D === 0) D = tiny; D = 1 / D;
      C = b + a / C; if (C === 0) C = tiny;
      var del = C * D; f *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    if (it >= 100000) throw new Error('steed: CF1 did not converge');
    var F = new Float64Array(lmax + 1), Fp = new Float64Array(lmax + 1);
    F[lmax] = 1e-200; Fp[lmax] = f * F[lmax];
    for (L = lmax; L >= 1; L--) {
      var RL = Math.sqrt(R2(L)), SL = S(L);
      F[L - 1] = (SL * F[L] + Fp[L]) / RL;
      Fp[L - 1] = SL * F[L - 1] - RL * F[L];
      if (Math.abs(F[L - 1]) > 1e200) { for (var s = L - 1; s <= lmax; s++) { F[s] *= 1e-200; Fp[s] *= 1e-200; } }
    }
    var pq = cf2(eta, rho), p = pq[0], q = pq[1];
    var gam = (Fp[0] / F[0] - p) / q;
    var scale = ((F[0] < 0 ? -1 : 1) / Math.sqrt(q * (1 + gam * gam))) / F[0];
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
  function cf2(eta, rho) {
    var tiny = 1e-300, a = [1, eta], c = [0, eta];
    var num0 = cmul(a, c), fr = [2 * (rho - eta), 2], Cc = fr.slice(), Dd = [0, 0], k;
    for (k = 1; k < 200000; k++) {
      var nk = cmul([a[0] + k, a[1]], [c[0] + k, c[1]]), bk = [2 * (rho - eta), 2 * (k + 1)];
      Dd = [bk[0] + nk[0] * Dd[0] - nk[1] * Dd[1], bk[1] + nk[0] * Dd[1] + nk[1] * Dd[0]];
      if (Dd[0] === 0 && Dd[1] === 0) Dd = [tiny, 0];
      Dd = cdiv([1, 0], Dd);
      var t0 = cdiv(nk, Cc); Cc = [bk[0] + t0[0], bk[1] + t0[1]];
      if (Cc[0] === 0 && Cc[1] === 0) Cc = [tiny, 0];
      var del = cmul(Cc, Dd); fr = cmul(fr, del);
      if (Math.abs(del[0] - 1) + Math.abs(del[1]) < 1e-16) break;
    }
    if (k >= 200000) throw new Error('steed: CF2 did not converge');
    var t = cdiv(num0, fr);
    return [-t[1] / rho, 1 - eta / rho + t[0] / rho];
  }

  /* Coulomb F_l, G_l at rho0 under the barrier. Returns logs, since G reaches 1e40 and beyond:
     lnG, F/G, G'/G (derivatives in rho), and log10 P = -log10(F^2 + G^2).
     opt.grid = true also returns the inward-integrated rho, lnG, F/G samples (every opt.every steps). */
  function coulombBarrier(eta, rho0, l, opt) {
    opt = opt || {};
    var ll = l * (l + 1), rhoT = eta + Math.sqrt(eta * eta + ll);
    var rhoM = Math.max(rhoT + 15, 1.3 * rhoT);
    if (rho0 >= rhoM) {
      var c0 = steed(eta, rho0, l), G0 = c0.G[l], F0 = c0.F[l];
      return { lnG: Math.log(Math.abs(G0)), FoG: F0 / G0, dG: c0.Gp[l] / G0, log10P: -Math.log10(F0 * F0 + G0 * G0), direct: true };
    }
    var h0 = opt.h || 0.004, n = Math.ceil((rhoM - rho0) / h0), h = (rhoM - rho0) / n, h12 = h * h / 12;
    var fq = function (x) { return ll / (x * x) + 2 * eta / x - 1; };
    var a = steed(eta, rhoM, l), b = steed(eta, rhoM - h, l);
    // Steed fixes F, G only up to a common sign (the sign of the unnormalized CF1 recursion), so two
    // separate calls can disagree: align the second with a Taylor step from the first
    var gt = a.G[l] - h * a.Gp[l];
    if (Math.abs(b.G[l] - gt) > Math.abs(b.G[l] + gt)) { b.G[l] = -b.G[l]; b.F[l] = -b.F[l]; }
    // index i: rho = rho0 + i h, i from n down to -2
    var G1 = a.G[l], G0_ = b.G[l], F1 = a.F[l], F0_ = b.F[l], lnS = 0;
    var f1 = fq(rhoM), f0 = fq(rhoM - h);
    var keep = [], every = opt.every || 25;
    var tail = {};                              // values at i = 2, 1, 0, -1, -2
    for (var i = n - 2; i >= -2; i--) {
      var x = rho0 + i * h, fm = fq(x);
      var Gm = (2 * (1 + 5 * h12 * f0) * G0_ - (1 - h12 * f1) * G1) / (1 - h12 * fm);
      var Fm = (2 * (1 + 5 * h12 * f0) * F0_ - (1 - h12 * f1) * F1) / (1 - h12 * fm);
      G1 = G0_; G0_ = Gm; F1 = F0_; F0_ = Fm; f1 = f0; f0 = fm;
      if (Math.abs(G0_) > 1e100) { G0_ *= 1e-100; G1 *= 1e-100; F0_ *= 1e-100; F1 *= 1e-100; lnS += 100 * Math.LN10; for (var key in tail) tail[key] *= 1e-100; }
      if (i <= 2) tail[i] = G0_;
      if (i === 0) tail.F = F0_;
      if (opt.grid && i >= 0 && i % every === 0) keep.push([x, Math.log(Math.abs(G0_)) + lnS, F0_ / G0_]);
    }
    var Gr = tail[0], Fr = tail.F;
    var dG = (tail[-2] - 8 * tail[-1] + 8 * tail[1] - tail[2]) / (12 * h * Gr);
    var lnG = Math.log(Math.abs(Gr)) + lnS, FoG = Fr / Gr;
    var out = { lnG: lnG, FoG: FoG, dG: dG, log10P: -(2 * lnG + Math.log(1 + FoG * FoG)) / Math.LN10, rhoM: rhoM };
    if (opt.grid) out.grid = keep.reverse();
    return out;
  }

  // ---------- the half-life
  // default parameters: r0 and log10 S from the even-even fit (tests/check_alpha_fit.js reproduces them)
  var DEF = { r0: 1.20, V0: 35, log10S: -1.391, screen: true };

  function decay(Z, N, Q, l, par) {
    par = par || DEF;
    var Zd = Z - 2, Nd = N - 2, Ad = Zd + Nd;
    var Bd = par.Bd, Bp = par.Bp;
    // reduced mass; masses from the binding energies when given, else A u
    var md = Bd != null ? nucMass(Zd, Nd, Bd) : Ad * AMU - Zd * ME;
    var ma = nucMass(2, 2, 28.2956);             // 4He nucleus, B = 4 x 7.0739 MeV from the same table
    var mu = ma * md / (ma + md);
    var Qn = Q + (par.screen ? screening(Z) : 0);
    var R = par.r0 * (Math.cbrt(Ad) + Math.cbrt(4));
    var K = Math.sqrt(2 * mu * (Qn + par.V0)) / HBARC;
    var w = wkbIntegral(Qn, Zd, mu, R, (l + 0.5) * (l + 0.5));
    var S = Math.pow(10, par.log10S), hbm = HBARC * CFM / mu;          // hbar / mu in fm^2/s
    var out = { Q: Qn, Qatomic: Q, R: R, b: w.b, mu: mu, K: K, k: w.k, l: l, Zd: Zd, above: w.above };
    out.Bbar = 2 * Zd * E2 / R + HBARC * HBARC * l * (l + 1) / (2 * mu * R * R);   // barrier top at R
    if (w.above) { out.log10T = NaN; return out; }
    var kap = w.kappaR;
    out.nu = hbm * K / (2 * R);                                          // assault frequency, 1/s
    out.edge = 4 * K * kap / (K * K + kap * kap);
    out.log10Twkb = -2 * w.I / Math.LN10;                                 // exp(-2 int kappa)
    out.log10P = Math.log10(out.edge) + out.log10Twkb;
    out.log10lam = Math.log10(S * out.nu) + out.log10P;
    out.log10T = Math.log10(LN2) - out.log10lam;
    if (par.exact !== false) {
      var eta = Zd * 2 * E2 * mu / (HBARC * HBARC * w.k);
      var cb = coulombBarrier(eta, w.k * R, l);
      var kg = w.k * cb.dG;
      out.eta = eta; out.rho = w.k * R;
      out.log10Pexact = cb.log10P;                                         // 1/(F^2+G^2)
      out.log10PexactWKB = Math.log10(kap / w.k) + out.log10Twkb;         // its WKB form
      out.log10lamExact = Math.log10(S * 2 * hbm * K * K * w.k / (R * (K * K + kg * kg))) + cb.log10P;
      out.log10Texact = Math.log10(LN2) - out.log10lamExact;
    }
    return out;
  }

  // l = 0 analytic Gamow integral (no centrifugal term at all), for the tests
  function gamowL0(Q, Zd, mu, R) {
    var k = Math.sqrt(2 * mu * Q) / HBARC, b = 2 * Zd * E2 / Q, x = R / b;
    var eta = Zd * 2 * E2 * mu / (HBARC * HBARC * k);
    return 2 * eta * (Math.acos(Math.sqrt(x)) - Math.sqrt(x * (1 - x)));
  }

  /* Riccati-Bessel u_l(x) = x j_l(x) and its derivative, by Miller's downward recurrence (stable for every
     x > 0 and l; the regular free solution inside a flat well). The recurrence fixes the shape only; its scale
     comes from j_0 = sin x / x or j_1 = sin x / x^2 - cos x / x, whichever is larger in magnitude at this x.
     Normalising to j_0 alone divided by a near-zero number at x near n pi (u_1(pi) came out 0.4947 instead of 1,
     u_1(2 pi) with the wrong sign); j_0 and j_1 have no common zero, so the larger is never small:
     max(|j_0|, |j_1|) >= ~0.6/x for x > 1, and j_0 ~ 1 for x < 1. tests/check_alpha_coulomb.py (4) compares
     u_l and u_l' with mpmath at x near n pi for l = 0..8. */
  function riccatiJ(l, x) {
    if (x < 1e-12) return [0, l === 0 ? 1 : 0];
    if (l === 0) return [Math.sin(x), Math.cos(x)];
    var L = l + 30 + Math.ceil(x), jp1 = 0, j = 1e-250, jl = 0, jlm1 = 0, j1 = 0;
    for (var n = L; n >= 1; n--) {
      var jm1 = (2 * n + 1) / x * j - jp1;
      jp1 = j; j = jm1;
      if (n - 1 === l) jl = jm1;
      if (n - 1 === l - 1) jlm1 = jm1;
      if (n - 1 === 1) j1 = jm1;
      if (Math.abs(j) > 1e200) { j *= 1e-200; jp1 *= 1e-200; jl *= 1e-200; jlm1 *= 1e-200; j1 *= 1e-200; }
    }
    // j now holds the unnormalised j_0, j1 the unnormalised j_1
    var s = Math.sin(x), c = Math.cos(x), e0 = s / x, e1 = s / (x * x) - c / x;
    var sc = Math.abs(e0) >= Math.abs(e1) ? e0 / j : e1 / j1;
    jl *= sc; jlm1 *= sc;
    return [x * jl, x * jlm1 - l * jl];                 // u_l, u_l' = x j_(l-1) - l j_l
  }

  /* Display wave: the quasi-stationary state with Q real, |u| on a log scale, phase of H+ = G + iF outside.
     Inside R the regular solution of a flat well, u = u_l(K'r) (Riccati-Bessel, so l > 0 has its centrifugal
     term), with K' chosen so that its value and slope join the exact exterior G at R:
       K' u_l'(K'R) / u_l(K'R) = k G'/G = -kappa,
     on the branch of K (the nearest root between the zeros of u_l around K R). The 35 MeV well of decay()
     generally has no level exactly at Q; the Gamow formula assumes one (sin^2 K R = K^2/(K^2 + kappa^2)
     for l = 0). The well that does have it has depth V0p = (hbar K')^2 / 2 mu - Q, returned and drawn.
     Returns samples r (fm), lg = log10(|u| / u_peak), ph (rad), inside: u / u_peak, and uIn(r) = u / u(R). */
  function wave(Z, N, Q, l, par, rmax, nOut) {
    par = par || DEF;
    var d = decay(Z, N, Q, l, Object.assign({}, par, { exact: false }));
    if (d.above) return null;
    var eta = d.Zd * 2 * E2 * d.mu / (HBARC * HBARC * d.k), rho0 = d.k * d.R;
    var cb = coulombBarrier(eta, rho0, l, { grid: true, every: 10 });
    var kappa = -d.k * cb.dG;                                // -d ln G / dr at R, > 0 under the barrier
    var K = d.K, R = d.R, x0 = K * R;
    var gl = function (x) { var u = riccatiJ(l, x); return x * u[1] / u[0] + kappa * R; };
    var sgn = function (x) { return riccatiJ(l, x)[0] >= 0; };
    // zeros of u_l bracketing x0: scan, then bisect
    var zero = function (a, b) { var sa = sgn(a); for (var it = 0; it < 80; it++) { var m = 0.5 * (a + b); if (sgn(m) === sa) a = m; else b = m; } return 0.5 * (a + b); };
    var st = 0.05, lo = 0, hi = null;
    for (var x = x0; x - st > 0; x -= st) if (sgn(x - st) !== sgn(x)) { lo = zero(x - st, x); break; }
    for (x = x0; ; x += st) if (sgn(x + st) !== sgn(x)) { hi = zero(x, x + st); break; }
    // g falls monotonically from +inf (or l + 1 + kappa R at 0) to -inf on (lo, hi)
    var a = lo + 1e-9 * (hi - lo), b = hi - 1e-9 * (hi - lo);
    for (var it = 0; it < 200; it++) { var m = 0.5 * (a + b); if (gl(m) > 0) a = m; else b = m; }
    var Kp = 0.5 * (a + b) / R, uR = riccatiJ(l, Kp * R)[0];
    var V0p = HBARC * HBARC * Kp * Kp / (2 * d.mu) - d.Q;
    var uIn = function (r) { return riccatiJ(l, Kp * r)[0] / uR; };       // u / u(R) = u / G_R
    var lnGR = cb.lnG, nin = 160, upk = 0, r = [], lg = [], ph = [], inside = [], i;
    for (i = 0; i <= nin; i++) upk = Math.max(upk, Math.abs(uIn(R * i / nin)));
    for (i = 0; i <= nin; i++) {
      var xr = R * i / nin, sv = uIn(xr);
      r.push(xr); inside.push(sv / upk); lg.push(Math.log10(Math.max(1e-300, Math.abs(sv) / upk))); ph.push(0);
    }
    var g = cb.grid;
    for (var j = 1; j < g.length; j++) {
      var rr = g[j][0] / d.k;
      if (rr > rmax) break;
      r.push(rr); inside.push(null);
      lg.push((g[j][1] - lnGR) / Math.LN10 + 0.5 * Math.log10(1 + g[j][2] * g[j][2]) - Math.log10(upk));
      var pg = Math.atan2(g[j][2], 1), pv = ph[ph.length - 1];   // arg(G + iF) modulo pi, unwrapped
      while (pg - pv > Math.PI / 2) pg -= Math.PI;
      while (pg - pv < -Math.PI / 2) pg += Math.PI;
      ph.push(pg);
    }
    var last = r[r.length - 1], rhoM = cb.rhoM;
    var nout = nOut || 260;
    if (last < rmax) {
      var start = Math.max(last, rhoM / d.k);
      var hOut = (rmax - start) / nout;
      // H+ phase is continuous; unwrap
      var prev = ph[ph.length - 1];
      for (var q = 1; q <= nout; q++) {
        var r2 = start + q * hOut, c = steed(eta, d.k * r2, l), Gq = c.G[l], Fq = c.F[l];
        var amp = 0.5 * Math.log10(Gq * Gq + Fq * Fq);
        var p = Math.atan2(Fq, Gq);
        // unwrap modulo pi: separate Steed calls may return (F, G) with opposite overall sign
        while (p - prev > Math.PI / 2) p -= Math.PI;
        while (p - prev < -Math.PI / 2) p += Math.PI;
        prev = p;
        r.push(r2); inside.push(null);
        lg.push(amp - lnGR / Math.LN10 - Math.log10(upk)); ph.push(p);
      }
    }
    return { r: r, lg: lg, ph: ph, inside: inside, uIn: uIn, R: R, b: d.b, Kp: Kp, K: K, kappa: kappa, V0p: V0p, d: d };
  }

  /* Records kept as tabulated but left out of the statistics and the fit of S, with the reason.
     264Hs: NUBASE2020 lists T1/2 = 0.7(3) s (A = 70(30)%); the measurement of Sato et al., J. Phys. Soc. Jpn.
     80, 094201 (2011) is reported in milliseconds (of order 0.6 ms). A unit slip in the table is likely but not
     established here; logTms is the partial alpha half-life if the 0.7 were ms, for the alternative statistics. */
  var FLAGS = {
    '108,156': { why: 'NUBASE2020 T1/2 = 0.7(3) s; Sato et al., J. Phys. Soc. Jpn. 80, 094201 (2011) report milliseconds',
      logTms: Math.log10(0.7e-3 / 0.70) }
  };

  /* The comparison set: NUBASE2020 ground states with Z >= 52, a measured half-life (not '#'), an alpha
     branch given as "=" or "~" (so the partial alpha half-life T / BR is known), Q_alpha not from
     systematics, Q > 0. Decays computed ground state to ground state, l the lowest allowed by the two
     ground-state J^pi (0 when either is unknown, flagged lTent).
     Two caveats on what is compared:
       - T_exp = T1/2 / BR uses the TOTAL alpha branch, which includes transitions to excited daughter
         states; the ground-state branch alone is smaller (238U: 79%), so the partial g.s. half-life is
         longer than T_exp, by about 0.1 decade for an even-even emitter like 238U and by more for odd ones.
       - a g.s. -> g.s. transition forbidden by J^pi (lMin().forbidden) has no ground-state calculation: such
         a parent is not in the returned list but in its .forbidden property (it decays to excited states).
     A record in FLAGS stays in the list with e.flag set and is skipped by stats(). */
  function dataset(NUC, AD, T, par) {
    par = par || DEF;
    var rowOf = new Map();
    for (var i = 0; i < NUC.length; i++) rowOf.set(NUC[i][0] + ',' + NUC[i][1], NUC[i]);
    var out = [];
    out.forbidden = [];
    for (var j = 0; j < AD.length; j++) {
      var a = AD[j], Z = a[0], N = a[1];
      if (Z < 52 || (a[3] !== '=' && a[3] !== '~') || !(a[2] > 0) || a[7]) continue;
      var r = rowOf.get(Z + ',' + N), rd = rowOf.get((Z - 2) + ',' + (N - 2));
      if (!r || !rd || r[3] == null || r[3] === 99) continue;
      var q = qAlpha(T, Z, N);
      if (!q || q.est || q.Q <= 0) continue;
      var cls = Z % 2 === 0 && N % 2 === 0 ? 'ee' : (Z + N) % 2 ? 'oA' : 'oo';
      var lm = cls === 'ee' ? { l: 0, tent: false } : lMin(parseJ(r[7]), parseJ(rd[7]));
      var logTexp = r[3] - Math.log10(a[2] / 100);
      if (lm && lm.forbidden) {
        out.forbidden.push({ Z: Z, N: N, A: Z + N, sym: r[2], cls: cls, Jp: r[7], Jd: rd[7], why: lm.why, tent: lm.tent, Q: q.Q, br: a[2], logTexp: logTexp });
        continue;
      }
      var e = {
        Z: Z, N: N, A: Z + N, sym: r[2], cls: cls, Q: q.Q, dQsd: q.dQsd, qsrc: q.src, QB: q.QB, Bd: q.Bd,
        br: a[2], rel: a[3], main: r[4] === 'A', Jp: r[7], Jd: rd[7],
        l: lm ? lm.l : 0, lTent: !lm || lm.tent, lKnown: !!lm,
        qAME: a[4] != null ? a[4] / 1000 : null, dqAME: a[5] != null ? a[5] / 1000 : null,
        logTexp: logTexp, flag: FLAGS[Z + ',' + N] || null
      };
      compute(e, par);
      out.push(e);
    }
    return out;
  }
  function compute(e, par) {
    var d = decay(e.Z, e.N, e.Q, e.l, Object.assign({}, par, { Bd: e.Bd }));
    e.logT = d.log10T; e.logTx = d.log10Texact; e.d = d;
    // sensitivity to Q, for the Q error bar: centred difference over +-10 keV
    var p1 = decay(e.Z, e.N, e.Q + 0.01, e.l, Object.assign({}, par, { Bd: e.Bd, exact: false })).log10T;
    var m1 = decay(e.Z, e.N, e.Q - 0.01, e.l, Object.assign({}, par, { Bd: e.Bd, exact: false })).log10T;
    e.dlogTdQ = (p1 - m1) / 0.02;
    return e;
  }
  // rms etc. of log10(T_calc / T_exp); records with a FLAGS entry are skipped unless all is true
  function stats(list, key, all) {
    key = key || 'logT';
    var n = 0, s = 0, s2 = 0, mx = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].flag && !all) continue;
      var v = list[i][key] - list[i].logTexp;
      if (!isFinite(v)) continue;
      n++; s += v; s2 += v * v; if (Math.abs(v) > Math.abs(mx)) mx = v;
    }
    var mean = s / n;
    return { n: n, mean: mean, rms: Math.sqrt(s2 / n), sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)), worst: mx };
  }

  var ALPHA = {
    HBARC: HBARC, E2: E2, AMU: AMU, CFM: CFM, DEF: DEF, FLAGS: FLAGS, dataset: dataset, compute: compute, stats: stats,
    massTable: massTable, qAlpha: qAlpha, screening: screening, nucMass: nucMass,
    parseJ: parseJ, lMin: lMin, roots: roots, wkbIntegral: wkbIntegral, gamowL0: gamowL0,
    steed: steed, coulombBarrier: coulombBarrier, decay: decay, wave: wave, riccatiJ: riccatiJ
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ALPHA; else root.ALPHA = ALPHA;
})(this);
