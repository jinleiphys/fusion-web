/* nuclearjs: shared rendering helpers for the hardware-and-materials pages (telescope, fission, shells).
   No physics here. Load after three-bundle.js and three-post.js; defines window.HW.
   - HW.rng(seed): deterministic PRNG, so every screenshot is the same scene
   - HW.canvasTex(w, h, draw, repeat, srgb): a procedural texture from a 2D canvas drawing
   - HW.studioEnv(renderer, opt): a PMREM environment from a procedural studio (dark room, soft panels)
   - HW.post(renderer, scene, camera, opt): render, ambient occlusion, bloom, output, SMAA
   - HW.mergeByMaterial(root): merge the static meshes under root into one mesh per material */
"use strict";
(function () {
  const HW = {};

  HW.rng = function (seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  };

  HW.canvasTex = function (w, h, draw, repeat, srgb) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // A photographic studio as seen from its centre: near-black walls, one large overhead softbox (the
  // key), two tall strip boxes left and right, a warm low kicker and a faint floor bounce. The panels
  // are emissive meshes brighter than 1, so the reflections on metal and glass are soft rectangles,
  // not the bare-bulb glare of a room with point lights.
  HW.studioEnv = function (renderer, opt) {
    opt = opt || {};
    const k = opt.intensity || 1, blur = opt.blur == null ? 0.035 : opt.blur;
    const s = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40),
      new THREE.MeshBasicMaterial({ color: opt.wall || new THREE.Color(0.018, 0.02, 0.026), side: THREE.BackSide }));
    room.position.y = 6;
    s.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: opt.floor || new THREE.Color(0.035, 0.034, 0.033) }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3.9;
    s.add(floor);
    const panel = (w, h, pos, look, col, gain) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(gain * k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(...look); s.add(m);
      return m;
    };
    panel(14, 9, [0, 15.5, 0], [0, 0, 0], "#fff6ea", 3.2);          // overhead key softbox
    panel(2.4, 14, [-18, 5, 4], [0, 3, 0], "#e8efff", 2.4);         // strip left
    panel(2.4, 14, [18, 5, -3], [0, 3, 0], "#eef3ff", 1.7);         // strip right
    panel(9, 3, [6, 1, -18], [0, 2, 0], "#ffd6a8", 1.2);            // warm kicker behind
    panel(10, 6, [-5, 6, 18], [0, 3, 0], "#cfdcff", 0.7);           // weak front fill
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(s, blur).texture;
    pm.dispose();
    s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return tex;
  };

  // composer: scene, then ground-truth ambient occlusion on the solid geometry, then bloom, ACES
  // output and SMAA. Objects with userData.noAO, transparent materials, points and lines are kept out
  // of the occlusion buffers (they would darken what is behind them).
  HW.post = function (renderer, scene, camera, opt) {
    opt = opt || {};
    const W = innerWidth, H = innerHeight;
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    let gtao = null;
    if (opt.ao !== false) {
      gtao = new GTAOPass(scene, camera, W, H);
      const ov = gtao.overrideVisibility.bind(gtao);
      gtao.overrideVisibility = function () {
        ov();
        scene.traverse((o) => {
          if (!o.visible) return;
          if (o.userData.noAO || (o.material && !Array.isArray(o.material) && (o.material.transparent || o.material.isShaderMaterial))) o.visible = false;
        });
      };
      gtao.updateGtaoMaterial(Object.assign({ radius: 1, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 }, opt.ao || {}));
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      gtao.blendIntensity = opt.aoIntensity == null ? 1 : opt.aoIntensity;
      composer.addPass(gtao);
    }
    const b = opt.bloom || [0.35, 0.4, 0.9];
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), b[0], b[1], b[2]);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const pr = renderer.getPixelRatio();
    const smaa = new SMAAPass(W * pr, H * pr);
    composer.addPass(smaa);
    return { composer, gtao, bloom, smaa };
  };

  // merge every static mesh under root (world transforms baked) into one mesh per material
  HW.mergeByMaterial = function (root, opt) {
    opt = opt || {};
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map(), drop = [];
    root.traverse((m) => {
      if (!m.isMesh || m === root || m.userData.keep) return;
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(2 * g.attributes.position.count), 2));
      g.morphAttributes = {};
      g.clearGroups();
      if (!groups.has(m.material)) groups.set(m.material, { list: [], cast: false, recv: false });
      const e = groups.get(m.material);
      e.list.push(g); e.cast = e.cast || m.castShadow; e.recv = e.recv || m.receiveShadow;
      drop.push(m);
    });
    for (const m of drop) { m.parent.remove(m); m.geometry.dispose(); }
    const out = [];
    for (const [mat, e] of groups) {
      const geo = BufferGeometryUtils.mergeGeometries(e.list, false);
      for (const g of e.list) g.dispose();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = opt.cast != null ? opt.cast : e.cast;
      mesh.receiveShadow = opt.recv != null ? opt.recv : e.recv;
      root.add(mesh); out.push(mesh);
    }
    return out;
  };

  window.HW = HW;
})();
