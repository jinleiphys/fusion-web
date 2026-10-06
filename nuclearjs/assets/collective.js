/* nuclearjs: the simple formulas of collective.html (collective rotation and vibration). Plain script, also
   require-able from Node (tests/check_collective.js). Energies in keV unless stated, moments of inertia in hbar^2/MeV.
   - rigid rotor:   E(I) = (hbar^2 / 2 J) I(I+1), with hbar^2/2J fitted to E(2+1): E(I) = E(2+) I(I+1) / 6, J = 3 hbar^2 / E(2+)
   - harmonic quadrupole vibrator: E = n hbar omega, hbar omega = E(2+1); n = 2 is the 0+, 2+, 4+ triplet
   - beta2 from B(E2; 0+ -> 2+1) up: beta2 = (4 pi / 3 Z R0^2) [B(E2)up / e^2]^(1/2), R0 = 1.2 A^(1/3) fm
     (Pritychenko et al., ADNDT 107, 1 (2016), arXiv:1312.5975 Eq. (2); the convention of the B(E2) table's beta2 column)
   - moments of inertia of a sharp surface R(theta) = R0 (1 + beta Y20(theta)), uniform density, mass A u, to leading order in beta:
       rigid body      J_rig = (2/5) A u R0^2 (1 + sqrt(5 / 16 pi) beta)
       irrotational    J_irr = (9 / 8 pi) A u R0^2 beta^2
     (both derived and checked by quadrature in tests/check_collective.py)
   - yrast band I -> I-2, E_gamma = E(I) - E(I-2) (level energies):
       hbar omega = E_gamma / 2                        (dE/dI at the mid spin I-1, the central difference)
       J1 = hbar^2 (2I - 1) / E_gamma                  (kinematic, = hbar^2 (I - 1/2) / hbar omega)
       J2 = 4 hbar^2 / (E_gamma(I+2) - E_gamma(I))     (dynamic, = hbar^2 dI / d(hbar omega), at hbar omega = (E_g(I) + E_g(I+2)) / 4)
     For a rigid rotor J1 = J2 = 3 hbar^2 / E(2+) exactly. A backbend: hbar omega falls while I rises, counted only where
     both gammas are in the dataset. */
(function (root) {
  "use strict";
  const HBARC = 197.3269804;        // MeV fm, CODATA 2018
  const MU = 931.49410242;          // MeV, atomic mass unit, CODATA 2018
  const R0 = (A) => 1.2 * Math.cbrt(A);
  const C = {
    HBARC, MU, R0,
    r42: (e2, e4) => e4 / e2,
    rotorE: (I, e2) => e2 * I * (I + 1) / 6,
    vibE: (n, e2) => n * e2,
    inertiaExp: (e2) => 3000 / e2,                                      // hbar^2/MeV from E(2+) in keV
    beta2: (Z, A, be2) => 4 * Math.PI / (3 * Z * R0(A) * R0(A)) * Math.sqrt(be2 * 1e4),   // B(E2)up in e^2 b^2
    inertiaRigid: (A, b) => 0.4 * A * MU * R0(A) * R0(A) / (HBARC * HBARC) * (1 + Math.sqrt(5 / (16 * Math.PI)) * b),
    inertiaIrrot: (A, b) => 9 / (8 * Math.PI) * A * MU * R0(A) * R0(A) / (HBARC * HBARC) * b * b,
    // the yrast table y = [[I, E keV, ...]] as consecutive even spins from 0: transitions and both moments of inertia
    backbend(y) {
      const tr = [];
      for (let i = 1; i < y.length; i++) {
        const I = y[i][0], Eg = y[i][1] - y[i - 1][1];
        if (y[i][0] - y[i - 1][0] !== 2 || !(Eg > 0)) break;
        tr.push({ I, Eg, hw: Eg / 2000, J1: 1000 * (2 * I - 1) / Eg, egos: Eg / I, t: y[i][2] || y[i - 1][2] ? 1 : 0, g: y[i][3] });
      }
      const dyn = [];
      for (let i = 0; i + 1 < tr.length; i++) {
        const d = tr[i + 1].Eg - tr[i].Eg;
        dyn.push({ I: tr[i].I, hw: (tr[i].Eg + tr[i + 1].Eg) / 4000, J2: d !== 0 ? 4000 / d : null });
      }
      // backbends: hbar omega falls while I rises; 'linked' only where both transitions are gammas in the dataset,
      // otherwise the yrast sequence may just pass to another band with no linking gamma
      const bends = [];
      for (let i = 1; i < tr.length; i++) if (tr[i].hw < tr[i - 1].hw) bends.push({ I: tr[i].I, linked: tr[i].g && tr[i - 1].g ? 1 : 0 });
      return { tr, dyn, bends };
    },
    // rotational frequency of the yrast state with index i (MeV): central difference (E(I+2) - E(I-2)) / 4,
    // one-sided E_gamma / 2 at the top; 0 for I = 0
    omegaState(y, i) {
      if (i <= 0) return 0;
      if (i + 1 < y.length) return (y[i + 1][1] - y[i - 1][1]) / 4000;
      return (y[i][1] - y[i - 1][1]) / 2000;
    },
    // real spherical harmonics used to shape the surfaces (orthonormal on the sphere): Y_l,m for l = 2, 3, m >= 0 (cos m phi)
    Yreal(l, m, th, ph) {
      const x = Math.cos(th), s = Math.sin(th), P = Math.PI;
      const c = m === 0 ? 1 : Math.SQRT2 * Math.cos(m * ph);
      if (l === 2) {
        if (m === 0) return Math.sqrt(5 / (16 * P)) * (3 * x * x - 1);
        if (m === 1) return c * Math.sqrt(15 / (8 * P)) * s * x;
        return c * Math.sqrt(15 / (32 * P)) * s * s;
      }
      if (m === 0) return Math.sqrt(7 / (16 * P)) * (5 * x * x * x - 3 * x);
      if (m === 1) return c * Math.sqrt(21 / (64 * P)) * s * (5 * x * x - 1);
      if (m === 2) return c * Math.sqrt(105 / (32 * P)) * s * s * x;
      return c * Math.sqrt(35 / (64 * P)) * s * s * s;
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = C; else root.COLL = C;
})(this);
