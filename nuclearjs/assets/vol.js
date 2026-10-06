/* nuclearjs volume rendering: assets/vol.js. Plain script (no modules, works from file://); load
   after assets/three-bundle.js and assets/three-post.js. Defines window.VOL. Used by nucleus.html,
   halo.html, deformed.html.

   FIELDS (CPU side; every value drawn is sampled from the density the page computed)
   Each builder returns a field F for Volume.setField. A field holds up to three channels (texture
   r, g, b), each with a colour; per channel the transfer function maps the density to x in [0, 1]:
     tf: { type: "lin" }        x = rho / rho_max                      (default)
         { type: "pow", g }     x = (rho / rho_max)^g                  (g = 0.5: |psi| for an orbital)
         { type: "log", D }     x = max(0, 1 + log10(rho / rho_max)/D) (D decades, for halo tails)
         any tf may add floor:  x -> max(0, (x - floor)/(1 - floor))  (explicitly empty below floor)
   rho_max is shared by channels with the same `group`, so neutrons and protons keep their ratio.
   Opacity sigma = s0 sum_i weight_i x_i, emission coefficient s0 sum_i emission_i x_i colour_i (weight
   and emission default 1), multiplied in the shader by (uEm0 + (1 - uEm0) min(sum_i x_i, 1)), uEm0 =
   0.12: for one channel the emission goes as 0.12 x + 0.88 x^2, not as x, so dense regions glow and
   thin tails stay dim. s0 is fixed by `tau`, the optical depth of a horizontal diameter.
     VOL.radialField({ r, channels: [{ rho, color, group, tf, weight, emission }], rmax, tau, NR })
         spherical density from radial tables on the grid r (e.g. WS.solve(...).G.r and .species.n.rho)
     VOL.orbitalField({ r, u, angular, color, tf, rmax, tau, NR, NU })
         one orbital, (u(r)/r)^2 times angular(cos theta) (e.g. x => WS.angular(l, j2, m2, x));
         default tf |psi| with floor 0.05
     VOL.field({ rmax, r0, ss, sz, NR, NU, tau, channels: [{ f(r, u), ... }] })
         general axially symmetric density on a (radius, cos theta) table; symmetry axis = y.
         ss, sz scale the lab axes (a stretched-coordinate Nilsson orbital: ss = b_perp, sz = b_z);
         r0 > 0 maps radius logarithmically, log(1 + r/r0), for fields spanning 3 to 600 fm
     VOL.grid3D({ n: [nx, ny, nz], half: [hx, hy, hz], f(x, y, z, out), channels, tau })
         a density on a 3D box grid (Data3DTexture), for shapes without axial symmetry. An axially
         symmetric one is sharper and far cheaper through VOL.field.
     any builder takes iso: [{ w: [w0, w1, w2], level, alpha, rim }] (at most two): lit contour shells
         where q = sum_i w_i x_i / max(q) crosses level, shaded as surfaces (normal from the gradient of
         q, key light with the key transmittance, a view-relative fill, Blinn-Phong highlight, Fresnel
         rim, occlusion from q sampled outside along the normal); rim = 1 keeps mostly the edge-on part.

   VOLUME (GPU side)
     const vol = new VOL.Volume({ steps = 128, coarse = 1, cheap = false }); scene.add(vol.mesh);
     vol.setField(F, fade, stepping)   fade: cross-fade from the previous field with vol.setMix(0..1)
                                       stepping: { min, k, max } steps growing with radius (halos)
     vol.setExposure(k)                emission scale (default 0.75)
     vol.setOpacity(k)                 multiplies all absorption (transfer-function opacity)
     vol.quality                       step multiplier >= 1; VOL.Governor(vol).tick(dt) raises it
                                       when frames are slow (the cheap path for weak GPUs)
     cheap: true                       64 steps, no gradient shading
     uniforms (vol.u): uAmb, uKey (light), uGrad (gradient shading, 0 = off), uShB, uShAmb, uShKey,
       uSpec (iso-shell brightness, ambient, key, highlight), uFaceB (cut-face brightness, < 0: uBright), uCut + VOL.Cut
       (camera-facing wedge cut-away, vol.useCut(cut)), uSlab/uFwd (slab of half-width uSlab along
       the view), uFace (cut-face stain thickness, fm: the face is drawn as a layer of the density at
       the face, integrated over this fixed, synthetic thickness), uFaceSplit (the stained layer of
       the left face masked to channel 0, of the right face to channel 1; behind the layer the
       march continues through all channels, so the face is tinted, not an isolated slice), uFloorY (nothing below the floor), uSkip/uSkipOn (skip what glass covers).
     The mesh is a back-faced box drawn in the opaque list with premultiplied blending, after
     renderOrder < 10 (floor, shadow, grid) and before transmissive glass, which then shows it.
     Emission-absorption along each ray, front to back, exact per segment for constant coefficients;
     single scattering of an overhead key light from a precomputed transmittance (alpha of a 3D grid,
     a second table for VOL.field); optional gradient (surface) shading. The fragment shader ends
     with tonemapping and colorspace chunks, so it is correct on screen and in an EffectComposer.

   STAGE AND MATERIALS
     VOL.studioEnv(renderer)    PMREM texture of a soft procedural studio (no files)
     VOL.glassMaterial(opts)    MeshPhysicalMaterial glass: transmission 1, thin wall, ior 1.45, clearcoat
     VOL.lightRig(scene)        key (overhead) and rim directional lights + dim hemisphere
     VOL.Stage(scene)           .layout(floorY, extent), .setShadow(F, height), .fadeGrid(grid),
                                .update(camera): matte floor disc, contact shadow (the attenuation
                                1 - exp(-int sigma dy) of an overhead light through F, Gaussian-
                                blurred and scaled by 0.62), scale bar in fm
     VOL.Cut()                  .update(camera, target); .A, .B (wedge normals), .planes (for
                                material.clippingPlanes with clipIntersection: true)

   Minimal use (a 208Pb density background):
     const res = WS.solve(82, 126), vol = new VOL.Volume({ steps: 96 });
     vol.setField(VOL.radialField({ r: res.G.r, tau: 3, channels: [
       { rho: res.species.n.rho, color: new THREE.Color("#a8cdf2") },
       { rho: res.species.p.rho, color: new THREE.Color("#ff9656") } ] }));
     scene.add(vol.mesh);   // the nucleus sits at the origin, radius about 12 fm
*/
(function () {
  "use strict";
  const VOL = {};

  // ---------------------------------------------------------------- radial map shared by JS and GLSL
  // t = g(v) in [0, 1]: linear (r0 = 0) or logarithmic, log(1 + v/r0)/log(1 + vmax/r0), for halos
  // that span the core (3 fm) and a tail at hundreds of fm in one texture
  const gmap = (v, vmax, r0) => (r0 > 0 ? Math.log1p(v / r0) / Math.log1p(vmax / r0) : v / vmax);
  const ginv = (t, vmax, r0) => (r0 > 0 ? r0 * Math.expm1(t * Math.log1p(vmax / r0)) : t * vmax);

  /* ---------------------------------------------------------------- field
     o = { rmax, r0, ss, sz, NR, NU, tau, channels: [{ f(r, u), group, tf, color, weight }] }
     tf: { type: "lin" } x = rho/rho_max
         { type: "pow", g } x = (rho/rho_max)^g
         { type: "log", D } x = max(0, 1 + log10(rho/rho_max)/D)   (D decades)
     any tf may carry floor: x -> max(0, (x - floor)/(1 - floor)), an explicit empty window
     rho_max is shared inside a group, so relative densities in a group are kept.
     tau: optical depth of a horizontal diameter through the centre, which fixes the opacity scale. */
  VOL.field = function (o) {
    const NR = o.NR || 192, NU = o.NU || 1, rmax = o.rmax, r0 = o.r0 || 0, ss = o.ss || 1, sz = o.sz || 1;
    const ch = o.channels.slice(0, 3);
    const raw = ch.map(() => new Float64Array(NR * NU));
    for (let c = 0; c < ch.length; c++) {
      const f = ch[c].f, A = raw[c];
      for (let i = 0; i < NR; i++) {
        const r = ginv((i + 0.5) / NR, rmax, r0);
        for (let j = 0; j < NU; j++) A[i * NU + j] = Math.max(0, f(r, NU === 1 ? 0 : -1 + (j + 0.5) * 2 / NU));
      }
    }
    const data = new Float32Array(NR * NU * 4);
    applyTF(ch, raw, NR * NU, data);
    const w = [0, 0, 0];
    ch.forEach((c, k) => (w[k] = c.weight == null ? 1 : c.weight));
    // bilinear lookup of the transfer value, exactly as the GPU does it (texel centres, clamp to edge)
    function X(r, u) {
      const t = gmap(r, rmax, r0);
      if (t >= 1) return [0, 0, 0];
      const fi = Math.min(NR - 1, Math.max(0, t * NR - 0.5)), i0 = Math.floor(fi), i1 = Math.min(NR - 1, i0 + 1), a = fi - i0;
      let j0 = 0, j1 = 0, b = 0;
      if (NU > 1) {
        const fj = Math.min(NU - 1, Math.max(0, (0.5 + 0.5 * u) * NU - 0.5));
        j0 = Math.floor(fj); j1 = Math.min(NU - 1, j0 + 1); b = fj - j0;
      }
      const out = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const v00 = data[(i0 * NU + j0) * 4 + c], v10 = data[(i1 * NU + j0) * 4 + c];
        const v01 = data[(i0 * NU + j1) * 4 + c], v11 = data[(i1 * NU + j1) * 4 + c];
        out[c] = (1 - a) * ((1 - b) * v00 + b * v01) + a * ((1 - b) * v10 + b * v11);
      }
      return out;
    }
    // lab point (s = cylinder radius, y along the axis) to the stretched (r, u) of the texture
    function Xlab(s, y) {
      const a = s / ss, b = y / sz, r = Math.hypot(a, b);
      return X(r, r > 0 ? b / r : 0);
    }
    const sigOf = (x) => w[0] * x[0] + w[1] * x[1] + w[2] * x[2];
    // opacity scale: tau through the centre along a horizontal diameter
    const Smax = rmax * ss, Ymax = rmax * sz;
    let I = 0;
    { const n = 2000; for (let k = 0; k < n; k++) { const s = (k + 0.5) / n * Smax; I += 2 * sigOf(Xlab(s, 0)) * Smax / n; } }
    const s0 = I > 0 ? (o.tau || 2.5) / I : 1;
    const sig = [w[0] * s0, w[1] * s0, w[2] * s0];
    // emission coefficient per channel: s0 e_i (e_i = channel.emission, default 1), so that with
    // e = w the emission per unit opacity is the channel colour
    const em = [0, 1, 2].map((k) => s0 * (ch[k] && ch[k].emission != null ? ch[k].emission : 1));
    // overhead key light: transmittance from the top of the box down to (s, y)
    const NS = o.NS || 96, NY = o.NY || 160, light = new Float32Array(NS * NY);
    const shadowT = new Float64Array(NS);
    const yOf = (j) => { const yc = (j + 0.5) / NY, d = 2 * yc - 1; return Math.sign(d) * ginv(Math.abs(d), Ymax, r0); };
    for (let i = 0; i < NS; i++) {
      const s = ginv((i + 0.5) / NS, Smax, r0);
      let od = 0, yPrev = Ymax;
      for (let j = NY - 1; j >= 0; j--) {
        const y = yOf(j), sub = 4, dy = (yPrev - y) / sub;
        for (let q = 0; q < sub; q++) od += s0 * sigOf(Xlab(s, yPrev - (q + 0.5) * dy)) * dy;
        light[j * NS + i] = Math.exp(-od);
        yPrev = y;
      }
      let od2 = od; { const sub = 8, dy = (yPrev + Ymax) / sub; for (let q = 0; q < sub; q++) od2 += s0 * sigOf(Xlab(s, yPrev - (q + 0.5) * dy)) * dy; }
      shadowT[i] = Math.exp(-od2);
    }
    const shadowS = new Float64Array(NS);
    for (let i = 0; i < NS; i++) shadowS[i] = ginv((i + 0.5) / NS, Smax, r0);
    const cols = ch.map((c) => (c.color ? c.color.clone() : new THREE.Color(1, 1, 1)));
    while (cols.length < 3) cols.push(new THREE.Color(0, 0, 0));
    return { kind: "rt", half: [rmax * ss, rmax * sz, rmax * ss], NR, NU, data, rmax, r0, ss, sz, sig, em, cols, light, NS, NY, Smax, Ymax, shadow: { s: shadowS, T: shadowT }, X: Xlab, iso: isoOf(o.iso, data, NR * NU) };
  };

  /* iso shells: o.iso = [{ w: [w0, w1, w2], level, alpha, rim }] (at most two). The shell is the surface
     q = level of q = sum_i w_i x_i / max(sum_i w_i x_i) over the stored transfer values x (after any
     floor), drawn by the shader as a thin lit surface of opacity alpha; rim = 1 draws it mostly where
     it is seen edge-on (a bubble outline), so it marks a surface without veiling what is inside. */
  function isoOf(list, data, n) {
    return (list || []).slice(0, 2).map((s) => {
      const w = s.w || [1, 1, 1];
      let m = 0;
      for (let i = 0; i < n; i++) m = Math.max(m, w[0] * data[4 * i] + w[1] * data[4 * i + 1] + w[2] * data[4 * i + 2]);
      m = m || 1;
      return { v: new THREE.Vector4(w[0] / m, w[1] / m, w[2] / m, s.level), a: s.alpha == null ? 0.5 : s.alpha, rim: s.rim || 0 };
    });
  }

  // shared: group maxima and transfer function, in place on raw channel arrays -> RGBA data
  function applyTF(ch, raw, n, data) {
    const gmax = {};
    ch.forEach((c, k) => { let m = 0; const A = raw[k]; for (let i = 0; i < n; i++) if (A[i] > m) m = A[i]; const g = c.group != null ? c.group : k; gmax[g] = Math.max(gmax[g] || 0, m); });
    ch.forEach((c, k) => {
      const m = gmax[c.group != null ? c.group : k] || 1, tf = c.tf || { type: "lin" }, A = raw[k];
      for (let i = 0; i < n; i++) {
        const y = A[i] / m;
        let x = tf.type === "pow" ? Math.pow(y, tf.g) : tf.type === "log" ? (y > 0 ? Math.max(0, 1 + Math.log10(y) / tf.D) : 0) : y;
        if (tf.floor) x = Math.max(0, (x - tf.floor) / (1 - tf.floor));
        data[i * 4 + k] = x;
      }
    });
  }

  /* ---------------------------------------------------------------- 3D grid field
     For densities without axial symmetry (or given on a box). o = { n: [nx, ny, nz], half: [hx, hy, hz],
     f(x, y, z, out) writing raw densities of up to three channels into out[0..2], channels: [...] as
     in VOL.field, tau }. Texel centres at -h + (i + 1/2) 2h/n. The key-light transmittance (light
     straight down -y) is stored in the alpha channel. An axially symmetric density is cheaper and
     sharper through VOL.field: a Nilsson orbital is exactly axially symmetric, so deformed.html uses
     VOL.field with the oscillator lengths (ss, sz), not this. */
  VOL.grid3D = function (o) {
    const [nx, ny, nz] = o.n, [hx, hy, hz] = o.half, N = nx * ny * nz;
    const ch = o.channels.slice(0, 3), raw = ch.map(() => new Float32Array(N)), out = [0, 0, 0];
    const dx = 2 * hx / nx, dy = 2 * hy / ny, dz = 2 * hz / nz;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      out[0] = out[1] = out[2] = 0;
      o.f(-hx + (i + 0.5) * dx, -hy + (j + 0.5) * dy, -hz + (k + 0.5) * dz, out);
      const q = (k * ny + j) * nx + i;
      for (let c = 0; c < ch.length; c++) raw[c][q] = Math.max(0, out[c]);
    }
    const data = new Float32Array(N * 4);
    applyTF(ch, raw, N, data);
    const w = [0, 1, 2].map((c) => (ch[c] ? (ch[c].weight == null ? 1 : ch[c].weight) : 0));
    const sigAt = (q) => w[0] * data[4 * q] + w[1] * data[4 * q + 1] + w[2] * data[4 * q + 2];
    // opacity scale from the diameter along x through the centre
    const jc = ny >> 1, kc = nz >> 1;
    let I = 0; for (let i = 0; i < nx; i++) I += sigAt((kc * ny + jc) * nx + i) * dx;
    const s0 = I > 0 ? (o.tau || 2.5) / I : 1;
    const shadowS = new Float64Array(nx >> 1), shadowT = new Float64Array(nx >> 1);
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      let od = 0;
      for (let j = ny - 1; j >= 0; j--) {
        const q = (k * ny + j) * nx + i, sg = s0 * sigAt(q) * dy;
        od += 0.5 * sg; data[4 * q + 3] = Math.exp(-od); od += 0.5 * sg;
      }
      if (k === kc && i >= nx >> 1) { const m = i - (nx >> 1); shadowS[m] = -hx + (i + 0.5) * dx; shadowT[m] = Math.exp(-od); }
    }
    const sig = w.map((v) => v * s0);
    const em = [0, 1, 2].map((c) => s0 * (ch[c] && ch[c].emission != null ? ch[c].emission : 1));
    const cols = ch.map((c) => (c.color ? c.color.clone() : new THREE.Color(1, 1, 1)));
    while (cols.length < 3) cols.push(new THREE.Color(0, 0, 0));
    return { kind: "3d", n: [nx, ny, nz], half: [hx, hy, hz], data, sig, em, cols, Smax: Math.max(hx, hz), shadow: { s: shadowS, T: shadowT }, iso: isoOf(o.iso, data, N) };
  };

  /* ---------------------------------------------------------------- convenience builders
     Spherical density from radial tables: o = { r (grid, increasing), channels: [{ rho (table on r),
     color, group, tf, weight, emission }], rmax (default: where every channel < 1e-3 of the largest),
     tau, NR }. Neutrons and protons as two channels of one group keep their relative density. */
  const interp1 = (r, y) => {
    const n = r.length;
    return (x) => {
      if (x <= r[0]) return y[0];
      if (x >= r[n - 1]) return 0;
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r[m] <= x) lo = m; else hi = m; }
      const t = (x - r[lo]) / (r[hi] - r[lo]);
      return y[lo] * (1 - t) + y[hi] * t;
    };
  };
  VOL.radialField = function (o) {
    const r = o.r;
    let rmax = o.rmax;
    if (!rmax) {
      let m = 0; for (const c of o.channels) for (const v of c.rho) m = Math.max(m, v);
      rmax = r[1];
      for (const c of o.channels) for (let i = 0; i < r.length; i++) if (c.rho[i] > 1e-3 * m) rmax = Math.max(rmax, r[i]);
      rmax += 1;
    }
    return VOL.field({ rmax, r0: o.r0 || 0, NR: o.NR || 224, NU: 1, tau: o.tau || 3, iso: o.iso,
      channels: o.channels.map((c, k) => Object.assign({ group: 0 }, c, { f: interp1(r, c.rho) })) });
  };
  /* One orbital, radial times angular: o = { r, u (u(r) = r R(r) on r), angular(cos theta) (e.g.
     WS.angular(l, j2, m2, x)), color, tf (default |psi|: pow 0.5, floor 0.05), rmax, tau, NR, NU }. */
  VOL.orbitalField = function (o) {
    const r = o.r, n = r.length, R2 = new Float64Array(n);
    for (let i = 0; i < n; i++) { const rr = Math.max(r[i], r[1] || 1e-3); R2[i] = (o.u[i] / rr) ** 2; }
    R2[0] = R2[1];
    let rmax = o.rmax;
    if (!rmax) { let m = 0; for (const v of R2) m = Math.max(m, v); rmax = r[1]; for (let i = 0; i < n; i++) if (R2[i] > 1e-4 * m) rmax = r[i]; rmax += 1.5; }
    const NU = o.NU || 128, ang = new Float64Array(NU);
    for (let j = 0; j < NU; j++) ang[j] = o.angular ? o.angular(-1 + (j + 0.5) * 2 / NU) : 1;
    const fr = interp1(r, R2);
    return VOL.field({ rmax, NR: o.NR || 224, NU, tau: o.tau || 6, iso: o.iso,
      channels: [{ f: (rr, u) => fr(rr) * ang[Math.min(NU - 1, Math.max(0, Math.round((u + 1) * NU / 2 - 0.5)))],
        tf: o.tf || { type: "pow", g: 0.5, floor: 0.05 }, color: o.color }] });
  };

  function halfTex(arr, w, h, fmt) {
    const n = arr.length, hd = new Uint16Array(n);
    for (let i = 0; i < n; i++) hd[i] = THREE.DataUtils.toHalfFloat(arr[i]);
    const t = new THREE.DataTexture(hd, w, h, fmt, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }
  function slotOf(F) {
    if (F.kind === "3d") {
      const n = F.data.length, hd = new Uint16Array(n);
      for (let i = 0; i < n; i++) hd[i] = THREE.DataUtils.toHalfFloat(F.data[i]);
      const t = new THREE.Data3DTexture(hd, F.n[0], F.n[1], F.n[2]);
      t.format = THREE.RGBAFormat; t.type = THREE.HalfFloatType;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
      t.unpackAlignment = 1; t.needsUpdate = true;
      return { F, tex: t, lt: null, map: new THREE.Vector4(F.half[0], F.half[1], F.half[2], 0),
        sig: new THREE.Vector3(...F.sig), em: new THREE.Vector3(...F.em), cols: F.cols.map((c) => c.clone()), iso: F.iso || [] };
    }
    // RGBA field, and the light as a single-channel (red) texture
    const L = new Float32Array(F.NS * F.NY * 4);
    for (let k = 0; k < F.NS * F.NY; k++) L[4 * k] = F.light[k];
    return {
      F, tex: halfTex(F.data, F.NU, F.NR, THREE.RGBAFormat), lt: halfTex(L, F.NS, F.NY, THREE.RGBAFormat),
      map: new THREE.Vector4(F.rmax, F.r0, F.ss, F.sz), sig: new THREE.Vector3(...F.sig), em: new THREE.Vector3(...F.em), cols: F.cols.map((c) => c.clone()),
      iso: F.iso || [],
    };
  }
  function freeSlot(s) { if (s) { s.tex.dispose(); if (s.lt) s.lt.dispose(); } }

  /* ---------------------------------------------------------------- volume shader
     Emission-absorption along each view ray, front to back:
       L += T (1 - exp(-sigma ds)) c B (k_amb + k_key T_key),  T *= exp(-sigma ds)
     sigma = sum_i w_i x_i (x the transfer value), c = sum_i x_i col_i / sum_i x_i (the channel colours
     mixed by their share), T_key the transmittance of the overhead key light (single scattering,
     isotropic phase). The texture is indexed (radius, cos theta): x along a texel row is radius. */
  const VERT = `
    varying vec3 vWorld;
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const FRAG = `
  #ifdef GRID3D
    precision highp sampler3D;
    uniform sampler3D tA, tB;
    uniform sampler2D lA, lB;
  #else
    uniform sampler2D tA, tB, lA, lB;
  #endif
    uniform vec4 mA, mB;
    uniform vec3 sA, sB, eA, eB, cA0, cA1, cA2, cB0, cB1, cB2;
    uniform float uMix, uStepMin, uStepMax, uStepK, uStepScale;
    uniform vec3 uHalf;
    uniform float uBright, uAmb, uKey, uFloorY, uFace, uEm0;
    uniform float uCut; uniform vec3 uCutA, uCutB;
    uniform float uSlab; uniform vec3 uFwd;
    uniform vec3 uKeyDir; uniform float uFaceSplit;
    uniform float uGrad, uGradH;
    uniform vec3 uSkip; uniform float uSkipOn, uMain, uOpac;
    uniform vec4 uIso0, uIso1; uniform vec2 uIsoA, uIsoR; uniform float uSpec, uShAmb, uShKey, uShB, uFaceB;
    varying vec3 vWorld;

    float gmap(float v, float vmax, float r0){ return r0 > 0.0 ? log(1.0 + v / r0) / log(1.0 + vmax / r0) : v / vmax; }
  #ifdef GRID3D
    // 3D grid: texel centres at -h + (i + 1/2) 2h/n; rgb = transfer values, a = key transmittance
    vec3 fieldX(sampler3D t, vec4 m, vec3 p){
      vec3 q = p / m.xyz * 0.5 + 0.5;
      if (any(lessThan(q, vec3(0.0))) || any(greaterThan(q, vec3(1.0)))) return vec3(0.0);
      return texture(t, q).rgb;
    }
    float keyT3(sampler3D t, vec4 m, vec3 p){
      vec3 q = p / m.xyz * 0.5 + 0.5;
      if (any(lessThan(q, vec3(0.0))) || any(greaterThan(q, vec3(1.0)))) return 1.0;
      return texture(t, q).a;
    }
    #define KEY_A keyT3(tA, mA, p)
    #define KEY_B keyT3(tB, mB, p)
  #else
    #define KEY_A keyT(lA, mA, p)
    #define KEY_B keyT(lB, mB, p)
  #endif
    // field transfer values at p for one slot: (radius, cos theta) table, lab axes scaled by (ss, sz)
    vec3 fieldX(sampler2D t, vec4 m, vec3 p){
      float a = length(p.xz) / m.z, b = p.y / m.w, r = length(vec2(a, b));
      float x = gmap(r, m.x, m.y);
      if (x >= 1.0) return vec3(0.0);
      return texture2D(t, vec2(0.5 + 0.5 * b / max(r, 1e-6), x)).rgb;
    }
    float sigA0; vec3 xA0;
    float keyT(sampler2D t, vec4 m, vec3 p){
      float sx = gmap(length(p.xz), m.x * m.z, m.y);
      if (sx >= 1.0) return 1.0;
      float yy = p.y; float yc = 0.5 + 0.5 * sign(yy) * min(gmap(abs(yy), m.x * m.w, m.y), 1.0);
      if (yc >= 1.0) return 1.0;
      return texture2D(t, vec2(sx, yc)).r;
    }
    // sigma (1/fm), colour (unnormalized: sum x_i col_i), key transmittance, x sum
    void sampleAt(vec3 p, vec3 mask, out float sig, out vec3 col, out float tl, out float xs){
      vec3 x = fieldX(tA, mA, p) * mask;
      sig = dot(x, sA) * uOpac; sigA0 = sig; xA0 = x; col = x.r * eA.r * cA0 + x.g * eA.g * cA1 + x.b * eA.b * cA2; xs = x.r + x.g + x.b; tl = KEY_A;
      if (uMix < 0.999) {
        vec3 y = fieldX(tB, mB, p) * mask;
        float sigB = dot(y, sB) * uOpac; vec3 colB = y.r * eB.r * cB0 + y.g * eB.g * cB1 + y.b * eB.b * cB2;
        sig = mix(sigB, sig, uMix); col = mix(colB, col, uMix); xs = mix(y.r + y.g + y.b, xs, uMix);
        tl = mix(KEY_B, tl, uMix);
      }
    }
    // gradient shading: the relative gradient |grad sigma|/sigma marks edges of the density (the
    // nuclear surface, the walls of a node); there the sample is lit like a surface by the key,
    // with the gradient as its normal. Forward differences on slot A, three fetches.
    float gradLight(vec3 p, float s0){
      float h = uGradH;
      vec3 g = vec3(dot(fieldX(tA, mA, p + vec3(h, 0.0, 0.0)), sA) * uOpac - s0,
                    dot(fieldX(tA, mA, p + vec3(0.0, h, 0.0)), sA) * uOpac - s0,
                    dot(fieldX(tA, mA, p + vec3(0.0, 0.0, h)), sA) * uOpac - s0) / h;
      float gm = length(g);
      float w = uGrad * clamp(gm / (s0 + 0.02 * length(sA) * uOpac + 1e-5) * 0.8, 0.0, 1.0);
      float lam = 0.3 + 0.95 * max(dot(-g / max(gm, 1e-6), uKeyDir), 0.0);
      return mix(1.0, lam, w);
    }
    // iso shell: the surface q = level, q = dot(x, w) on slot A (w already divided by the field's
    // maximum of q). Normal from the central-difference gradient of q (six fetches, only at the
    // crossings); lit like a surface: wrapped Lambert from the key, shadowed by the key
    // transmittance through the density, a soft Blinn-Phong highlight, a sky term and a Fresnel rim.
    // Returns premultiplied colour and opacity. Back walls (seen from inside) are dimmer.
    vec4 shell(vec3 ph, vec3 w, float lev, float a, float rim, vec3 rd){
      float h = uGradH;
      vec3 g = vec3(dot(fieldX(tA, mA, ph + vec3(h, 0.0, 0.0)) - fieldX(tA, mA, ph - vec3(h, 0.0, 0.0)), w),
                    dot(fieldX(tA, mA, ph + vec3(0.0, h, 0.0)) - fieldX(tA, mA, ph - vec3(0.0, h, 0.0)), w),
                    dot(fieldX(tA, mA, ph + vec3(0.0, 0.0, h)) - fieldX(tA, mA, ph - vec3(0.0, 0.0, h)), w));
      float gm = length(g);
      vec3 V = -rd, N = gm > 1e-7 ? -g / gm : V;
      float back = 0.0;
      if (dot(N, V) < 0.0) { N = -N; back = 1.0; }
      vec3 x = fieldX(tA, mA, ph); float xs = max(x.r + x.g + x.b, 1e-5);
      vec3 base = (x.r * cA0 + x.g * cA1 + x.b * cA2) / xs;
      vec3 p = ph; float tl = mix(1.0, KEY_A, 0.65);
      // density ambient occlusion: how much of the field lies just outside the surface, along N
      float qo = dot(fieldX(tA, mA, ph + N * (5.0 * h)), w) + dot(fieldX(tA, mA, ph + N * (10.0 * h)), w);
      float ao = 1.0 - 0.6 * clamp(qo / max(2.0 * lev, 1e-3), 0.0, 1.0);
      float ndl = dot(N, uKeyDir);
      float wrap = max((ndl + 0.3) / 1.3, 0.0);
      // fill from the upper left of the view, unshadowed
      vec3 Rr = normalize(cross(vec3(0.0, 1.0, 0.0), V) + vec3(1e-4, 0.0, 0.0));
      vec3 Lf = normalize(V + 0.55 * vec3(0.0, 1.0, 0.0) + 0.6 * Rr);
      float fill = max(dot(N, Lf), 0.0);
      float spec = pow(max(dot(N, normalize(uKeyDir + V)), 0.0), 42.0) * tl + 0.35 * pow(max(dot(N, normalize(Lf + V)), 0.0), 60.0);
      float nv = max(dot(N, V), 0.0), fr = pow(1.0 - nv, 3.0);
      vec3 c = base * uShB * ((uShAmb * (0.45 + 0.55 * (0.5 + 0.5 * N.y)) + 0.45 * fill) * ao + uShKey * tl * wrap)
             + vec3(1.0, 0.96, 0.9) * uSpec * spec * (1.0 - back)
             + base * uShB * 0.5 * fr;
      float al = clamp(a * mix(0.7 + 0.6 * fr, 2.5 * fr, rim) * (back > 0.5 ? 0.6 : 1.0), 0.0, 0.95) * smoothstep(0.0, 0.2, nv);
      return vec4(c * al, al);
    }
    // [lo, hi] where a ray satisfies dot(p, n) > 0
    vec2 halfLine(vec3 ro, vec3 rd, vec3 n){
      float d0 = dot(ro, n), dd = dot(rd, n);
      if (abs(dd) < 1e-7) return d0 > 0.0 ? vec2(-1e9, 1e9) : vec2(1e9, -1e9);
      float tc = -d0 / dd;
      return dd > 0.0 ? vec2(tc, 1e9) : vec2(-1e9, tc);
    }
    // emission per unit opacity grows with x: dense regions glow, thin tails stay dim
    // col is the emission coefficient sum_i e_i x_i col_i (1/fm); a segment of length ds with
    // absorption sig adds T col (1 - exp(-sig ds))/sig, the exact solution for constant coefficients
    vec3 shade(vec3 col, float xs, float tl, float br){
      return col * br * (uEm0 + (1.0 - uEm0) * min(xs, 1.0)) * (uAmb + uKey * tl);
    }
    float segw(float sig, float len){ return sig > 1e-6 ? (1.0 - exp(-sig * len)) / sig : len; }

    void main(){
      vec3 ro = cameraPosition, rd = normalize(vWorld - cameraPosition);
      vec3 inv = 1.0 / rd;
      vec3 t0 = (-uHalf - ro) * inv, t1 = (uHalf - ro) * inv;
      vec3 tmn = min(t0, t1), tmx = max(t0, t1);
      float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
      float tf = min(min(tmx.x, tmx.y), tmx.z);
      // nothing below the floor
      if (abs(rd.y) > 1e-6) {
        float tFloor = (uFloorY - ro.y) / rd.y;
        if (rd.y < 0.0) tf = min(tf, tFloor); else tn = max(tn, tFloor);
      }
      if (tf <= tn) discard;
      // main pass only: a pixel the glass covers is overdrawn by the glass, which shows this volume
      // from the transmission pass; skip it. Covered = the ray meets the ellipsoid uSkip at a point
      // the cut-away leaves standing (front or back wall).
      if (uSkipOn > 0.5 && uMain > 0.5) {
        vec3 o = ro / uSkip, d = rd / uSkip;
        float A2 = dot(d, d), B2 = dot(o, d), C2 = dot(o, o) - 1.0, D2 = B2 * B2 - A2 * C2;
        if (D2 > 0.0) {
          float q = sqrt(D2), t1 = (-B2 - q) / A2, t2 = (-B2 + q) / A2;
          vec3 p1 = ro + rd * t1, p2 = ro + rd * t2;
          bool c1 = uCut > 0.5 && dot(p1, uCutA) > 0.0 && dot(p1, uCutB) > 0.0;
          bool c2 = uCut > 0.5 && dot(p2, uCutA) > 0.0 && dot(p2, uCutB) > 0.0;
          if ((t1 > 0.0 && !c1) || (t2 > 0.0 && !c2)) discard;
        }
      }
      float tBox = tn;
      // slab: keep |dot(p, F)| <= uSlab
      bool face = false; float tFace = -1.0; vec3 nFace = -uFwd;
      if (uSlab > 0.0) {
        float d0 = dot(ro, uFwd), dd = dot(rd, uFwd);
        float ta = (-uSlab - d0) / dd, tb = (uSlab - d0) / dd;
        float k0 = min(ta, tb), k1 = max(ta, tb);
        if (k0 > tn) { tn = k0; face = true; tFace = k0; }
        tf = min(tf, k1);
        if (tf <= tn) discard;
      }
      // wedge cut-away: removed where dot(p, A) > 0 and dot(p, B) > 0
      vec2 cutI = vec2(1e9, -1e9);
      if (uCut > 0.5) {
        vec2 a = halfLine(ro, rd, uCutA), b = halfLine(ro, rd, uCutB);
        cutI = vec2(max(a.x, b.x), min(a.y, b.y));
      }
      float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      vec3 acc = vec3(0.0); float T = 1.0;
      float t = tn;
      {
        vec3 p = ro + rd * t;
        t += jit * clamp(uStepK * length(p), uStepMin, uStepMax) * uStepScale;
      }
      float sig, xs, tl; vec3 col;
      // iso shells: previous q - level along the ray (have = 0 after a jump: no crossing is inferred)
      float q0p = 0.0, q1p = 0.0, tp = t, have = 0.0;
      float isoOn = (uIsoA.x + uIsoA.y) * uMix;
      for (int i = 0; i < 320; i++) {
        if (t > tf || T < 0.004) break;
        if (t >= cutI.x && t < cutI.y) {
          // leave the removed wedge: the cut face is drawn as a thin stained layer
          t = cutI.y;
          if (t >= tf) break;
          face = true; tFace = t;
          // outward normal of the face we leave through (the plane crossed last)
          vec2 a = halfLine(ro, rd, uCutA);
          nFace = abs(t - (dot(rd, uCutA) > 0.0 ? a.x : a.y)) < 1e-3 ? uCutA : uCutB;
        }
        if (face) {
          face = false;
          vec3 pf = ro + rd * (tFace + 1e-3);
          // split faces: the stained layer of the left face takes channel 0 alone, of the right face
          // channel 1 alone; after the layer the march below goes on through all channels
          vec3 mask = uFaceSplit > 0.5 ? (dot(nFace, uCutA) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)) : vec3(1.0);
          sampleAt(pf, mask, sig, col, tl, xs);
          if (xs > 1e-5) {
            float a = 1.0 - exp(-sig * uFace);
            // the cut face is lit like a matte surface by the key (Lambert, wrapped), so the two
            // faces of the wedge differ in brightness and read as planes
            float lam = 0.55 + 0.45 * dot(nFace, uKeyDir);
            acc += T * segw(sig, uFace) * shade(col, xs, tl, uFaceB < 0.0 ? uBright : uFaceB) * lam;
            T *= 1.0 - a;
          }
          t = tFace + 1e-3 + jit * uStepMin * uStepScale;
          // the shells resume from the face: a crossing just behind it is still found
          if (isoOn > 0.0) {
            vec3 xf = fieldX(tA, mA, pf);
            q0p = dot(xf, uIso0.xyz) - uIso0.w; q1p = dot(xf, uIso1.xyz) - uIso1.w; tp = tFace + 1e-3; have = 1.0;
          } else have = 0.0;
          continue;
        }
        vec3 p = ro + rd * t;
        float ds = clamp(uStepK * length(p), uStepMin, uStepMax) * uStepScale;
        sampleAt(p, vec3(1.0), sig, col, tl, xs);
        if (isoOn > 0.0) {
          float q0 = dot(xA0, uIso0.xyz) - uIso0.w, q1 = dot(xA0, uIso1.xyz) - uIso1.w;
          if (have > 0.5) {
            if (uIsoA.x > 0.0 && q0 * q0p < 0.0) {
              vec4 s = shell(ro + rd * mix(tp, t, q0p / (q0p - q0)), uIso0.xyz, uIso0.w, uIsoA.x * uMix, uIsoR.x, rd);
              acc += T * s.rgb; T *= 1.0 - s.a;
            }
            if (uIsoA.y > 0.0 && q1 * q1p < 0.0) {
              vec4 s = shell(ro + rd * mix(tp, t, q1p / (q1p - q1)), uIso1.xyz, uIso1.w, uIsoA.y * uMix, uIsoR.y, rd);
              acc += T * s.rgb; T *= 1.0 - s.a;
            }
          }
          q0p = q0; q1p = q1; tp = t; have = 1.0;
        }
        if (sig > 1e-5) {
          float a = 1.0 - exp(-sig * ds);
          float gl = uGrad > 0.0 && sigA0 > 1e-4 ? gradLight(p, sigA0) : 1.0;
          acc += T * segw(sig, ds) * shade(col, xs, tl, uBright) * gl;
          T *= 1.0 - a;
        }
        t += ds;
      }
      gl_FragColor = vec4(acc, 1.0 - T);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  VOL.Volume = class {
    constructor(o = {}) {
      const V3 = () => new THREE.Vector3(), C = () => new THREE.Color();
      this.u = {
        tA: { value: null }, tB: { value: null }, lA: { value: null }, lB: { value: null },
        mA: { value: new THREE.Vector4(1, 0, 1, 1) }, mB: { value: new THREE.Vector4(1, 0, 1, 1) },
        sA: { value: V3() }, sB: { value: V3() }, eA: { value: V3() }, eB: { value: V3() },
        cA0: { value: C() }, cA1: { value: C() }, cA2: { value: C() }, cB0: { value: C() }, cB1: { value: C() }, cB2: { value: C() },
        uMix: { value: 1 }, uStepMin: { value: 0.2 }, uStepMax: { value: 0.2 }, uStepK: { value: 0 }, uStepScale: { value: 1 },
        uHalf: { value: V3() }, uBright: { value: 0.75 }, uAmb: { value: 0.45 }, uKey: { value: 0.8 }, uEm0: { value: 0.12 },
        uFloorY: { value: -1e9 }, uFace: { value: 1.2 },
        uCut: { value: 0 }, uCutA: { value: V3() }, uCutB: { value: V3() },
        uSlab: { value: 0 }, uFwd: { value: V3() },
        uKeyDir: { value: new THREE.Vector3(-0.45, 0.75, 0.48).normalize() }, uFaceSplit: { value: 0 },
        uGrad: { value: 0.85 }, uGradH: { value: 0.3 },
        uSkip: { value: new THREE.Vector3(1, 1, 1) }, uSkipOn: { value: 0 }, uMain: { value: 1 }, uOpac: { value: 1 },
        // iso shells (from the field's iso list) and their lighting: ambient, key, highlight
        uIso0: { value: new THREE.Vector4(0, 0, 0, 2) }, uIso1: { value: new THREE.Vector4(0, 0, 0, 2) }, uIsoA: { value: new THREE.Vector2(0, 0) }, uIsoR: { value: new THREE.Vector2(0, 0) },
        uSpec: { value: 0.55 }, uShAmb: { value: 0.32 }, uShKey: { value: 1.15 }, uShB: { value: 1.0 }, uFaceB: { value: -1 },
      };
      const mk = (defines) => new THREE.ShaderMaterial({
        uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, defines,
        side: THREE.BackSide, depthWrite: false, depthTest: false,
        // premultiplied over, drawn in the opaque list (after floor and stage, before glass):
        // a transparent=false material keeps its custom blending, and only opaque objects are
        // seen through transmissive glass
        transparent: false, blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      this.mat = mk({});                   // (radius, cos theta) tables
      this.mat3 = null;                    // 3D grids, compiled on first use
      this.mk = mk;
      this.mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.mat);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 10;
      this.steps = o.steps || (o.cheap ? 64 : 128);  // samples across the box diameter
      if (o.cheap) this.u.uGrad.value = 0;           // cheap path: no gradient shading (3 fetches/step)
      this.coarse = o.coarse || 1;         // step multiplier outside the transmission pass
      this.A = null; this.B = null;
      this.quality = 1;                    // step multiplier from the frame-time governor (>= 1)
      // The transmission pass (mipmapped target) shows the volume through the glass and needs full
      // quality; the main pass is mostly overdrawn by the glass, so it may march coarser.
      this.mesh.onBeforeRender = (r) => {
        const rt = r.getRenderTarget(), tr = !!(rt && rt.texture && rt.texture.generateMipmaps);
        this.u.uStepScale.value = (tr ? 1 : this.coarse) * this.quality;
        this.u.uMain.value = tr ? 0 : 1;
      };
    }
    // share a VOL.Cut: the wedge normals are then the same vector objects
    useCut(cut) { this.u.uCutA.value = cut.A; this.u.uCutB.value = cut.B; return this; }
    // F from VOL.field; fade: keep the old field and cross-fade with setMix
    setField(F, fade, stepping) {
      if (fade && this.A && this.A.F.kind !== F.kind) fade = false;
      if (fade && this.A) { freeSlot(this.B); this.B = this.A; }
      else { freeSlot(this.B); freeSlot(this.A); this.B = null; }
      this.A = slotOf(F);
      const u = this.u, A = this.A, B = this.B || this.A;
      u.tA.value = A.tex; u.lA.value = A.lt; u.mA.value.copy(A.map); u.sA.value.copy(A.sig); u.eA.value.copy(A.em);
      u.cA0.value.copy(A.cols[0]); u.cA1.value.copy(A.cols[1]); u.cA2.value.copy(A.cols[2]);
      u.tB.value = B.tex; u.lB.value = B.lt; u.mB.value.copy(B.map); u.sB.value.copy(B.sig); u.eB.value.copy(B.em);
      u.cB0.value.copy(B.cols[0]); u.cB1.value.copy(B.cols[1]); u.cB2.value.copy(B.cols[2]);
      u.uMix.value = this.B ? 0 : 1;
      // iso shells of the new field (they fade in with uMix)
      const iso = A.iso || [];
      u.uIso0.value.copy(iso[0] ? iso[0].v : new THREE.Vector4(0, 0, 0, 2));
      u.uIso1.value.copy(iso[1] ? iso[1].v : new THREE.Vector4(0, 0, 0, 2));
      u.uIsoA.value.set(iso[0] ? iso[0].a : 0, iso[1] ? iso[1].a : 0);
      u.uIsoR.value.set(iso[0] ? iso[0].rim : 0, iso[1] ? iso[1].rim : 0);
      if (F.kind === "3d") { if (!this.mat3) this.mat3 = this.mk({ GRID3D: "" }); this.mesh.material = this.mat3; }
      else this.mesh.material = this.mat;
      const hx = Math.max(A.F.half[0], B.F.half[0]), hy = Math.max(A.F.half[1], B.F.half[1]), hz = Math.max(A.F.half[2], B.F.half[2]);
      u.uHalf.value.set(hx, hy, hz);
      this.mesh.scale.set(hx, hy, hz);
      // uniform steps across the box, or (stepping = {min, k}) steps growing with the distance from
      // the centre, for fields that span orders of magnitude in radius
      if (stepping) { u.uStepMin.value = stepping.min; u.uStepK.value = stepping.k; u.uStepMax.value = stepping.max || 1e9; }
      else { const h = 2 * Math.max(hx, hy) / this.steps; u.uStepMin.value = u.uStepMax.value = h; u.uStepK.value = 0; }
      if (stepping == null && this.u.uFace) this.u.uFace.value = Math.max(0.6, 2 * Math.max(hx, hy) / 40);
    }
    setExposure(k) { this.u.uBright.value = k; }     // emission scale (before the page's tone mapping)
    setOpacity(k) { this.u.uOpac.value = k; }        // multiplies every absorption coefficient
    setMix(m) {
      this.u.uMix.value = this.B ? m : 1;
      if (m >= 1 && this.B) { freeSlot(this.B); this.B = null; const A = this.A, u = this.u; u.tB.value = A.tex; u.lB.value = A.lt; u.mB.value.copy(A.map); u.sB.value.copy(A.sig); u.eB.value.copy(A.em); u.uMix.value = 1; }
    }
  };

  /* ---------------------------------------------------------------- frame-time governor
     Cheap path for weak GPUs: if frames run slower than ~32 fps, the volume marches with longer
     steps (up to 2.5x); when there is headroom again it refines back to the stated step count. */
  VOL.Governor = class {
    constructor(vol) { this.vol = vol; this.ema = 1 / 60; this.t = 0; }
    tick(dt) {
      if (!(dt > 0) || dt > 0.25) return;
      this.ema += (dt - this.ema) * 0.06; this.t += dt;
      if (this.t < 1.2) return;
      this.t = 0;
      const v = this.vol;
      if (this.ema > 1 / 32 && v.quality < 2.5) v.quality = Math.min(2.5, v.quality * 1.25);
      else if (this.ema < 1 / 52 && v.quality > 1) v.quality = Math.max(1, v.quality / 1.12);
    }
  };

  /* ---------------------------------------------------------------- cut-away wedge
     A wedge of half-angle 60 degrees about the horizontal direction to the camera is removed, so the
     two cut faces stand at +-60 degrees to the line of sight. Vertical planes through the symmetry
     axis: for an axially symmetric density each face shows the full (r, theta) map. */
  VOL.Cut = class {
    constructor(halfAngle = Math.PI / 3) {
      this.on = false;
      this.alpha = halfAngle;
      this.A = new THREE.Vector3(); this.B = new THREE.Vector3();
      this.planes = [new THREE.Plane(), new THREE.Plane()];
    }
    update(camera, target) {
      const dx = camera.position.x - (target ? target.x : 0), dz = camera.position.z - (target ? target.z : 0);
      const az = Math.atan2(dx, dz), b = Math.PI / 2 - this.alpha;
      this.A.set(Math.sin(az + b), 0, Math.cos(az + b));
      this.B.set(Math.sin(az - b), 0, Math.cos(az - b));
      // three.js clips where the signed distance is negative (clipIntersection: in all planes)
      this.planes[0].set(this.A.clone().negate(), 0);
      this.planes[1].set(this.B.clone().negate(), 0);
    }
  };

  /* ---------------------------------------------------------------- environment */
  function softTex(w, h, edge) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"), img = x.createImageData(w, h);
    const sm = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = Math.min(i + 0.5, w - i - 0.5) / w, v = Math.min(j + 0.5, h - j - 0.5) / h;
      const a = sm(0, edge, u) * sm(0, edge, v);
      const k = 4 * (j * w + i); img.data[k] = img.data[k + 1] = img.data[k + 2] = 255 * a; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }
  VOL.studioEnv = function (renderer) {
    const env = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vD; void main(){
        float y = vD.y;
        vec3 top = vec3(0.060, 0.066, 0.085), hor = vec3(0.022, 0.024, 0.030), bot = vec3(0.012, 0.011, 0.010);
        vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor, bot, pow(-y, 0.5));
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    env.add(dome);
    // round panels with a wide feather: their reflections in the glass read as soft glints, not windows
    const tex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "#fff"); g.addColorStop(0.35, "#eee"); g.addColorStop(0.75, "#444"); g.addColorStop(1, "#000");
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const panel = (w, h, p, k, c) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
        map: tex, color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(44, 40, [-8, 40, 10], 1.5, "#fff3e2");   // overhead key softbox, slightly warm
    panel(12, 40, [40, 8, -6], 0.7, "#dfe8ff");    // tall strip, camera right
    panel(12, 36, [-36, 6, -24], 0.55, "#cbdcff"); // rim strip, behind left
    panel(60, 10, [0, -16, 38], 0.12, "#ffd8b6");  // warm bounce from the floor in front
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(env, 0.04).texture;
    pm.dispose(); tex.dispose();
    return t;
  };

  /* ---------------------------------------------------------------- glass */
  VOL.glassMaterial = function (o = {}) {
    return new THREE.MeshPhysicalMaterial(Object.assign({
      // roughness 0 keeps the view through the wall sharp (the transmission lookup is not blurred);
      // the reflections come from the clearcoat, slightly rough, so the key lights read as soft glints
      color: 0xffffff, metalness: 0, roughness: 0,
      transmission: 1, thickness: 0.02, ior: 1.45,
      clearcoat: 1, clearcoatRoughness: 0.16,
      specularIntensity: 0, envMapIntensity: 1.0,
      attenuationColor: new THREE.Color("#eef3ff"), attenuationDistance: 400,
      side: THREE.DoubleSide,
    }, o));
  };

  /* ---------------------------------------------------------------- stage */
  function noiseTex(n, lo, hi) {
    const c = document.createElement("canvas"); c.width = c.height = n;
    const x = c.getContext("2d"), img = x.createImageData(n, n);
    // two octaves of value noise, tileable
    const g = (s) => { const a = new Float32Array(s * s); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
    const o1 = g(16), o2 = g(64);
    const val = (a, s, u, v) => {
      const X = u * s, Y = v * s, i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j;
      const at = (p, q) => a[((q % s + s) % s) * s + ((p % s + s) % s)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = 0.65 * val(o1, 16, i / n, j / n) + 0.35 * val(o2, 64, i / n, j / n);
      const k = 4 * (j * n + i), b = 255 * (lo + (hi - lo) * v);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function labelTex(text) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128;
    const x = c.getContext("2d");
    x.clearRect(0, 0, 512, 128);
    x.font = "500 76px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#e9e4d8";
    x.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const NICE = [1, 2, 5];
  VOL.niceLength = function (x) {
    const e = Math.floor(Math.log10(x)), b = Math.pow(10, e);
    let best = b;
    for (const k of [1, 2, 5, 10]) if (Math.abs(Math.log(k * b / x)) < Math.abs(Math.log(best / x))) best = k * b;
    return best;
  };
  VOL.Stage = class {
    constructor(scene) {
      this.group = new THREE.Group();
      scene.add(this.group);
      // matte floor: dark, slightly rough-varying, fades into the fog
      const rough = noiseTex(256, 0.8, 0.95);
      // a stage disc that fades into the background (alpha in the opaque list, custom blending)
      const fade = document.createElement("canvas"); fade.width = fade.height = 256;
      { const x = fade.getContext("2d"), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, "#fff"); g.addColorStop(0.45, "#fff"); g.addColorStop(0.8, "#555"); g.addColorStop(1, "#000");
        x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
      this.floorMat = new THREE.MeshStandardMaterial({
        color: "#3a3f4a", roughness: 1, roughnessMap: rough, metalness: 0, envMapIntensity: 0.8,
        alphaMap: new THREE.CanvasTexture(fade), transparent: false, depthWrite: true,
        blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      });
      this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.floorMat);
      this.floor.rotation.x = -Math.PI / 2;
      this.floor.renderOrder = 0;
      this.group.add(this.floor);
      // contact shadow: premultiplied black, drawn in the opaque list so the volume composites over it
      this.shCanvas = document.createElement("canvas"); this.shCanvas.width = this.shCanvas.height = 256;
      this.shTex = new THREE.CanvasTexture(this.shCanvas);
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        color: 0x000000, alphaMap: this.shTex, transparent: false, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      }));
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.renderOrder = 1;
      this.group.add(this.shadow);
      // scale bar: one merged mesh (bar and end ticks), ceramic white, and its label on the floor
      this.bar = new THREE.Group();
      this.barMat = new THREE.MeshStandardMaterial({ color: "#e6e1d6", roughness: 0.42, metalness: 0, emissive: "#2a2720" });
      this.barMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.barMat);
      this.barMesh.renderOrder = 2;
      this.labMat = new THREE.MeshBasicMaterial({ transparent: false, alphaTest: 0.4, depthWrite: false, fog: true });
      this.lab = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), this.labMat);
      this.lab.rotation.x = -Math.PI / 2;
      this.lab.renderOrder = 3;
      this.bar.add(this.barMesh, this.lab);
      this.group.add(this.bar);
      this.y = 0; this.front = 10; this.len = 0; this.rough = rough;
      this.side = 1.2;                     // bearing of the scale bar from the line of sight (rad)
    }
    // y: floor height; ext: horizontal size of the object; bar: length in fm (null: chosen from ext)
    layout(y, ext, bar) {
      this.y = y;
      const S = ext * 7.5;
      // the grid fades with the floor disc, before its own square edge, and with distance (1 fm cells)
      if (this.fadeU) this.fadeU.value = Math.min(S, 1.8 * (this.gridHalf || S));
      this.floor.scale.set(S, S, 1);
      this.floor.position.y = y;
      this.rough.repeat.set(S / 12, S / 12);
      this.shadow.position.y = y + 0.003 * ext;
      const L = bar || VOL.niceLength(0.55 * ext);
      if (L !== this.len) {
        this.len = L;
        const th = 0.022 * ext, tk = th * 5;
        const parts = [new THREE.BoxGeometry(L, th, th)];
        for (const sx of [-1, 1]) { const g = new THREE.BoxGeometry(th, th, tk); g.translate(sx * L / 2, 0, 0); parts.push(g); }
        this.barMesh.geometry.dispose();
        this.barMesh.geometry = BufferGeometryUtils.mergeGeometries(parts);
        parts.forEach((g) => g.dispose());
        this.barMesh.position.y = th / 2;
        if (this.labMat.map) this.labMat.map.dispose();
        this.labMat.map = labelTex(`${L >= 1 ? L : L.toPrecision(1)} fm`); this.labMat.needsUpdate = true;
        const lh = 0.13 * ext;
        this.lab.scale.set(lh * 4, lh * 4, 1);
        this.lab.position.set(0, 0.002 * ext, 0.75 * lh);
      }
      this.bar.position.y = y;
      this.front = ext * 1.15;
    }
    // a page's floor grid fades out with the stage disc, and is drawn in the opaque list before the volume
    fadeGrid(grid) {
      const m = grid.material, u = this.fadeU = this.fadeU || { value: 100 };
      grid.geometry.computeBoundingBox();
      this.gridHalf = grid.geometry.boundingBox.max.x;
      m.transparent = false; m.depthWrite = false; m.blending = THREE.CustomBlending;
      m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
      grid.renderOrder = 2;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uFadeR = u;
        sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        sh.fragmentShader = "uniform float uFadeR; varying vec3 vWp;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", "diffuseColor.a *= (1.0 - smoothstep(0.25 * uFadeR, 0.5 * uFadeR, length(vWp.xz))) * (1.0 - smoothstep(70.0, 170.0, length(vWp - cameraPosition)));\n#include <opaque_fragment>");
      };
      m.customProgramCacheKey = () => "vol-fadegrid";
      m.needsUpdate = true;
    }
    // shadow from the column transmittance of a field (overhead light), blurred into a soft penumbra
    setShadow(F, height, strength = 0.62) {
      const s = F.shadow.s, T = F.shadow.T, n = s.length, smax = F.Smax;
      const R = smax * 1.35 + height * 0.6;
      this.shadow.scale.set(2 * R, 2 * R, 1);
      const N = 256, x = this.shCanvas.getContext("2d"), img = x.createImageData(N, N);
      // radial profile on a uniform grid, Gaussian-blurred (radial approximation)
      const M = 128, prof = new Float64Array(M), dr = R / M;
      let k = 0;
      for (let i = 0; i < M; i++) {
        const r = (i + 0.5) * dr;
        while (k < n - 2 && s[k + 1] < r) k++;
        const a = r <= s[0] ? 1 - T[0] : r >= s[n - 1] ? 0 : (1 - T[k]) + ((1 - T[k + 1]) - (1 - T[k])) * (r - s[k]) / (s[k + 1] - s[k]);
        prof[i] = Math.max(0, a);
      }
      const sb = 0.1 * smax + 0.35 * height, out = new Float64Array(M);
      for (let i = 0; i < M; i++) {
        let acc = 0, wsum = 0;
        for (let j = -M; j < M; j++) {
          const rj = Math.abs((j + 0.5) * dr), w = Math.exp(-0.5 * (((j + 0.5) * dr - (i + 0.5) * dr) / sb) ** 2);
          const jj = Math.min(M - 1, Math.floor(rj / dr));
          acc += w * prof[jj]; wsum += w;
        }
        out[i] = acc / wsum;
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const r = Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) / (N / 2) * R;
        const f = r / dr - 0.5, i0 = Math.max(0, Math.min(M - 1, Math.floor(f))), i1 = Math.min(M - 1, i0 + 1), t = Math.max(0, Math.min(1, f - i0));
        let a = (out[i0] * (1 - t) + out[i1] * t) * strength;
        a *= 1 - Math.min(1, Math.max(0, (r / R - 0.85) / 0.15));
        const q = 4 * (j * N + i);
        img.data[q] = img.data[q + 1] = img.data[q + 2] = Math.round(255 * Math.min(1, a)); img.data[q + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.shTex.needsUpdate = true;
    }
    // the bar lies on the floor beside the object, to the right and a little forward, square to the line of sight
    update(camera) {
      // on a portrait screen there is no room beside the object: the bar moves toward the front
      const az = Math.atan2(camera.position.x, camera.position.z), side = az + (camera.aspect < 1 ? 0.4 : this.side);
      this.bar.rotation.y = az;
      this.bar.position.x = Math.sin(side) * this.front;
      this.bar.position.z = Math.cos(side) * this.front;
    }
  };

  /* ---------------------------------------------------------------- lights for solid stage objects */
  VOL.lightRig = function (scene) {
    const g = new THREE.Group();
    const hemi = new THREE.HemisphereLight("#cfd8ff", "#1a1410", 0.35);
    const key = new THREE.DirectionalLight("#fff1dc", 2.2); key.position.set(-12, 50, 14);
    // the fill comes from the environment's right-hand strip (no third glint on the glass)
    const rim = new THREE.DirectionalLight("#9fbcff", 0.9); rim.position.set(20, 18, -50);
    g.add(hemi, key, rim);
    scene.add(g);
    return g;
  };

  window.VOL = VOL;
})();
