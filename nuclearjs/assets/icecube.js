/* icecube.js: the live math of icecube.html (high-energy neutrinos, the IceCube Neutrino Observatory).
 *
 * Units: energies in GeV, lengths in m (km where named), cross sections in cm^2, column depths in g cm^-2.
 * Model (stated in full on the page; every input number comes from assets/icecube-data.js, built from saved sources):
 *   Neutrino-nucleon cross sections: the NLO QCD table of Cooper-Sarkar, Mertsch and Sarkar (JHEP 08 (2011) 042),
 *     isoscalar target, CC and NC, nu and nubar, interpolated linearly in (log E, log sigma).
 *   Glashow resonance, nubar_e e- -> W- -> anything, a relativistic Breit-Wigner fixed by unitarity at the peak:
 *       sigma(s) = (24 pi / M^2) B(W -> e nu) s Gamma^2 / ((s - M^2)^2 + M^2 Gamma^2) (hbar c)^2,   s = 2 m_e E + m_e^2.
 *     The factor 24 pi = 16 pi (2J + 1) / [(2 s_nu + 1)(2 s_e + 1)] with J = 1, one neutrino helicity, two electron spins.
 *   Earth: PREM density (ObsPy/TauP prem.nd, linear between its nodes, the 3 km ocean replaced by crust), under the
 *     South Pole ice sheet; the detector sits at depth DET_DEPTH below the ice surface. Column depth along the chord
 *     X(cos z) = ∫ rho dl, z the zenith angle of the arrival direction (cos z = -1: straight up through the core).
 *   Survival to the detector without any interaction: T = exp(-N_A X sigma_tot), sigma_tot = sigma_CC + sigma_NC
 *     (an NC interaction does not remove the neutrino but moves it to lower energy; counted here as lost), plus for
 *     nubar_e the Glashow term on electrons, n_e = N_A X <Z/A>.
 *   Muon range in ice: the CSDA range of the PDG muon table for ice (Groom, Mokhov, Striganov), no straggling;
 *     above its last row continued with dE/dX = a + b E fitted to the last two rows.
 *   Flavour at Earth: decoherent average over oscillations, f_beta = sum_alpha f_alpha sum_i |U_alpha i|^2 |U_beta i|^2,
 *     U the PMNS matrix from NuFIT 6.0 (angles and delta_CP, normal ordering unless asked).
 *   Astrophysical flux per flavour (nu + nubar): Phi(E) = phi0 (E / 100 TeV)^-gamma (IceCube 9.5-year muon-neutrino fit).
 *
 * Plain script: window.ICEMATH in a browser, module.exports in Node.
 */
(function (root) {
  'use strict';

  // ---------- small helpers
  function lerpLog(xs, ys, x) {            // linear in (log x, log y); xs ascending, clamped at the ends
    var n = xs.length;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    var t = Math.log(x / xs[lo]) / Math.log(xs[hi] / xs[lo]);
    return Math.exp(Math.log(ys[lo]) + t * Math.log(ys[hi] / ys[lo]));
  }
  function simpson(f, a, b, n) {           // composite Simpson, n even
    n = n + (n & 1);
    var h = (b - a) / n, s = f(a) + f(b);
    for (var i = 1; i < n; i++) s += (i & 1 ? 4 : 2) * f(a + i * h);
    return s * h / 3;
  }

  // ---------- cross sections
  // D.xs = { E: [GeV...], nuCC: [cm^2...], nuNC, nbCC, nbNC }
  function sigma(D, E, ch) { return lerpLog(D.xs.E, D.xs[ch], E); }
  function sigmaTot(D, E, anti) { return anti ? sigma(D, E, 'nbCC') + sigma(D, E, 'nbNC') : sigma(D, E, 'nuCC') + sigma(D, E, 'nuNC'); }
  // Glashow: per electron, cm^2. D.W = { M, G, Bev } (GeV, GeV, fraction), D.me (GeV), D.hc2 (GeV^2 cm^2)
  function glashow(D, E) {
    var M2 = D.W.M * D.W.M, G2 = D.W.G * D.W.G, s = 2 * D.me * E + D.me * D.me;
    return 24 * Math.PI / M2 * D.W.Bev * s * G2 / ((s - M2) * (s - M2) + M2 * G2) * D.hc2;
  }
  // the resonance (pole) energy, s = M_W^2; the maximum of sigma lies slightly above, at s = M sqrt(M^2 + Gamma^2)
  function glashowPoleE(D) { return (D.W.M * D.W.M - D.me * D.me) / (2 * D.me); }
  function glashowMaxE(D) { return (D.W.M * Math.sqrt(D.W.M * D.W.M + D.W.G * D.W.G) - D.me * D.me) / (2 * D.me); }

  // ---------- Earth
  // D.prem = { depth: [km...], rho: [g/cm^3...] } top down, duplicated depths at discontinuities; D.R (km)
  // D.ice = { thick: km, rho: g/cm^3 }, D.det = detector depth below the ice surface, km
  function rhoAt(D, r) {                   // r in km from the centre; the ice sheet replaces the top of PREM
    var depth = D.R - r;
    if (depth < 0) return 0;
    if (depth < D.ice.thick) return D.ice.rho;
    var d = D.prem.depth, p = D.prem.rho, n = d.length;
    if (depth >= d[n - 1]) return p[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (d[m] <= depth) lo = m; else hi = m; }
    // at a discontinuity (d[lo] == d[lo+1]) lo is the deeper side; between distinct nodes interpolate linearly
    var a = d[lo], b = d[hi];
    return b > a ? p[lo] + (p[hi] - p[lo]) * (depth - a) / (b - a) : p[hi];
  }
  // chord length (km) from the detector back to the Earth's surface, for arrival from zenith angle with cosine c
  function chord(D, c) { var rd = D.R - D.det; return -rd * c + Math.sqrt(D.R * D.R - rd * rd * (1 - c * c)); }
  // column depth in g/cm^2 (km * g/cm^3 * 1e5)
  function column(D, c, n) {
    var rd = D.R - D.det, L = chord(D, c);
    var f = function (s) { return rhoAt(D, Math.sqrt(Math.max(0, rd * rd + s * s + 2 * rd * s * c))); };
    // split at the ice/rock boundary and at the steepest part near the surface: plain Simpson on a fine grid
    return simpson(f, 0, L, n || 4000) * 1e5;
  }
  // a cached table of X(cos z) for fast transmission (linear in cos z, log X): m uniform points plus points clustered
  // on both sides of every direction whose chord grazes a density jump (PREM discontinuities, the ice/rock boundary),
  // where X has a square-root kink
  function grazing(D) {
    var rd = D.R - D.det, out = [], d = D.prem.depth, radii = [D.R - D.ice.thick];
    for (var i = 1; i < d.length; i++) if (d[i] === d[i - 1]) radii.push(D.R - d[i]);
    for (var k = 0; k < radii.length; k++) if (radii[k] < rd) out.push(-Math.sqrt(1 - (radii[k] / rd) * (radii[k] / rd)));
    return out;
  }
  function columnGrid(D, m) {
    m = m || 401;
    var c = [], OFF = [1e-5, 3e-5, 1e-4, 3e-4, 1e-3, 2e-3, 4e-3, 7e-3, 1.2e-2, 2e-2];
    for (var i = 0; i < m; i++) c.push(-1 + 2 * i / (m - 1));
    for (var j = 0; j <= 300; j++) c.push(-0.1 + 0.15 * j / 300);      // near the horizon X climbs steeply with depth below it
    grazing(D).forEach(function (g) { c.push(g); OFF.forEach(function (o) { c.push(g - o, g + o); }); });
    c = c.filter(function (x) { return x >= -1 && x <= 1; }).sort(function (a, b) { return a - b; });
    c = c.filter(function (x, i) { return i === 0 || x - c[i - 1] > 1e-9; });
    var X = c.map(function (x) { return column(D, x); });
    return { c: c, X: X };
  }
  function columnFast(G, cz) {
    var c = G.c, n = c.length;
    if (cz <= c[0]) return G.X[0];
    if (cz >= c[n - 1]) return G.X[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (c[m] <= cz) lo = m; else hi = m; }
    var u = (cz - c[lo]) / (c[hi] - c[lo]);
    return Math.exp(Math.log(G.X[lo]) * (1 - u) + Math.log(G.X[hi]) * u);
  }
  // survival probability without interaction; flav: 'e','mu','tau'; anti: boolean
  function transmission(D, E, X, anti, flav) {
    var s = sigmaTot(D, E, anti), mu = D.NA * X * s;
    if (anti && flav === 'e') mu += D.NA * X * D.ZA * glashow(D, E);
    return Math.exp(-mu);
  }
  // interaction length (km) in ice, for a nucleon cross section
  function lengthIce(D, s) { return 1 / (D.ice.rho * D.NA * s) / 1e5; }

  // ---------- muons in ice: CSDA range from the PDG table, metres
  // D.mu = { T: [MeV...], R: [g/cm^2...], dEdx: [MeV cm^2/g...] }, D.muM (MeV), D.ice.rho
  function muonRange(D, Egev) {
    var T = Egev * 1e3 - D.muM, t = D.mu.T, R = D.mu.R, n = t.length;
    if (T <= t[0]) return 0;
    var g;
    if (T <= t[n - 1]) g = lerpLog(t, R, T);
    else {                                  // dE/dX = a + b E through the last two rows
      var e1 = t[n - 2], e2 = t[n - 1], s1 = D.mu.dEdx[n - 2], s2 = D.mu.dEdx[n - 1];
      var b = (s2 - s1) / (e2 - e1), a = s2 - b * e2;
      g = R[n - 1] + Math.log((a + b * T) / (a + b * e2)) / b;
    }
    return g / D.ice.rho / 100;
  }
  // muon energy (GeV) left after a path of x metres, by inverting the range
  function muonEnergyAfter(D, E0, x) {
    var R0 = muonRange(D, E0);
    if (x >= R0) return 0;
    var lo = D.muM / 1e3, hi = E0;
    for (var k = 0; k < 60; k++) { var m = Math.sqrt(lo * hi); if (muonRange(D, m) > R0 - x) hi = m; else lo = m; }
    return Math.sqrt(lo * hi);
  }
  function muonLoss(D, Egev) {             // total stopping power in ice, GeV/m
    var T = Egev * 1e3 - D.muM, t = D.mu.T, s = D.mu.dEdx, n = t.length, v;
    if (T <= t[0]) v = s[0];
    else if (T <= t[n - 1]) v = lerpLog(t, s, T);
    else { var b = (s[n - 1] - s[n - 2]) / (t[n - 1] - t[n - 2]); v = s[n - 1] + b * (T - t[n - 1]); }
    return v * D.ice.rho * 100 / 1e3;
  }

  // ---------- flavour
  // P = { s12, s13, s23 } (sin^2), dcp in degrees
  function pmns(P, dcpDeg) {
    var s12 = Math.sqrt(P.s12), c12 = Math.sqrt(1 - P.s12), s13 = Math.sqrt(P.s13), c13 = Math.sqrt(1 - P.s13);
    var s23 = Math.sqrt(P.s23), c23 = Math.sqrt(1 - P.s23), d = dcpDeg * Math.PI / 180;
    var cd = Math.cos(d), sd = Math.sin(d);
    // complex entries as [re, im]; standard parametrisation (PDG), e^{-i d} on U_e3
    return [
      [[c12 * c13, 0], [s12 * c13, 0], [s13 * cd, -s13 * sd]],
      [[-s12 * c23 - c12 * s23 * s13 * cd, -c12 * s23 * s13 * sd], [c12 * c23 - s12 * s23 * s13 * cd, -s12 * s23 * s13 * sd], [s23 * c13, 0]],
      [[s12 * s23 - c12 * c23 * s13 * cd, -c12 * c23 * s13 * sd], [-c12 * s23 - s12 * c23 * s13 * cd, -s12 * c23 * s13 * sd], [c23 * c13, 0]]
    ];
  }
  function flavourMatrix(P, dcpDeg) {      // Pavg[a][b] = sum_i |U_ai|^2 |U_bi|^2
    var U = pmns(P, dcpDeg), A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    var u2 = U.map(function (row) { return row.map(function (z) { return z[0] * z[0] + z[1] * z[1]; }); });
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) for (var i = 0; i < 3; i++) A[a][b] += u2[a][i] * u2[b][i];
    return A;
  }
  function atEarth(Pm, src) {
    var s = src[0] + src[1] + src[2], out = [0, 0, 0];
    for (var b = 0; b < 3; b++) for (var a = 0; a < 3; a++) out[b] += src[a] / s * Pm[a][b];
    return out;
  }

  // ---------- astrophysical flux, per flavour, nu + nubar: GeV^-1 cm^-2 s^-1 sr^-1
  function flux(D, E) { return D.astro.phi0 * 1e-18 * Math.pow(E / 1e5, -D.astro.gamma); }
  // charged-current interactions per year of one flavour (nu + nubar, 1:1) inside a volume of ice (km^3),
  // integrated over the sky with Earth absorption, for neutrino energies between E1 and E2
  function ccRate(D, G, E1, E2, km3, flav, opt) {
    opt = opt || {};
    var Nn = km3 * 1e15 * D.ice.rho * D.NA, yr = 3.15576e7, nE = opt.nE || 120, nC = opt.nC || 80;
    var l1 = Math.log(E1), l2 = Math.log(E2);
    var fE = function (l) {
      var E = Math.exp(l), ph = flux(D, E) / 2, sky = 0;
      for (var anti = 0; anti < 2; anti++) {
        var s = sigma(D, E, anti ? 'nbCC' : 'nuCC');
        var fc = function (c) { return transmission(D, E, columnFast(G, c), !!anti, flav); };
        sky += s * 2 * Math.PI * simpson(fc, -1, 1, nC);
      }
      return ph * sky * E;
    };
    return Nn * yr * simpson(fE, l1, l2, nE);
  }

  // ---------- event light (display model, schematic amplitude, exact Cherenkov timing)
  // cascade at point P with energy E: photo-electrons and arrival time at a DOM at Q (metres, ns)
  function cascadeHit(o, P, E, Q) {
    var dx = Q[0] - P[0], dy = Q[1] - P[1], dz = Q[2] - P[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz), r = d + 1;   // 1 m regularises the amplitude only
    return { q: o.kc * E * Math.exp(-r / o.lam) / (r * r), t: d * o.ng / o.c };
  }
  // straight track from P along unit u, starting at time 0 at P, existing for s in [s0, s1]. Amplitude: a display
  // kernel, kt dE/dx exp(-r/lam) / sqrt(r / 1 m), r the photon path (illustrative units); the timing is exact for
  // unscattered light
  function trackHit(o, P, u, s0, s1, Q, dEdxAt) {
    var w = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]];
    var l = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
    var dd = Math.sqrt(Math.max(0, w[0] * w[0] + w[1] * w[1] + w[2] * w[2] - l * l));
    var se = l - dd / o.tanC;              // emission point of the direct Cherenkov photon
    if (se < s0 || se > s1) return null;
    var path = dd / o.sinC, r = Math.max(1, path);
    return { q: o.kt * dEdxAt(se) * Math.exp(-r / o.lam) / Math.sqrt(r), t: se / o.c + path * o.ng / o.c };
  }

  var ICEMATH = {
    lerpLog: lerpLog, simpson: simpson,
    sigma: sigma, sigmaTot: sigmaTot, glashow: glashow, glashowPoleE: glashowPoleE, glashowMaxE: glashowMaxE,
    rhoAt: rhoAt, chord: chord, column: column, grazing: grazing, columnGrid: columnGrid, columnFast: columnFast,
    transmission: transmission, lengthIce: lengthIce,
    muonRange: muonRange, muonEnergyAfter: muonEnergyAfter, muonLoss: muonLoss,
    pmns: pmns, flavourMatrix: flavourMatrix, atEarth: atEarth,
    flux: flux, ccRate: ccRate, cascadeHit: cascadeHit, trackHit: trackHit
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ICEMATH; else root.ICEMATH = ICEMATH;
})(this);
