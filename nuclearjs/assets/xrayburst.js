/* ------------------------------------------------------------------ *
 * Type I X-ray bursts and the rp process: the little live arithmetic of
 * xrayburst.html. Nothing here integrates a reaction network; the path,
 * the ashes and the model light curves on the page are published ones
 * (assets/xrayburst-data.js).
 *
 * 1. Proton separation energies from AME2020 atomic mass excesses,
 *      S_p(Z,N)  = D(Z-1,N) + D(1H) - D(Z,N),
 *      S_2p(Z,N) = D(Z-2,N) + 2 D(1H) - D(Z,N),
 *    flagged when either mass is an AME estimate (#). The proton drip line of
 *    element Z: the lightest isotope in AME2020 with S_p > 0 and S_2p > 0.
 *
 * 2. (p,gamma)-(gamma,p) equilibrium along an isotone (fixed N), the proton
 *    mirror of the neutron Saha balance of nucleosynthesis.html and the same
 *    code (NUCLEO.lnSaha, Arnould, Goriely and Takahashi, Phys. Rep. 450 (2007)
 *    97, Eq. (24), with the neutron replaced by the proton: both have spin 1/2):
 *      Y(Z+1,N)/Y(Z,N) = n_p (2 pi hbar^2/(m_u kT))^(3/2) G(Z+1)/(2 G(Z)) exp(S_p(Z+1,N)/kT),
 *    with G = 2J + 1 of the ground state (NUBASE2020 J^pi, # and tentative values
 *    flagged; G = 1 where NUBASE gives none) and no excited-state partition
 *    functions; the proton's own 2 is the 2 in the denominator. The reduced mass
 *    is taken as m_u (as in that equation), n_p = rho N_A X_H.
 *    tests/check_xrayburst.py checks it against an independent statistical-
 *    mechanics evaluation with the exact reduced mass and reports the size of
 *    the m_u approximation.
 *
 * 3. Hot CNO cycle limited by the two beta+ decays (every capture faster):
 *      eps = (Z_CNO / A_bar) N_A (Q - <E_nu>(14O) - <E_nu>(15O)) / (tau(14O) + tau(15O)),
 *    tau = T1/2 / ln 2 (NUBASE2020), A_bar = (14 tau14 + 15 tau15)/(tau14 + tau15)
 *    (the catalysts sit in 14O and 15O in the ratio of their mean lives),
 *    Q = 4 D(1H) - D(4He) from AME2020 (positron annihilation included). Mean
 *    neutrino energies of allowed beta+ spectra with F0 L0 (assets/betadecay.js):
 *    15O to the 15N ground state, endpoint Q_EC - 2 m_e; 14O through the
 *    superallowed branch, endpoint from the Hardy-Towner Q_EC(sa) (PRC 102,
 *    045501 (2020)), with its share T1/2 / t_partial; the remaining share is given
 *    the same mean energy (the page says so).
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';
  var NA = 6.02214076e23;            // 1/mol (CODATA 2018, exact)
  var MEV = 1.602176634e-6;          // erg (exact)
  var LN2 = Math.LN2;
  var NUCLEO = root.NUCLEO || (typeof require !== 'undefined' ? require('./nucleosynthesis.js') : null);
  var BETA = root.BETA || (typeof require !== 'undefined' ? require('./betadecay.js') : null);

  var T = null;
  function init(o) {
    var ame = new Map();
    for (var i = 0; i < o.AME.length; i++) { var r = o.AME[i]; ame.set(r[0] * 1000 + r[1], { M: r[2] / 1000, u: r[3] / 1000, est: !!r[4] }); }
    T = { ame: ame, MH: ame.get(1000).M, MHe: ame.get(2002).M, spins: o.SPINS || {} };
    return T;
  }
  function mass(Z, N) { return T.ame.get(Z * 1000 + N) || null; }
  // S_p of nucleus (Z, N) in MeV: { S, est } or null
  function Sp(Z, N) {
    var a = mass(Z, N), b = mass(Z - 1, N);
    if (!a || !b) return null;
    return { S: b.M + T.MH - a.M, est: a.est || b.est };
  }
  function S2p(Z, N) {
    var a = mass(Z, N), b = mass(Z - 2, N);
    if (!a || !b) return null;
    return { S: b.M + 2 * T.MH - a.M, est: a.est || b.est };
  }
  // proton drip line of element Z: the smallest N in AME2020 with S_p > 0 and S_2p > 0
  function dripN(Z) {
    var best = null;
    for (var N = 0; N <= 3 * Z + 10; N++) {
      var s1 = Sp(Z, N), s2 = S2p(Z, N);
      if (s1 && s2 && s1.S > 0 && s2.S > 0) { best = { N: N, est: s1.est || s2.est }; break; }
    }
    return best;
  }
  // ground-state statistical weight from the NUBASE2020 J^pi string ('3/2-#', '(5/2-)', '0+'): { g, J, tent, txt } or null
  function spin(Z, N) {
    var t = T.spins[Z + ',' + N];
    if (t == null) return null;
    var m = /(\d+)(?:\/(\d+))?\s*[+-]?/.exec(t);
    if (!m) return { g: 1, J: null, tent: true, txt: t || 'none' };
    var J = m[2] ? (+m[1]) / (+m[2]) : +m[1];
    return { g: 2 * J + 1, J: J, tent: /[#(]/.test(t), txt: t };
  }
  function gw(Z, N) { var s = spin(Z, N); return s ? s.g : 1; }
  // (mu/m_u)^(3/2) with mu the reduced mass of (Z, N) + p from atomic masses: the factor by which the m_u form undershoots
  function muFactor(Z, N) {
    var u = 931.49410242, a = mass(Z, N), b = mass(Z + 1, N);
    if (!a || !b) return null;
    var mA = (Z + N) * u + a.M, mB = (Z + N + 1) * u + b.M, mH = u + T.MH;
    return Math.pow(mA * mH / mB / u, 1.5);
  }
  function np(log10rho, X) { return Math.pow(10, log10rho) * NA * X; }   // protons per cm^3
  // the isotone chain above a waiting point (Zw, N): shares of Zw, Zw+1, ... as far as AME2020 gives S_p (at most nmax)
  function chain(Zw, N, T9, log10rho, X, nmax) {
    var n = np(log10rho, X), Zs = [Zw], lnY = [0], sp = [null], est = [false];
    for (var Z = Zw + 1; Z < Zw + (nmax || 4); Z++) {
      var s = Sp(Z, N); if (!s) break;
      lnY.push(lnY[lnY.length - 1] + NUCLEO.lnSaha(s.S, T9, n) + Math.log(gw(Z, N) / gw(Z - 1, N)));
      Zs.push(Z); sp.push(s.S); est.push(s.est);
    }
    var mx = Math.max.apply(null, lnY), P = [], tot = 0, i;
    for (i = 0; i < lnY.length; i++) { P.push(Math.exp(lnY[i] - mx)); tot += P[i]; }
    for (i = 0; i < P.length; i++) P[i] /= tot;
    return { N: N, Z: Zs, lnY: lnY, P: P, Sp: sp, est: est };
  }
  // ln Y(Z+1,N)/Y(Z,N) at one step; gRatio = G(Z+1)/G(Z) (1 when omitted)
  function lnRatio(SpZ1, T9, log10rho, X, gRatio) { return NUCLEO.lnSaha(SpZ1, T9, np(log10rho, X)) + Math.log(gRatio || 1); }
  function gRatio(Z, N) { return gw(Z + 1, N) / gw(Z, N); }

  // mean neutrino energy (MeV) of an allowed beta+ decay to daughter charge Zd, mass A, endpoint E0 (MeV), F = F0 L0
  function meanEnu(Zd, A, E0) {
    var ME = BETA.ME, W0 = 1 + E0 / ME, p0 = Math.sqrt(W0 * W0 - 1), Rn = BETA.radius(A) / BETA.LC, n = 4000, s2 = 0, s3 = 0;
    for (var i = 1; i < n; i++) {                       // composite Simpson in p (the positron integrand vanishes at both ends)
      var p = p0 * i / n, W = Math.sqrt(1 + p * p), q = W0 - W, w = (i % 2 ? 4 : 2);
      var f = BETA.fermi('rel', Zd, W, Rn, -1, p) * p * p * q * q;
      s2 += w * f; s3 += w * f * q;
    }
    return ME * s3 / s2;
  }
  // hot CNO: o = { Zcno, T14, T15 (s), tPart14 (s), Qsa14 (MeV) }
  function hcno(o) {
    var ME = BETA.ME, Q = 4 * T.MH - T.MHe;
    var q15 = mass(8, 7).M - mass(7, 8).M;               // Q_EC(15O) from the atomic masses
    var e15 = meanEnu(7, 15, q15 - 2 * ME), e14 = meanEnu(7, 14, o.Qsa14 - 2 * ME);
    var br14 = o.T14 / o.tPart14;
    var t14 = o.T14 / LN2, t15 = o.T15 / LN2, Abar = (14 * t14 + 15 * t15) / (t14 + t15);
    var E = Q - e14 - e15;
    var coef = NA * E * MEV / (Abar * (t14 + t15));      // erg g^-1 s^-1 per unit Z_CNO
    return { Q: Q, q15: q15, e14: e14, e15: e15, br14: br14, tau14: t14, tau15: t15, Abar: Abar, E: E, coef: coef, eps: coef * o.Zcno };
  }

  var XRB = { init: init, mass: mass, spin: spin, gRatio: gRatio, muFactor: muFactor, Sp: Sp, S2p: S2p, dripN: dripN, np: np, chain: chain, lnRatio: lnRatio, meanEnu: meanEnu, hcno: hcno, NA: NA, MEV: MEV };
  if (typeof module !== 'undefined' && module.exports) module.exports = XRB; else root.XRB = XRB;
})(this);
