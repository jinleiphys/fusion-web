/* ------------------------------------------------------------------ *
 * Shape coexistence: the two closed formulas the page evaluates live.
 *
 * 1. Two-state mixing. Two unperturbed 0+ configurations a distance dE0 apart, coupled by V:
 *      H = [[0, V], [V, dE0]]  ->  mixed splitting dE = sqrt(dE0^2 + 4 V^2),
 *      admixture of the upper configuration in the lower state b^2 = (1 - dE0/dE)/2.
 * 2. Monopole strength between the two mixed 0+ states (Wood et al., NPA 651 (1999) 323, as written
 *    in Ojala et al., Commun. Phys. 5, 213 (2022), Eq. (3)):
 *      rho^2(E0) = (3Z/4pi)^2 a^2 b^2 (beta1^2 - beta2^2)^2,  a^2 + b^2 = 1.
 * Everything else on the page is published data.
 * ------------------------------------------------------------------ */
(function (root) {
  "use strict";
  function rho2(Z, a2, b1, b2) { var k = 3 * Z / (4 * Math.PI), d = b1 * b1 - b2 * b2; return k * k * a2 * (1 - a2) * d * d; }
  // from V and dE0
  function mixFromV(V, dE0) { var dE = Math.sqrt(dE0 * dE0 + 4 * V * V); return { b2: dE > 0 ? 0.5 * (1 - dE0 / dE) : 0.5, dE: dE }; }
  // from the measured (mixed) splitting dE and an assumed unperturbed splitting 0 <= dE0 <= dE
  function mixFromSplit(dE, dE0) { return { b2: 0.5 * (1 - dE0 / dE), V: 0.5 * Math.sqrt(Math.max(0, dE * dE - dE0 * dE0)) }; }
  // from a measured rho^2: a^2 b^2 and the smaller squared amplitude; null when E0 cannot fix it
  function mixFromRho2(Z, r2, b1, b2) {
    var k = 3 * Z / (4 * Math.PI), d = b1 * b1 - b2 * b2;
    if (!(r2 >= 0) || d === 0) return { ab: null, b2: null };
    var ab = r2 / (k * k * d * d);
    if (ab > 0.25) return { ab: ab, b2: null };
    return { ab: ab, b2: 0.5 * (1 - Math.sqrt(1 - 4 * ab)) };
  }
  var COEX = { rho2: rho2, mixFromV: mixFromV, mixFromSplit: mixFromSplit, mixFromRho2: mixFromRho2 };
  if (typeof module !== "undefined" && module.exports) module.exports = COEX; else root.COEX = COEX;
})(this);
