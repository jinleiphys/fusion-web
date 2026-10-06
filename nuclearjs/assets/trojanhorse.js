/* nuclearjs Trojan horse page: the few closed formulas the page draws with (no reaction calculation).
   Plain script (window.THM) that also loads in node (module.exports), for tests/check_trojanhorse.js.

   Units: MeV, fm, MeV/c; velocities in units of c.

     nucMass(AME, Z, A)     nuclear mass from the AME2020 mass excess: A u + Delta - Z m_e (electron binding
                            ignored: below 1 keV for these light nuclei, and it cancels in every Q-value used here)
     barrier(Z1,A1,Z2,A2)   Coulomb energy Z1 Z2 e^2 / R at R = r0 (A1^1/3 + A2^1/3), r0 = 1.45 fm: the rough
                            barrier height Li et al. (PLB 879, 140675 (2026)) quote, 7.8 MeV for 12C + 12C
     gamow(Z1,Z2,mu,E)      2 pi eta = 2 pi Z1 Z2 alpha sqrt(mu c^2 / 2E) and the Gamow factor exp(-2 pi eta)
     turning(Z1,Z2,E)       classical turning point of a head-on approach, r = Z1 Z2 e^2 / E
     hulthen(p, a, b)       |phi(p)|^2 of the deuteron, Hulthen form, normalised to 1 at p = 0:
                            [(1/(a^2+k^2) - 1/(b^2+k^2)) / (1/a^2 - 1/b^2)]^2, k = p / hbar c
     kin(o)                 relativistic three-body kinematics of a + A -> s + c + C through x + A -> F* -> c + C
     orbit(o)               Coulomb (Rutherford) orbit, for the animation
*/
(function (root) {
  "use strict";
  const U = 931.49410242, ME = 0.51099895, HBARC = 197.3269804, E2 = 1.439964547, ALPHA = 1 / 137.035999084;
  const R0B = 1.45;

  function nucMass(AME, Z, A) {
    const r = AME.find((q) => q[0] === Z && q[1] === A - Z);
    if (!r) throw new Error("no AME2020 entry for Z=" + Z + " A=" + A);
    return A * U + r[2] / 1000 - Z * ME;
  }
  function barrier(Z1, A1, Z2, A2) { const R = R0B * (Math.cbrt(A1) + Math.cbrt(A2)); return { V: E2 * Z1 * Z2 / R, R }; }
  function gamow(Z1, Z2, mu, E) {
    if (!(E > 0)) return { tpe: Infinity, P: 0 };
    const tpe = 2 * Math.PI * Z1 * Z2 * ALPHA * Math.sqrt(mu / (2 * E));
    return { tpe, P: Math.exp(-tpe) };
  }
  const turning = (Z1, Z2, E) => E2 * Z1 * Z2 / E;
  function hulthen(p, a, b) {
    a = a || 0.2317; b = b || 1.202;
    const k = p / HBARC, f = (1 / (a * a + k * k) - 1 / (b * b + k * k)) / (1 / (a * a) - 1 / (b * b));
    return f * f;
  }

  // ---- four-vectors [E, px, py, pz]
  const fv = (m, p) => [Math.sqrt(m * m + p[0] * p[0] + p[1] * p[1] + p[2] * p[2]), p[0], p[1], p[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
  const mass = (q) => Math.sqrt(Math.max(0, q[0] * q[0] - q[1] * q[1] - q[2] * q[2] - q[3] * q[3]));
  // boost q by velocity beta (3-vector): the frame in which q was given moves with +beta in the new frame
  function boost(q, bt) {
    const b2 = bt[0] * bt[0] + bt[1] * bt[1] + bt[2] * bt[2];
    if (b2 < 1e-30) return q.slice();
    const g = 1 / Math.sqrt(1 - b2), bp = bt[0] * q[1] + bt[1] * q[2] + bt[2] * q[3], k = (g - 1) * bp / b2 + g * q[0];
    return [g * (q[0] + bp), q[1] + k * bt[0], q[2] + k * bt[1], q[3] + k * bt[2]];
  }
  const vel = (q) => [q[1] / q[0], q[2] / q[0], q[3] / q[0]];
  const T = (q) => q[0] - mass(q);

  /* kin({ m: { a, A, x, s, c, C }, beam: "a" | "A", Eb, ps: [px,py,pz], n: [nx,ny,nz] })
     Lab frame, beam along +z, the other nucleus at rest. ps is the spectator momentum in the rest frame of the
     horse a (its Fermi momentum inside a; ps = 0 is the quasi-free point, where s keeps a's velocity). n is the
     direction of c in the rest frame of F* = x + A. Exact energy-momentum conservation:
       E_xA = M(F*) - m_x - m_A,   M(F*)^2 = (P_tot - p_s)^2      (four-vectors)
     which is also E_cC - Q2 for the detected c and C, Q2 = m_x + m_A - m_c - m_C. Returns energies, lab
     four-momenta, and velocities in the rest frame of A (the frame the animation is drawn in). */
  function kin(o) {
    const { m, beam, Eb } = o, ps = o.ps || [0, 0, 0];
    const B = m.x + m.s - m.a, Q2 = m.x + m.A - m.c - m.C;
    const pb = Math.sqrt(Eb * (Eb + 2 * (beam === "a" ? m.a : m.A)));
    const Pa = beam === "a" ? fv(m.a, [0, 0, pb]) : fv(m.a, [0, 0, 0]);
    const PA = beam === "A" ? fv(m.A, [0, 0, pb]) : fv(m.A, [0, 0, 0]);
    const Ptot = add(Pa, PA), Ecm = mass(Ptot) - m.a - m.A;
    const Ps = boost(fv(m.s, ps), vel(Pa));                       // spectator: from a's rest frame to the lab
    const PF = sub(Ptot, Ps), MF = mass(PF), Exa = MF - m.x - m.A;
    const out = { B, Q2, Ecm, Exa, Ts: T(Ps), Pa, PA, Ps, PF };
    // F* -> c + C (only above the c + C threshold; Q2 > 0 for every case here)
    const avail = MF - m.c - m.C;
    if (avail > 0) {
      const n = o.n || [1, 0, 0], nn = Math.hypot(n[0], n[1], n[2]) || 1;
      const pst = Math.sqrt((MF * MF - (m.c + m.C) ** 2) * (MF * MF - (m.c - m.C) ** 2)) / (2 * MF);
      const u = [n[0] / nn * pst, n[1] / nn * pst, n[2] / nn * pst];
      const bF = vel(PF);
      out.Pc = boost(fv(m.c, u), bF); out.PC = boost(fv(m.C, [-u[0], -u[1], -u[2]]), bF);
      out.EcC = mass(add(out.Pc, out.PC)) - m.c - m.C;               // relative energy of the detected pair
    }
    // velocities in the rest frame of A
    const bA = vel(PA).map((v) => -v), toA = (q) => vel(boost(q, bA));
    out.vA = { a: toA(Pa), s: toA(Ps), F: toA(PF) };
    if (out.Pc) { out.vA.c = toA(out.Pc); out.vA.C = toA(out.PC); }
    const Pa_A = boost(Pa, bA);
    out.EaA = T(Pa_A);                                               // a's kinetic energy in A's rest frame
    return out;
  }

  /* orbit({ Z1, Z2, Ecm, mu, b, rmin, rmax, n }): relative coordinate of a Coulomb orbit, target fixed at the origin,
     incoming along +x from x = -rmax, bending toward +y. d0 = Z1 Z2 e^2 / Ecm is the head-on turning distance;
     b the impact parameter (fm). Returns points [x, y] (fm), times t (fm/c) from the start, the index of closest
     approach and its distance. With rStop the orbit is cut when it first comes within rStop (the horse breaks up
     there). */
  function orbit(o) {
    const d0 = E2 * o.Z1 * o.Z2 / o.Ecm, b = Math.max(1e-6, o.b), n = o.n || 400, rmax = o.rmax || 200;
    const vinf = Math.sqrt(2 * o.Ecm / o.mu);
    const e = Math.sqrt(1 + (2 * b / d0) ** 2), p = 2 * b * b / d0;   // r = p / (e cos psi - 1)
    const psiMax = Math.acos(Math.min(1, (p / rmax + 1) / e)), psiInf = Math.acos(1 / e);
    const pts = [], t = [];
    let tt = 0, prev = null, iMin = 0, rMin = Infinity;
    for (let i = 0; i <= n; i++) {
      const psi = -psiMax + 2 * psiMax * i / n, r = p / (e * Math.cos(psi) - 1), ph = Math.PI - psiInf - psi;
      const q = [r * Math.cos(ph), r * Math.sin(ph)];
      if (prev) tt += Math.hypot(q[0] - prev[0], q[1] - prev[1]) / (vinf * Math.sqrt(Math.max(1e-6, 1 - d0 / r)));
      if (r < rMin) { rMin = r; iMin = i; }
      pts.push(q); t.push(tt); prev = q;
      if (o.rStop && r <= o.rStop) break;
    }
    return { pts, t, iMin, rMin, d0, vinf };
  }

  const API = { U, ME, HBARC, E2, ALPHA, R0B, nucMass, barrier, gamow, turning, hulthen, kin, orbit, boost, fv, mass };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.THM = API;
})(typeof window !== "undefined" ? window : globalThis);
