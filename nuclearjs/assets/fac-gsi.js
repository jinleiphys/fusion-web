/* GSI Helmholtzzentrum (Darmstadt) and FAIR, for accelerator.html (registers FACILITY_MODULES.gsi).
   Coordinates: metres, x to the east, z to the south, beam line at y = 0. SIS18 sits at the origin.
   Operating GSI machines are drawn solid; FAIR (under construction or planned) is drawn as translucent
   "ghost" hardware with orange dashed outlines. Sources are listed in the note returned by build(). */
(function () {
  window.FACILITY_MODULES = window.FACILITY_MODULES || {};
  window.FACILITY_MODULES.gsi = {
    label: "GSI / FAIR",
    build(A) {
      const { THREE, V3, M, FLOOR } = A;
      const TAU = Math.PI * 2;

      // ---------- materials of this module (shared, so the merge keeps draw calls low)
      const G = {
        wall: new THREE.MeshStandardMaterial({ color: "#85878a", map: A.concreteMap, roughness: 0.94, metalness: 0, envMapIntensity: 0.25 }),
        ghost: new THREE.MeshStandardMaterial({ color: "#d9cdb8", roughness: 0.9, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false }),
        ghostMag: new THREE.MeshStandardMaterial({ color: "#e8dcc6", roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.5, depthWrite: false }),
        ghostFloor: new THREE.MeshStandardMaterial({ color: "#2e2a26", roughness: 1, metalness: 0, transparent: true, opacity: 0.45, depthWrite: false }),
        alv: new THREE.MeshStandardMaterial({ color: "#5d7f6a", metalness: 0.4, roughness: 0.45 }),     // green-painted tanks, generic
        cage: new THREE.MeshStandardMaterial({ color: "#9aa3ad", metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false }),
        laser: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.0, 0.5), toneMapped: false }),
        glad: new THREE.MeshStandardMaterial({ color: "#d7dbe0", metalness: 0.6, roughness: 0.35 }),
      };
      const dashMat = new THREE.LineDashedMaterial({ color: "#f0953a", dashSize: 3, gapSize: 2, transparent: true, opacity: 0.95 });

      // ---------- small helpers
      const y0 = (p) => V3(p[0], 0, p[1]);
      const pts2 = (arr) => arr.map(y0);
      // straight wall with a shared material (A.wall clones a material per wall)
      function W(a, b, h, t, g, mat) {
        const L = a.distanceTo(b); if (L < 0.05) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(t, h, L), mat || G.wall);
        const c = a.clone().add(b).multiplyScalar(0.5); c.y = FLOOR + h / 2;
        A.orientTo(m, c, b.clone().sub(a).normalize()); m.castShadow = !(mat && mat.transparent); m.receiveShadow = true; g.add(m);
      }
      function walls(poly, h, t, g, mat, closed) {
        for (let i = 0; i < poly.length - (closed ? 0 : 1); i++) W(poly[i], poly[(i + 1) % poly.length], h, t, g, mat);
      }
      function floorSlab(x0, z0, x1, z1, g, mat) { return A.slab(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), FLOOR, mat || M.floor, g, 8); }
      // dashed orange outline (construction marking), one LineSegments per call
      function dashed(poly, g, y, closed) {
        const v = [];
        for (let i = 0; i < poly.length - (closed ? 0 : 1); i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; v.push(a.x, y, a.z, b.x, y, b.z); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
        const l = new THREE.LineSegments(geo, dashMat); l.computeLineDistances(); g.add(l); return l;
      }
      // offset a polyline sideways (in the xz plane)
      function offset(poly, d, closed) {
        return poly.map((p, i) => {
          const a = poly[closed ? (i - 1 + poly.length) % poly.length : Math.max(0, i - 1)], b = poly[closed ? (i + 1) % poly.length : Math.min(poly.length - 1, i + 1)];
          const t = b.clone().sub(a).setY(0).normalize();
          return V3(p.x - t.z * d, 0, p.z + t.x * d);
        });
      }
      // closed racetrack: centre, unit long-axis direction, straight length, arc radius
      function racetrack(c, dir, Ls, R, n) {
        const d = V3(dir[0], 0, dir[1]).normalize(), nrm = V3(-d.z, 0, d.x), out = [];
        const ends = [c.clone().addScaledVector(d, Ls / 2), c.clone().addScaledVector(d, -Ls / 2)];
        n = n || 24;
        for (let e = 0; e < 2; e++) {
          const s = e ? -1 : 1;
          for (let i = 0; i <= n; i++) {
            const a = -Math.PI / 2 + Math.PI * i / n;   // half circle around the end
            out.push(ends[e].clone().addScaledVector(d, s * R * Math.cos(a)).addScaledVector(nrm, s * R * Math.sin(a)));
          }
        }
        return out;
      }
      // rounded regular polygon (k sides of straight length Ls joined by arcs of radius R)
      function roundedPoly(c, k, Ls, R, rot, n) {
        const out = [], ap = Ls / (2 * Math.tan(Math.PI / k));   // apothem of the straight-sided polygon
        n = n || 8;
        for (let i = 0; i < k; i++) {
          const a0 = rot + TAU * i / k;                              // normal of side i
          const nx = Math.cos(a0), nz = Math.sin(a0), tx = -nz, tz = nx;
          const m = c.clone().add(V3(nx * (ap + R), 0, nz * (ap + R)));
          out.push(m.clone().add(V3(-tx * Ls / 2, 0, -tz * Ls / 2)), m.clone().add(V3(tx * Ls / 2, 0, tz * Ls / 2)));
          const cc = c.clone().add(V3(nx * ap + tx * Ls / 2, 0, nz * ap + tz * Ls / 2));   // vertex: arc centre
          for (let j = 1; j < n; j++) { const a = a0 + (TAU / k) * j / n; out.push(cc.clone().add(V3(R * Math.cos(a), 0, R * Math.sin(a)))); }
        }
        return out;
      }
      const loop = (p) => [...p, p[0].clone()];
      const plen = (p) => new A.Path(p).L;
      // magnets distributed around a path (closed loops: positions s in [0, L))
      function magnetsOn(path, nD, dL, nQ, g, ghost) {
        const P = new A.Path(path);
        for (let i = 0; i < nD; i++) {
          const s = P.L * (i + 0.5) / nD;
          const m = ghost ? ghostDipole(dL) : A.dipole(dL);
          A.placeAlong(m, P, s, g);
        }
        for (let i = 0; i < nQ; i++) {
          const s = P.L * i / nQ + 0.6;
          const m = ghost ? ghostQuad() : A.quad(0.5);
          A.placeAlong(m, P, Math.min(P.L - 0.4, s), g);
        }
        return P;
      }
      function ghostDipole(L) { const g = new THREE.Group(); g.add(A.box(1.5, 1.1, L, G.ghostMag, 0, 0, 0)); g.add(A.box(1.0, 0.4, L * 0.8, G.ghostMag, 0, FLOOR + 0.2, 0)); return g; }
      function ghostQuad() { const g = new THREE.Group(); g.add(A.box(0.9, 0.9, 0.6, G.ghostMag, 0, 0, 0)); return g; }
      function ghostPipe(pts, g) { A.pipe(pts, g, 0.12, G.ghostMag); }
      // a tunnel: two walls along a centre line, open at the top
      function tunnel(path, width, h, g, mat, closed) {
        walls(offset(path, width / 2, closed), h, 0.5, g, mat, closed);
        walls(offset(path, -width / 2, closed), h, 0.5, g, mat, closed);
      }
      function ghostTunnel(path, width, g, closed) {
        tunnel(path, width, 3.6, g, G.ghost, closed);
        dashed(offset(path, width / 2, closed), g, FLOOR + 3.7, closed);
        dashed(offset(path, -width / 2, closed), g, FLOOR + 3.7, closed);
      }
      function room(g, x0, z0, x1, z1, h, mat) {
        floorSlab(x0, z0, x1, z1, g);
        walls([V3(x0, 0, z0), V3(x1, 0, z0), V3(x1, 0, z1), V3(x0, 0, z1)], h || 4.5, 0.8, g, mat, true);
      }
      function ghostRoom(g, x0, z0, x1, z1) {
        const c = [V3(x0, 0, z0), V3(x1, 0, z0), V3(x1, 0, z1), V3(x0, 0, z1)];
        floorSlab(x0, z0, x1, z1, g, G.ghostFloor);
        walls(c, 5, 0.8, g, G.ghost, true);
        dashed(c, g, FLOOR + 5.1, true);
      }
      const turn = (d, a) => V3(d.x * Math.cos(a) - d.z * Math.sin(a), 0, d.x * Math.sin(a) + d.z * Math.cos(a));
      // a beam line built from straights and arcs: steps [["s", L], ["a", R, angleRad]]
      function trace(p, d, steps) {
        const out = [p.clone()]; let q = p.clone(), dir = d.clone().normalize();
        const marks = [];
        for (const st of steps) {
          if (st[0] === "s") { q = q.clone().addScaledVector(dir, st[1]); out.push(q.clone()); }
          else if (st[0] === "m") marks.push({ name: st[1], p: q.clone(), d: dir.clone() });
          else {
            const R = st[1], ang = st[2], n = Math.max(4, Math.ceil(Math.abs(ang) * 12));
            const side = Math.sign(ang), nrm = V3(-dir.z, 0, dir.x).multiplyScalar(side);   // toward the centre of curvature
            const c = q.clone().addScaledVector(nrm, R), start = q.clone().sub(c);
            for (let i = 1; i <= n; i++) { const a = ang * i / n; const r = turn(start, a); out.push(c.clone().add(r)); }
            const mid = turn(start, ang / 2); marks.push({ name: "bend", p: c.clone().add(mid), d: turn(dir, ang / 2), L: Math.abs(ang) * R, ang });
            q = out[out.length - 1].clone(); dir = turn(dir, ang);
          }
        }
        return { pts: out, end: q, dir, marks };
      }
      function people(g, spots) { for (const [x, z, r] of spots) { const p = A.person(r); p.position.set(x, 0, z); g.add(p); } }

      // =====================================================================================
      // GSI (operating). Plan after the published site sketches [7, 8]: UNILAC west to east, the
      // transfer channel north-east to SIS18, extraction lines south from SIS18 to the FRS, the ESR
      // hall, CRYRING and the target hall caves.
      // =====================================================================================
      const ZU = 118;                                   // UNILAC axis
      const sourcePaths = [-6, 6].map((dz) => [V3(-239, 0, ZU + dz), V3(-233, 0, ZU + dz * 0.3), V3(-228, 0, ZU)]);
      // ---------- ion sources and UNILAC (120 m) [1, 2]
      const gSrc = A.section("ion sources (HSI terminal, HLI)", "lin", [V3(-248, 0, 104), V3(-200, 0, 130)], 4);
      {
        for (const dz of [-6, 6]) {                       // two source terminals of the high-current injector
          const t = new THREE.Group();
          t.add(A.rbox(6, 4.2, 6, 0.1, G.cage, 0, FLOOR + 2.1, 0));
          t.add(A.rbox(2.6, 2.4, 2.4, 0.1, M.vessel, 0, 0.1, 0));
          for (let k = 0; k < 3; k++) t.add(A.box(0.8, 1.9, 0.6, M.rack, -2 + k * 0.9, FLOOR + 0.95, -2.2));
          t.position.set(-242, 0, ZU + dz); gSrc.add(A.shadowy(t));
          A.pipe(sourcePaths[dz < 0 ? 0 : 1], gSrc, 0.07);
        }
        A.placeAlong(A.dipole(1.2), new A.Path([V3(-232, 0, ZU), V3(-226, 0, ZU)]), 2, gSrc);
        // high-charge injector (HLI): ECR source and its short linac, joining before the Alvarez section
        const ecr = new THREE.Group();
        const sol = A.cyl(0.8, 2.0, M.copper, 24); sol.rotation.z = Math.PI / 2; ecr.add(sol);
        ecr.add(A.rbox(2.4, 2.2, 2.4, 0.08, M.vessel, -2.2, 0, 0));
        ecr.position.set(-214, 0, 100); gSrc.add(A.shadowy(ecr));
        A.pipe([V3(-212, 0, 100), V3(-198, 0, 100), V3(-193, 0, 106), V3(-191, 0, ZU)], gSrc, 0.07);
        for (let k = 0; k < 2; k++) { const c = A.cyl(0.55, 3.2, M.copper, 16); c.rotation.z = Math.PI / 2; c.position.set(-208 + k * 4, 0, 100); gSrc.add(A.shadowy(c)); }
        room(gSrc, -250, 96, -222, 132, 5);
        floorSlab(-222, 94, -188, 108, gSrc);
      }
      const gUni = A.section("UNILAC: HSI, Alvarez, single-gap cavities", "lin", [V3(-226, 0, ZU), V3(-104, 0, ZU)], 6);
      {
        A.pipe([V3(-228, 0, ZU), V3(-102, 0, ZU)], gUni, 0.06);
        // HSI: RFQ then two IH tanks, to 1.4 MeV/u [2]
        const rfq = A.cyl(0.7, 9, M.copper, 4); rfq.rotation.x = Math.PI / 2; rfq.rotation.y = Math.PI / 4; rfq.position.set(-220.5, 0, ZU); rfq.rotation.order = "YXZ";
        A.orientTo(rfq, V3(-220.5, 0, ZU), V3(1, 0, 0)); rfq.rotateX(Math.PI / 2); gUni.add(A.shadowy(rfq));
        for (const [x, L] of [[-209, 8], [-199, 6]]) { const t = A.cyl(0.85, L, M.copper, 24); A.orientTo(t, V3(x, 0, ZU), V3(1, 0, 0)); t.rotateX(Math.PI / 2); gUni.add(A.shadowy(t)); }
        for (const x of [-215, -204.5, -195]) A.placeAlong(A.quad(0.4), new A.Path([V3(x - 1, 0, ZU), V3(x + 1, 0, ZU)]), 1, gUni);
        // poststripper: five Alvarez tanks and ten single-gap resonators, 11.4 MeV/u [2]
        for (let i = 0; i < 5; i++) {
          const x = -180 + i * 12.4, t = A.cyl(1.0, 10.6, G.alv, 28); A.orientTo(t, V3(x, 0, ZU), V3(1, 0, 0)); t.rotateX(Math.PI / 2); gUni.add(A.shadowy(t));
          for (const s of [-1, 1]) { const r = A.cyl(1.08, 0.12, M.steelDark, 28); A.orientTo(r, V3(x + s * 5.3, 0, ZU), V3(1, 0, 0)); r.rotateX(Math.PI / 2); gUni.add(r); }
          for (let k = 0; k < 3; k++) gUni.add(A.box(0.3, -FLOOR - 0.9, 0.5, M.steelDark, x - 3.5 + k * 3.5, (FLOOR - 0.9) / 2, ZU));
          gUni.add(A.rbox(1.2, 2.2, 1.6, 0.06, M.rack, x, FLOOR + 1.1, ZU - 3.2));   // RF amplifier cabinet
          A.placeAlong(A.quad(0.4), new A.Path([V3(x + 5.6, 0, ZU), V3(x + 7, 0, ZU)]), 0.4, gUni);
        }
        for (let i = 0; i < 10; i++) { const c = A.cyl(0.45, 0.6, M.copper, 20); c.position.set(-116.5 + i * 1.3, 0.2, ZU); gUni.add(A.shadowy(c)); }
        // the UNILAC tunnel: walls each side, open on top
        walls([V3(-228, 0, ZU - 6), V3(-104, 0, ZU - 6)], 4.5, 0.8, gUni);
        walls([V3(-228, 0, ZU + 6), V3(-104, 0, ZU + 6)], 4.5, 0.8, gUni);
        floorSlab(-228, ZU - 6, -104, ZU + 6, gUni);
        A.lamps(V3(-226, 0, ZU - 5.6), V3(-106, 0, ZU - 5.6), gUni, 9);
        people(gUni, [[-170, ZU + 3.8, 0.4], [-142, ZU - 3.6, 2.4], [-118, ZU + 3.5, -1]]);
      }
      const gStr = A.section("gas stripper", "strip", [V3(-194, 0, ZU), V3(-186, 0, ZU)], 6);
      {
        const st = new THREE.Group();
        st.add(A.rbox(1.6, 1.8, 2.4, 0.08, M.steel, 0, 0.2, 0));
        const w = A.cyl(0.18, 0.05, M.glow, 16); w.rotation.z = Math.PI / 2; w.position.set(0.82, 0.1, 0); st.add(w);
        st.add(A.rbox(1.4, 1.1, 1.4, 0.06, M.steelDark, 0, FLOOR + 0.55, 2.1));
        st.position.set(-190, 0, ZU); gStr.add(A.shadowy(st));
        for (const x of [-193.5, -186.5]) A.placeAlong(A.dipole(1.0), new A.Path([V3(x - 0.5, 0, ZU), V3(x + 0.5, 0, ZU)]), 0.5, gStr);
      }
      // UNILAC experimental hall with its fan of low-energy branches (Z6 among them) [8]
      const gUhall = A.section("UNILAC experimental hall (Z6 and other branches)", "end", [V3(-104, 0, 94), V3(-46, 0, 140)], 2);
      {
        room(gUhall, -104, 94, -46, 140, 6);
        const fan = [[-0.38, 34], [-0.17, 40], [0.0, 44], [0.17, 40], [0.36, 32]];
        for (const [a, L] of fan) {
          const a0 = V3(-98, 0, ZU), d = V3(Math.cos(a), 0, Math.sin(a)), e = a0.clone().addScaledVector(d, L);
          A.pipe([a0, e], gUhall, 0.06);
          A.placeAlong(A.quad(0.4), new A.Path([a0, e]), L * 0.4, gUhall);
          const ch = A.rbox(1.4, 1.4, 1.6, 0.08, M.steel, 0, 0, 0); A.orientTo(ch, e, d); gUhall.add(A.shadowy(ch));
          gUhall.add(A.box(1.2, -FLOOR - 0.7, 1.2, M.steelDark, e.x, (FLOOR - 0.7) / 2, e.z));
        }
        A.placeAlong(A.dipole(2.2), new A.Path([V3(-100, 0, ZU), V3(-96, 0, ZU)]), 2, gUhall);
        people(gUhall, [[-70, 104, 0.6], [-62, 132, 2.2]]);
      }

      // ---------- transfer channel TK to SIS18, and SIS18 (216.72 m, 12 cells, 24 dipoles, 18 Tm) [1, 3, 4]
      const C18 = 216.72, bendRadius18 = 2.6 / (Math.PI / 12), straight18 = (C18 - TAU * bendRadius18) / 12;
      // Twelve cells, each with a straight followed by two 15-degree dipoles on a finite arc.
      const ring18 = roundedPoly(V3(0, 0, 0), 12, straight18, bendRadius18, Math.PI / 6, 24);
      const scale18 = C18 / plen(loop(ring18)); ring18.forEach((p) => p.multiplyScalar(scale18));
      const ring18c = loop(ring18), ringPath18 = new A.Path(ring18c), side18 = C18 / 12, ls18 = straight18 * scale18;
      const R18 = Math.max(...ring18.map((p) => p.length()));
      const inj18 = ringPath18.at(6 * side18 + ls18 / 2);             // west side, on the orbit
      const TK = [V3(-104, 0, ZU), V3(-92, 0, ZU), ...A.bez(V3(-92, 0, ZU), V3(-70, 0, ZU), inj18.clone().add(V3(-8, 0, 14)), inj18, 24).slice(1)];
      const gTK = A.section("transfer channel TK", "rig", TK, 6);
      {
        A.pipe(TK, gTK, 0.07);
        const P = new A.Path(TK);
        for (let i = 1; i < 6; i++) A.placeAlong(A.quad(0.5), P, P.L * i / 6, gTK);
        for (const u of [0.34, 0.62]) A.placeAlong(A.dipole(2.4), P, P.L * u, gTK);
        tunnel(TK.slice(2), 7, 4.2, gTK);
      }
      const gS18 = A.section("SIS18 synchrotron (216 m, 18 Tm)", "rig", ring18, 8);
      {
        A.pipe(ring18c, gS18, 0.08);
        const P = new A.Path(ring18c);
        for (let i = 0; i < 12; i++) {                    // two dipoles around each corner, quadrupole triplets and RF in the straights
          const s0 = i * side18;
          for (const f of [0.25, 0.75]) A.placeAlong(A.dipole(2.6, { bend: -Math.PI / 12 }), P, s0 + ls18 + (side18 - ls18) * f, gS18);
          for (const f of [0.25, 0.5, 0.75]) A.placeAlong(A.quad(0.7), P, s0 + ls18 * f, gS18);
          if (i === 1 || i === 7) { const cav = A.cyl(0.75, 2.4, M.copper, 20); A.orientTo(cav, P.at(s0 + ls18 * 0.11), P.at(s0 + ls18 * 0.11 + 1).sub(P.at(s0 + ls18 * 0.11)).normalize()); cav.rotateX(Math.PI / 2); gS18.add(A.shadowy(cav)); }
        }
        gS18.userData.latticeCounts = { dipoles: 24, quadrupoles: 36, rfCavities: 2 };
        tunnel(ring18c, 7.5, 4.2, gS18, null, false);
        const lmp = offset(ring18c, 3.4, false); for (let i = 0; i < 12; i++) A.lamps(lmp[i], lmp[i + 1], gS18, 7);
        // the ring floor and the hall inside the ring
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(R18 + 4.5, R18 + 4.5, 0.4, 12), M.floor); fl.rotation.y = Math.PI / 12; fl.position.y = FLOOR - 0.2; fl.receiveShadow = true; gS18.add(fl);
        people(gS18, [[R18 - 2.5, 3, 1.2], [-R18 + 2.2, -6, -0.8]]);
      }

      // ---------- extraction from SIS18 to the south: FRS, the caves, HHT [3, 7, 8]
      const ext18 = ringPath18.at(ls18 / 2);             // south-east side
      const TA = V3(50, 0, 34);
      const extr = [ext18.clone(), ...A.bez(ext18.clone(), ext18.clone().add(V3(10, 0, 8)), V3(50, 0, 14), TA, 10).slice(1)];
      // FRS: four 30 deg dipoles, rho = 11.25 m [3]: D1, D2 bend one way, D3, D4 back (achromatic at S4)
      const rhoF = 11.25, a30 = Math.PI / 6;
      const frs = trace(TA, V3(0, 0, 1), [["s", 8], ["a", rhoF, -a30], ["s", 4], ["m", "S1"], ["s", 4], ["a", rhoF, -a30], ["s", 7], ["m", "S2"], ["s", 7], ["a", rhoF, a30], ["s", 4], ["m", "S3"], ["s", 4], ["a", rhoF, a30], ["s", 9], ["m", "S4"]]);
      const S = {}; for (const m of frs.marks) if (m.name !== "bend") S[m.name] = m;
      const gFRS = A.section("FRS fragment separator (18 Tm)", "sep", frs.pts, 8);
      {
        A.pipe(frs.pts, gFRS, 0.1);
        let k = 0;
        for (const m of frs.marks) {
          if (m.name === "bend") { const d = A.dipole(m.L * 0.92, { bend: m.ang * 0.92, w: 2.55, h: 1.96, gap: 0.12 }); A.orientTo(d, m.p, m.d); gFRS.add(d); k++; }   // sector dipole on its arc
          else {                                            // focal plane: detector box, and a degrader ladder at S2
            const b = A.rbox(1.3, 1.5, 1.4, 0.08, M.steel, 0, 0.1, 0); A.orientTo(b, m.p, m.d); gFRS.add(A.shadowy(b));
            gFRS.add(A.box(1.0, -FLOOR - 0.6, 1.0, M.steelDark, m.p.x, (FLOOR - 0.6) / 2, m.p.z));
            if (m.name === "S2") { const w = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.4, 0.6, 3), M.copper); w.position.copy(m.p).setY(1.1); gFRS.add(w); }
          }
        }
        const P = new A.Path(frs.pts);
        for (let i = 0; i < 14; i++) { const q = A.quad(1.0); q.scale.setScalar(1.25); A.placeAlong(q, P, 2.5 + i * (P.L - 5) / 13, gFRS); }
        // production target in a shielded vault
        const sh = new THREE.Group();
        for (let ix = -2; ix <= 2; ix++) for (let iy = 0; iy < 2; iy++) for (const iz of [-1, 1]) sh.add(A.box(1.9, 1.9, 1.9, M.shield, ix * 2, FLOOR + 1 + iy * 2, iz * 2));
        sh.position.copy(TA); sh.rotation.y = Math.PI / 2; gFRS.add(A.shadowy(sh));
        const tg = A.cyl(0.35, 0.1, M.glow, 20); tg.rotation.x = Math.PI / 2; tg.position.copy(TA); gFRS.add(tg);
        A.pipe(extr, gFRS, 0.08);
        A.placeAlong(A.quad(0.6), new A.Path(extr), 14, gFRS); A.placeAlong(A.dipole(2.4), new A.Path(extr), 9, gFRS);
        people(gFRS, [[S.S2.p.x - 4, S.S2.p.z, 1.4], [S.S4.p.x + 3.5, S.S4.p.z - 2, -0.5]]);
      }

      // ESR (108.36 m, 6 dipoles of 60 deg, 10 Tm) [4, 5]; injection from the FRS
      const CE = V3(4, 0, 128), Rarc = 8.0, LsE = (108.36 - TAU * Rarc) / 2;
      const esr = racetrack(CE, [0, 1], LsE, Rarc, 18), esrc = loop(esr);
      const esrBranch = [S.S3.p.clone(), ...A.bez(S.S3.p, S.S3.p.clone().addScaledVector(S.S3.d, 10), V3(CE.x + Rarc + 14, 0, CE.z - LsE / 2 - 8), V3(CE.x + Rarc, 0, CE.z - LsE / 2 + 4), 20).slice(1), V3(CE.x + Rarc, 0, CE.z - 2)];
      const gESR = A.section("ESR storage ring (108 m, 10 Tm)", "rig", esr, 8);
      {
        A.pipe(esrc, gESR, 0.09);
        // the six 60 deg dipoles: three on each arc (the point list starts with the arc at the south end)
        const P = new A.Path(esrc), arcL = Math.PI * Rarc;
        for (const s0 of [0, arcL + LsE]) for (let k = 0; k < 3; k++) { const m = A.dipole(arcL / 3 * 0.8, { w: 2.38, h: 1.82 }); A.placeAlong(m, P, s0 + arcL * (k + 0.5) / 3, gESR); }
        // quadrupoles on the straights, electron cooler on one, gas-jet target on the other [5]
        for (const [x, z0] of [[CE.x + Rarc, CE.z - LsE / 2], [CE.x - Rarc, CE.z - LsE / 2]]) for (const f of [0.1, 0.28, 0.72, 0.9]) A.placeAlong(A.quad(0.7), new A.Path([V3(x, 0, z0), V3(x, 0, z0 + LsE)]), LsE * f, gESR);
        const ec = new THREE.Group();                       // electron cooler: solenoid with the gun and collector bends
        const so = A.cyl(0.9, 5, M.vessel, 28); so.rotation.x = Math.PI / 2; ec.add(so);
        for (const s of [-1, 1]) { const b = A.cyl(0.55, 2.4, M.copper, 16); b.rotation.z = Math.PI / 2; b.rotation.y = s * 0.6; b.position.set(-1.3, 0, s * 2.9); ec.add(b); }
        ec.add(A.box(1.4, -FLOOR - 0.9, 4, M.steelDark, 0, (FLOOR - 0.9) / 2, 0));
        ec.position.set(CE.x - Rarc, 0, CE.z); gESR.add(A.shadowy(ec));
        const jet = new THREE.Group();                      // internal gas-jet target: vertical stack through the ring
        jet.add(A.cyl(0.35, 3.2, M.steel, 18)); jet.add(A.rbox(0.9, 0.9, 0.9, 0.06, M.steel, 0, 0, 0));
        for (let k = 0; k < 3; k++) { const st = A.cyl(0.45, 0.25, M.steelDark, 18); st.position.y = 0.7 + k * 0.6; jet.add(st); }
        jet.position.set(CE.x + Rarc, 0, CE.z + 6); gESR.add(A.shadowy(jet));
        A.pipe(esrBranch, gESR, 0.09);
        const Pb = new A.Path(esrBranch); for (const u of [0.25, 0.55, 0.8]) A.placeAlong(A.dipole(2.0), Pb, Pb.L * u, gESR);
        people(gESR, [[CE.x, CE.z - 6, 0.3], [CE.x + Rarc + 3, CE.z + 12, 2]]);
      }
      // CRYRING@ESR (54.17 m, half the ESR extraction orbit) [6], fed from the ESR
      const CC = V3(-2, 0, 206), Rc = 54.17 / TAU;
      const cry = []; for (let i = 0; i < 12; i++) { const a = TAU * i / 12; cry.push(V3(CC.x + Rc * Math.cos(a), 0, CC.z + Rc * Math.sin(a))); }
      const cryc = loop(cry);
      const esr2cry = [V3(CE.x - Rarc, 0, CE.z + LsE / 2 - 3), V3(CE.x - Rarc - 4, 0, CE.z + LsE / 2 + 18), V3(CC.x - 2, 0, CC.z - Rc - 8), cry[9].clone()];
      const gCRY = A.section("CRYRING@ESR (54 m)", "rig", [...cry, ...esr2cry.slice(1)], 6);
      {
        A.pipe(cryc, gCRY, 0.07); A.pipe(esr2cry, gCRY, 0.07);
        magnetsOn(cryc, 6, 1.6, 6, gCRY, false);
        const ec = A.cyl(0.6, 2.4, M.vessel, 20); A.orientTo(ec, cry[3].clone().lerp(cry[4], 0.5), cry[4].clone().sub(cry[3]).normalize()); ec.rotateX(Math.PI / 2); gCRY.add(A.shadowy(ec));
        room(gCRY, CC.x - 16, CC.z - 16, CC.x + 16, CC.z + 15, 4.5);
        A.placeAlong(A.dipole(1.6), new A.Path(esr2cry), 12, gCRY);
        people(gCRY, [[CC.x + 3, CC.z + 1, 2.1]]);
      }
      // HITRAP decelerator in the ESR hall [5, 8]
      const hit = [V3(CE.x - Rarc, 0, CE.z + 8), V3(CE.x - Rarc - 6, 0, CE.z + 14), V3(-34, 0, CE.z + 14)];
      const gHIT = A.section("HITRAP decelerator", "lin", hit, 4);
      {
        A.pipe(hit, gHIT, 0.06);
        for (let i = 0; i < 2; i++) { const t = A.cyl(0.6, 2.6, M.copper, 20); A.orientTo(t, V3(-16 - i * 4, 0, CE.z + 14), V3(-1, 0, 0)); t.rotateX(Math.PI / 2); gHIT.add(A.shadowy(t)); }
        const tr = A.cyl(0.55, 1.6, M.vessel, 20); tr.position.set(-32, 0.3, CE.z + 14); gHIT.add(A.shadowy(tr));    // trap magnet, vertical
      }
      // ESR hall building
      {
        const g = gESR;
        floorSlab(-40, 92, 30, 190, g);
        walls([V3(-40, 0, 92), V3(30, 0, 92), V3(30, 0, 190), V3(-40, 0, 190)], 7, 0.8, g, null, true);
        A.lamps(V3(-38, 0, 92.6), V3(28, 0, 92.6), g, 8);
      }

      // target hall: FRS, HHT, the caves fed through the FRS switch dipoles (A, B, C, M) [3, 7, 9]
      const caveLine = [S.S4.p.clone(), S.S4.p.clone().addScaledVector(S.S4.d, 8), V3(S.S4.p.x + 2, 0, 190)];
      const gTH = A.section("target hall: beam line to Caves A, B, M, C", "end", caveLine, 6);
      {
        A.pipe(caveLine, gTH, 0.09);
        const P = new A.Path(caveLine);
        for (let i = 1; i < 9; i++) A.placeAlong(A.quad(0.8), P, P.L * i / 9, gTH);
        floorSlab(32, 22, 108, 226, gTH);
        walls([V3(32, 0, 22), V3(108, 0, 22), V3(108, 0, 226), V3(32, 0, 226)], 7, 0.8, gTH, null, true);
        A.lamps(V3(34, 0, 225.4), V3(106, 0, 225.4), gTH, 8);
      }
      function cave(name, line, s, side, w, d) {            // a shielded cave beside the line, with its branch
        const P = new A.Path(line), p = P.at(s), dir = P.at(s + 1).sub(p).normalize(), n = V3(-dir.z, 0, dir.x).multiplyScalar(side);
        const c = p.clone().addScaledVector(n, 6 + w / 2);
        const g = A.section(name, "end", [c.clone().add(V3(-w / 2, 0, -d / 2)), c.clone().add(V3(w / 2, 0, d / 2))], 1);
        room(g, c.x - w / 2, c.z - d / 2, c.x + w / 2, c.z + d / 2, 5);
        const e = c.clone();
        A.pipe([p, p.clone().addScaledVector(n, 2).addScaledVector(dir, 1.5), e], g, 0.07);
        A.placeAlong(A.dipole(1.6), P, s, g);
        return { g, c, n, e };
      }
      {
        const a = cave("Cave A", caveLine, 52, 1, 14, 16); const t = A.rbox(1.6, 1.6, 1.6, 0.1, M.steel, 0, 0, 0); t.position.copy(a.c); a.g.add(A.shadowy(t));
        a.g.add(A.box(1.4, -FLOOR - 0.8, 1.4, M.steelDark, a.c.x, (FLOOR - 0.8) / 2, a.c.z));
        const b = cave("Cave B", caveLine, 74, -1, 12, 16); const tb = A.cyl(0.7, 1.4, M.steel, 20); tb.position.copy(b.c); b.g.add(A.shadowy(tb));
        const m = cave("Cave M (biophysics)", caveLine, 98, 1, 14, 14);
        const couch = A.rbox(0.7, 0.2, 2.0, 0.05, M.hat, 0, -0.3, 0); couch.position.add(m.c).setY(-0.3); m.g.add(couch);
        m.g.add(A.box(0.5, -FLOOR - 0.4, 0.5, M.steelDark, m.c.x, (FLOOR - 0.4) / 2, m.c.z));
      }
      // Cave C: the R3B setup, GLAD since 2016 with CALIFA and NeuLAND [9, 10]
      const CCv = caveLine[2];
      const gCaveC = A.section("Cave C: R3B (GLAD, CALIFA, NeuLAND)", "end", [V3(CCv.x - 13, 0, 186), V3(CCv.x + 13, 0, 224)], 1);
      {
        room(gCaveC, CCv.x - 13, 186, CCv.x + 13, 224, 6);
        const g = new THREE.Group();
        const cal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), M.steelDark); g.add(cal);       // CALIFA around the target
        const ed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.77, 1), M.copper); ed.scale.setScalar(1); ed.visible = false; g.add(ed);
        const glad = new THREE.Group();                                                                     // GLAD: large superconducting dipole in its cryostat
        glad.add(A.rbox(4.6, 4.2, 3.6, 0.5, G.glad, 0, 0.6, 0));
        glad.add(A.rbox(1.6, 1.4, 4.2, 0.1, M.steelDark, 0, 0, 0.2));
        glad.add(A.box(3.0, -FLOOR - 1.0, 3.0, M.steelDark, 0, (FLOOR - 1.0) / 2, 0));
        const cv = A.cyl(0.6, 1.4, M.steel, 16); cv.position.set(1.2, 3.3, 0); glad.add(cv);
        glad.position.set(0, 0, 4.5); g.add(glad);
        const vac = A.rbox(2.6, 1.6, 4.0, 0.1, M.steel, 0, 0, 0); vac.position.set(1.1, 0, 8.6); vac.rotation.y = 0.25; g.add(vac);   // vacuum chamber behind GLAD
        const nl = new THREE.Group();                                                                       // NeuLAND: 2.5 m x 2.5 m x 3 m of scintillator bars
        for (let k = 0; k < 6; k++) nl.add(A.box(2.5, 2.5, 0.45, k % 2 ? M.black : M.cable, 0, 0.3, k * 0.5));
        nl.add(A.box(3.0, 0.3, 3.4, M.steelDark, 0, FLOOR + 0.15, 1.25));
        nl.position.set(-1.0, 0, 13.5); g.add(nl);
        A.orientTo(g, V3(CCv.x, 0, 190), V3(0, 0, 1)); gCaveC.add(A.shadowy(g));
        for (let k = 0; k < 4; k++) gCaveC.add(A.box(0.8, 2.0, 0.6, M.rack, CCv.x + 9 + (k % 2) * 0.85, FLOOR + 1.0, 200 + Math.floor(k / 2) * 6));
        people(gCaveC, [[CCv.x - 5, 196, 1.1], [CCv.x + 5, 207, -1.6]]);
      }
      // HHT, fed directly from SIS18, and the PHELIX laser beam line to it and to Z6 [8]
      const HHT = V3(40, 0, 74);
      const hhtLine = [ext18.clone(), V3(30, 0, 30), V3(38, 0, 56), HHT.clone()];
      const gHHT = A.section("HHT (high energy, high temperature)", "end", [V3(33, 0, 68), V3(47, 0, 82)], 2);
      {
        A.pipe(hhtLine, gHHT, 0.07);
        const P = new A.Path(hhtLine); for (const u of [0.3, 0.6]) A.placeAlong(A.quad(0.5), P, P.L * u, gHHT);
        const ch = A.cyl(0.9, 1.6, M.steel, 24); ch.position.copy(HHT); gHHT.add(A.shadowy(ch));
        walls([V3(33, 0, 66), V3(47, 0, 66), V3(47, 0, 82), V3(33, 0, 82)], 4.5, 0.8, gHHT, null, true);
      }
      const gPH = A.section("PHELIX laser", "end", [V3(-30, 0, 60), V3(-12, 0, 80)], 2);
      {
        floorSlab(-30, 60, -12, 82, gPH);
        walls([V3(-30, 0, 60), V3(-12, 0, 60), V3(-12, 0, 82), V3(-30, 0, 82)], 6, 0.6, gPH, null, true);
        for (let k = 0; k < 4; k++) gPH.add(A.rbox(1.0, 1.0, 12, 0.08, M.vessel, -26 + k * 2.6, 0.2, 71));     // amplifier chain, generic
        const lz = (a, b) => { const L = a.distanceTo(b), m = A.box(0.08, 0.08, L, G.laser, 0, 0, 0); A.orientTo(m, a.clone().add(b).multiplyScalar(0.5).setY(2.6), b.clone().sub(a).normalize()); gPH.add(m); };
        lz(V3(-12, 0, 72), V3(HHT.x, 0, 72)); lz(V3(-30, 0, 72), V3(-50, 0, 106));
      }

      // =====================================================================================
      // FAIR (under construction / planned). Arrangement after the published FAIR layouts [11, 12],
      // circumferences from [11, 13, 14, 15]; all drawn as ghosts at beam level.
      // =====================================================================================
      // SIS100: 1083 m, 100 Tm, 108 dipoles, superconducting, in a tunnel whose floor is up to 17 m deep [11, 13]
      const C100 = 1083.6, R100 = 70, Ls100 = (C100 - TAU * R100) / 6;
      const c100 = V3(340, 0, -86);
      const s100 = roundedPoly(c100, 6, Ls100, R100, Math.PI / 2, 10), s100c = loop(s100);
      const gS100 = A.section("SIS100 (1.1 km, 100 Tm; under construction)", "rig", s100, 6);
      {
        ghostPipe(s100c, gS100);
        // 108 dipoles: 18 per arc; the arcs are drawn at the six rounded corners
        const P = new A.Path(s100c), L = P.L;
        const per = L / 6, arcL = TAU * R100 / 6;
        for (let i = 0; i < 6; i++) {
          const sArc0 = i * per + Ls100;          // each side in the point list starts with its straight
          for (let k = 0; k < 18; k++) A.placeAlong(ghostDipole(2.6), P, (sArc0 + arcL * (k + 0.5) / 18) % L, gS100);
          for (let k = 0; k < 6; k++) A.placeAlong(ghostQuad(), P, i * per + Ls100 * (k + 0.5) / 6, gS100);
        }
        ghostTunnel(s100c, 9, gS100, false);
      }
      // HEBT: SIS18 to SIS100 and to the Super-FRS target, about 300 m for the Early Science part [12]
      const inj100 = s100[8].clone().lerp(s100[9], 0.5);                 // a side facing south-west
      const hebt = [ringPath18.at(11 * side18 + ls18 / 2), V3(70, 0, 2), V3(130, 0, 22), V3(170, 0, 30), V3(200, 0, 40), inj100];
      const out100 = s100[10].clone().lerp(s100[11], 0.5);
      const RIB = V3(300, 0, 196);
      const toRIB = [V3(200, 0, 40), V3(240, 0, 70), V3(278, 0, 120), V3(294, 0, 160), RIB];
      const fromS100 = [out100, V3(out100.x - 10, 0, out100.z + 20), V3(286, 0, 128)];
      const gHEBT = A.section("HEBT transfer lines (under construction)", "rig", [...hebt, ...toRIB], 6);
      {
        for (const l of [hebt, toRIB, fromS100]) { ghostPipe(l, gHEBT); ghostTunnel(l, 6, gHEBT, false); const P = new A.Path(l); for (let s = 10; s < P.L - 5; s += 22) A.placeAlong(ghostQuad(), P, s, gHEBT); }
      }
      // CBM and APPA caves at the end of the SIS100 extraction line [11, 12]
      const toCBM = [V3(286, 0, 128), V3(320, 0, 142), V3(372, 0, 150)];
      const toAPPA = [V3(320, 0, 142), V3(340, 0, 170), V3(352, 0, 190)];
      const gCBM = A.section("CBM cave (under construction)", "end", [V3(365, 0, 136), V3(400, 0, 166)], 1);
      {
        ghostPipe(toCBM, gCBM); ghostTunnel(toCBM.slice(0, 2), 6, gCBM, false);
        ghostRoom(gCBM, 368, 136, 404, 166);
        const g = new THREE.Group();                                         // generic: dipole magnet and a row of tracking stations
        g.add(A.box(4, 3.5, 2.5, G.ghostMag, 0, 0.5, 2));
        for (let k = 0; k < 5; k++) g.add(A.box(4.5 - k * 0.2, 4.5 - k * 0.2, 0.3, G.ghostMag, 0, 0.6, 6 + k * 2.2));
        A.orientTo(g, V3(376, 0, 151), V3(1, 0, 0)); gCBM.add(g);
      }
      const gAPPA = A.section("APPA cave (under construction)", "end", [V3(338, 0, 184), V3(368, 0, 210)], 1);
      {
        ghostPipe(toAPPA, gAPPA); ghostTunnel(toAPPA, 6, gAPPA, false);
        ghostRoom(gAPPA, 336, 186, 370, 212);
        for (const [x, z] of [[352, 200], [362, 204]]) { const c = A.cyl(1.0, 2, G.ghostMag, 18); c.position.set(x, 0, z); gAPPA.add(c); }
      }
      // Super-FRS: target, pre-separator (about 100 m) and main separator (about 250 m), 20 Tm, three branches [12, 16, 17]
      const sfPre = [RIB, V3(298, 0, 240), V3(292, 0, 296)];
      const BB = sfPre[2];
      const sfMain = [BB, V3(286, 0, 360), V3(278, 0, 430), V3(270, 0, 500), V3(266, 0, 545)];
      const HEB = sfMain[4];
      const LEB = [V3(274, 0, 470), V3(300, 0, 510), V3(330, 0, 548)];
      const CRc = V3(128, 0, 470), dHE = [-0.45, 0.89];
      const cr = racetrack(CRc, dHE, (221.5 - TAU * 18) / 2, 18, 14), crc = loop(cr);
      const crE = CRc.clone().add(V3(0.892 * 18, 0, 0.451 * 18));                // east flank of the CR
      const ringBr = [V3(276, 0, 455), V3(240, 0, 472), V3(190, 0, 482), crE.clone().add(V3(4, 0, 6))];
      const gSF = A.section("Super-FRS (20 Tm; under construction)", "sep", [...sfPre, ...sfMain], 8);
      {
        for (const l of [sfPre, sfMain]) {
          ghostPipe(l, gSF); ghostTunnel(l, 10, gSF, false);
          const P = new A.Path(l);
          for (let s = 6; s < P.L - 4; s += 16) A.placeAlong(ghostQuad(), P, s, gSF);
          for (let s = 14; s < P.L - 4; s += 45) { const d = ghostDipole(4); d.scale.set(1.6, 1.6, 1); A.placeAlong(d, P, s, gSF); }
        }
        const sh = A.box(14, 8, 18, G.ghost, RIB.x, FLOOR + 4, RIB.z); gSF.add(sh);          // target building (shielded)
        dashed([V3(RIB.x - 7, 0, RIB.z - 9), V3(RIB.x + 7, 0, RIB.z - 9), V3(RIB.x + 7, 0, RIB.z + 9), V3(RIB.x - 7, 0, RIB.z + 9)], gSF, FLOOR + 8.1, true);
      }
      const gHEB = A.section("NUSTAR High-Energy Branch: R3B (under construction)", "end", [V3(250, 0, 540), V3(282, 0, 580)], 1);
      { ghostRoom(gHEB, 250, 542, 284, 586); const g = new THREE.Group(); g.add(A.box(4.6, 4.2, 3.6, G.ghostMag, 0, 0.6, 0)); g.add(A.box(2.5, 2.5, 3, G.ghostMag, 0, 0.3, 12)); A.orientTo(g, V3(266, 0, 556), V3(0, 0, 1)); gHEB.add(g); }
      const gLEB = A.section("NUSTAR Low-Energy Branch (planned)", "end", [V3(322, 0, 540), V3(350, 0, 566)], 1);
      { ghostPipe(LEB, gLEB); ghostTunnel(LEB, 6, gLEB, false); ghostRoom(gLEB, 324, 542, 352, 568); }
      // Collector Ring CR (221.5 m, 13 Tm) and HESR (575 m; PANDA) [14, 15, 18]: later stages
      const gCR = A.section("CR collector ring (221 m; planned)", "rig", cr, 6);
      {
        ghostPipe(crc, gCR); ghostTunnel(crc, 9, gCR, false);
        magnetsOn(crc, 24, 2.2, 12, gCR, true);
        ghostPipe(ringBr, gCR); ghostTunnel(ringBr, 6, gCR, false);
      }
      const HEc = V3(190, 0, 300);
      const hesr = racetrack(HEc, dHE, 132, 155.5 / Math.PI, 26), hesrc = loop(hesr);
      const gHESR = A.section("HESR (575 m) with PANDA (planned)", "rig", hesr, 6);
      {
        ghostPipe(hesrc, gHESR); ghostTunnel(hesrc, 8, gHESR, false);
        const P = new A.Path(hesrc), arcL = 155.5;
        // dipoles on the two arcs (count schematic), quads along the straights
        const s0 = 0;
        for (let k = 0; k < 22; k++) { A.placeAlong(ghostDipole(4), P, (s0 + arcL * (k + 0.5) / 22), gHESR); A.placeAlong(ghostDipole(4), P, (arcL + 132 + arcL * (k + 0.5) / 22) % P.L, gHESR); }
        // PANDA in the straight facing the Super-FRS [7, 12]
        const sP = 2 * arcL + 132 * 1.5, pP = P.at(sP), dP = P.at(sP + 1).sub(pP).normalize();
        const pd = new THREE.Group();
        const bar = A.cyl(2.6, 6, G.ghostMag, 24); bar.rotation.x = Math.PI / 2; pd.add(bar);
        pd.add(A.box(5, 5, 3, G.ghostMag, 0, 0.8, 6)); pd.add(A.box(5.5, 5.5, 1.5, G.ghostMag, 0, 0.8, 10));
        A.orientTo(pd, pP, dP); gHESR.add(pd);
        const cr2he = [CRc.clone().add(V3(0.451 * 45, 0, -0.892 * 45)), V3(124, 0, 396), hesr[22].clone()];      // CR north end to the HESR south arc
        ghostPipe(cr2he, gHESR); ghostTunnel(cr2he, 6, gHESR, false);
      }
      // antiproton target and separator to the CR [11, 12]
      const pbar = [V3(282, 0, 300), V3(270, 0, 360), V3(238, 0, 420), V3(190, 0, 452), crE.clone().add(V3(2, 0, -8))];
      const gPbar = A.section("antiproton target and separator (planned)", "sep", pbar, 4);
      { ghostPipe(pbar, gPbar); ghostTunnel(pbar, 6, gPbar, false); gPbar.add(A.box(8, 6, 10, G.ghost, 282, FLOOR + 3, 300)); }
      // the proton linac for antiproton production, beside SIS18 (length schematic) [11, 12]
      const pl = [V3(-70, 0, -70), V3(-20, 0, -48)];
      const gPL = A.section("p-Linac (proton injector; under construction)", "lin", pl, 4);
      { ghostPipe(pl, gPL); ghostTunnel(pl, 6, gPL, false); for (let k = 0; k < 5; k++) { const t = A.cyl(0.9, 6, G.ghostMag, 18); A.orientTo(t, pl[0].clone().lerp(pl[1], (k + 0.5) / 5), pl[1].clone().sub(pl[0]).normalize()); t.rotateX(Math.PI / 2); gPL.add(t); } }

      // the FAIR construction site: a darker ground patch under the new machines
      {
        floorSlab(110, -270, 520, 600, gS100, G.ghostFloor);
        dashed([V3(110, 0, -270), V3(520, 0, -270), V3(520, 0, 600), V3(110, 0, 600)], gS100, FLOOR + 0.3, true);
      }

      A.shadowArea(110, 160, 420);
      // ---------- beams: operating GSI only (FAIR carries no beam yet). Display speeds.
      const amber = [1.0, 0.72, 0.32], bright = [1.0, 0.9, 0.6], blue = [0.66, 0.8, 0.95];
      const srcLine = A.join(sourcePaths[0], [V3(-104, 0, ZU)], TK);
      const s18loop = ring18c;
      const esrLoop = esrc;
      const junctions = { injection: inj18, extraction: ext18, target: TA, frsS4: S.S4.p, esrFeed: esrBranch[esrBranch.length - 1], caveC: caveLine[caveLine.length - 1] };
      gS18.userData.junctions = junctions;
      const beams = [
        { pts: srcLine, n: 34, speed: 0.05, color: amber, size: 0.9 },
        { pts: s18loop, n: 30, speed: 0.12, color: bright, size: 1.0 },
        { pts: [...extr], n: 6, speed: 0.15, color: bright, size: 1.0 },
        { pts: [...frs.pts, ...caveLine.slice(1)], n: 26, speed: 0.08, color: blue, size: 0.9 },
        { pts: esrBranch, n: 8, speed: 0.12, color: blue, size: 0.85 },
        { pts: esrLoop, n: 22, speed: 0.12, color: blue, size: 0.85 },
        { pts: cryc, n: 10, speed: 0.12, color: blue, size: 0.8 },
        { pts: hhtLine, n: 8, speed: 0.1, color: bright, size: 0.95 },
      ];

      const note = `<b>GSI and FAIR, Darmstadt.</b> Solid hardware is the operating GSI complex; translucent hardware with orange dashed outlines is FAIR, under construction or planned (no beam is shown there). `
        + `<b>To scale:</b> UNILAC 120 m [1], SIS18 circumference 216.72 m with 12 cells of two dipoles each, 18 Tm [1, 4], FRS dipoles of 30&deg; and &rho; = 11.25 m, B&rho; up to 18 Tm [3], ESR 108.36 m with six 60&deg; dipoles, 10 Tm [5, 19], CRYRING@ESR 54.17 m [6], SIS100 1083.6 m (stated as 1083 to 1100 m) with 108 dipoles, 100 Tm [11, 13], CR 221.5 m, 13 Tm [14], HESR 575 m with two 132 m straights [15]. `
        + `<b>Schematic:</b> the site plan is placed by eye from published layout sketches [7, 8, 12], so distances between machines are approximate; the finite SIS18 bend radius and its injection/extraction-port positions; the FRS path from target to S4 (built from its dipole data, about 75 m; the real FRS measures 96.7 m to the ESR injection septum [19]) and the ESR racetrack radius; the UNILAC tank split and the HSI and HLI layout [2]; the positions of Caves A, B, M and C inside the target hall (the FRS feeds them through its switch dipoles [3]); dipole and quadrupole counts of CRYRING, CR, HESR and the HEBT lines; SIS100 is drawn as a rounded hexagon after the layout plans and at beam level, while its tunnel floor lies up to 17 m below ground [11]; the Super-FRS lengths (about 100 m pre-separator, 250 m main separator) are read from the cryogenic layout [12]; the p-Linac length is not known to me. `
        + `<b>Generic shapes:</b> ion-source terminals, gas stripper, HITRAP, the ESR electron cooler and gas-jet target, GLAD, CALIFA and NeuLAND in Cave C (R3B; GLAD moved there in 2016, NeuLAND 19 m&sup3; [9, 10]), HHT and the PHELIX laser line to HHT and Z6 [8], and the CBM, APPA, PANDA and R3B shapes at FAIR. `
        + `<b>Status:</b> beam commissioning SIS18 to Super-FRS in the second half of 2027, Early Science with the Super-FRS main branch and the NUSTAR High-Energy Branch in 2028, SIS100 and CBM from late 2028; CR and HESR are later stages [12, 18]. A fire on 5 February 2026 damaged equipment around the UNILAC [20]; its effect on operation is not shown. `
        + `<br><b>Sources.</b> [1] FAIR, "The accelerator facility of FAIR and GSI", fair-center.eu/overview/accelerator. `
        + `[2] W. Barth et al., "Heavy ion linac as a high current proton beam injector", Phys. Rev. ST Accel. Beams 18, 050102 (2015) (HSI, gas stripper, five Alvarez tanks, ten single-gap resonators, transfer channel). `
        + `[3] H. Weick, "FRS ion optics" manual, web-docs.gsi.de/~weick/frs (2020). `
        + `[4] SIS18 lattice: arXiv:2301.04914 (12-fold lattice, 216.72 m, two dipoles per cell); GSI, "Accelerator facility" pages, gsi.de. `
        + `[5] M. Steck and Yu. A. Litvinov, "Heavy-ion storage rings and their use in precision experiments with highly charged ions", Prog. Part. Nucl. Phys. 115, 103811 (2020), arXiv:2003.05201. `
        + `[6] M. Lestinsky et al., "Physics book: CRYRING@ESR", Eur. Phys. J. ST 225, 797 (2016). `
        + `[7] M. Durante et al., "All the fun of the FAIR", Phys. Scr. 94, 033001 (2019), arXiv:1903.05693, Fig. 1. `
        + `[8] Zs. Major et al., "High-energy laser facility PHELIX at GSI: latest advances and extended capabilities", High Power Laser Sci. Eng. 12, e39 (2024), Figs. 1 and 2. `
        + `[9] GSI, "GLAD" and "R3B" pages, gsi.de (GLAD in Cave C since February 2016). `
        + `[10] R3B collaboration, NeuLAND and CALIFA descriptions (GSI repository, PHN-ENNA-EXP-57). `
        + `[11] FAIR accelerator page [1] (SIS100 1,100 m, tunnel floor down to 17 m); CERN Courier, "FAIR builds future for ion and antiproton research" (SIS100 1083 m, 108 dipoles, 100 Tm). `
        + `[12] S. Reimann et al., "FAIR commissioning: towards first science", arXiv:2510.14948 (2025), Figs. 1, 2, 5. `
        + `[13] P. Spiller et al., "The FAIR heavy ion synchrotron SIS100", JINST 15, T12013 (2020). `
        + `[14] S. Litvinov, D. Toprek, H. Weick, A. Dolinskii, "Isochronicity correction in the CR storage ring", Nucl. Instrum. Methods A 724, 20 (2013), arXiv:1303.1020. `
        + `[15] "Ion optics of the HESR storage ring at FAIR for operation with heavy ions", Proc. IPAC2014, TUPRO042. `
        + `[16] Super-FRS at 20 Tm, three branches (High-Energy, Low-Energy, Ring) [7]. `
        + `[17] Durante et al. [7], Sec. on NUSTAR, Fig. 8. `
        + `[18] Steck and Litvinov [5], Sec. 5 (CR and HESR in the Modularized Start Version). `
        + `[19] S. A. Litvinov, PhD thesis, Univ. Giessen (2008), Fig. 3.1 (FRS 96.7 m to the ESR injection septum, ESR 108.4 m). `
        + `[20] "Facility for Antiproton and Ion Research", Wikipedia (accessed October 2026).`;

      return {
        fog: [520, 1700], // the site is about 800 m across: keep the far end of FAIR out of the fog
        view: { target: [140, 0, 130], pos: [-300, 470, 680] },
        beams,
        note,
      };
    },
  };
})();
