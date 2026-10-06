/* RIKEN Nishina Center RI Beam Factory (RIBF, Wako), for accelerator.html (registers FACILITY_MODULES.riken).
   Coordinates: metres, x to the east, z to the south, beam line at y = 0. The SRC sits at the origin.
   The new facility (SRC, IRC, BigRIPS, experimental halls) follows the published plans with a 10 m scale bar
   (RIBF TAC-05 BigRIPS report, Fig. 1-a; RIBF upgrade document 2023, Fig. 4.6). The Nishina building
   (RRC, fRC, AVF, RILAC2, low-energy facility) and the LINAC building are placed schematically to the
   south-east, with the beam topology of the facility's own accelerator chain diagram. Sources: see note. */
(function () {
  window.FACILITY_MODULES = window.FACILITY_MODULES || {};
  window.FACILITY_MODULES.riken = {
    label: "RIKEN RIBF",
    build(A) {
      const { THREE, V3, M, FLOOR } = A;
      const D2R = Math.PI / 180, PI = Math.PI;
      const specs = Object.fromEntries(A.cyclotrons.filter((c) => c.id?.startsWith("riken-")).map((c) => [c.id.slice(6), c]));

      // ---------- materials of this module (shared, so the static merge keeps draw calls low)
      const paint = (c) => A.magPaint(c, true);                    // solid (cyclotron) iron; beam-line dipoles use the laminated paint
      const K = {
        rrc: paint("#2f6fae"), frc: paint("#cc6a2e"), irc: paint("#2e8a66"), src: paint("#7a5ca3"),   // colours of the facility's own chain diagram
        green: A.magPaint("#4f9a3c"), samurai: paint("#2d5299"), avf: paint("#3a3f8f"), garis: A.magPaint("#2f6db0"),
        iron: new THREE.MeshStandardMaterial({ color: "#5b6168", metalness: 0.55, roughness: 0.62, envMapIntensity: 0.5 }),
        rf: new THREE.MeshStandardMaterial({ color: "#b9bec4", metalness: 0.75, roughness: 0.38, envMapIntensity: 0.8 }),
        base: new THREE.MeshStandardMaterial({ color: "#8a8f86", metalness: 0.4, roughness: 0.6 }),
        bar: new THREE.MeshStandardMaterial({ color: "#2a2d33", metalness: 0.1, roughness: 0.6 }),
        wall: new THREE.MeshStandardMaterial({ color: "#85878a", map: A.concreteMap, roughness: 0.94, metalness: 0, envMapIntensity: 0.25 }),
        // superconducting-triplet cryostats: painted, matte enough that the environment reflection stays under the bloom threshold
        cryo: new THREE.MeshStandardMaterial({ color: "#7a8089", metalness: 0.2, roughness: 0.6, envMapIntensity: 0.4, emissive: "#000000" }),
      };

      // ---------- geometry helpers
      // a vertical prism over a plan polygon [[x, z], ...] from y0 to y1
      function prism(pts, y0, y1, m) {
        const s = pts instanceof THREE.Shape ? pts : new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], -p[1])));
        const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 24 });
        g.rotateX(-PI / 2); g.translate(0, y0, 0);
        const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
      }
      // an annular sector around (cx, cz), radii r0..r1, angles a0..a1 (radians, from +x towards +z)
      function ann(cx, cz, r0, r1, a0, a1, n) {
        n = n || Math.max(4, Math.ceil(Math.abs(a1 - a0) / (4 * D2R)));
        const p = [];
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r1 * Math.cos(a), cz + r1 * Math.sin(a)]); }
        for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r0 * Math.cos(a), cz + r0 * Math.sin(a)]); }
        return p;
      }
      const at = (o, p, d) => A.orientTo(o, p, d.clone().setY(0).normalize());
      // concrete wall from a to b with its base at y0 (vault walls start at the pit floor)
      function wallY(a, b, y0, h, t, g) {
        const L = a.distanceTo(b), m = new THREE.Mesh(new THREE.BoxGeometry(t, h, L), K.wall);
        const c = a.clone().add(b).multiplyScalar(0.5); c.y = y0 + h / 2;
        at(m, c, b.clone().sub(a)); m.castShadow = true; m.receiveShadow = true; g.add(m);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(t + 0.04, 0.12, L), M.steelDark); at(cap, c.clone().setY(y0 + h + 0.06), b.clone().sub(a)); g.add(cap);
      }
      const rectWalls = (x0, z0, x1, z1, y0, h, t, g, skip) => {
        const c = [V3(x0, 0, z0), V3(x1, 0, z0), V3(x1, 0, z1), V3(x0, 0, z1)];
        for (let i = 0; i < 4; i++) if (!(skip || []).includes(i)) wallY(c[i], c[(i + 1) % 4], y0, h, t, g);
      };
      // pits: rectangles whose floor is lower than FLOOR (cyclotron vaults, the SAMURAI pit)
      const PITS = [];
      const floorAt = (x, z) => { for (const p of PITS) if (x > p[0] && x < p[2] && z > p[1] && z < p[3]) return p[4]; return FLOOR; };
      // floor of a building rectangle minus the pit rectangles inside it (grid split)
      function floorWithPits(x0, z0, x1, z1, g) {
        const xs = [x0, x1], zs = [z0, z1];
        for (const p of PITS) { if (p[0] > x0 && p[0] < x1) xs.push(p[0]); if (p[2] > x0 && p[2] < x1) xs.push(p[2]); if (p[1] > z0 && p[1] < z1) zs.push(p[1]); if (p[3] > z0 && p[3] < z1) zs.push(p[3]); }
        xs.sort((a, b) => a - b); zs.sort((a, b) => a - b);
        for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
          const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
          if (xs[i + 1] - xs[i] < 0.01 || zs[j + 1] - zs[j] < 0.01) continue;
          A.slab(xs[i], zs[j], xs[i + 1], zs[j + 1], floorAt(cx, cz), M.floor, g, 6);
        }
      }
      function pit(x0, z0, x1, z1, y, g, h, skip) {                 // lowered vault floor with walls from the pit floor up
        PITS.push([x0, z0, x1, z1, y]);
        rectWalls(x0, z0, x1, z1, y, (h || 6.5) + (FLOOR - y), 1.6, g, skip);
      }
      // a stand from the local floor up to a part (for parts sitting over a pit)
      const standTo = (g, pos, top, w) => { const fy = floorAt(pos.x, pos.z); if (fy < FLOOR - 0.05) g.add(A.box(w || 0.6, top - fy, w || 0.6, M.steelDark, pos.x, fy + (top - fy) / 2, pos.z)); };

      // ---------- turtle for magnet-by-magnet beam lines (angles in degrees, positive turns from +x towards +z)
      class Tur {
        constructor(x, z, thDeg) { this.p = V3(x, 0, z); this.th = thDeg * D2R; this.pts = [this.p.clone()]; }
        get d() { return V3(Math.cos(this.th), 0, Math.sin(this.th)); }
        fwd(L) { this.p = this.p.clone().addScaledVector(this.d, L); this.pts.push(this.p.clone()); return this; }
        at(s) { return this.p.clone().addScaledVector(this.d, s); }
        arc(deg, R) {
          const s = Math.sign(deg), D = Math.abs(deg) * D2R, a0 = this.th + s * PI / 2;
          const c = V3(this.p.x + R * Math.cos(a0), 0, this.p.z + R * Math.sin(a0));
          const n = Math.max(6, Math.ceil(D / (3 * D2R)));
          for (let i = 1; i <= n; i++) { const f = D * i / n; this.pts.push(V3(c.x - R * Math.cos(a0 + s * f), 0, c.z - R * Math.sin(a0 + s * f))); }
          this.th += s * D; this.p = this.pts[this.pts.length - 1].clone();
          return { c, R, b0: a0 + PI, b1: a0 + PI + s * D, s };
        }
        copy() { const t = new Tur(this.p.x, this.p.z, this.th / D2R); return t; }
      }

      // A section's label sits at its userData.center, the centre of the box given to A.section. Where the device
      // is only known once its hardware is built, refit: pick box over the built path, label at the path's midpoint
      // by length (on the beam line itself, so it cannot drift onto a neighbouring device).
      function refit(g, pts, pad) {
        const bb = new THREE.Box3().setFromPoints(pts).expandByScalar(pad), c = bb.getCenter(V3(0, 0, 0)), sz = bb.getSize(V3(0, 0, 0));
        const pick = g.children.find((o) => o.isMesh && o.material.opacity === 0);
        pick.geometry.dispose(); pick.geometry = new THREE.BoxGeometry(sz.x, Math.max(sz.y, 14), sz.z); pick.position.copy(c);
        let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]);
        let s = L / 2, mid = pts[0].clone();
        for (let i = 1; i < pts.length; i++) {
          const d = pts[i].distanceTo(pts[i - 1]);
          if (s <= d) { mid = pts[i - 1].clone().lerp(pts[i], s / d); break; }
          s -= d;
        }
        g.userData.center.copy(mid); g.userData.radius = Math.max(sz.x, sz.z) / 2 + 6;
        g.userData.path = pts;                                        // kept for tests/check_accel_page.js
      }

      // ---------- parts
      // a bending magnet that follows its arc: the shared laminated H-type dipole, bent to the arc and centred on it,
      // standing on the local floor (a pit floor where it sits over one)
      function arcDipole(info, w, h, m, g) {
        const { c, R, b0, b1, s } = info, mid = (b0 + b1) / 2, D = Math.abs(b1 - b0);
        const pm = V3(c.x + R * Math.cos(mid), 0, c.z + R * Math.sin(mid)), t = V3(-Math.sin(mid), 0, Math.cos(mid)).multiplyScalar(s);
        const d = A.dipole(R * D, { bend: s * D, w, h, gap: 0.11, mat: m, floor: floorAt(pm.x, pm.z) });
        g.add(A.orientTo(d, pm, t));
      }
      // superconducting triplet in its cryostat (the BigRIPS STQ family), local +z along the beam
      function stq(pos, dir, g, len) {
        const o = new THREE.Group(), L = len || 2.3;
        const c = A.cyl(0.78, L, K.cryo, 28); c.rotation.x = PI / 2; o.add(c);
        for (const s of [-1, 1]) { const f = A.cyl(0.84, 0.12, M.steelDark, 28); f.rotation.x = PI / 2; f.position.z = s * (L / 2 - 0.06); o.add(f); }
        const cc = A.cyl(0.17, 0.85, M.steelDark, 14); cc.position.set(0.3, 1.1, 0.3); o.add(cc);
        o.add(A.box(0.45, 0.32, 0.45, K.cryo, 0.3, 1.65, 0.3));
        const fy = floorAt(pos.x, pos.z);
        o.add(A.box(1.1, -0.7 - fy, 1.3, M.steelDark, 0, fy + (-0.7 - fy) / 2, 0));
        g.add(A.shadowy(at(o, pos, dir)));
      }
      // focal-plane chamber with detector ladders
      function fchamber(pos, dir, g, big) {
        const o = new THREE.Group(), s = big ? 1.3 : 0.95;
        o.add(A.rbox(s, s, s, 0.05, M.steel, 0, 0, 0));
        const up = A.cyl(0.1, 0.7, M.steel, 12); up.position.y = s / 2 + 0.3; o.add(up);
        o.add(A.box(0.5, 0.16, 0.16, M.steelDark, 0, s / 2 + 0.7, 0));
        const fy = floorAt(pos.x, pos.z); o.add(A.box(0.5, -s / 2 - fy, 0.5, M.steelDark, 0, fy + (-s / 2 - fy) / 2, 0));
        g.add(A.shadowy(at(o, pos, dir)));
      }
      const quadAt = (pos, dir, g, L) => { g.add(at(A.quad(L || 0.5), pos, dir)); standTo(g, pos, FLOOR + 0.02); };
      const straightDipole = (pos, dir, g, L) => { g.add(at(A.dipole(L || 1.6), pos, dir)); standTo(g, pos, FLOOR + 0.02, 1.2); };
      // dress a transport line: pipe, a dipole on every bend, quadrupoles along the straights
      function dress(pts, g, o) {
        o = o || {};
        A.pipe(pts, g, o.r || 0.07);
        const path = new A.Path(pts), L = path.L, st = 0.5, hd = [];
        for (let s = 0; s <= L; s += st) { const a = path.at(Math.max(0, s - 0.7)), b = path.at(Math.min(L, s + 0.7)); hd.push(Math.atan2(b.z - a.z, b.x - a.x)); }
        const curv = hd.map((h, i) => { if (i === 0) return 0; let d = h - hd[i - 1]; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return Math.abs(d) / st; });
        const bendS = [];
        let i = 0;
        while (i < curv.length) {
          if (curv[i] > 0.012) { let j = i, tot = 0; while (j < curv.length && curv[j] > 0.012) { tot += curv[j] * st; j++; } if (tot > 10 * D2R && !o.noDip) bendS.push([i * st, j * st]); i = j; } else i++;
        }
        for (const [s0, s1] of bendS) {
          const sm = (s0 + s1) / 2, p = path.at(sm), q = path.at(Math.min(L, sm + 0.3));
          straightDipole(p, q.clone().sub(p), g, Math.min(2.4, Math.max(1.2, s1 - s0)));
        }
        const every = o.q || 7;
        for (let s = 3; s < L - 2; s += every) {
          if (bendS.some(([a, b]) => s > a - 2 && s < b + 2)) continue;
          if ((o.avoid || []).some((v) => path.at(s).distanceTo(v) < 3)) continue;
          const p = path.at(s), q = path.at(s + 0.3); quadAt(p, q.clone().sub(p), g, 0.45);
        }
      }
      // a separated-sector ring cyclotron: sector magnets (yoke halves, copper coils), RF resonators
      // and a flat-top cavity in the valleys, the valley vacuum chamber, the central injection region
      function ringCyc(o, g) {
        const spec = specs[o.id]; g.userData.cyc = spec.id;
        const { c, n, rIn, rOut, w, hT, m, rot } = o, ph = 360 / n, fy = floorAt(c.x, c.z);
        for (let i = 0; i < n; i++) {
          const a = (rot + i * ph) * D2R, hw = w / 2 * D2R, ew = 0.28 / ((rIn + rOut) / 2);
          g.add(prism(ann(c.x, c.z, rIn, rOut, a - hw, a + hw), 0.16, hT, m));
          g.add(prism(ann(c.x, c.z, rIn, rOut, a - hw, a + hw), Math.max(fy, -hT), -0.16, m));
          for (const y of [[0.16, 0.62], [-0.62, -0.16]]) g.add(prism(ann(c.x, c.z, rIn - 0.2, rOut + 0.2, a - hw - ew, a + hw + ew), y[0], y[1], M.coil));
          g.add(prism(ann(c.x, c.z, rOut - 0.5, rOut + 0.12, a - hw * 0.8, a + hw * 0.8), hT, hT + 0.25, M.steelDark));
          // Tie rods, top fasteners and service loops, schematic hardware outside the orbit aperture.
          for (const r of [rIn + 0.45, rOut - 0.45]) for (const side of [-1, 1]) {
            const aa = a + side * hw * 0.72, x = c.x + r * Math.cos(aa), z = c.z + r * Math.sin(aa);
            const bolt = A.cyl(0.065, 0.10, M.steel, 6); bolt.position.set(x, hT + 0.05, z); g.add(bolt);
          }
          for (const side of [-1, 1]) {
            const aa = a + side * hw * 0.55, r = rOut + 0.18, x = c.x + r * Math.cos(aa), z = c.z + r * Math.sin(aa);
            const rod = A.cyl(0.10, hT * 1.55, M.steel, 12); rod.position.set(x, 0, z); g.add(rod);
            const out = rOut + 0.8;
            const pts = [[x, 0.48, z], [c.x + out * Math.cos(aa), 0.55, c.z + out * Math.sin(aa)], [c.x + out * Math.cos(aa + .05), -0.75, c.z + out * Math.sin(aa + .05)], [x, -0.48, z]];
            g.add(new THREE.Mesh(A.gHose(pts, 0.04, 12), M.cable));
          }
   // top plate edge
        }
        g.userData.sectorCount = n; g.userData.rfCount = (o.valleys || []).filter((k) => k === "rf").length;
        g.userData.ftCount = (o.valleys || []).filter((k) => k === "ft").length;
        const vw = (ph - w) / 2 * D2R;
        (o.valleys || []).forEach((kind, k) => {
          const v = (rot + k * ph + ph / 2) * D2R;
          if (kind === "rf") {
            const hh = hT * 1.12;
            g.add(prism(ann(c.x, c.z, rIn + 0.15, rOut + 0.7, v - vw * 0.62, v + vw * 0.62), Math.max(fy, -hh), hh, K.rf));
            g.add(prism(ann(c.x, c.z, rIn + 0.4, rOut + 0.5, v - vw * 0.56, v + vw * 0.56), hh, hh + 0.1, M.steelDark));
            g.add(prism(ann(c.x, c.z, rIn + 0.9, rOut - 0.2, v - vw * 0.1, v + vw * 0.1), hh + 0.1, hh + 0.2, M.copper));   // inner conductor strip
            for (const f of [0.35, 0.7]) {                                   // tuning drives and the power feed on top
              const r = rIn + (rOut - rIn) * f, s = A.cyl(0.22, 0.9, M.steelDark, 14);
              s.position.set(c.x + r * Math.cos(v), hh + 0.55, c.z + r * Math.sin(v)); g.add(s);
            }
            const fd = A.cyl(0.3, 1.2, M.steel, 16); fd.rotation.z = PI / 2;
            const rr = rOut + 1.1; fd.position.set(c.x + rr * Math.cos(v), 0.4, c.z + rr * Math.sin(v)); fd.rotation.y = -v; g.add(fd);
          } else if (kind === "ft") {
            g.add(prism(ann(c.x, c.z, rIn + 0.8, rOut - 0.3, v - vw * 0.35, v + vw * 0.35), Math.max(fy, -hT * 0.85), hT * 0.85, K.rf));
            g.add(prism(ann(c.x, c.z, rIn + 1.0, rOut - 0.5, v - vw * 0.28, v + vw * 0.28), hT * 0.85, hT * 0.85 + 0.1, M.steelDark));
          }
        });
        // valley vacuum chamber between the sectors, at the beam plane
        g.add(prism(ann(c.x, c.z, rIn - 0.3, rOut - 0.1, 0, 2 * PI, 72), -0.18, 0.18, M.steelDark));
        if (o.id === "src") {
          // Central liquid-helium control dewar, visible in the official SRC cutaway.
          const d = A.cyl(0.85, 1.4, K.rf, 32); d.position.set(c.x, hT + 1.0, c.z); g.add(d);
          for (const yy of [hT + .35, hT + 1.65]) { const f = A.cyl(.94, .10, M.steel, 32); f.position.set(c.x, yy, c.z); g.add(f); }
          for (let k = 0; k < n; k++) { const a = k * 2 * PI / n; g.add(new THREE.Mesh(A.gHose([[c.x, hT + .8, c.z], [c.x + 1.5 * Math.cos(a), hT + .8, c.z + 1.5 * Math.sin(a)], [c.x + 2.4 * Math.cos(a), hT, c.z + 2.4 * Math.sin(a)]], .07, 10), K.rf)); }
        }
        const ctr = A.cyl(Math.max(0.35, rIn - 0.5), 0.9, M.steel, 24); ctr.position.set(c.x, 0.1, c.z); g.add(ctr);
        const cb = A.cyl(0.25, hT + 0.6, M.steelDark, 12); cb.position.set(c.x, (hT + 0.6) / 2, c.z); g.add(cb);   // injection elements
      }
      // the beam's spiral inside a cyclotron: Rinj to Rext, s = +1 turns towards +z
      function spiral(c, r0, r1, aIn, aOut, s, turns) {
        let tot = (aOut - aIn) * s; while (tot < 0) tot += 2 * PI; tot += 2 * PI * turns;
        const n = Math.ceil(tot / (7 * D2R)), p = [];
        for (let i = 0; i <= n; i++) { const t = i / n, a = aIn + s * tot * t, r = r0 + (r1 - r0) * t; p.push(V3(c.x + r * Math.cos(a), 0, c.z + r * Math.sin(a))); }
        return p;
      }
      const cpt = (c, r, a) => V3(c.x + r * Math.cos(a), 0, c.z + r * Math.sin(a));
      const bz = (a, da, b, db, k1, k2, n) => A.bez(a, a.clone().addScaledVector(da, k1), b.clone().addScaledVector(db, -k2), b, n || 24);
      const dirv = (deg) => V3(Math.cos(deg * D2R), 0, Math.sin(deg * D2R));
      const people = (g, list) => { for (const [x, z, r] of list) { const p = A.person(r || 0); p.position.set(x, floorAt(x, z) - FLOOR, z); g.add(p); } };

      // ======================================================================================
      // NEW FACILITY (to scale): SRC vault, IRC vault, BigRIPS hall, experimental halls
      // ======================================================================================
      const SRC = V3(0, 0, 0), IRC = V3(29, 0, 8);
      const gSRC = A.section("SRC (K2600)", "cyc", [V3(-12, 0, -12), V3(14, 0, 15)], 1);
      const gIRC = A.section("IRC (K980)", "cyc", [V3(17, 0, -2), V3(41, 0, 18)], 1);
      pit(-13.5, -12, 14, 16, -3.9, gSRC, 6.6);
      pit(14, -12, 42, 24, -2.9, gIRC, 5.6, [3]);

      // SRC: six superconducting sector magnets (6 m tall), four RF resonators plus one flat-top
      // cavity, Rinj 3.56 m, Rext 5.36 m, diameter 18.4 m and 8300 t with its iron self-shield [1, 2]
      ringCyc({ id: "src", c: SRC, n: specs.src.sectors, rIn: 2.2, rOut: 8.35, w: 31, hT: 3.0, m: K.src, rot: 0, valleys: ["rf", "ft", "rf", "rf", "", "rf"] }, gSRC);
      {
        // iron shield (0.8 m slabs, 18.4 m diameter, 7.7 m tall), cut away towards the default camera
        const cut0 = 75 * D2R, cut1 = 205 * D2R;
        gSRC.add(prism(ann(0, 0, 8.4, 9.2, cut1, cut0 + 2 * PI, 60), -3.85, 3.85, K.iron));
        gSRC.add(prism(ann(0, 0, 8.4, 9.2, cut0, cut1, 30), -3.85, -1.2, K.iron));
        gSRC.add(prism(ann(0, 0, 2.6, 9.2, 230 * D2R, 410 * D2R, 50), 3.05, 3.85, K.iron));       // lid over the far half; the centre is left open
        for (const a of [230, 410]) {                                                                  // cut faces of the lid, lighter edge
          gSRC.add(prism(ann(0, 0, 2.6, 9.2, a * D2R - 0.004, a * D2R + 0.004, 1), 3.05, 3.9, M.steel));
        }
        const cr = A.cyl(0.9, 1.4, M.steel, 20); cr.position.set(5.8, 4.55, -3.4); gSRC.add(cr);      // cryogenic service turret (generic)
        gSRC.add(A.box(2.4, 0.9, 1.6, M.steelDark, 6.8, 4.3, -5.4));
        people(gSRC, [[-6.5, 10.5, 0.4], [-8.2, 9.6, 1.6], [10.5, 9.5, -0.6]]);
      }
      // IRC: four room-temperature sectors, K980, Rinj 2.78 m, Rext 4.15 m, 14.0 m diameter, 2800 t [1, 2]
      ringCyc({ id: "irc", c: IRC, n: specs.irc.sectors, rIn: 1.8, rOut: 7.0, w: 46, hT: 2.6, m: K.irc, rot: 0, valleys: ["rf", "", "rf", "ft"] }, gIRC);
      people(gIRC, [[37.5, 18.5, -0.8]]);
      // vault floors
      floorWithPits(-13.5, -12, 42, 24, gSRC);

      // ---- BigRIPS (to scale): F0 production target, two-bend first stage F0-F2 (22.8 m), F2-F3 (8.8 m),
      // four-bend second stage F3-F7 (46.6 m); 14 STQs and 6 room-temperature dipoles of 30 degrees [4, 5, 6]
      const gB1 = A.section("BigRIPS first stage (F0 to F2)", "sep", [V3(14, 0, -32), V3(44, 0, -13)], 1);
      const gB2 = A.section("BigRIPS second stage (F3 to F7)", "sep", [V3(-38, 0, -32), V3(10, 0, -18)], 1);
      const RHO = 6.0, DW = 3.0, DH = 2.3;           // dipole bending radius, yoke width and height: schematic
      const T = new Tur(34, -15, -120);
      const F = {};
      F.F0 = T.p.clone();
      fchamber(T.p, T.d, gB1, true);
      T.fwd(1.0); stq(T.at(1.4), T.d, gB1); T.fwd(3.0);
      arcDipole(T.arc(-30, RHO), DW, DH, M.dipole, gB1);           // D1, the beam dump sits in its gap
      stq(T.at(2.0), T.d, gB1); T.fwd(4.2); F.F1 = T.p.clone(); fchamber(T.p, T.d, gB1);
      stq(T.at(2.1), T.d, gB1); T.fwd(4.2);
      arcDipole(T.arc(-30, RHO), DW, DH, M.dipole, gB1);           // D2
      stq(T.at(2.1), T.d, gB1); T.fwd(4.2); F.F2 = T.p.clone(); fchamber(T.p, T.d, gB1);
      stq(T.at(2.6), T.d, gB2); stq(T.at(6.2), T.d, gB2); T.fwd(8.8); F.F3 = T.p.clone(); fchamber(T.p, T.d, gB2);
      const S2 = 4.25;
      const segs = [[-30, "F4"], [30, "F5"], [30, "F6"], [-30, "F7"]];
      let T6 = null;
      for (const [ang, name] of segs) {
        stq(T.at(2.1), T.d, gB2); T.fwd(S2);
        if (name === "F7") T6 = T.copy();                           // the SHARAQ branch leaves at D6
        arcDipole(T.arc(ang, RHO), DW, DH, M.dipole, gB2);
        stq(T.at(2.1), T.d, gB2); T.fwd(S2); F[name] = T.p.clone(); fchamber(T.p, T.d, gB2);
      }
      const bigripsPts = T.pts.slice();
      A.pipe(bigripsPts, gB1, 0.09);
      // first-stage shielding: thick concrete blocks around target, D1 beam dump and F1 [6]
      {
        const y0 = FLOOR, h = 6.2;
        for (const [a, b, t] of [[V3(13, 0, -33.5), V3(45, 0, -33.5), 3.2], [V3(45, 0, -33.5), V3(45, 0, -12), 3.2], [V3(13, 0, -16.5), V3(25, 0, -16.5), 3.0],
          [V3(13, 0, -33.5), V3(13, 0, -29.5), 3.0], [V3(13, 0, -22.5), V3(13, 0, -16.5), 3.0]]) wallY(a, b, y0, h, t, gB1);
        // inner blocks hugging the target and D1
        gB1.add(A.box(2.4, 4.2, 6.0, K.wall, 37.0, FLOOR + 2.1, -21.0));             // beside the target and D1
        gB1.add(A.box(6.0, 4.2, 2.4, K.wall, 24.0, FLOOR + 2.1, -30.5));
        A.slab(13, -33.5, 46.5, -12, FLOOR, M.floor, gB1, 6);
        people(gB1, [[20, -19, 1.2]]);
      }
      // second-stage hall (BigRIPS hall), floor and walls
      A.slab(-44, -34, 13, -12, FLOOR, M.floor, gB2, 6);
      for (const [a, b] of [[V3(-44, 0, -34), V3(13, 0, -34)], [V3(-44, 0, -12), V3(-14.3, 0, -12)]]) A.wall(a, b, 5.5, 1.0, gB2);
      people(gB2, [[-6, -24.5, 0.9], [-7, -24, 2.3], [-30, -21.5, -1.2]]);

      // ---- ZeroDegree spectrometer: F7-F8 11.3 m, F8-F11 36.5 m, six STQs and two dipoles D7, D8 [4, 5]
      const gZD = A.section("ZeroDegree spectrometer (F8 to F11)", "end", [V3(-90, 0, -25), V3(-44, 0, -8)], 1);
      const TZ = T.copy();
      stq(TZ.at(3.5), TZ.d, gZD); stq(TZ.at(8.0), TZ.d, gZD); TZ.fwd(11.3); F.F8 = TZ.p.clone();
      // F8 secondary target surrounded by a gamma-ray array (DALI2-like barrel, generic)
      { const b = A.cyl(0.85, 1.2, K.base, 24); b.rotation.x = PI / 2; at(b, F.F8, TZ.d); gZD.add(b); const ring = A.cyl(0.95, 0.12, M.steelDark, 24); ring.rotation.x = PI / 2; at(ring, F.F8, TZ.d); gZD.add(ring);
        gZD.add(A.box(1.0, 0.85, 1.0, M.steelDark, F.F8.x, FLOOR + 0.42, F.F8.z)); }
      const TS = TZ.copy();                                           // the SAMURAI line continues straight
      stq(TZ.at(1.65), TZ.d, gZD); TZ.fwd(2.8);
      arcDipole(TZ.arc(-30, RHO), DW, DH, M.dipole, gZD);            // D7
      stq(TZ.at(2.0), TZ.d, gZD); fchamber(TZ.at(5.0), TZ.d, gZD); stq(TZ.at(8.5), TZ.d, gZD); stq(TZ.at(13.5), TZ.d, gZD); fchamber(TZ.at(17), TZ.d, gZD); stq(TZ.at(20), TZ.d, gZD);
      TZ.fwd(22);
      arcDipole(TZ.arc(30, RHO), DW, DH, M.dipole, gZD);             // D8
      stq(TZ.at(2.0), TZ.d, gZD); TZ.fwd(5.4); F.F11 = TZ.p.clone(); fchamber(F.F11, TZ.d, gZD, true);
      const zdPts = TZ.pts.slice();
      A.pipe(zdPts, gZD, 0.09);
      refit(gZD, zdPts.slice(zdPts.findIndex((q) => q.distanceTo(F.F8) < 1e-6)), 2);   // label on F8 to F11, not on the hall
      // ---- SLOWRI cryogenic RF-carpet gas cell and the ZD MRTOF mass spectrograph behind F11 [11]
      const gSL = A.section("ZD MRTOF + gas cell (SLOWRI)", "end", [F.F11.clone().addScaledVector(TZ.d, 1), F.F11.clone().addScaledVector(TZ.d, 7)], 2);
      {
        const d = TZ.d, n = V3(-d.z, 0, d.x), p0 = F.F11.clone().addScaledVector(d, 2.6);
        const gc = A.cyl(0.62, 1.5, M.steel, 24); gc.rotation.x = PI / 2; at(gc, p0, d); gSL.add(gc);
        const ch = A.cyl(0.7, 0.14, M.steelDark, 24); ch.rotation.x = PI / 2; at(ch, p0.clone().addScaledVector(d, 0.8), d); gSL.add(ch);
        const rfq = A.cyl(0.18, 1.6, M.steel, 14); rfq.rotation.x = PI / 2; at(rfq, p0.clone().addScaledVector(d, 1.9), d); gSL.add(rfq);
        const mr = A.cyl(0.22, 1.8, M.steel, 16); mr.rotation.x = PI / 2; at(mr, p0.clone().addScaledVector(d, 2.8).addScaledVector(n, 0.9), n); gSL.add(mr);
        for (const k of [0, 2.8]) { const q = p0.clone().addScaledVector(d, k); gSL.add(A.box(1.2, FLOOR + 0 - FLOOR + 0.8, 1.2, M.steelDark, q.x, FLOOR + 0.4, q.z)); }
        for (let i = 0; i < 2; i++) { const r = p0.clone().addScaledVector(d, 1.5).addScaledVector(n, -2.0 - i * 0.85); gSL.add(A.box(0.8, 2.0, 0.6, M.rack, r.x, FLOOR + 1.0, r.z)); }
        people(gSL, [[p0.x + 1.5 * n.x + 1.2 * d.x, p0.z + 1.5 * n.z + 1.2 * d.z, 0.5]]);
      }

      // ---- SAMURAI: F7-F12 24.7 m, F7-F13 39.6 m [5]; H-type superconducting dipole, round 2 m pole,
      // 0.88 m gap, yoke 6.7 m x 3.5 m x 4.64 m, 7 Tm, on a base rotatable from -5 to 95 degrees; STQ25 6.45 m
      // upstream of the magnet centre [7]; standard configuration (yoke at 30 degrees, target, FDC1, exit window,
      // FDC2, HODF, NEBULA at zero degrees) from the hall plan and yoke drawing of [15]
      const gSAM = A.section("SAMURAI", "end", [TS.at(26), TS.at(58)], 5);
      const samC = TS.at(39.6 - 11.3 + 2.2), samPit = [samC.x - 14.5, samC.z - 6.5, samC.x + 7.5, samC.z + 5.8];
      PITS.push([samPit[0], samPit[1], samPit[2], samPit[3], -2.55]);
      const samRoutes = [];
      gSAM.userData.detailLabels = [];
      const gSamLine = A.section("SAMURAI beam transport (F12 to F13)", "foc", [TS.at(12), TS.at(24)], 2);
      {
        stq(TS.at(5.0), TS.d, gSamLine); stq(TS.at(10.0), TS.d, gSamLine);
        fchamber(TS.at(24.7 - 11.3), TS.d, gSamLine);
        stq(samC.clone().addScaledVector(TS.d, -6.45), TS.d, gSamLine);
        const F13 = TS.at(39.6 - 11.3);
        A.pipe([TS.p.clone(), samC.clone().addScaledVector(TS.d, -4.8)], gSamLine, 0.09);
        // Beam frame: origin at the magnet centre, +x the incident (and neutron) axis, +z the bending side.
        // Standard configuration [15]: the yoke turned 30 degrees, so the beam enters through the back face
        // and neutrons and charged fragments all leave through the long exit window on the front face.
        const theta = Math.atan2(TS.d.z, TS.d.x), mag = new THREE.Group();
        mag.position.copy(samC); mag.rotation.y = -theta;
        const blue = new THREE.MeshStandardMaterial({ color: "#102abd", metalness: 0.12, roughness: 0.4, envMapIntensity: 0.3 });
        const gold = new THREE.MeshStandardMaterial({ color: "#f3c547", metalness: 0.28, roughness: 0.45 });
        const coil = new THREE.MeshStandardMaterial({ color: "#ee5837", metalness: 0.22, roughness: 0.4 });
        const basePaint = new THREE.MeshStandardMaterial({ color: "#94764f", metalness: 0.25, roughness: 0.52 });
        const window = new THREE.MeshStandardMaterial({ color: "#a9e8e7", metalness: 0.03, roughness: 0.38, emissive: "#23686c", emissiveIntensity: 0.12, transparent: true, opacity: 0.6 });
        const barPaint = new THREE.MeshStandardMaterial({ color: "#88c9da", metalness: 0.08, roughness: 0.48 });
        const framePaint = new THREE.MeshStandardMaterial({ color: "#19272e", metalness: 0, roughness: 0.8 });
        const glass = new THREE.MeshStandardMaterial({ color: "#f3c547", metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0.22, depthWrite: false });
        const YB = -2.32, ROT = 30 * D2R, n = V3(Math.cos(ROT), 0, Math.sin(ROT)), ex = V3(Math.sin(ROT), 0, -Math.cos(ROT));
        const toYoke = (p) => [p.dot(ex), p.dot(n)];                        // beam frame -> yoke plan (x along 6.7 m, z out of the exit face)
        // Rotating base, 10 m across [15], set in the pit; the yoke stands on it.
        mag.add(prism(ann(0, 0, 0, 5, 0, 2 * PI, 120), -2.55, YB, basePaint));
        const railMat = K.rf.clone(), stripe = new THREE.MeshStandardMaterial({ color: "#5d4a31", metalness: 0.2, roughness: 0.6 });
        for (const r of [4.75, 4.95]) { const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 120), railMat); rail.rotation.x = PI / 2; rail.position.y = YB + 0.02; mag.add(rail); }
        // radial marks on the base, so that its rotation is visible
        for (let k = 0; k < 12; k++) { const a = k * PI / 6, m = A.box(k % 3 ? 0.6 : 1.1, 0.012, 0.07, stripe, 0, YB + 0.006, 0);
          m.position.set((k % 3 ? 4.3 : 4.05) * Math.cos(a), YB + 0.006, (k % 3 ? 4.3 : 4.05) * Math.sin(a)); m.rotation.y = -a; mag.add(m); }
        // Yoke [15]: 6.7 m wide, 3.5 m deep, 4.64 m high, gap 0.88 m; return yokes at both ends with a 3.4 m
        // opening that widens towards the faces; field clamps above and below the gap on both long faces.
        const yk = new THREE.Group(); yk.rotation.y = PI / 2 - ROT; mag.add(yk);
        // The upper assembly has its own materials, so after the static merge it stays a separate mesh that the
        // apparatus view lifts (as in the overview cutaway); in the hall it sits assembled.
        const blueU = blue.clone(), goldU = gold.clone(), coilU = coil.clone(), up = new THREE.Group(); yk.add(up);
        const RY = [[1.7, -0.6], [1.7, 0.6], [2.6, 1.5], [2.6, 1.75], [3.35, 1.75], [3.35, -1.75], [2.6, -1.75], [2.6, -1.5]];
        for (const s of [1, -1]) {
          const pts = RY.map(([x, z]) => [s * x, z]); if (s < 0) pts.reverse();
          yk.add(prism(pts, -1.3, 1.3, blue));
        }
        yk.add(prism([[-3.35, -1.75], [3.35, -1.75], [3.35, 1.75], [-3.35, 1.75]], YB + 0.3, -1.3, blue));
        yk.add(prism([[-2.6, -1.6], [2.6, -1.6], [2.6, 1.6], [-2.6, 1.6]], YB, YB + 0.3, blue));
        up.add(prism([[-3.35, -1.75], [3.35, -1.75], [3.35, 1.75], [-3.35, 1.75]], 1.3, 2.02, blueU));
        up.add(prism([[-2.6, -1.6], [2.6, -1.6], [2.6, 1.6], [-2.6, 1.6]], 2.02, 2.32, blueU));
        for (const z of [1.5, -1.75]) for (const [y0, y1] of [[-1.3, -0.5], [0.5, 1.3]]) yk.add(prism([[-2.6, z], [2.6, z], [2.6, z + 0.25], [-2.6, z + 0.25]], y0, y1, blue));
        // Round poles, 2 m across, and the superconducting coils around them.
        yk.add(prism(ann(0, 0, 0, 1, 0, 2 * PI, 64), -1.3, -0.44, gold)); yk.add(prism(ann(0, 0, 1.05, 1.42, 0, 2 * PI, 64), -1.2, -0.58, coil));
        up.add(prism(ann(0, 0, 0, 1, 0, 2 * PI, 64), 0.44, 1.3, goldU)); up.add(prism(ann(0, 0, 1.05, 1.42, 0, 2 * PI, 64), 0.58, 1.2, coilU));
        // Vacuum chamber in the gap, from the entrance on the back face to the exit window on the front face.
        const chamber = [[-1.35, -1.75], [-0.65, -1.75], [0.9, -0.95], [1.55, 0], [1.6, 1.75], [-2.5, 1.75], [-2.5, 1.5], [-1.62, 0.3], [-1.62, -0.6]];
        const chamberGlass = prism(chamber, -0.4, 0.4, glass), chamberGold = gold.clone(), exitWin = window.clone(), exitRf = K.rf.clone(); yk.add(chamberGlass);
        yk.add(prism(chamber, -0.44, -0.4, chamberGold));
        for (const y of [-0.4, 0.4]) {
          const rim = chamber.map(([x, z]) => V3(x, y, z)); rim.push(rim[0].clone());
          yk.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, false, "catmullrom", 0), 160, 0.03, 6, false), chamberGold));
        }
        yk.add(A.box(4.1, 0.8, 0.03, exitWin, -0.45, 0, 1.78));                                  // exit window
        for (const y of [-0.45, 0.45]) yk.add(A.box(4.2, 0.1, 0.08, exitRf, -0.45, y, 1.8));
        for (const x of [-2.52, 1.62]) yk.add(A.box(0.1, 0.9, 0.08, exitRf, x, 0, 1.8));
        // Secondary target and FDC1 upstream of the magnet [15].
        const target = V3(-4.45, 0, 0);
        mag.add(A.rbox(0.16, 1.1, 0.95, 0.025, new THREE.MeshStandardMaterial({ color: "#8f25ba", roughness: 0.4 }), target.x, 0, 0));
        mag.add(A.box(0.02, 0.64, 0.54, K.rf, target.x - 0.1, 0, 0));
        { const f = new THREE.Group(); f.add(A.rbox(0.3, 0.75, 1.0, 0.03, K.rf)); f.add(A.box(0.32, 0.45, 0.7, window)); f.position.set(-3.25, 0, 0); mag.add(f); }
        // Tracks: hard-edge field of radius RF about the centre. Heavy fragments bend about 60 degrees, protons
        // (lower rigidity) more; neutrons go straight on to NEBULA. Angles are illustrative.
        const RF = 1.2;
        function track(deg) {
          const th = deg * D2R, rho = RF / Math.tan(th / 2), c = V3(-RF, 0, rho), u = V3(Math.cos(th), 0, Math.sin(th)), pts = [target.clone()];
          for (let i = 0; i <= 24; i++) { const a = th * i / 24; pts.push(V3(c.x + rho * Math.sin(a), 0, c.z - rho * Math.cos(a))); }
          const X = pts[pts.length - 1], [xw, zw] = toYoke(X), [, du] = toYoke(u), sW = (1.75 - zw) / du;
          return { pts, X, u, sW, at: (s) => X.clone().addScaledVector(u, sW + s) };
        }
        const heavy = track(60), prot = track(78);
        // Downstream of the exit window: FDC2 for all charged particles, then HODF (fragments) and HODP (protons) side by side.
        function place(g, p, u) { g.position.copy(p); g.rotation.y = -Math.atan2(u.z, u.x); mag.add(g); return g; }
        const uMid = heavy.u.clone().add(prot.u).normalize(), pFDC2 = heavy.at(1.3).add(prot.at(1.3)).multiplyScalar(0.5);
        { const f = new THREE.Group(), w = 2.9, h = 1.4;
          for (const y of [-h / 2, h / 2]) f.add(A.box(0.6, 0.12, w, K.rf, 0, y, 0));
          for (const z of [-w / 2, w / 2]) f.add(A.box(0.6, h, 0.12, K.rf, 0, 0, z));
          f.add(A.box(0.02, h - 0.1, w - 0.1, window, 0.3, 0, 0)); f.add(A.box(0.02, h - 0.1, w - 0.1, window, -0.3, 0, 0));
          for (const s of [-1, 1]) f.add(A.box(0.5, -h / 2 + 2.55, 0.1, K.iron, 0, (-2.55 - h / 2) / 2, s * (w / 2 - 0.2)));
          place(f, pFDC2, uMid); }
        const side = V3(-uMid.z, 0, uMid.x);                          // towards larger bending angle
        function hodo(nb, p, u) {
          const g = new THREE.Group(), w = nb * 0.1;
          for (let i = 0; i < nb; i++) { const z = -w / 2 + 0.05 + i * 0.1; g.add(A.box(0.02, 1.2, 0.095, barPaint, 0, 0, z));
            for (const s of [-1, 1]) { const pm = A.cyl(0.03, 0.2, K.bar, 10); pm.position.set(0, s * 0.72, z); g.add(pm); } }
          for (const y of [-0.85, 0.85]) g.add(A.box(0.1, 0.05, w + 0.15, framePaint, 0, y, 0));
          for (const s of [-1, 1]) g.add(A.box(0.08, 2.55 - 0.85, 0.08, K.iron, 0, (-2.55 - 0.85) / 2, s * (w / 2 + 0.05)));   // to the pit floor
          return place(g, p, u);
        }
        hodo(24, heavy.at(2.5).addScaledVector(side, -0.45), uMid);    // HODF: 24 bars of 10 cm [15]
        hodo(16, prot.at(2.9).addScaledVector(side, 0.35), uMid);      // HODP: 16 bars
        // NEBULA: two walls of two layers, 30 bars of 12 x 12 x 180 cm per layer, at zero degrees behind the magnet [15].
        for (const k of [0, 1]) {
          const wall = new THREE.Group();
          for (const l of [0, 1]) for (let i = 0; i < 30; i++) {
            const z = -1.74 + i * 0.12, x = l * 0.14;
            wall.add(A.box(0.12, 1.8, 0.113, barPaint, x, 0, z));
            for (const sign of [-1, 1]) {
              const pmt = A.cyl(0.044, 0.25, K.bar, 12); pmt.position.set(x, sign * 1.03, z); wall.add(pmt);
              const collar = A.cyl(0.055, 0.045, K.rf, 12); collar.position.set(x, sign * 0.94, z); wall.add(collar);
            }
          }
          for (const y of [-1.2, 1.2]) wall.add(A.box(0.23, 0.065, 3.8, framePaint, 0.07, y, 0));
          for (const z of [-1.88, 1.88]) wall.add(A.box(0.24, 2.5, 0.06, framePaint, 0.07, 0, z));
          for (const z of [-1.88, 1.88]) { wall.add(A.box(0.12, 1.3, 0.12, framePaint, 0.07, -1.9, z)); wall.add(A.box(0.9, 0.06, 0.3, framePaint, 0.07, -2.52, z)); }
          wall.position.set(7.5 + k * 0.9, 0, 0); mag.add(wall);
        }
        // Nucleon clusters for the incoming RI beam and the heavy fragment, as in the overview.
        const proton = new THREE.MeshStandardMaterial({ color: "#f35250", roughness: 0.36, metalness: 0.08 });
        const neutron = new THREE.MeshStandardMaterial({ color: "#71cdea", roughness: 0.36, metalness: 0.08 });
        const heavyEnd = heavy.at(3.6), protEnd = prot.at(3.9);
        for (const center of [V3(-5.0, 0, 0), heavyEnd]) for (let i = 0; i < 12; i++) {
          const a = i * 2.39996, y = 1 - 2 * (i + 0.5) / 12, r = Math.sqrt(1 - y * y);
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), i % 2 ? proton : neutron);
          ball.position.copy(center).add(V3(0.27 * r * Math.cos(a), 0.27 * y, 0.27 * r * Math.sin(a))); mag.add(ball);
        }
        const protonBall = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), proton); protonBall.position.copy(protEnd); mag.add(protonBall);
        const routeMats = [new THREE.MeshBasicMaterial({ color: "#76dcff" }), new THREE.MeshBasicMaterial({ color: "#86e89a" }), new THREE.MeshBasicMaterial({ color: "#ff6655" })];
        const routes = [[target.clone(), V3(7.45, 0, 0)], [...heavy.pts, heavy.at(3.3)], [...prot.pts, prot.at(3.6)]];
        // dense copies of the routes: a track ends where it meets a return yoke (the beam holes along the yoke's long
        // axis, 0.4 m high [15], stay open), which is what the rotation of the magnet changes
        const dense = routes.map((pts) => { const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const k = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i - 1]) / 0.05)); for (let j = 1; j <= k; j++) out.push(pts[i - 1].clone().lerp(pts[i], j / k)); } return out; });
        const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
        const yokePolys = [RY, RY.map(([x, z]) => [-x, z])];
        const blocked = (p, rot) => { const x = p.x * Math.sin(rot) - p.z * Math.cos(rot), z = p.x * Math.cos(rot) + p.z * Math.sin(rot);
          return Math.abs(z) > 0.2 && yokePolys.some((poly) => inPoly(x, z, poly)); };
        const tubeWorld = (pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().applyAxisAngle(V3(0, 1, 0), -theta).add(samC)), false, "catmullrom", 0), 96, 0.026, 8, false);
        routes.forEach((pts, i) => {
          const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0);
          mag.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.026, 8, false), routeMats[i]));
          samRoutes.push({ pts: curve.getPoints(64).map((p) => p.applyAxisAngle(V3(0, 1, 0), -theta).add(samC)), color: routeMats[i].color.toArray() });
        });
        // Local labels are part of the apparatus view and remain readable while orbiting.
        const L3 = (p, dy) => [p.x, p.y + (dy || 0), p.z], Y3 = (x, y, z) => L3(ex.clone().multiplyScalar(x).addScaledVector(n, z), y);
        const chamberLabels = [];
        for (const [text, color, pos, anchor] of [
          ["RI beam", "#a9d5ff", [-5.6, -1.2, 0.8], [-5.0, -0.3, 0]],
          ["target + FDC1", "#d6a4ff", [-4.0, 1.8, 0], [-3.9, 0.5, 0]],
          ["2 m pole", "#f3c547", [0, 5.7, -3.2], [0, 3.0, -1.0]],
          ["superconducting coil", "#ff765d", [2.6, 4.9, -3.6], [1.0, 3.6, -0.9]],
          ["vacuum chamber", "#f3c547", Y3(4.6, 2.4, 0.3), Y3(-0.1, 0, -0.7)],
          ["exit window", "#a9e8e7", L3(V3(...Y3(1.6, 0, 1.78)).add(V3(2.6, 1.3, -0.6))), Y3(1.5, 0.35, 1.8)],
          ["FDC2", "#d7e0e8", L3(pFDC2.clone().addScaledVector(side, 2.6), 0.9), L3(pFDC2.clone().addScaledVector(side, 1.45), 0.5)],
          ["HODF / HODP", "#88c9da", L3(heavy.at(2.5).addScaledVector(side, -2.9), 1.2), L3(heavy.at(2.5).addScaledVector(side, -1.3), 0.6)],
          ["NEBULA", "#76dcff", [8.0, 2.4, 0], [8.0, 1.25, 0]],
          ["heavy fragments", "#86e89a", L3(heavyEnd, -1.0), L3(heavyEnd)],
          ["protons", "#ff6655", L3(protEnd, -1.0), L3(protEnd)],
          ["rotating base", "#d7b98a", [-3.6, -2.1, 4.6], [-3.0, -2.32, 3.8]]]) {
          const tex = A.canvasTex(512, 96, (ctx, w, h) => { ctx.font = '500 32px "Avenir Next",sans-serif'; const tw = ctx.measureText(text).width + 28;
            ctx.fillStyle = "#0b0f16b8"; ctx.beginPath(); ctx.roundRect((w - tw) / 2, 22, tw, h - 44, 12); ctx.fill(); ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, w / 2, h / 2); });
          tex.colorSpace = THREE.SRGBColorSpace;
          const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
          label.position.set(...pos); label.scale.set(3.5, 0.66, 1); label.visible = false; mag.add(label);
          gSAM.userData.detailLabels.push(label);
          const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(...pos), V3(...anchor)]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));
          leader.visible = false; mag.add(leader); gSAM.userData.detailLabels.push(leader);
          if (text === "vacuum chamber" || text === "exit window") chamberLabels.push(label, leader);
        }
        gSAM.add(A.shadowy(mag)); chamberGlass.castShadow = false;
        // Pose of the magnet, called by the page after the static merge (the merged meshes are in world coordinates):
        // the yoke and its base turn about the magnet centre from -5 to 95 degrees [7]; the upper assembly is lifted
        // in the apparatus view. The vacuum chamber is specific to each configuration, so it is drawn only at 30 degrees.
        const turning = new Set([blue, blueU, gold, goldU, coil, coilU, glass, chamberGold, exitWin, exitRf, basePaint, railMat, stripe]);
        const lifted = new Set([blueU, goldU, coilU]), chamberMats = new Set([glass, chamberGold, exitWin, exitRf]);
        gSAM.userData.rotate = { min: -5, max: 95, std: 30 };
        gSAM.userData.pose = ({ exploded, angle }) => {
          const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), -(angle - 30) * D2R), std = Math.abs(angle - 30) < 0.5;
          gSAM.traverse((m) => {
            if (!m.isMesh) return;
            if (turning.has(m.material)) {
              m.quaternion.copy(q); m.position.copy(samC).sub(samC.clone().applyQuaternion(q));
              if (lifted.has(m.material) && exploded) m.position.y += 2.5;
              if (chamberMats.has(m.material)) m.visible = std;
            }
            const i = routeMats.indexOf(m.material);
            if (i >= 0) { const d = dense[i], k = d.findIndex((p) => blocked(p, angle * D2R)); m.geometry.dispose(); m.geometry = tubeWorld(k < 0 ? d : d.slice(0, Math.max(2, k + 1))); }
          });
          for (const o of chamberLabels) o.material.opacity = std ? (o.isSprite ? 1 : 0.55) : 0;
        };
        refit(gSAM,[TS.at(24.7-11.3),samC.clone().addScaledVector(TS.d,11)],3);
        // A matching three-quarter view: incoming beam left, charged fragments in front, neutron wall right.
        const offset=V3(13,10,17).applyAxisAngle(V3(0,1,0),-theta);
        gSAM.userData.focusView={target:samC.clone().add(V3(1.35,0.8,0.7).applyAxisAngle(V3(0,1,0),-theta)),pos:samC.clone().add(offset),isolate:true};
        gSAM.userData.magnetCenter=samC.clone();
      }

      // ---- SHARAQ: high-resolution beam line from BigRIPS F6 [8], spectrometer SDQ-D1-Q3-D2 with D1 30 deg
      // and D2 60 deg, both 4.8 m radius, 6.8 Tm [8]; the line continues to the Rare RI Ring [9]
      const gSH = A.section("SHARAQ + high-resolution line", "end", [V3(-46, 0, -72), V3(-30, 0, -34)], 1);
      const TH = T6;                                                     // at D6 entrance, heading NW (D6 off)
      TH.fwd(5.5);
      arcDipole(TH.arc(30, RHO), DW, DH, M.dipole, gSH);
      stq(TH.at(2.6), TH.d, gSH); TH.fwd(5.0);
      arcDipole(TH.arc(30, RHO), DW, DH, M.dipole, gSH);
      for (const s of [3.5, 9.5, 15.5]) stq(TH.at(s), TH.d, gSH);
      TH.fwd(19.5); fchamber(TH.p, TH.d, gSH, true);                     // S0 target
      const sdq = TH.at(2.2); { const o = new THREE.Group(); const c = A.cyl(0.85, 1.9, M.copper, 28); c.rotation.x = PI / 2; o.add(c);
        const sh = A.cyl(0.9, 1.6, K.green, 28); sh.rotation.x = PI / 2; o.add(sh); o.add(A.box(1.2, 0.8, 1.2, M.steelDark, 0, FLOOR + 0.4, 0)); gSH.add(A.shadowy(at(o, sdq, TH.d))); }
      TH.fwd(3.6);
      arcDipole(TH.arc(-30, 4.8), 3.0, 2.4, K.green, gSH);                // D1
      TH.fwd(0.9); quadAt(TH.at(0.4), TH.d, gSH, 0.7); TH.fwd(1.3);
      arcDipole(TH.arc(-60, 4.8), 2.8, 2.2, K.green, gSH);                // D2
      TH.fwd(2.4); fchamber(TH.p, TH.d, gSH, true);                       // final focal plane
      const sharaqPts = TH.pts.slice();
      A.pipe(sharaqPts, gSH, 0.09);
      people(gSH, [[TH.p.x + 1.5, TH.p.z + 2.2, 1.0]]);

      // ---- Rare RI Ring: 60.35 m circumference, six sectors of four dipoles, 4.02 m straights, no
      // quadrupoles; injection line of five quadrupole doublets and one dipole after SHARAQ [9]
      const gR3 = A.section("Rare RI Ring (R3)", "end", [V3(-76, 0, -74), V3(-48, 0, -48)], 1);
      const TI = TH.copy();
      for (let i = 0; i < 5; i++) { const p0 = TI.at(1.6 + i * 2.6); quadAt(p0, TI.d, gR3, 0.4); quadAt(p0.clone().addScaledVector(TI.d, 0.7), TI.d, gR3, 0.4); }
      straightDipole(TI.at(14.6), TI.d, gR3, 1.4);
      TI.fwd(16.5);
      const injPts = TI.pts.slice();
      A.pipe(injPts, gR3, 0.08);
      const LS = 4.02, RS = (60.35 / 6 - LS) / (PI / 3);                 // sector arc radius from the circumference
      const R3c = V3(TI.p.x - LS / 2, 0, TI.p.z + LS * Math.cos(PI / 6) + RS);
      const TR = new Tur(TI.p.x, TI.p.z, 180);
      for (let k = 0; k < 6; k++) {
        const sp = TR.p.clone(); TR.fwd(LS);
        if (k % 2 === 0) { const sd = TR.p.clone().sub(sp).normalize(); fchamber(sp.clone().addScaledVector(sd, LS / 2), sd, gR3); }   // kicker / septum / detector chambers
        const info = TR.arc(-60, RS);
        for (let j = 0; j < 4; j++) {                                      // four dipoles per sector
          const b0 = info.b0 + info.s * (j * 15 + 1) * D2R, b1 = info.b0 + info.s * (j * 15 + 14) * D2R;
          arcDipole({ c: info.c, R: RS, b0, b1, s: info.s }, 1.5, 1.2, M.dipole, gR3);
        }
      }
      const ringPts = TR.pts.slice();
      A.pipe(ringPts, gR3, 0.07);

      // ---- experimental halls (walls, floors)
      {
        const x0 = Math.min(F.F11.x - 9, samC.x - 18), gH = gZD;
        floorWithPits(x0, -38, -44, 0, gH);
        for (const [a, b] of [[V3(x0, 0, -38), V3(-44, 0, -38)], [V3(x0, 0, -38), V3(x0, 0, 0)], [V3(x0, 0, 0), V3(-44, 0, 0)], [V3(-44, 0, 0), V3(-44, 0, -14)]]) A.wall(a, b, 5.5, 1.0, gH);
        // SAMURAI room: shielding blocks across the beam line, pit with the rotating base
        rectWalls(samPit[0], samPit[1], samPit[2], samPit[3], -2.55, 1.15, 0.5, gSamLine);
        const bx = samC.clone().addScaledVector(TS.d, -9.5);
        for (let i = -2; i <= 2; i++) if (i !== 0) { const p = bx.clone().addScaledVector(V3(-TS.d.z, 0, TS.d.x), i * 1.5); gSamLine.add(at(A.box(1.45, 3.5, 1.4, K.wall, 0, 0, 0), p.setY(FLOOR + 1.75), TS.d)); }
        // SHARAQ / Rare RI Ring hall
        const xs = [...sharaqPts, ...ringPts, ...injPts].map((p) => p.x), zs = [...sharaqPts, ...ringPts].map((p) => p.z);
        const hx0 = Math.min(...xs) - 5, hx1 = Math.max(...xs) + 5, hz0 = Math.min(...zs) - 5;
        A.slab(hx0, hz0, hx1, -34, FLOOR, M.floor, gSH, 6);
        for (const [a, b] of [[V3(hx0, 0, hz0), V3(hx1, 0, hz0)], [V3(hx1, 0, hz0), V3(hx1, 0, -34)], [V3(hx0, 0, hz0), V3(hx0, 0, -34)], [V3(hx0, 0, -34), V3(-44, 0, -34)]]) A.wall(a, b, 5.5, 1.0, gSH);
        A.wall(V3((hx0 + hx1) / 2 - 3, 0, hz0), V3((hx0 + hx1) / 2 - 3, 0, -48), 4.0, 0.8, gR3);   // partition between SHARAQ and the ring
      }

      // ======================================================================================
      // NISHINA BUILDING and LINAC BUILDING (placement schematic, topology from the chain diagram [1])
      // ======================================================================================
      const RRC = V3(66, 0, 36), FRC = V3(114, 0, 34), AVF = V3(58, 0, 58);
      const gRRC = A.section("RRC (K540)", "cyc", [V3(57, 0, 27), V3(75, 0, 45)], 1);
      const gFRC = A.section("fRC (K700)", "cyc", [V3(106, 0, 26), V3(122, 0, 42)], 1);
      const gAVF = A.section("AVF cyclotron (K70)", "cyc", [V3(54, 0, 54), V3(62, 0, 62)], 1);
      const gR2 = A.section("RILAC2 (28-GHz SC-ECRIS + linac)", "lin", [V3(70, 0, 57), V3(74, 0, 71)], 2);
      const gST1 = A.section("ST1: helium gas stripper", "strip", [V3(78, 0, 31), V3(83, 0, 34)], 1.5);
      const gST2 = A.section("ST2: rotating graphite-sheet stripper", "strip", [V3(116, 0, 26), V3(119, 0, 29)], 1.5);
      const gTr = A.section("transfer line fRC to IRC", "foc", [V3(44, 0, 18), V3(118, 0, 24)], 1);
      const gLE = A.section("low-energy facility: RIPS, GARIS-II (E6), KISS", "fac", [V3(92, 0, 46), V3(130, 0, 70)], 1);
      const gCR = A.section("CRIB (CNS)", "fac", [V3(42, 0, 54), V3(53, 0, 62)], 1);
      pit(56, 26, 77, 46, -2.5, gRRC, 5.5);
      pit(103.5, 24, 125, 44.5, -2.5, gFRC, 5.5);

      // RRC: four sectors, K540, Rinj 0.89 m, Rext 3.56 m, 12.6 m, 2300 t, two RF resonators [1, 2]
      ringCyc({ id: "rrc", c: RRC, n: specs.rrc.sectors, rIn: 0.75, rOut: 6.1, w: 50, hT: 2.2, m: K.rrc, rot: 45, valleys: ["", "rf", "", "rf"] }, gRRC);
      // fRC: four sectors, K570 as built, K700 after the 2012 bending-power upgrade; Rinj 1.56 m,
      // Rext 3.30 m, 10.8 m, two RF resonators plus a flat-top cavity, fixed 54.75 MHz [1, 2, 3]
      ringCyc({ id: "frc", c: FRC, n: specs.frc.sectors, rIn: 1.2, rOut: 5.2, w: 50, hT: 2.15, m: K.frc, rot: 0, valleys: ["rf", "ft", "rf", ""] }, gFRC);
      people(gRRC, [[73.5, 43, -0.5]]); people(gFRC, [[106, 42.5, 0.7]]);
      // AVF: compact cyclotron, K70, four spiral sectors, two 85-degree dees, 4 m wide, 2.8 m tall, 110 t [2]
      {
        const g = gAVF; g.userData.cyc = "riken-avf";
        for (const [y0, y1] of [[0.12, 1.4], [FLOOR, -0.12]]) { const c = A.cyl(2.0, y1 - y0, K.avf, 40); c.position.set(AVF.x, (y0 + y1) / 2, AVF.z); g.add(c); }
        const co = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.14, 8, 40), M.copper); co.rotation.x = PI / 2;
        for (const y of [0.22, -0.22]) { const k = co.clone(); k.position.set(AVF.x, y, AVF.z); g.add(k); }
        for (const a of [20, 200]) { const v = dirv(a), d = A.box(1.4, 1.0, 0.9, K.rf, 0, 0, 0); d.position.set(AVF.x + v.x * 2.6, 0.3, AVF.z + v.z * 2.6); d.rotation.y = -a * D2R; g.add(d); }
        const inj = A.cyl(0.2, 2.6, M.steel, 12); inj.position.set(AVF.x, 2.7, AVF.z); g.add(inj);   // vertical injection line from the ion sources
        g.add(A.box(1.2, 1.0, 1.2, M.steelDark, AVF.x + 1.1, 4.0 + 0, AVF.z - 0.9));
        people(g, [[AVF.x - 2.6, AVF.z + 3.0, 0.3]]);
      }

      // ---- injectors to the RRC: RILAC2 (in the AVF vault, linac < 8 m, 36 m transport) [1], AVF, RILAC
      const J = V3(66, 0, 45.5), N = V3(0, 0, -1);
      const rrcIn = cpt(RRC, specs.rrc.rIn, PI / 2), rrcOut = cpt(RRC, specs.rrc.rExt, -PI / 2);
      const r2src = V3(72, 0, 70), r2end = V3(72, 0, 58.5);
      {
        // 28-GHz superconducting ECR ion source and the RFQ + DTL linac (generic shapes)
        const s = A.cyl(0.75, 1.6, M.steel, 24); s.rotation.x = PI / 2; s.position.set(72, 0, 70.6); gR2.add(s);
        gR2.add(A.box(1.8, 1.4, 1.8, M.steelDark, 72, FLOOR + 0.7, 70.6));
        for (const [z, r, L] of [[67.7, 0.42, 2.2], [64.5, 0.5, 2.6], [61.3, 0.5, 2.6], [59.3, 0.42, 1.0]]) {
          const c = A.cyl(r, L, M.vessel, 20); c.rotation.x = PI / 2; c.position.set(72, 0, z); gR2.add(c);
          gR2.add(A.box(0.5, 0.95, Math.min(1.0, L * 0.6), M.steelDark, 72, FLOOR + 0.47, z));
        }
        A.pipe([r2src, r2end], gR2, 0.07);
      }
      const r2Line = [r2end, ...bz(r2end, N, J, N, 4, 4, 20).slice(1)];
      dress(r2Line, gR2, { q: 4.5 });
      const avfLine = bz(cpt(AVF, 2.2, -PI / 2), N, J, N, 3, 4, 20);
      dress(avfLine, gAVF, { q: 4.5 });
      A.pipe([J, rrcIn], gRRC, 0.07);
      // RRC exit: ST1 helium gas stripper at 11 MeV/u, five-stage differential pumping [1]
      const st1 = V3(80.5, 0, rrcOut.z);
      {
        const g = gST1;
        g.add(A.rbox(0.9, 0.9, 0.9, 0.05, M.steel, st1.x, 0, st1.z));                  // target cell
        for (const k of [-2, -1, 1, 2]) { g.add(A.rbox(0.55, 0.7, 0.45, 0.04, M.steel, st1.x + k * 0.62, 0, st1.z));
          const p = A.cyl(0.2, 0.55, M.steelDark, 14); p.position.set(st1.x + k * 0.62, -0.62, st1.z); g.add(p);
          const b = A.cyl(0.24, 0.5, M.vessel, 14); b.position.set(st1.x + k * 0.62, 0.6, st1.z); g.add(b); }
        g.add(A.box(3.3, FLOOR + 0.9 - FLOOR, 1.2, M.steelDark, st1.x, FLOOR + 0.45, st1.z));
        g.add(A.box(0.9, 1.6, 0.6, M.rack, st1.x, FLOOR + 0.8, st1.z - 1.6));
      }
      // RRC -> fRC, with a branch south to the low-energy facility and a fRC bypass north (variable-energy mode)
      const frcIn = cpt(FRC, specs.frc.rIn, PI / 2), frcOut = cpt(FRC, specs.frc.rExt, 0);
      const toFrc = [rrcOut, V3(103, 0, rrcOut.z), ...bz(V3(105, 0, rrcOut.z), dirv(0), frcIn, dirv(0), 3, 3, 14)];
      dress([rrcOut, V3(104, 0, rrcOut.z)], gRRC, { avoid: [st1] });
      A.pipe(toFrc.slice(1), gFRC, 0.07);
      const bypass = [V3(86, 0, rrcOut.z), ...bz(V3(86, 0, rrcOut.z), dirv(0), V3(92, 0, 21), N, 3, 4, 16).slice(1)];
      dress(bypass, gTr, { q: 9 });
      // ST2 at the fRC exit, 50 MeV/u: rotating graphite-sheet disk in a chamber [1]
      const st2 = V3(frcOut.x, 0, 28.0);
      {
        const g = gST2;
        g.add(A.rbox(1.3, 1.3, 1.0, 0.06, M.steel, st2.x, 0.1, st2.z));
        const disk = A.cyl(0.5, 0.03, M.black, 32); disk.rotation.x = PI / 2; disk.position.set(st2.x, 0.35, st2.z - 0.53); g.add(disk);
        const mot = A.cyl(0.16, 0.5, M.steelDark, 12); mot.rotation.x = PI / 2; mot.position.set(st2.x, 0.35, st2.z + 0.75); g.add(mot);
        standTo(g, st2, -0.55, 0.9);
      }
      // transfer line: fRC exit north, west along the building, into the IRC vault
      const ircIn = cpt(IRC, specs.irc.rIn, 135 * D2R), ircOut = cpt(IRC, specs.irc.rExt, PI / 2);
      const trA = [frcOut, ...bz(V3(frcOut.x, 0, 26), N, V3(108, 0, 21), dirv(180), 3, 3, 12)];
      const trB = [V3(108, 0, 21), V3(48, 0, 21), ...bz(V3(46, 0, 21), dirv(180), ircIn, dirv(-135), 5, 9, 26).slice(1)];
      const transfer = [...trA, ...trB];
      dress(trA, gTr, {}); dress(trB, gTr, { q: 8 });

      // ---- low-energy facility behind the RRC: RIPS, GARIS-II (moved to E6 in 2018), KISS [1, 10, 12]
      {
        const g = gLE;
        const br = [V3(93, 0, rrcOut.z), ...bz(V3(93, 0, rrcOut.z), dirv(0), V3(97, 0, 46), dirv(90), 3, 3, 14).slice(1), V3(97, 0, 48.5)];
        dress(br, g, { q: 6 });
        const man = [V3(97, 0, 48.5), ...bz(V3(97, 0, 48.5), dirv(90), V3(102, 0, 50.5), dirv(0), 1.5, 1.5, 8).slice(1), V3(126, 0, 50.5)];
        dress(man, g, { q: 6 });
        // RIPS: drawn as a generic two-dipole fragment separator
        const tr = new Tur(101, 50.5, 90); tr.fwd(2.2); fchamber(tr.at(0), tr.d, g); quadAt(tr.at(1.2), tr.d, g); tr.fwd(2.0);
        arcDipole(tr.arc(-45, 2.6), 1.8, 1.4, M.dipole, g); quadAt(tr.at(1.0), tr.d, g); quadAt(tr.at(2.0), tr.d, g); tr.fwd(3);
        arcDipole(tr.arc(45, 2.6), 1.8, 1.4, M.dipole, g); quadAt(tr.at(1.2), tr.d, g); tr.fwd(4.0); fchamber(tr.p, tr.d, g);
        A.pipe(tr.pts, g, 0.07);
        // GARIS-II: gas-filled recoil separator, generic (dipole plus quadrupoles)
        const tg = new Tur(113, 50.5, 90); tg.fwd(2.0); fchamber(tg.p, tg.d, g); tg.fwd(1.2);
        arcDipole(tg.arc(-35, 2.4), 1.9, 1.5, K.garis, g); quadAt(tg.at(0.9), tg.d, g); quadAt(tg.at(1.9), tg.d, g); tg.fwd(3.2); fchamber(tg.p, tg.d, g, true);
        A.pipe(tg.pts, g, 0.08);
        // KISS: argon gas cell with laser resonance ionization, then a mass-separating dipole [12]
        const tk = new Tur(124, 50.5, 90); tk.fwd(2.4);
        g.add(A.rbox(1.4, 1.4, 1.6, 0.08, M.steel, tk.p.x, 0.1, tk.p.z + 0.4));
        g.add(A.box(1.0, 0.8, 1.0, M.steelDark, tk.p.x, FLOOR + 0.4, tk.p.z + 0.4));
        g.add(A.box(2.6, 1.0, 0.9, M.black, tk.p.x - 2.6, FLOOR + 0.5, tk.p.z + 0.2));                  // laser table (generic)
        tk.fwd(2.0); arcDipole(tk.arc(-60, 1.8), 1.4, 1.1, M.dipole, g); tk.fwd(3.0); fchamber(tk.p, tk.d, g);
        A.pipe(tk.pts, g, 0.06);
        people(g, [[106.5, 64, 2.4], [120.5, 56, -0.3]]);
      }
      // ---- CRIB (CNS): low-energy in-flight RI separator after the AVF, generic two-dipole shape [1]
      {
        const g = gCR, tc = new Tur(AVF.x - 2.3, AVF.z, 180);
        tc.fwd(1.8); fchamber(tc.p, tc.d, g); tc.fwd(0.6);
        arcDipole(tc.arc(-45, 1.8), 1.4, 1.2, M.dipole, g); quadAt(tc.at(0.8), tc.d, g); tc.fwd(1.8);
        arcDipole(tc.arc(-45, 1.8), 1.4, 1.2, M.dipole, g); tc.fwd(1.5); fchamber(tc.p, tc.d, g);
        A.pipe(tc.pts, g, 0.06);
      }

      // ---- LINAC building: RILAC (variable-frequency Wideroe, six tanks, 40 m with its injector),
      // SRILAC (three cryomodules, ten SC QWRs, 6.5 MeV/u) and GARIS-III at its end [2, 10]
      const gRL = A.section("RILAC + SRILAC", "lin", [V3(66, 0, 82), V3(126, 0, 86)], 2);
      const gG3 = A.section("GARIS-III (element 119 search)", "fac", [V3(46, 0, 80), V3(63, 0, 90)], 1);
      const ZL = 84;
      {
        const g = gRL;
        g.add(A.box(3.2, 3.6, 3.2, M.steelDark, 124, FLOOR + 1.8, ZL));                 // Cockcroft-Walton terminal (500 kV)
        for (let i = 0; i < 5; i++) { const r = A.cyl(1.3 - i * 0.08, 0.35, M.steel, 24); r.position.set(124, FLOOR + 4.0 + i * 0.45, ZL); g.add(r); }
        const ecr = A.cyl(0.65, 1.4, M.steel, 20); ecr.rotation.z = PI / 2; ecr.position.set(121, 0.2, ZL - 2.2); g.add(ecr);   // the new 28-GHz SC-ECRIS (generic)
        A.pipe([V3(121.7, 0, ZL - 2.2), V3(119, 0, ZL - 2.2), V3(117.5, 0, ZL)], g, 0.07);
        const rfq = A.cyl(0.45, 3.0, M.vessel, 20); rfq.rotation.z = PI / 2; rfq.position.set(116.5, 0, ZL); g.add(rfq);
        for (let i = 0; i < 6; i++) {                                                     // six Wideroe tanks (sizes schematic)
          const x = 111.5 - i * 4.6, t = A.cyl(1.25, 3.8, M.vesselH, 32); t.rotation.z = PI / 2; t.position.set(x, 0.45, ZL); g.add(t);
          for (const s of [-1, 1]) { const f = A.cyl(1.32, 0.12, M.steelDark, 32); f.rotation.z = PI / 2; f.position.set(x + s * 1.9, 0.45, ZL); g.add(f); }
          const st = A.cyl(0.35, 1.2, M.copper, 14); st.position.set(x, 2.2, ZL); g.add(st);
          g.add(A.box(2.6, 0.35, 1.6, M.steelDark, x, FLOOR + 0.18, ZL));
          quadAt(V3(x - 2.3, 0, ZL), dirv(180), g, 0.35);
        }
        A.pipe([V3(118, 0, ZL), V3(66, 0, ZL)], g, 0.07);
        straightDipole(V3(84, 0, ZL), dirv(180), g, 1.2);                                 // switching magnet towards the RRC
        for (let i = 0; i < 3; i++) g.add(A.orientTo(A.cryomodule(i < 2 ? 3.2 : 2.2, "q"), V3(79 - i * 4.4, 0, ZL), dirv(180)));
        people(g, [[100, ZL + 2.6, 0.2], [77.5, ZL - 2.3, 2.8]]);
      }
      const rilacBr = [V3(84, 0, ZL), ...bz(V3(84, 0, ZL), dirv(180), V3(80.5, 0, 77), N, 2.5, 3, 14).slice(1), V3(80.5, 0, 56), ...bz(V3(80.5, 0, 53), N, J, N, 3, 5, 20)];
      dress(rilacBr, gRL, { q: 8 });
      const tG = new Tur(66, ZL, 180);
      {
        const g = gG3;
        tG.fwd(1.5); fchamber(tG.p, tG.d, g, true); tG.fwd(1.0);              // rotating target chamber
        arcDipole(tG.arc(35, 2.6), 2.0, 1.6, K.garis, g);                     // two dipoles and three quadrupoles [10]; order and angles schematic
        quadAt(tG.at(0.9), tG.d, g, 0.6); quadAt(tG.at(2.0), tG.d, g, 0.6); tG.fwd(2.8);
        arcDipole(tG.arc(-20, 3.0), 1.8, 1.5, K.garis, g);
        quadAt(tG.at(1.0), tG.d, g, 0.6); tG.fwd(2.6); fchamber(tG.p, tG.d, g, true);
        A.pipe(tG.pts, g, 0.08);
        people(g, [[tG.p.x + 1.0, tG.p.z - 2.0, 1.2]]);
      }

      // ---- building shells (Nishina building, LINAC building, connection to the new facility)
      {
        floorWithPits(42, 16, 132, 72, gRRC);
        rectWalls(42, 16, 132, 72, FLOOR, 5.5, 1.0, gRRC);
        // internal walls: AVF vault, low-energy rooms
        for (const [a, b] of [[V3(42, 0, 49), V3(90, 0, 49)], [V3(90, 0, 49), V3(90, 0, 72)], [V3(106, 0, 53), V3(106, 0, 72)], [V3(118, 0, 53), V3(118, 0, 72)], [V3(90, 0, 47), V3(132, 0, 47)]]) A.wall(a, b, 4.5, 0.8, gLE);
        A.slab(40, 74, 130, 94, FLOOR, M.floor, gRL, 6);
        rectWalls(40, 74, 130, 94, FLOOR, 5.0, 1.0, gRL);
        A.wall(V3(64, 0, 74), V3(64, 0, 94), 4.5, 0.8, gG3);
      }

      // ---- beam lines inside the new facility: IRC -> SRC -> BigRIPS F0
      const srcIn = cpt(SRC, specs.src.rIn, 60 * D2R), srcOut = cpt(SRC, specs.src.rExt, -PI / 2);
      const ircToSrc = [ircOut, V3(14, 0, ircOut.z), ...bz(V3(12, 0, ircOut.z), dirv(180), srcIn, dirv(150), 3, 3.5, 16)];
      dress([V3(23, 0, ircOut.z), V3(10, 0, ircOut.z)], gIRC, { q: 5 });
      A.pipe(ircToSrc, gSRC, 0.07);
      const srcToF0 = [srcOut, V3(16, 0, srcOut.z), ...bz(V3(18, 0, srcOut.z), dirv(0), F.F0, dirv(-120), 9, 6, 26)];
      dress([V3(9.5, 0, srcOut.z), ...srcToF0.slice(1)], gIRC, { q: 6 });

      // ======================================================================================
      // beams (display speeds): uranium through the cascade, RI beams after F0, the SHE line
      // ======================================================================================
      const U = [1.0, 0.72, 0.32], RI = [0.66, 0.8, 0.95];
      const spRRC = spiral(RRC, specs.rrc.rIn, specs.rrc.rExt, PI / 2, -PI / 2, 1, 2);
      const spFRC = spiral(FRC, specs.frc.rIn, specs.frc.rExt, PI / 2, 0, -1, 2);
      const spIRC = spiral(IRC, specs.irc.rIn, specs.irc.rExt, 135 * D2R, PI / 2, 1, 2);
      const spSRC = spiral(SRC, specs.src.rIn, specs.src.rExt, 60 * D2R, -PI / 2, 1, 2);
      for (const [g, p] of [[gRRC, spRRC], [gFRC, spFRC], [gIRC, spIRC], [gSRC, spSRC]]) g.userData.orbit = p;
      const cascade = A.join([r2src], r2Line, [rrcIn], spRRC, [rrcOut], toFrc.slice(1), spFRC, transfer, spIRC, ircToSrc, spSRC, srcToF0);
      const riPath = A.join(bigripsPts, zdPts.slice(1));
      const samPath = [T.p.clone(), samRoutes[0].pts[0]];
      const r3Path = A.join(sharaqPts, injPts, ringPts, ringPts.slice(1));
      const shePath = A.join([V3(121, 0, ZL - 2.2), V3(117.5, 0, ZL), V3(66, 0, ZL)], tG.pts);
      const beams = [
        { pts: cascade, n: 72, speed: 0.022, color: U, size: 0.95 },
        { pts: riPath, n: 34, speed: 0.07, color: RI, size: 0.9 },
        { pts: samPath, n: 7, speed: 0.09, color: RI, size: 0.85 },
        ...samRoutes.map((r) => ({ ...r, n: 3, speed: 0.14, size: 0.65 })),
        { pts: r3Path, n: 26, speed: 0.06, color: RI, size: 0.85 },
        { pts: shePath, n: 16, speed: 0.08, color: U, size: 0.9 },
      ];

      A.shadowArea(10, 5, 135);

      const note = `<p><b>RIKEN Nishina Center RI Beam Factory (RIBF), Wako.</b> Uranium from RILAC2 is accelerated by
        four ring cyclotrons in cascade, RRC (K540), fRC (K700), IRC (K980) and SRC (K2600), to 345 MeV/u and fragmented
        or fissioned at the BigRIPS target [1, 3]. Two charge strippers: ST1, a helium gas stripper at the RRC exit
        (11 MeV/u), and ST2, a rotating graphite-sheet stripper behind the fRC (50 MeV/u) [1]. Other modes use RILAC
        (variable energy: RILAC, RRC, IRC, SRC) or the AVF cyclotron (light ions: AVF, RRC, SRC) [1, 3]; the fRC bypass
        is drawn, the IRC bypass of the AVF mode is not.</p>
        <p><b>To scale.</b> Ring cyclotrons: number of sectors, injection and extraction radii, outer diameters (RRC
        12.6 m, fRC 10.8 m, IRC 14.0 m, SRC 18.4 m) and the SRC height (6 m sector magnets, 7.7 m with its iron shield)
        [1, 2, 13]. The SRC's 0.8 m iron self-shield is drawn cut away on the near side and the lid covers only the far
        half, so the sectors stay visible. BigRIPS: F0 to F2 22.8 m, F2 to F3 8.8 m, F3 to F7 46.6 m, six 30 degree
        dipoles, 14 superconducting triplets, first stage inside heavy concrete shielding [4, 5, 6]; ZeroDegree F7 to F8
        11.3 m, F8 to F11 36.5 m, six triplets and two dipoles [4, 5]; SAMURAI F7 to F13 39.6 m [5]; SHARAQ D1 30 degrees and D2 60 degrees at 4.8 m radius [8]; Rare RI Ring
        60.35 m circumference, 24 dipoles in six sectors, 4.02 m straights [9]. The SRC, IRC, BigRIPS and the
        experimental halls are placed from facility plans with a 10 m scale bar [1, 4].</p>
        <p><b>Schematic.</b> The Nishina building (RRC, fRC, AVF, RILAC2, low-energy facility) and the LINAC building
        (RILAC, SRILAC, GARIS-III) are placed schematically south-east of the new facility; their contents follow the
        accelerator chain of [1], not a floor plan. Sector heights of RRC, fRC and IRC are estimated from their weights;
        sector angular widths, dipole bending radii (6 m assumed for BigRIPS), cryostat sizes, the RF resonator shapes and
        all transport-line quadrupoles are generic. Machine colours follow the facility's own chain diagram, not the paint.
        RIPS, GARIS-II, KISS, CRIB and GARIS-III are generic shapes at the right place in the chain (GARIS-III: two
        dipoles and three quadrupoles [10], order and angles not verified). SAMURAI is drawn in its standard configuration
        from the hall plan and yoke drawing of [15]: an H-type yoke 6.7 m x 3.5 m x 4.64 m with return yokes at both
        ends, field clamps on both long faces, round 2 m poles, a 0.88 m gap (0.8 m inside the vacuum chamber),
        turned 30 degrees on a 10 m rotating base, so the beam enters through the back face and neutrons and charged
        fragments leave through one long exit window on the front face. Upstream: target and FDC1; downstream: FDC2,
        then HODF (fragments) and HODP (protons) side by side, and the two double-layer NEBULA walls at zero degrees,
        about 7.5 m behind the magnet centre [15]. The click-through apparatus view lifts the upper yoke as in the
        official cutaway [14]; in the hall the magnet is assembled. There the base can also be turned through its full
        range, -5 to 95 degrees [7] (slider, or a sweep): tracks end where they meet a return yoke, the beam holes along
        the long axis stay open, and the vacuum chamber, specific to each configuration, is drawn only at 30 degrees. Chamber outline, detector sizes and the green
        (about 60 degrees) and red (about 78 degrees) tracks are schematic; blue neutrons continue straight. The SHARAQ
        branch leaves BigRIPS at D6 [8, 1]; its branch dipoles are schematic. The Rare RI Ring is fed through SHARAQ and
        an injection line of five quadrupole doublets and one dipole [9]. The ZD MRTOF with its cryogenic gas cell
        (SLOWRI) sits behind F11 of ZeroDegree [11]. Not drawn: SCRIT (separate electron facility), PALIS at BigRIPS F2,
        the original GARIS, OEDO hardware and the biology beam lines. Beam bunches move at display speeds.</p>
        <p class="refs">[1] RIKEN Nishina Center, RIBF Facility Upgrade Project (July 2023), Sec. 3.1 (Table 3.1.I, Figs.
        3.1.1, 3.1.2), Ch. 4 (Figs. 4.1, 4.6), Ch. 5; nishina.riken.jp/researcher/RIBFupgrade/RIBF_Upgrade_NCAC.pdf.
        [2] RIKEN Nishina Center facility pages: SRC, RRC, fRC, IRC, AVF Cyclotron, RILAC; nishina.riken.jp/facility/.
        [3] N. Sakamoto et al., RF system for heavy ion cyclotrons at RIKEN RIBF, Proc. HIAT09, TU-10 (2009).
        [4] T. Kubo et al., Status and features of BigRIPS separator project, RIBF TAC-05 (2005), Figs. 1-a, 8, 9;
        ribf.riken.jp/RIBF-TAC05/8_BigRIPS.pdf. [5] BigRIPS Team, BigRIPS Technical Information (2024);
        ribf.riken.jp/BigRIPSInfo/. [6] RIKEN, BigRIPS configuration; nishina.riken.jp/ribf/BigRIPS/config.html.
        [7] SAMURAI construction proposal (2012), Secs. 2-1, 2-2; ribf.riken.jp/SAMURAI/120425_SAMURAIConstProp.pdf.
        [8] SHARAQ spectrometer, RIBF TAC-05 (2005); ribf.riken.jp/RIBF-TAC05/11_SHARAQ.pdf.
        [9] T. Yamaguchi et al., The Rare-RI Ring at RIKEN RI Beam Factory, Proc. HIAT2015, TUM1C03.
        [10] H. Sakai et al., Facility upgrade for superheavy-element research at RIKEN, Eur. Phys. J. A 58, 238 (2022).
        [11] M. Rosenbusch et al., The new MRTOF mass spectrograph following the ZeroDegree spectrometer at RIKEN's RIBF
        facility, arXiv:2110.11507, Nucl. Instrum. Methods A 1047, 167824 (2023).
        [12] Y. Hirayama et al., Development of KEK isotope separation system, RIKEN Accel. Prog. Rep. 47 (2014).
        [13] P. Craddock, Cyclotrons and FFAGs: from Nishina's pioneering work to RI-Beam Factory (RIKEN, 2010).
        [14] <a href="https://www.nishina.riken.jp/ribf/SAMURAI/overview.html" target="_blank" rel="noopener">RIKEN, SAMURAI overview</a>, magnet cutaway and beam-line layout.
        [15] RIKEN, SAMURAI <a href="https://www.nishina.riken.jp/ribf/SAMURAI/config.html" target="_blank" rel="noopener">configuration</a> (experimental hall plan, May 2012, magnet at 30 degrees; exit window; downstream detectors) and <a href="https://www.nishina.riken.jp/ribf/SAMURAI/tecinfo.html" target="_blank" rel="noopener">technical information</a> (yoke drawing, gap, field, detectors).</p>`;

      return { view: { target: [18, 0, 8], pos: [-95, 165, 175] }, beams, note, fog: [330, 1100], ground: -4.0 };   // ground below the SRC vault floor (-3.9)
    },
  };
})();
