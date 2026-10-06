/* Shared stage for the waves-and-landscapes pages (scatter.html, alpha.html).
   A procedural studio: one analytic sky function (dark gradient dome with three soft area
   panels) used twice, as GLSL in custom shaders and as the source scene of a PMREM environment,
   so that the reflections drawn by hand and the ones the PBR materials take from
   scene.environment show the same panels. Plus a key/fill/rim light rig placed on those panels,
   a floor that fades into the page ground, a contact shadow, procedural canvas textures and the
   post chain (ambient occlusion, bloom, output, SMAA). Nothing here is physics: it is lighting.
   Load after three-bundle.js and three-post.js. */
(function () {
  "use strict";
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const g3 = (v) => `vec3(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;

  // the sky, parameterised by the key direction (a page puts its key where the camera wants it)
  function skyGLSL(key, opt) {
    key = key.clone().normalize();
    opt = opt || {};
    // default rim panel: low and opposite the key in azimuth; fill: low, a quarter turn from the key
    const az = Math.atan2(key.z, key.x);
    const rim = opt.rim ? opt.rim.clone().normalize() : V3(Math.cos(az + Math.PI * 0.92), 0.32, Math.sin(az + Math.PI * 0.92));
    const fill = opt.fill ? opt.fill.clone().normalize() : V3(Math.cos(az - Math.PI * 0.55), 0.22, Math.sin(az - Math.PI * 0.55));
    return {
      key, rim, fill,
      glsl: `
      float wsPanel(vec3 d, vec3 c, vec2 size, float soft){
        vec3 up = abs(c.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 u = normalize(cross(up, c)), v = cross(c, u);
        float t = dot(d, c);
        if (t <= 0.0) return 0.0;
        vec2 q = abs(vec2(dot(d, u), dot(d, v)) / t) / size;
        return 1.0 - smoothstep(1.0 - soft, 1.0, max(q.x, q.y));
      }
      vec3 studioSky(vec3 d){
        d = normalize(d);
        vec3 col = mix(vec3(0.012, 0.013, 0.017), vec3(0.034, 0.040, 0.056), smoothstep(-0.05, 0.95, d.y));
        col = mix(vec3(0.005, 0.0052, 0.006), col, smoothstep(-0.30, 0.02, d.y));
        col += vec3(5.2, 4.95, 4.6) * wsPanel(d, ${g3(key)}, vec2(0.42, 0.26), 0.55);
        col += vec3(1.25, 1.45, 1.85) * wsPanel(d, ${g3(rim)}, vec2(0.95, 0.07), 0.6);
        col += vec3(0.30, 0.24, 0.19) * wsPanel(d, ${g3(fill)}, vec2(0.30, 0.30), 0.8);
        return col;
      }`,
    };
  }

  // PMREM of the same sky: the environment every PBR material on these pages reflects
  function environment(renderer, sky) {
    const s = new THREE.Scene();
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vD; ${sky.glsl} void main(){ gl_FragColor = vec4(studioSky(vD), 1.0); }`,
    });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), m));
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(s, 0.015).texture;
    pm.dispose(); m.dispose();
    return tex;
  }

  // key (shadow casting in cinematic mode), fill and rim, on the panels of the sky
  function rig(scene, sky, dist, shadowHalf) {
    const key = new THREE.DirectionalLight("#fff4e6", 1.9);
    key.position.copy(sky.key).multiplyScalar(dist);
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = c.bottom = -shadowHalf; c.right = c.top = shadowHalf; c.near = dist * 0.2; c.far = dist * 2.5;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04; key.shadow.radius = 5;
    const fill = new THREE.DirectionalLight("#ffd9b8", 0.35);
    fill.position.copy(sky.fill).multiplyScalar(dist);
    const rim = new THREE.DirectionalLight("#bcd4ff", 0.9);
    rim.position.copy(sky.rim).multiplyScalar(dist);
    const hemi = new THREE.HemisphereLight("#b8c6e8", "#14110e", 0.25);
    scene.add(key, key.target, fill, rim, hemi);
    return { key, fill, rim, hemi };
  }

  function canvas(n) { const c = document.createElement("canvas"); c.width = c.height = n; return [c, c.getContext("2d")]; }

  // a radial alpha ramp: floor fade and contact shadow
  function radialTexture(stops) {
    const [c, x] = canvas(256);
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    // alphaMap reads the green channel: grey levels on an opaque canvas, not canvas alpha
    for (const [t, a] of stops) { const v = Math.round(255 * a); g.addColorStop(t, `rgb(${v},${v},${v})`); }
    x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  // value noise in a canvas: roughness and bump variation for ceramic and stone
  function noiseTexture(n, cells, lo, hi, seed) {
    const [c, x] = canvas(n);
    let s = seed || 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const img = x.createImageData(n, n), G = [];
    const oct = [[cells, 0.55], [cells * 2, 0.27], [cells * 4, 0.12], [cells * 8, 0.06]];
    for (const [k] of oct) { const a = []; for (let i = 0; i < k * k; i++) a.push(rnd()); G.push(a); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let v = 0;
      oct.forEach(([k, w], o) => {
        const fx = i / n * k, fy = j / n * k, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const at = (a, b) => G[o][((b % k) + k) % k * k + ((a % k) + k) % k];
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        v += w * ((at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy);
      });
      const q = Math.round(255 * (lo + (hi - lo) * v)), p = 4 * (j * n + i);
      img.data[p] = img.data[p + 1] = img.data[p + 2] = q; img.data[p + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // concentric fine streaks: lathe-turned (brushed) metal, for round plinths seen from above
  function turnedTexture() {
    const [c, x] = canvas(512);
    x.fillStyle = "#808080"; x.fillRect(0, 0, 512, 512);
    let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const r = rnd() * 256, v = Math.round(100 + 70 * rnd());
      x.strokeStyle = `rgba(${v},${v},${v},0.35)`; x.lineWidth = 0.6 + rnd();
      x.beginPath(); x.arc(256, 256, r, 0, 2 * Math.PI); x.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  // the floor: page-ground coloured, faded to transparent so it melts into the background; the
  // contact shadow is a soft dark disc right under the object (both modes; it costs nothing)
  function floor(radius, y, contactR, contactA) {
    const g = new THREE.Group();
    const fm = new THREE.MeshStandardMaterial({
      color: "#07080b", roughness: 0.95, metalness: 0.0, envMapIntensity: 0.06, transparent: true, depthWrite: false,
      alphaMap: radialTexture([[0, 1], [0.3, 0.85], [0.65, 0.2], [1, 0]]),
      roughnessMap: noiseTexture(256, 6, 0.7, 1.0, 3),
    });
    const f = new THREE.Mesh(new THREE.CircleGeometry(radius, 96).rotateX(-Math.PI / 2), fm);
    f.position.y = y; f.receiveShadow = true; f.renderOrder = -2; f.userData.noAO = true;
    const cm = new THREE.MeshBasicMaterial({
      color: "#000000", transparent: true, depthWrite: false, opacity: contactA,
      alphaMap: radialTexture([[0, 1], [0.55, 0.75], [0.8, 0.25], [1, 0]]),
    });
    const cs = new THREE.Mesh(new THREE.CircleGeometry(contactR, 64).rotateX(-Math.PI / 2), cm);
    cs.position.y = y + 0.02; cs.renderOrder = -1; cs.userData.noAO = true;
    g.add(f, cs);
    return g;
  }

  // post chain for cinematic mode: GTAO on the solid geometry only (transparent and flagged
  // objects are hidden from its normal/depth buffer), restrained bloom, output, SMAA
  function post(renderer, scene, camera, bloomArgs, aoArgs) {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const pr = renderer.getPixelRatio();
    const ao = new GTAOPass(scene, camera, innerWidth * pr, innerHeight * pr);
    ao.blendIntensity = aoArgs.intensity;
    ao.updateGtaoMaterial({ radius: aoArgs.radius, distanceExponent: 1.5, thickness: aoArgs.thickness || 1, scale: 1, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    const ov = ao.overrideVisibility.bind(ao);
    ao.overrideVisibility = function () {
      ov();
      scene.traverse((o) => { if (o.visible && (o.userData.noAO || (o.material && o.material.transparent))) o.visible = false; });
    };
    if (aoArgs.patch) aoArgs.patch(ao.normalMaterial);
    composer.addPass(ao);
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), bloomArgs[0], bloomArgs[1], bloomArgs[2]);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const smaa = new SMAAPass(innerWidth * pr, innerHeight * pr);
    composer.addPass(smaa);
    return { composer, ao, bloom, smaa };
  }

  window.WaveStage = { skyGLSL, environment, rig, radialTexture, noiseTexture, turnedTexture, floor, post };
})();
