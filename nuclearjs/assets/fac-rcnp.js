/* RCNP cyclotron facility (Research Center for Nuclear Physics, The University of Osaka, Ibaraki), for
   accelerator.html (registers FACILITY_MODULES.rcnp).
   Coordinates: metres, x to the east, z to the south, beam line at y = 0, the ring cyclotron at the origin.
   Building outlines, beam-line routes and device positions are read off the scaled facility plan
   (50 m scale bar) of Hatanaka et al. [1] (and its 2013 update [2]); Grand Raiden and LAS are built
   from the scaled schematics of [6] and [7]. Sources are listed in the note returned by build(). */
(function () {
  window.FACILITY_MODULES = window.FACILITY_MODULES || {};
  window.FACILITY_MODULES.rcnp = {
    label: "RCNP",
    build(A) {
      const { THREE, V3, M, FLOOR } = A;
      const D2R = Math.PI / 180;
      const ringSpec = A.cyclotrons.find((c) => c.id === "rcnp-ring");

      // ---------- materials of this module (shared, so the merge keeps the draw calls low)
      const G = {
        wall: new THREE.MeshStandardMaterial({ color: "#85878a", map: A.concreteMap, roughness: 0.94, metalness: 0, envMapIntensity: 0.25 }),
        pitWall: new THREE.MeshStandardMaterial({ color: "#7d7f82", map: A.concreteMap, roughness: 0.95, metalness: 0, envMapIntensity: 0.25, side: THREE.DoubleSide }),
        iron: new THREE.MeshStandardMaterial({ color: "#3a3d42", metalness: 0.6, roughness: 0.55, envMapIntensity: 0.5 }),
        deck: new THREE.MeshStandardMaterial({ color: "#5d6168", metalness: 0.55, roughness: 0.5, envMapIntensity: 0.5 }),
        rail: new THREE.MeshStandardMaterial({ color: "#b8bdc4", metalness: 0.9, roughness: 0.3 }),
        gr: A.magPaint("#2f7d8c"),                       // painted, laminated spectrometer iron (colour generic)
        las: A.magPaint("#3f8a5a"),
        sepIron: A.magPaint("#2b4f8c"), solid: A.magPaint("#adc2b1", true), ring: A.magPaint("#8dbf56", true), rf: new THREE.MeshStandardMaterial({ color: "#bcc3c0", metalness: .65, roughness: .4 }),     // separator dipoles; solid cyclotron iron
        cryo: new THREE.MeshStandardMaterial({ color: "#aeb4bb", metalness: 0.5, roughness: 0.5, envMapIntensity: 0.6 }),
        sep: new THREE.MeshStandardMaterial({ color: "#2b4f8c", metalness: 0.35, roughness: 0.45 }),
        scint: new THREE.MeshStandardMaterial({ color: "#c9b8e6", metalness: 0.1, roughness: 0.4, transparent: true, opacity: 0.75 }),
        block: new THREE.MeshStandardMaterial({ color: "#8f8a80", map: A.concreteMap, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 }),
      };

      // ---------- helpers
      const P = (x, z, y) => V3(x, y || 0, z);
      function W(x0, z0, x1, z1, t, h, g, mat) {          // straight wall (shared material)
        const a = P(x0, z0), b = P(x1, z1), L = a.distanceTo(b); if (L < 0.05) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(t, h, L + t), mat || G.wall);
        const c = a.clone().add(b).multiplyScalar(0.5); c.y = FLOOR + h / 2;
        A.orientTo(m, c, b.clone().sub(a).normalize()); m.castShadow = true; m.receiveShadow = true; g.add(m);
      }
      const floor = (x0, z0, x1, z1, g) => A.slab(x0, z0, x1, z1, FLOOR, M.floor, g, 8);
      function put(obj, pos, dir, g) { A.orientTo(obj, pos, dir.clone().setY(0).normalize()); g.add(obj); return obj; }
      const rot = (d, a) => V3(d.x * Math.cos(a) - d.z * Math.sin(a), 0, d.x * Math.sin(a) + d.z * Math.cos(a));   // + = right turn (seen from above)

      // a beam-line track: straights and circular bends; go(x, z, R) bends (if needed) and runs straight to (x, z).
      // Every bend larger than 4 degrees gets a dipole, every long straight a quadrupole doublet.
      class Track {
        constructor(x, z, dx, dz) { this.p = [P(x, z)]; this.d = V3(dx, 0, dz).normalize(); this.dip = []; this.quads = []; }
        get pos() { return this.p[this.p.length - 1].clone(); }
        s(L) { this.p.push(this.pos.addScaledVector(this.d, L)); return this; }
        b(deg, R, noMag) {
          const a = deg * D2R, n = Math.max(3, Math.ceil(Math.abs(deg) / 5)), ch = 2 * R * Math.sin(Math.abs(a) / (2 * n));
          const p0 = this.pos;
          let d = this.d.clone(), p = this.pos;
          for (let i = 0; i < n; i++) { d = rot(d, a / (2 * n)); p = p.clone().addScaledVector(d, ch); this.p.push(p); d = rot(d, a / (2 * n)); }
          const dm = rot(this.d, a / 2);
          this.d = d;
          if (!noMag && Math.abs(deg) > 4) this.dip.push({ pos: p0.clone().add(p).multiplyScalar(0.5), dir: dm, L: Math.max(0.8, Math.min(2.6, R * Math.abs(a) * 0.85)), R, a });
          return this;
        }
        go(x, z, R, nq) {
          const T = P(x, z);
          let a = 0;
          for (let it = 0; it < 8; it++) {                       // find the bend that points the exit straight at the target
            let d = this.d.clone(), p = this.pos; const n = 12;
            const ch = 2 * (R || 3) * Math.sin(Math.abs(a) / (2 * n));
            for (let i = 0; i < n; i++) { d = rot(d, a / (2 * n)); p.addScaledVector(d, ch); d = rot(d, a / (2 * n)); }
            const w = T.clone().sub(p); const err = Math.atan2(w.z, w.x) - Math.atan2(d.z, d.x);
            a += Math.atan2(Math.sin(err), Math.cos(err));
          }
          if (Math.abs(a) > 0.5 * D2R) this.b(a / D2R, R || 3);
          const s0 = this.pos, L = s0.distanceTo(T);
          this.p.push(T); this.d = T.clone().sub(s0).normalize();
          const k = nq === undefined ? Math.floor(L / 7) : nq;            // doublets spread along the straight
          for (let i = 0; i < k; i++) this.quads.push({ pos: s0.clone().lerp(T, (i + 0.5) / k), dir: this.d.clone() });
          return this;
        }
        dress(g, pr) {                                            // pipe, dipoles, quadrupole doublets
          A.pipe(this.p, g, pr || 0.07);
          for (const q of this.dip) {                             // a sector dipole bent to the arc, centred on the arc's midpoint
            const sg = Math.sign(q.a), mid = q.pos.clone().addScaledVector(rot(q.dir, sg * Math.PI / 2), -q.R * (1 - Math.cos(q.a / 2)));
            put(A.dipole(q.L, { bend: sg * Math.min(q.L / q.R, Math.abs(q.a)) }), mid, q.dir, g);
          }
          for (const q of this.quads) for (const o of [-0.4, 0.4]) put(A.quad(0.45), q.pos.clone().addScaledVector(q.dir, o), q.dir, g);
          return this;
        }
      }

      // a curved (sector) magnet in local coordinates: the reference arc starts at the origin heading +z and
      // bends by deg (+ right, - left) with radius R; w = radial width of the yoke, yb/yt = bottom/top of the yoke,
      // m0/m1 = extra yoke beyond the field boundary at entrance/exit (metres of arc). The magnet is the shared
      // laminated H-type dipole, bent to the arc and centred on it. Returns { g, exit, dir }.
      function sectorMag(R, deg, w, yb, yt, mat, m0, m1) {
        const g = new THREE.Group(), sg = deg >= 0 ? 1 : -1, ang = Math.abs(deg) * D2R;
        const pt = (u) => V3(-sg * R + sg * R * Math.cos(u), 0, R * Math.sin(u));
        const e0 = -(m0 || 0.3) / R, e1 = ang + (m1 || 0.3) / R, um = (e0 + e1) / 2;
        const d = A.dipole(R * (e1 - e0), { bend: sg * (e1 - e0), w, yb, yt, gap: 0.09, mat, stand: false });
        g.add(A.orientTo(d, pt(um), rot(V3(0, 0, 1), sg * um)));
        return { g, exit: pt(ang), dir: rot(V3(0, 0, 1), sg * ang) };
      }
      // a box-shaped beam-line element on its own stand down to the floor (y0 = local floor height)
      function elem(w, h, l, mat, y0) {
        const g = new THREE.Group();
        g.add(A.rbox(w, h, l, 0.04, mat, 0, 0, 0));
        const st = (y0 === undefined ? FLOOR : y0), top = -h / 2;
        if (top - st > 0.05) g.add(A.box(Math.min(w, 0.6), top - st, Math.min(l, 0.5), M.steelDark, 0, (top + st) / 2, 0));
        return A.shadowy(g);
      }
      function chamber(r, h, y0) {                              // a scattering / target chamber on a stand
        const g = new THREE.Group();
        const c = A.cyl(r, h, M.steel, 28); g.add(c);
        const lid = A.cyl(r * 1.06, 0.06, M.steelDark, 28); lid.position.y = h / 2; g.add(lid);
        const st = (y0 === undefined ? FLOOR : y0);
        g.add(A.box(r * 1.2, -h / 2 - st, r * 1.2, M.steelDark, 0, (-h / 2 + st) / 2, 0));
        return A.shadowy(g);
      }
      const beams = [];
      const amber = [1.0, 0.72, 0.32], pale = [1.0, 0.88, 0.6], muon = [0.55, 1.0, 0.75], blue = [0.66, 0.8, 0.95];

      // =====================================================================================================
      // AVF building (south): K140 AVF cyclotron, ion sources, RI-production rooms (K and F courses)
      // =====================================================================================================
      const gAVF = A.section("AVF cyclotron (K140)", "cyc", [P(6.5, 43), P(20.5, 61)], 2);
      gAVF.userData.cyc = "rcnp-avf";
      const gKF = A.section("AVF beam lines: RI production (K, F courses)", "end", [P(-22.5, 41), P(6.5, 73.5)], 2);
      {
        floor(-22.5, 41, 21.5, 74, gKF);
        const H = 4.2;
        // AVF vault
        W(6.5, 43, 20.5, 43, 1.5, H, gAVF); W(20.5, 43, 20.5, 61, 1.5, H, gAVF); W(10, 61, 20.5, 61, 1.5, H, gAVF); W(6.5, 43, 6.5, 57.3, 1.5, H, gAVF);
        // RI-production block, schematic interior walls following the plan
        W(-22.5, 41, -22.5, 73.5, 1.8, H, gKF); W(-22.5, 73.5, 6.5, 73.5, 1.8, H, gKF); W(6.5, 73.5, 6.5, 63.5, 1.5, H, gKF);
        W(-22.5, 41, -0.5, 41, 1.5, H, gKF); W(-7, 41, -7, 56.3, 1.2, H, gKF); W(-7, 64.5, -7, 73.5, 1.2, H, gKF);
        W(-7, 63.5, -0.3, 63.5, 1.2, H, gKF); W(2.8, 63.5, 6.5, 63.5, 1.2, H, gKF);
        // AVF magnet: H-type yoke, 3.3 m pole diameter in the official specification; plan footprint 6.1 m x 2.6 m [1]; height schematic
        const cx = 11.75, cz = 51.4;
        // H-type magnet: yoke slabs above and below the median plane, return yokes at the east and west ends, poles
        // and main coils in between (the coils stand proud of the yoke faces)
        gAVF.add(A.shadowy(A.rbox(6.1, 0.95, 2.6, 0.05, G.solid, cx, FLOOR + 0.475, cz)));
        gAVF.add(A.shadowy(A.rbox(6.1, 1.25, 2.6, 0.05, G.solid, cx, 1.325, cz)));
        for (const s of [-1, 1]) gAVF.add(A.shadowy(A.rbox(1.25, 1.2, 2.6, 0.04, G.solid, cx + s * 2.425, 0.1, cz)));
        for (const s of [-1, 1]) {
          const pole = A.cyl(1.65, 0.66, M.steelDark, 40); pole.position.set(cx, s * 0.37, cz); gAVF.add(pole);
          const coil = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.2, 10, 48), M.coil); coil.rotation.x = Math.PI / 2; coil.scale.set(1, 1, 1.5); coil.position.set(cx, s * 0.3, cz); gAVF.add(coil);
        }
        // the dee resonator: a long ribbed coaxial tank on the south face (as on the plans [1,2])
        gAVF.add(A.shadowy(A.rbox(3.1, 2.3, 7.0, 0.1, G.rf, cx, FLOOR + 1.55, 56.3)));
        for (let z = 53.3; z < 59.8; z += 0.8) gAVF.add(A.rbox(3.2, 2.4, 0.12, 0.03, M.steelDark, cx, FLOOR + 1.55, z));
        gAVF.add(A.box(1.2, 1.4, 1.2, M.rack, cx + 2.6, FLOOR + 0.7, 58.8));                       // RF amplifier, generic
        // three ion sources to the north (polarized source, 10 GHz NEOMAFIOS, 18 GHz superconducting ECR [2]) and the axial injection
        for (const [x, k] of [[8.8, 0], [11.75, 1], [14.6, 2]]) {
          const s = A.rbox(1.5, 1.6, 1.5, 0.08, k === 2 ? G.cryo : M.steel, x, FLOOR + 0.8, 45.7); gAVF.add(A.shadowy(s));
          gAVF.add(A.box(1.7, 1.3, 1.2, M.rack, x, FLOOR + 0.65, 44.4));
          A.pipe([P(x, 46.5), P(x, 47.3), P(cx, 47.9)], gAVF, 0.05);
        }
        A.pipe([P(cx, 47.9), P(cx, 48.6), P(cx, 49.4, 0.4), P(cx, 50.4, 2.6), P(cx, 51.4, 2.6)], gAVF, 0.06);
        const vi = A.cyl(0.07, 0.8, M.pipe, 12); vi.position.set(cx, 2.15, cz); gAVF.add(vi);        // axial injection into the yoke top
        gAVF.add(A.person(0.4).translateX(15.8).translateZ(47.2));

        // extraction line to the switching magnet, then north to the ring (and out to the RI rooms)
        const avf = new Track(8.8, 53.6, -0.1, 1).go(7.9, 59.4, 2, 0).go(1.9, 61.4, 2.2, 0);
        avf.dress(gKF);
        const sw = A.cyl(1.05, 1.0, G.solid, 32); sw.position.set(1.9, 0, 61.4); gKF.add(A.shadowy(sw));       // round switching magnet [1]
        const swc = A.cyl(0.9, 1.08, M.coil, 32); swc.position.set(1.9, 0, 61.4); gKF.add(swc);
        gKF.add(A.box(1.2, -0.5 - FLOOR, 1.2, M.steelDark, 1.9, (FLOOR - 0.5) / 2, 61.4));
        const lines = [
          new Track(1.9, 61.4, -1, 0.06).go(-14.2, 62.6, 3, 1),
          new Track(1.9, 61.4, -1, -0.2).go(-6.5, 59.5, 2, 0).go(-9.4, 67.6, 2, 1),
          new Track(1.9, 61.4, -0.3, 1).go(-1.3, 71.4, 2, 1),
        ];
        for (const L of lines) { L.dress(gKF, 0.06); const e = L.pos; gKF.add(A.shadowy(A.rbox(0.9, 1.0, 0.9, 0.05, M.steel, e.x, 0, e.z))); gKF.add(A.box(0.6, -0.5 - FLOOR, 0.6, M.steelDark, e.x, (FLOOR - 0.5) / 2, e.z)); }
        gKF.add(A.person(2.2).translateX(-3).translateZ(69));
        beams.push({ pts: avf.p.concat(lines[2].p.slice(1)), n: 7, speed: 0.14, color: pale, size: 0.8 });
      }

      // =====================================================================================================
      // transport AVF -> ring, with the diagnostic and bypass line [1]
      // =====================================================================================================
      const gTr = A.section("AVF to ring transport, diagnostics and bypass line", "foc", [P(-9, 8), P(4, 60)], 3);
      let inj, byp;
      {
        floor(-0.5, 15.75, 3.5, 41, gTr);
        W(-0.5, 15.75, -0.5, 41, 1.5, 4.2, gTr); W(3.5, 15.75, 3.5, 43, 1.5, 4.2, gTr);
        inj = new Track(1.9, 61.4, -0.45, -1).go(-2.6, 51.8, 2, 0).go(1.33, 45.7, 2, 0).go(1.45, 13.0, 2, 4).go(1.45, 10.6, 2, 0).go(1.2, 7.4, 2, 0).go(0, 2.0, 5, 0);
        inj.dress(gTr);
        byp = new Track(1.45, 10.6, -1, 0).go(-8.1, 10.4, 2, 1).go(-8.1, 1.23, 2, 1);
        byp.dress(gTr);
        gTr.add(A.person(0).translateX(1.5).translateZ(30));
        beams.push({ pts: inj.p, n: 18, speed: 0.1, color: pale, size: 0.8 });
      }

      // =====================================================================================================
      // ring cyclotron (K400): six spiral sectors, injection radius 2 m, extraction radius 4 m [3]
      // =====================================================================================================
      const gRing = A.section("Ring cyclotron (K400)", "cyc", [P(-9, -9), P(10, 11)], 3);
      gRing.userData.cyc = "rcnp-ring"; gRing.userData.sectorCount = ringSpec.sectors;
      gRing.userData.rfCount = 3; gRing.userData.ftCount = 1;
      const PIT = 8.6, YP = -3.6;                   // the sector yoke stands 0.97 m above the pit floor, median plane 3.6 m up [3]
      {
        const x0 = -9.25, x1 = 10.25, z0 = -8.25, z1 = 11.25;
        const s = new THREE.Shape(); s.moveTo(x0, z0); s.lineTo(x1, z0); s.lineTo(x1, z1); s.lineTo(x0, z1); s.lineTo(x0, z0);
        const h = new THREE.Path(); h.absarc(0, 0, PIT, 0, Math.PI * 2, true); s.holes.push(h);
        const fg = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false, curveSegments: 48 }); fg.rotateX(Math.PI / 2); fg.translate(0, FLOOR, 0);
        const fm = M.floor.clone(); fm.map = A.floorMap.clone(); fm.map.repeat.set(1 / 8, 1 / 8); fm.map.needsUpdate = true;
        const fl = new THREE.Mesh(fg, fm); fl.receiveShadow = true; gRing.add(fl);
        const pw = new THREE.Mesh(new THREE.CylinderGeometry(PIT, PIT, FLOOR - YP, 64, 1, true), G.pitWall); pw.position.y = (FLOOR + YP) / 2; gRing.add(pw);
        const pf = new THREE.Mesh(new THREE.CylinderGeometry(PIT, PIT, 0.3, 64), M.floor); pf.position.y = YP - 0.15; pf.receiveShadow = true; gRing.add(pf);
        // vault: 4.5 m concrete [3]; the west side follows the plan, with the passage for the extraction line
        const H = 5.2;
        W(-11.75, -10.5, 14.75, -10.5, 4.5, H, gRing); W(12.5, -12.75, 12.5, 15.75, 4.5, H, gRing);
        W(-11.75, 13.5, -0.1, 13.5, 4.5, H, gRing); W(3.1, 13.5, 14.75, 13.5, 4.5, H, gRing);
        W(-10.5, -12.75, -10.5, -2.6, 2.5, H, gRing); W(-10.5, 3.2, -10.5, 15.75, 2.5, H, gRing);
        A.lamps(P(-9, 11.3), P(10, 11.3), gRing, 6);

        // six spiral sector magnets: pole region spirals from r = 1.7 m to 5.3 m, then a 2.0 m wide back yoke to r = 7.2 m
        // (sector length 5.5 m, height 5.26 m with 2.0 m yokes, on 0.97 m legs [3]); the spiral twist is schematic
        function sectorShape(c0, grow) {
          const sh = new THREE.Shape(), r0 = 1.7, r1 = 5.3, n = 14, tw = 34 * D2R;
          const half = (r) => (11 + 2.75 * (r - r0) / (r1 - r0)) * D2R * grow;      // 21.9 to 27.5 degrees full width [3]
          const cen = (r) => c0 + tw * (r - r0) / (r1 - r0);
          const L = [], R = [];
          for (let i = 0; i <= n; i++) { const r = r0 + (r1 - r0) * i / n; L.push([r, cen(r) - half(r)]); R.push([r, cen(r) + half(r)]); }
          const ce = cen(r1), u = V3(Math.cos(ce), 0, Math.sin(ce)), v = V3(-Math.sin(ce), 0, Math.cos(ce)), bw = 1.0 * grow, b0 = r1 - 0.3, b1 = 7.2 + (grow - 1) * 2;
          const pts = L.map(([r, a]) => [r * Math.cos(a), r * Math.sin(a)]);
          pts.push([u.x * b0 - v.x * bw, u.z * b0 - v.z * bw], [u.x * b1 - v.x * bw, u.z * b1 - v.z * bw], [u.x * b1 + v.x * bw, u.z * b1 + v.z * bw], [u.x * b0 + v.x * bw, u.z * b0 + v.z * bw]);
          for (let i = n; i >= 0; i--) { const [r, a] = R[i]; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
          pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
          return sh;
        }
        function ext(sh, y0, y1, mat) {
          const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(0, y1, 0);
          const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; gRing.add(m);
        }
        const yLow = YP + 0.97;
        for (let k = 0; k < 6; k++) {
          const c0 = (k * 60) * D2R;
          ext(sectorShape(c0, 1), yLow, yLow + 2.0, G.ring);                       // lower yoke
          ext(sectorShape(c0, 1), yLow + 3.26, yLow + 5.26, G.ring);              // upper yoke
          ext(sectorShape(c0, 0.93), yLow + 2.0, yLow + 2.6, M.coil);             // coils around the poles
          ext(sectorShape(c0, 0.93), yLow + 2.66, yLow + 3.26, M.coil);
          // Split-yoke fasteners and coil water headers; service geometry is schematic.
          for (const r of [2.4, 3.5, 4.6, 6.3]) for (const side of [-1, 1]) {
            const a = c0 + (34 * (r - 1.7) / 3.6 + side * 7) * D2R;
            const b = A.cyl(.065, .12, M.steel, 6); b.position.set(r * Math.cos(a), yLow + 5.32, r * Math.sin(a)); gRing.add(b);
          }
          for (const side of [-1, 1]) {
            const a = c0 + (34 + side * 10) * D2R, x = 7.3 * Math.cos(a), z = 7.3 * Math.sin(a);
            const rod = A.cyl(.10, 3.0, M.steel, 14); rod.position.set(x, yLow + 2.6, z); gRing.add(rod);
            gRing.add(new THREE.Mesh(A.gHose([[x, -.3, z], [x * 1.06, -.3, z * 1.06], [x * 1.06, YP + .25, z * 1.06], [x * 1.10, YP + .25, z * 1.10]], .045, 12), M.cable));
          }
          const a = c0 + 40 * D2R;
          for (const r of [3.2, 6.2]) gRing.add(A.box(0.8, 0.97, 0.8, M.steelDark, r * Math.cos(a), YP + 0.485, r * Math.sin(a)));     // legs
        }
        // valleys at 30 + 60k degrees: injection (90, south), extraction (150), three single-gap acceleration cavities and
        // the flat-top cavity [3]; which valley holds which cavity is schematic
        const valley = (deg) => { const a = deg * D2R; return { u: V3(Math.cos(a), 0, Math.sin(a)), a }; };
        for (const deg of [210, 330, 30]) {
          const { u, a } = valley(deg), c = u.clone().multiplyScalar(4.6);
          const cav = A.rbox(1.5, 4.4, 5.6, 0.12, G.rf, 0, 0, 0); cav.position.set(c.x, YP + 0.97 + 2.6, c.z); cav.rotation.y = -a + Math.PI / 2; gRing.add(A.shadowy(cav));
          for (const r of [2.8, 6.3]) { const st = A.cyl(0.42, 1.6, M.steel, 20); const q = u.clone().multiplyScalar(r); st.position.set(q.x, YP + 0.97 + 5.6, q.z); gRing.add(st); }
          const amp = u.clone().multiplyScalar(9.6); gRing.add(A.shadowy(A.rbox(2.2, 2.6, 2.2, 0.05, M.rack, amp.x, FLOOR + 1.3, amp.z)));   // RF power amplifier (250 kW) [3]
          A.pipe([P(u.x * 6.3, u.z * 6.3, YP + 6.3), P(u.x * 8.2, u.z * 8.2, YP + 6.3), P(amp.x, amp.z, FLOOR + 2.6)], gRing, 0.14);
        }
        { const { u, a } = valley(270), c = u.clone().multiplyScalar(4.4);                  // flat-top cavity
          const cav = A.rbox(1.1, 3.2, 4.2, 0.1, G.rf, 0, 0, 0); cav.position.set(c.x, YP + 0.97 + 2.6, c.z); cav.rotation.y = -a + Math.PI / 2; gRing.add(A.shadowy(cav)); }
        for (const deg of [90, 150]) {                                                        // valley chambers (injection, extraction)
          const { u, a } = valley(deg), c = u.clone().multiplyScalar(4.2);
          const vc = A.rbox(0.9, 1.0, 4.4, 0.08, M.steel, 0, 0, 0); vc.position.set(c.x, 0, c.z); vc.rotation.y = -a + Math.PI / 2; gRing.add(A.shadowy(vc));
          gRing.add(A.box(0.5, 3.0, 0.5, M.steelDark, c.x, YP + 1.5, c.z));
        }
        const hub = A.cyl(1.1, 1.2, M.steelDark, 28); hub.position.y = 0; gRing.add(hub);
        for (const p of [[-6, 9.5, 0.8], [7, -7, 2.4]]) gRing.add(A.person(p[2]).translateX(p[0]).translateZ(p[1]));

        // beam: injection at r = 2 m, 7/6 display turns of the spiral shown out to the extraction radius 4 m
        const sp = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = 90 * D2R - t * (360 + 60) * D2R; const r = ringSpec.rIn + (ringSpec.rExt - ringSpec.rIn) * t; sp.push(P(r * Math.cos(a), r * Math.sin(a))); }
        gRing.userData.orbit = sp;
        beams.push({ pts: sp, n: 26, speed: 0.22, color: amber, size: 0.9 });
      }

      // =====================================================================================================
      // extraction, the switchyard, the WS course to Grand Raiden, WSS to MuSIC, WN and the north trunk
      // =====================================================================================================
      const gSw = A.section("Switchyard and white neutron source (WN course)", "end", [P(-25.5, -14), P(-9, 4)], 2);
      const gWS = A.section("WS course (dispersion-matched line to Grand Raiden)", "foc", [P(-35, -29), P(-20, -2)], 2);
      const main = new Track(-3.46, 2.0, -0.866, 0.5);
      const YARD = P(-14.5, -3.4), offYard = (T) => { T.dip = T.dip.filter((q) => q.pos.distanceTo(YARD) > 3.2); return T; };
      {
        floor(-20.5, -14, -11.75, 15.75, gSw);
        main.go(-6.6, 3.8, 3, 0).go(-8.1, 1.23, 2.5, 0).go(-14.5, -3.4, 3, 0);
        const sYard = main.p.length;
        main.go(-29.2, -3.6, 4, 2).go(-33.2, -7.2, 3, 0).go(-34.6, -12.0, 3, 0).go(-31.0, -20.0, 3, 1).go(-29.6, -24.5, 3, 0).go(-32.0, -28.3, 2.5, 0).go(-41.5, -28.3, 3, 1).go(-49.5, -28.3, 3, 0);
        const ext = new Track(-3.46, 2.0, -0.866, 0.5); ext.p = main.p.slice(0, sYard); ext.dip = main.dip.filter((q) => q.pos.x > -14.6); ext.quads = [];
        ext.dress(gSw);
        const ws = new Track(-14.5, -3.4, -1, 0); ws.p = main.p.slice(sYard - 1); ws.dip = main.dip.filter((q) => q.pos.x <= -14.6); ws.quads = main.quads;
        offYard(ws).dress(gWS);
        // white-neutron source: 6.5 cm tungsten target, beam dump, neutrons taken out at 30 degrees through a collimator [4]
        const wn = new Track(-14.5, -3.4, -0.81, -0.59).go(-21.5, -10.0, 4, 0);
        offYard(wn).dress(gSw, 0.06);
        { const sm = A.dipole(1.6); put(sm, YARD.clone().addScaledVector(V3(-0.81, 0, -0.59), 0.6), V3(-0.81, 0, -0.59), gSw); }   // switching magnet (one box, schematic)
        gSw.add(A.shadowy(A.rbox(0.7, 0.7, 0.7, 0.05, M.copper, -21.5, 0, -10.0)));
        const dd = wn.d.clone(), dump = P(-21.5, -10).addScaledVector(dd, 1.6);
        gSw.add(A.shadowy(put(A.rbox(1.6, 1.8, 2.2, 0.05, G.iron, 0, 0, 0), dump, dd, gSw)));
        const nd = rot(dd, -30 * D2R);
        const col = put(A.rbox(0.7, 0.7, 3.4, 0.04, G.iron, 0, 0, 0), P(-21.5, -10).addScaledVector(nd, 2.6), nd, gSw); A.shadowy(col);
        W(-25.5, -14, -18, -14, 1.6, 4.2, gSw);
        gSw.add(A.person(-0.6).translateX(-18).translateZ(-6.5));
        beams.push({ pts: main.p, n: 30, speed: 0.07, color: amber, size: 0.9 });
        beams.push({ pts: byp.p, n: 5, speed: 0.12, color: pale, size: 0.8 });
        beams.push({ pts: wn.p.slice(0), n: 4, speed: 0.2, color: amber, size: 0.85 });
      }

      // =====================================================================================================
      // West experimental hall (2080 m2 [5]): Grand Raiden and LAS on the WS course, MuSIC on the WSS line
      // =====================================================================================================
      const gWH = A.section("West experimental hall: Grand Raiden and LAS", "end", [P(-73.5, -36.6), P(-38, -12)], 2);
      const TGT = P(-49.5, -28.3);
      {
        floor(-76.5, -38.8, -20.5, 7, gWH);
        const H = 4.2;
        W(-75, -38.8, -75, 7, 3, H, gWH); W(-76.5, 5.5, -20.5, 5.5, 3, H, gWH); W(-76.5, -37.75, -25.6, -37.75, 2.3, H, gWH);
        W(-25.6, -36.6, -29.5, -31, 2.6, H, gWH); W(-30.8, -31, -30.8, -14, 2.6, H, gWH);
        W(-25.5, -14, -25.5, -12.2, 3, H, gWH); W(-25.5, -9.4, -25.5, -5.1, 3, H, gWH); W(-22, -2.1, -22, 5.5, 2.6, H, gWH);
        A.lamps(P(-73.5, 4), P(-23, 4), gWH, 9); A.lamps(P(-73.5, -36.6), P(-31, -36.6), gWH, 9);
        // the six building columns of the hall, positions from the plan [1]
        for (const x of [-61.1, -36.7]) for (const z of [-30.9, -19.3, -8.4]) gWH.add(A.shadowy(A.box(2.4, 6.4, 2.4, G.wall, x, FLOOR + 3.2, z)));
        // the straight-through line past the target to the beam dump in the west wall [1]
        const bd = new Track(-49.5, -28.3, -1, 0).go(-74, -28.3, 3, 2); bd.dress(gWH);
        gWH.add(A.shadowy(A.box(4, 3.6, 5, G.iron, -77.5, FLOOR + 1.8, -28.3)));
        beams.push({ pts: [TGT, P(-74, -28.3)], n: 5, speed: 0.12, color: amber, size: 0.8 });

        // ---------- Grand Raiden: Q1-SX-Q2-D1-MP-D2-DSR, rho = 3 m, 162 degrees, 600 t, -5 to 90 degrees on a
        // rotating platform [3,4,5]; element positions from the scaled drawing of [6]; set here at 30 degrees
        const gr = new THREE.Group(), yPl = FLOOR + 0.35;
        const GR = { th: 30 };
        {
          const ax = (s) => V3(0, 0, s);
          const q1 = A.quad(0.6, { R: 0.5, floor: yPl }); q1.position.copy(ax(1.1)); gr.add(q1);
          const sx = A.quad(0.3, { n: 6, R: 0.31, r0: 0.075, floor: yPl }); sx.position.copy(ax(2.04)); gr.add(sx);   // sextupole
          const q2 = A.quad(0.45, { R: 0.4, floor: yPl }); q2.position.copy(ax(2.67)); gr.add(q2);
          const d1 = sectorMag(3, -60, 1.9, yPl + 0.05, 1.35, G.gr, 0.25, 0.3);
          d1.g.position.copy(ax(3.2)); gr.add(d1.g);
          const e1 = ax(3.2).add(d1.exit), u1 = d1.dir;
          const mp = A.quad(0.9, { R: 0.6, r0: 0.12, floor: yPl }); put(mp, e1.clone().addScaledVector(u1, 1.65), u1, gr);   // multipole MP
          const d2s = e1.clone().addScaledVector(u1, 3.3);
          const d2 = sectorMag(3, -102, 3.4, yPl + 0.05, 2.25, G.gr, 0.9, 0.7, 0.75);
          put(d2.g, d2s, u1, gr);
          const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), u1);
          const e2 = d2s.clone().add(d2.exit.clone().applyQuaternion(q)), u2 = d2.dir.clone().applyQuaternion(q);
          const dsr = A.dipole(0.9, { w: 3.0, h: 1.1, gap: 0.17, mat: G.gr, floor: yPl }); put(dsr, e2.clone().addScaledVector(u2, 3.3), u2, gr);   // DSR dipole
          A.pipe([V3(0, 0, 0.3), ax(3.25)], gr, 0.06);
          A.pipe([e1, d2s], gr, 0.08);
          // focal plane: two VDCs (1.2 m effective) and trigger scintillators, focal line tilted 45 degrees [3,4]
          const fp = e2.clone().addScaledVector(u2, 5.3), uf = rot(u2, 45 * D2R);
          A.pipe([e2.clone().addScaledVector(u2, 0.2), e2.clone().addScaledVector(u2, 2.7)], gr, 0.16);
          A.pipe([e2.clone().addScaledVector(u2, 3.9), fp.clone().addScaledVector(u2, -0.6)], gr, 0.16);
          const n = rot(uf, 90 * D2R);
          for (const [o, w, m] of [[-0.35, 0.08, M.steelDark], [0.0, 0.08, M.steelDark], [0.45, 0.04, G.scint], [0.65, 0.04, G.scint]]) {
            const fr = A.box(2.0, 0.55, w, m, 0, 0, 0); put(fr, fp.clone().addScaledVector(u2, o), n, gr);
          }
          const hut = A.rbox(2.2, 1.9, 1.2, 0.05, M.rack, 0, 0, 0); put(hut, fp.clone().addScaledVector(u2, 1.7).setY(yPl + 0.95), n, gr);
          // the platform: a steel deck under the whole spectrometer, pivoting about the target
          const pts2 = [V3(-0.9, 0, -0.8), V3(-0.9, 0, 3.0)];
          for (const v of [e1, d2s, e2, fp]) for (const dx of [-2.6, 2.6]) for (const dz of [-2.6, 2.6]) pts2.push(V3(v.x + dx, 0, v.z + dz));
          const hull = (pp) => { const s = pp.slice().sort((a, b) => a.x - b.x || a.z - b.z), cr = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x); const lo = [], up = []; for (const p of s) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (const p of s.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
          const hp = hull(pts2), sh = new THREE.Shape(); hp.forEach((p, i) => (i ? sh.lineTo(p.x, p.z) : sh.moveTo(p.x, p.z)));
          const dg = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false }); dg.rotateX(Math.PI / 2); dg.translate(0, yPl, 0);
          const deck = new THREE.Mesh(dg, G.deck); deck.castShadow = true; deck.receiveShadow = true; gr.add(deck);
          GR.fp = fp; GR.e2 = e2;
        }
        const grDir = rot(V3(-1, 0, 0), -GR.th * D2R);         // beam heads west; GR on the left (south) side
        put(gr, TGT, grDir, gWH);
        // rails of the rotating platform: arcs about the target on the south side (radii schematic, the plan shows ~12 m)
        for (const r of [4.6, 7.8, 10.6]) {
          const g = new THREE.TorusGeometry(r, 0.07, 6, 90, 110 * D2R); g.rotateX(Math.PI / 2);          // arc from 75 to 185 degrees (x east, z south)
          const m = new THREE.Mesh(g, G.rail); m.position.set(TGT.x, FLOOR + 0.05, TGT.z); m.rotation.y = -75 * D2R; gWH.add(m);
        }
        // scattering chamber (shared by both arms)
        const sc = chamber(0.48, 1.0); sc.position.copy(TGT); gWH.add(sc);
        // ---------- LAS: multipole + one dipole, rho = 1.75 m, 70 degrees, 150 t, -10 to 135 degrees; geometry of [7]; set at 60 degrees
        {
          const las = new THREE.Group();
          const mp = A.quad(0.6, { R: 0.6, r0: 0.11, mat: G.las }); mp.position.set(0, 0, 1.05); las.add(mp);
          const d = sectorMag(1.75, 70, 2.9, FLOOR + 0.25, 1.55, G.las, 0.6, 0.6, 0.6); d.g.position.set(0, 0, 2.1); las.add(d.g);
          const e = V3(0, 0, 2.1).add(d.exit), u = d.dir;
          A.pipe([V3(0, 0, 0.5), V3(0, 0, 2.1)], las, 0.07);
          const fp = e.clone().addScaledVector(u, 1.96), uf = rot(u, -57.7 * D2R), n = rot(uf, 90 * D2R);
          const ch = A.box(1.4, 0.5, 1.6, M.steelDark, 0, 0, 0); put(ch, e.clone().addScaledVector(u, 0.9), u, las);       // exit vacuum box
          for (const o of [0, 0.25, 0.5]) put(A.box(2.0, 0.5, 0.06, o > 0.3 ? G.scint : M.steelDark, 0, 0, 0), fp.clone().addScaledVector(u, o), n, las);
          las.add(A.box(0.8, -0.3 - FLOOR, 0.8, M.steelDark, fp.x, (FLOOR - 0.3) / 2, fp.z));
          put(las, TGT, rot(V3(-1, 0, 0), 60 * D2R), gWH);
        }
        gWH.add(A.person(1.2).translateX(-41.5).translateZ(-21.5)); gWH.add(A.person(-2).translateX(-52).translateZ(-33));
      }

      // ---------- MuSIC: 400 MeV protons on a 20 cm graphite target inside the 3.5 T pion-capture solenoid, a 36 degree curved
      // transport solenoid, then the M1 beam line (slits, triplets, two bends, DC separator) [2,9,10]
      const gMu = A.section("MuSIC muon beam line", "end", [P(-56, -18), P(-40, 3)], 2);
      {
        const wss = new Track(-29.2, -3.6, -1, 0).go(-48.2, -3.6, 3, 2); wss.dress(gMu);
        beams.push({ pts: wss.p, n: 8, speed: 0.12, color: amber, size: 0.85 });
        const pcs = P(-49.6, -3.6), u0 = V3(Math.cos(15 * D2R), 0, -Math.sin(15 * D2R));     // capture-solenoid axis (tilt schematic)
        const cg = new THREE.CylinderGeometry(1.0, 1.0, 2.6, 28); cg.rotateX(Math.PI / 2);
        const cs = new THREE.Mesh(cg, G.cryo); A.orientTo(cs, pcs, u0); gMu.add(A.shadowy(cs));
        gMu.add(A.box(1.6, -1.0 - FLOOR, 2.0, M.steelDark, pcs.x, (FLOOR - 1.0) / 2, pcs.z));
        const gm = A.cyl(0.3, 0.9, M.steel, 14); gm.position.set(pcs.x, 1.45, pcs.z); gMu.add(gm);       // GM cryocooler
        // the 36 degree curved transport solenoid, bending toward the north
        const sl = new Track(pcs.x + 1.3 * u0.x, pcs.z + 1.3 * u0.z, u0.x, u0.z).b(-36, 3.0, true);
        const arc = sl.p;
        const sol = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 24, 0.42, 16, false), G.cryo); sol.castShadow = true; gMu.add(sol);
        for (let i = 1; i < arc.length; i += 2) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 20), M.steelDark); A.orientTo(r, arc[i], arc[Math.min(i + 1, arc.length - 1)].clone().sub(arc[i - 1]).normalize()); gMu.add(r); }
        for (const p of [arc[1], arc[arc.length - 2]]) gMu.add(A.box(0.5, -0.42 - FLOOR, 0.5, M.steelDark, p.x, (FLOOR - 0.42) / 2, p.z));
        // M1 line: steering magnets, QM1, BM1, BM2, QM2, DC separator SR, QM3 [9]; drifts and bend angles read off its layout figure, schematic
        const m1 = new Track(sl.pos.x, sl.pos.z, sl.d.x, sl.d.z);
        const here = (o) => m1.pos.addScaledVector(m1.d, o);
        put(A.dipole(0.4), here(0.5), m1.d, gMu);                                                   // STH1, STH2
        m1.s(1.0); for (const o of [0.5, 1.1, 1.7]) put(A.quad(0.45), here(o), m1.d, gMu);           // QM1
        m1.s(2.2); put(A.dipole(0.8), here(0.4), rot(m1.d, 10 * D2R), gMu); m1.b(20, 1.2, true);      // BM1
        m1.s(2.0); put(A.dipole(0.8), here(0.4), rot(m1.d, -15 * D2R), gMu); m1.b(-30, 1.2, true);    // BM2
        for (const o of [0.8, 1.4, 2.0]) put(A.quad(0.45), here(o), m1.d, gMu);                      // QM2
        put(elem(1.6, 1.6, 1.4, G.sep, FLOOR), here(3.5), m1.d, gMu);                                   // SR
        for (const o of [4.8, 5.4, 6.0]) put(A.quad(0.45), here(o), m1.d, gMu);                      // QM3
        m1.s(6.7);
        const port = chamber(0.35, 0.6); port.position.copy(m1.pos); gMu.add(port);
        A.pipe(m1.p, gMu, 0.09);
        beams.push({ pts: arc.concat(m1.p.slice(1)), n: 9, speed: 0.1, color: muon, size: 0.8 });
        // layered iron and concrete shielding around the capture solenoid (outline from the plan [2]; heights schematic)
        for (const [x0, z0, x1, z1, h] of [[-55, -8, -51.4, 3, 3.2], [-51.4, -1.6, -47.4, 3, 2.6], [-55, -9.6, -52.4, -8, 2.0], [-51.4, -8, -50.4, -5.8, 2.6]])
          gMu.add(A.shadowy(A.box(x1 - x0, h, z1 - z0, G.block, (x0 + x1) / 2, FLOOR + h / 2, (z0 + z1) / 2)));
        gMu.add(A.person(2.6).translateX(-44).translateZ(-1.5));
      }

      // =====================================================================================================
      // north trunk: N0 course (neutron TOF) and the EN course (in-flight RI separator) in the east hall
      // =====================================================================================================
      const gN0 = A.section("N0 course: (p,n) neutron time of flight", "end", [P(-26.5, -48), P(-9, -36.5)], 1);
      const gTun = A.section("Neutron TOF tunnel (100 m)", "end", [P(-124.5, -43.8), P(-26.5, -37.8)], 1);
      const gEN = A.section("EN course: in-flight RI beam separator", "sep", [P(-9, -48), P(15.5, -14)], 1);
      {
        floor(-27, -48.8, 16.5, -12.75, gEN);
        floor(-124.5, -43.8, -26, -37.8, gTun);
        const H = 4.2;
        W(-27.2, -48.2, 16.5, -48.2, 1.5, H, gEN); W(15.5, -48.2, 15.5, -12.75, 2.5, H, gEN); W(-9, -14, 15.5, -14, 2.5, H, gEN);
        W(-9, -48.2, -9, -37.5, 1.5, H, gEN); W(-9, -31.5, -9, -14, 1.5, H, gEN);
        W(-17, -36, -17, -14, 1.6, H, gSw);
        W(-26.5, -36.5, -15.6, -36.5, 1.5, H, gN0); W(-10.8, -36.5, -9, -36.5, 1.5, H, gN0);
        // the shielding wall with the collimator and clearing magnet between the N0 target and the tunnel [4]
        W(-26.2, -48.2, -26.2, -41.55, 1.5, H, gN0, G.iron); W(-26.2, -40.65, -26.2, -36.5, 1.5, H, gN0, G.iron);
        // tunnel: 100 m flight path [1,3,4]; underground in reality, drawn open at the top
        W(-124.5, -43.3, -27, -43.3, 1.0, 3.6, gTun); W(-124.5, -38.4, -76.5, -38.4, 1.0, 3.6, gTun); W(-125, -43.8, -125, -37.9, 1.0, 3.6, gTun);
        A.lamps(P(-120, -42.8), P(-28, -42.8), gTun, 12);

        const tr = new Track(-14.5, -3.4, -0.81, -0.59).go(-14.3, -8.0, 3, 0).go(-13.2, -30.5, 3, 2);
        offYard(tr).dress(gSw);
        // N0: up into the hall, the bending magnet, the beam swinger, the Li target; protons swept to the Faraday cup [4]
        const n0 = new Track(-13.2, -30.5, tr.d.x, tr.d.z).go(-12.7, -40.3, 3, 1).b(-120, 2.6).s(2.5).b(30, 2.5);
        n0.dress(gN0);
        const tg = n0.pos.addScaledVector(n0.d, 0.8);
        A.pipe([n0.pos, tg], gN0, 0.07);
        gN0.add(A.shadowy(A.rbox(0.6, 0.6, 0.6, 0.05, M.steel, tg.x, 0, tg.z)));
        const swg = sectorMag(2.0, -80, 1.0, FLOOR + 0.3, 0.7, M.dipole, 0.1, 0.1); put(swg.g, tg.clone().addScaledVector(n0.d, 0.2), n0.d, gN0);   // swinger (geometry schematic)
        const fcP = P(tg.x - 1.0, -37.6);
        A.pipe([tg, tg.clone().addScaledVector(n0.d, 1.2).add(V3(0, 0, 0.6)), fcP], gN0, 0.07);
        gN0.add(A.shadowy(A.rbox(1.0, 1.4, 1.0, 0.05, G.iron, fcP.x, FLOOR + 0.7, fcP.z)));
        // neutron detector on a handcart, flight path variable 10 to 100 m [4]; shown at 95.5 m [4]
        const dx = tg.x - 95.5;
        gTun.add(A.shadowy(A.box(1.0, 1.0, 0.3, G.scint, dx, 0, tg.z)));
        gTun.add(A.shadowy(A.box(1.4, 0.5, 1.2, M.steelDark, dx, FLOOR + 0.25, tg.z)));
        gTun.add(A.box(0.6, 0.9, 0.5, M.rack, dx + 0.5, FLOOR + 0.95, tg.z + 0.6));
        gTun.add(A.person(-1.5).translateX(dx + 1.6).translateZ(tg.z - 0.6));
        const nb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, Math.abs(dx - tg.x), 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.6, 1.0), transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }));
        nb.rotation.z = Math.PI / 2; nb.position.set((tg.x + dx) / 2, 0, tg.z); gTun.add(nb);
        gN0.add(A.person(0.8).translateX(-18).translateZ(-46));
        beams.push({ pts: tr.p.concat(n0.p.slice(1), [tg]), n: 14, speed: 0.1, color: amber, size: 0.85 });
        beams.push({ pts: [tg, P(dx, tg.z)], n: 10, speed: 0.06, color: blue, size: 0.7 });

        // EN: F0-Q-Q-Q-D-SX-F1-SX-Q-D-Q-Q-Q-F2-Q-Q-F3, two 30 degree dipoles of radius 2.2 m, 3.4 Tm [4]; drift lengths schematic
        const en = new Track(-13.2, -30.5, tr.d.x, tr.d.z).go(-8.6, -33.7, 3, 0);
        const swE = en.pos; en.b(-15, 2.0);                                                     // swinger magnet before F0
        put(A.dipole(0.6), swE.clone().addScaledVector(en.d, -0.25), en.d, gEN);
        en.s(1.2); const F0 = en.pos;
        const f0 = chamber(0.4, 0.7); f0.position.copy(F0); gEN.add(f0);
        const step = (L) => { const p = en.pos; en.s(L); return { p: p.clone().addScaledVector(en.d, L), d: en.d.clone() }; };
        const q = (s0, Lq) => put(A.quad(Lq || 0.5, { R: 0.55 }), s0.p, s0.d, gEN);
        q(step(1.5)); q(step(0.8)); q(step(0.8)); step(0.9);
        const D1 = sectorMag(2.2, 30, 1.6, FLOOR + 0.3, 0.8, G.sepIron, 0.15, 0.15); put(D1.g, en.pos, en.d, gEN); en.b(30, 2.2, true);
        put(A.quad(0.3, { n: 6, R: 0.35, r0: 0.08 }), step(1.0).p, en.d, gEN);                    // SX1
        const F1 = step(1.6); put(A.box(0.6, 0.5, 0.4, M.steelDark, 0, 0, 0), F1.p, F1.d, gEN);
        put(A.quad(0.3, { n: 6, R: 0.35, r0: 0.08 }), step(0.6).p, en.d, gEN);                    // SX2
        q(step(0.6)); step(1.2);
        const D2 = sectorMag(2.2, 30, 1.6, FLOOR + 0.3, 0.8, G.sepIron, 0.15, 0.15); put(D2.g, en.pos, en.d, gEN); en.b(30, 2.2, true);
        q(step(0.9)); q(step(0.8)); q(step(0.8));
        const F2 = step(1.2); put(A.box(0.6, 0.5, 0.4, M.steelDark, 0, 0, 0), F2.p, F2.d, gEN);
        q(step(1.5), 0.7); q(step(0.9), 0.7);
        const F3 = step(1.5).p; const f3 = chamber(0.55, 0.9); f3.position.copy(F3); gEN.add(f3);
        A.pipe(en.p, gEN, 0.07);
        const det = A.rbox(1.6, 1.6, 0.8, 0.05, M.rack, 0, 0, 0); put(det, F3.clone().addScaledVector(en.d, 1.5), en.d, gEN);
        gEN.add(A.person(-2.2).translateX(F3.x - 1).translateZ(F3.z + 2));
        beams.push({ pts: en.p, n: 10, speed: 0.12, color: [0.85, 0.75, 1.0], size: 0.8 });
      }

      A.shadowArea(-45, 5, 105);
      const note = `<b>RCNP cyclotron facility, Research Center for Nuclear Physics, The University of Osaka (Ibaraki).</b> `
        + `The K140 AVF cyclotron injects into the six-sector K400 ring cyclotron (protons up to 400 MeV, heavy ions up to 100 MeV/u) [2,3]. `
        + `<b>To scale:</b> the building outlines, the routes of the beam lines and the positions of the devices are read off the plan with its 50 m scale bar [1] and its 2013 update with MuSIC [2] (to about 1 m); `
        + `the ring sector magnets (injection radius 2 m, extraction 4 m, sector length 5.5 m, height 5.26 m on 0.97 m legs, six sectors, three single-gap acceleration cavities and a flat-top cavity) [3]; `
        + `the AVF yoke footprint [1] (pole diameter 3.3 m and 400 t in the official RCNP specification); Grand Raiden (radius 3 m, 162 degrees in D1 and D2, Q1, SX, Q2 and the D1, MP, D2, DSR spacing from the scaled drawing of [6], focal line tilted 45 degrees [3]); `
        + `LAS (multipole 0.6 m long, 0.75 m drifts, dipole radius 1.75 m and 70 degrees, 1.96 m to the focal plane tilted 57.7 degrees [7]); the 100 m neutron flight path with the detector at 95.5 m [3,4]; the EN separator dipoles (radius 2.2 m, 30 degrees each, magnet sequence from [4]). `
        + `<b>Schematic:</b> all heights; magnet colours; the spiral twist of the ring sectors and which valley holds which cavity; the shape of the AVF resonator; the GR and LAS set angles (30 and 60 degrees here; GR covers -5 to 90 degrees, LAS -10 to 135 [5]); the radii of the platform rails; the bend radii and quadrupole positions of the transport lines (the plan fixes the routes, not every magnet); `
        + `drift lengths in the EN separator and the MuSIC M1 line; the N0 swinger; the shielding blocks around MuSIC; the interior walls of the AVF building. Bunches run on every line at once for illustration. `
        + `<b>Left out</b> (current status not verified): the UCN source and the ES line in the east hall, which appear on the 2009 and 2013 plans; the ENN course [10]; the old AVF-building spectrometers. `
        + `The ring magnet paint is approximated from the official RCNP photograph (green sectors, silver RF cavities); fasteners and cooling lines are schematic. The AVF cyclotron was rebuilt in 2019 to 2021 (double dee, new RF, trim coils and vacuum; main coils, yoke and poles reused [10]); its outside is drawn from the earlier plans. `
        + `<br><b>Sources.</b> [1] K. Hatanaka et al., "RCNP cyclotron facility", Proc. HIAT09, Venice, TU-09, Fig. 1 (2009). `
        + `[2] K. Hatanaka et al., "Present status of the RCNP cyclotron facility", Proc. Cyclotrons 2013, Vancouver, MOPPT005, Fig. 1. `
        + `[3] H. Ikegami, "The RCNP ring cyclotron facilities", Proc. 12th Int. Conf. on Cyclotrons and their Applications, Berlin (1989), p. 30: Tables 1 and 4, Figs. 5 and 8. `
        + `[4] RCNP Cyclotron Facility web pages: Grand Raiden/LAS, EN course, N0 course, WN course (white neutron irradiation facility), AVF K/F course (rcnp.osaka-u.ac.jp/Divisions/np1-a/RCF/). `
        + `[5] RCNP, "West experimental hall" (rcnp.osaka-u.ac.jp/Divisions/plan/yoran/west-hall-e.html). `
        + `[6] T. Miyagawa and J. Tanaka, "Ion optics for quasi-free (p,p alpha) reactions with Grand Raiden spectrometer", arXiv:2601.00846, Fig. 1. `
        + `[7] T. Miyagawa et al., "Ion-optical tuning of the Large Acceptance Spectrometer", arXiv:2605.08127, Fig. 1. `
        + `[8] T. Wakasa, "New capabilities of the Grand Raiden spectrometer", PANIC02 (WS line: 65.46 m, 270 degrees of bending, dispersion matching with GR). `
        + `[9] Y. Matsumoto et al., "A new DC muon beam line at RCNP, Osaka University", Proc. IPAC2015, WEPWA021; D. Tomono et al., RCNP Annual Report 2017 (MuSIC); MuSIC-M1 in use: arXiv:2508.00377. `
        + `[10] H. Kanda et al., "Status of the cyclotron facility at Research Center for Nuclear Physics", Proc. Cyclotrons 2019, TUC04.`;
      return { view: { target: [-31, 0, 12], pos: [40, 160, 172] }, beams, note };
    },
  };
})();
