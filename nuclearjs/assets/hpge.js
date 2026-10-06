/* nuclearjs: photon transport in a germanium crystal, the Monte Carlo behind hpge.html.
   Plain script; in the browser it defines window.HPGE (needs assets/hpge-data.js first), in Node
   `require("./assets/hpge.js")` returns the same object (it loads hpge-data.js itself).

   Physics (what is in, what is left out):
   - attenuation: NIST XCOM partial mass coefficients for Ge and Pb (photoelectric, incoherent, pair in
     the nuclear and in the electron field), log-log interpolation between the tabulated energies, the
     edge rows taken as the values just above each edge. Coherent (Rayleigh) scattering is omitted:
     it is left out of the total too, so a photon never takes a Rayleigh step.
   - incoherent scattering: the XCOM cross section (which includes binding) decides how often it
     happens, the free-electron Klein-Nishina distribution decides the angle and the energy
     (E' = E / (1 + k (1 - cos th)), k = E / m_e c^2); no Doppler broadening.
   - photoelectric absorption: the whole photon energy is deposited at the point (no fluorescence,
     so no Ge or Pb X-ray escape).
   - pair production (both fields): E - 2 m_e c^2 deposited at the point, two photons of m_e c^2 leave
     back to back in an isotropic direction (positron range and annihilation in flight neglected).
   - every electron deposits its energy where it is made (no bremsstrahlung, no electron escape).
   - geometry: a closed-end coaxial crystal, a cylinder of radius R and length L with a core hole of
     radius rb and depth db drilled from the back face (see setup()); the source is a point on the axis at distance d in front of the front face; optionally a lead
     block behind the source. No end cap, no dead layer, no holder: a bare crystal in vacuum.
   Units: cm, keV. */
(function (root) {
  "use strict";
  const DATA = (typeof module !== "undefined" && module.exports) ? require("./hpge-data.js") : root.HPGE_DATA;
  const ME = DATA.me;                                   // m_e c^2 in keV (CODATA 2018)

  // ---------- attenuation coefficients (1/cm) from the XCOM tables
  function material(key) {
    const t = DATA.xs[key], rho = DATA.rho[key], n = t.E.length;
    const lE = new Float64Array(n), E = new Float64Array(n);
    for (let i = 0; i < n; i++) { E[i] = t.E[i] * 1000; lE[i] = Math.log(E[i]); }
    const comp = {};
    for (const k of ["photo", "incoh", "pairN", "pairE", "coh"]) comp[k] = Float64Array.from(t[k], (v) => v * rho);
    // interpolate one component on [i, i+1]: log-log where both ends are positive, else linear
    const ip = (a, i, f, x) => (a[i] > 0 && a[i + 1] > 0 ? Math.exp(Math.log(a[i]) + f * (Math.log(a[i + 1]) - Math.log(a[i]))) : a[i] + (a[i + 1] - a[i]) * (x - E[i]) / (E[i + 1] - E[i]));
    // the largest i with E[i] <= x: at an edge (two rows with the same energy) that is the row above the edge
    function idx(x) {
      let lo = 0, hi = n - 1;
      if (x <= E[0]) return 0;
      if (x >= E[n - 2]) return n - 2;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (E[m] <= x) lo = m; else hi = m; }
      return lo;
    }
    return {
      key, rho, Emin: E[0], Emax: E[n - 1],
      // {photo, incoh, pair, coh, tot}: tot = photo + incoh + pair (no coherent), 1/cm
      mu(x) {
        const i = idx(x), f = (Math.log(x) - lE[i]) / (lE[i + 1] - lE[i]);
        const photo = ip(comp.photo, i, f, x), incoh = ip(comp.incoh, i, f, x);
        const pair = x > 2 * ME ? ip(comp.pairN, i, f, x) + ip(comp.pairE, i, f, x) : 0;
        return { photo, incoh, pair, coh: ip(comp.coh, i, f, x), tot: photo + incoh + pair };
      },
    };
  }
  const MAT = { ge: material("ge"), pb: material("pb") };

  // ---------- random numbers: sfc32 (seeded for the tests), or Math.random
  function rng(seed) {
    if (seed == null) return Math.random;
    let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = seed >>> 0;
    const f = () => {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 12; i++) f();
    return () => { let u; do u = f(); while (u === 0); return u; };
  }

  // ---------- Klein-Nishina: eps = E'/E and cos th for a photon of energy E (keV).
  // Butcher-Messel sampling as in Geant4's G4KleinNishinaCompton: eps from the mixture
  // 1/eps on [eps0, 1] and eps on [eps0, 1], accepted with 1 - eps sin^2 th / (1 + eps^2).
  function sampleKN(E, R) {
    const k = E / ME, e0 = 1 / (1 + 2 * k), e0s = e0 * e0;
    const a1 = -Math.log(e0), a2 = a1 + 0.5 * (1 - e0s);
    let eps, oc;
    for (;;) {
      let es;
      if (a1 > a2 * R()) { eps = Math.exp(-a1 * R()); es = eps * eps; }
      else { es = e0s + (1 - e0s) * R(); eps = Math.sqrt(es); }
      oc = (1 - eps) / (eps * k);
      const s2 = oc * (2 - oc);
      if (1 - eps * s2 / (1 + es) >= R()) break;
    }
    return { eps, cos: 1 - oc };
  }
  // Klein-Nishina dsigma/dOmega in units of r_e^2 (for the plots; the test has its own)
  function dsdoKN(E, c) {
    const P = 1 / (1 + (E / ME) * (1 - c));
    return 0.5 * P * P * (P + 1 / P - (1 - c * c));
  }
  const comptonEdge = (E) => E * 2 * E / (ME + 2 * E);          // largest energy given to the electron
  const backscatter = (E) => E / (1 + 2 * E / ME);              // photon energy after 180 degrees

  // ---------- geometry. Bodies are convex pieces; a ray (o, u) gives the parameter interval inside each.
  function cylIv(ox, oy, oz, ux, uy, uz, R, z0, z1) {
    let t0 = -Infinity, t1 = Infinity;
    const a = ux * ux + uy * uy, b = ox * ux + oy * uy, c = ox * ox + oy * oy - R * R;
    if (a < 1e-14) { if (c > 0) return null; }
    else {
      const D = b * b - a * c;
      if (D <= 0) return null;
      const s = Math.sqrt(D);
      t0 = (-b - s) / a; t1 = (-b + s) / a;
    }
    if (Math.abs(uz) < 1e-14) { if (oz < z0 || oz > z1) return null; }
    else {
      let p = (z0 - oz) / uz, q = (z1 - oz) / uz;
      if (p > q) { const w = p; p = q; q = w; }
      if (p > t0) t0 = p;
      if (q < t1) t1 = q;
    }
    return t1 > t0 ? [t0, t1] : null;
  }
  function boxIv(ox, oy, oz, ux, uy, uz, hx, hy, z0, z1) {
    let t0 = -Infinity, t1 = Infinity;
    const lo = [-hx, -hy, z0], hi = [hx, hy, z1], o = [ox, oy, oz], u = [ux, uy, uz];
    for (let k = 0; k < 3; k++) {
      if (Math.abs(u[k]) < 1e-14) { if (o[k] < lo[k] || o[k] > hi[k]) return null; continue; }
      let p = (lo[k] - o[k]) / u[k], q = (hi[k] - o[k]) / u[k];
      if (p > q) { const w = p; p = q; q = w; }
      if (p > t0) t0 = p;
      if (q < t1) t1 = q;
    }
    return t1 > t0 ? [t0, t1] : null;
  }
  /* A setup: crystal radius R, length L (front face at z = 0, back face at z = L), core hole radius rb
     from z = L - db to the back face; source at (0, 0, -d); lead block (half-width hw, thickness tPb)
     whose front face is gap behind the source, if pb is true. */
  function setup(o) {
    const g = Object.assign({ R: 3, L: 6, rb: 0.5, db: 4.5, d: 10, pb: false, gap: 3, tPb: 5, hw: 10 }, o || {});
    g.db = Math.min(g.db, g.L);
    g.zs = -g.d;
    g.pz1 = g.zs - g.gap; g.pz0 = g.pz1 - g.tPb;
    // emission strata: the cone around +z that holds the whole crystal, the cone around -z that holds the block
    g.cosC = g.d / Math.hypot(g.d, g.R);                                  // nearest rim = widest angle
    g.cosP = g.gap / Math.hypot(g.gap, g.hw * Math.SQRT2);
    g.omC = (1 - g.cosC) / 2;                                              // solid angle / 4 pi
    g.omP = (1 - g.cosP) / 2;
    g.pC = g.pb ? 0.7 : 1;                                                 // share of histories in each stratum
    return g;
  }
  // the pieces of material along the ray, sorted, clipped to t > 0: [t0, t1, material]
  function pieces(g, ox, oy, oz, ux, uy, uz, out) {
    out.length = 0;
    const c = cylIv(ox, oy, oz, ux, uy, uz, g.R, 0, g.L);
    if (c) {
      const h = g.rb > 0 && g.db > 0 ? cylIv(ox, oy, oz, ux, uy, uz, g.rb, g.L - g.db, g.L) : null;
      if (!h || h[1] <= c[0] || h[0] >= c[1]) out.push([c[0], c[1], MAT.ge]);
      else {
        if (h[0] > c[0]) out.push([c[0], h[0], MAT.ge]);
        if (h[1] < c[1]) out.push([h[1], c[1], MAT.ge]);
      }
    }
    if (g.pb) { const b = boxIv(ox, oy, oz, ux, uy, uz, g.hw, g.hw, g.pz0, g.pz1); if (b) out.push([b[0], b[1], MAT.pb]); }
    for (let i = out.length - 1; i >= 0; i--) { if (out[i][1] <= 1e-9) out.splice(i, 1); else if (out[i][0] < 0) out[i][0] = 0; }
    if (out.length > 1) out.sort((a, b) => a[0] - b[0]);
    return out;
  }
  function insideGe(g, x, y, z) {
    const r2 = x * x + y * y;
    if (z < 0 || z > g.L || r2 > g.R * g.R) return false;
    return !(r2 < g.rb * g.rb && z > g.L - g.db);
  }

  // a direction rotated by (cos th, phi) about u
  function turn(u, c, phi) {
    const s = Math.sqrt(Math.max(0, 1 - c * c)), cp = Math.cos(phi), sp = Math.sin(phi);
    const [ux, uy, uz] = u;
    if (Math.abs(uz) > 0.99999) { const sg = uz > 0 ? 1 : -1; return [s * cp, s * sp, sg * c]; }
    const q = Math.sqrt(1 - uz * uz);
    return [c * ux + s * (ux * uz * cp - uy * sp) / q, c * uy + s * (uy * uz * cp + ux * sp) / q, c * uz - s * q * cp];
  }
  function isoDir(R) { const c = 2 * R() - 1, s = Math.sqrt(1 - c * c), p = 2 * Math.PI * R(); return [s * Math.cos(p), s * Math.sin(p), c]; }

  // an emission direction from the source and its weight (probability per emitted photon)
  function emit(g, R) {
    const toPb = g.pb && R() >= g.pC;
    const cmin = toPb ? g.cosP : g.cosC;
    const c = cmin + (1 - cmin) * R(), s = Math.sqrt(1 - c * c), p = 2 * Math.PI * R();
    const w = toPb ? g.omP / (1 - g.pC) : g.omC / g.pC;
    return { u: [s * Math.cos(p), s * Math.sin(p), toPb ? -c : c], w };
  }

  const ECUT = 1;          // keV: below this a photon is absorbed where it is (the XCOM tables start at 1 keV)
  /* Follow one photon and everything it makes. Returns the energy deposited in the crystal.
     rec (optional) collects the history for drawing: rec.seg = [[x0,y0,z0,x1,y1,z1,E,kind]],
     rec.pts = [[x,y,z,type,edep,inGe]] (type: 1 photoelectric, 2 Compton, 3 pair, 4 cut). */
  const BUF = [];
  function history(g, E0, u0, R, rec) {
    const stack = [[0, 0, g.zs, u0[0], u0[1], u0[2], E0, 0]];
    let dep = 0;
    while (stack.length) {
      let [x, y, z, ux, uy, uz, E, kind] = stack.pop();
      for (;;) {
        const P = pieces(g, x, y, z, ux, uy, uz, BUF);
        let tau = -Math.log(R()), hit = null, th = 0;
        for (const [t0, t1, m] of P) {
          const mu = m.mu(E).tot, L = (t1 - t0) * mu;
          if (tau < L) { hit = m; th = t0 + tau / mu; break; }
          tau -= L;
        }
        if (!hit) {
          if (rec) { const T = P.length ? P[P.length - 1][1] + 25 : 60; rec.seg.push([x, y, z, x + ux * T, y + uy * T, z + uz * T, E, kind]); }
          break;
        }
        const nx = x + ux * th, ny = y + uy * th, nz = z + uz * th;
        if (rec) rec.seg.push([x, y, z, nx, ny, nz, E, kind]);
        x = nx; y = ny; z = nz;
        const inGe = hit === MAT.ge, mu = hit.mu(E), r = R() * mu.tot;
        if (r < mu.photo) {
          if (inGe) dep += E;
          if (rec) rec.pts.push([x, y, z, 1, E, inGe]);
          break;
        } else if (r < mu.photo + mu.incoh) {
          const s = sampleKN(E, R), E1 = s.eps * E;
          if (inGe) dep += E - E1;
          if (rec) rec.pts.push([x, y, z, 2, E - E1, inGe]);
          [ux, uy, uz] = turn([ux, uy, uz], s.cos, 2 * Math.PI * R());
          E = E1;
          if (E < ECUT) { if (inGe) dep += E; break; }
        } else {
          if (inGe) dep += E - 2 * ME;
          if (rec) rec.pts.push([x, y, z, 3, E - 2 * ME, inGe]);
          const v = isoDir(R);
          stack.push([x, y, z, v[0], v[1], v[2], ME, 1], [x, y, z, -v[0], -v[1], -v[2], ME, 1]);
          break;
        }
      }
    }
    return dep;
  }

  // ---------- a source as a sampler of lines (probability proportional to the intensity per decay)
  function lineSampler(lines) {
    const cw = []; let s = 0;
    for (const l of lines) { s += l[2]; cw.push(s); }
    return {
      perDecay: s / 100,                       // photons per decay in the list
      pick(R) { const x = R() * s; let lo = 0, hi = cw.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cw[m] < x) lo = m + 1; else hi = m; } return lo; },
    };
  }

  /* A running spectrum: deposits binned at bw keV, weights summed, so spec[i] / n is the expected count
     per emitted photon in bin i (spec2: the squared weights). full[k] / emitted[k] is the full-energy probability of line k per photon of
     that line, any[k] / emitted[k] the probability of any deposit; full2 sums the squared weights. */
  function Spectrum(g, lines, bw, seed) {
    this.g = g; this.lines = lines; this.bw = bw || 0.1;
    this.Emax = Math.max(...lines.map((l) => l[0])) + 30;
    this.nb = Math.ceil(this.Emax / this.bw);
    this.spec = new Float64Array(this.nb); this.spec2 = new Float64Array(this.nb);
    this.full = new Float64Array(lines.length); this.full2 = new Float64Array(lines.length); this.any = new Float64Array(lines.length); this.emitted = new Float64Array(lines.length);
    this.n = 0; this.R = rng(seed); this.ls = lineSampler(lines);
  }
  Spectrum.prototype.run = function (N) {
    const g = this.g, R = this.R, L = this.lines;
    for (let i = 0; i < N; i++) {
      const k = this.ls.pick(R), E = L[k][0], e = emit(g, R);
      this.emitted[k]++;
      const d = history(g, E, e.u, R, null);
      this.n++;
      if (d > 0) {
        const b = Math.floor(d / this.bw);
        if (b < this.nb) { this.spec[b] += e.w; this.spec2[b] += e.w * e.w; }
        this.any[k] += e.w;
        if (Math.abs(d - E) < 1e-6 * E) { this.full[k] += e.w; this.full2[k] += e.w * e.w; }
      }
    }
  };
  /* efficiency of one energy, accumulated in steps: full-energy and total (any deposit) probabilities per emitted
     photon, with the standard errors of the weighted means */
  function Efficiency(g, E, seed) { this.g = g; this.E = E; this.R = rng(seed); this.n = 0; this.sf = 0; this.sf2 = 0; this.sa = 0; this.sa2 = 0; }
  Efficiency.prototype.run = function (N) {
    const g = this.g, R = this.R, E = this.E;
    for (let i = 0; i < N; i++) {
      const e = emit(g, R), d = history(g, E, e.u, R, null);
      if (d > 0) { this.sa += e.w; this.sa2 += e.w * e.w; if (Math.abs(d - E) < 1e-6 * E) { this.sf += e.w; this.sf2 += e.w * e.w; } }
    }
    this.n += N;
  };
  Efficiency.prototype.result = function () {
    const N = Math.max(1, this.n), m = (s, s2) => [s / N, Math.sqrt(Math.max(0, s2 / N - (s / N) ** 2) / N)];
    const [ef, df] = m(this.sf, this.sf2), [et, dt] = m(this.sa, this.sa2);
    return { E: this.E, N: this.n, eff: ef, deff: df, tot: et, dtot: dt, pt: et > 0 ? ef / et : 0 };
  };
  function efficiency(g, E, N, seed) { const a = new Efficiency(g, E, seed); a.run(N); return a.result(); }

  /* Gaussian resolution FWHM(E) = sqrt(a^2 + b E), fixed by the FWHM at two energies E1 < E2. It passes
     through both only if F1 <= F2 <= F1 sqrt(E2/E1) (a^2 >= 0, b >= 0); outside that range it clips (b or a^2
     set to 0) and fwhmModel.ok(...) is false. hpge.html keeps its two sliders inside the range. */
  function fwhmModel(E1, F1, E2, F2) {
    let b = (F2 * F2 - F1 * F1) / (E2 - E1); if (b < 0) b = 0;
    const a2 = Math.max(0, F1 * F1 - b * E1);
    return (E) => Math.sqrt(a2 + b * E);
  }
  fwhmModel.ok = (E1, F1, E2, F2) => F2 >= F1 && F2 <= F1 * Math.sqrt(E2 / E1);
  // fold a fine histogram (bin width bw, starting at 0) with that Gaussian onto channels of width cw
  function fold(spec, bw, fw, cw, nch) {
    const out = new Float64Array(nch);
    const SQ = 1 / (2 * Math.sqrt(2 * Math.log(2)));
    for (let i = 0; i < spec.length; i++) {
      const v = spec[i]; if (!v) continue;
      const E = (i + 0.5) * bw, s = Math.max(fw(E) * SQ, 1e-3);
      const c0 = Math.max(0, Math.floor((E - 5 * s) / cw)), c1 = Math.min(nch - 1, Math.floor((E + 5 * s) / cw));
      let prev = 0.5 * (1 + erf((c0 * cw - E) / (s * Math.SQRT2)));
      for (let c = c0; c <= c1; c++) {
        const nx = 0.5 * (1 + erf(((c + 1) * cw - E) / (s * Math.SQRT2)));
        out[c] += v * (nx - prev); prev = nx;
      }
    }
    return out;
  }
  // erf, Abramowitz-Stegun 7.1.26 (|error| < 1.5e-7), enough for display
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }

  const HPGE = { DATA, ME, MAT, rng, sampleKN, dsdoKN, comptonEdge, backscatter, setup, pieces, insideGe, emit, history,
    turn, Spectrum, Efficiency, efficiency, fwhmModel, fold, lineSampler, cylIv, boxIv };
  if (typeof module !== "undefined" && module.exports) module.exports = HPGE; else root.HPGE = HPGE;
})(this);
