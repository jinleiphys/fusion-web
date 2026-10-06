/* The few closed formulas of holygrail.html, alpha + 12C. Plain script, defines window.GRAIL.
   Everything else on the page is published data (assets/holygrail-data.js and the level list below).

     GRAIL.init(AME)        AME2020 mass excesses (assets/shells-data.js)
     GRAIL.Q()              Q = Delta(4He) + Delta(12C) - Delta(16O), MeV: the alpha threshold in 16O
     GRAIL.mu()             reduced mass in u, from the atomic masses A u + Delta
     GRAIL.gamow(T9)        { E0, dE } MeV, deBoer et al. RMP 89, 035007 (2017) Eqs. (4), (5):
                              E0 = 0.122 (Z1^2 Z2^2 mu T9^2)^(1/3), dE = 0.236 (Z1^2 Z2^2 mu T9^5)^(1/6)
     GRAIL.barrier()        { V, R } touching spheres R = 1.2 (A1^(1/3) + A2^(1/3)) fm, V = Z1 Z2 e^2 / R
     GRAIL.eta(E)           Sommerfeld parameter Z1 Z2 alpha sqrt(mu c^2 / 2E)
     GRAIL.rTurn(E)         classical turning point Z1 Z2 e^2 / E, fm
     GRAIL.sigma(S, E)      sigma = S / E exp(-2 pi eta), barn for S in MeV b and E in MeV
*/
(function () {
  "use strict";
  const U = 931.49410242, E2 = 1.43996448, ALPHA = 1 / 137.035999084; // MeV/u, MeV fm, CODATA 2018
  const Z1 = 2, A1 = 4, Z2 = 6, A2 = 12;
  let D = null;
  const G = {};
  G.init = function (AME) {
    const dm = (Z, N) => { const r = AME.find((x) => x[0] === Z && x[1] === N); return r[2] / 1000; }; // MeV
    D = { a: dm(2, 2), c: dm(6, 6), o: dm(8, 8) };
  };
  G.Q = () => D.a + D.c - D.o;
  G.mu = function () {
    const ma = A1 + D.a / U, mc = A2 + D.c / U;
    return ma * mc / (ma + mc);
  };
  G.gamow = function (T9) {
    const k = Z1 * Z1 * Z2 * Z2 * G.mu();
    return { E0: 0.122 * Math.cbrt(k * T9 * T9), dE: 0.236 * Math.pow(k * Math.pow(T9, 5), 1 / 6) };
  };
  G.barrier = function () { const R = 1.2 * (Math.cbrt(A1) + Math.cbrt(A2)); return { R, V: Z1 * Z2 * E2 / R }; };
  G.eta = (E) => Z1 * Z2 * ALPHA * Math.sqrt(G.mu() * U / (2 * E));
  G.rTurn = (E) => Z1 * Z2 * E2 / E;
  G.sigma = (S, E) => S / E * Math.exp(-2 * Math.PI * G.eta(E));
  window.GRAIL = G;
})();
