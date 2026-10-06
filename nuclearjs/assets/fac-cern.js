/* CERN ISOLDE / HIE-ISOLDE. Metres, beam plane y=0. Transport topology and equipment counts
   follow CERN sources; hall dimensions, service hardware and equipment envelopes are schematic. */
(function () {
  window.FACILITY_MODULES = window.FACILITY_MODULES || {};
  window.FACILITY_MODULES.cern = {
    label: "CERN ISOLDE",
    build(A) {
      const { THREE, V3, M, FLOOR, isolde: D } = A;
      const blue = new THREE.MeshStandardMaterial({ color: "#285f93", metalness: .08, roughness: .65, envMapIntensity: .4 });
      const silver = new THREE.MeshStandardMaterial({ color: "#a1aba9", metalness: .55, roughness: .5, envMapIntensity: .4 });
      const cream = new THREE.MeshStandardMaterial({ color: "#a9b1aa", metalness: .02, roughness: .8, envMapIntensity: .25 });
      const beams = [], defs = [
        ["GPS / HRS: target and mass separators", "GPS / HRS", [-65, -12], [-43, 8],
          "Two independent target-ion-source and mass-separator systems feed a common low-energy distribution network. The PS Booster proton driver produces radioactive nuclei in thick targets; this is ISOL production, not an in-flight fragment separator.", [["extracted ions", `${D.lowEnergyKeV.join("–")} keV total energy per ion`], ["driver", "PSB protons, 1.4 GeV (2 GeV planned; CERN facility page)"]], D.lowSource],
        ["Low-energy experimental area", "low energy", [-42, -23], [2, -8],
          "Direct, singly charged radioactive-ion beams serve precision mass measurements (ISOLTRAP), collinear laser spectroscopy (COLLAPS / CRIS), and decay spectroscopy (IDS). Selected representative instruments are shown; their positions are schematic.", [["beam energy", `${D.lowEnergyKeV.join("–")} keV per ion, not per nucleon`], ["ISOLTRAP", "RFQ cooling, MR-ToF separation and Penning traps"]], D.experiments],
        ["REXTRAP / EBIS / REX-ISOLDE", "REX", [-42, -3], [-18, 3],
          "REXTRAP accumulates and bunches the low-energy ions. EBIS breeds higher charge states before the normal-conducting REX linac injects into HIE-ISOLDE. Direct low-energy experiments bypass this chain.", [["process", "trap → charge breeder → RFQ / IH linac"]], "https://isolde.cern/rex-isolde"],
        ["HIE-ISOLDE superconducting linac", "HIE linac", [-17, -3], [5, 4],
          "Four installed high-beta cryomodules, each with five niobium-coated copper quarter-wave resonators and one superconducting solenoid. The two proposed low-beta modules are not drawn as installed equipment.", [["installed", `${D.cryomodules} modules / ${D.cryomodules * D.cavitiesPerModule} QWR cavities`], ["RF", `${D.cavityRF_MHz} MHz (REX/HIE technical paper)`], ["helium bath", `${D.operatingK} K`], ["post-accelerated beams", `up to about ${D.maxPostEnergyMeVu} MeV/u; ion and charge dependent`]], D.source],
        ["XT01: MINIBALL", "MINIBALL", [10, 16], [19, 27],
          "Gamma spectroscopy following Coulomb excitation and transfer reactions. Eight triple-crystal clusters surround the target; the cryostats, supports and target chamber are drawn schematically.", [["HPGe crystals", `${D.miniballCrystals}, each six-fold segmented`], ["beam line", "XT01"]], D.experiments],
        ["XT02: ISOLDE Solenoidal Spectrometer", "ISS", [20, 16], [29, 27],
          "A former MRI magnet implements the HELIOS concept: light reaction particles follow helical trajectories to silicon detectors along the solenoid axis. The radioactive beam passes through the central bore to the target.", [["solenoid", `rated ${D.issFieldT} T`], ["silicon array", `${D.issDetectors} double-sided strip detectors`], ["beam line", "XT02"]], D.experiments],
        ["XT03: Scattering Experiments Chamber", "SEC", [30, 16], [39, 27],
          "A general-purpose reaction chamber for interchangeable charged-particle and gamma detectors. The internal mounting disc is shown in cutaway; this terminal can accommodate visiting setups.", [["beam line", "XT03"], ["mounting disc radius", "0.50 m"]], D.experiments],
      ];
      const groups = defs.map(([name, shortName, a, b, text, rows, source]) => {
        const g = A.section(name, "end", [V3(a[0], 0, a[1]), V3(b[0], 0, b[1])], .6);
        Object.assign(g.userData, { shortName, info: `<p class="sub">${text}</p><dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl><p class="sub">Equipment envelopes and spacing are schematic. <a href="${source}" target="_blank" rel="noopener">CERN source</a>.</p>` });
        return g;
      });
      const [gSep, gLow, gRex, gHie] = groups;
      gSep.add(A.box(110, .3, 56, M.floor, -12, FLOOR - .15, 0));
      A.wall(V3(-68, 0, -27), V3(43, 0, -27), 5.2, .5, gSep);
      A.wall(V3(-68, 0, -27), V3(-68, 0, 28), 5.2, .5, gSep);
      A.lamps(V3(-63, 0, -25), V3(38, 0, -25), gSep, 10);

      // GPS and HRS are independent sources. Both join the same distribution node.
      for (const z of [-7, 7]) {
        gSep.add(A.box(4, 2.8, 3.4, M.shield, -63, FLOOR + 1.4, z));
        const p = [V3(-61, 0, z), V3(-57, 0, z), ...A.bez(V3(-57, 0, z), V3(-53, 0, z), V3(-50, 0, 0), V3(-47, 0, 0), 24).slice(1), V3(-39, 0, 0)];
        const path = new A.Path(p); A.pipe(p, gSep, .07);
        A.placeAlong(A.dipole(1.4), path, 6, gSep); A.placeAlong(A.diag(), path, 12, gSep);
        beams.push({ pts: p, n: 12, speed: .06, color: [.70, .84, 1] });
      }
      const lowTrunk = [V3(-39, 0, 0), V3(-39, 0, -16), V3(-3, 0, -16)];
      A.pipe(lowTrunk, gLow, .06);
      for (const [x, name] of [[-32, "ISOLTRAP"], [-19, "COLLAPS / CRIS"], [-6, "IDS"]]) {
        const p = [V3(x, 0, -16), V3(x, 0, -22)]; A.pipe(p, gLow, .06);
        if (name === "ISOLTRAP") {
          for (const dx of [-.65, .65]) { const m = A.cyl(.45, 2.7, cream, 28); m.position.set(x + dx, .6, -22); gLow.add(m); }
        } else if (name.startsWith("COLLAPS")) {
          gLow.add(A.box(7, .15, 2, M.steelDark, x, FLOOR + 1.1, -21));
          for (let dx = -2.8; dx <= 2.8; dx += .7) { const c = A.cyl(.16, .5, silver, 16); c.rotation.z = Math.PI / 2; c.position.set(x + dx, 0, -21); gLow.add(c); }
        } else {
          const chamber = A.cyl(.4, .6, silver); chamber.position.set(x, 0, -22); gLow.add(chamber);
          for (let i = 0; i < 4; i++) { const a=i*Math.PI/2; gLow.add(A.box(.35,.5,.6,blue,x+.75*Math.cos(a),.2,-22+.75*Math.sin(a))); }
        }
        gLow.add(A.box(.8, 1.8, .8, M.rack, x + 2, FLOOR + .9, -22));
        beams.push({ pts: A.join(lowTrunk.slice(0, 2), [V3(x, 0, -16)], p), n: 10, speed: .04, color: [.70, .84, 1] });
      }
      const rex = [V3(-39, 0, 0), V3(-17, 0, 0)]; A.pipe(rex, gRex, .065);
      for (const [x, r, len] of [[-36,.45,2],[-32,.7,3.5],[-27,.36,3],[-22,.6,3.7]]) {
        const c=A.cyl(r,len,silver,28); c.rotation.z=Math.PI/2; c.position.set(x,0,0); gRex.add(c);
        gRex.add(A.box(len*.7,.12,1.5,M.steelDark,x,-.85,0));
        for (const dx of [-len*.3,len*.3]) gRex.add(A.box(.15,.5,.9,M.steelDark,x+dx,FLOOR+.25,0));
      }
      const hie = [V3(-17,0,0), V3(8,0,0)]; A.pipe(hie,gHie,.075);
      for (let k=0;k<D.cryomodules;k++) {
        const x=-14+k*5; const mod=new THREE.Group();
        mod.userData.hieModule=true; mod.userData.cavities=D.cavitiesPerModule;
        mod.add(A.rbox(4,2.25,1.8,.06,blue,x,.35,0));
        for (const y of [-.3,.85,1.5]) mod.add(A.box(4.12,.12,1.9,silver,x,y,0));
        for (const dx of [-1.45,1.45]) { mod.add(A.box(.18,.7,1.6,M.steelDark,x+dx,FLOOR+.35,0)); }
        for (let j=0;j<D.cavitiesPerModule;j++) {
          const xx=x-1.45+j*.72, stem=A.cyl(.12,.6,silver,16); stem.position.set(xx,1.85,0);mod.add(stem);
          const cap=A.cyl(.19,.1,M.steelDark,16);cap.position.set(xx,2.15,0);mod.add(cap);
          mod.add(new THREE.Mesh(A.gHose([[xx,2.1,0],[xx,2.4,.6],[xx,1.1,1.15],[xx,FLOOR+.15,1.3]],.025,12),M.cable));
          for(const z of [-.97,.97]) {const b=A.cyl(.035,.04,M.steel,6);b.rotation.x=Math.PI/2;b.position.set(xx,1.1,z);mod.add(b);}
        }
        gHie.add(mod);
      }
      beams.push({pts:A.join(rex,hie),n:32,speed:.11,color:[1,.77,.36]});

      // Identical achromatic 90-degree HEBT bends, represented by two 45-degree dipoles.
      for(let i=0;i<3;i++) {
        const g=groups[4+i], tap=12+i*10, x=tap+2.5, z=22;
        const bend=A.arc(V3(tap,0,2.5),2.5,-Math.PI/2,0,24);
        const p=A.join([V3(8,0,0),V3(tap,0,0)],bend,[V3(x,0,z)]), path=new A.Path(p);
        A.pipe(p,g,.075); g.userData.endpoint=V3(x,0,z);g.userData.route=p;
        const start=tap-8;
        for(const f of [.25,.75]) A.placeAlong(A.dipole(2.5*Math.PI/4,{bend:-Math.PI/4,mat:blue}),path,start+f*2.5*Math.PI/2,g);
        for(const dz of [-6,-4.8,-3.6]) A.placeAlong(A.quad(.55),path,path.L+dz,g);
        A.placeAlong(A.diag(),path,path.L-8,g);
        g.add(A.box(3,.14,4,M.steelDark,x,FLOOR+.65,z));
        for(const dx of [-1,1]) for(const dz of [-1.4,1.4]) g.add(A.box(.14,.65,.14,M.steelDark,x+dx,FLOOR+.325,z+dz));
        if(i===0) {
          const target=A.cyl(.26,.7,silver,24);target.position.set(x,0,z);g.add(target);
          for (const dz of [-.7,.7]) {
            const arm = new THREE.Mesh(new THREE.TorusGeometry(1.1,.045,8,48,Math.PI*1.7),M.steelDark);
            arm.position.set(x,0,z+dz); g.add(arm);
            for (const dx of [-1.15,1.15]) g.add(A.box(.10,.7,.10,silver,x+dx,-.9,z+dz));
          }
          for(let k=0;k<8;k++) {
            const a=k*Math.PI/4, c=V3(x+.85*Math.cos(a),.3*Math.sin(a),z+.85*Math.sin(a));
            const cluster=new THREE.Group();cluster.userData.hpgeCrystals=3;
            for(const dx of [-.12,0,.12]) {const can=A.cyl(.105,.42,silver,16);can.rotation.x=Math.PI/2;can.position.set(dx,0,0);cluster.add(can);}
            const dewar=A.cyl(.18,.5,cream,20);dewar.position.set(0,.35,.3);cluster.add(dewar);
            A.orientTo(cluster,c,c.clone().sub(V3(x,0,z)).normalize());g.add(cluster);
          }
        } else if(i===1) {
          const body=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,2.8,48,1,true),cream);body.rotation.x=Math.PI/2;body.position.set(x,0,z);g.add(body);
          for(const dz of [-1.4,1.4]) {
            const face=new THREE.Mesh(new THREE.RingGeometry(.42,1.4,48),cream);face.position.set(x,0,z+dz);g.add(face);
            const rim=new THREE.Mesh(new THREE.TorusGeometry(.44,.045,8,40),silver);rim.position.set(x,0,z+dz);g.add(rim);
          }
          const liner=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,2.8,32,1,true),M.steelDark);liner.rotation.x=Math.PI/2;liner.position.set(x,0,z);g.add(liner);
          for (const dz of [-1.28,1.28]) for (let k=0;k<12;k++) {
            const a=k*Math.PI/6,b=A.cyl(.035,.05,M.steelDark,6); b.rotation.x=Math.PI/2;
            b.position.set(x+1.22*Math.cos(a),1.22*Math.sin(a),z+dz);g.add(b);
          }
          for (const dz of [-.7,.7]) { const band=new THREE.Mesh(new THREE.TorusGeometry(1.41,.035,8,48),silver);band.position.set(x,0,z+dz);g.add(band); }
          const tower=A.cyl(.15,1,silver,18);tower.position.set(x,1.9,z);g.add(tower);
        } else {
          const chamber=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,.7,40,1,true,0,Math.PI*1.5),silver);chamber.position.set(x,0,z);g.add(chamber);
          const disc=A.cyl(.5,.035,M.steelDark,40);disc.position.set(x,-.22,z);g.add(disc);
          for(let k=0;k<8;k++){const a=k*Math.PI/4;g.add(A.box(.13,.2,.03,blue,x+.4*Math.cos(a),-.08,z+.4*Math.sin(a)));}
          for(const yy of [-.38,.38]){const rim=new THREE.Mesh(new THREE.TorusGeometry(.82,.05,8,40),silver);rim.rotation.x=Math.PI/2;rim.position.set(x,yy,z);g.add(rim);}
        }
        for(const dx of [2,3])g.add(A.box(.7,1.9,.85,M.rack,x+dx,FLOOR+.95,z+1));
        g.add(A.person(.4).translateX(x-2).translateZ(z+2));
        beams.push({pts:p,n:18,speed:.10,color:[1,.77,.36]});
      }
      A.shadowArea(-12,0,65);
      return {view:{target:[-10,0,0],pos:[55,85,93]},beams,
        note:`<b>CERN ISOLDE / HIE-ISOLDE.</b> Direct 30–60 keV radioactive-ion beams and the REX/HIE post-acceleration chain are drawn as separate routes. Four installed high-beta modules feed XT01 MINIBALL, XT02 ISS and XT03 SEC. Blue cryomodule paint follows CERN's HIE layout image. <b>Schematic:</b> hall footprint, instrument envelopes, low-energy station positions, separator magnet shapes and service hardware. No future low-beta modules are shown as installed. Click a section for its published parameters. Sources: <a href="https://isolde-drupal10.web.cern.ch/euro-labs-financial-support" target="_blank" rel="noopener">30–60 keV beam range</a>, <a href="${D.lowSource}" target="_blank" rel="noopener">targets and separators</a>, <a href="${D.source}" target="_blank" rel="noopener">HIE technical description</a>, <a href="${D.experiments}" target="_blank" rel="noopener">experimental setups</a>, <a href="https://cds.cern.ch/record/2288261/files/tuba01.pdf" target="_blank" rel="noopener">101.28 MHz technical paper</a>.`};
    }
  };
})();
