/* bbn.js: the few closed formulas of bbn.html (Big-Bang nucleosynthesis). There is no reaction network here.
 *
 * Every formula is a one-line estimate, labelled as such on the page; the abundances the page compares with are the
 * published ones (BBN_DATA, from scripts/build_bbn_data.py).
 *   Q values      AME2020 atomic mass excesses (assets/shells-data.js): Q = sum Delta(in) - sum Delta(out); with atomic
 *                 masses the electrons balance (n -> p: Q = Delta(n) - Delta(1H), the beta-decay Q).
 *   m_n - m_p     Q_beta(n) + m_e (the 13.6 eV of the hydrogen atom is neglected). PDG 2024 Sec. 24 prints Q = 1.293 MeV.
 *   B_d           the deuteron binding energy, the Q of p(n,gamma)d. PDG: Delta_D = 2.23 MeV.
 *   n/p           in weak equilibrium n/p = exp(-(m_n - m_p)/T) (PDG Sec. 24); frozen at T_f, where PDG quotes n/p ~ 1/6,
 *                 so T_f = (m_n - m_p)/ln 6 here; then the neutrons decay: X_n(t) = X_n(t_f) exp(-(t - t_f)/tau_n),
 *                 X_n = n/(n + p), tau_n = 879.4 s (PDG 2024, the value the plotted calculation assumes).
 *   Y_p           all neutrons end in 4He: Y_p = 2 X_n = 2(n/p)/(1 + n/p) (PDG Eq. (24.1)).
 *   t(T)          radiation era, PDG Eq. (22.43): t = (90 / (32 pi^3 G N))^(1/2) T^-2, i.e. t T^2 = 2.42 N^-1/2 s MeV^2
 *                 (PDG Eq. (22.44) prints 2.4), with N = 43/4 = 10.75 while e+- are relativistic (photons, e+-,
 *                 three neutrinos at T) and N = 2 + (21/4)(4/11)^(4/3) = 3.363 after they have annihilated (Eq. (22.57)).
 *                 Each holds only far from T = m_e; the page switches at T = m_e and says so.
 *   bottleneck    (a) the PDG criterion: photons above the deuteron threshold per baryon, eta^-1 exp(-B_d/T), falls to 1:
 *                     T = B_d / ln(1/eta);
 *                 (b) a Saha estimate: nuclear statistical equilibrium of n + p <-> d + gamma (Saha equation, g_d = 3,
 *                     g_n = g_p = 2), n_d / (n_n n_p) = (3/4) (2 pi m_d / (m_n m_p T))^(3/2) exp(B_d/T) (hbar = c = k = 1),
 *                     with n_b = eta n_gamma, n_gamma = (2 zeta(3)/pi^2) T^3; the temperature where the deuteron mass
 *                     fraction X_d = 2 n_d / n_b in equilibrium reaches X_n X_p (the criterion chosen here; the page
 *                     says so), solved by bisection.
 *   eta           eta_10 = 273.754 [1 - 7.131e-3 (Y - 0.245)]^-1 Omega_b h^2 at T0 = 2.7255 K (FOYY 2020, Appendix).
 * Constants: CODATA 2018 (m_e, u, hbar, G). Plain script: window.BBN in a browser, module.exports in Node; call
 * BBN.init(AME, BBN_DATA) first.
 */
(function (root) {
  'use strict';
  var U = 931.49410242, ME = 0.51099895000;                     // MeV (CODATA 2018)
  var HBAR = 6.582119569e-22;                                    // MeV s
  var G = 6.70883e-39 * 1e-6;                                    // G/(hbar c) in MeV^-2 (CODATA 2018: 6.70883e-39 GeV^-2)
  var ZETA3 = 1.2020569031595942;
  var M = null, D = null;
  var BBN = {};

  BBN.init = function (AME, DATA) {
    M = {};
    for (var i = 0; i < AME.length; i++) M[AME[i][0] + ':' + (AME[i][0] + AME[i][1])] = AME[i][2] / 1000;   // MeV
    D = DATA;
  };
  BBN.dm = function (Z, A) { var v = M[Z + ':' + A]; if (v == null) throw new Error('no AME mass for Z=' + Z + ' A=' + A); return v; };
  // nuclei: [Z, A, label]
  var NUC = { n: [0, 1, 'n'], p: [1, 1, 'p'], d: [1, 2, 'd'], t: [1, 3, 't'], he3: [2, 3, '³He'], he4: [2, 4, '⁴He'],
    li7: [3, 7, '⁷Li'], be7: [4, 7, '⁷Be'] };
  BBN.NUC = NUC;
  /* The reactions drawn on the network: the ones whose rates FOYY 2020 vary in their sensitivity table (key = the key
     of BBN_DATA.sens), plus neutron decay. inp/out: nuclei (atomic masses; e and nu carry no mass excess here). */
  var R = {
    ndec: { lab: 'n → p + e⁻ + ν̄', inp: ['n'], out: ['p'], from: 'n', to: 'p', sens: 'tau_n' },
    pn: { lab: 'p(n,γ)d', inp: ['n', 'p'], out: ['d'], from: 'n', to: 'd', sens: 'pn' },
    dpg: { lab: 'd(p,γ)³He', inp: ['d', 'p'], out: ['he3'], from: 'd', to: 'he3', sens: 'dpg' },
    ddn: { lab: 'd(d,n)³He', inp: ['d', 'd'], out: ['he3', 'n'], from: 'd', to: 'he3', sens: 'ddn' },
    ddp: { lab: 'd(d,p)t', inp: ['d', 'd'], out: ['t', 'p'], from: 'd', to: 't', sens: 'ddp' },
    he3np: { lab: '³He(n,p)t', inp: ['he3', 'n'], out: ['t', 'p'], from: 'he3', to: 't', sens: 'he3np' },
    he3dp: { lab: '³He(d,p)⁴He', inp: ['he3', 'd'], out: ['he4', 'p'], from: 'he3', to: 'he4', sens: 'he3dp' },
    tdn: { lab: 't(d,n)⁴He', inp: ['t', 'd'], out: ['he4', 'n'], from: 't', to: 'he4', sens: 'tdn' },
    he3ag: { lab: '³He(α,γ)⁷Be', inp: ['he3', 'he4'], out: ['be7'], from: 'he3', to: 'be7', sens: 'he3ag' },
    tag: { lab: 't(α,γ)⁷Li', inp: ['t', 'he4'], out: ['li7'], from: 't', to: 'li7', sens: 'tag' },
    be7np: { lab: '⁷Be(n,p)⁷Li', inp: ['be7', 'n'], out: ['li7', 'p'], from: 'be7', to: 'li7', sens: 'be7np' },
    li7pa: { lab: '⁷Li(p,α)⁴He', inp: ['li7', 'p'], out: ['he4', 'he4'], from: 'li7', to: 'he4', sens: 'li7pa' },
    be7na: { lab: '⁷Be(n,α)⁴He', inp: ['be7', 'n'], out: ['he4', 'he4'], from: 'be7', to: 'he4', sens: 'be7na' },
    be7dp: { lab: '⁷Be(d,p)2α', inp: ['be7', 'd'], out: ['he4', 'he4', 'p'], from: 'be7', to: 'he4', sens: 'be7dp' },
  };
  for (var k in R) R[k].id = k;
  BBN.REACT = R;
  function sumDm(list) { var s = 0; for (var i = 0; i < list.length; i++) { var n = NUC[list[i]]; s += BBN.dm(n[0], n[1]); } return s; }
  BBN.Q = function (id) { var r = R[id]; return sumDm(r.inp) - sumDm(r.out); };
  BBN.Bd = function () { return BBN.Q('pn'); };
  BBN.dMnp = function () { return BBN.Q('ndec') + ME; };          // m_n - m_p, MeV
  BBN.mass = function (k) {                                       // nuclear masses (MeV), electron binding neglected
    var n = NUC[k]; return n[1] * U + BBN.dm(n[0], n[1]) - n[0] * ME;
  };
  BBN.ME = ME; BBN.U = U; BBN.HBAR = HBAR; BBN.G = G; BBN.ZETA3 = ZETA3;

  // ---- time and temperature (radiation era, PDG Eqs. (22.43), (22.57))
  BBN.N_HOT = 2 + 7 / 8 * (4 + 6);                                // photons, e+-, three neutrinos at T: 43/4
  BBN.N_COLD = 2 + 21 / 4 * Math.pow(4 / 11, 4 / 3);              // photons at T, neutrinos at (4/11)^(1/3) T
  BBN.C_tT2 = Math.sqrt(90 / (32 * Math.pow(Math.PI, 3) * G)) * HBAR;   // s MeV^2, times N^-1/2
  BBN.Nof = function (T) { return T >= ME ? BBN.N_HOT : BBN.N_COLD; };
  BBN.tOfT = function (T) { return BBN.C_tT2 / Math.sqrt(BBN.Nof(T)) / (T * T); };
  // the inverse; times between the two limits at T = m_e map to T = m_e
  BBN.TofT = function (t) {
    var Th = Math.sqrt(BBN.C_tT2 / Math.sqrt(BBN.N_HOT) / t), Tc = Math.sqrt(BBN.C_tT2 / Math.sqrt(BBN.N_COLD) / t);
    return Th >= ME ? Th : Tc <= ME ? Tc : ME;
  };

  // ---- the neutron fraction
  BBN.tau = function () { return D.pdg.tau_n[0]; };
  BBN.npEq = function (T) { return Math.exp(-BBN.dMnp() / T); };
  BBN.Tf = function () { return BBN.dMnp() / Math.log(1 / D.pdg.np_fr); };      // where n/p = 1/6 (PDG)
  BBN.X = function (np) { return np / (1 + np); };
  BBN.np = function (X) { return X / (1 - X); };
  BBN.Yp = function (np) { return 2 * np / (1 + np); };                       // PDG Eq. (24.1)
  // X_n at temperature T on the way down (equilibrium above T_f, free decay below)
  BBN.Xn = function (T) {
    var Tf = BBN.Tf();
    if (T >= Tf) return BBN.X(BBN.npEq(T));
    return BBN.X(BBN.npEq(Tf)) * Math.exp(-(BBN.tOfT(T) - BBN.tOfT(Tf)) / BBN.tau());
  };

  // ---- the deuterium bottleneck
  BBN.Tpdg = function (eta) { return BBN.Bd() / Math.log(1 / eta); };
  // ln[ X_d / (X_n X_p) ] in nuclear statistical equilibrium at T for baryon-to-photon ratio eta
  BBN.lnSaha = function (T, eta) {
    var md = BBN.mass('d'), mn = BBN.mass('n'), mp = BBN.mass('p');
    var nb = eta * 2 * ZETA3 / (Math.PI * Math.PI) * T * T * T;
    return Math.log(2 * nb * 0.75 * Math.pow(2 * Math.PI * md / (mn * mp * T), 1.5)) + BBN.Bd() / T;
  };
  BBN.Tsaha = function (eta) {                    // X_d = X_n X_p; bisection between 10 keV and 1 MeV
    var a = 0.01, b = 1;
    for (var i = 0; i < 80; i++) { var m = Math.sqrt(a * b); if (BBN.lnSaha(m, eta) > 0) a = m; else b = m; }
    return Math.sqrt(a * b);
  };
  // the one-line Y_p: neutrons decay freely from T_f to the bottleneck temperature Tb, then all go into 4He
  BBN.YpEst = function (Tb) { return BBN.Yp(BBN.np(BBN.Xn(Tb))); };
  // free-decay time that takes n/p from np1 to np2: tau ln(X1/X2)
  BBN.decayTime = function (np1, np2) { return BBN.tau() * Math.log(BBN.X(np1) / BBN.X(np2)); };
  // the onset time (after t = 0) at which the one-line model gives a chosen Y_p: t_f + tau ln(X_f / (Y_p/2))
  BBN.onsetFor = function (Yp) { return BBN.tOfT(BBN.Tf()) + BBN.tau() * Math.log(BBN.X(D.pdg.np_fr) / (Yp / 2)); };

  // ---- eta and Omega_b h^2 (FOYY 2020, Appendix), Y the helium baryon fraction
  BBN.eta10 = function (omega, Y) { var c = D.conv; return c.k * omega / (1 - c.beta * (Y - c.Ystar)); };
  BBN.omega = function (eta10, Y) { var c = D.conv; return eta10 * (1 - c.beta * (Y - c.Ystar)) / c.k; };

  // ---- the published curves: [lower, central, upper] at eta (linear in log eta; log values for D, 3He, Li)
  BBN.curve = function (sp, eta) {
    var rows = D.curves[sp], x = Math.log10(eta);
    if (!(x >= rows[0][0] && x <= rows[rows.length - 1][0])) return null;
    var j = 0; while (j < rows.length - 2 && rows[j + 1][0] < x) j++;
    var a = rows[j], b = rows[j + 1], f = (x - a[0]) / (b[0] - a[0]), out = [];
    for (var c = 1; c <= 3; c++) out.push(sp === 'yp' ? a[c] + f * (b[c] - a[c]) : Math.pow(10, Math.log10(a[c]) + f * (Math.log10(b[c]) - Math.log10(a[c]))));
    return out;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BBN; else root.BBN = BBN;
})(this);
