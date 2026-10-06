/* ------------------------------------------------------------------ *
 * Accelerator physics for accelerator.html. Pure functions, no DOM; runs in the
 * browser (window.ACCEL) and in node (module.exports) for tests/check_accel*.
 *
 * Units: energies MeV, momenta MeV/c, lengths m, fields T, rigidity T m.
 *
 * Masses. NUBASE2020 (assets/nubase.js) gives B/A; with the AME convention
 *   B = Z M(1H) + N m_n - M_atom
 * the atomic mass is M_atom = Z M(1H) + N m_n - A (B/A). An ion of charge
 * state Q has lost Q electrons: M_ion = M_atom - Q m_e + B_e(Q), where B_e(Q)
 * is the binding energy of the removed electrons. B_e is neglected: for a bare
 * uranium nucleus it is about 0.76 MeV, 3.4e-6 of the mass, below every other
 * uncertainty here.
 * Constants: CODATA 2018 (u, m_e, m_n, M(1H) = 1.00782503223 u from AME2020).
 * ------------------------------------------------------------------ */
(function (root) {
"use strict";

const U = 931.49410242;               // MeV, atomic mass unit
const ME = 0.51099895000;             // MeV
const MN = 1.00866491595 * U;         // MeV, neutron
const MH = 1.00782503223 * U;         // MeV, 1H atom
const C = 299792458;                  // m/s
const CB = C * 1e-6;                  // B rho [T m] = p [MeV/c] / (Q * CB)
const ALPHA = 1 / 137.035999084;

// ---------- masses and kinematics
// row: [Z, N, sym, log10 T1/2, mode, B/A, est, J^pi, year] from NUBASE2020
function massAtom(Z, N, BA) { return Z * MH + N * MN - (Z + N) * BA; }
function makeIon(Z, N, Q, BA) {
  const A = Z + N;
  const Ma = massAtom(Z, N, BA);
  return { Z, N, A, Q, BA, Matom: Ma, M: Ma - Q * ME };
}
// Kinetic energy per nucleon Tn (MeV per nucleon, A = mass number): T = A Tn.
// Facilities quote "MeV/u" with this meaning; per atomic mass unit would differ
// by M/(A u) - 1, 2.5e-4 for 238U.
function kin(ion, Tn) {
  const T = ion.A * Tn, M = ion.M;
  const g = 1 + T / M;
  const bg = Math.sqrt(T * (T + 2 * M)) / M;   // beta gamma, stable at low T
  const b = bg / g;
  const p = bg * M;                            // MeV/c
  return {
    T, gamma: g, beta: b, bg, p,
    brho: p / (ion.Q * CB),                    // T m
    erho: p * b / ion.Q,                       // MV, electric rigidity p v / q
  };
}
// inverse: kinetic energy per nucleon at a given rigidity
function tnFromBrho(ion, brho) {
  const p = brho * ion.Q * CB;
  return (Math.sqrt(p * p + ion.M * ion.M) - ion.M) / ion.A;
}

// ---------- cyclotron
// revolution frequency f = Q e B / (2 pi gamma M), M in kg via M c^2
function frev(ion, B, Tn) {
  const g = 1 + ion.A * Tn / ion.M;
  return ion.Q * B * C * C * 1e-6 / (2 * Math.PI * g * ion.M);   // Hz
}
// Isochronous field: B(r) = B0 gamma(r), gamma(r) = 1/sqrt(1 - (r/rinf)^2),
// rinf = c / omega, omega = Q e B0 / M (the non-relativistic cyclotron frequency).
function rInf(ion, B0) { return ion.M / (ion.Q * CB * B0); }   // m
function isoField(ion, B0, r) { const x = r / rInf(ion, B0); return B0 / Math.sqrt(1 - x * x); }
// In that field the revolution frequency is the same on every orbit: f = Q e B(r) / (2 pi gamma M)
// with B(r) = B0 gamma gives Q e B0 / (2 pi M). B0 is the central field, not an average.
function frevIso(ion, B0) { return frev(ion, B0, 0); }
// K value: E/A = K (Q/A)^2 with E the kinetic energy (non-relativistic definition).
// In the non-relativistic limit K = e^2 (B rho)^2 / (2 u). The rigidity actually needed for
// a kinetic energy Tn per nucleon at mass M/A per nucleon is
//   B rho = (A/Q) sqrt(Tn (Tn + 2 M/A)) / c  =  B rho_nonrel * sqrt(1 + Tn / (2 M/A)).
const K_PER_BRHO2 = (CB * CB) / (2 * U);       // MeV per (T m)^2, = 48.24
function kEnergy(K, ion) { return K * (ion.Q / ion.A) ** 2; }   // MeV per nucleon
// Two limits on the energy a cyclotron can deliver (both non-relativistic definitions):
//   bending  E/A = K_B (Q/A)^2   (Fukunishi, HIAT2015: "the bending limit of cyclotron energy")
//   focusing E/A = K_F (Q/A)     (the conventional form for the vertical-focusing limit; the value of K_F
//                                 is tabulated in HIAT2015, the form is not given there)
// The lower one applies; null when K_F is not known for the machine.
function cycLimits(KB, KF, ion) {
  const bend = KB * (ion.Q / ion.A) ** 2, focus = KF ? KF * (ion.Q / ion.A) : null;
  return { bend, focus, lim: focus == null ? bend : Math.min(bend, focus), by: focus != null && focus < bend ? "focusing" : "bending" };
}
function kOfBrho(brho) { return K_PER_BRHO2 * brho * brho; }

// ---------- linac
// drift-tube cell length: beta lambda / 2 (Wideroe, pi mode) or beta lambda (Alvarez, 2 pi mode)
function cellLength(ion, Tn, fHz, mode) {
  const b = kin(ion, Tn).beta, lam = C / fHz;
  return (mode === "alvarez" ? 1 : 0.5) * b * lam;
}

// two-gap (pi-mode) cavity, geometric beta bg: the gap centres are bg lambda / 2 apart, the fields
// opposite, so a particle of velocity beta gains V0 |sin(pi bg / (2 beta))| at the best phase
// (thin gaps; the finite-gap factor sin(pi g/(beta lambda))/(pi g/(beta lambda)) is left out).
function ttf2(beta, bg) { return Math.abs(Math.sin(Math.PI * bg / (2 * beta))); }

// ---------- charge stripping: Baron's empirical formula (carbon foils, equilibrium), as quoted in
// Z. He et al., arXiv:1611.04637, Eq. (30), from E. Baron et al., Nucl. Instrum. Methods A 328, 177 (1993):
//   Qbar/Z = 1 - exp(-83.275 beta / Z^0.447)
//   Qave  = Qbar (1 - exp(-12.905 + 0.2124 Z - 0.00122 Z^2))
//   d     = sqrt(Qbar (0.07535 + 0.19 Y - 0.2654 Y^2)),  Y = Qbar / Z,   Gaussian distribution of width d
function baron(Z, beta) {
  const qb = Z * (1 - Math.exp(-83.275 * beta / Math.pow(Z, 0.447)));
  const qa = qb * (1 - Math.exp(-12.905 + 0.2124 * Z - 0.00122 * Z * Z));
  const Y = qb / Z;
  const d2 = qb * (0.07535 + 0.19 * Y - 0.2654 * Y * Y);
  return { qbar: qb, qave: qa, d: Math.sqrt(Math.max(0, d2)), d2 };
}
// Domain. The width polynomial 0.07535 + 0.19 Y - 0.2654 Y^2 falls to zero at Y = 0.99995, so as the ion
// approaches bare the fit returns a width that shrinks to nothing: a Gaussian over charge states no longer
// describes a distribution then made of the last one or two K electrons (H-like, He-like, bare). The page
// uses the fit only while the Gaussian is wider than half a charge unit and lies inside the physical
// range, Qave + 3d <= Z. Outside, chargeDist still returns finite fractions (the mean split between the two
// neighbouring integers), flagged inDomain = false, and the page says the fit does not apply.
const BARON_DMIN = 0.5;
function baronInDomain(b, Z) { return b.d >= BARON_DMIN && b.qave + 3 * b.d <= Z; }
// fractions in each integer charge state 0..Z: Gaussian of mean qave and width d, normalized over 0..Z
function chargeDist(Z, beta) {
  const b = baron(Z, beta), inDomain = baronInDomain(b, Z);
  const f = new Array(Z + 1).fill(0);
  if (inDomain) {
    let s = 0;
    for (let q = 0; q <= Z; q++) { f[q] = Math.exp(-0.5 * ((q - b.qave) / b.d) ** 2); s += f[q]; }
    for (let q = 0; q <= Z; q++) f[q] /= s;
  } else {
    const m = Math.min(Z, Math.max(0, b.qave)), lo = Math.floor(m), w = m - lo;
    f[lo] += 1 - w; if (w > 0) f[lo + 1] += w;
  }
  return { ...b, inDomain, f };
}

// ---------- focusing strengths for a given rigidity
// quadrupole: 1/f = G l / (B rho);  solenoid (thin, Larmor frame, both planes): 1/f = B^2 l / (4 (B rho)^2)
function quadGradient(brho, f, l) { return brho / (f * l); }
function solenoidF(brho, B, l) { return 4 * brho * brho / (B * B * l); }
// Solenoid channel of the focusing panel: field B over length ls in a cell of length Ls. The solenoid
// must fit in the cell, ls <= SOL_FILL Ls; a longer request is cut to that, and the focal length and the
// matrix both use the cut length, so the field inside the magnet is B as set. Returns the length used.
const SOL_FILL = 0.95;
function solenoidChannel(brho, B, ls, Ls, nper) {
  const l = Math.min(ls, Math.floor(SOL_FILL * Ls * 100 + 1e-9) / 100);   // on the 0.01 m grid of the control
  const f = solenoidF(brho, B, l);
  const D = fodo(f, Ls, l, nper, "sol");
  D.fsol = f; D.ls = l;
  return D;
}

// ---------- FODO cell
// Cell: QF/2 - drift - QD - drift - QF/2, quadrupole centres L = Lc/2 apart.
// Thin lens: sin(mu/2) = Lc / (4 f), stable for f > Lc/4, Tr M = 2 - Lc^2/(4 f^2),
// beta_max,min = Lc (1 +- sin(mu/2)) / sin(mu) at the F and D quadrupole centres.
function fodoThin(f, Lc) {
  const s = Lc / (4 * f);
  const tr = 2 - Lc * Lc / (4 * f * f);
  if (Math.abs(s) >= 1) return { stable: false, tr, s };
  const mu = 2 * Math.asin(s), sm = Math.sin(mu);
  return { stable: true, tr, s, mu, bmax: Lc * (1 + s) / sm, bmin: Lc * (1 - s) / sm };
}
// thin solenoid channel (drift Lc/2, lens f, drift Lc/2): Tr M = 2 - Lc/f, cos mu = 1 - Lc/(2f),
// stable for 0 < Lc/f < 4. beta = M12 / sin(mu): at the lens M12 = Lc, at mid-drift M12 = Lc (1 - Lc/(4f)).
function solThin(f, Lc) {
  const tr = 2 - Lc / f, c = tr / 2;
  if (Math.abs(c) >= 1) return { stable: false, tr, s: Lc / (4 * f) };
  const mu = Math.acos(c), sm = Math.sin(mu);
  const bmid = Lc * (1 - Lc / (4 * f)) / sm, blens = Lc / sm;
  return { stable: true, tr, s: Lc / (4 * f), mu, bmax: Math.max(bmid, blens), bmin: Math.min(bmid, blens) };
}
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
const drift = (l) => [1, l, 0, 1];
// quadrupole of length l and strength k (1/m^2), k > 0 focusing in this plane
function quad(k, l) {
  if (l === 0) return [1, 0, -k, 1];          // here k is the thin-lens 1/f
  if (Math.abs(k) < 1e-14) return drift(l);
  if (k > 0) { const w = Math.sqrt(k), c = Math.cos(w * l), s = Math.sin(w * l); return [c, s / w, -w * s, c]; }
  const w = Math.sqrt(-k), c = Math.cosh(w * l), s = Math.sinh(w * l);
  return [c, s / w, w * s, c];
}
// Element list of one cell in the given plane (sign +1 horizontal, -1 vertical).
// lq = 0: thin lenses of focal length f. lq > 0: thick quads, k = 1/(f lq), same integrated strength.
function fodoElements(f, Lc, lq, sign, type) {
  if (type === "sol") {
    // solenoid channel: drift - solenoid - drift, the same focusing in both planes (Larmor frame)
    const d = (Lc - lq) / 2;
    if (lq > 0) return [["d", 0, d], ["q", 1 / (f * lq), lq], ["d", 0, d]];
    return [["d", 0, Lc / 2], ["q", 1 / f, 0], ["d", 0, Lc / 2]];
  }
  const L = Lc / 2, d = L - lq;
  const kF = lq > 0 ? sign / (f * lq) : sign / f, kD = -kF;
  if (lq > 0) return [["q", kF, lq / 2], ["d", 0, d], ["q", kD, lq], ["d", 0, d], ["q", kF, lq / 2]];
  return [["q", kF / 2, 0], ["d", 0, L], ["q", kD, 0], ["d", 0, L], ["q", kF / 2, 0]];
}
function elemMatrix(e, l) {
  const len = l == null ? e[2] : l;
  return e[0] === "d" ? drift(len) : quad(e[1], e[2] === 0 ? 0 : len);
}
function cellMatrix(els) { let M = [1, 0, 0, 1]; for (const e of els) M = mul(elemMatrix(e), M); return M; }
// Full numerical analysis: matrix, stability, phase advance, beta(s) by Twiss propagation.
function fodo(f, Lc, lq, nper, type) {
  lq = lq || 0;
  const out = { f, Lc, lq, type: type || "fodo", planes: {} };
  for (const [name, sg] of [["x", 1], ["y", -1]]) {
    const els = fodoElements(f, Lc, lq, sg, type);
    const M = cellMatrix(els), tr = M[0] + M[3];
    const P = { M, tr, stable: Math.abs(tr) < 2, els };
    if (P.stable) {
      const cmu = tr / 2;
      let smu = Math.sqrt(1 - cmu * cmu);
      if (M[1] < 0) smu = -smu;                  // sign of sin(mu) follows M12
      P.mu = Math.atan2(smu, cmu); if (P.mu < 0) P.mu += 2 * Math.PI;
      const b0 = M[1] / smu, a0 = (M[0] - M[3]) / (2 * smu);
      P.beta0 = b0; P.alpha0 = a0;
      // propagate (beta, alpha, gamma) through the cell in small steps
      const s = [], beta = [];
      let bb = b0, aa = a0, gg = (1 + a0 * a0) / b0, pos = 0;
      s.push(0); beta.push(bb);
      for (const e of els) {
        const len = e[2], n = len === 0 ? 1 : 2 * Math.max(1, Math.ceil(len / (2 * Lc / (nper || 400))));   // even: element centres are samples
        for (let i = 0; i < n; i++) {
          const m = len === 0 ? elemMatrix(e) : elemMatrix(e, len / n);
          const [C11, C12, C21, C22] = m;
          const nb = C11 * C11 * bb - 2 * C11 * C12 * aa + C12 * C12 * gg;
          const na = -C11 * C21 * bb + (C11 * C22 + C12 * C21) * aa - C12 * C22 * gg;
          const ng = C21 * C21 * bb - 2 * C21 * C22 * aa + C22 * C22 * gg;
          bb = nb; aa = na; gg = ng;
          if (len > 0) { pos += len / n; s.push(pos); beta.push(bb); }
        }
      }
      P.s = s; P.beta = beta;
      P.bmax = Math.max(...beta); P.bmin = Math.min(...beta);
    }
    out.planes[name] = P;
  }
  out.thin = type === "sol" ? solThin(f, Lc) : fodoThin(f, Lc);
  return out;
}
// Track rays (x, x') through ncell cells; returns arrays of s and x per ray.
// Used for the betatron-oscillation picture (stable) and the blow-up (unstable).
function track(f, Lc, lq, rays, ncell, sign, step, type) {
  const els = fodoElements(f, Lc, lq || 0, sign || 1, type);
  const ds = step || Lc / 60;
  return rays.map(([x0, xp0]) => {
    let x = x0, xp = xp0, pos = 0;
    const S = [0], X = [x0];
    for (let c = 0; c < ncell; c++) {
      for (const e of els) {
        if (e[2] === 0) { const m = elemMatrix(e); [x, xp] = [m[0] * x + m[1] * xp, m[2] * x + m[3] * xp]; continue; }
        const n = Math.max(1, Math.ceil(e[2] / ds)), l = e[2] / n, m = elemMatrix(e, l);
        for (let i = 0; i < n; i++) { [x, xp] = [m[0] * x + m[1] * xp, m[2] * x + m[3] * xp]; pos += l; S.push(pos); X.push(x); }
      }
    }
    return { S, X };
  });
}

// ---------- stopping power (Bethe) for the wedge degrader
// -dE/dx = K z^2 (Zt/At) / beta^2 [ (1/2) ln(2 me c^2 b^2 g^2 Wmax / I^2) - b^2 + Lbloch ]
//   K = 4 pi N_A r_e^2 m_e c^2 = 0.307075 MeV cm^2/mol
//   Wmax = 2 me c^2 b^2 g^2 / (1 + 2 g me/M + (me/M)^2)
//   Lbloch = psi(1) - Re psi(1 + i y) = -y^2 sum_n 1/(n (n^2 + y^2)), y = z alpha / beta  (Bloch)
//   z: effective charge Z [1 - exp(-0.95 v / (v0 Z^(2/3)))]  (Pierce and Blann 1968)
// Left out: shell corrections, Barkas term, density effect, the Lindhard-Sorensen (Mott)
// correction for very heavy ions. tests/check_accel.py measures what that costs against
// NIST PSTAR/ASTAR and measured heavy-ion stopping in Be and Al.
const KB = 0.307075;
const MAT = {
  Be: { Z: 4, A: 9.012182, I: 63.7e-6, rho: 1.848 },     // I, density: ICRU 49 / NIST STAR
  Al: { Z: 13, A: 26.981538, I: 166e-6, rho: 2.699 },
};
function bloch(y) {
  let s = 0; const y2 = y * y;
  for (let n = 1; n <= 400; n++) s += 1 / (n * (n * n + y2));
  s += 1 / (2 * 400 * 400);                      // tail of sum 1/n^3
  return -y2 * s;
}
function zeff(Z, beta) { return Z * (1 - Math.exp(-0.95 * beta / (ALPHA * Math.pow(Z, 2 / 3)))); }
// stopping in MeV cm^2/g for a projectile of nuclear charge Z, mass M (MeV) at kinetic energy T (MeV)
function bethe(Z, M, T, mat) {
  const m = MAT[mat];
  const g = 1 + T / M, b2 = 1 - 1 / (g * g), bg2 = b2 * g * g, b = Math.sqrt(b2);
  const z = zeff(Z, b);
  const r = ME / M;
  const W = 2 * ME * bg2 / (1 + 2 * g * r + r * r);
  const L = 0.5 * Math.log(2 * ME * bg2 * W / (m.I * m.I)) - b2 + bloch(z * ALPHA / b);
  return Math.max(0, KB * z * z * (m.Z / m.A) / b2 * L);
}
// energy after a slab of t g/cm^2 (RK4 in depth); 0 if the ion stops (taken as T/A < 0.5 MeV)
function slab(Z, M, A, T, t, mat, n) {
  n = n || 200;
  const h = t / n, Tstop = 0.5 * A;
  for (let i = 0; i < n; i++) {
    const k1 = bethe(Z, M, T, mat);
    const k2 = bethe(Z, M, Math.max(Tstop, T - 0.5 * h * k1), mat);
    const k3 = bethe(Z, M, Math.max(Tstop, T - 0.5 * h * k2), mat);
    const k4 = bethe(Z, M, Math.max(Tstop, T - h * k3), mat);
    T -= h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    if (T <= Tstop) return 0;
  }
  return T;
}
// range (g/cm^2) from T down to 0.5 MeV/u, by integrating dT / S on a log grid
function range(Z, M, A, T, mat) {
  const T0 = 0.5 * A;
  if (T <= T0) return 0;
  const n = 400, l0 = Math.log(T0), l1 = Math.log(T);
  let R = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.exp(l0 + (l1 - l0) * i / n), c = Math.exp(l0 + (l1 - l0) * (i + 1) / n), mid = Math.sqrt(a * c);
    // Simpson on the log grid
    const fa = a / bethe(Z, M, a, mat), fm = mid / bethe(Z, M, mid, mat), fc = c / bethe(Z, M, c, mat);
    R += (l1 - l0) / n * (fa + 4 * fm + fc) / 6;
  }
  return R;
}

// ---------- in-flight separator: B rho - Delta E - B rho
// Fragments leave the target at the projectile velocity (same gamma), fully stripped (Q = Z).
// Stage 1 keeps |B rho / B rho_ref - 1| < acc; a flat slab of degrader (thickness t,
// set as a fraction of the reference fragment's range) slows each survivor by its own Bethe
// loss; stage 2 keeps |B rho' / B rho'_ref - 1| < acc.
// Fragments a beam (Z, N) can make, as the separator panel offers them: lighter in Z and N, A >= 2, a
// NUBASE mass, and T1/2 >= 100 ns (they decay before the focal plane otherwise). nuc: NUBASE rows.
// A proton beam makes none; the panel says so.
function sepCandidates(nuc, Z, N) {
  const out = [];
  for (const r of nuc) {
    if (r[0] < 1 || r[0] > Z || r[1] > N || r[5] == null || r[3] == null) continue;
    if (r[0] + r[1] < 2) continue;
    if (r[3] !== 99 && r[3] < -7) continue;          // T1/2 < 100 ns
    out.push({ Z: r[0], N: r[1], BA: r[5] });
  }
  return out;
}
// cands: [{Z, N, BA}], ref: {Z, N, BA}, gamma: beam Lorentz factor
function separator(cands, ref, gamma, acc, dOverR, mat) {
  const tnOf = (io) => (gamma - 1) * io.M / io.A;
  const ionR = makeIon(ref.Z, ref.N, ref.Z, ref.BA);
  const kR = kin(ionR, tnOf(ionR));
  const RR = range(ref.Z, ionR.M, ionR.A, kR.T, mat);
  const t = dOverR * RR;                                 // g/cm^2
  const TR2 = slab(ref.Z, ionR.M, ionR.A, kR.T, t, mat);
  const ion2 = TR2 > 0 ? kin(ionR, TR2 / ionR.A) : null;
  const out = { t, tmm: 10 * t / MAT[mat].rho, range: RR, Tn1: kR.T / ionR.A, Tn2: TR2 / ionR.A,
    brho1: kR.brho, brho2: ion2 ? ion2.brho : 0, list: [] };
  for (const c of cands) {
    const io = makeIon(c.Z, c.N, c.Z, c.BA);
    const k1 = kin(io, tnOf(io));
    const d1 = k1.brho / kR.brho - 1;
    const r = { Z: c.Z, N: c.N, A: io.A, d1, pass1: Math.abs(d1) < acc, d2: null, pass2: false, Tn2: null, stopped: false };
    if (r.pass1 && ion2) {
      const T2 = slab(c.Z, io.M, io.A, k1.T, t, mat);
      if (T2 > 0) {
        r.Tn2 = T2 / io.A;
        r.d2 = kin(io, r.Tn2).brho / out.brho2 - 1;
        r.pass2 = Math.abs(r.d2) < acc;
      } else r.stopped = true;
    }
    out.list.push(r);
  }
  return out;
}

const ACCEL = {
  U, ME, MN, MH, C, CB, ALPHA, K_PER_BRHO2, KB, MAT,
  massAtom, makeIon, kin, tnFromBrho,
  frev, frevIso, rInf, isoField, kEnergy, cycLimits, kOfBrho, baronInDomain, BARON_DMIN, solenoidChannel, SOL_FILL, sepCandidates, cellLength, ttf2, baron, chargeDist, quadGradient, solenoidF, solThin,
  fodoThin, fodo, track, fodoElements, cellMatrix, mul, drift, quad,
  bloch, zeff, bethe, slab, range, separator,
};
if (typeof module !== "undefined" && module.exports) module.exports = ACCEL;
else root.ACCEL = ACCEL;
})(typeof window !== "undefined" ? window : globalThis);
