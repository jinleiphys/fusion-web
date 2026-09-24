/* ------------------------------------------------------------------ *
 * Nuclear-physics scenes for index.html, drawn with three.js.
 *
 * Every element with data-scene="<name>" gets its own small renderer,
 * created when it first comes near the viewport and paused whenever it
 * is off screen. The scenes are schematics, but the bookkeeping in them
 * is real: nuclei are packed from their actual Z and N at radius
 * 1.2 A^(1/3) fm, fission and capture conserve Z and A, and the 16O
 * shell diagram uses measured separation and excitation energies.
 *
 * Needs assets/three-bundle.js (THREE, RoomEnvironment) loaded first.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;
  var probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PROTON = new THREE.Color('#ff9656');
  var NEUTRON = new THREE.Color('#a8cdf2');
  var GOLD = new THREE.Color('#ffd27a');

  /* ---------------- helpers ---------------- */
  function rng(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
  function nuclearRadius(A) { return 1.2 * Math.cbrt(A); }

  /* Random sequential packing inside R = 1.2 A^(1/3) fm; Z of the A
     slots are protons, chosen at random. Returns {pos: Vector3[], proton: bool[], R, r}. */
  function pack(A, Z, seed) {
    var R = nuclearRadius(A), rand = rng(seed), pos = [];
    var d = 2 * R * Math.cbrt(0.3 / A);
    var tries = 0;
    while (pos.length < A) {
      var v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (v.lengthSq() > 1) continue;
      v.multiplyScalar(R - d * 0.35);
      var ok = true;
      for (var i = 0; i < pos.length; i++) if (pos[i].distanceToSquared(v) < d * d) { ok = false; break; }
      if (ok) { pos.push(v); tries = 0; } else if (++tries > 4000) { d *= 0.97; tries = 0; }
    }
    // relax: pairwise repulsion to an even spacing, confined to the sphere
    var s = 2 * R * Math.cbrt(0.62 / A), f = new THREE.Vector3();
    for (var it = 0; it < 70; it++) {
      for (var a = 0; a < A; a++) for (var b = a + 1; b < A; b++) {
        f.subVectors(pos[a], pos[b]);
        var l = f.length();
        if (l < s && l > 1e-6) { f.multiplyScalar((s - l) / l * 0.25); pos[a].add(f); pos[b].sub(f); }
      }
      for (var c = 0; c < A; c++) { var m = pos[c].length(), lim = R - s * 0.5; if (m > lim) pos[c].multiplyScalar(lim / m); }
    }
    d = s;
    // protons spread evenly (blue noise), not in random clumps
    var idx = pos.map(function (_, i) { return i; });
    for (var k = idx.length - 1; k > 0; k--) { var j = Math.floor(rand() * (k + 1)); var t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
    var proton = new Array(A).fill(false), chosen = [], gap = 2 * R * Math.cbrt(0.5 / Math.max(Z, 1));
    while (chosen.length < Z) {
      for (var q = 0; q < A && chosen.length < Z; q++) {
        var ci = idx[q];
        if (proton[ci]) continue;
        var far = true;
        for (var w = 0; w < chosen.length; w++) if (pos[chosen[w]].distanceTo(pos[ci]) < gap) { far = false; break; }
        if (far) { proton[ci] = true; chosen.push(ci); }
      }
      gap *= 0.9;
    }
    return { pos: pos, proton: proton, R: R, r: d * 0.56 };
  }

  var sphereGeo = new THREE.SphereGeometry(1, 28, 20);
  /* Nucleon shading: wrapped diffuse so the terminator is soft, a fresnel
     rim that makes each sphere read as slightly translucent, a small
     highlight, and depth darkening so nucleons at the back of the nucleus
     recede instead of competing with the front ones. */
  var NUCLEON_VS = [
    'uniform float depthScale; varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vD;',
    'void main() {',
    '  mat4 im = mat4(1.0);',
    '  #ifdef USE_INSTANCING', '  im = instanceMatrix;', '  #endif',
    '  vec4 mv = modelViewMatrix * im * vec4(position, 1.0);',
    '  vN = normalize(normalMatrix * mat3(im) * normal);',
    '  vV = normalize(-mv.xyz);',
    '  #ifdef USE_INSTANCING_COLOR', '  vC = instanceColor;', '  #else', '  vC = vec3(1.0);', '  #endif',
    '  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);',
    '  vD = (mv.z - c.z) * depthScale;',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var NUCLEON_FS = [
    'uniform vec3 L; varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vD;',
    'void main() {',
    '  vec3 n = normalize(vN), v = normalize(vV), l = normalize(L);',
    '  float wrap = clamp((dot(n, l) + 0.55) / 1.55, 0.0, 1.0);',
    '  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.4);',
    '  float spec = pow(max(dot(n, normalize(l + v)), 0.0), 60.0);',
    '  float depth = clamp(0.62 + 0.5 * vD, 0.22, 1.08);',
    '  vec3 col = vC * (0.16 + 0.84 * wrap * wrap) * depth;',
    '  col += mix(vC, vec3(1.0), 0.35) * fres * 0.55 * depth;',
    '  vec3 rimTone = mix(vec3(0.30, 0.66, 1.0), vec3(1.0, 0.72, 0.42), smoothstep(-0.35, 0.35, n.x));',
    '  col += rimTone * pow(fres, 1.6) * 0.55;',
    '  col += vec3(1.0, 0.97, 0.92) * spec * 0.45 * depth;',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '}'].join('\n');
  function nucleonMaterial(extent) {
    return new THREE.ShaderMaterial({
      uniforms: { L: { value: new THREE.Vector3(-0.55, 0.7, 0.65) }, depthScale: { value: 1 / Math.max(2, extent || 7) } },
      vertexShader: NUCLEON_VS, fragmentShader: NUCLEON_FS
    });
  }
  /* One InstancedMesh for a set of nucleons; set(i, position, scale) moves one. */
  function nucleons(count, radius, extent) {
    var mesh = new THREE.InstancedMesh(sphereGeo, nucleonMaterial(extent), count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    var m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion();
    mesh.userData.set = function (i, p, scale) {
      var k = radius * (scale === undefined ? 1 : scale);
      s.set(k, k, k); m.compose(p, q, s); mesh.setMatrixAt(i, m);
    };
    mesh.userData.color = function (i, isProton) { mesh.setColorAt(i, isProton ? PROTON : NEUTRON); };
    return mesh;
  }
  function commit(mesh) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // the panel background: deep blue at the centre falling off to near black
  var backdrop = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'), grd = g.createRadialGradient(128, 110, 0, 128, 128, 190);
    grd.addColorStop(0, '#12213a'); grd.addColorStop(0.55, '#0a1222'); grd.addColorStop(1, '#05080f');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  var glowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  function glow(color, size, opacity) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    s.scale.setScalar(size); return s;
  }
  /* A comet trail: glowing points that shrink and fade toward the tail,
     plus a faint core line so fast segments stay continuous. */
  var TRAIL_VS = 'attribute float a; uniform float size; varying float vA;' +
    ' void main(){ vA = a; vec4 mv = modelViewMatrix * vec4(position, 1.0);' +
    ' gl_PointSize = size * (0.25 + 0.75 * a) * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }';
  var TRAIL_FS = 'uniform sampler2D map; uniform vec3 color; uniform float opacity; varying float vA;' +
    '\nvoid main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color * t.a * vA * vA * opacity, 1.0);' +
    '\n#include <colorspace_fragment>\n}';
  function trail(n, color) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3), al = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('a', new THREE.BufferAttribute(al, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTex }, color: { value: new THREE.Color(color) }, size: { value: 2.6 }, opacity: { value: 1 } },
      vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    var lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', geo.attributes.position);
    var line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.frustumCulled = false; pts.add(line);
    var buf = [];
    pts.userData.opacity = function (v) { mat.uniforms.opacity.value = v; line.material.opacity = 0.5 * v; };
    pts.userData.push = function (p) { buf.push(p.clone()); if (buf.length > n) buf.shift(); draw(); };
    pts.userData.clear = function () { buf.length = 0; draw(); };
    function draw() {
      var m = buf.length;
      for (var i = 0; i < n; i++) {
        var p = buf[Math.min(i, m - 1)];
        if (p) { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; }
        al[i] = m && i < m ? Math.pow(i / Math.max(1, m - 1), 1.3) : 0;
      }
      lgeo.setDrawRange(0, m);
      geo.attributes.position.needsUpdate = true; geo.attributes.a.needsUpdate = true;
    }
    return pts;
  }
  /* A photon: a sine wave travelling along dir from origin, drawn as a line. */
  function photon(color) {
    var n = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.frustumCulled = false;
    var side = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
    line.userData.draw = function (origin, dir, head, len, opacity) {
      side.crossVectors(dir, up); if (side.lengthSq() < 1e-4) side.set(0, 1, 0); side.normalize();
      for (var i = 0; i < n; i++) {
        var f = i / (n - 1), s = Math.max(0, head - len * (1 - f));
        var amp = 0.55 * Math.sin(Math.PI * f);
        var w = Math.sin(s * 2.4) * amp;
        pos[i * 3] = origin.x + dir.x * s + side.x * w;
        pos[i * 3 + 1] = origin.y + dir.y * s + side.y * w;
        pos[i * 3 + 2] = origin.z + dir.z * s + side.z * w;
      }
      geo.attributes.position.needsUpdate = true;
      line.material.opacity = opacity;
    };
    return line;
  }
  function label(text, color, h) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), fs = 64;
    g.font = '500 ' + fs + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    var w = Math.ceil(g.measureText(text).width) + 16;
    c.width = w; c.height = fs + 20;
    g.font = '500 ' + fs + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 8, c.height / 2);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(h * c.width / c.height, h, 1);
    s.center.set(0, 0.5);
    return s;
  }
  function addNucleus(group, P, offset) {
    var mesh = nucleons(P.pos.length, P.r, P.R);
    for (var i = 0; i < P.pos.length; i++) {
      mesh.userData.set(i, offset ? P.pos[i].clone().add(offset) : P.pos[i]);
      mesh.userData.color(i, P.proton[i]);
    }
    commit(mesh); group.add(mesh); return mesh;
  }
  /* Coulomb step for a point charge outside a sphere of charge (arbitrary units). */
  function coulombStep(p, v, k, dt) {
    var r2 = Math.max(p.lengthSq(), 25), r = Math.sqrt(r2);
    v.addScaledVector(p, k * dt / (r2 * r));
    p.addScaledVector(v, dt);
  }

  /* ---------------- scenes ---------------- */
  var SCENES = {};

  /* d + 208Pb, seen from above the reaction plane. The sheet underneath
     is the potential a proton feels, V(r) = V_C(r) - V0 / (1 + exp((r - R)/a)),
     drawn as height: the nuclear well in the middle, the Coulomb barrier as
     the rim around it. The deuteron grazes the surface and breaks up; the
     neutron is absorbed (nonelastic breakup) and the proton is deflected by
     the Coulomb field and leaves. */
  SCENES.breakup = function (S) {
    var root = new THREE.Group(); S.scene.add(root);
    var Pb = pack(208, 82, 208), R = Pb.R;
    var target = new THREE.Group(); root.add(target);
    addNucleus(target, Pb);
    var halo = glow(0xffd9b0, R * 3.2, 0.14); root.add(halo);
    var flash = glow(0xffc070, R * 3.4, 0); root.add(flash);

    // potential sheet, p + 208Pb: V0 = 50 MeV, a = 0.65 fm, Coulomb of Z = 82 (1.44 MeV fm)
    function V(r) {
      var vc = r > R ? 82 * 1.44 / r : 82 * 1.44 * (3 - r * r / (R * R)) / (2 * R);
      return vc - 50 / (1 + Math.exp((r - R) / 0.65));
    }
    var sheetY = -0.5, hs = 0.16, rmax = 40;
    function sheetPoint(r, ph) { return new THREE.Vector3(r * Math.cos(ph), sheetY + hs * V(r), r * Math.sin(ph)); }
    var sheet = new THREE.Group(); root.add(sheet);
    var ringMat = function (c, o) { return new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }); };
    for (var rr = 1.5; rr <= rmax; rr += 1.5) {
      var pts = []; for (var ph = 0; ph <= 2 * Math.PI + 1e-6; ph += Math.PI / 90) pts.push(sheetPoint(rr, ph));
      var near = Math.exp(-Math.pow((rr - R - 1.2) / 2.2, 2));
      var col = new THREE.Color(0x3f8fe0).lerp(new THREE.Color(0xffb870), near);
      sheet.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat(col, (0.16 + 0.5 * near) * (1 - rr / rmax * 0.8))));
    }
    for (var sp = 0; sp < 48; sp++) {
      var ph2 = sp * Math.PI / 24, rad = [];
      for (var r2 = 0.3; r2 <= rmax; r2 += 0.4) rad.push(sheetPoint(r2, ph2));
      sheet.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rad), ringMat(0x3f8fe0, 0.11)));
    }
    // a ripple on the sheet when the neutron is absorbed
    var ripple = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ripple.rotation.x = -Math.PI / 2; root.add(ripple);

    var d = nucleons(2, Pb.r * 1.5, 3); root.add(d);
    d.userData.color(0, true); d.userData.color(1, false); commit(d);
    var bond = glow(0xdff0ff, 8, 0.6); root.add(bond);
    var gp = glow(0xff9a40, 6.5, 0.9), gn = glow(0x7cc8ff, 6.5, 0.9); root.add(gp); root.add(gn);
    var tp = trail(90, 0xffa050), tn = trail(60, 0x7cc8ff), td = trail(110, 0xe0f0ff);
    root.add(tp); root.add(tn); root.add(td);

    S.camera.position.set(0, 27, 50); S.camera.lookAt(0, -4, 0);
    var st, cycle = 1, sep = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), rhat = new THREE.Vector3();
    function reset(seed) {
      var r = rng(seed);
      st = {
        t: 0, phase: 'in', cm: new THREE.Vector3(-32, 0, 9.2 + r() * 1.2), v: new THREE.Vector3(17, 0, -0.6),
        pp: new THREE.Vector3(), pv: new THREE.Vector3(), np: new THREE.Vector3(), nv: new THREE.Vector3(),
        spin: r() * 6, absorbed: -1, fade: 1, prevR: 1e9, out: 0
      };
      tp.userData.clear(); tn.userData.clear(); td.userData.clear();
    }
    reset(1);
    return function (t, dt) {
      dt = Math.min(dt, 0.05);
      target.rotation.y += dt * 0.15;
      st.t += dt;
      var k = 420;
      if (st.phase === 'in') {
        coulombStep(st.cm, st.v, k * 0.5, dt);
        st.spin += dt * 4;
        sep.set(Math.cos(st.spin), 0.35 * Math.sin(st.spin * 0.7), Math.sin(st.spin)).multiplyScalar(1.7);
        a.copy(st.cm).add(sep); b.copy(st.cm).sub(sep);
        var rr2 = st.cm.length();
        if (rr2 > st.prevR || rr2 < R + 2.4) {
          st.phase = 'out';
          rhat.copy(st.cm).normalize();
          st.pp.copy(a); st.pv.copy(st.v).addScaledVector(rhat, 5);
          st.np.copy(b); st.nv.copy(st.v).multiplyScalar(0.55).addScaledVector(rhat, -8);
        }
        st.prevR = rr2;
        td.userData.push(st.cm);
        d.userData.set(0, a); d.userData.set(1, b);
        gp.position.copy(a); gn.position.copy(b); bond.position.copy(st.cm);
        bond.material.opacity = 0.6;
      } else {
        st.out += dt;
        coulombStep(st.pp, st.pv, k, dt);
        tp.userData.push(st.pp); d.userData.set(0, st.pp); gp.position.copy(st.pp);
        bond.material.opacity *= Math.pow(0.01, dt);
        if (st.absorbed < 0) {
          st.np.addScaledVector(st.nv, dt);
          tn.userData.push(st.np); d.userData.set(1, st.np); gn.position.copy(st.np);
          if (st.np.length() < R - 0.6) st.absorbed = st.t;
        } else {
          var age = st.t - st.absorbed, s = 1 - smooth(age / 0.3);
          d.userData.set(1, st.np, s); gn.material.opacity = 0.9 * s;
          flash.material.opacity = 0.6 * Math.exp(-age * 2.4);
          ripple.scale.setScalar(R + age * 22); ripple.position.y = sheetY + hs * V(R + age * 22);
          ripple.material.opacity = 0.7 * Math.exp(-age * 1.4);
        }
        if (st.pp.length() > 48) {
          st.fade -= dt * 2.2;
          if (st.fade <= 0) { reset(++cycle * 7919); flash.material.opacity = 0; ripple.material.opacity = 0; gn.material.opacity = 0.9; }
        }
      }
      commit(d);
      var f = Math.max(0, st.fade);
      tp.userData.opacity(f); tn.userData.opacity(f); td.userData.opacity(f * (st.phase === 'in' ? 1 : Math.exp(-st.out * 1.5)));
      gp.material.opacity = 0.9 * f;
      halo.material.opacity = 0.13 + 0.03 * Math.sin(t * 0.9);
      root.rotation.y = 0.18 * Math.sin(t * 0.07) + S.pointer.x * 0.3;
      root.rotation.x = S.pointer.y * 0.08;
    };
  };

  /* 16O + 144Sm -> 160Yb*: approach, contact, shape relaxation to a compound sphere. */
  SCENES.fusion = function (S) {
    var root = new THREE.Group(); S.scene.add(root);
    var T = pack(144, 62, 144), P = pack(16, 8, 16), C = pack(160, 70, 160);
    var n = 160, mesh = nucleons(n, T.r, C.R); root.add(mesh);
    var start = [], isP = [];
    T.pos.forEach(function (p, i) { start.push({ p: p.clone().add(new THREE.Vector3(3, 0, 0)), proj: false }); isP.push(T.proton[i]); });
    P.pos.forEach(function (p, i) { start.push({ p: p.clone(), proj: true }); isP.push(P.proton[i]); });
    for (var i = 0; i < n; i++) mesh.userData.color(i, isP[i]);
    // compound slots: protons to proton slots, neutrons to neutron slots, matched in x order
    var slot = new Array(n);
    [true, false].forEach(function (sp) {
      var mine = []; for (var i = 0; i < n; i++) if (isP[i] === sp) mine.push(i);
      var slots = []; for (var j = 0; j < 160; j++) if (C.proton[j] === sp) slots.push(C.pos[j]);
      var ref = function (i) { return start[i].proj ? start[i].p.x - 20 : start[i].p.x; };
      mine.sort(function (a, b) { return ref(a) - ref(b); });
      slots.sort(function (a, b) { return a.x - b.x; });
      mine.forEach(function (i, k) { slot[i] = slots[k].clone().add(new THREE.Vector3(1.5, 0, 0)); });
    });
    var hot = glow(0xffb45a, C.R * 5, 0); root.add(hot);
    S.camera.position.set(0, 7, 58); S.camera.lookAt(-4, 0, 0);
    var tmp = new THREE.Vector3(), period = 7;
    return function (t) {
      var u = (t % period) / period;
      var gap = 26 * (1 - smooth(u / 0.36));            // projectile flight
      var merge = smooth((u - 0.36) / 0.3);             // contact -> sphere
      var wob = u > 0.36 ? Math.exp(-(u - 0.36) * 9) * Math.sin((u - 0.36) * 42) * 0.18 : 0;
      var fade = 1 - smooth((u - 0.9) / 0.1);
      for (var i = 0; i < n; i++) {
        var s0 = start[i];
        tmp.copy(s0.p);
        if (s0.proj) tmp.x += -3 - T.R - P.R - gap + 1.2;
        tmp.lerp(slot[i], merge);
        tmp.x *= 1 + wob; tmp.y *= 1 - wob * 0.5; tmp.z *= 1 - wob * 0.5;
        mesh.userData.set(i, tmp, fade);
      }
      commit(mesh);
      hot.position.x = 1.5;
      hot.material.opacity = 0.5 * smooth((u - 0.4) / 0.12) * (1 - smooth((u - 0.6) / 0.35)) * fade;
      root.rotation.y = 0.35 * Math.sin(t * 0.25) + S.pointer.x * 0.3;
      root.rotation.x = S.pointer.y * 0.15;
    };
  };

  /* 252Cf -> 108Mo + 144Ba (primary), each evaporating two neutrons, plus gammas. */
  SCENES.fission = function (S) {
    var root = new THREE.Group(); S.scene.add(root);
    var Cf = pack(252, 98, 252), L = pack(108, 42, 108), H = pack(144, 56, 144);
    var n = 252, mesh = nucleons(n, Cf.r, Cf.R); root.add(mesh);
    for (var i = 0; i < n; i++) mesh.userData.color(i, Cf.proton[i]);
    // light fragment takes the 42 protons and 66 neutrons with the smallest x
    var side = new Array(n), slot = new Array(n), emit = [];
    [true, false].forEach(function (sp) {
      var mine = []; for (var i = 0; i < n; i++) if (Cf.proton[i] === sp) mine.push(i);
      mine.sort(function (a, b) { return Cf.pos[a].x - Cf.pos[b].x; });
      var nl = sp ? 42 : 66;
      var ls = [], hs = [];
      for (var j = 0; j < 108; j++) if (L.proton[j] === sp) ls.push(L.pos[j]);
      for (var j2 = 0; j2 < 144; j2++) if (H.proton[j2] === sp) hs.push(H.pos[j2]);
      ls.sort(function (a, b) { return a.x - b.x; }); hs.sort(function (a, b) { return a.x - b.x; });
      mine.forEach(function (i, k) {
        side[i] = k < nl ? -1 : 1;
        slot[i] = k < nl ? ls[k] : hs[k - nl];
      });
    });
    // two neutrons evaporated from each fragment: the outermost ones
    [-1, 1].forEach(function (sd) {
      var ns = []; for (var i = 0; i < n; i++) if (!Cf.proton[i] && side[i] === sd) ns.push(i);
      ns.sort(function (a, b) { return sd * (slot[b].x - slot[a].x); });
      var r = rng(sd > 0 ? 11 : 17);
      emit.push({ i: ns[0], dir: new THREE.Vector3(sd * 1, r() - 0.5, r() - 0.5).normalize(), t0: 0.62 + r() * 0.05 });
      emit.push({ i: ns[1], dir: new THREE.Vector3(sd * 0.6, r() * 2 - 1, r() - 0.5).normalize(), t0: 0.68 + r() * 0.05 });
    });
    var emitOf = {}; emit.forEach(function (e) { emitOf[e.i] = e; });
    var gam = [photon(0xffd27a), photon(0xffd27a), photon(0xffd27a)]; gam.forEach(function (g) { root.add(g); });
    var gdirs = [new THREE.Vector3(0.3, 1, 0.2).normalize(), new THREE.Vector3(-0.4, -1, 0.3).normalize(), new THREE.Vector3(0.9, -0.5, -0.2).normalize()];
    var neck = glow(0xffc070, 10, 0); root.add(neck);
    S.camera.position.set(0, 6, 70); S.camera.lookAt(0, 0, 0);
    var tmp = new THREE.Vector3(), center = new THREE.Vector3(), period = 8;
    return function (t) {
      var u = (t % period) / period;
      var s = smooth(u / 0.4);                    // elongation 0 -> 1
      var cut = smooth((u - 0.4) / 0.08);         // scission
      var fly = Math.max(0, u - 0.44);
      var dH = 5.2 + 60 * fly * fly + 10 * fly;   // heavy fragment centre
      var dL = dH * 144 / 108;                    // momentum balance: the light fragment moves faster
      var fade = 1 - smooth((u - 0.9) / 0.1);
      var stretch = 1 + 0.9 * s;
      for (var i = 0; i < n; i++) {
        var p = Cf.pos[i];
        tmp.set(p.x * stretch, p.y / Math.sqrt(stretch), p.z / Math.sqrt(stretch));
        var pinch = 1 - 0.5 * s * s * Math.exp(-Math.pow(tmp.x / (0.45 * Cf.R * stretch), 2));
        tmp.y *= pinch; tmp.z *= pinch;
        center.set(side[i] < 0 ? -dL : dH, 0, 0);
        var frag = slot[i].clone().add(center);
        tmp.lerp(frag, cut);
        var e = emitOf[i];
        if (e && u > e.t0) tmp.addScaledVector(e.dir, (u - e.t0) * 120);
        mesh.userData.set(i, tmp, fade);
      }
      commit(mesh);
      neck.material.opacity = 0.6 * Math.exp(-Math.pow((u - 0.43) / 0.035, 2));
      gam.forEach(function (g, k) {
        var t0 = 0.56 + k * 0.07, age = u - t0;
        var o = k === 1 ? new THREE.Vector3(dH, 0, 0) : new THREE.Vector3(-dL, 0, 0);
        if (age < 0) { g.visible = false; return; }
        g.visible = true;
        g.userData.draw(o, gdirs[k], age * 160, 16, 0.9 * fade * (1 - smooth((age - 0.2) / 0.15)));
      });
      root.rotation.y = 0.3 * Math.sin(t * 0.2) + S.pointer.x * 0.3;
      root.rotation.x = 0.1 + S.pointer.y * 0.15;
    };
  };

  /* 16O(p,gamma)17F in a stellar plasma. */
  SCENES.capture = function (S) {
    var root = new THREE.Group(); S.scene.add(root);
    var O = pack(16, 8, 1616);
    var star = glow(0xff9a3c, 70, 0.22); star.position.set(10, -4, -40); S.scene.add(star);
    var star2 = glow(0xffe0a0, 26, 0.35); star2.position.copy(star.position); S.scene.add(star2);
    var dust = new THREE.BufferGeometry(), dp = [], r = rng(5);
    for (var i = 0; i < 260; i++) dp.push((r() - 0.5) * 80, (r() - 0.5) * 50, -10 - r() * 40);
    dust.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    S.scene.add(new THREE.Points(dust, new THREE.PointsMaterial({ size: 0.5, color: 0xffc890, map: glowTex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
    var nucleus = new THREE.Group(); root.add(nucleus);
    addNucleus(nucleus, O);
    var p = nucleons(1, O.r, 3); p.userData.color(0, true); root.add(p);
    var tr = trail(80, 0xffa050); root.add(tr);
    var flash = glow(0xffd27a, 16, 0); root.add(flash);
    var g = photon(0xffd27a); root.add(g);
    var site = new THREE.Vector3(-O.R * 0.95, 0.4, 0.3);
    S.camera.position.set(0, 3, 34); S.camera.lookAt(0, 0, 0);
    var pos = new THREE.Vector3(), period = 6, gdir = new THREE.Vector3(0.75, 0.62, 0.2).normalize();
    return function (t) {
      var u = (t % period) / period;
      nucleus.rotation.y = t * 0.3;
      var a = smooth(u / 0.42);
      pos.set(-26 + (site.x + 26) * a, 3.5 * (1 - a) * (1 - a) + site.y * a, site.z * a);
      if (u < 0.05) tr.userData.clear();
      if (u < 0.44) tr.userData.push(pos);
      var fade = 1 - smooth((u - 0.88) / 0.12);
      p.userData.set(0, pos, fade); commit(p);
      tr.userData.opacity(1 - smooth((u - 0.45) / 0.2));
      flash.material.opacity = 0.7 * Math.exp(-Math.pow((u - 0.45) / 0.05, 2));
      var age = u - 0.44;
      g.visible = age > 0;
      if (age > 0) g.userData.draw(new THREE.Vector3(0, 0, 0), gdir, age * 70, 14, 0.95 * (1 - smooth((age - 0.35) / 0.1)));
      root.rotation.y = S.pointer.x * 0.3; root.rotation.x = S.pointer.y * 0.15;
    };
  };

  /* 16O shell structure: measured single-particle energies (MeV), 0s schematic.
     n: 0p1/2 = -S_n(16O), 0p3/2 from the 3/2- hole in 15O, sd from 17O;
     p: 0p1/2 = -S_p(16O), 0p3/2 from 15N, sd from 17F. */
  SCENES.shell = function (S) {
    var root = new THREE.Group(); S.scene.add(root);
    var LV = [
      ['0s1/2', 1, -36, -40, 2], ['0p3/2', 3, -18.45, -21.84, 4], ['0p1/2', 1, -12.13, -15.66, 2],
      ['0d5/2', 5, -0.60, -4.14, 0], ['1s1/2', 1, -0.11, -3.27, 0], ['0d3/2', 3, 4.4, 0.94, 0]
    ];
    var Y = function (E) { return 1.2 + E * 0.36; };
    var rings = [];
    [[-7.4, true, 2], [7.4, false, 3]].forEach(function (col) {
      var x = col[0], isP = col[1];
      LV.forEach(function (L, k) {
        var E = isP ? L[2] : L[3], occ = L[4], rad = 1.4 + 0.9 * Math.sqrt(2 * (L[1] / 2) + 1);
        var torus = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.07, 10, 90),
          new THREE.MeshBasicMaterial({ color: occ ? (isP ? 0xffb070 : 0x8fd0ff) : 0x5b6a80, transparent: true, opacity: occ ? 0.85 : 0.35 }));
        torus.position.set(x, Y(E), 0); torus.rotation.x = Math.PI / 2 - 0.32;
        root.add(torus);
        var ms = occ ? nucleons(occ, 0.62, 6) : null;
        if (ms) { for (var i = 0; i < occ; i++) ms.userData.color(i, isP); root.add(ms); }
        rings.push({ x: x, y: Y(E), rad: rad, occ: occ, mesh: ms, speed: (isP ? 1 : -1) * (0.9 - k * 0.1), phase: k });
        if (isP) {
          var lb = label(L[0], occ ? '#dbe6f5' : '#6f7f96', 0.95);
          lb.position.set(-1.45, Y((L[2] + L[3]) / 2), 0); root.add(lb);
        }
      });
    });
    var zl = label('Z = 8', '#ffb070', 1.1); zl.position.set(-12.2, Y(-6.3), 0); root.add(zl);
    var nl = label('N = 8', '#8fd0ff', 1.1); nl.position.set(10.4, Y(-9.9), 0); root.add(nl);
    var zero = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-13, Y(0), 0), new THREE.Vector3(13, Y(0), 0)]),
      new THREE.LineDashedMaterial({ color: 0x5b6a80, dashSize: 0.5, gapSize: 0.4, transparent: true, opacity: 0.7 }));
    zero.computeLineDistances(); root.add(zero);
    var zt = label('E = 0', '#6f7f96', 0.8); zt.position.set(10.6, Y(0) + 0.6, 0); root.add(zt);
    S.camera.position.set(0, 2, 42); S.camera.lookAt(0, -3.5, 0);
    var tmp = new THREE.Vector3(), tilt = Math.PI / 2 - 0.32;
    return function (t) {
      rings.forEach(function (r) {
        if (!r.mesh) return;
        for (var i = 0; i < r.occ; i++) {
          var a = r.phase + t * r.speed + i * 2 * Math.PI / r.occ;
          tmp.set(Math.cos(a) * r.rad, Math.sin(a) * r.rad, 0);
          tmp.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
          tmp.x += r.x; tmp.y += r.y;
          r.mesh.userData.set(i, tmp);
        }
        commit(r.mesh);
      });
      root.rotation.y = 0.12 * Math.sin(t * 0.3) + S.pointer.x * 0.25;
      root.rotation.x = S.pointer.y * 0.1;
    };
  };

  /* Au + Au: Lorentz-contracted nuclei; participants form a fireball, spectators fly on. */
  SCENES.collision = function (S) {
    var root = new THREE.Group(); S.scene.add(root);
    var Au = pack(197, 79, 197), gamma = 6, b = 6.5, n = 197 * 2;
    var mesh = nucleons(n, Au.r * 0.9, Au.R); root.add(mesh);
    var info = [];
    [-1, 1].forEach(function (sd, k) {
      Au.pos.forEach(function (p, i) {
        var y = p.y + sd * b / 2;
        var other = -sd * b / 2;
        var part = (y - other) * (y - other) + p.z * p.z < Au.R * Au.R;
        info.push({ sd: sd, p: new THREE.Vector3(p.x / gamma, y, p.z), part: part, isP: Au.proton[i] });
        mesh.userData.color(info.length - 1, Au.proton[i]);
      });
    });
    var N = 700, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
    var r = rng(79), palette = [new THREE.Color('#e8f2ff'), new THREE.Color('#8fd0ff'), new THREE.Color('#ffd27a'), new THREE.Color('#ff9440')];
    for (var i = 0; i < N; i++) {
      var v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(14 + r() * 26);
      v.x *= 0.8; vel.push(v);
      var c = palette[r() < 0.62 ? (r() < 0.5 ? 0 : 1) : (r() < 0.6 ? 2 : 3)];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var fire = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fire.frustumCulled = false; root.add(fire);
    var ball = glow(0xfff0d0, 18, 0); root.add(ball);
    S.camera.position.set(8, 12, 58); S.camera.lookAt(0, 0, 0);
    var tmp = new THREE.Vector3(), period = 6;
    return function (t) {
      var u = (t % period) / period, tc = 0.4;
      var x = (u - tc) * 95;                      // position of the +x-moving nucleus
      var hit = u > tc;
      var fade = 1 - smooth((u - 0.88) / 0.12);
      for (var i = 0; i < n; i++) {
        var o = info[i];
        tmp.copy(o.p); tmp.x += o.sd < 0 ? x : -x;
        var s = fade;
        if (hit && o.part) { tmp.x = o.p.x * (1 - smooth((u - tc) / 0.05)); s *= 1 - smooth((u - tc) / 0.06); }
        mesh.userData.set(i, tmp, s);
      }
      commit(mesh);
      var age = Math.max(0, u - tc) * period;
      for (var j = 0; j < N; j++) {
        pos[j * 3] = vel[j].x * age; pos[j * 3 + 1] = vel[j].y * age; pos[j * 3 + 2] = vel[j].z * age;
      }
      geo.attributes.position.needsUpdate = true;
      fire.visible = hit;
      fire.material.opacity = fade * (1 - smooth((age - 1.3) / 1.2));
      ball.material.opacity = hit ? 0.9 * Math.exp(-age * 3.2) : 0;
      root.rotation.y = -0.5 + S.pointer.x * 0.3; root.rotation.x = 0.1 + S.pointer.y * 0.15;
    };
  };

  /* Elliptic flow: an almond-shaped fireball expands faster along its short
     (in-plane) axis and cools; colour follows temperature, then the hadrons stream freely. */
  SCENES.flow = function (S) {
    var root = new THREE.Group(); S.scene.add(root);
    var N = 2600, R = 7, b = 6.5, r = rng(2026);
    var p0 = [], geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    while (p0.length < N) {
      var x = (r() * 2 - 1) * R, y = (r() * 2 - 1) * R, z = (r() * 2 - 1) * 2.2;
      if ((x - b / 2) * (x - b / 2) + y * y < R * R && (x + b / 2) * (x + b / 2) + y * y < R * R) p0.push(new THREE.Vector3(x, y, z));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.62, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; root.add(pts);
    var plane = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-17, 0, 0), new THREE.Vector3(17, 0, 0)]),
      new THREE.LineDashedMaterial({ color: 0x5b6a80, dashSize: 0.6, gapSize: 0.5, transparent: true, opacity: 0.6 }));
    plane.computeLineDistances(); root.add(plane);
    var pl = label('reaction plane', '#6f7f96', 0.9); pl.position.set(-16.5, -1.1, 0); root.add(pl);
    var hot = new THREE.Color('#fff4dc'), mid = new THREE.Color('#ffa040'), cool = new THREE.Color('#3f8fe0'), c = new THREE.Color();
    S.camera.position.set(0, 0, 44); S.camera.lookAt(0, 0, 0);
    var period = 7;
    return function (t) {
      var u = (t % period) / period;
      var tau = 1 + u * 7;                          // proper time, arbitrary units
      var ex = Math.pow(tau, 0.95), ey = Math.pow(tau, 0.52);   // stronger push in plane
      var T = Math.pow(1 / tau, 0.9);               // cooling, 1 -> ~0.17
      var fo = u > 0.6;                             // after freeze-out: free streaming
      var fade = 1 - smooth((u - 0.88) / 0.12);
      for (var i = 0; i < N; i++) {
        var p = p0[i];
        var sx = ex, sy = ey;
        if (fo) { var k = 1 + (u - 0.6) * 6; sx = Math.pow(1 + 0.6 * 7, 0.95) * (1 + (k - 1) * 0.9); sy = Math.pow(1 + 0.6 * 7, 0.52) * (1 + (k - 1) * 0.55); }
        pos[i * 3] = p.x * sx; pos[i * 3 + 1] = p.y * sy; pos[i * 3 + 2] = p.z * (1 + u * 1.5);
        var h = Math.min(1, T / 0.55);
        if (h > 0.5) c.copy(mid).lerp(hot, (h - 0.5) * 2); else c.copy(cool).lerp(mid, h * 2);
        if (fo) c.lerp(cool, 0.4);
        col[i * 3] = c.r * fade; col[i * 3 + 1] = c.g * fade; col[i * 3 + 2] = c.b * fade;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      root.rotation.x = -0.35 + S.pointer.y * 0.15; root.rotation.y = S.pointer.x * 0.3;
    };
  };

  /* ---------------- stage: one renderer per element ---------------- */
  function stage(el) {
    var build = SCENES[el.dataset.scene];
    if (!build) return;
    var canvas = document.createElement('canvas');
    el.appendChild(canvas);
    var renderer;
    try {
      // Opaque on purpose: additive glows raise colour without raising alpha, and
      // Safari composites such over-bright premultiplied pixels as solid blocks.
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { canvas.remove(); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var scene = new THREE.Scene();
    scene.background = backdrop;
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    var key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-20, 30, 25); scene.add(key);
    var back = new THREE.DirectionalLight(0x6fb8ff, 1.2); back.position.set(25, -10, -30); scene.add(back);
    scene.add(new THREE.AmbientLight(0x9fb4d8, 0.35));
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500);
    var S = { scene: scene, camera: camera, renderer: renderer, pointer: { x: 0, y: 0 } };
    var target = { x: 0, y: 0 };
    var update = build(S);
    el.classList.add('scene-on');

    function resize() {
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // keep the horizontal field when the box gets narrow
      camera.fov = w / h < 1 ? 2 * Math.atan(Math.tan(16 * Math.PI / 180) / (w / h)) * 180 / Math.PI : 32;
      camera.updateProjectionMatrix();
      if (reduce) frame(3.1, 0);
    }
    el.addEventListener('pointermove', function (e) {
      var b = el.getBoundingClientRect();
      target.x = ((e.clientX - b.left) / b.width - 0.5) * 2;
      target.y = ((e.clientY - b.top) / b.height - 0.5) * 2;
    });
    el.addEventListener('pointerleave', function () { target.x = target.y = 0; });

    var clock = 0, last = 0, raf = 0, visible = false;
    function frame(t, dt) {
      S.pointer.x += (target.x - S.pointer.x) * 0.05;
      S.pointer.y += (target.y - S.pointer.y) * 0.05;
      update(t, dt);
      renderer.render(scene, camera);
    }
    function loop(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; clock += dt;
      frame(clock, dt);
      raf = visible ? requestAnimationFrame(loop) : 0;
    }
    new ResizeObserver(resize).observe(el);
    resize();
    if (reduce) {
      // a single representative frame: advance the scene to a telling moment without animating
      for (var i = 0; i < 180; i++) { clock += 1 / 60; update(clock, 1 / 60); }
      renderer.render(scene, camera);
      return;
    }
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting && !document.hidden;
      if (visible && !raf) { last = 0; raf = requestAnimationFrame(loop); }
    }, { threshold: 0.01 }).observe(el);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { visible = false; }
      else if (el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < innerHeight) {
        visible = true; if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
      }
    });
  }

  var lazy = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      lazy.unobserve(e.target);
      stage(e.target);
    });
  }, { rootMargin: '300px 0px' });
  document.querySelectorAll('[data-scene]').forEach(function (el) { lazy.observe(el); });
})();
