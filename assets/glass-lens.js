/* ------------------------------------------------------------------ *
 * Liquid glass, WebGL2 tier: a real lens over the corpus map.
 *
 * Adapted from the reference implementation in the liquid-glass skill.
 * Two passes, and the order is the point:
 *
 *   pass 1  the map image -> offscreen texture + mipmaps  (the blur budget)
 *   pass 2  the glass     -> reads that texture with textureLod
 *   layer 3 the label     -> plain DOM above, never refracted, clickable
 *
 * The glass pass never displaces UV by normal.xy. It refracts a ray
 * through air -> glass -> air and intersects the plane the map sits on.
 * The compression at the rim, the reverse roll of what lies just outside
 * and the fringing that appears only at the edge all fall out of that.
 *
 * Honest about what it is not: the dispersion carries a 10x gain because
 * the true spectral split at this thickness is well under a pixel, the
 * face is mostly a 0.975 magnification rather than the traced path
 * because a smeared label is noticed immediately, the two rim routes are
 * art direction rather than an optical decomposition, there is no
 * Fresnel energy split on the refracted term, and everything composites
 * in display space. Two-interface refraction, not physics.
 *
 * The background here is STATIC, so pass 1 runs on resize only. That is
 * the single largest saving available in this pipeline.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  var VERT = '#version 300 es\n' +
    'in vec2 aPos; out vec2 vUv;\n' +
    'void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  /* Pass 1: the map, object-fit cover, with a little contrast lift. The
     glass needs high-frequency detail to bend; this image has it, which
     is why the lens lives here and not over the starfield. */
  var FRAG_BG = '#version 300 es\n' + [
    'precision highp float;',
    'in vec2 vUv; out vec4 outColor;',
    'uniform sampler2D uImage;',
    'uniform vec2 uCover;',
    'void main() {',
    '  vec2 uv = (vUv - 0.5) * uCover + 0.5;',
    '  vec3 c = texture(uImage, clamp(uv, 0.0005, 0.9995)).rgb;',
    '  c = clamp((c - 0.5) * 1.06 + 0.5, 0.0, 1.0);',
    '  outColor = vec4(c, 1.0);',
    '}'].join('\n');

  var FRAG_GLASS = '#version 300 es\n' + [
    'precision highp float;',
    'in vec2 vUv; out vec4 outColor;',
    'uniform sampler2D uBackground;',
    'uniform vec2  uResolution;',
    'uniform float uTime;',
    'uniform vec2  uRectCenter;',
    'uniform vec2  uRectHalf;',
    'uniform vec2  uCircleCenter;',
    'uniform float uCircleRadius;',
    'uniform float uCornerRadius;',
    'uniform float uIor;',
    'uniform float uThickness;',
    'uniform float uBgDistance;',
    'uniform float uBevel;',
    'uniform float uBlur;',
    'uniform float uDispersion;',
    'uniform float uSpecular;',
    'uniform float uRoughness;',
    'uniform float uTint;',
    'uniform float uDeform;',
    'uniform float uMaxLod;',
    'uniform int   uDebug;',
    'const float PI = 3.141592653589793;',
    'float aspectRatio() { return uResolution.x / max(uResolution.y, 1.0); }',
    /* Every shape and every derivative lives in this aspect corrected
       plane, or a resize squashes the circle into an ellipse. */
    'vec2 toPlane(vec2 uv) { return (uv - 0.5) * vec2(aspectRatio(), 1.0); }',
    'vec2 toUv(vec2 p)     { return p / vec2(aspectRatio(), 1.0) + 0.5; }',

    'float hash12(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float valueNoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),',
    '             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++) { v += a * valueNoise(p); p *= 2.02; a *= 0.5; }',
    '  return v;',
    '}',
    'float sdRoundBox(vec2 p, vec2 b, float r) {',
    '  vec2 q = abs(p) - b + r;',
    '  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;',
    '}',
    /* Shapes are fused in the field, never recovered from the render. */
    'float smoothMin(float a, float b, float k) {',
    '  float h = max(k - abs(a - b), 0.0) / k;',
    '  return min(a, b) - h * h * k * 0.25;',
    '}',
    'float sceneSdf(vec2 p, float noiseWeight) {',
    '  vec2 rp = p - uRectCenter;',
    '  float dRect = sdRoundBox(rp, uRectHalf, uCornerRadius);',
    '  vec2 cp = p - uCircleCenter;',
    '  float dCircle = length(cp) - uCircleRadius;',
    /* Noise driven by continuous time. Per frame random makes the rim boil. */
    '  dRect   += (fbm(rp * 12.0 + vec2(uTime * 0.10, -uTime * 0.08)) - 0.5) * 0.009 * uDeform * noiseWeight;',
    '  dCircle += (fbm(cp * 13.5 + vec2(-uTime * 0.09, uTime * 0.11)) - 0.5) * 0.008 * uDeform * noiseWeight;',
    '  return smoothMin(dRect, dCircle, 0.05);',
    '}',
    'float glassSdf(vec2 p)        { return sceneSdf(p, 1.0); }',
    /* Nearly clean copy drives height and normals. Differentiating the
       noisy field is what puts a hard inner frame inside the face. */
    'float glassSurfaceSdf(vec2 p) { return sceneSdf(p, 0.12); }',

    'float heightAt(vec2 p) {',
    '  float interior = max(-glassSurfaceSdf(p), 0.0);',
    '  float bevel = max(uBevel * 0.82, 0.001);',
    '  float t = clamp(interior / bevel, 0.0, 1.0);',
    /* Quintic, then constant. The constant tail makes the face genuinely
       planar, so the centre stays readable and n there is exactly (0,0,1). */
    '  float profile = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);',
    '  return max(uThickness, 0.0) * profile;',
    '}',
    'vec3 surfaceNormalAt(vec2 p, out float height) {',
    '  float e = clamp(uBevel * 0.13, 0.003, 0.012);',
    '  height = heightAt(p);',
    '  float hL = heightAt(p - vec2(e, 0.0));',
    '  float hR = heightAt(p + vec2(e, 0.0));',
    '  float hD = heightAt(p - vec2(0.0, e));',
    '  float hU = heightAt(p + vec2(0.0, e));',
    '  vec2 grad = vec2(hR - hL, hU - hD) / (2.0 * e);',
    '  return normalize(vec3(-grad, 1.0));',
    '}',

    'vec2 traceToBackground(vec2 p, float height, vec3 n, float ior) {',
    '  vec3 incident = vec3(0.0, 0.0, -1.0);',
    '  vec3 inside = refract(incident, n, 1.0 / max(ior, 1.001));',
    '  inside = dot(inside, inside) < 1e-4 ? incident : normalize(inside);',
    '  vec3 front = vec3(p, height);',
    '  vec3 back  = front + inside * (height / max(-inside.z, 0.025));',
    '  vec3 exitRay = refract(inside, vec3(0.0, 0.0, 1.0), max(ior, 1.001));',
    /* Total internal reflection at the back face: the transmitted ray does
       not exist, so fall back to the last valid traced point rather than
       inventing a grazing ray. Unguarded, refract() returns zero and
       normalize() of that is NaN, which shows up as edge speckle. */
    '  if (dot(exitRay, exitRay) < 1e-4) return back.xy;',
    '  exitRay = normalize(exitRay);',
    '  float zBackground = -max(uBgDistance, 0.001);',
    '  float travel = max((zBackground - back.z) / min(exitRay.z, -0.001), 0.0);',
    '  return (back + exitRay * travel).xy;',
    '}',

    'vec3 sampleBg(vec2 p, float lod) {',
    '  return textureLod(uBackground, clamp(toUv(p), 0.002, 0.998),',
    '                    clamp(lod, 0.0, max(uMaxLod, 0.0))).rgb;',
    '}',
    'vec3 sampleRim(vec2 p, vec2 dR, vec2 dB, float lod) {',
    '  return vec3(sampleBg(p + dR, lod).r, sampleBg(p, lod).g, sampleBg(p + dB, lod).b);',
    '}',

    'float pow5(float x) { float s = x * x; return s * s * x; }',
    'float dielectricF0(float ior) { float r = (max(ior,1.001)-1.0)/(max(ior,1.001)+1.0); return r*r; }',
    'float ggx(float nh, float rough) {',
    '  float a = max(rough * rough, 0.0025), a2 = a * a;',
    '  float d = nh * nh * (a2 - 1.0) + 1.0;',
    '  return a2 / max(PI * d * d, 1e-6);',
    '}',
    'float smithVisibility(float nv, float nl, float rough) {',
    '  float a2 = pow(max(rough * rough, 0.0025), 2.0);',
    '  float v = nl * sqrt(nv * nv * (1.0 - a2) + a2);',
    '  float l = nv * sqrt(nl * nl * (1.0 - a2) + a2);',
    '  return 0.5 / max(v + l, 1e-5);',
    '}',
    'vec3 brdf(vec3 n, vec3 v, vec3 l, vec3 radiance, float ior, float rough) {',
    '  float nv = clamp(dot(n, v), 0.0, 1.0);',
    '  float nl = clamp(dot(n, l), 0.0, 1.0);',
    '  if (nv <= 1e-4 || nl <= 1e-4) return vec3(0.0);',
    '  vec3 h = normalize(v + l);',
    '  float f0 = dielectricF0(ior);',
    '  vec3 fresnel = vec3(f0) + (vec3(1.0) - vec3(f0)) * pow5(1.0 - clamp(dot(v, h), 0.0, 1.0));',
    '  return radiance * fresnel * ggx(clamp(dot(n, h), 0.0, 1.0), rough)',
    '       * smithVisibility(nv, nl, rough) * nl;',
    '}',
    'vec3 environment(vec3 n, vec3 v, float ior, float rough) {',
    '  float nv = clamp(dot(n, v), 0.0, 1.0);',
    '  float f0 = dielectricF0(ior);',
    '  vec3 grazing = max(vec3(1.0 - rough), vec3(f0));',
    '  vec3 fresnel = vec3(f0) + (grazing - vec3(f0)) * pow5(1.0 - nv);',
    /* Cool sky, warm ground, matched to the page palette. */
    '  return mix(vec3(0.20, 0.13, 0.06), vec3(0.32, 0.58, 0.86), n.y * 0.5 + 0.5) * fresnel;',
    '}',

    'void main() {',
    '  vec2 p = toPlane(vUv);',
    '  float sdf = glassSdf(p);',
    '  float surfaceSdf = glassSurfaceSdf(p);',
    '  float aa = max(fwidth(sdf) * 1.25, 0.0014);',
    '  float mask = smoothstep(aa, -aa, sdf);',
    '  float height;',
    '  vec3 n = surfaceNormalAt(p, height);',
    '  if (uDebug == 1) { outColor = vec4(vec3(mask), 1.0); return; }',
    '  if (uDebug == 2) { outColor = vec4(vec3(height / max(uThickness, 1e-4)) * mask, 1.0); return; }',
    '  if (uDebug == 3) { outColor = vec4(n * 0.5 + 0.5, 1.0); return; }',
    '  if (uDebug == 4) { outColor = vec4(sampleBg(p, 0.0), 1.0); return; }',
    '  float bevel = clamp(uBevel, 0.014, 0.085);',
    '  float transition = smoothstep(0.018, 0.085, bevel);',
    '  vec2 edgeDir = n.xy / sqrt(dot(n.xy, n.xy) + 1e-4);',
    '  float edgeProfile = pow(clamp(length(n.xy) * 1.18, 0.0, 1.0), mix(1.7, 1.12, transition)) * mask;',
    '  float rimBand = smoothstep(-bevel * 0.58, -bevel * 0.16, surfaceSdf)',
    '                * (1.0 - smoothstep(-0.003, 0.007, sdf));',
    /* Spectral split from three real traces, not an RGB offset. */
    '  float d = uDispersion * 0.8;',
    '  vec2 rP = traceToBackground(p, height, n, max(uIor - d, 1.001));',
    '  vec2 gP = traceToBackground(p, height, n, uIor);',
    '  vec2 bP = traceToBackground(p, height, n, uIor + d);',
    '  const float spectralGain = 10.0;',
    '  vec2 dR = (rP - gP) * spectralGain;',
    '  vec2 dB = (bP - gP) * spectralGain;',
    /* FACE: nearly flat, slight magnification about the shape centre, only
       lightly mixed with the physical path. Readability beats purity. */
    '  vec2 opticalCentre = mix(uRectCenter, uCircleCenter, 0.5);',
    '  vec2 faceP = mix(opticalCentre + (p - opticalCentre) * 0.975, gP, 0.28 + edgeProfile * 0.16);',
    '  float rimPush = (0.006 + max(uThickness, 0.0) * 0.62 + max(uBgDistance, 0.0) * 0.12)',
    '                * (0.42 + edgeProfile * 0.88);',
    '  vec2 innerP = gP - edgeDir * rimPush;',
    '  vec2 outerP = p + edgeDir * rimPush * 1.28;',
    '  float lod = clamp(log2(max(uBlur, 0.0) + 1.0), 0.0, 5.5);',
    '  vec3 faceCol  = sampleBg(faceP, lod * 0.7);',
    '  vec3 innerCol = sampleRim(innerP, dR, dB, lod * 0.2);',
    '  vec3 outerCol = sampleRim(outerP, dR, dB, min(lod * 1.08 + 0.3, 6.0));',
    '  float outerBias = smoothstep(-bevel * 0.3, -0.001, surfaceSdf);',
    '  float wFace  = 1.0 - rimBand * 0.88;',
    '  float wInner = rimBand * mix(0.68, 0.34, outerBias);',
    '  float wOuter = rimBand * mix(0.20, 0.54, outerBias);',
    '  float wSum = max(wFace + wInner + wOuter, 0.001);',
    '  wFace /= wSum; wInner /= wSum; wOuter /= wSum;',
    '  vec3 refracted = faceCol * wFace + innerCol * wInner + outerCol * wOuter;',
    '  refracted = clamp((refracted - 0.5) * 1.075 + 0.5, 0.0, 1.0);',
    /* Four grazing key lights slowly orbiting, so every part of the rim
       catches something at a different strength. */
    '  vec3 view = vec3(0.0, 0.0, 1.0);',
    '  float orbit = uTime * 0.085;',
    '  vec2 axis = vec2(cos(orbit), sin(orbit));',
    '  vec2 tangent = vec2(-axis.y, axis.x);',
    '  float rough = clamp(uRoughness, 0.06, 0.58);',
    '  vec3 spec =',
    '      brdf(n, view, normalize(vec3( axis    * 0.94, 0.34)), vec3(1.00, 0.965, 0.90) * 1.65, uIor, rough)',
    '    + brdf(n, view, normalize(vec3( tangent * 0.90, 0.42)), vec3(0.66, 0.82,  1.00) * 1.34, uIor, rough)',
    '    + brdf(n, view, normalize(vec3(-axis    * 0.96, 0.28)), vec3(1.00, 0.80,  0.55) * 1.02, uIor, min(rough * 1.18, 0.62))',
    '    + brdf(n, view, normalize(vec3(-tangent * 0.92, 0.38)), vec3(0.55, 0.76,  1.00) * 1.12, uIor, min(rough * 1.12, 0.62));',
    '  vec3 highlight = vec3(1.0) - exp(-spec * max(uSpecular, 0.0) * 2.20);',
    /* Every lobe stays on the outer half of the bevel. On the flat face a
       lobe renders as a raised inner box, the classic tell. */
    '  float curvature = smoothstep(0.035, 0.30, edgeProfile);',
    '  float bevelSupport = smoothstep(-bevel * 0.45, -bevel * 0.12, surfaceSdf);',
    '  highlight *= mask * curvature * bevelSupport;',
    '  vec3 envRefl = environment(n, view, uIor, rough) * mask * curvature * bevelSupport',
    '               * (0.35 + 0.65 * rimBand);',
    /* Order: refraction, tint, bleed, reflection, highlight. A white veil
       first is what makes plastic. */
    '  vec3 glass = refracted;',
    '  glass += (vec3(1.0) - glass) * clamp(uTint, 0.0, 0.3);',
    '  float lum = dot(outerCol, vec3(0.2126, 0.7152, 0.0722));',
    '  glass += (vec3(1.0) - glass) * mix(vec3(lum), outerCol, 0.62) * wOuter * 0.075;',
    '  glass += (vec3(1.0) - glass) * envRefl * 0.32;',
    '  glass += (vec3(1.0) - glass) * highlight * 0.68;',
    '  vec3 base = sampleBg(p, 0.0);',
    '  float contact = smoothstep(0.045, 0.0, sdf) * smoothstep(-0.003, 0.008, sdf);',
    '  float drop = smoothstep(0.055, -0.002, glassSdf(p - vec2(0.014, -0.019))) * (1.0 - mask);',
    '  base *= 1.0 - contact * 0.09 - drop * 0.16;',
    '  outColor = vec4(mix(base, glass, mask), 1.0);',
    '}'].join('\n');

  /* Tuned against this background, not general constants. The map is a
     bright image with fine black specks, which changes three dials from
     the reference defaults: the tint goes almost to zero because any white
     tint over a white backdrop just washes the face out, the blur comes
     down because the point of a lens over a map is to see the map bent
     rather than fogged, and the dispersion comes down because 10x spectral
     gain over white with black detail reads as a rainbow outline. */
  var P = {
    ior: 1.46, thickness: 0.050, bgDistance: 0.070, bevel: 0.042,
    blur: 3.4, dispersion: 0.019, specular: 2.3, roughness: 0.30,
    tint: 0.010, deform: 0.22
  };

  function init(host) {
    var img = host.querySelector('img');
    if (!img) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'lens-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    var gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, powerPreference: 'high-performance'
    });
    if (!gl) return;                         /* the <img> stays, unchanged */

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s));
      }
      return s;
    }
    function program(frag) {
      var p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(p));
      }
      return p;
    }

    var progBg, progGlass;
    try {
      progBg = program(FRAG_BG);
      progGlass = program(FRAG_GLASS);
    } catch (e) {
      if (window.console) console.warn('liquid glass: shader failed,', e.message);
      return;
    }

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    /* The map, uploaded once. Same origin, but a file:// page taints it,
       so the upload is guarded and the <img> survives as the fallback. */
    var imgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } catch (e) {
      if (window.console) console.warn('liquid glass: map texture blocked,', e.message);
      return;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    /* Mipmaps are the blur budget the glass spends per optical route, so
       LINEAR_MIPMAP_LINEAR on the render target is required, not optional. */
    var bgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bgTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    var uni = function (p, names) {
      var o = {};
      for (var i = 0; i < names.length; i++) o[names[i]] = gl.getUniformLocation(p, names[i]);
      return o;
    };
    var U_BG = uni(progBg, ['uImage', 'uCover']);
    var U_GL = uni(progGlass, ['uBackground','uResolution','uTime','uRectCenter','uRectHalf',
      'uCircleCenter','uCircleRadius','uCornerRadius','uIor','uThickness','uBgDistance',
      'uBevel','uBlur','uDispersion','uSpecular','uRoughness','uTint','uDeform','uMaxLod','uDebug']);

    var debugView = Math.max(0, Math.min(4,
      parseInt(new URLSearchParams(location.search).get('debug') || '0', 10) || 0));

    var dpr = 1, maxLod = 0, allocated = false, dead = false;

    /* An incomplete framebuffer renders nothing and reports nothing.
       Checking it once turns a blank panel into a named cause. */
    function framebufferComplete() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (st !== gl.FRAMEBUFFER_COMPLETE) {
        if (window.console) console.warn('liquid glass: framebuffer incomplete', st);
        return false;
      }
      return true;
    }

    function drawBackground() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(progBg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.uniform1i(U_BG.uImage, 0);
      var ia = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      var ta = canvas.width / Math.max(canvas.height, 1);
      /* object-fit: cover, expressed as the visible fraction of the image */
      gl.uniform2f(U_BG.uCover, ia > ta ? ta / ia : 1.0, ia > ta ? 1.0 : ia / ta);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, bgTex);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function resize() {
      /* Fill rate is the cost here, so the DPR is capped. */
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var rect = host.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      /* Never trust the size comparison on the first call: a canvas
         defaults to 300x150 and could match it. */
      if (allocated && w === canvas.width && h === canvas.height) return false;
      canvas.width = w; canvas.height = h;
      gl.bindTexture(gl.TEXTURE_2D, bgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      maxLod = Math.floor(Math.log2(Math.max(w, h)));
      allocated = true;
      if (!framebufferComplete()) { dead = true; return false; }
      drawBackground();          /* static background: only on resize */
      return true;
    }

    /* Mobile GPUs take the context away under memory pressure. Without
       preventDefault it is never restored and the panel stays blank. */
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); dead = true; canvas.classList.remove('on');
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      /* Every GL object is gone. Rebuilding is out of scope for one
         decorative surface, so hand the page back its <img>. */
      canvas.remove();
    }, false);

    host.insertBefore(canvas, host.firstChild);
    if (!resize() || dead) { canvas.remove(); return; }
    host.classList.add('lens-on');
    canvas.classList.add('on');
    document.documentElement.classList.add('has-lens');

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pointer = { x: 0, y: 0, has: false };
    var queued = false;
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      var aspect = r.width / Math.max(r.height, 1);
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * aspect;
      pointer.y = 0.5 - (e.clientY - r.top) / r.height;
      pointer.has = true;
      /* Reduced motion stops the autonomous wobble and the orbiting lights,
         not direct manipulation: the lens still tracks the pointer, it just
         does so on demand and without easing, and nothing moves on its own. */
      if (!reduced || dead || queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        /* dt = 0, so render() keeps this assignment rather than easing
           toward it, and derives the companion circle from a frozen clock. */
        shape.rx = pointer.x; shape.ry = pointer.y;
        render(0);
      });
    }, { passive: true });
    host.addEventListener('pointerleave', function () { pointer.has = false; });

    var shape = { rx: 0, ry: 0, cx: 0.2, cy: -0.1 };
    var time = 0, last = performance.now() / 1000;
    var visible = false, hidden = document.hidden;

    document.addEventListener('visibilitychange', function () {
      hidden = document.hidden;
      last = performance.now() / 1000;   /* reset the base or the scene jumps */
    });

    /* Only run while the section is on screen. A glass surface nobody is
       looking at is pure cost. */
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        last = performance.now() / 1000;
        if (visible && !reduced) requestAnimationFrame(frame);
        if (visible && reduced) render(0);
      }, { threshold: 0.02 }).observe(host);
    } else {
      visible = true;
      requestAnimationFrame(frame);
    }

    function render(dt) {
      time += dt;
      var aspect = canvas.width / Math.max(canvas.height, 1);
      var targetX = pointer.has ? pointer.x : Math.cos(time * 0.27) * 0.26 * aspect;
      var targetY = pointer.has ? pointer.y : Math.sin(time * 0.21) * 0.20;
      var k = 1 - Math.exp(-dt * 6.0);     /* frame rate independent smoothing */
      shape.rx += (targetX - shape.rx) * k;
      shape.ry += (targetY - shape.ry) * k;
      shape.cx = shape.rx + Math.cos(time * 0.5) * 0.135;
      shape.cy = shape.ry + Math.sin(time * 0.5) * 0.095;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(progGlass);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bgTex);
      gl.bindVertexArray(vao);
      gl.uniform1i(U_GL.uBackground, 0);
      gl.uniform2f(U_GL.uResolution, canvas.width, canvas.height);
      gl.uniform1f(U_GL.uTime, time);
      gl.uniform2f(U_GL.uRectCenter, shape.rx, shape.ry);
      gl.uniform2f(U_GL.uRectHalf, 0.195, 0.100);
      gl.uniform2f(U_GL.uCircleCenter, shape.cx, shape.cy);
      gl.uniform1f(U_GL.uCircleRadius, 0.082);
      gl.uniform1f(U_GL.uCornerRadius, 0.090);
      gl.uniform1f(U_GL.uIor, P.ior);
      gl.uniform1f(U_GL.uThickness, P.thickness);
      gl.uniform1f(U_GL.uBgDistance, P.bgDistance);
      gl.uniform1f(U_GL.uBevel, P.bevel);
      gl.uniform1f(U_GL.uBlur, P.blur);
      gl.uniform1f(U_GL.uDispersion, P.dispersion);
      gl.uniform1f(U_GL.uSpecular, P.specular);
      gl.uniform1f(U_GL.uRoughness, P.roughness);
      gl.uniform1f(U_GL.uTint, P.tint);
      gl.uniform1f(U_GL.uDeform, reduced ? 0 : P.deform);
      gl.uniform1f(U_GL.uMaxLod, maxLod);
      gl.uniform1i(U_GL.uDebug, debugView);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      if (dead) return;
      var t = now / 1000;
      var dt = Math.min(Math.max(t - last, 0), 1 / 15);
      last = t;
      if (hidden || !visible) return;
      if (resize() && dead) return;
      render(reduced ? 0 : dt);
      if (!reduced) requestAnimationFrame(frame);
    }

    window.addEventListener('resize', function () {
      if (dead) return;
      if (resize() && reduced) render(0);
    });
  }

  function boot() {
    var hosts = document.querySelectorAll('[data-glass-lens]');
    for (var i = 0; i < hosts.length; i++) {
      (function (host) {
        var img = host.querySelector('img');
        if (img && !img.complete) {
          img.addEventListener('load', function () { init(host); }, { once: true });
        } else {
          init(host);
        }
      })(hosts[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
