/* stellar.js: the closed formulas of the Gamow window, and the published numbers the page shows.
 *
 * Nothing is integrated. Each formula is one line, as in Solar Fusion II (Adelberger et al., RMP 83, 195 (2011),
 * Eqs. (6) to (8) and the definitions under Eq. (8)) and deBoer et al. (RMP 89, 035007 (2017), Eqs. (4), (5)):
 *   reduced mass       mu = A1 A2 / (A1 + A2) u        (mass numbers, as SF II's A; nuclear masses move E0 by < 0.3 %)
 *   Gamow energy       E_G = 2 mu c^2 (pi alpha Z1 Z2)^2
 *   Sommerfeld         eta = Z1 Z2 alpha sqrt(mu c^2 / 2E),  so 2 pi eta = sqrt(E_G / E)
 *   tunnelling         P(E) = exp(-2 pi eta)           (point charges, s wave, E << barrier)
 *   Gamow peak         E0 = (E_G (kT)^2 / 4)^(1/3), the maximum of exp(-E/kT - sqrt(E_G/E))
 *   width              Delta = 4 sqrt(E0 kT / 3), full 1/e width of its Gaussian approximation
 *   barrier            V_B = Z1 Z2 e^2 / R,  R = 1.2 (A1^(1/3) + A2^(1/3)) fm  (touching spheres, an estimate)
 *   turning point      b = Z1 Z2 e^2 / E
 * Plain script: window.STELLAR in a browser, module.exports in Node.
 */
(function (root) {
  'use strict';
  var HBARC = 197.3269804, ALPHA = 1 / 137.035999084, E2 = HBARC * ALPHA;   // MeV fm; e^2 = 1.43996 MeV fm
  var U = 931.49410242, KB = 8.617333262e-11;                                 // MeV; MeV/K

  function mu(r) { return r.A1 * r.A2 / (r.A1 + r.A2) * U; }
  function EG(r) { return 2 * mu(r) * Math.pow(Math.PI * ALPHA * r.Z1 * r.Z2, 2); }
  function kT(T9) { return KB * 1e9 * T9; }
  function E0(r, T9) { return Math.pow(EG(r) * kT(T9) * kT(T9) / 4, 1 / 3); }
  function Delta(r, T9) { return 4 * Math.sqrt(E0(r, T9) * kT(T9) / 3); }
  function eta(r, E) { return r.Z1 * r.Z2 * ALPHA * Math.sqrt(mu(r) / (2 * E)); }
  function twoPiEta(r, E) { return Math.sqrt(EG(r) / E); }
  function radius(r) { return 1.2 * (Math.cbrt(r.A1) + Math.cbrt(r.A2)); }
  function barrier(r) { return r.Z1 * r.Z2 * E2 / radius(r); }
  function turning(r, E) { return r.Z1 * r.Z2 * E2 / E; }
  // the window per unit energy, divided by its value at E0
  function window1(r, E, T9) { var e0 = E0(r, T9), t = kT(T9); return Math.exp(-(E - e0) / t - Math.sqrt(EG(r) / E) + Math.sqrt(EG(r) / e0)); }
  // log10 of sigma(E0)/sigma(E1) when S is the same at both energies: sigma = S exp(-2 pi eta) / E
  function log10SigmaRatio(r, Ea, Eb) { return (-twoPiEta(r, Ea) + twoPiEta(r, Eb)) / Math.LN10 + Math.log10(Eb / Ea); }

  /* Published numbers. S: the evaluated astrophysical S-factor as the source states it; Elow: the lowest
     centre-of-mass energy of a direct measurement (MeV), null when there is none; T9: the temperature of the
     burning stage the reaction belongs to on this page. */
  var R = [
    { id: 'pp', label: 'p(p,e⁺ν)d', Z1: 1, A1: 1, Z2: 1, A2: 1, T9: 0.0155, stage: 'the Sun\'s core',
      S: 'S(0) = 4.09 (1 ± 0.015) × 10⁻²⁵ MeV b', Ssrc: 'Solar Fusion III, Eq. (8)',
      Elow: null, low: 'never measured: the weak interaction makes it too slow; S comes from theory (Solar Fusion III, Sec. I)' },
    { id: '33', label: '³He(³He,2p)⁴He', Z1: 2, A1: 3, Z2: 2, A2: 3, T9: 0.0155, stage: 'the Sun\'s core',
      S: 'S(0) = 5.21 MeV b', Ssrc: 'Solar Fusion III, Table I',
      Elow: 0.016, low: 'LUNA, underground: down to 16 keV, the lower edge of the solar Gamow peak (Bonetti et al. 1999, as reviewed in Solar Fusion II)' },
    { id: '34', label: '³He(α,γ)⁷Be', Z1: 2, A1: 3, Z2: 2, A2: 4, T9: 0.0155, stage: 'the Sun\'s core',
      S: 'S(0) = 0.561 ± 0.018 (exp) ± 0.022 (theor) keV b', Ssrc: 'Solar Fusion III, Eq. (15)',
      Elow: 0.093, low: 'LUNA, underground at Gran Sasso: 93 to 170 keV (Solar Fusion III, Table V)' },
    { id: '17', label: '⁷Be(p,γ)⁸B', Z1: 4, A1: 7, Z2: 1, A2: 1, T9: 0.0155, stage: 'the Sun\'s core',
      S: 'S(0) = 20.5 ± 0.7 eV b', Ssrc: 'Solar Fusion III, Sec. IX',
      Elow: 0.1117, low: 'lowest point 111.7 keV (Hammache et al. 2001, in the Solar Fusion III data tables)' },
    { id: '114', label: '¹⁴N(p,γ)¹⁵O', Z1: 7, A1: 14, Z2: 1, A2: 1, T9: 0.0155, stage: 'the Sun\'s core (CNO cycle)',
      S: 'S(0) = 1.68 ± 0.14 keV b', Ssrc: 'Solar Fusion III, Sec. X (total of the R-matrix analysis)',
      Elow: 0.070, low: 'LUNA, underground: total cross section down to 70 keV (Bemmerer et al. 2006, Lemut et al. 2006, as reviewed in Solar Fusion II)' },
    { id: 'c12ag', label: '¹²C(α,γ)¹⁶O', Z1: 6, A1: 12, Z2: 2, A2: 4, T9: 0.2, stage: 'core helium burning, 0.1 to 0.4 GK',
      S: 'S(300 keV) = 140 ± 21 (MC) +18 −11 (model) keV b', Ssrc: 'deBoer et al. 2017, Table IV',
      Elow: 1.0, low: 'lowest measurements at about 1 MeV, far above the 300 keV that matters (deBoer et al. 2017, Fig. 3)' },
  ];
  var BYID = {};
  for (var i = 0; i < R.length; i++) BYID[R[i].id] = R[i];
  /* Burning stages (temperature ranges in GK) as context. */
  var STAGES = [
    { id: 'sun', label: 'Sun\'s core', T9: 0.0155, lo: 0.0155, hi: 0.0155, src: 'Tc ≈ 15.5 × 10⁶ K, ρc ≈ 153 g/cm³ (Solar Fusion II)' },
    { id: 'he', label: 'core He burning', T9: 0.2, lo: 0.1, hi: 0.4, src: 'AGB and massive stars, 0.1 to 0.4 GK (deBoer et al. 2017, Table I)' },
    { id: 'co', label: 'C and O burning', T9: 1.3, lo: 0.6, hi: 2.7, src: 'massive stars, 0.6 to 2.7 GK (deBoer et al. 2017, Table I)' },
    { id: 'xhe', label: 'explosive He burning', T9: 1.0, lo: 1.0, hi: 1.0, src: 'supernovae and X-ray bursts, about 1 GK (deBoer et al. 2017, Table I)' },
  ];

  var STELLAR = { REACTIONS: R, BYID: BYID, STAGES: STAGES, mu: mu, EG: EG, kT: kT, E0: E0, Delta: Delta, eta: eta,
    twoPiEta: twoPiEta, radius: radius, barrier: barrier, turning: turning, window1: window1, log10SigmaRatio: log10SigmaRatio,
    E2: E2, ALPHA: ALPHA, U: U, KB: KB };
  if (typeof module !== 'undefined' && module.exports) module.exports = STELLAR; else root.STELLAR = STELLAR;
})(this);
