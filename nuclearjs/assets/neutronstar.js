/* neutronstar.js: the few closed formulas the neutron-star page uses, and the published observations.
 *
 * No stellar structure is computed here. The mass-radius curves, the crust depths and the density profile are
 * read from published figures (assets/neutronstar-data.js, built by scripts/build_neutronstar_data.py). What is
 * computed is one line each:
 *   Schwarzschild radius      r_s = 2GM/c^2
 *   surface gravity           g = GM / (R^2 sqrt(1 - r_s/R))          (Chamel & Haensel 2008, Eq. (99))
 *   radial from proper depth  R - r = z sqrt(1 - r_s/R)               (their Eq. (97), thin-crust approximation)
 *   R(M) along a published curve, by linear interpolation between the points the authors drew.
 * GM_sun: IAU 2015 nominal solar mass parameter 1.3271244e20 m^3 s^-2; c = 299792458 m/s.
 *
 * Plain script: window.NSTAR in a browser, module.exports in Node.
 */
(function (root) {
  'use strict';
  var GMSUN = 1.3271244e20, C = 299792458;
  var MSUN_KM = GMSUN / (C * C) / 1000;                 // G Msun / c^2 = 1.476625 km

  function rs(M) { return 2 * MSUN_KM * M; }            // km, M in Msun
  function compactness(M, R) { return MSUN_KM * M / R; }  // GM/(R c^2)
  function gravity(M, R) {                              // m/s^2, R in km
    return GMSUN * M / Math.pow(R * 1000, 2) / Math.sqrt(1 - rs(M) / R);
  }
  function radialDepth(z, M, R) { return z * Math.sqrt(1 - rs(M) / R); }
  // R at mass M on a curve [[M, R], ...] drawn from light stars to the maximum mass; null outside it
  function radiusAt(curve, M) {
    for (var i = curve.length - 1; i > 0; i--) {         // from the maximum mass down: the stable branch
      var a = curve[i - 1], b = curve[i];
      if ((a[0] - M) * (b[0] - M) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (M - a[0]) / (b[0] - a[0]);
    }
    return null;
  }
  function maxMass(curve) { var m = curve[0]; for (var i = 1; i < curve.length; i++) if (curve[i][0] > m[0]) m = curve[i]; return m; }

  /* Observations, each as the cited paper states it (lo/hi: the quoted minus/plus errors). */
  var OBS = {
    j0740M: { M: 2.08, lo: 0.07, hi: 0.07, cl: '68.3%', src: 'Fonseca et al., ApJL 915, L12 (2021), arXiv:2104.00880' },
    j0740Riley: { R: 12.39, Rlo: 0.98, Rhi: 1.30, M: 2.072, Mlo: 0.066, Mhi: 0.067, cl: '16-84%', src: 'Riley et al., ApJL 918, L27 (2021), arXiv:2105.06980' },
    j0740Miller: { R: 13.7, Rlo: 1.5, Rhi: 2.6, M: 2.062, Mlo: 0.091, Mhi: 0.090, cl: '68%', src: 'Miller et al., ApJL 918, L28 (2021), arXiv:2105.06979 (M: their Table 7, 1.971 to 2.152)' },
    j0030Riley: { R: 12.71, Rlo: 1.19, Rhi: 1.14, M: 1.34, Mlo: 0.16, Mhi: 0.15, cl: '16-84%', src: 'Riley et al., ApJL 887, L21 (2019), arXiv:1912.05702' },
    j0030Miller: { R: 13.02, Rlo: 1.06, Rhi: 1.24, M: 1.44, Mlo: 0.14, Mhi: 0.15, cl: '68%', src: 'Miller et al., ApJL 887, L24 (2019), arXiv:1912.05705' },
    gw170817: { R: 11.9, Rlo: 1.4, Rhi: 1.4, M1: 1.18, M2: 1.58, cl: '90%', src: 'Abbott et al. (LIGO and Virgo), PRL 121, 161101 (2018), arXiv:1805.11581: R1 = R2 = 11.9 ± 1.4 km when the equation of state must reach 1.97 Msun; masses (1.18, 1.36) and (1.36, 1.58) Msun' },
    j0952M: { M: 2.35, lo: 0.17, hi: 0.17, cl: '1σ', src: 'Romani et al., ApJL 934, L17 (2022), arXiv:2207.05124' },
  };

  var NSTAR = { MSUN_KM: MSUN_KM, GMSUN: GMSUN, rs: rs, compactness: compactness, gravity: gravity,
    radialDepth: radialDepth, radiusAt: radiusAt, maxMass: maxMass, OBS: OBS };
  if (typeof module !== 'undefined' && module.exports) module.exports = NSTAR; else root.NSTAR = NSTAR;
})(this);
