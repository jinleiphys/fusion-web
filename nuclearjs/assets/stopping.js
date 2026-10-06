/* ------------------------------------------------------------------ *
 * Energy loss of light ions in silicon, and a Delta E - E telescope.
 *
 * Stopping powers (MeV cm2/g), all from the NIST tables in silicon
 * (Berger et al., PSTAR/ASTAR; ICRU Report 49 (1993); NISTIR 4999),
 * shipped in assets/stopping-data.js (data/stopping/fetch_tables.py):
 *   p     PSTAR as tabulated
 *   d, t  PSTAR at the same velocity: S_e(E) = S_e,p(E m_p / m)
 *   4He   ASTAR as tabulated
 *   3He   ASTAR at the same velocity: S_e(E) = S_e,a(E m_a / m)
 *   6,7Li ASTAR at the same velocity times (q_Li / q_He)^2, mean ionic
 *         charges q = Z [1 - exp(-0.95 v / (v0 Z^(2/3)))] of Pierce and
 *         Blann, Phys. Rev. 173, 390 (1968)
 * Velocity scaling of the electronic stopping is what ICRU 49 itself
 * recommends for deuterons and tritons: the Bethe formula depends on the
 * projectile only through z and v, apart from the maximum energy transfer
 * (mass dependence below 1e-3 here). At low velocity the charge state is
 * also a function of v alone for a given z, so the scaling holds there
 * too up to isotope effects of a few percent (tests/check_stopping.py
 * compares with measured d and 3He stopping in Si).
 * Nuclear stopping: the table value for the same z at the same reduced
 * energy eps ~ E / (M1 + M2), times M1/(M1+M2) relative to the reference,
 * which is exact under any universal screened potential; for Li the ZBL
 * universal formula. Below 0.1 MeV/u only.
 *
 * Range: CSDA, R(E) = int_0^E dE'/S(E') on a log grid, cubic Hermite
 * interpolation with the exact derivative dR/dlnE = E/S.
 * Energy straggling: Bohr, dOmega^2/dx = 4 pi e^4 z^2 N_A Z2/A2, the high
 * velocity limit (it overestimates the straggling below about 1 MeV/u in Si,
 * where the inner shells stop contributing). In a thick layer the variance
 * is carried with the slowing down (Tschalaer, NIM 61, 141 (1968), first
 * moment order): d sigma^2/dx = dOmega^2/dx - 2 (dS/dE) sigma^2, solved
 * exactly as sigma_out^2 = S(E_out)^2 int_{E_out}^{E_in} (dOmega^2/dx) S^-3 dE.
 * Fluctuations are sampled as a Gaussian residual range (layerSample, below), which equals the
 * first-order exit-energy Gaussian away from the stopping boundary and stays continuous through it.
 *
 * Plain script: defines window.STOPPING in a browser, module.exports in Node.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var D = (typeof module !== 'undefined' && module.exports) ? require('./stopping-data.js') : root.STOPPING_DATA;
  var U = 931.49410242;               // MeV per u
  var ME = 5.48579909065e-4;          // electron mass, u
  var E2 = 1.439964547e-13;           // e^2/(4 pi eps0), MeV cm
  var NA = 6.02214076e23;
  var Z2 = 14, A2 = 28.0855, RHO = D.density;   // silicon, g/cm3 (NIST uses 2.33)
  var BOHR = 4 * Math.PI * E2 * E2 * NA * Z2 / A2;  // MeV^2 cm^2/g per z^2
  var V0 = 1 / 137.035999;            // Bohr velocity / c

  // nuclear mass in u from the AME2020 atomic mass (micro-u)
  function nucMass(key) {
    var m = D.masses[key];
    return m[2] * 1e-6 - m[0] * ME;
  }
  var SPECIES = {
    p:     { label: 'p',   z: 1, key: '1H',  ref: 'p' },
    d:     { label: 'd',   z: 1, key: '2H',  ref: 'p' },
    t:     { label: 't',   z: 1, key: '3H',  ref: 'p' },
    '3He': { label: '³He', z: 2, key: '3He', ref: 'a' },
    '4He': { label: 'α',   z: 2, key: '4He', ref: 'a' },
    '6Li': { label: '⁶Li', z: 3, key: '6Li', ref: 'a' },
    '7Li': { label: '⁷Li', z: 3, key: '7Li', ref: 'a' }
  };
  for (var k in SPECIES) { SPECIES[k].m = nucMass(SPECIES[k].key); SPECIES[k].name = k; }

  // ---------- monotone cubic (Fritsch-Carlson) in log-log on a reference table
  function pchip(x, y) {
    var n = x.length, h = [], d = [], m = new Float64Array(n);
    for (var i = 0; i < n - 1; i++) { h[i] = x[i + 1] - x[i]; d[i] = (y[i + 1] - y[i]) / h[i]; }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        var w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    return function (t) {
      if (t <= x[0]) return y[0] + d[0] * (t - x[0]);
      if (t >= x[n - 1]) return y[n - 1] + d[n - 2] * (t - x[n - 1]);
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var c = (lo + hi) >> 1; if (x[c] > t) hi = c; else lo = c; }
      var hh = h[lo], s = (t - x[lo]) / hh, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * y[lo] + (s3 - 2 * s2 + s) * hh * m[lo] + (-2 * s3 + 3 * s2) * y[lo + 1] + (s3 - s2) * hh * m[lo + 1];
    };
  }
  function refTable(T) {
    var lx = T.T.map(Math.log);
    var fe = pchip(lx, T.Se.map(Math.log)), fn = pchip(lx, T.Sn.map(Math.log));
    var Emin = T.T[0];
    return {
      // below the first table energy: electronic ~ v (Lindhard), nuclear held by the log-log slope
      Se: function (E) { return E >= Emin ? Math.exp(fe(Math.log(E))) : Math.exp(fe(Math.log(Emin))) * Math.sqrt(E / Emin); },
      Sn: function (E) { return Math.exp(fn(Math.log(Math.max(E, 1e-6)))); },
      Emin: Emin, Emax: T.T[T.T.length - 1]
    };
  }
  var REF = {
    p: { t: refTable(D.pstar), m: 1.007276, z: 1 },     // ICRU 49 masses
    a: { t: refTable(D.astar), m: 4.001506, z: 2 }
  };

  // Pierce-Blann mean charge, v from the energy per u
  function beta(EperU) { var g = 1 + EperU / U; return Math.sqrt(1 - 1 / (g * g)); }
  function qPB(Z, EperU) { return Z * (1 - Math.exp(-0.95 * beta(EperU) / (V0 * Math.pow(Z, 2 / 3)))); }

  // ZBL universal nuclear stopping, MeV cm2/g in silicon
  function snZBL(z1, m1, E) {
    var a = (Math.pow(z1, 0.23) + Math.pow(Z2, 0.23));
    var eps = 32.53 * A2 * E * 1e3 / (z1 * Z2 * (m1 + A2) * a);
    var sn = eps <= 30 ? Math.log(1 + 1.1383 * eps) / (2 * (eps + 0.01321 * Math.pow(eps, 0.21226) + 0.19593 * Math.sqrt(eps)))
                       : Math.log(eps) / (2 * eps);
    var Satom = 8.462e-15 * z1 * Z2 * m1 * sn / ((m1 + A2) * a);   // eV cm2 / atom
    return Satom * 1e-6 * NA / A2;
  }

  // ---------- stopping power of species sp at kinetic energy E (MeV): {e, n, t}, MeV cm2/g
  function dedx(sp, E) {
    var S = SPECIES[sp], R = REF[S.ref];
    var Er = E * R.m / S.m, Se = R.t.Se(Er);
    if (S.z !== R.z) { var r = qPB(S.z, E / S.m) / qPB(R.z, E / S.m); Se *= r * r; }
    var Sn;
    if (S.z === R.z) Sn = R.t.Sn(E * (R.m + A2) / (S.m + A2)) * (S.m / (S.m + A2)) / (R.m / (R.m + A2));
    else Sn = snZBL(S.z, S.m, E);
    return { e: Se, n: Sn, t: Se + Sn };
  }

  // ---------- range and straggling tables per species
  var LNE0 = Math.log(1e-3), LNE1 = Math.log(700), NG = 3000, HG = (LNE1 - LNE0) / (NG - 1);
  var TAB = {};
  function table(sp) {
    if (TAB[sp]) return TAB[sp];
    var S = SPECIES[sp], z2 = S.z * S.z;
    var E = new Float64Array(NG), St = new Float64Array(NG), R = new Float64Array(NG), J = new Float64Array(NG);
    var dR = new Float64Array(NG), dJ = new Float64Array(NG);
    for (var i = 0; i < NG; i++) {
      E[i] = Math.exp(LNE0 + i * HG);
      St[i] = dedx(sp, E[i]).t;
      dR[i] = E[i] / St[i];                                  // dR/dlnE
      dJ[i] = E[i] * BOHR * z2 / (St[i] * St[i] * St[i]);    // dJ/dlnE
    }
    // below 1 keV: S ~ E^p from the first interval, R(E0) = E0 / (S0 (1 - p))
    // (for p and 4He the grid starts at the first table energy, and R there is NIST's own value)
    var p = Math.log(St[1] / St[0]) / HG; p = Math.min(0.9, Math.max(0, p));
    R[0] = sp === 'p' ? D.pstar.Rc[0] : sp === '4He' ? D.astar.Rc[0] : E[0] / (St[0] * (1 - p));
    J[0] = 0;
    // Simpson on each cell with the midpoint evaluated exactly
    for (i = 1; i < NG; i++) {
      var Em = Math.exp(LNE0 + (i - 0.5) * HG), Sm = dedx(sp, Em).t;
      R[i] = R[i - 1] + HG / 6 * (dR[i - 1] + 4 * Em / Sm + dR[i]);
      J[i] = J[i - 1] + HG / 6 * (dJ[i - 1] + 4 * Em * BOHR * z2 / (Sm * Sm * Sm) + dJ[i]);
    }
    return (TAB[sp] = { E: E, S: St, R: R, J: J, dR: dR, dJ: dJ });
  }
  // cubic Hermite in lnE with exact node derivatives
  function herm(T, Y, dY, E) {
    var x = (Math.log(E) - LNE0) / HG;
    if (x <= 0) return Y[0] * (E / T.E[0]);
    var i = Math.min(NG - 2, Math.floor(x)), s = x - i, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * Y[i] + (s3 - 2 * s2 + s) * HG * dY[i] + (-2 * s3 + 3 * s2) * Y[i + 1] + (s3 - s2) * HG * dY[i + 1];
  }
  function rangeG(sp, E) { var T = table(sp); return herm(T, T.R, T.dR, E); }       // g/cm2
  function strJ(sp, E) { var T = table(sp); return herm(T, T.J, T.dJ, E); }
  function energyAtRange(sp, Rg) {
    var T = table(sp), R = T.R;
    if (Rg <= R[0]) return T.E[0] * Rg / R[0];
    var lo = 0, hi = NG - 1;
    while (hi - lo > 1) { var c = (lo + hi) >> 1; if (R[c] > Rg) hi = c; else lo = c; }
    var lr = Math.log(Rg), E = Math.exp(Math.log(T.E[lo]) + (lr - Math.log(R[lo])) / (Math.log(R[hi]) - Math.log(R[lo])) * HG);
    for (var k = 0; k < 3; k++) E -= (rangeG(sp, E) - Rg) * dedx(sp, E).t;   // Newton, dR/dE = 1/S
    return E;
  }
  var um2g = function (um) { return um * 1e-4 * RHO; };
  function rangeUm(sp, E) { return rangeG(sp, E) / RHO * 1e4; }

  // ---------- one silicon layer of thickness um entered at energy E: mean exit energy and variance (MeV^2)
  function layer(sp, E, um) {
    var x = um2g(um), R0 = rangeG(sp, E);
    if (R0 <= x) return { stop: true, Eout: 0, var: 0, R0: R0 };
    var Eo = energyAtRange(sp, R0 - x), So = dedx(sp, Eo).t;
    var dJ = strJ(sp, E) - strJ(sp, Eo);
    return { stop: false, Eout: Eo, var: So * So * Math.max(0, dJ), R0: R0 };
  }
  // ---------- one layer with fluctuations, sampled in range rather than in exit energy.
  // First-order straggling gives the exit energy a Gaussian of variance S(E_out)^2 [J(E) - J(E_out)].
  // Mapped through dR/dE = 1/S that is a Gaussian residual range, mean R(E) - x and variance
  // J(E) - J(E_out); J(E) is itself the (Bohr, first-order) range-straggling variance from E to rest.
  // Far from the stopping boundary the two are the same to first order. Near it the energy form fails:
  // the exit-energy width becomes much larger than the mean exit energy, a sharp cut makes the
  // transmitted fraction jump from 0 to about 1/2 at the CSDA threshold. Sampled in range, the residual
  // range r is continuous through the threshold (at R(E) = x its variance is J(E) on both sides),
  // a particle is stopped when r <= 0, and the transmitted fraction is Phi((R(E) - x) / sigma_R).
  // g: a standard normal deviate (the caller's generator).
  function rangeVar(sp, E, um) {
    var x = um2g(um), R0 = rangeG(sp, E);
    var J0 = strJ(sp, E);
    var vr = R0 > x ? J0 - strJ(sp, energyAtRange(sp, R0 - x)) : J0;
    return { R0: R0, x: x, vr: Math.max(0, vr) };
  }
  function layerSample(sp, E, um, g) {
    var v = rangeVar(sp, E, um), r = v.R0 - v.x + Math.sqrt(v.vr) * g;
    return r > 0 ? energyAtRange(sp, r) : 0;
  }
  function erfc(x) {                                  // Numerical Recipes erfcc, |rel err| < 1.2e-7
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function transmitProb(sp, E, um) {
    var v = rangeVar(sp, E, um);
    if (v.vr <= 0) return v.R0 > v.x ? 1 : 0;
    return 0.5 * erfc(-(v.R0 - v.x) / Math.sqrt(2 * v.vr));
  }
  // the two-element telescope, no fluctuations: mean deposits
  function telescope(sp, E, t1, t2) {
    var a = layer(sp, E, t1);
    if (a.stop) return { dE: E, E: 0, where: 0, l1: a };
    var b = layer(sp, a.Eout, t2);
    if (b.stop) return { dE: E - a.Eout, E: a.Eout, where: 1, l1: a, l2: b };
    return { dE: E - a.Eout, E: a.Eout - b.Eout, where: 2, Eexit: b.Eout, l1: a, l2: b };
  }
  // smallest energy that crosses a thickness (um)
  function energyToCross(sp, um) { return energyAtRange(sp, um2g(um)); }

  // ---------- relativistic two-body kinematics a + A -> b + B, lab angle of b (rad); masses MeV
  function twoBody(ma, mA, mb, mB, Ta, th) {
    var Et = Ta + ma + mA, pa = Math.sqrt(Ta * Ta + 2 * Ta * ma), s = Et * Et - pa * pa;
    if (Math.sqrt(s) < mb + mB) return [];
    var K = (s + mb * mb - mB * mB) / 2, c = Math.cos(th), A = Et * Et - pa * pa * c * c;
    var disc = K * K - mb * mb * A;
    if (disc < 0) return [];
    var out = [], sq = Et * Math.sqrt(disc);
    [(K * pa * c + sq) / A, (K * pa * c - sq) / A].forEach(function (pb, j) {
      if (pb <= 0 || (j === 1 && disc === 0)) return;
      if (K + pa * pb * c <= 0) return;                    // spurious root of the squared equation
      out.push(Math.sqrt(pb * pb + mb * mb) - mb);
    });
    return out;
  }
  function massMeV(key) { return nucMass(key) * U; }

  var STOPPING = {
    SPECIES: SPECIES, RHO: RHO, BOHR: BOHR, U: U,
    dedx: dedx, rangeG: rangeG, rangeUm: rangeUm, energyAtRange: energyAtRange,
    layer: layer, layerSample: layerSample, transmitProb: transmitProb, rangeVar: rangeVar, telescope: telescope, energyToCross: energyToCross,
    twoBody: twoBody, massMeV: massMeV, qPB: qPB, snZBL: snZBL, data: D
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = STOPPING; else root.STOPPING = STOPPING;
})(this);
