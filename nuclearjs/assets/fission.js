/* ------------------------------------------------------------------ *
 * Fission of a charged liquid drop: surface and Coulomb energies of
 * axially symmetric shapes, the deformation-energy landscape, the
 * fission valley and the saddle point.
 *
 * Energy (sharp surface, uniform charge, incompressible):
 *   E_def / E_S0 = (B_s - 1) + 2 x (B_c - 1),
 *   B_s = S / S_sphere,  B_c = E_C / E_C,sphere,  x = E_C0 / (2 E_S0)
 * (Ivanyuk, arXiv:1303.7473, Eqs. for E_def and x_LD; Bohr & Wheeler,
 * Phys. Rev. 56, 426 (1939), Eqs. 9-11).
 *
 * Constants: the Myers-Swiatecki liquid drop as quoted by Poenaru et al.,
 * J. Phys. G 26, L97 (2000) [nucl-th/0002008]:
 *   E_S0 = a_s (1 - kappa I^2) A^(2/3), a_s = 17.9439 MeV, kappa = 1.7826,
 *   E_C0 = a_c Z^2 A^(-1/3), a_c = 3 e^2 / (5 r0), r0 = 1.2249 fm, e^2 = 1.44 MeV fm.
 *
 * Shapes: the "funny hills" (c, h, alpha) family of Brack et al.,
 * Rev. Mod. Phys. 44, 320 (1972), in the form written by Schunck &
 * Robledo, Rep. Prog. Phys. 79, 116301 (2016) [arXiv:1511.07517]:
 *   rho^2 = R0^2 c^2 (1 - u^2) (A + alpha u + B u^2),          B >= 0
 *   rho^2 = R0^2 c^2 (1 - u^2) (A + alpha u) exp(B c^3 u^2),   B <  0
 *   u = z / c (z in units of R0), B = 2h + (c - 1)/2, A from volume.
 * Also spheroids and Bohr-Wheeler Legendre shapes r = R[1 + a0 + sum a_n P_n]
 * (for the checks). Every shape is a meridian curve (rho(t), z(t)),
 * t in [0, pi], rho = 0 at both ends.
 *
 * Surface area: S = 2 pi int rho sqrt(rho_t^2 + z_t^2) dt, Gauss-Legendre.
 *
 * Coulomb energy: from laplacian|r - r'| = 2/|r - r'| and two applications
 * of the divergence theorem, for a uniform charge density rho_e,
 *   E_C = -(rho_e^2 / 12) oint oint (n.w)(n'.w) / |w| dS dS',  w = r' - r.
 * The integrand vanishes like |w| at w -> 0, so there is no singularity.
 * The azimuthal integral is done in closed form with complete elliptic
 * integrals (arithmetic-geometric mean; power series for small m), and the
 * two meridian integrals by Gauss-Legendre, the inner one split at t' = t
 * and graded toward it, where the integrand is not smooth.
 * tests/check_fission.jl uses the other identity,
 *   E_C = -(rho_e^2 / 4) oint oint (n.n') |w| dS dS',
 * with brute-force quadrature in all three angles: an independent check.
 *
 * Plain script: defines window.FISSION in a browser, module.exports in Node.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var LD = { as: 17.9439, kappa: 1.7826, r0: 1.2249, e2: 1.44 };
  LD.ac = 3 * LD.e2 / (5 * LD.r0);

  // ---------- Gauss-Legendre nodes on [-1, 1] (Newton on P_n), cached
  var GLC = {};
  function gauleg(n) {
    if (GLC[n]) return GLC[n];
    var x = new Float64Array(n), w = new Float64Array(n);
    for (var i = 0; i < (n + 1) >> 1; i++) {
      var z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0, z1;
      do {
        var p1 = 1, p2 = 0;
        for (var j = 1; j <= n; j++) { var p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1);
        z1 = z; z = z1 - p1 / pp;
      } while (Math.abs(z - z1) > 1e-15);
      x[i] = -z; x[n - 1 - i] = z;
      w[i] = w[n - 1 - i] = 2 / ((1 - z * z) * pp * pp);
    }
    return (GLC[n] = { x: x, w: w });
  }

  // ---------- complete elliptic integrals, parameter m (K(m) = int dphi / sqrt(1 - m sin^2))
  // m1 = 1 - m, passed separately so that it keeps its digits as m -> 1
  function ellKE(m, m1) {
    if (m1 === undefined) m1 = 1 - m;
    var a = 1, b = Math.sqrt(m1), c = Math.sqrt(m), s = 0.5 * m, p = 0.5;
    for (var i = 0; i < 40 && Math.abs(c) > 1e-17 * a; i++) {
      var an = 0.5 * (a + b); c = 0.5 * (a - b); b = Math.sqrt(a * b); a = an;
      p *= 2; s += p * c * c;
    }
    var K = Math.PI / (2 * a);
    return { K: K, E: K * (1 - s) };
  }
  // L_k(m) = int_0^pi cos^{2k}(psi) / sqrt(1 - m cos^2 psi) dpsi, k = 0, 1, 2
  var DD = (function () { var d = [1]; for (var j = 1; j < 200; j++) d[j] = d[j - 1] * (2 * j - 1) / (2 * j); return d; })();
  function Lk(m, out, m1) {
    if (m < 0.5) {
      // L_k = pi sum_j d_j d_{k+j} m^j,  d_n = (2n-1)!!/(2n)!!
      var s0 = 0, s1 = 0, s2 = 0, mj = 1;
      for (var j = 0; j < 190; j++) {
        var t = DD[j] * mj;
        s0 += t * DD[j]; s1 += t * DD[j + 1]; s2 += t * DD[j + 2];
        mj *= m;
        if (mj < 1e-18) break;
      }
      out[0] = Math.PI * s0; out[1] = Math.PI * s1; out[2] = Math.PI * s2;
      return out;
    }
    if (m1 === undefined) m1 = 1 - m;
    var ke = ellKE(m, m1), K = ke.K, E = ke.E;
    var L0 = 2 * K, L1 = 2 * (K - E) / m;
    var M1 = 2 * ((2 * m - 1) * E + m1 * K) / (3 * m);   // int_0^pi cos^2 sqrt(1 - m cos^2)
    out[0] = L0; out[1] = L1; out[2] = (L1 - M1) / m;
    return out;
  }

  // ---------- shapes: meridian (rho, z) and derivatives in t, lengths in units of R0
  function spheroid(a, b) {          // semi-axis a along z, b perpendicular
    return {
      kind: 'spheroid', a: a, b: b,
      at: function (t, o) { var s = Math.sin(t), c = Math.cos(t); o.r = b * s; o.rt = b * c; o.z = -a * c; o.zt = a * s; return o; },
      zlo: -a, zhi: a
    };
  }
  // volume-conserving spheroid of given ratio q = a/b
  function spheroidQ(q) { var b = Math.pow(q, -1 / 3); return spheroid(q * b, b); }

  function legendreP(n, x) {
    var p0 = 1, p1 = x, dp = 0;
    if (n === 0) return { p: 1, d: 0 };
    for (var j = 2; j <= n; j++) { var p2 = ((2 * j - 1) * x * p1 - (j - 1) * p0) / j; p0 = p1; p1 = p2; }
    dp = Math.abs(x) < 1 ? n * (x * p1 - p0) / (x * x - 1) : 0;   // P_n' (x != +-1)
    return { p: p1, d: dp };
  }
  // Bohr-Wheeler, Eq. (8): r(theta) = R [1 + a0 + sum_n a_n P_n(cos theta)], a0 by volume conservation
  function bwShape(alphas) {          // alphas: {2: a2, 3: a3, 4: a4, ...}
    var ns = Object.keys(alphas).map(Number);
    function r0(ct) { var r = 1; for (var i = 0; i < ns.length; i++) r += alphas[ns[i]] * legendreP(ns[i], ct).p; return r; }
    function dr0(ct, st) {           // dr/dt with theta = pi - t, cos(theta) = -cos t
      var d = 0; for (var i = 0; i < ns.length; i++) d += alphas[ns[i]] * legendreP(ns[i], ct).d;
      return d * st;                  // d/dt P(-cos t) = P'(-cos t) sin t
    }
    var g = gauleg(96), V = 0;
    for (var i = 0; i < g.x.length; i++) {
      var th = 0.5 * Math.PI * (g.x[i] + 1), r = r0(Math.cos(th));
      V += g.w[i] * 0.5 * Math.PI * (2 / 3) * Math.PI * r * r * r * Math.sin(th);
    }
    var lam = Math.cbrt((4 * Math.PI / 3) / V);
    return {
      kind: 'bw', a0: lam - 1, lam: lam,
      at: function (t, o) {
        var s = Math.sin(t), c = Math.cos(t), ct = -c;
        var r = lam * r0(ct), rt = lam * dr0(ct, s);
        o.r = r * s; o.rt = rt * s + r * c; o.z = -r * c; o.zt = -rt * c + r * s; return o;
      }
    };
  }

  // funny hills; returns null when rho^2 < 0 somewhere (shape does not exist)
  function funnyHills(c, h, alpha) {
    alpha = alpha || 0;
    var B = 2 * h + (c - 1) / 2, A, k = 0, expo = B < 0;
    if (!expo) A = 1 / (c * c * c) - B / 5;
    else {
      k = B * c * c * c;
      var g = gauleg(64), I = 0;
      for (var i = 0; i < g.x.length; i++) { var u = g.x[i]; I += g.w[i] * (1 - u * u) * Math.exp(k * u * u); }
      A = 4 / (3 * c * c * c * I);
    }
    function gg(u) { return expo ? (A + alpha * u) * Math.exp(k * u * u) : A + alpha * u + B * u * u; }
    function gp(u) { return expo ? (alpha + 2 * k * u * (A + alpha * u)) * Math.exp(k * u * u) : alpha + 2 * B * u; }
    // existence: g > 0 on (-1, 1)
    var gmin = Infinity, umin = 0;
    for (var j = 0; j <= 400; j++) { var uu = -1 + j / 200, v = gg(uu); if (v < gmin) { gmin = v; umin = uu; } }
    // neck: interior minimum of rho between two maxima (rho^2 = c^2 (1-u^2) g)
    var prof = [], neck = null;
    for (j = 0; j <= 400; j++) { var u2 = -1 + j / 200; prof.push(c * c * (1 - u2 * u2) * gg(u2)); }
    for (j = 1; j < 400; j++) if (prof[j] < prof[j - 1] && prof[j] <= prof[j + 1]) {
      var lmax = Math.max.apply(null, prof.slice(0, j)), rmax = Math.max.apply(null, prof.slice(j));
      if (lmax > prof[j] && rmax > prof[j]) { neck = { z: c * (-1 + j / 200), r: Math.sqrt(Math.max(0, prof[j])) }; break; }
    }
    return {
      kind: 'fh', c: c, h: h, alpha: alpha, A: A, B: B, valid: gmin > 0, gmin: gmin, neck: neck,
      rho2: function (z) { var u = z / c; return Math.abs(u) >= 1 ? 0 : c * c * (1 - u * u) * gg(u); },
      at: function (t, o) {
        var s = Math.sin(t), cs = Math.cos(t), u = -cs, g0 = Math.max(gg(u), 1e-300), sg = Math.sqrt(g0);
        o.r = c * s * sg;
        o.rt = c * (cs * sg + s * s * gp(u) / (2 * sg));
        o.z = c * u; o.zt = c * s; return o;
      },
      zlo: -c, zhi: c
    };
  }

  // ---------- integrals
  var Q = { n1: 96, n2: 48, grade: 2, ns: 320 };
  function volume(sh, n) {
    var g = gauleg(n || Q.ns), o = {}, V = 0;
    for (var i = 0; i < g.x.length; i++) {
      var t = 0.5 * Math.PI * (g.x[i] + 1); sh.at(t, o);
      V += g.w[i] * Math.PI * o.r * o.r * o.zt;
    }
    return 0.5 * Math.PI * V;
  }
  function area(sh, n) {
    var g = gauleg(n || Q.ns), o = {}, S = 0;
    for (var i = 0; i < g.x.length; i++) {
      var t = 0.5 * Math.PI * (g.x[i] + 1); sh.at(t, o);
      S += g.w[i] * 2 * Math.PI * o.r * Math.sqrt(o.rt * o.rt + o.zt * o.zt);
    }
    return 0.5 * Math.PI * S;
  }
  // J = oint oint (n.w)(n'.w)/|w| dS dS'  (per unit R0^5); E_C = -(rho_e^2/12) J
  function coulombJ(sh, n1, n2, grade) {
    n1 = n1 || Q.n1; n2 = n2 || Q.n2; grade = grade || Q.grade;
    var g1 = gauleg(n1), g2 = gauleg(n2), a = {}, b = {}, L = [0, 0, 0], J = 0;
    for (var i = 0; i < n1; i++) {
      var t1 = 0.5 * Math.PI * (g1.x[i] + 1), w1 = 0.5 * Math.PI * g1.w[i];
      sh.at(t1, a);
      var r1 = a.r, Z1 = a.zt, P1 = a.rt, z1 = a.z, inner = 0;
      for (var side = 0; side < 2; side++) {
        var len = side ? Math.PI - t1 : t1, sgn = side ? 1 : -1;
        for (var k = 0; k < n2; k++) {
          var s = 0.5 * (g2.x[k] + 1), sq = Math.pow(s, grade - 1);
          var t2 = t1 + sgn * len * sq * s, dt = 0.5 * g2.w[k] * len * grade * sq;
          sh.at(t2, b);
          var r2 = b.r, Z2 = b.zt, P2 = b.rt, D = b.z - z1;
          var PP = r1 * r1 + r2 * r2 + D * D, QQ = 2 * r1 * r2, sP = Math.sqrt(PP + QQ), m = 2 * QQ / (PP + QQ);
          var dr = r1 - r2, m1 = (dr * dr + D * D) / (PP + QQ);
          if (m1 < 1e-300) continue;                 // coincident points: the integrand vanishes there
          Lk(m, L, m1);
          var I0 = 2 * L[0] / sP, I1 = 2 * (2 * L[1] - L[0]) / sP, I2 = 2 * (4 * L[2] - 4 * L[1] + L[0]) / sP;
          var A1 = -Z1 * r1 - P1 * D, B1 = Z1 * r2, A2 = Z2 * r2 - P2 * D, B2 = -Z2 * r1;
          inner += dt * r2 * (A1 * A2 * I0 + (A1 * B2 + A2 * B1) * I1 + B1 * B2 * I2);
        }
      }
      J += w1 * r1 * inner;
    }
    return 2 * Math.PI * J;
  }
  // sphere of radius 1, unit volume density: E_C0 = (16 pi^2 / 15) rho_e^2 ; B_c = -(1/12) J / (16 pi^2/15)
  function Bc(sh, n1, n2, grade) { return -coulombJ(sh, n1, n2, grade) * 15 / (12 * 16 * Math.PI * Math.PI); }
  function Bs(sh, n) { return area(sh, n) / (4 * Math.PI); }

  // closed forms for a volume-conserving spheroid, eccentricity e
  function spheroidExact(q) {
    var o = {};
    if (Math.abs(q - 1) < 1e-14) return { Bs: 1, Bc: 1 };
    var b = Math.pow(q, -1 / 3), a = q * b, e;
    if (q > 1) {
      e = Math.sqrt(1 - 1 / (q * q));
      o.Bs = (2 * Math.PI * b * b * (1 + q * Math.asin(e) / e)) / (4 * Math.PI);
      o.Bc = Math.pow(1 - e * e, 1 / 3) / (2 * e) * Math.log((1 + e) / (1 - e));
    } else {
      e = Math.sqrt(1 - q * q);
      o.Bs = (2 * Math.PI * b * b * (1 + (q * q / e) * Math.atanh(e))) / (4 * Math.PI);
      o.Bc = Math.pow(1 - e * e, 1 / 6) / e * Math.asin(e);   // a = q b, b = (1 - e^2)^(-1/6)
    }
    return o;
  }

  // ---------- nucleus
  function drop(Z, A) {
    var I = (A - 2 * Z) / A, ES0 = LD.as * (1 - LD.kappa * I * I) * Math.pow(A, 2 / 3), EC0 = LD.ac * Z * Z / Math.cbrt(A);
    return { Z: Z, A: A, I: I, ES0: ES0, EC0: EC0, x: EC0 / (2 * ES0), zza: Z * Z / A, zzaCrit: 2 * LD.as * (1 - LD.kappa * I * I) / LD.ac, R0: LD.r0 * Math.cbrt(A) };
  }

  // ---------- B_s, B_c of a funny-hills shape (cached), reduced energy at fissility x
  var cache = new Map();
  function shapeB(c, h, alpha) {
    var key = c.toFixed(9) + ',' + h.toFixed(9) + ',' + (alpha || 0).toFixed(9), v = cache.get(key);
    if (v) return v;
    var sh = funnyHills(c, h, alpha);
    v = sh.valid ? { Bs: Bs(sh), Bc: Bc(sh), neck: sh.neck, A: sh.A, valid: true } : { valid: false };
    if (cache.size > 20000) cache.clear();
    cache.set(key, v);
    return v;
  }
  function edef(x, B) { return (B.Bs - 1) + 2 * x * (B.Bc - 1); }

  // the largest h at which the symmetric shape still has a neck of radius >= rneck (bisection)
  function hScission(c, rneck) {
    rneck = rneck || 0;
    var lo = -0.5, hi = 1.5;
    function ok(h) { var s = funnyHills(c, h, 0); return s.valid && Math.sqrt(Math.max(0, s.rho2(0))) > rneck; }
    if (!ok(lo)) return null;
    for (var i = 0; i < 60; i++) { var m = 0.5 * (lo + hi); if (ok(m)) lo = m; else hi = m; }
    return lo;
  }

  // Brent minimisation on [a, b]
  function brent(f, a, b, tol) {
    var gr = 0.3819660112501051, x = a + gr * (b - a), w = x, v = x, fx = f(x), fw = fx, fv = fx, d = 0, e = 0;
    for (var it = 0; it < 100; it++) {
      var m = 0.5 * (a + b), t1 = tol * Math.abs(x) + 1e-12, t2 = 2 * t1;
      if (Math.abs(x - m) <= t2 - 0.5 * (b - a)) break;
      var p = 0, q = 0, r = 0, u;
      if (Math.abs(e) > t1) {
        r = (x - w) * (fx - fv); q = (x - v) * (fx - fw); p = (x - v) * q - (x - w) * r; q = 2 * (q - r);
        if (q > 0) p = -p; else q = -q;
        r = e; e = d;
      }
      if (Math.abs(p) < Math.abs(0.5 * q * r) && p > q * (a - x) && p < q * (b - x)) { d = p / q; u = x + d; if (u - a < t2 || b - u < t2) d = x < m ? t1 : -t1; }
      else { e = (x < m ? b : a) - x; d = gr * e; }
      u = x + (Math.abs(d) >= t1 ? d : (d > 0 ? t1 : -t1));
      var fu = f(u);
      if (fu <= fx) { if (u < x) b = x; else a = x; v = w; fv = fw; w = x; fw = fx; x = u; fx = fu; }
      else { if (u < x) a = u; else b = u; if (fu <= fw || w === x) { v = w; fv = fw; w = u; fw = fu; } else if (fu <= fv || v === x || v === w) { v = u; fv = fu; } }
    }
    return { x: x, f: fx };
  }

  // fission valley at elongation c: global minimum over the neck parameter h (symmetric shapes),
  // coarse scan for the basin, then Brent inside it. h runs from HLO to the shape whose neck is 0.02 R0.
  var HLO = -0.35;
  function valleyAt(x, c) {
    var hmax = hScission(c, 0.02);
    if (hmax == null || hmax <= HLO) return null;
    var f = function (h) { return edef(x, shapeB(c, h, 0)); };
    var n = 24, dh = (hmax - HLO) / n, k = 0, best = Infinity;
    for (var i = 0; i <= n; i++) { var v = f(HLO + i * dh); if (v < best) { best = v; k = i; } }
    var r = brent(f, HLO + Math.max(0, k - 1) * dh, HLO + Math.min(n, k + 1) * dh, 1e-8);
    return { c: c, h: r.x, E: r.f, atEdge: hmax - r.x < 1e-3, atLow: r.x - HLO < 1e-3 };
  }
  // saddle point: the highest point of the valley, sphere -> scission
  // The valley is followed from the sphere until its minimum falls onto the scission edge (the drop
  // then prefers to pinch off at that elongation); the saddle is its highest interior point. If the
  // valley is still rising when it falls off, this shape family has no saddle there: flagged.
  function saddle(x, opt) {
    opt = opt || {};
    var c0 = opt.cmin || 1.0, c1 = opt.cmax || 2.7, nc = opt.nc || 69, best = null, list = [], ib = -1;
    for (var i = 0; i < nc; i++) {
      var c = c0 + (c1 - c0) * i / (nc - 1), v = valleyAt(x, c);
      if (!v || v.atEdge) break;
      list.push(v);
      if (!best || v.E > best.E) { best = v; ib = list.length - 1; }
    }
    if (!best || ib === list.length - 1) return { ok: false, coarse: list };
    var dc = (c1 - c0) / (nc - 1);
    var r = brent(function (c) { var v = valleyAt(x, c); return v && !v.atEdge ? -v.E : 1e9; }, Math.max(c0, best.c - dc), best.c + dc, 1e-8);
    var s = valleyAt(x, r.x);
    return { ok: !s.atEdge && !s.atLow, c: s.c, h: s.h, E: s.E, atLow: s.atLow, coarse: list };
  }


  // ---------- the landscape on a (c, h) grid of B_s, B_c (shape-only, so any x is a linear combination)
  // G = { c0, dc, nc, h0, dh, nh, Bs: [], Bc: [] } with NaN where the shape does not exist
  function gridNeck(G) {
    var nk = new Float64Array(G.nc * G.nh);
    for (var i = 0; i < G.nc; i++) for (var j = 0; j < G.nh; j++) {
      var sh = funnyHills(G.c0 + i * G.dc, G.h0 + j * G.dh, 0);
      nk[i * G.nh + j] = sh.valid ? Math.sqrt(Math.max(0, sh.rho2(0))) : NaN;
    }
    return nk;
  }
  function gridE(G, x) {
    var n = G.nc * G.nh, E = new Float64Array(n);
    for (var k = 0; k < n; k++) E[k] = (G.Bs[k] - 1) + 2 * x * (G.Bc[k] - 1);
    return E;
  }
  // mountain pass by flooding: the path from the sphere to the scission region (neck < rsc) whose
  // highest point is lowest (Dijkstra with cost = running maximum). Returns that highest node.
  function flood(G, x, rsc) {
    rsc = rsc == null ? 0.15 : rsc;
    if (!G.neck) G.neck = gridNeck(G);
    var E = gridE(G, x), n = E.length, cost = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    var i0 = Math.round((1 - G.c0) / G.dc), j0 = Math.round((0 - G.h0) / G.dh), s0 = i0 * G.nh + j0;
    var heap = [], hk = [];
    function push(k, v) { heap.push(v); hk.push(k); var a = heap.length - 1; while (a > 0) { var p = (a - 1) >> 1; if (heap[p] <= heap[a]) break; var t = heap[p]; heap[p] = heap[a]; heap[a] = t; t = hk[p]; hk[p] = hk[a]; hk[a] = t; a = p; } }
    function pop() {
      var k = hk[0], v = heap[0], lv = heap.pop(), lk = hk.pop();
      if (heap.length) { heap[0] = lv; hk[0] = lk; var a = 0; for (;;) { var l = 2 * a + 1, r = l + 1, m = a; if (l < heap.length && heap[l] < heap[m]) m = l; if (r < heap.length && heap[r] < heap[m]) m = r; if (m === a) break; var t = heap[m]; heap[m] = heap[a]; heap[a] = t; t = hk[m]; hk[m] = hk[a]; hk[a] = t; a = m; } }
      return k;
    }
    cost[s0] = E[s0]; push(s0, E[s0]);
    var goal = -1;
    while (heap.length) {
      var k = pop();
      if (done[k]) continue;
      done[k] = 1;
      if (G.neck[k] < rsc) { goal = k; break; }
      var i = (k / G.nh) | 0, j = k - i * G.nh;
      for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        var ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= G.nc || jj >= G.nh) continue;
        var q = ii * G.nh + jj;
        if (done[q] || !(E[q] === E[q])) continue;
        var cq = Math.max(cost[k], E[q]);
        if (cq < cost[q]) { cost[q] = cq; prev[q] = k; push(q, cq); }
      }
    }
    if (goal < 0) return null;
    var path = [], top = goal;
    for (var k2 = goal; k2 >= 0; k2 = prev[k2]) { path.push(k2); if (E[k2] > E[top]) top = k2; }
    path.reverse();
    var it = (top / G.nh) | 0, jt = top - it * G.nh;
    return { level: cost[goal], c: G.c0 + it * G.dc, h: G.h0 + jt * G.dh, path: path, E: E };
  }
  // Newton on grad E = 0 with central differences of the direct energies (step d in c and h).
  // Returns the Hessian determinant at the last point (det < 0: one negative eigenvalue, a saddle in
  // the (c, h) plane) and whether the Newton step fell below tol.
  function refineSaddle(x, c, h, d, tol, maxit) {
    d = d || 2e-3; tol = tol || 1e-9; maxit = maxit || 30;
    var e = function (cc, hh) { var B = shapeB(cc, hh, 0); return B.valid ? edef(x, B) : NaN; };
    var det = NaN, gnorm = NaN, small = 0;
    for (var it = 0; it < maxit; it++) {
      var f0 = e(c, h), fcp = e(c + d, h), fcm = e(c - d, h), fhp = e(c, h + d), fhm = e(c, h - d);
      var fpp = e(c + d, h + d), fpm = e(c + d, h - d), fmp = e(c - d, h + d), fmm = e(c - d, h - d);
      var gc = (fcp - fcm) / (2 * d), gh = (fhp - fhm) / (2 * d);
      var Hcc = (fcp - 2 * f0 + fcm) / (d * d), Hhh = (fhp - 2 * f0 + fhm) / (d * d), Hch = (fpp - fpm - fmp + fmm) / (4 * d * d);
      det = Hcc * Hhh - Hch * Hch; gnorm = Math.hypot(gc, gh);
      if (!(det === det) || det === 0) return null;
      var sc = -(Hhh * gc - Hch * gh) / det, shh = -(-Hch * gc + Hcc * gh) / det;
      var lim = 0.05, nrm = Math.hypot(sc, shh);
      if (nrm > lim) { sc *= lim / nrm; shh *= lim / nrm; }
      c += sc; h += shh;
      if (nrm < tol) return { c: c, h: h, E: e(c, h), det: det, grad: gnorm, it: it, converged: true };
      // near x = 1 the steps stall at a rounding-noise floor above tol (it grows like (1 - x)^-2 and
      // differs between JavaScript engines): three successive steps below 1e-4 of the saddle's distance
      // from the sphere also count as converged
      small = nrm < 1e-4 * Math.hypot(c - 1, h) ? small + 1 : 0;
      if (small >= 3) return { c: c, h: h, E: e(c, h), det: det, grad: gnorm, it: it, converged: true };
    }
    return { c: c, h: h, E: e(c, h), det: det, grad: gnorm, it: maxit, converged: false };
  }

  // ---------- the saddle the page shows, with its provenance:
  //   'verified'    Newton on the direct energies converged to a point with det H < 0 and E > 0
  //   'asymptotic'  1 - x < 1e-3: the barrier from Bohr & Wheeler Eq. (24),
  //                 E/E_S0 = 98/135 y^3 - 11368/34425 y^4, y = 1 - x (tests/check_fission_exact.py derives it
  //                 from this solver; the direct saddles meet it to 1e-5 at 1 - x = 2e-3, tests/check_fission_saddle.js).
  //                 The location: Newton on the direct energies from the trend c - 1 = 2.33 y, h = -0.57 y of the
  //                 direct saddles, at most 6 iterations, accepted if det H < 0 and its energy meets the series
  //                 to 1e-4 (it does in 3 iterations down to 1 - x = 4.4e-4, to 5e-5); located: true then. Closer to x = 1 the direct energies cannot place
  //                 the saddle within that budget, the trend point is kept (located: false), and the path drawn
  //                 from it is illustrative: its highest direct energy is not the quoted barrier (1% above it at
  //                 1 - x = 3.7e-4, 6% at 1e-4, 12% at 5e-5).
  //   'none'        x >= 1: the sphere itself is not a minimum
  //   'unresolved'  no verified saddle found: the barrier is unknown, NOT zero
  // Start: the lowest pass of the grid (flood); near x = 1 the saddle lies inside the first grid cell, so
  // the start then comes from the near-critical trend. The finite-difference step shrinks with 1 - x,
  // because the saddle sits at a distance ~ 2.4 (1 - x) from the sphere.
  var ASYMPTOTIC_Y = 1e-3;
  function bwBarrier(x) { var y = 1 - x; return 98 / 135 * y * y * y - 11368 / 34425 * y * y * y * y; }
  function findSaddle(G, x) {
    if (x >= 1) return { status: 'none', E: 0 };
    var y = 1 - x;
    if (y < ASYMPTOTIC_Y) {
      var bw = bwBarrier(x), ra = refineSaddle(x, 1 + 2.33 * y, -0.57 * y, 0.1 * y, 1e-9, 6);
      if (ra && ra.converged && ra.det < 0 && Math.abs(ra.E / bw - 1) < 1e-4)
        return { status: 'asymptotic', c: ra.c, h: ra.h, E: bw, located: true };
      return { status: 'asymptotic', c: 1 + 2.33 * y, h: -0.57 * y, E: bw, located: false };
    }
    var d = Math.min(2e-3, 0.1 * y), starts = [];
    var fl = flood(G, x);
    if (fl && Math.hypot(fl.c - 1, fl.h) > 1.5 * G.dc) starts.push([fl.c, fl.h]);
    starts.push([1 + 2.33 * y, -0.57 * y]);
    for (var i = 0; i < starts.length; i++) {
      var r = refineSaddle(x, starts[i][0], starts[i][1], d);
      if (r && r.converged && r.det < 0 && r.E > 0) { r.status = 'verified'; r.flood = fl ? fl.level : NaN; return r; }
    }
    return { status: 'unresolved', E: NaN, flood: fl ? fl.level : NaN };
  }

  // ---------- the fission path: sphere -> saddle -> scission, steepest descent in the (c, h) plane.
  // Energies: bilinear in the grid's B_s, B_c where all four corners of the cell exist, otherwise (next
  // to the scission line, where the grid has no shapes) the direct energies. One gradient stencil never
  // mixes the two. The forward branch ends where the neck radius reaches SCISSION_NECK (in R0); the last
  // step is cut back by bisection so that the end point is a valid shape with exactly that neck.
  var SCISSION_NECK = 0.02;
  function neckRadius(c, h) { var s = funnyHills(c, h, 0); return s.valid ? Math.sqrt(Math.max(0, s.rho2(0))) : -1; }
  function gridBil(G, arr, c, h) {
    var u = (c - G.c0) / G.dc, v = (h - G.h0) / G.dh, i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i >= G.nc - 1 || j >= G.nh - 1) return NaN;
    var a = u - i, b = v - j, k = i * G.nh + j;
    return (1 - a) * (1 - b) * arr[k] + a * (1 - b) * arr[k + G.nh] + (1 - a) * b * arr[k + 1] + a * b * arr[k + G.nh + 1];
  }
  function gridEnergy(G, x, c, h) { return (gridBil(G, G.Bs, c, h) - 1) + 2 * x * (gridBil(G, G.Bc, c, h) - 1); }
  function directEnergy(x, c, h) { var B = shapeB(c, h, 0); return B.valid ? edef(x, B) : NaN; }
  // gradient by central differences: all four points from the grid if it has them and the point is not
  // within three grid steps of the sphere (near x = 1 the saddle lies inside the first grid cell), else
  // all four direct. Next to the scission line the step shrinks so that the stencil stays on valid
  // shapes: for B >= 0 the neck radius is c sqrt(A), and A falls by 2/5 per unit of h.
  function gradE(G, x, c, h, e, direct) {
    var nk = neckRadius(c, h);
    if (nk > 0 && nk < 0.2) e = Math.min(e, 0.3 * 2.5 * nk * nk / (c * c));
    var p = [[c + e, h], [c - e, h], [c, h + e], [c, h - e]], v = null;
    if (!direct && Math.hypot(c - 1, h) > 3 * G.dc) {
      v = p.map(function (q) { return gridEnergy(G, x, q[0], q[1]); });
      if (!v.every(function (w) { return w === w; })) v = null;
    }
    if (!v) v = p.map(function (q) { return directEnergy(x, q[0], q[1]); });
    return [(v[0] - v[1]) / (2 * e), (v[2] - v[3]) / (2 * e)];
  }
  /* Steepest descent with an energy-decreasing line search. A step is taken along -grad E and accepted
     only if the energy falls; otherwise it is halved (up to 40 times). Accepted steps grow by 1.5 up to
     STEP_MAX, so the step adapts to the local scale: near x = 1 the saddle lies ~2.4 (1 - x) from the
     sphere, far inside one fixed step (the former fixed step of 0.006 overshot sideways into the stiff
     direction and climbed to 5e3 times the barrier at x = 0.9995). The direction comes from the grid
     where it has the stencil (gradE), from the direct energies if the grid's direction fails to descend.
     The acceptance test uses the direct energies, so every vertex of a branch is lower in direct energy
     than the one before it and none exceeds the saddle's. The grid's bilinear error reaches 1.5e-3 E_S0
     near scission, comparable with the gap below the saddle, so it cannot decide this. With fast (the
     page while a slider moves) the grid decides away from the sphere: quicker, and only provisional. */
  var STEP_MAX = 0.006;
  function descend(G, x, c, h, toSphere, rsc, st, fast) {
    var pts = [[c, h]], end = 'steps';
    st = Math.min(STEP_MAX, st || STEP_MAX);
    function useDirect(cc, hh) {
      if (!fast || Math.hypot(cc - 1, hh) <= 3 * G.dc) return true;
      var eg = gridEnergy(G, x, cc, hh);
      return !(eg === eg);
    }
    function en(cc, hh, d) { return d ? directEnergy(x, cc, hh) : gridEnergy(G, x, cc, hh); }
    for (var it = 0; it < 4000; it++) {
      if (toSphere && Math.hypot(c - 1, h) < 0.012) { end = 'sphere'; break; }
      var dHere = useDirect(c, h), acc = false;
      for (var pass = 0; pass < 2 && !acc; pass++) {          // pass 1: the direct gradient, if the grid's failed
        // stencil: 1e-3 as before, smaller only near the sphere (the saddle's own scale ~ 2.4 (1 - x)),
        // never tied to a step that the line search has shrunk (a tiny stencil reads rounding noise)
        var g = gradE(G, x, c, h, Math.min(1e-3, 0.05 * Math.hypot(c - 1, h)), pass === 1), gn = Math.hypot(g[0], g[1]);
        if (!(gn === gn) || gn < 1e-14) {                    // the grid's gradient is no use here: go direct
          if (pass === 0) continue;
          end = gn === gn ? 'minimum' : 'failed'; break;
        }
        // the grid's direction gets three halvings; if it needs more it is not a descent direction of the
        // direct energy (grid error in a flat valley floor) and the direct gradient takes over. The step
        // starts no smaller than 0.002 of the distance from the sphere, so it cannot collapse for good.
        var s2 = Math.min(STEP_MAX, Math.max(st, 2e-3 * Math.hypot(c - 1, h)));
        for (var k = 0; k < (pass === 0 ? 4 : 40); k++, s2 *= 0.5) {
          var cn = c - s2 * g[0] / gn, hn = h - s2 * g[1] / gn;
          if (!toSphere && !(neckRadius(cn, hn) > rsc)) {
            // the step crosses neck = rsc (or leaves the family): bisect along it
            var lo = 0, hi = 1;
            for (var kk = 0; kk < 60; kk++) { var m = 0.5 * (lo + hi); if (neckRadius(c + m * (cn - c), h + m * (hn - h)) > rsc) lo = m; else hi = m; }
            var ce = c + lo * (cn - c), he = h + lo * (hn - h);
            if (!(directEnergy(x, ce, he) < directEnergy(x, c, h))) continue;
            pts.push([ce, he]);
            return { pts: pts, end: 'scission' };
          }
          var d = dHere || useDirect(cn, hn), En = en(cn, hn, d);
          if (En === En && En < en(c, h, d)) { c = cn; h = hn; pts.push([c, h]); acc = true; st = Math.min(STEP_MAX, 1.5 * s2); break; }
        }
        if (end !== 'steps') break;
      }
      if (end !== 'steps') break;
      if (!acc) { end = 'stalled'; break; }
    }
    if (toSphere) pts.push([1, 0]);
    return { pts: pts, end: end };
  }
  // the unstable direction at the saddle, from the direct-energy Hessian (step scaled to the saddle's
  // distance from the sphere, which goes to zero as x -> 1); oriented toward elongation
  function unstableDir(x, c, h) {
    var e = Math.min(4e-3, Math.max(1e-4, 0.2 * Math.hypot(c - 1, h))), E = function (cc, hh) { return directEnergy(x, cc, hh); };
    var Hcc = (E(c + e, h) - 2 * E(c, h) + E(c - e, h)) / (e * e), Hhh = (E(c, h + e) - 2 * E(c, h) + E(c, h - e)) / (e * e);
    var Hch = (E(c + e, h + e) - E(c + e, h - e) - E(c - e, h + e) + E(c - e, h - e)) / (4 * e * e);
    var tr = Hcc + Hhh, det = Hcc * Hhh - Hch * Hch, lam = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var v = Math.abs(Hch) > 1e-14 ? [lam - Hhh, Hch] : (Hcc < Hhh ? [1, 0] : [0, 1]);
    var n = Math.hypot(v[0], v[1]); v = [v[0] / n, v[1] / n];
    if (v[0] < 0) v = [-v[0], -v[1]];
    return v;
  }
  // sad: a findSaddle result with status 'verified' or 'asymptotic', or null when x >= 1 (no barrier).
  // Returns the polyline with arclength, sSad (fraction of the length at the saddle), and scission: true
  // only if the forward branch reached the neck SCISSION_NECK on a valid shape.
  function fissionPath(G, x, sad, rsc, fast) {
    rsc = rsc == null ? SCISSION_NECK : rsc;
    var pts, fwd, iS = 0;
    if (sad) {
      var v = unstableDir(x, sad.c, sad.h), r = Math.hypot(sad.c - 1, sad.h);
      var db = Math.min(0.01, 0.5 * r), df = Math.min(0.01, Math.max(0.5 * r, 0.002));
      var st0 = Math.min(STEP_MAX, 0.5 * r);
      var back = descend(G, x, sad.c - db * v[0], sad.h - db * v[1], true, rsc, st0, fast).pts.reverse();
      fwd = descend(G, x, sad.c + df * v[0], sad.h + df * v[1], false, rsc, st0, fast);
      pts = back.concat([[sad.c, sad.h]], fwd.pts);
      iS = back.length;
    } else {
      // x >= 1: the sphere is not a minimum; leave it along the near-critical saddle trend
      // (c - 1, h) = (2.33, -0.57) s, on which the energy falls from the sphere (a straight start along h = 0
      // to c = 1.02 rose to 5e-8 E_S0 at x = 1)
      fwd = descend(G, x, 1 + 2.33 * 0.005, -0.57 * 0.005, false, rsc, 0.002, fast);
      pts = [[1, 0]].concat(fwd.pts);
    }
    var L = [0];
    for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var last = pts[pts.length - 1], nk = neckRadius(last[0], last[1]);
    // illustrative: the path does not start from a located saddle (an asymptotic saddle whose location
    // is the extrapolated trend), so its highest point need not be the quoted barrier
    return { pts: pts, L: L, total: L[L.length - 1], sSad: sad ? L[iS] / L[L.length - 1] : 0, end: fwd.end,
             illustrative: !!(sad && sad.status === 'asymptotic' && !sad.located),
             endNeck: nk, scission: fwd.end === 'scission' && nk > 0 && nk <= rsc * (1 + 1e-6) };
  }

  // ---------- saddle in a richer family: r(theta) = R[1 + a0 + sum_n a_n P_n], even n, started from the
  // funny-hills saddle projected on Legendre polynomials; Newton on grad E = 0 with central differences.
  // A richer family can only lower a saddle that both families represent: this bounds the cost of (c, h).
  function projectFH(c, h, ns, nq) {
    var sh = funnyHills(c, h, 0), g = gauleg(nq || 200), o = {}, R = [], a = {};
    function rOf(th) {
      var lo = 0, hi = Math.PI;
      for (var k = 0; k < 80; k++) { var t = 0.5 * (lo + hi); sh.at(t, o); if (Math.atan2(o.r, o.z) > th) lo = t; else hi = t; }
      sh.at(0.5 * (lo + hi), o); return Math.hypot(o.r, o.z);
    }
    for (var i = 0; i < g.x.length; i++) R.push(rOf(Math.acos(g.x[i])));
    var a0 = 0;
    for (i = 0; i < g.x.length; i++) a0 += 0.5 * g.w[i] * R[i];
    ns.forEach(function (n) { var s = 0; for (var i2 = 0; i2 < g.x.length; i2++) s += g.w[i2] * R[i2] * legendreP(n, g.x[i2]).p; a[n] = (2 * n + 1) / 2 * s / a0; });
    return a;
  }
  function legendreSaddle(x, c, h, ns) {
    var a = projectFH(c, h, ns), v = ns.map(function (n) { return a[n]; }), d = 1e-3, m = v.length;
    function E(w) { var o = {}; ns.forEach(function (n, i) { o[n] = w[i]; }); var s = bwShape(o); return (Bs(s) - 1) + 2 * x * (Bc(s) - 1); }
    for (var it = 0; it < 40; it++) {
      var f0 = E(v), g = [], H = [];
      for (var i = 0; i < m; i++) H.push(new Array(m).fill(0));
      var sh = function (i, s, j, t) { var w = v.slice(); w[i] += s; if (j != null) w[j] += t; return E(w); };
      for (i = 0; i < m; i++) {
        var fp = sh(i, d), fm = sh(i, -d);
        g[i] = (fp - fm) / (2 * d); H[i][i] = (fp - 2 * f0 + fm) / (d * d);
        for (var j = 0; j < i; j++) H[i][j] = H[j][i] = (sh(i, d, j, d) - sh(i, d, j, -d) - sh(i, -d, j, d) + sh(i, -d, j, -d)) / (4 * d * d);
      }
      var A = H.map(function (r, i) { return r.concat([-g[i]]); });
      for (i = 0; i < m; i++) {
        var p = i; for (var k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
        var tmp = A[i]; A[i] = A[p]; A[p] = tmp;
        for (k = i + 1; k < m; k++) { var f = A[k][i] / A[i][i]; for (var l = i; l <= m; l++) A[k][l] -= f * A[i][l]; }
      }
      var st = new Array(m);
      for (i = m - 1; i >= 0; i--) { var t = A[i][m]; for (k = i + 1; k < m; k++) t -= A[i][k] * st[k]; st[i] = t / A[i][i]; }
      var nr = Math.hypot.apply(null, st), sc = nr > 0.05 ? 0.05 / nr : 1;
      v = v.map(function (x0, i) { return x0 + sc * st[i]; });
      if (nr < 1e-8) {
        var Bm = H.map(function (r) { return r.slice(); }), neg = 0;   // Sylvester: count negative pivots
        for (i = 0; i < m; i++) { if (Bm[i][i] < 0) neg++; for (k = i + 1; k < m; k++) { var f2 = Bm[k][i] / Bm[i][i]; for (l = i; l < m; l++) Bm[k][l] -= f2 * Bm[i][l]; } }
        var out = {}; ns.forEach(function (n, i) { out[n] = v[i]; });
        return { E: E(v), a: out, it: it, neg: neg };
      }
    }
    return null;
  }

  var FISSION = {
    LD: LD, gauleg: gauleg, ellKE: ellKE, Lk: Lk, Q: Q,
    spheroid: spheroid, spheroidQ: spheroidQ, spheroidExact: spheroidExact, bwShape: bwShape, funnyHills: funnyHills,
    volume: volume, area: area, Bs: Bs, Bc: Bc, coulombJ: coulombJ,
    drop: drop, shapeB: shapeB, HLO: HLO, SCISSION_NECK: SCISSION_NECK, ASYMPTOTIC_Y: ASYMPTOTIC_Y, bwBarrier: bwBarrier, findSaddle: findSaddle, fissionPath: fissionPath, neckRadius: neckRadius, gridEnergy: gridEnergy, directEnergy: directEnergy, gridNeck: gridNeck, gridE: gridE, flood: flood, refineSaddle: refineSaddle, legendreSaddle: legendreSaddle, projectFH: projectFH, edef: edef, hScission: hScission, valleyAt: valleyAt, saddle: saddle, brent: brent
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = FISSION; else root.FISSION = FISSION;
})(this);
