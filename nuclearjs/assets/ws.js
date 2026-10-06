/* ------------------------------------------------------------------ *
 * Spherical Woods-Saxon shell model: single-particle levels, radial
 * wave functions and densities for a nucleus (Z, N).
 *
 * Hamiltonian (Bohr & Mottelson, Vol. I, Eq. 2-182 and 2-183):
 *   V(r)  = V0 f(r) + Vls r0^2 (1/r) df/dr <l.s> + Vc(r)   (protons only for Vc)
 *   f(r)  = 1 / (1 + exp((r - R)/a)),  R = r0 A^(1/3)
 *   V0    = -51 + 33 (N-Z)/A MeV for neutrons, -51 - 33 (N-Z)/A for protons
 *   Vls   = -0.44 V0,  r0 = 1.27 fm,  a = 0.67 fm
 *   Vc    = uniformly charged sphere of charge Z e and radius R
 * Kinetic term hbar^2/2m with the free nucleon mass, no reduced mass,
 * no centre-of-mass correction.
 *
 * Numerics: Numerov on a uniform grid with Dirichlet walls at r = 0 and
 * r = rmax, rmax chosen from the spectrum and the wall-free level count (see need() below). Eigenvalues by bisection on the node count (Sturm: the number
 * of interior nodes of the outward solution at energy E is the number of
 * box eigenvalues below E), so no level is ever skipped. Wave functions by
 * outward plus inward integration matched at the outer turning point.
 * tests/check_ws.jl solves the same Hamiltonian independently.
 *
 * Plain script: defines window.WS in a browser, module.exports in Node.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var HBARC = 197.3269804;           // MeV fm
  var E2 = 1.439964547;              // e^2/(4 pi eps0), MeV fm
  var MASS = { n: 939.5654205, p: 938.2720882 };
  var LNAME = 'spdfghijklmnoqrt';    // nuclear usage keeps j (209Pb has a 1j15/2 level)

  function defaults(Z, N) {
    var A = Z + N, I = (N - Z) / A;
    return {
      r0: 1.27, a: 0.67, rc: 1.27,
      V0n: -51 + 33 * I, V0p: -51 - 33 * I,
      kls: 0.44,                     // Vls = -kls * V0
      h: 0.02, rpad: 22,             // grid step and minimum box beyond R, fm
      boxk: 12, rpadMax: 400         // adaptive box: rmax >= R + boxk/kappa, capped at R + rpadMax
    };
  }

  // central + Coulomb part, without centrifugal and spin-orbit
  function potentials(Z, N, P) {
    var A = Z + N, R = P.r0 * Math.cbrt(A), Rc = P.rc * Math.cbrt(A);
    var h = P.h, rmax = R + P.rpad, n = Math.round(rmax / h);
    var r = new Float64Array(n + 1), f = new Float64Array(n + 1), dfr = new Float64Array(n + 1), vc = new Float64Array(n + 1);
    for (var i = 0; i <= n; i++) {
      var x = i * h; r[i] = x;
      var e = Math.exp((x - R) / P.a);
      f[i] = 1 / (1 + e);
      dfr[i] = i === 0 ? 0 : -e / (P.a * (1 + e) * (1 + e)) / x;   // (1/r) df/dr
      vc[i] = x < Rc ? Z * E2 / (2 * Rc) * (3 - (x * x) / (Rc * Rc)) : Z * E2 / x;
    }
    return { r: r, f: f, dfr: dfr, vc: vc, n: n, h: h, R: R, Rc: Rc, A: A };
  }

  // U(r) = V(r) for one (q, l, j), the local potential seen by the radial equation (MeV)
  function channelPotential(G, P, q, l, j) {
    var V0 = q === 'n' ? P.V0n : P.V0p, Vls = -P.kls * V0;
    var ls = 0.5 * (j * (j + 1) - l * (l + 1) - 0.75);
    var U = new Float64Array(G.n + 1);
    for (var i = 0; i <= G.n; i++) {
      U[i] = V0 * G.f[i] + Vls * P.r0 * P.r0 * G.dfr[i] * ls + (q === 'p' ? G.vc[i] : 0);
    }
    return U;
  }

  // k2(r) = (E - U)/C - l(l+1)/r^2, so u'' = -k2 u
  function k2arr(G, U, l, E, C, out) {
    var ll = l * (l + 1);
    out[0] = 0;
    for (var i = 1; i <= G.n; i++) out[i] = (E - U[i]) / C - ll / (G.r[i] * G.r[i]);
    return out;
  }

  /* First grid point of the outward integration. Numerov's 1 + h^2 k2/12 turns negative
     where l(l+1)/(12 i^2) > 1, so for l >= 3 starting at r = h corrupts the solution.
     Start at i0 with l(l+1)/(12 i0^2) < 0.1, seeding two points with the regular r^(l+1). */
  function start(l) { return Math.max(1, Math.ceil(Math.sqrt(l * (l + 1) / 1.2))); }

  // number of sign changes of the outward Numerov solution on (0, rmax); tail, if given, receives u(r_{n-1}), u(r_n)
  function nodes(G, U, l, E, C, k2, tail) {
    k2arr(G, U, l, E, C, k2);
    var h2 = G.h * G.h / 12, n = G.n, i0 = start(l);
    var u0 = Math.pow((i0 - 1) * G.h, l + 1), u1 = Math.pow(i0 * G.h, l + 1), cnt = 0;
    for (var i = i0; i < n; i++) {
      var u2 = (2 * u1 * (1 - 5 * h2 * k2[i]) - u0 * (1 + h2 * k2[i - 1])) / (1 + h2 * k2[i + 1]);
      if ((u2 < 0 && u1 > 0) || (u2 > 0 && u1 < 0)) cnt++;
      else if (u2 === 0 && i + 1 < n) cnt++;
      u0 = u1; u1 = u2;
      if (Math.abs(u1) > 1e200) { u0 *= 1e-200; u1 *= 1e-200; }
    }
    if (tail) { tail[0] = u0; tail[1] = u1; }
    return cnt;
  }

  /* Number of levels bound in the isolated nucleus (no wall), from the zero-energy solution.
     Sturm: the bound levels of the half-line are the nodes of the E = 0 solution on (0, infinity).
     Inside the box they are counted directly. Beyond rmax the nuclear potential is negligible and
     the E = 0 equation is u'' = q u, q = l(l+1)/r^2 + beta/r (beta = Z e^2/C for protons, 0 for
     neutrons), with a decaying solution d (r^-l for neutrons) and a growing one g, g/d increasing.
     Writing u = a g + b d, u has one more zero beyond rmax iff sign(a) differs from sign(u(rmax)),
     and sign(a) = sign(u_n d_{n-1} - u_{n-1} d_n). The ratio d_{n-1}/d_n comes from the Riccati
     equation y' = q - y^2 for y = d'/d, integrated inward (stable for the decaying branch) from
     r = 20 rmax with the WKB start y = -sqrt(q) - q'/(4q). So a level that the wall has pushed
     above zero is still counted, whatever the initial box. */
  function ratioDecay(l, beta, r0, r1) {           // d(r0)/d(r1), r0 < r1
    if (beta === 0) return Math.pow(r0 / r1, -l);
    var ll = l * (l + 1);
    function q(r) { return ll / (r * r) + beta / r; }
    function f(r, y) { return q(r) - y * y; }
    var r = 20 * r1, Q = q(r), dq = -2 * ll / (r * r * r) - beta / (r * r);
    var y = -Math.sqrt(Q) - dq / (4 * Q), nst = 4000, hs = (r - r1) / nst;
    for (var i = 0; i < nst; i++) {                // RK4 inward, uniform in r
      var k1 = f(r, y), k2 = f(r - hs / 2, y - hs / 2 * k1), k3 = f(r - hs / 2, y - hs / 2 * k2), k4 = f(r - hs, y - hs * k3);
      y -= hs / 6 * (k1 + 2 * k2 + 2 * k3 + k4); r -= hs;
    }
    var y1 = y, hh = r1 - r0;                      // one more RK4 step to r0
    var a1 = f(r1, y1), a2 = f(r1 - hh / 2, y1 - hh / 2 * a1), a3 = f(r1 - hh / 2, y1 - hh / 2 * a2), a4 = f(r0, y1 - hh * a3);
    var y0 = y1 - hh / 6 * (a1 + 2 * a2 + 2 * a3 + a4);
    return Math.exp(-0.5 * hh * (y0 + y1));        // ln d(r1) - ln d(r0) = int y dr
  }
  function boundCount(G, U, l, C, q, Z, k2) {
    var tail = [0, 0], nb = nodes(G, U, l, 0, C, k2, tail);
    var beta = q === 'p' ? Z * E2 / C : 0;
    var rho = ratioDecay(l, beta, G.r[G.n - 1], G.r[G.n]);
    var un = tail[1], um = tail[0], sa = un * rho - um;  // sign(a), d_n = 1
    return { box: nb, free: nb + (un !== 0 && sa !== 0 && (sa > 0) !== (un > 0) ? 1 : 0) };
  }

  // the k-th box eigenvalue (k = 0, 1, ...) inside [lo, hi], by node-count bisection
  function eigen(G, U, l, C, k, lo, hi, k2) {
    for (var it = 0; it < 200 && hi - lo > 1e-11; it++) {
      var mid = 0.5 * (lo + hi);
      if (nodes(G, U, l, mid, C, k2) > k) hi = mid; else lo = mid;
    }
    return 0.5 * (lo + hi);
  }

  // normalized u(r) at eigenvalue E: outward and inward Numerov joined at the outer turning point
  function wave(G, U, l, E, C) {
    var n = G.n, h2 = G.h * G.h / 12, k2 = k2arr(G, U, l, E, C, new Float64Array(n + 1));
    var m = n - 1;
    while (m > 2 && k2[m] < 0) m--;          // outer classical turning point
    m = Math.min(n - 2, m + 2);
    var out = new Float64Array(n + 1), inn = new Float64Array(n + 1), i;
    var i0 = start(l);
    for (i = 1; i <= i0; i++) out[i] = Math.pow(i * G.h, l + 1);
    for (i = i0; i <= m; i++) {
      out[i + 1] = (2 * out[i] * (1 - 5 * h2 * k2[i]) - out[i - 1] * (1 + h2 * k2[i - 1])) / (1 + h2 * k2[i + 1]);
      if (Math.abs(out[i + 1]) > 1e150) for (var s = 0; s <= i + 1; s++) out[s] *= 1e-150;
    }
    inn[n] = 0; inn[n - 1] = 1e-30;
    for (i = n - 1; i > m; i--) {
      inn[i - 1] = (2 * inn[i] * (1 - 5 * h2 * k2[i]) - inn[i + 1] * (1 + h2 * k2[i + 1])) / (1 + h2 * k2[i - 1]);
      if (Math.abs(inn[i - 1]) > 1e150) for (var t = i - 1; t <= n; t++) inn[t] *= 1e-150;
    }
    var sc = out[m] / inn[m], u = new Float64Array(n + 1), norm = 0;
    for (i = 0; i <= n; i++) u[i] = i <= m ? out[i] : inn[i] * sc;
    for (i = 0; i <= n; i++) norm += u[i] * u[i];      // trapezoid, end points are zero
    norm = Math.sqrt(norm * G.h);
    var lastSign = 0;
    for (i = 1; i < n; i++) { if (Math.abs(u[i]) > 1e-8 * norm) { lastSign = Math.sign(u[i]); break; } }
    for (i = 0; i <= n; i++) u[i] /= norm * (lastSign || 1);   // positive near the origin
    return u;
  }

  function label(nr, l, j2) { return (nr + 1) + LNAME[l] + j2 + '/2'; }

  // all bound levels of species q, sorted by energy
  function levels(G, P, q, Z, opt) {
    var C = HBARC * HBARC / (2 * MASS[q]);
    var V0 = q === 'n' ? P.V0n : P.V0p, list = [], k2 = new Float64Array(G.n + 1);
    list.missing = 0;                              // levels bound without the wall but not in this box
    var lmax = opt && opt.lmax != null ? opt.lmax : 14;
    for (var l = 0; l <= lmax; l++) {
      for (var s = (l === 0 ? 1 : -1); s <= 1; s += 2) {
        var j2 = 2 * l + s, j = j2 / 2;
        var U = channelPotential(G, P, q, l, j);
        var umin = Infinity;
        for (var i = 1; i <= G.n; i++) umin = Math.min(umin, U[i] + C * l * (l + 1) / (G.r[i] * G.r[i]));
        var top = 0, bc = boundCount(G, U, l, C, q, Z, k2), nb = bc.box;
        list.missing += bc.free - bc.box;
        for (var k = 0; k < nb; k++) {
          var E = eigen(G, U, l, C, k, umin - 1, top, k2);
          list.push({ q: q, n: k, l: l, j2: j2, E: E, name: label(k, l, j2), U: U, C: C });
        }
      }
    }
    var miss = list.missing;
    list.sort(function (x, y) { return x.E - y.E; });
    list.missing = miss;
    return list;
  }

  // fill lowest levels; returns occupations and the number left over (unbound)
  function fill(list, count) {
    var left = count;
    for (var i = 0; i < list.length; i++) {
      var o = Math.min(list[i].j2 + 1, left);
      list[i].occ = o; left -= o;
    }
    return left;
  }

  /* Box size. A Dirichlet wall at rmax pushes a bound level up and squeezes its tail, which matters
     only for weakly bound levels: with a fixed 22 fm box the 41Mg neutron 2p3/2 sat at -0.0751 MeV
     with rms 8.20 fm, against -0.0843 MeV and 9.94 fm in an isolated nucleus. So the box is chosen
     from the spectrum: rmax >= R + boxk/kappa for every bound level, kappa = sqrt(-E 2m)/hbar
     (the tail beyond carries a fraction ~exp(-2 boxk) of the norm). Solve once in the minimum box,
     enlarge it if a level needs more, solve again (an enlarged box can only add levels closer to
     threshold, so the sizing is repeated). The kappa rule alone cannot see a level that the first
     wall has already pushed above zero (13Be with depth x1.04: the 2s1/2 at -0.0273 MeV vanished in
     a 26 fm box), so every (l, j) also counts its wall-free bound levels from the zero-energy
     solution (boundCount); while that count exceeds the box count the box is doubled. The box is
     capped at R + rpadMax; a level whose tail does not fit is flagged boxLimited and its radius is a
     lower bound, and a level still missing at the cap adds to res.boxLimited. An explicit rpad in
     the overrides fixes the box (missing levels are still reported in species[q].missing). */
  function need(res) {
    var r = 0;
    ['n', 'p'].forEach(function (q) {
      var L = res.species[q].levels;
      for (var i = 0; i < L.length; i++) r = Math.max(r, res.P.boxk / Math.sqrt(-L[i].E / L[i].C));
    });
    return r;
  }
  function solve(Z, N, overrides) {
    var P = defaults(Z, N), fixed = !!(overrides && overrides.rpad != null);
    if (overrides) for (var key in overrides) if (overrides[key] != null) P[key] = overrides[key];
    var res = solveBox(Z, N, P);
    for (var pass = 0; pass < 8 && !fixed; pass++) {
      var want = Math.ceil(need(res));
      if (res.species.n.missing + res.species.p.missing > 0) want = Math.max(want, 2 * P.rpad);
      want = Math.min(P.rpadMax, want);
      if (want <= P.rpad) break;
      P = Object.assign({}, P, { rpad: want });
      res = solveBox(Z, N, P);
    }
    var limited = res.species.n.missing + res.species.p.missing;   // bound but not resolved even at rpadMax
    ['n', 'p'].forEach(function (q) {
      res.species[q].levels.forEach(function (lv) {
        lv.boxLimited = res.P.boxk / Math.sqrt(-lv.E / lv.C) > res.P.rpad + 1e-9;
        if (lv.boxLimited) limited++;
      });
    });
    res.boxLimited = limited;
    return res;
  }
  function solveBox(Z, N, P) {
    var G = potentials(Z, N, P);
    var res = { Z: Z, N: N, A: Z + N, P: P, G: G, species: {} };
    [['n', N], ['p', Z]].forEach(function (pair) {
      var q = pair[0], cnt = pair[1];
      var L = levels(G, P, q, Z);
      var unbound = fill(L, cnt);
      var rho = new Float64Array(G.n + 1);
      for (var i = 0; i < L.length; i++) {
        var lv = L[i];
        lv.u = wave(G, lv.U, lv.l, lv.E, lv.C);
        var rs = 0;
        for (var g = 1; g <= G.n; g++) rs += lv.u[g] * lv.u[g] * G.r[g] * G.r[g];
        lv.rms = Math.sqrt(rs * G.h);
        if (lv.occ > 0) for (g = 1; g <= G.n; g++) rho[g] += lv.occ * lv.u[g] * lv.u[g] / (4 * Math.PI * G.r[g] * G.r[g]);
      }
      rho[0] = rho[1];
      var num = 0, r2 = 0;
      for (g = 1; g <= G.n; g++) { var w = 4 * Math.PI * G.r[g] * G.r[g] * rho[g]; num += w; r2 += w * G.r[g] * G.r[g]; }
      num *= G.h; r2 *= G.h;
      res.species[q] = { levels: L, missing: L.missing, unbound: unbound, rho: rho, count: num, rms: num > 0 ? Math.sqrt(r2 / num) : 0 };
    });
    return res;
  }

  /* Angular density of |nljm>, summed over spin, normalized on the sphere:
     A(cos t) = sum_ms |<l m-ms 1/2 ms | j m>|^2 |Y_{l,m-ms}|^2 */
  function ylm2(l, m, x) {
    m = Math.abs(m);
    if (m > l) return 0;
    // associated Legendre P_l^m(x) by upward recursion
    var pmm = 1, s = Math.sqrt(Math.max(0, 1 - x * x)), fact = 1;
    for (var i = 1; i <= m; i++) { pmm *= -fact * s; fact += 2; }
    var p = pmm;
    if (l > m) {
      var pm1 = x * (2 * m + 1) * pmm;
      if (l === m + 1) p = pm1;
      else {
        var pll = 0;
        for (var ll = m + 2; ll <= l; ll++) {
          pll = (x * (2 * ll - 1) * pm1 - (ll + m - 1) * pmm) / (ll - m);
          pmm = pm1; pm1 = pll;
        }
        p = pll;
      }
    }
    var ratio = 1;                                   // (l-m)!/(l+m)!
    for (var k = l - m + 1; k <= l + m; k++) ratio /= k;
    return (2 * l + 1) / (4 * Math.PI) * ratio * p * p;
  }
  function angular(l, j2, m2, x) {                   // m2 = 2m
    var m = m2 / 2, d = 2 * l + 1, up, dn;
    if (j2 === 2 * l + 1) { up = (l + m + 0.5) / d; dn = (l - m + 0.5) / d; }
    else { up = (l - m + 0.5) / d; dn = (l + m + 0.5) / d; }
    return up * ylm2(l, m - 0.5, x) + dn * ylm2(l, m + 0.5, x);
  }

  /* Separation energies. With AME (rows [Z, N, mass excess keV, sigma, estimated, ...], the AME2020
     table in assets/shells-data.js) they come from full-precision mass excesses:
       S_n(Z,N) = Delta(Z,N-1) + Delta_n - Delta(Z,N),  S_p(Z,N) = Delta(Z-1,N) + Delta_H - Delta(Z,N).
     Without it they fall back to the NUBASE B/A, which is rounded twice (to 4 decimals, and the
     mass excess itself to its uncertainty), so S can be off by up to ~30 keV (209Pb: 20 keV). */
  function massTable(NUC, AME) {
    if (AME && AME.length) {
      var M = {};
      for (var k = 0; k < AME.length; k++) { var e = AME[k]; M[e[0] + ',' + e[1]] = { D: e[2] / 1000, est: !!e[4] }; }
      var Dn = M['0,1'] ? M['0,1'].D : 8.07131806, DH = M['1,0'] ? M['1,0'].D : 7.288971064;
      function sepA(Z, N, dz, dn) {
        var a = M[Z + ',' + N], b = M[(Z - dz) + ',' + (N - dn)];
        if (!a || !b) return null;
        return { S: b.D + (dn ? Dn : DH) - a.D, est: a.est || b.est };
      }
      return {
        source: 'AME2020',
        Sn: function (Z, N) { return sepA(Z, N, 0, 1); },
        Sp: function (Z, N) { return sepA(Z, N, 1, 0); }
      };
    }
    var B = { '0,1': { B: 0, est: false }, '1,0': { B: 0, est: false } };
    for (var i = 0; i < NUC.length; i++) {
      var r = NUC[i];
      if (r[5] != null) B[r[0] + ',' + r[1]] = { B: r[5] * (r[0] + r[1]), est: !!r[6] };
    }
    function sep(Z, N, dz, dn) {
      var a = B[Z + ',' + N], b = B[(Z - dz) + ',' + (N - dn)];
      if (!a || !b) return null;
      return { S: a.B - b.B, est: a.est || b.est };
    }
    return {
      source: 'NUBASE2020 B/A',
      Sn: function (Z, N) { return sep(Z, N, 0, 1); },
      Sp: function (Z, N) { return sep(Z, N, 1, 0); }
    };
  }

  var WS = { solve: solve, defaults: defaults, angular: angular, ylm2: ylm2, massTable: massTable, LNAME: LNAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = WS; else root.WS = WS;
})(this);
