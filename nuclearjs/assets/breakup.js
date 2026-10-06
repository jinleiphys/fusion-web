/* nuclearjs inclusive breakup: the few closed formulas the page draws with (no reaction calculation).
   Plain script (window.BREAKUP) that also loads in node (module.exports), for node one-liners; the page's wiring is checked by tests/check_pages.js.

   Units: MeV, fm, velocities in units of c. Nonrelativistic throughout (beam energies here are below 20 MeV per
   nucleon, where the relativistic correction to the fragment energies is below 2%).

     nucMass(AME, Z, A)        nuclear mass from the AME2020 mass excess: A u + Delta - Z m_e (electron binding
                               ignored, below 1 keV for these light nuclei)
     sep(m_a, m_b, m_x)        separation energy S = m_b + m_x - m_a
     decayLength(m_b, m_x, S)  1/kappa = hbar c / sqrt(2 mu S): the length over which the bound-state wave function
                               of b + x falls by e outside the range of their force
     barrier(Z1, A1, Z2, A2)   Coulomb energy 1.44 Z1 Z2 / R at R = 1.5 (A1^1/3 + A2^1/3) fm: a rough barrier height,
                               with no nuclear attraction
     kin(o)                    sequential breakup a + A -> a* + A, a* -> b + x (see below)
     orbit(o)                  Coulomb (Rutherford) orbit of a about a fixed A, for the animation
*/
(function (root) {
  "use strict";
  const U = 931.49410242, ME = 0.51099895, HBARC = 197.3269804, E2 = 1.439964547;

  function nucMass(AME, Z, A) {
    const r = AME.find((q) => q[0] === Z && q[1] === A - Z);
    if (!r) throw new Error("no AME2020 entry for Z=" + Z + " A=" + A);
    return A * U + r[2] / 1000 - Z * ME;
  }
  const sep = (ma, mb, mx) => mb + mx - ma;
  function decayLength(mb, mx, S) { const mu = mb * mx / (mb + mx); return HBARC / Math.sqrt(2 * mu * S); }
  function barrier(Z1, A1, Z2, A2) { const R = 1.5 * (Math.cbrt(A1) + Math.cbrt(A2)); return { V: E2 * Z1 * Z2 / R, R }; }

  /* kin({ ma, mb, mx, mA, Elab, eps, th, phi })
     Two steps, nonrelativistic. Energy and momentum balance to the mass defect only: a* + A keeps the c.m.
     velocity of a + A although m_a* = m_a + S + eps (d + 58Ni at 80 MeV, eps = 1 MeV: 1e-4 MeV and 0.02 of 548 MeV/c).
       1. a + A -> a* + A, with a* = b + x at relative energy eps above the b + x threshold, so the c.m. kinetic
          energy drops by S + eps (S from the masses: S = mb + mx - ma); a* leaves at c.m. angle th.
       2. a* -> b + x with relative velocity v_rel = sqrt(2 eps / mu_bx), b along the angle phi from the a*
          direction (in the reaction plane).
     Returns lab velocity vectors [vx, vy] (v/c; x along the beam), lab kinetic energies, and the extremes of E_b
     over all phi (the spread that the moving a* gives the fragments). */
  function kin(o) {
    const { ma, mb, mx, mA, Elab } = o, eps = o.eps || 0, th = o.th || 0, phi = o.phi || 0;
    const S = sep(ma, mb, mx), mst = mb + mx;
    const pl = Math.sqrt(2 * ma * Elab), Vcm = pl / (ma + mA);                 // momentum (MeV/c), c.m. velocity
    const Ecm = Elab * mA / (ma + mA), Ef = Ecm - S - eps;
    if (Ef <= 0) return null;
    const muf = mst * mA / (mst + mA), pf = Math.sqrt(2 * muf * Ef);
    const va = [Vcm + pf / mst * Math.cos(th), pf / mst * Math.sin(th)];
    const vA = [Vcm - pf / mA * Math.cos(th), -pf / mA * Math.sin(th)];
    const vr = Math.sqrt(2 * eps / (mb * mx / mst)), ux = Math.cos(th + phi), uy = Math.sin(th + phi);
    const vb = [va[0] + mx / mst * vr * ux, va[1] + mx / mst * vr * uy];
    const vx = [va[0] - mb / mst * vr * ux, va[1] - mb / mst * vr * uy];
    const T = (m, v) => 0.5 * m * (v[0] * v[0] + v[1] * v[1]);
    const sa = Math.hypot(va[0], va[1]);
    return { S, Ecm, Ef, va, vA, vb, vx, Eb: T(mb, vb), Ex: T(mx, vx), EA: T(mA, vA), Ea: T(mst, va),
      Ebmin: 0.5 * mb * (sa - mx / mst * vr) ** 2, Ebmax: 0.5 * mb * (sa + mx / mst * vr) ** 2, vr };
  }

  /* orbit({ Z1, Z2, Ecm, rmin, rmax, n }): Rutherford orbit of the relative coordinate, target fixed at the origin,
     beam along +x, deflection toward +y (the scene's reaction plane). d0 = Z1 Z2 e^2 / Ecm is the head-on distance of
     closest approach; the impact parameter is chosen to give the requested rmin (rmin >= d0):
     b = rmin sqrt(1 - d0/rmin). Returns points [x, y] and times t (fm per unit velocity, so t/v is the time) from
     the incoming end, the index of closest approach, and the asymptotic deflection angle. */
  function orbit(o) {
    const d0 = E2 * o.Z1 * o.Z2 / o.Ecm, rmin = Math.max(o.rmin, d0 * 1.0001), n = o.n || 600, rmax = o.rmax || 60;
    const b = rmin * Math.sqrt(1 - d0 / rmin);
    const e = Math.sqrt(1 + (2 * b / d0) ** 2), p = 2 * b * b / d0;               // r = p / (e cos psi - 1)
    const psiMax = Math.acos((p / rmax + 1) / e);                                // where r = rmax
    const psiInf = Math.acos(1 / e), theta = Math.PI - 2 * psiInf;               // deflection angle
    // polar angle phi = (pi - psiInf) - psi: the far incoming point lies toward -x (phi -> pi), the outgoing one
    // toward the deflection angle theta (phi -> theta), so the projectile passes above the target (y > 0)
    const pts = [], t = [];
    let tt = 0, prev = null;
    for (let i = 0; i <= n; i++) {
      const psi = -psiMax + 2 * psiMax * i / n, r = p / (e * Math.cos(psi) - 1), ph = Math.PI - psiInf - psi;
      const q = [r * Math.cos(ph), r * Math.sin(ph)];
      if (prev) tt += Math.hypot(q[0] - prev[0], q[1] - prev[1]) / Math.sqrt(Math.max(1e-9, 1 - d0 / r));
      pts.push(q); t.push(tt); prev = q;
    }
    return { pts, t, iMin: n / 2, theta, b, d0, rmin };
  }

  const API = { U, ME, HBARC, E2, nucMass, sep, decayLength, barrier, kin, orbit };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.BREAKUP = API;
})(typeof window !== "undefined" ? window : globalThis);
