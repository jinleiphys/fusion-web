/* betadecay.js: the allowed beta spectrum, the Fermi function and the statistical rate function f.
 *
 * Model (stated in full on beta.html):
 *   Units: energies in m_e c^2, momenta in m_e c, lengths in hbar / m_e c (386.159 fm). W is the total
 *   energy of the electron or positron, p = sqrt(W^2 - 1), W0 = 1 + E0 / m_e c^2 with E0 the endpoint
 *   kinetic energy. Recoil of the daughter is neglected in the phase space.
 *   Allowed spectrum: N(W) dW proportional to F(Z, W) p W (W0 - W)^2 dW, Z the charge of the daughter nucleus.
 *   Fermi function, the point-charge Dirac form evaluated at the nuclear radius R, exactly as Hayen et al.,
 *   Rev. Mod. Phys. 90, 015008 (2018), write their F0 (arXiv:1709.07530 source saved in data/beta/):
 *     F0 = 4 (2pR)^(2(gamma-1)) exp(pi y) |Gamma(gamma + i y)|^2 / Gamma(1 + 2 gamma)^2,
 *     gamma = sqrt(1 - (alpha Z)^2), y = +alpha Z W / p for electrons, -alpha Z W / p for positrons.
 *   In this convention the factor (1 + gamma)/2 of the other common form, 2(1 + gamma)(2pR)^..., is not in F0
 *   but in the finite-size factor L0, which the page applies too (Hayen et al. Eq. (L0), the Wilkinson 1990
 *   parametrization for a uniformly charged sphere of radius R, coefficients b_{x,n} of their Tables for
 *   electrons and positrons, stated accurate to 1e-4 for p <= 45 and Z <= 60; beyond Z = 60 it is applied
 *   outside its fitted range and the page says so):
 *     L0 = 1 + (13/60)(alpha Z)^2 -+ alpha Z W R (41 - 26 gamma) / [15 (2 gamma - 1)]
 *            -+ alpha Z R gamma (17 - 2 gamma) / [30 W (2 gamma - 1)] + a_{-1} R / W + sum_{n=0..5} a_n (W R)^n
 *            + c (R - 0.0164) (alpha Z)^4.5,   a_n = sum_{x=1..6} b_{x,n} (alpha Z)^x,  c = 0.41 (e-), 0.22 (e+),
 *   upper signs for electrons. R = 1.2 A^(1/3) fm (Hayen et al. take R = sqrt(5/3) <r^2>^(1/2); this page uses
 *   the A^(1/3) rule for every nucleus). Not included: U (diffuse charge), screening, atomic exchange and
 *   mismatch, recoil terms, the nuclear shape factor C, radiative corrections.
 *   Kinds: 'rel' F0 L0 (the page's default), 'f0' F0 alone, 'nr' F_NR = 2 pi y / (1 - exp(-2 pi y)), 'none' F = 1.
 *   f = int_1^W0 F p W (W0 - W)^2 dW = int_0^p0 F p^2 (W0 - W)^2 dp   (p W dW = p^2 dp).
 *   The p integral is done by composite Gauss-Legendre on intervals that halve toward p = 0. For electrons
 *   F0 ~ 1/p near threshold, so F0 p tends to a constant and the integrand goes as p; for positrons it
 *   vanishes faster than any power. tests/check_beta.py checks against mpmath.
 *
 * Plain script: window.BETA in a browser, module.exports in Node.
 */
(function (root) {
  'use strict';
  // CODATA 2018
  var HBARC = 197.3269804;            // MeV fm
  var ME = 0.51099895;                // MeV
  var ALPHA = 1 / 137.035999084;
  var LC = HBARC / ME;                // reduced Compton wavelength of the electron, fm (386.159...)
  var LN2 = Math.LN2;

  // ---------- complex log Gamma, Re(z) > 0: shift to Re(z) >= 12, then the Stirling series
  // (Bernoulli terms through B_16; the truncation error there is below 1e-17)
  var BST = [1 / 12, -1 / 360, 1 / 1260, -1 / 1680, 1 / 1188, -691 / 360360, 1 / 156, -3617 / 122400];
  function lnGammaC(x, y) {
    var sr = 0, si = 0;                                       // sum of log(z + k) over the shift
    while (x < 12) {
      sr += 0.5 * Math.log(x * x + y * y); si += Math.atan2(y, x);
      x += 1;
    }
    var lr = 0.5 * Math.log(x * x + y * y), li = Math.atan2(y, x);   // log z
    // (z - 1/2) log z - z + log(2 pi)/2
    var re = (x - 0.5) * lr - y * li - x + 0.9189385332046728;
    var im = (x - 0.5) * li + y * lr - y;
    // sum BST[k] / z^(2k+1): 1/z = (x - i y)/|z|^2
    var m2 = x * x + y * y, ir = x / m2, ii = -y / m2;         // 1/z
    var z2r = ir * ir - ii * ii, z2i = 2 * ir * ii;            // 1/z^2
    var tr = ir, ti = ii;
    for (var k = 0; k < BST.length; k++) {
      re += BST[k] * tr; im += BST[k] * ti;
      var nr = tr * z2r - ti * z2i; ti = tr * z2i + ti * z2r; tr = nr;
    }
    return { re: re - sr, im: im - si };
  }
  function lnGammaR(x) { return lnGammaC(x, 0).re; }

  // nuclear radius in fm (the convention of the page) and in natural units
  function radius(A) { return 1.2 * Math.cbrt(A); }

  // log of the point-charge Fermi function; sgn = +1 electron, -1 positron; Z the daughter charge; Rn in hbar/m_e c.
  // p may be passed when known (from T: p = sqrt(t (t + 2)), t = T / m_e c^2): sqrt(W^2 - 1) loses digits near
  // threshold, which matters where F0 is astronomically small (positrons at 10 eV, F0 ~ 1e-150)
  function momentum(W, p) { return p != null ? p : Math.sqrt(Math.max((W - 1) * (W + 1), 1e-300)); }
  function lnF0(Z, W, Rn, sgn, p) {
    if (Z === 0) return 0;
    p = momentum(W, p);
    var aZ = ALPHA * Z;
    var g = Math.sqrt(1 - aZ * aZ), y = sgn * aZ * W / p;
    return Math.log(4) + 2 * (g - 1) * Math.log(2 * p * Rn) + Math.PI * y + 2 * lnGammaC(g, y).re - 2 * lnGammaR(1 + 2 * g);
  }
  function F0(Z, W, Rn, sgn, p) { return Math.exp(lnF0(Z, W, Rn, sgn, p)); }
  // nonrelativistic: 2 pi y / (1 - exp(-2 pi y)), written to stay finite for either sign of y
  function FNR(Z, W, sgn, p) {
    if (Z === 0) return 1;
    p = momentum(W, p);
    var x = 2 * Math.PI * sgn * ALPHA * Z * W / p;
    if (Math.abs(x) < 1e-8) return 1 + x / 2;
    return x > 0 ? x / (1 - Math.exp(-x)) : -x * Math.exp(x) / (1 - Math.exp(x));
  }
  // finite-size factor L0 (Hayen et al. Eq. (L0)); rows a_{-1}, a_0 ... a_5, columns b_1 ... b_6, electrons then positrons
  var L0E = [[0.115, -1.8123, 8.2498, -11.223, -14.854, 32.086],
    [-0.00062, 0.007165, 0.01841, -0.53736, 1.2691, -1.5467],
    [0.02482, -0.5975, 4.84199, -15.3374, 23.9774, -12.6534],
    [-0.14038, 3.64953, -38.8143, 172.1368, -346.708, 288.7873],
    [0.008152, -1.15664, 49.9663, -273.711, 657.6292, -603.7033],
    [1.2145, -23.9931, 149.9718, -471.2985, 662.1909, -305.6804],
    [-1.5632, 33.4192, -255.1333, 938.5297, -1641.2845, 1095.358]];
  var L0P = [[0.0701, -2.572, 27.5971, -128.658, 272.264, -214.925],
    [-0.002308, 0.066463, -0.6407, 2.63606, -5.6317, 4.0011],
    [0.07936, -2.09284, 18.45462, -80.9375, 160.8384, -124.8927],
    [-0.93832, 22.02513, -197.00221, 807.1878, -1566.6077, 1156.3287],
    [4.276181, -96.82411, 835.26505, -3355.8441, 6411.3255, -4681.573],
    [-8.2135, 179.0862, -1492.1295, 5872.5362, -11038.7299, 7963.4701],
    [5.4583, -115.8922, 940.8305, -3633.9181, 6727.6296, -4795.0481]];
  function L0(Z, W, Rn, sgn) {
    if (Z === 0) return 1;
    var aZ = ALPHA * Z, g = Math.sqrt(1 - aZ * aZ), B = sgn > 0 ? L0E : L0P, a = [];
    for (var n = 0; n < 7; n++) { var v = 0; for (var x = 1; x <= 6; x++) v += B[n][x - 1] * Math.pow(aZ, x); a.push(v); }
    var WR = W * Rn, s = 1 + 13 / 60 * aZ * aZ
      - sgn * aZ * WR * (41 - 26 * g) / (15 * (2 * g - 1))
      - sgn * aZ * Rn * g * (17 - 2 * g) / (30 * W * (2 * g - 1))
      + a[0] * Rn / W;
    for (var k = 0; k <= 5; k++) s += a[k + 1] * Math.pow(WR, k);
    return s + (sgn > 0 ? 0.41 : 0.22) * (Rn - 0.0164) * Math.pow(aZ, 4.5);
  }
  // F by kind: 'rel' F0 L0, 'f0' F0 alone, 'nr', 'none' (F = 1)
  function fermi(kind, Z, W, Rn, sgn, p) {
    return kind === 'nr' ? FNR(Z, W, sgn, p) : kind === 'none' ? 1 : kind === 'f0' ? F0(Z, W, Rn, sgn, p) : F0(Z, W, Rn, sgn, p) * L0(Z, W, Rn, sgn);
  }

  // ---------- Gauss-Legendre nodes on [0, 1]
  function gaussLegendre(n) {
    var x = new Float64Array(n), w = new Float64Array(n);
    for (var i = 0; i < Math.ceil(n / 2); i++) {
      var z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp, z1;
      do {
        var p1 = 1, p2 = 0;
        for (var j = 1; j <= n; j++) { var p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1);
        z1 = z; z = z1 - p1 / pp;
      } while (Math.abs(z - z1) > 1e-15);
      x[i] = 0.5 * (1 - z); x[n - 1 - i] = 0.5 * (1 + z);
      w[i] = w[n - 1 - i] = 1 / ((1 - z * z) * pp * pp);
    }
    return { x: x, w: w };
  }
  var GL = gaussLegendre(20);
  var NHALF = 30;                     // intervals [p0/2^(k+1), p0/2^k], k < NHALF, and [0, p0/2^NHALF]

  // the decay: Z daughter charge, A mass number, E0 endpoint kinetic energy (MeV), sgn +1 beta-, -1 beta+
  function setup(Z, A, E0, sgn, kind) {
    var W0 = 1 + E0 / ME;
    return { Z: Z, A: A, E0: E0, sgn: sgn, kind: kind || 'rel', W0: W0, p0: Math.sqrt(W0 * W0 - 1), Rn: radius(A) / LC };
  }
  // the integrand of f in p
  function fp(d, p) {
    var W = Math.sqrt(1 + p * p), q = d.W0 - W;
    return fermi(d.kind, d.Z, W, d.Rn, d.sgn, p) * p * p * q * q;
  }
  // statistical rate function f (dimensionless, m_e units)
  function rate(Z, A, E0, sgn, kind) {
    if (!(E0 > 0)) return 0;
    var d = setup(Z, A, E0, sgn, kind), s = 0;
    for (var k = 0; k <= NHALF; k++) {
      var b = d.p0 / Math.pow(2, k), a = k === NHALF ? 0 : b / 2, h = b - a;
      for (var i = 0; i < GL.x.length; i++) s += GL.w[i] * h * fp(d, a + h * GL.x[i]);
    }
    return s;
  }

  // spectrum in kinetic energy T (MeV): dN/dT, normalized to unit area by the f of the same kind
  // (dN/dT = F p W (W0 - W)^2 / (f m_e)); returns an array of [T, dN/dT, Kurie] on n + 1 points
  function spectrum(Z, A, E0, sgn, kind, n) {
    var d = setup(Z, A, E0, sgn, kind), f = rate(Z, A, E0, sgn, kind), out = [];
    n = n || 200;
    for (var i = 0; i <= n; i++) {
      // at T = 0 the electron's F p stays finite (F ~ 1/p): the first point is taken at T = 1e-7 E0
      var T = E0 * Math.max(i, 1e-7) / n, t = T / ME, W = 1 + t, p = Math.sqrt(t * (t + 2)), q = d.W0 - W;
      var N = fermi(d.kind, Z, W, d.Rn, sgn, p) * p * W * q * q / (f * ME);
      if (i === 0) T = 0;
      // Kurie: sqrt(N / (F p W)) is proportional to W0 - W for an allowed shape; in units where it equals (W0 - W) m_e
      out.push([T, N, q * ME]);
    }
    return { f: f, pts: out };
  }

  // inverse-CDF sampler of the kinetic energy (MeV), on a fine table (for the scene and its histogram)
  function sampler(Z, A, E0, sgn, kind) {
    var n = 800, s = spectrum(Z, A, E0, sgn, kind, n), c = new Float64Array(n + 1);
    for (var i = 1; i <= n; i++) c[i] = c[i - 1] + 0.5 * (s.pts[i][1] + s.pts[i - 1][1]) * (E0 / n);
    var tot = c[n];
    return function (u) {
      var t = u * tot, lo = 0, hi = n;
      while (hi - lo > 1) { var m = (lo + hi) >> 1; if (c[m] < t) lo = m; else hi = m; }
      var fr = c[hi] > c[lo] ? (t - c[lo]) / (c[hi] - c[lo]) : 0;
      return E0 * (lo + fr) / n;
    };
  }

  // ---------- data: AME2020 Q(beta-) rows [Z, N, Q keV, unc keV, est]; Q_EC(Z, N) = -Q(beta-) of (Z-1, N+1)
  function qTable(rows) {
    var T = new Map();
    for (var i = 0; i < rows.length; i++) T.set(rows[i][0] + ',' + rows[i][1], rows[i]);
    return {
      qbm: function (Z, N) { var r = T.get(Z + ',' + N); return r ? { Q: r[2] / 1000, u: r[3] / 1000, est: !!r[4] } : null; },
      qec: function (Z, N) { var r = T.get((Z - 1) + ',' + (N + 1)); return r ? { Q: -r[2] / 1000, u: r[3] / 1000, est: !!r[4] } : null; },
    };
  }

  // log10 of ft (s): f times the partial half-life T1/2 / BR (BR in %); for a ground-state Q and the total beta
  // branch this is a lower bound on the ground-state log ft, since part of the branch can feed excited states
  function logft(f, log10T, br) { return Math.log10(f) + log10T - Math.log10(br / 100); }

  // H&T row -> object (see assets/beta-data.js for the column order)
  function htRow(r) {
    return { parent: r[0], Zp: r[1], A: r[2], Q: r[3], uQ: r[4], f: r[5], uf: r[6], PEC: r[7], t: r[8], utp: r[9], utm: r[10],
      ft: r[11], uftp: r[12], uftm: r[13], dR: r[14], dCNS: r[15], udCNS: r[16], Ft: r[17], uFtp: r[18], uFtm: r[19], used: !!r[20] };
  }
  // the page's f for a superallowed transition: positron emission, daughter Z = Zp - 1, endpoint Q_EC - 2 m_e
  function htF(h, kind) { return rate(h.Zp - 1, h.A, h.Q / 1000 - 2 * ME, -1, kind); }

  var BETA = {
    HBARC: HBARC, ME: ME, ALPHA: ALPHA, LC: LC, LN2: LN2,
    lnGammaC: lnGammaC, momentum: momentum, radius: radius, lnF0: lnF0, F0: F0, L0: L0, FNR: FNR, fermi: fermi,
    rate: rate, spectrum: spectrum, sampler: sampler, qTable: qTable, logft: logft, htRow: htRow, htF: htF
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BETA; else root.BETA = BETA;
})(this);
