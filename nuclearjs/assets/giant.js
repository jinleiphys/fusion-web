/* nuclearjs: the simple formulas of giant.html (giant resonances). Plain script, also require-able from Node
   (tests/check_giant.js). Energies in MeV, cross sections in mb. Every constant comes in through the data object D
   (assets/giant-data.js), read by scripts/build_giant_data.py from the saved sources; none is typed here.
   - standard Lorentzian (SLO) of Plujko et al., At. Data Nucl. Data Tables 123-124, 1 (2018), Eqs. (5), (6), (10):
       sigma_GDR(e) = sigma_TRK sum_j s_j F_j(e),  F_j(e) = (2/pi) e^2 G_j / ((e^2 - E_j^2)^2 + (e G_j)^2),
       sigma_TRK = 60 NZ/A mb MeV; the integral of F over 0..inf is 1, so s = s_1 + s_2 is the strength in TRK units,
       and the peak value is (2/pi) sigma_TRK s_j / G_j
   - quasi-deuteron term, their Eqs. (3), (4): 397.8 (NZ/A) (e - 2.224)^(3/2) / e^3 phi(e), phi piecewise
   - the TRK sum from the constants: integral sigma_E1 dE = (2 pi^2 e^2 hbar / (m c)) NZ/A = 2 pi^2 alpha (hbar c)^2/(m c^2)
       NZ/A (Gaussian units, e^2 = alpha hbar c), 1 fm^2 = 10 mb; m is the nucleon mass, whose convention moves the third digit
   - GDR energy systematics (RIPL-4, Plujko, Gorbachenko, Solodovnyk): E = e1 (4NZ/A^2)^(1/2) A^(-1/3) / (1 + e2 A^(-1/3))^(1/2);
       E_BF = 31.2 A^(-1/3) + 20.6 A^(-1/6) and E_SJ = 81 A^(-1/3) (Ait Ben Mennana et al., Phys. Scr. 95, 065301 (2020))
   - axially deformed nuclei, hydrodynamic ratio (Danos 1958, as written in the RIPL-4 readme): E_b/E_a = 0.911 a/b + 0.089,
       a (b) the semi-axis along (perpendicular to) the symmetry axis, a/b = (1 + alpha2)/(1 - alpha2/2), E = (E_a + 2 E_b)/3
   - ISGMR: E = sqrt(hbar^2 K_A / (m <r^2>)) with <r^2> per nucleon (Garg and Colo, Prog. Part. Nucl. Phys. 101, 55 (2018),
       their E_ISGMR(K_A) relation, whose <r^2>_0 is the ground-state value of sum_i r_i^2), so K_A = m c^2 <r^2> E^2 / (hbar c)^2
   - Steinwedel-Jensen: the isovector density goes as j1(k r) cos(theta) with no flow through the surface, j1'(k R) = 0. */
(function (root) {
  "use strict";
  const PI = Math.PI;
  const G = {
    // Lorentzian shape, integrates to 1 over e from 0 to infinity
    F(e, E, W) { const e2 = e * e, d = e2 - E * E; return (2 / PI) * e2 * W / (d * d + e2 * W * W); },
    trk(Z, A, c) { return c * (A - Z) * Z / A; },                                    // mb MeV
    // sigma_GDR from a fit {E1, G1, S1, E2, G2, S2}: one or two components
    gdr(e, Z, A, fit, c, which) {
      const t = G.trk(Z, A, c);
      let s = 0;
      if (which !== 2 && fit.E1) s += t * fit.S1 * G.F(e, fit.E1, fit.G1);
      if (which !== 1 && fit.E2) s += t * fit.S2 * G.F(e, fit.E2, fit.G2);
      return s;
    },
    peak(Z, A, S, W, c) { return (2 / PI) * G.trk(Z, A, c) * S / W; },
    phi(e, Q) {
      if (e < Q.lo[0]) return Math.exp(-Q.lo[1] / e);
      if (e > Q.hi[0]) return Math.exp(-Q.hi[1] / e);
      let p = 0, x = 1;
      for (const c of Q.poly) { p += c * x; x *= e; }
      return p;
    },
    qd(e, Z, A, Q) { return e <= Q.Ed ? 0 : Q.c * (A - Z) * Z / A * Math.pow(e - Q.Ed, 1.5) / (e * e * e) * G.phi(e, Q); },
    // TRK constant in mb MeV (the factor multiplying NZ/A), for a nucleon mass m (MeV)
    trkConst(cd, m) { return 2 * PI * PI * cd.alpha * cd.hbarc * cd.hbarc / m * 10; },
    // trapezoid over the measured points (sorted by energy), optionally restricted to [lo, hi] with linear interpolation at the ends
    trapz(pts, lo, hi) {
      if (lo == null) lo = -Infinity; if (hi == null) hi = Infinity;
      let s = 0;
      for (let i = 1; i < pts.length; i++) {
        let x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1];
        if (x1 <= lo || x0 >= hi || x1 === x0) continue;
        if (x0 < lo) { y0 = y0 + (y1 - y0) * (lo - x0) / (x1 - x0); x0 = lo; }
        if (x1 > hi) { y1 = y0 + (y1 - y0) * (hi - x0) / (x1 - x0); x1 = hi; }
        s += 0.5 * (y0 + y1) * (x1 - x0);
      }
      return s;
    },
    // running integral of the measured points: [[E, integral from the first point to E], ...]
    running(pts) { const out = [[pts[0][0], 0]]; let s = 0; for (let i = 1; i < pts.length; i++) { s += 0.5 * (pts[i][1] + pts[i - 1][1]) * (pts[i][0] - pts[i - 1][0]); out.push([pts[i][0], s]); } return out; },
    // Simpson integral of a function on [a, b] with n (even) intervals
    simpson(f, a, b, n) { n = n || 4000; const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; },
    sysE(Z, A, P) { const N = A - Z, a3 = Math.pow(A, -1 / 3); return P.e1 * Math.sqrt(4 * N * Z / (A * A)) * a3 / Math.sqrt(1 + P.e2 * a3); },
    bf(A, c) { return c[0] * Math.pow(A, -1 / 3) + c[1] * Math.pow(A, -1 / 6); },
    sj(A, c) { return c * Math.pow(A, -1 / 3); },
    avgE(f) { return f.E2 ? (f.E1 * f.S1 + f.E2 * f.S2) / (f.S1 + f.S2) : f.E1; },
    // Danos ratio D = E_b/E_a for an axis ratio a/b, and back
    danos(ab, d) { return d[0] * ab + d[1]; },
    abFromRatio(D, d) { return (D - d[1]) / d[0]; },
    alpha2FromAb(ab) { return (ab - 1) / (1 + ab / 2); },
    abFromAlpha2(a2) { return (1 + a2) / (1 - a2 / 2); },
    // the two systematic energies (E_a along the axis, E_b perpendicular) for a mean energy E and a deformation alpha2
    sysPair(E, a2, d) { const D = G.danos(G.abFromAlpha2(a2), d), Ea = 3 * E / (1 + 2 * D); return [Ea, D * Ea]; },
    // axis ratio of the sharp surface R0 (1 + beta Y20): Y20 = sqrt(5/16pi)(3cos^2 - 1) is sqrt(5/4pi) at the pole, -sqrt(5/16pi) at the equator
    abFromBeta(b) { const y = Math.sqrt(5 / (4 * PI)); return (1 + b * y) / (1 - b * y / 2); },
    // rms point-proton radius from the rms charge radius: r_pp^2 = r_ch^2 - r_p^2 - (N/Z) <r^2>_n (r_p the proton's rms charge
    // radius, <r^2>_n the neutron's mean-square charge radius; Darwin-Foldy and spin-orbit terms left out)
    rPointProton(rch, rp, N, Z, nmsr) { return Math.sqrt(rch * rch - rp * rp - (N / Z) * nmsr); },
    // finite-nucleus incompressibility from an ISGMR energy and a rms radius r (fm); m in MeV
    kA(E, r, m, hbarc) { return m * r * r * E * E / (hbarc * hbarc); },
    // spherical Bessel j1 and its derivative; first zero of j1' (the Steinwedel-Jensen boundary condition)
    j1(x) { if (Math.abs(x) < 1e-4) return x / 3 - x * x * x / 30; return Math.sin(x) / (x * x) - Math.cos(x) / x; },
    dj1(x) { if (Math.abs(x) < 1e-4) return 1 / 3 - x * x / 10; return 2 * Math.cos(x) / (x * x) - 2 * Math.sin(x) / (x * x * x) + Math.sin(x) / x; },
    // gradient of Phi = j1(k r) (ca x + cb y)/r (r the position in units of the radius, k = the SJ root): the
    // Steinwedel-Jensen displacement field; its radial part k j1'(k r)(ca x + cb y)/r vanishes on r = 1
    sjGrad(x, y, z, ca, cb, k) {
      const r = Math.hypot(x, y, z);
      if (r < 1e-6) return [ca * k / 3, cb * k / 3, 0];
      const j = G.j1(k * r), dj = G.dj1(k * r) * k, d = (ca * x + cb * y) / r;
      const rad = dj * d;                                   // dPhi/dr
      return [rad * x / r + j * (ca - d * x / r) / r, rad * y / r + j * (cb - d * y / r) / r, rad * z / r - j * d * z / (r * r)];
    },
    sjRoot() {
      // bracket j1' between 1.5 and 2.5, then bisection to machine precision
      let a = 1.5, b = 2.5;
      for (let i = 0; i < 200; i++) { const m = 0.5 * (a + b); if (G.dj1(a) * G.dj1(m) <= 0) b = m; else a = m; }
      return 0.5 * (a + b);
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = G; else root.GIANT = G;
})(this);
