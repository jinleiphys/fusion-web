/* nuclearjs one-nucleon transfer: the few closed formulas transfer.html computes live (no DWBA here; the
   reaction calculations are FRESCO runs shipped as data, assets/transfer-data.js).
   Plain script (window.TRANSFER) that also loads in node (module.exports); checked by tests/check_transfer.js
   against tests/transfer_ref.json, which tests/check_transfer.py computes independently.

   Units: MeV, fm, angles in degrees unless stated.

     kin(m1, m2, m3, m4, T1, thcm)  two-body reaction 1 + 2 -> 3 + 4, target 2 at rest, exact relativistic kinematics:
                                    invariant s = (m1 + m2)^2 + 2 m2 T1; c.m. momenta p = sqrt(lambda(s, ma^2, mb^2))/(2 sqrt s);
                                    ejectile 3 at c.m. angle thcm, boosted to the lab with the c.m. velocity.
                                    Returns Q = m1 + m2 - m3 - m4, c.m. kinetic energies, c.m. wave numbers k = p/hbar c,
                                    the ejectile's lab kinetic energy and lab angle
     q(ki, kf, mA, mB, thcm)        momentum given to the transferred neutron, |k_i - (m_A/m_B) k_f| (fm^-1): with plane
                                    waves the stripping amplitude carries the neutron's bound-state wave function at
                                    this momentum (derivation in the page's notes)
     sphj(l, x)                     spherical Bessel j_l(x), downward recurrence normalised to j_0 = sin x / x
     jlPeak(l)                      first maximum of j_l(x)^2 in x
     butler(l, R, qOf)              plane-wave (Butler) estimate of the first peak: the smallest c.m. angle where
                                    q(theta) R = jlPeak(l); null when q R exceeds it already at 0 degrees (then the
                                    estimate puts the peak at 0) or never reaches it
     interp(curve, th)              curve on a 1-degree c.m. grid (0..180), linear in log sigma
     fitS(data, curve, lo, hi)      spectroscopic factor: the least-squares scale of the curve (computed with S = 1)
                                    to the data points with lo <= theta <= hi, weights 1/err^2:
                                    S = sum(c d / e^2) / sum(c^2 / e^2); its statistical error 1/sqrt(sum c^2/e^2), and
                                    chi^2 per point of the scaled curve over the window
     firstMax(curve, from)          first local maximum of a curve at or after angle `from`
     forwardPeak(curve)             the forward peak shown on the page: the largest local maximum between 5 and 90
                                    degrees (a curve that only falls from 0 degrees returns 0)
*/
(function (root) {
  "use strict";
  const HBARC = 197.3269804;

  function lam(a, b, c) { return a * a + b * b + c * c - 2 * (a * b + a * c + b * c); }
  function kin(m1, m2, m3, m4, T1, thcm) {
    const s = (m1 + m2) ** 2 + 2 * m2 * T1, rs = Math.sqrt(s);
    const lf = lam(s, m3 * m3, m4 * m4);
    if (!(lf > 0) || rs <= m3 + m4) return null;
    const pi = Math.sqrt(lam(s, m1 * m1, m2 * m2)) / (2 * rs), pf = Math.sqrt(lf) / (2 * rs);
    const E3 = (s + m3 * m3 - m4 * m4) / (2 * rs);                     // ejectile total energy in the c.m.
    const p1 = Math.sqrt(T1 * (T1 + 2 * m1)), beta = p1 / (T1 + m1 + m2), gam = 1 / Math.sqrt(1 - beta * beta);
    const t = (thcm || 0) * Math.PI / 180;
    const pz = gam * (pf * Math.cos(t) + beta * E3), px = pf * Math.sin(t), El = gam * (E3 + beta * pf * Math.cos(t));
    return {
      Q: m1 + m2 - m3 - m4, Ecmi: rs - m1 - m2, Ecmf: rs - m3 - m4, pi, pf, ki: pi / HBARC, kf: pf / HBARC,
      T3: El - m3, th3: Math.atan2(px, pz) * 180 / Math.PI, beta, gam,
    };
  }
  function q(ki, kf, mA, mB, thcm) {
    const a = mA / mB, c = Math.cos(thcm * Math.PI / 180);
    return Math.sqrt(Math.max(0, ki * ki + a * a * kf * kf - 2 * a * ki * kf * c));
  }
  function sphj(l, x) {
    if (x === 0) return l === 0 ? 1 : 0;
    if (x < 1e-3 * (l + 1)) {                       // leading series term
      let d = 1; for (let k = 1; k <= l; k++) d *= 2 * k + 1;
      return Math.pow(x, l) / d * (1 - x * x / (2 * (2 * l + 3)));
    }
    const top = l + Math.ceil(Math.max(20, 2 * x)) + 20;
    let jp = 0, j = 1e-300, out = 0;
    for (let k = top; k > 0; k--) {                // j_{k-1} = (2k+1)/x j_k - j_{k+1}
      const jm = (2 * k + 1) / x * j - jp;
      jp = j; j = jm;
      if (Math.abs(j) > 1e250) { j *= 1e-250; jp *= 1e-250; out *= 1e-250; }
      if (k - 1 === l) out = j;
    }
    // j, jp now hold the unnormalised j_0, j_1: normalise with whichever exact value is larger
    const j0 = Math.sin(x) / x, j1 = Math.sin(x) / (x * x) - Math.cos(x) / x;
    return Math.abs(j0) > Math.abs(j1) ? out * j0 / j : out * j1 / jp;
  }
  const PEAK = {};
  function jlPeak(l) {
    if (PEAK[l] != null) return PEAK[l];
    if (l === 0) return (PEAK[0] = 0);
    const f = (x) => { const a = sphj(l, x); return a * a; };
    let x = 0.05, prev = f(x);
    for (x = 0.1; x < 4 * l + 20; x += 0.05) {
      const v = f(x);
      if (v < prev) break;
      prev = v;
    }
    let a = x - 0.1, b = x;                        // golden-section refinement on [a, b]
    const g = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 80; i++) {
      const c = b - g * (b - a), d = a + g * (b - a);
      if (f(c) > f(d)) b = d; else a = c;
    }
    return (PEAK[l] = 0.5 * (a + b));
  }
  function butler(l, R, qOf) {
    const x = jlPeak(l);
    if (qOf(0) * R >= x) return { at0: true, theta: 0 };
    if (qOf(180) * R < x) return null;
    let a = 0, b = 180;
    for (let i = 0; i < 60; i++) { const m = 0.5 * (a + b); if (qOf(m) * R < x) a = m; else b = m; }
    return { at0: false, theta: 0.5 * (a + b) };
  }
  function interp(curve, th) {
    const i = Math.min(179, Math.max(0, Math.floor(th))), t = th - i, a = curve[i], b = curve[i + 1];
    if (a > 0 && b > 0) return Math.exp(Math.log(a) * (1 - t) + Math.log(b) * t);
    return a * (1 - t) + b * t;
  }
  function fitS(data, curve, lo, hi) {
    let sxy = 0, sxx = 0, n = 0;
    const use = data.filter((d) => d[0] >= lo - 1e-9 && d[0] <= hi + 1e-9);
    for (const [th, v, e] of use) { const c = interp(curve, th); sxy += c * v / (e * e); sxx += c * c / (e * e); n++; }
    if (!n || !(sxx > 0)) return null;
    const S = sxy / sxx;
    let chi = 0;
    for (const [th, v, e] of use) chi += ((S * interp(curve, th) - v) / e) ** 2;
    return { S, dS: 1 / Math.sqrt(sxx), chi2: chi / n, n };
  }
  function firstMax(curve, from) {
    for (let i = Math.max(1, Math.ceil(from || 0)); i < curve.length - 1; i++) if (curve[i] >= curve[i - 1] && curve[i] > curve[i + 1]) return i;
    return null;
  }
  function forwardPeak(curve) {
    let best = null;
    for (let i = 5; i <= 90; i++) if (curve[i] >= curve[i - 1] && curve[i] > curve[i + 1] && (best == null || curve[i] > curve[best])) best = i;
    return best == null ? 0 : best;
  }
  const API = { HBARC, kin, q, sphj, jlPeak, butler, interp, fitS, firstMax, forwardPeak };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.TRANSFER = API;
})(typeof window !== "undefined" ? window : globalThis);
