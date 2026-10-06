/* ------------------------------------------------------------------ *
 * The size of the nucleus: charge densities, form factors and the
 * plane-wave Born cross section for elastic electron scattering.
 *
 * Densities, all normalized to 4 pi int rho r^2 dr = Z (units e fm^-3):
 *   sphere    rho = rho0 for r <= R
 *   gauss     rho = rho0 exp(-r^2/b^2)
 *   fermi     rho = rho0 / (1 + exp((r - c)/a))            (2pF)
 *   fb        rho = sum_n a_n j0(n pi r/R) for r <= R      (de Vries et al. 1987, Table IV)
 * Form factor F(q) = (4 pi/(Z q)) int rho(r) sin(qr) r dr, F(0) = 1.
 *   numerical: composite Simpson on a uniform grid (the sphere is integrated up to its edge)
 *   analytic:  sphere 3 j1(qR)/(qR); gauss exp(-q^2 b^2/4);
 *              fb (4 pi/Z) sum_n a_n (-1)^(n+1) sin(qR) / (q (q_n^2 - q^2)), q_n = n pi/R
 * Mean-square radius <r^2> = (4 pi/Z) int rho r^4 dr; closed forms: sphere 3R^2/5, gauss 3b^2/2,
 *   fb (4 pi/Z) sum_n a_n (-1)^(n+1) R^5 (n^2 pi^2 - 6)/(n pi)^4.
 * Equivalent sharp radius: the uniform sphere with the same <r^2>, R_eq = sqrt(5/3) <r^2>^(1/2).
 *
 * Electron scattering (ultrarelativistic electron, m_e neglected; nuclear mass M = A u):
 *   E' = E / (1 + (2E/M) sin^2(theta/2)),   q = 2 sqrt(E E') sin(theta/2) / (hbar c) = sqrt(Q^2)/(hbar c),
 *   Q^2 = -(k - k')^2 the four-momentum transfer squared (exact for m_e = 0)
 *   Mott:  dsigma/dOmega = (Z alpha hbar c)^2 cos^2(theta/2) / (4 E^2 sin^4(theta/2)) * E'/E
 *   PWBA:  dsigma/dOmega = Mott * |F(q)|^2
 * PWBA has exact zeros where F(q) = 0; for heavy nuclei the Coulomb distortion of the electron
 * waves fills them in (a phase-shift calculation is needed for that, not done here).
 *
 * Plain script: window.SIZE in a browser, module.exports in Node.
 * tests/check_size.py checks every function against independent mpmath/scipy code.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';
  // CODATA 2018 (data/size/codata2018_allascii.txt; tests/check_size.js reads them back from that file)
  var HBARC = 197.3269804, ALPHA = 1 / 137.035999084, U = 931.49410242;
  var PI = Math.PI;

  function simpson(f, a, b, n) {             // n even
    var h = (b - a) / n, s = f(a) + f(b);
    for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
    return s * h / 3;
  }
  function j0(x) { return Math.abs(x) < 1e-4 ? 1 - x * x / 6 : Math.sin(x) / x; }
  function j1(x) { return Math.abs(x) < 1e-3 ? x / 3 - x * x * x / 30 : (Math.sin(x) / x - Math.cos(x)) / x; }

  /* model: {kind, Z, ...params}. Returns an object with rho(r), rmax, F(q) (numerical), Fexact(q)
     (closed form where one exists, else null), msr (numerical <r^2>), msrExact (closed form or null). */
  function model(m) {
    var Z = m.Z, o = { kind: m.kind, Z: Z, p: m }, shape, rmax, n;
    if (m.kind === 'sphere') {
      shape = function (r) { return r <= m.R ? 1 : 0; }; rmax = m.R; n = 2000;
      o.Fexact = function (q) { var x = q * m.R; return x < 1e-3 ? 1 - x * x / 10 : 3 * j1(x) / x; };
      o.msrExact = 0.6 * m.R * m.R;
    } else if (m.kind === 'gauss') {
      shape = function (r) { return Math.exp(-r * r / (m.b * m.b)); }; rmax = 9 * m.b; n = 3000;
      o.Fexact = function (q) { return Math.exp(-q * q * m.b * m.b / 4); };
      o.msrExact = 1.5 * m.b * m.b;
    } else if (m.kind === 'fermi') {
      shape = function (r) { var x = (r - m.c) / m.a; return x > 700 ? 0 : 1 / (1 + Math.exp(x)); };
      rmax = m.c + 40 * m.a; n = 4000;
      o.Fexact = null; o.msrExact = null;
    } else if (m.kind === 'fb') {
      var A = m.coef, R = m.R;
      shape = function (r) {
        if (r > R) return 0;
        var s = 0; for (var i = 0; i < A.length; i++) s += A[i] * j0((i + 1) * PI * r / R);
        return s;
      };
      rmax = R; n = 2400;
      o.Fexact = function (q) { return fbF(A, R, Z, q); };
      var ms = 0, nz = 0;
      for (var i = 0; i < A.length; i++) {
        var k = i + 1, sg = k % 2 ? 1 : -1, npi = k * PI;
        nz += A[i] * sg * R * R * R / (npi * npi);
        ms += A[i] * sg * Math.pow(R, 5) * (npi * npi - 6) / Math.pow(npi, 4);
      }
      o.charge = 4 * PI * nz;                  // what the coefficients integrate to (should be Z)
      o.msrExact = 4 * PI * ms / Z;
    } else if (m.kind === 'grid') {           // tabulated rho on a uniform grid r_i = i h (already in e fm^-3)
      var G = m.rho, h = m.h;
      shape = function (r) { var x = r / h, i = Math.floor(x); if (i >= G.length - 1) return 0; var f = x - i; return G[i] * (1 - f) + G[i + 1] * f; };
      rmax = (G.length - 1) * h; n = 2 * Math.floor((G.length - 1) / 2);
      o.Fexact = null; o.msrExact = null;
    }
    var norm = m.kind === 'fb' || m.kind === 'grid' ? 1 : Z / (4 * PI * simpson(function (r) { return shape(r) * r * r; }, 0, rmax, n));
    o.rho0 = norm;
    o.rho = function (r) { return norm * shape(r); };
    o.rmax = rmax; o.n = n;
    var Q = 4 * PI * simpson(function (r) { return o.rho(r) * r * r; }, 0, rmax, n);
    o.chargeNum = Q;
    o.msr = 4 * PI * simpson(function (r) { return o.rho(r) * r * r * r * r; }, 0, rmax, n) / Z;
    o.rms = Math.sqrt(o.msrExact != null ? o.msrExact : o.msr);
    o.Rnum = function (q) {                    // numerical form factor
      if (q < 1e-6) return Q / Z;
      return 4 * PI / (Z * q) * simpson(function (r) { return o.rho(r) * Math.sin(q * r) * r; }, 0, rmax, n);
    };
    o.F = o.Fexact || o.Rnum;
    return o;
  }

  // with q_n R = n pi, sin(qR) = (-1)^n sin((q - q_n) R), so each term is R sinc((q - q_n) R) / (q (q + q_n)):
  // no cancellation at q = q_n
  function fbF(A, R, Z, q) {
    var s = 0;
    for (var i = 0; i < A.length; i++) {
      var k = i + 1, qn = k * PI / R;
      if (q < 1e-7) s += A[i] * (k % 2 ? 1 : -1) * R / (qn * qn);
      else s += A[i] * R * j0((q - qn) * R) / (q * (q + qn));
    }
    return 4 * PI * s / Z;
  }

  // the first zero of j1 (tan x = x), by Newton from 4.5
  function sphereZero(k) {
    var x = k * PI + PI / 2 - 0.1;
    for (var i = 0; i < 60; i++) { var f = Math.tan(x) - x, d = 1 / (Math.cos(x) * Math.cos(x)) - 1, dx = f / d; x -= dx; if (Math.abs(dx) < 1e-15) break; }
    return x;
  }

  // ---------------------------------------------------------------- kinematics and cross sections
  function kin(E, theta, A) {
    var M = A * U, s2 = Math.sin(theta / 2), Ep = E / (1 + 2 * E / M * s2 * s2);
    return { Ep: Ep, q: 2 * Math.sqrt(E * Ep) * s2 / HBARC };
  }
  function mott(E, theta, Z, A) {           // mb/sr
    var s = Math.sin(theta / 2), c = Math.cos(theta / 2), K = kin(E, theta, A);
    var za = Z * ALPHA * HBARC;
    return 10 * za * za * c * c / (4 * E * E * s * s * s * s) * (K.Ep / E);
  }
  function pwba(E, theta, Z, A, F) { var K = kin(E, theta, A), f = F(K.q); return mott(E, theta, Z, A) * f * f; }
  // the angle at which q is reached (q rises monotonically with theta); null if q > q(180 deg)
  function thetaOfQ(E, q, A) {
    if (kin(E, PI, A).q < q) return null;
    var lo = 0, hi = PI;
    for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (kin(E, mid, A).q < q) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  // zeros of a real form factor on (0, qmax]: sign changes on a grid, then bisection
  function zeros(F, qmax, dq) {
    var out = [], q0 = 1e-3, f0 = F(q0);
    for (var q = q0 + dq; q <= qmax + 1e-12; q += dq) {
      var f = F(q);
      if (f === 0 || (f > 0) !== (f0 > 0)) {
        var lo = q - dq, hi = q, flo = f0;
        for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2, fm = F(mid); if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid; }
        out.push((lo + hi) / 2);
      }
      f0 = f;
    }
    return out;
  }

  // ---------------------------------------------------------------- the 2pF closest to a density
  // minimizes int_0^Rc (rho_2pF - rho_target)^2 r^2 dr over (c, a), both normalized to Z (Nelder-Mead)
  function fit2pF(target, Z, Rc, start) {
    var h = 0.02, nr = Math.round(Rc / h), T = [];
    for (var i = 0; i <= nr; i++) T.push(target(i * h));
    function cost(p) {
      if (p[1] <= 0.05 || p[0] <= 0.1) return 1e9;
      var m = model({ kind: 'fermi', Z: Z, c: p[0], a: p[1] }), s = 0;
      for (var i = 0; i <= nr; i++) { var r = i * h, d = m.rho(r) - T[i]; s += (i === 0 || i === nr ? 0.5 : 1) * d * d * r * r; }
      return s * h;
    }
    var P = [start.slice(), [start[0] * 1.05, start[1]], [start[0], start[1] * 1.15]], C = P.map(cost);
    for (var it = 0; it < 400; it++) {
      var ord = [0, 1, 2].sort(function (x, y) { return C[x] - C[y]; });
      P = ord.map(function (k) { return P[k]; }); C = ord.map(function (k) { return C[k]; });
      if (Math.abs(P[2][0] - P[0][0]) + Math.abs(P[2][1] - P[0][1]) < 1e-9) break;
      var cen = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2];
      var xr = [cen[0] + (cen[0] - P[2][0]), cen[1] + (cen[1] - P[2][1])], fr = cost(xr);
      if (fr < C[0]) {
        var xe = [cen[0] + 2 * (cen[0] - P[2][0]), cen[1] + 2 * (cen[1] - P[2][1])], fe = cost(xe);
        if (fe < fr) { P[2] = xe; C[2] = fe; } else { P[2] = xr; C[2] = fr; }
      } else if (fr < C[1]) { P[2] = xr; C[2] = fr; }
      else {
        var xc = [cen[0] + 0.5 * (P[2][0] - cen[0]), cen[1] + 0.5 * (P[2][1] - cen[1])], fc = cost(xc);
        if (fc < C[2]) { P[2] = xc; C[2] = fc; }
        else for (var k = 1; k < 3; k++) { P[k] = [P[0][0] + 0.5 * (P[k][0] - P[0][0]), P[0][1] + 0.5 * (P[k][1] - P[0][1])]; C[k] = cost(P[k]); }
      }
    }
    return { c: P[0][0], a: P[0][1], cost: C[0] };
  }

  // ---------------------------------------------------------------- folding a point density with a Gaussian
  // rho_ch(r) = 1/(r sigma sqrt(2 pi)) int r' rho(r') [exp(-(r-r')^2/2s^2) - exp(-(r+r')^2/2s^2)] dr',
  // sigma^2 = <r^2>_p / 3: a Gaussian proton of mean-square radius <r^2>_p. Grid input and output (step h).
  function foldGauss(rho, h, msp) {
    var s2 = msp / 3, n = rho.length, out = new Float64Array(n), c = 1 / Math.sqrt(2 * PI * s2);
    for (var i = 0; i < n; i++) {
      var r = i * h, acc = 0;
      for (var j = 0; j < n; j++) {
        var rp = j * h, w = (j === 0 || j === n - 1) ? 0.5 : 1;
        if (r < 1e-9) acc += w * rho[j] * rp * rp * Math.exp(-rp * rp / (2 * s2)) * 2 / s2;   // r -> 0 limit
        else acc += w * rp * rho[j] * (Math.exp(-(r - rp) * (r - rp) / (2 * s2)) - Math.exp(-(r + rp) * (r + rp) / (2 * s2))) / r;
      }
      out[i] = acc * h * c;
    }
    return out;
  }

  // ---------------------------------------------------------------- r0 from a radii table
  // least squares of R_eq = r0 A^(1/3) over rows [Z, N, A, R_rms] with A >= Amin
  function r0Fit(rows, Amin) {
    var sxy = 0, sxx = 0, n = 0;
    for (var i = 0; i < rows.length; i++) {
      var A = rows[i][2]; if (A < Amin || rows[i][0] < 1) continue;
      var x = Math.cbrt(A), y = Math.sqrt(5 / 3) * rows[i][3];
      sxy += x * y; sxx += x * x; n++;
    }
    return { r0: sxy / sxx, n: n };
  }

  var SIZE = { HBARC: HBARC, ALPHA: ALPHA, U: U, model: model, fbF: fbF, sphereZero: sphereZero, kin: kin, mott: mott,
    pwba: pwba, thetaOfQ: thetaOfQ, zeros: zeros, fit2pF: fit2pF, foldGauss: foldGauss, r0Fit: r0Fit, simpson: simpson };
  if (typeof module !== 'undefined' && module.exports) module.exports = SIZE; else root.SIZE = SIZE;
})(this);
