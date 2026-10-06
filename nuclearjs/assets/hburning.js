/* hburning.js: the few closed formulas of hburning.html (hydrogen burning: the pp chains and the CNO cycles).
 *
 * Nothing is integrated and there is no reaction network. Three kinds of number:
 *   Q values      from AME2020 atomic mass excesses (assets/shells-data.js): Q = sum Delta(in) - sum Delta(out).
 *                 With atomic masses the electrons balance by themselves: a beta+ Q (Delta(parent) - Delta(daughter))
 *                 and the p + p Q (2 Delta(1H) - Delta(2H)) include the 2 m_e c^2 of the positron annihilating
 *                 with an electron of the plasma; an electron capture Q is the same difference. 4p -> 4He:
 *                 Q = 4 Delta(1H) - Delta(4He).
 *   neutrino loss Bahcall, PRC 65, 025801 (2002), Table I: the solar average neutrino energy of each source
 *                 (HB_DATA.bahcall); the heat a branch leaves in the star is Q(4p) minus its neutrino energies.
 *   rates         Solar Fusion II (Adelberger et al., RMP 83, 195 (2011)), Eq. (8), the Gamow-peak closed form
 *                 for a nonresonant charged-particle rate, without electron screening (f0 = 1):
 *                   <sigma v> = 1.301e-14 cm^3/s (Z1 Z2 / A)^(1/3) S_eff/(MeV b) T9^(-2/3) exp(-3 E0/kT)
 *                   E0/kT = (pi Z1 Z2 alpha / sqrt 2)^(2/3) (A u c^2 / kT)^(1/3),  A = A1 A2 / (A1 + A2)
 *                   S_eff = S(0) (1 + 5kT/36E0) + S'(0) E0 (1 + 35kT/36E0) + S''(0)/2 E0^2 (1 + 89kT/36E0)
 *                 and the rate per volume r = n1 n2 <sigma v> / (1 + delta_12) (their Eq. (3)); S(0), S'(0), S''(0) from
 *                 Solar Fusion III (Acharya et al., RMP 97, 035002 (2025)) Table I (HB_DATA.rates).
 * Composition: the central zone of a standard solar model (BS05, HB_DATA.centre): rho, X(1H), Y, X(14N),
 * held fixed while the temperature moves. Energy generation (an illustrative estimate, not a solar model):
 *   eps_pp  = E_pp r_pp / rho, E_pp the heat per p + p reaction averaged over the three branches:
 *             3He in equilibrium (made by p + p at r_pp, destroyed by 3He + 3He and 3He + 4He):
 *               <sv>_33 n3^2 + n4 <sv>_34 n3 - n_p^2 <sv>_pp / 2 = 0,   f34 = n4 <sv>_34 / (n3 <sv>_33 + n4 <sv>_34)
 *             the fraction of 3He (one per p + p) that goes to 7Be; 7Be then captures an electron (Solar Fusion III
 *             Sec. VIII, R = 5.60e-9 (rho/mu_e) T6^(-1/2) [1 + 0.004 (T6 - 16)] /s, mu_e = 2/(1 + X), stated valid for
 *             10 < T6 < 16 and extrapolated outside) or a proton; E_pp = (1 - f34) H_I / 2 + f34 (b_ec H_II + (1 - b_ec) H_III),
 *             H the heat per 4He of each branch. The pep reaction (0.24 % of p + p) is left out.
 *   eps_CNO = (Q(4p) - <E_nu>(13N) - <E_nu>(15O)) n_p n_14 <sigma v>_14 / rho: CN cycle in equilibrium, every
 *             cycle passing through its slowest step 14N(p,gamma)15O, with the model's 14N mass fraction.
 * Mean lives: tau = 1 / (n_p <sigma v>) against proton capture, 1 / (n_3 <sigma v>_33 + n_4 <sigma v>_34) for 3He (n_3 in
 * equilibrium), 1 / (R_ec + n_p <sigma v>_17) for 7Be, T1/2 / ln 2 for beta+ decay (NUBASE2020).
 * Plain script: window.HB in a browser, module.exports in Node (call HB.init(AME, HB_DATA) first).
 */
(function (root) {
  'use strict';
  var U = 931.49410242, KB = 8.617333262e-11, ALPHA = 1 / 137.035999084;   // MeV/u, MeV/K (CODATA 2018)
  var MEV = 1.602176634e-6, MU_G = 1.66053906660e-24, YEAR = 3.15576e7;    // erg/MeV, g/u, s per Julian year
  var M = null, D = null;
  var HB = {};

  HB.init = function (AME, DATA) {
    M = {};
    for (var i = 0; i < AME.length; i++) M[AME[i][0] + ':' + (AME[i][0] + AME[i][1])] = AME[i][2] / 1000;   // MeV
    D = DATA;
  };
  // atomic mass excess in MeV of (Z, A); 'p' is 1H, 'a' 4He
  HB.dm = function (Z, A) { var v = M[Z + ':' + A]; if (v == null) throw new Error('no AME mass for Z=' + Z + ' A=' + A); return v; };
  // a nucleus: [Z, A, symbol]
  var NUC = {
    p: [1, 1, 'p'], d: [1, 2, '²H'], he3: [2, 3, '³He'], he4: [2, 4, '⁴He'], li7: [3, 7, '⁷Li'], be7: [4, 7, '⁷Be'],
    b8: [5, 8, '⁸B'], be8: [4, 8, '⁸Be'], c12: [6, 12, '¹²C'], n13: [7, 13, '¹³N'], c13: [6, 13, '¹³C'], n14: [7, 14, '¹⁴N'],
    o15: [8, 15, '¹⁵O'], n15: [7, 15, '¹⁵N'], o16: [8, 16, '¹⁶O'], f17: [9, 17, '¹⁷F'], o17: [8, 17, '¹⁷O'],
  };
  HB.NUC = NUC;
  /* The steps. inp/out: nuclei on each side (atomic masses; e+, e- and nu carry no mass excess in this bookkeeping,
     see the header). kind: pp (weak fusion), pg (radiative capture), pa (p,alpha), b (beta+ decay), ec (electron
     capture), hh (3He + 3He), ha (3He + 4He), aa (8Be -> 2 alpha). nu: the Bahcall source of its neutrino. The slow step is
     a property of the branch (HB.BRANCHES[b].slow): p + p, a weak process (Solar Fusion II, Sec. III); 14N(p,gamma),
     the slowest reaction of the CN cycle (Solar Fusion II, Sec. XI); in the NO cycle 16O(p,gamma), whose mean life
     at the solar centre (about 20 Gyr) is far longer than that of 14N (HB.wait). */
  var S = {
    pp: { lab: 'p + p → ²H + e⁺ + ν', inp: ['p', 'p'], out: ['d'], kind: 'pp', nu: 'pp' },
    dpg: { lab: '²H + p → ³He + γ', inp: ['d', 'p'], out: ['he3'], kind: 'pg' },
    hh: { lab: '³He + ³He → ⁴He + 2p', inp: ['he3', 'he3'], out: ['he4', 'p', 'p'], kind: 'hh' },
    ha: { lab: '³He + ⁴He → ⁷Be + γ', inp: ['he3', 'he4'], out: ['be7'], kind: 'ha' },
    ec7: { lab: '⁷Be + e⁻ → ⁷Li + ν', inp: ['be7'], out: ['li7'], kind: 'ec', nu: 'be7' },
    li7pa: { lab: '⁷Li + p → 2 ⁴He', inp: ['li7', 'p'], out: ['he4', 'he4'], kind: 'pa' },
    be7pg: { lab: '⁷Be + p → ⁸B + γ', inp: ['be7', 'p'], out: ['b8'], kind: 'pg' },
    b8b: { lab: '⁸B → ⁸Be* + e⁺ + ν', inp: ['b8'], out: ['be8'], kind: 'b', nu: 'b8', note: 'Q to the ⁸Be ground state; the decay feeds the broad 2⁺ state near 3 MeV, whose energy goes to the α pair' },
    be8: { lab: '⁸Be → 2 ⁴He', inp: ['be8'], out: ['he4', 'he4'], kind: 'aa' },
    c12pg: { lab: '¹²C + p → ¹³N + γ', inp: ['c12', 'p'], out: ['n13'], kind: 'pg' },
    n13b: { lab: '¹³N → ¹³C + e⁺ + ν', inp: ['n13'], out: ['c13'], kind: 'b', nu: 'n13' },
    c13pg: { lab: '¹³C + p → ¹⁴N + γ', inp: ['c13', 'p'], out: ['n14'], kind: 'pg' },
    n14pg: { lab: '¹⁴N + p → ¹⁵O + γ', inp: ['n14', 'p'], out: ['o15'], kind: 'pg' },
    o15b: { lab: '¹⁵O → ¹⁵N + e⁺ + ν', inp: ['o15'], out: ['n15'], kind: 'b', nu: 'o15' },
    n15pa: { lab: '¹⁵N + p → ¹²C + ⁴He', inp: ['n15', 'p'], out: ['c12', 'he4'], kind: 'pa' },
    n15pg: { lab: '¹⁵N + p → ¹⁶O + γ', inp: ['n15', 'p'], out: ['o16'], kind: 'pg' },
    o16pg: { lab: '¹⁶O + p → ¹⁷F + γ', inp: ['o16', 'p'], out: ['f17'], kind: 'pg' },
    f17b: { lab: '¹⁷F → ¹⁷O + e⁺ + ν', inp: ['f17'], out: ['o17'], kind: 'b', nu: 'f17' },
    o17pa: { lab: '¹⁷O + p → ¹⁴N + ⁴He', inp: ['o17', 'p'], out: ['n14', 'he4'], kind: 'pa' },
  };
  for (var k in S) S[k].id = k;
  HB.STEPS = S;
  /* The branches, each a sequence that turns 4 p into one 4He. times: how often a step runs per 4He (p + p twice
     in pp-I; 3He forms twice there). The CN cycle with its 15N(p,alpha) closing; CNO-II leaves at 15N(p,gamma). */
  HB.BRANCHES = {
    pp1: { lab: 'pp-I', slow: 'pp', steps: [['pp', 2], ['dpg', 2], ['hh', 1]] },
    pp2: { lab: 'pp-II', slow: 'pp', steps: [['pp', 1], ['dpg', 1], ['ha', 1], ['ec7', 1], ['li7pa', 1]] },
    pp3: { lab: 'pp-III', slow: 'pp', steps: [['pp', 1], ['dpg', 1], ['ha', 1], ['be7pg', 1], ['b8b', 1], ['be8', 1]] },
    cno1: { lab: 'CN cycle (CNO-I)', slow: 'n14pg', steps: [['c12pg', 1], ['n13b', 1], ['c13pg', 1], ['n14pg', 1], ['o15b', 1], ['n15pa', 1]] },
    cno2: { lab: 'NO cycle (CNO-II)', slow: 'o16pg', steps: [['n15pg', 1], ['o16pg', 1], ['f17b', 1], ['o17pa', 1], ['n14pg', 1], ['o15b', 1]] },
  };

  function sumDm(list) { var s = 0; for (var i = 0; i < list.length; i++) { var n = NUC[list[i]]; s += HB.dm(n[0], n[1]); } return s; }
  HB.Q = function (id) { var s = S[id]; return sumDm(s.inp) - sumDm(s.out); };
  HB.Q4p = function () { return 4 * HB.dm(1, 1) - HB.dm(2, 4); };
  HB.Enu = function (src) { return D.bahcall[src].E; };       // MeV, Bahcall 2002 Table I
  // per 4He made through this branch: total Q (must be Q4p), the neutrino energy, and the heat left in the star
  HB.branchEnergy = function (b) {
    var st = HB.BRANCHES[b].steps, q = 0, nu = 0;
    for (var i = 0; i < st.length; i++) { var s = S[st[i][0]]; q += st[i][1] * HB.Q(s.id); if (s.nu) nu += st[i][1] * HB.Enu(s.nu); }
    return { Q: q, nu: nu, heat: q - nu };
  };

  // ---- rates (Solar Fusion II Eq. (8)); T9 = T / 10^9 K
  HB.kT = function (T9) { return KB * 1e9 * T9; };
  HB.Ared = function (A1, A2) { return A1 * A2 / (A1 + A2); };
  HB.E0kT = function (Z1, Z2, A, T9) { return Math.pow(Math.PI * Z1 * Z2 * ALPHA / Math.SQRT2, 2 / 3) * Math.cbrt(A * U / HB.kT(T9)); };
  HB.Seff = function (Sf, E0, kT) {                // Sf = [S(0) MeV b, S'(0) b, S''(0) b/MeV]; E0, kT in MeV
    return Sf[0] * (1 + 5 * kT / (36 * E0)) + Sf[1] * E0 * (1 + 35 * kT / (36 * E0)) + 0.5 * Sf[2] * E0 * E0 * (1 + 89 * kT / (36 * E0));
  };
  // r = { Z1, A1, Z2, A2, S: [S0, S1, S2] } -> <sigma v> in cm^3/s
  HB.sigv = function (r, T9) {
    var A = HB.Ared(r.A1, r.A2), t = HB.E0kT(r.Z1, r.Z2, A, T9), kT = HB.kT(T9);
    return 1.301e-14 * Math.cbrt(r.Z1 * r.Z2 / A) * HB.Seff(r.S, t * kT, kT) * Math.pow(T9, -2 / 3) * Math.exp(-3 * t);
  };
  // composition: a BS05 central zone { T, rho, X, Y, he3, n14 (mass fractions) }; n_i = rho X_i / m_i (atomic mass)
  function mass(Z, A) { return (A + HB.dm(Z, A) / U) * MU_G; }
  HB.mass = mass;
  HB.n = function (c, Z, A, Xi) { return c.rho * Xi / mass(Z, A); };
  HB.np = function (c) { return HB.n(c, 1, 1, c.X); };
  HB.n14 = function (c) { return HB.n(c, 7, 14, c.n14); };
  HB.alphaPP = function () { return (HB.Q4p() - 2 * HB.Enu('pp')) / 2; };          // MeV per p + p reaction (pp-I)
  HB.heatCN = function () { return HB.Q4p() - HB.Enu('n13') - HB.Enu('o15'); };     // MeV per CN cycle
  // 7Be electron capture rate in the plasma (1/s), Solar Fusion III Sec. VIII
  HB.rEC7 = function (T9, c) { var T6 = T9 * 1e3, e = D.ec7; return e.c * c.rho * (1 + c.X) / 2 * Math.pow(T6, -0.5) * (1 + e.lin * (T6 - e.T6ref)); };
  // the pp branching at (T9, c): equilibrium 3He, the 3He + 4He fraction, the 7Be electron-capture fraction, heat per p + p
  HB.ppBranch = function (T9, c) {
    var np = HB.np(c), n4 = HB.n(c, 2, 4, c.Y), l33 = HB.sigv(D.rates.he33, T9), l34 = HB.sigv(D.rates.he34, T9), lpp = HB.sigv(D.rates.pp, T9);
    var b = n4 * l34, n3 = (-b + Math.sqrt(b * b + 2 * l33 * np * np * lpp)) / (2 * l33);
    var f34 = b / (n3 * l33 + b), rec = HB.rEC7(T9, c), rp = np * HB.sigv(D.rates.be7p, T9), bec = rec / (rec + rp);
    var H = function (k) { return HB.branchEnergy(k).heat; };
    return { n3: n3, X3: n3 * HB.mass(2, 3) / c.rho, f34: f34, bec: bec, E: (1 - f34) * H('pp1') / 2 + f34 * (bec * H('pp2') + (1 - bec) * H('pp3')),
      // terminations per 4He: pp-I, pp-II, pp-III (a pp-I 4He takes two 3He)
      share: (function () { var a = (1 - f34) / 2, s = a + f34; return [a / s, f34 * bec / s, f34 * (1 - bec) / s]; })() };
  };
  HB.epsPP = function (T9, c) { var n = HB.np(c); return HB.ppBranch(T9, c).E * MEV * 0.5 * n * n * HB.sigv(D.rates.pp, T9) / c.rho; };
  HB.epsCNO = function (T9, c) { return HB.heatCN() * MEV * HB.np(c) * HB.n14(c) * HB.sigv(D.rates.n14, T9) / c.rho; };
  // mean lives (years). capture(key): against proton capture with HB_DATA.rates[key]; beta(key): NUBASE half-life / ln 2
  HB.tauCapture = function (key, T9, c) { return 1 / (HB.np(c) * HB.sigv(D.rates[key], T9)) / YEAR; };
  HB.tauPP = function (T9, c) { return HB.tauCapture('pp', T9, c); };          // a proton, against p + p
  HB.tau14 = function (T9, c) { return HB.tauCapture('n14', T9, c); };
  HB.tauHe3 = function (T9, c) {
    var n3 = HB.ppBranch(T9, c).n3, n4 = HB.n(c, 2, 4, c.Y);
    return 1 / (n3 * HB.sigv(D.rates.he33, T9) + n4 * HB.sigv(D.rates.he34, T9)) / YEAR;
  };
  HB.tauBeta = function (key) { return D.halflife[key][0] / Math.LN2 / YEAR; };
  /* The waiting time of each station of a branch at (T9, c): [nucleus key, years or null, what it waits for]. */
  HB.STATION = {
    p: ['pp', 'p + p'], d: ['dp', 'p capture'], he3: ['he3', '³He + ³He or ⁴He'], be7: ['be7', 'e⁻ capture + p capture'],
    b8: ['beta:b8', 'β⁺ decay'], c12: ['c12', 'p capture'], n13: ['beta:n13', 'β⁺ decay'], c13: ['c13', 'p capture'],
    n14: ['n14', 'p capture'], o15: ['beta:o15', 'β⁺ decay'], n15: ['n15a', 'p capture, (p,α) + (p,γ)'],
    o16: ['o16', 'p capture'], f17: ['beta:f17', 'β⁺ decay'],
  };
  HB.wait = function (nuc, T9, c) {
    var s = HB.STATION[nuc]; if (!s) return null;
    if (s[0] === 'he3') return HB.tauHe3(T9, c);
    if (s[0] === 'be7') return 1 / (HB.rEC7(T9, c) + HB.np(c) * HB.sigv(D.rates.be7p, T9)) / YEAR;
    if (s[0].indexOf('beta:') === 0) return HB.tauBeta(s[0].slice(5));
    if (nuc === 'n15') return 1 / (HB.np(c) * (HB.sigv(D.rates.n15a, T9) + HB.sigv(D.rates.n15g, T9))) / YEAR;
    return HB.tauCapture(s[0], T9, c);
  };
  // logarithmic temperature exponent nu = dln eps / dln T, by a centred difference
  HB.nu = function (f, T9, c) { var h = 1e-4; return (Math.log(f(T9 * (1 + h), c)) - Math.log(f(T9 * (1 - h), c))) / (Math.log(1 + h) - Math.log(1 - h)); };
  // temperature (T9) where eps_pp = eps_CNO, by bisection on the log ratio between 5 and 100 MK
  HB.crossover = function (c) {
    var f = function (t) { return Math.log(HB.epsCNO(t, c) / HB.epsPP(t, c)); }, a = 0.005, b = 0.1;
    if (f(a) * f(b) > 0) return null;
    for (var i = 0; i < 80; i++) { var m = Math.sqrt(a * b); if (f(a) * f(m) <= 0) b = m; else a = m; }
    return Math.sqrt(a * b);
  };
  HB.U = U; HB.KB = KB; HB.MEV = MEV; HB.YEAR = YEAR;
  if (typeof module !== 'undefined' && module.exports) module.exports = HB; else root.HB = HB;
})(this);
