/* ------------------------------------------------------------------ *
 * Quasi-free knockout A(p,pN)B and A(p,p alpha)B: exact relativistic
 * three-body kinematics only (the page shows published cross sections;
 * nothing here computes one).
 *
 * Particles: 0 incident proton, 1 outgoing proton, 2 struck nucleon or alpha,
 * A target, B residue. Lab frame L (z along the beam), three-body c.m. frame
 * G, rest frame of A ("A frame"; equals L in normal kinematics). For given
 * T1, Omega1, Omega2 energy and momentum conservation fix T2 (up to two roots;
 * the unsquared energy balance rejects spurious ones). Masses from AME2020.
 *
 * Plain script: window.QF in a browser, module.exports in Node.
 * Checked by tests/check_quasifree_kin.jl (256-bit roots of the unsquared
 * energy balance) and tests/check_pages.js (the page's wiring).
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var AMU = 931.49410242;
  var MP = 938.27208816, MN = 939.56542052, MALPHA = 3727.3794066;   // CODATA 2018, MeV
  var PI = Math.PI, DEG = PI / 180;

  /* cfg = { m0, mA, m1, m2, mB (MeV), T0 (MeV, lab kinetic energy of the projectile: the proton in normal
     kinematics, the nucleus A in inverse kinematics), inverse }. Momenta in MeV/c. */
  function boostZ(E, p, beta) {                       // p = [px, py, pz]; returns [E', px, py, pz']
    var g = 1 / Math.sqrt(1 - beta * beta);
    return [g * (E - beta * p[2]), p[0], p[1], g * (p[2] - beta * E)];
  }
  function dir(th, ph) { return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function Kin(cfg) {
    var c = Object.assign({}, cfg);
    var E0, p0, EA, pA;
    if (!c.inverse) { E0 = c.T0 + c.m0; p0 = Math.sqrt(c.T0 * (c.T0 + 2 * c.m0)); EA = c.mA; pA = 0; }
    else { EA = c.T0 + c.mA; pA = Math.sqrt(c.T0 * (c.T0 + 2 * c.mA)); E0 = c.m0; p0 = 0; }
    c.lab = { E0: E0, p0: [0, 0, p0], EA: EA, pA: [0, 0, pA] };
    c.Et = E0 + EA; c.Pz = p0 + pA;
    c.betaG = c.Pz / c.Et;
    c.betaA = pA / EA;                                // 0 in normal kinematics
    c.W = Math.sqrt(c.Et * c.Et - c.Pz * c.Pz);
    // kinetic energy of the proton in the A frame (normal: T0; inverse: (gamma - 1) m0)
    c.T0A = boostZ(E0, [0, 0, p0], c.betaA)[0] - c.m0;
    return c;
  }
  /* Final states for (T1, theta1, phi1, theta2, phi2) in the lab (angles in degrees). Returns up to two
     solutions (isol 1: larger p2), each with lab, G- and A-frame four-momenta of 1, 2, B. */
  function solve3(K, T1, th1, ph1, th2, ph2) {
    var m1 = K.m1, m2 = K.m2, mB = K.mB, E1 = T1 + m1, p1 = Math.sqrt(T1 * (T1 + 2 * m1));
    var n1 = dir(th1 * DEG, ph1 * DEG), n2 = dir(th2 * DEG, ph2 * DEG);
    var P1 = [p1 * n1[0], p1 * n1[1], p1 * n1[2]], q = [-P1[0], -P1[1], K.Pz - P1[2]], q2 = dot(q, q), qn = dot(q, n2);
    var ei = K.Et - E1, a = 0.5 * (ei * ei + m2 * m2 - mB * mB - q2);
    var A2 = ei * ei - qn * qn, D = a * a * qn * qn - A2 * (ei * ei * m2 * m2 - a * a);
    var out = [];
    if (D < 0 || ei <= 0) return out;
    var roots = [(a * qn + Math.sqrt(D)) / A2, (a * qn - Math.sqrt(D)) / A2];
    for (var s = 0; s < 2; s++) {
      var p2 = roots[s];
      if (!(p2 > 1e-9)) continue;
      var E2 = (a + p2 * qn) / ei;                    // the unsquared energy balance: rejects spurious roots
      if (!(E2 > m2)) continue;
      var EB = ei - E2;
      if (!(EB >= mB)) continue;
      if (s === 1 && Math.abs(roots[0] - roots[1]) < 1e-12 * Math.abs(roots[0])) continue;
      var P2 = [p2 * n2[0], p2 * n2[1], p2 * n2[2]], PB = [q[0] - P2[0], q[1] - P2[1], q[2] - P2[2]];
      out.push(finish(K, { E1: E1, P1: P1, E2: E2, P2: P2, EB: EB, PB: PB, isol: s + 1 }));
    }
    return out;
  }
  function finish(K, L) {
    var b = K.betaG, ba = K.betaA, lab = K.lab;
    function fr(E, P, beta) { var v = boostZ(E, P, beta); return { E: v[0], p: [v[1], v[2], v[3]] }; }
    var G = { 0: fr(lab.E0, lab.p0, b), A: fr(lab.EA, lab.pA, b), 1: fr(L.E1, L.P1, b), 2: fr(L.E2, L.P2, b), B: fr(L.EB, L.PB, b) };
    var Af = { 0: fr(lab.E0, lab.p0, ba), 1: fr(L.E1, L.P1, ba), 2: fr(L.E2, L.P2, ba), B: fr(L.EB, L.PB, ba) };
    var Lf = { 0: { E: lab.E0, p: lab.p0 }, A: { E: lab.EA, p: lab.pA }, 1: { E: L.E1, p: L.P1 }, 2: { E: L.E2, p: L.P2 }, B: { E: L.EB, p: L.PB } };
    var pBL = norm(L.PB);
    return {
      isol: L.isol, L: Lf, G: G, A: Af,
      T1: L.E1 - K.m1, T2: L.E2 - K.m2, TB: L.EB - K.mB,
      th2: Math.acos(Math.max(-1, Math.min(1, L.P2[2] / norm(L.P2)))) / DEG,
      // missing momentum: momentum of the struck particle inside A = -K_B in the A frame
      pm: [-Af.B.p[0], -Af.B.p[1], -Af.B.p[2]],
      // recoil momentum of Yoshida et al.: |K_B^L| signed by K_Bz^L (lab)
      pR: L.PB[2] === 0 ? pBL : pBL * Math.sign(L.PB[2]),
      // missing energy in the A frame: T0 - T1 - T2 - T_B (= separation energy + excitation)
      Em: (Af[0].E - K.m0) - (Af[1].E - K.m1) - (Af[2].E - K.m2) - (Af.B.E - K.mB),
    };
  }
  // the quasi-free (recoilless) point along T1 at fixed angles: minimum |K_B| (coarse scan, then golden section)
  function recoilless(K, th1, th2, ph2) {
    var f = function (T1) { var s = solve3(K, T1, th1, 0, th2, ph2 == null ? 180 : ph2); return s.length ? norm(s[0].L.B.p) : 1e9; };
    var a = 1, b = K.inverse ? K.T0A : K.T0, gr = (Math.sqrt(5) - 1) / 2;
    var best = a, fb = 1e99;
    for (var T = a; T < b; T += (b - a) / 400) { var v = f(T); if (v < fb) { fb = v; best = T; } }
    a = Math.max(1, best - (b - 1) / 400); b = best + (b - 1) / 400;
    var c = b - gr * (b - a), d = a + gr * (b - a);
    for (var it = 0; it < 80; it++) { if (f(c) < f(d)) b = d; else a = c; c = b - gr * (b - a); d = a + gr * (b - a); }
    return 0.5 * (a + b);
  }
  // the angle theta2 of minimum |K_B| at fixed T1, theta1 (coplanar, opposite sides)
  function recoillessTh2(K, T1, th1, lo, hi) {
    var f = function (th2) { var s = solve3(K, T1, th1, 0, th2, 180); return s.length ? norm(s[0].L.B.p) : 1e9; };
    var best = lo, fb = 1e99;
    for (var t = lo; t <= hi; t += (hi - lo) / 400) { var v = f(t); if (v < fb) { fb = v; best = t; } }
    var a = Math.max(lo, best - (hi - lo) / 400), b = Math.min(hi, best + (hi - lo) / 400), gr = (Math.sqrt(5) - 1) / 2;
    var c = b - gr * (b - a), d = a + gr * (b - a);
    for (var it = 0; it < 80; it++) { if (f(c) < f(d)) b = d; else a = c; c = b - gr * (b - a); d = a + gr * (b - a); }
    return 0.5 * (a + b);
  }

  /* ---------------------------------------------------------------- masses from AME2020
     Nuclear mass (MeV) = atomic mass - Z m_e + B_e(Z), B_e from Lunney, Pearson, Thibault, Rev. Mod. Phys. 75,
     1021 (2003), Eq. (A4): 14.4381 Z^2.39 + 1.55468e-6 Z^5.35 eV. */
  var ME = 0.51099895;
  function nucMass(AME, Z, N) {
    for (var i = 0; i < AME.length; i++) if (AME[i][0] === Z && AME[i][1] === N) {
      var D = AME[i][2] / 1000, A = Z + N;
      return A * AMU + D - Z * ME + (14.4381 * Math.pow(Z, 2.39) + 1.55468e-6 * Math.pow(Z, 5.35)) * 1e-6;
    }
    return null;
  }

  /* ---------------------------------------------------------------- the page's cases (kinematics only)
     scan: the variable the page's slider moves. 'th2': theta2 at fixed T1, theta1 (a published configuration);
     'T1' with sym: symmetric angles chosen so that equal energy sharing is recoilless. */
  var CASES = [
    { id: '12C', ZA: 6, NA: 6, kind: 'pN', N: 'p', T0: 392, scan: { scan: 'th2', T1: 251, th1: 32.5, from: 28, to: 72 },
      ref: 'kinematics of the 12C(p,2p) sample of Ogata, Yoshida, Chazono, Comput. Phys. Commun. 297, 109058 (2024), Fig. 1' },
    { id: '16O', ZA: 8, NA: 8, kind: 'pN', N: 'p', T0: 392, scan: { scan: 'T1', sym: true, span: 0.36 },
      ref: 'symmetric angles, recoilless at equal energies (an illustration, not a measured setting)' },
    { id: '16On', ZA: 8, NA: 8, kind: 'pN', N: 'n', T0: 392, scan: { scan: 'T1', sym: true, span: 0.36 },
      ref: 'symmetric angles, recoilless at equal energies (an illustration, not a measured setting)' },
    { id: '40Ca', ZA: 20, NA: 20, kind: 'pN', N: 'p', T0: 392, scan: { scan: 'T1', sym: true, span: 0.36 },
      ref: 'symmetric angles, recoilless at equal energies (an illustration, not a measured setting)' },
    { id: '20Ne', ZA: 10, NA: 10, kind: 'pa', T0: 392, scan: { scan: 'th2', T1: 352, th1: 32.5, from: 27, to: 108 },
      ref: 'kinematics of Yoshida, Ogata, Kanada-En’yo, Phys. Rev. C 98, 024614 (2018): T₁ = 352 MeV, θ₁ = 32.5°, θα 27° to 108°' },
    { id: '120Sn', ZA: 50, NA: 70, kind: 'pa', T0: 392, scan: { scan: 'th2', T1: 328, th1: 43.2, from: 48, to: 74 },
      ref: 'kinematics of Yoshida, Minomo, Ogata, Phys. Rev. C 94, 044604 (2016) and Yoshida, Ogata, Kanada-En’yo (2018): T₁ = 328 MeV, θ₁ = 43.2°' },
  ];
  function findMass(AME, Z, N) { var m = nucMass(AME, Z, N); if (m == null) throw new Error('no AME2020 mass for Z=' + Z + ' N=' + N); return m; }
  function massExcess(AME, Z, N) { for (var i = 0; i < AME.length; i++) if (AME[i][0] === Z && AME[i][1] === N) return AME[i][2] / 1000; return null; }
  /* masses, separation energy and kinematics of a case. S: from the bare nuclear masses, the one energy and momentum
     balance uses (E_m = S at any setting); Satom: from atomic mass excesses, the separation energy tabulated and quoted
     in papers (they differ by the electrons' binding, 16 keV for 120Sn -> 116Cd + alpha) */
  function kinCase(c, AME, T0) {
    var pa = c.kind === 'pa', ZB = c.ZA - (pa ? 2 : c.N === 'p' ? 1 : 0), NB = c.NA - (pa ? 2 : c.N === 'n' ? 1 : 0);
    var mA = findMass(AME, c.ZA, c.NA), mB = findMass(AME, ZB, NB), m2 = pa ? MALPHA : c.N === 'p' ? MP : MN;
    var K = Kin({ m0: MP, mA: mA, m1: MP, m2: m2, mB: mB, T0: T0 || c.T0, inverse: false });
    var Z2 = pa ? 2 : c.N === 'p' ? 1 : 0, N2 = pa ? 2 : c.N === 'n' ? 1 : 0;
    var Satom = massExcess(AME, ZB, NB) + massExcess(AME, Z2, N2) - massExcess(AME, c.ZA, c.NA);
    return { c: c, K: K, ZB: ZB, NB: NB, S: mB + m2 - mA, Satom: Satom, m2: m2 };
  }
  // the slider range of a case; for the symmetric cases the angle where equal energy sharing is recoilless
  function caseScan(kc) {
    var c = kc.c, K = kc.K, sc = Object.assign({}, c.scan);
    if (sc.sym) {
      var Tsh = 0.5 * (K.T0A - kc.S);
      var f = function (th) { var s = solve3(K, Tsh, th, 0, th, 180); return s.length ? s[0].L.B.p[2] : NaN; };
      var a = 20, b = 50;
      for (var it = 0; it < 80; it++) { var m = 0.5 * (a + b), fm = f(m); if (fm < 0) a = m; else b = m; }
      sc.th1 = sc.th2 = Math.round(0.5 * (a + b) * 10) / 10;
      sc.from = Math.round(Tsh * (1 - sc.span)); sc.to = Math.round(Tsh * (1 + sc.span));
      sc.x0 = recoilless(K, sc.th1, sc.th2, 180);
    } else sc.x0 = recoillessTh2(K, sc.T1, sc.th1, sc.from, sc.to);
    return sc;
  }
  // the kinematic point at slider value x
  function at(kc, sc, x) {
    var s = sc.scan === 'th2' ? solve3(kc.K, sc.T1, sc.th1, 0, x, 180) : solve3(kc.K, x, sc.th1, 0, sc.th2, 180);
    return s.length ? s[0] : null;
  }

  var QF = {
    AMU: AMU, MP: MP, MN: MN, MALPHA: MALPHA,
    Kin: Kin, solve3: solve3, boostZ: boostZ, recoilless: recoilless, recoillessTh2: recoillessTh2,
    nucMass: nucMass, CASES: CASES, kinCase: kinCase, caseScan: caseScan, at: at,
  };
  if (isNode) module.exports = QF; else root.QF = QF;
})(this);
