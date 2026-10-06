// Mass differences for shells.html: separation energies, empirical shell gaps, odd-even staggering.
// Everything here is a finite difference of AME2020 binding energies (window.AME, built by
// scripts/build_shells_data.py). Plain script, also require-able from Node (tests/check_shells.py).
//
//   B(Z,N)        = Z*Delta(1H) + N*Delta(n) - Delta(Z,N)           (atomic mass excesses, keV -> MeV)
//   S2n(Z,N)      = B(Z,N) - B(Z,N-2)                S2p(Z,N) = B(Z,N) - B(Z-2,N)
//   D2n(Z,N)      = S2n(Z,N) - S2n(Z,N+2)            D2p(Z,N) = S2p(Z,N) - S2p(Z+2,N)
//   Dn3(Z,N)      = (-1)^(N+1)/2 [B(Z,N-1) - 2B(Z,N) + B(Z,N+1)]      (three-point, Satula,
//   Dp3(Z,N)      = (-1)^(Z+1)/2 [B(Z-1,N) - 2B(Z,N) + B(Z+1,N)]       Dobaczewski, Nazarewicz 1998)
//
// Uncertainties: for Sn, Sp, S2n, S2p the AME2020 tabulated uncertainty (rct1, rct2), which carries the
// mass covariance, and AME's own # flag for that difference. For D2n, D2p and the three-point gaps, which
// AME does not tabulate, the mass uncertainties in quadrature with the finite-difference weights: this
// treats the masses as independent (for S2n the same recipe ranges from 0.09x to 47x AME's value, median
// 1.00; tests/check_shells.py). A combination is marked estimated if any mass in it is a # value.
(function (root) {
  "use strict";
  function build(AME) {
    var M = new Map();
    var dn = 0, dh = 0;
    for (var i = 0; i < AME.length; i++) {
      var r = AME[i];
      if (r[0] === 0 && r[1] === 1) dn = r[2];
      if (r[0] === 1 && r[1] === 0) dh = r[2];
    }
    for (var k = 0; k < AME.length; k++) {
      var a = AME[k], Z = a[0], N = a[1];
      M.set(Z * 1000 + N, { B: (Z * dh + N * dn - a[2]) / 1000, s: a[3] / 1000, est: !!a[4], tab: [a[5], a[6], a[7], a[8]] });
    }
    function get(Z, N) { return !Number.isInteger(Z) || !Number.isInteger(N) || Z < 0 || N < 0 || N >= 1000 ? null : M.get(Z * 1000 + N) || null; }
    // linear combination sum_i c_i B_i over a list of [c, Z, N]
    function comb(terms) {
      var v = 0, s2 = 0, est = false;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i], m = get(t[1], t[2]);
        if (!m) return null;
        v += t[0] * m.B; s2 += t[0] * t[0] * m.s * m.s; est = est || m.est;
      }
      return { v: v, s: Math.sqrt(s2), est: est };
    }
    // separation energy: value from the masses, uncertainty and # flag as AME2020 tabulates them
    function sep(k, Z, N, terms) {
      var r = comb(terms);
      if (!r) return null;
      var u = get(Z, N).tab[k];
      if (u != null) { r.s = Math.abs(u) / 1000; r.est = u < 0 || Object.is(u, -0); }
      return r;
    }
    var api = {
      has: function (Z, N) { return !!get(Z, N); },
      B: function (Z, N) { var m = get(Z, N); return m ? { v: m.B, s: m.s, est: m.est } : null; },
      Sn: function (Z, N) { return sep(2, Z, N, [[1, Z, N], [-1, Z, N - 1]]); },
      Sp: function (Z, N) { return sep(3, Z, N, [[1, Z, N], [-1, Z - 1, N]]); },
      S2n: function (Z, N) { return sep(0, Z, N, [[1, Z, N], [-1, Z, N - 2]]); },
      S2p: function (Z, N) { return sep(1, Z, N, [[1, Z, N], [-1, Z - 2, N]]); },
      D2n: function (Z, N) { return comb([[2, Z, N], [-1, Z, N - 2], [-1, Z, N + 2]]); },
      D2p: function (Z, N) { return comb([[2, Z, N], [-1, Z - 2, N], [-1, Z + 2, N]]); },
      Dn3: function (Z, N) {
        var g = N % 2 ? 0.5 : -0.5;
        return comb([[g, Z, N - 1], [-2 * g, Z, N], [g, Z, N + 1]]);
      },
      Dp3: function (Z, N) {
        var g = Z % 2 ? 0.5 : -0.5;
        return comb([[g, Z - 1, N], [-2 * g, Z, N], [g, Z + 1, N]]);
      },
      each: function (f) { M.forEach(function (m, key) { f(Math.floor(key / 1000), key % 1000, m); }); }
    };
    return api;
  }
  var SH = { build: build };
  if (typeof module !== "undefined" && module.exports) module.exports = SH; else root.SH = SH;
})(this);
