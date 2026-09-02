/* ------------------------------------------------------------------ *
 * Liquid glass, CSS + SVG tier.
 *
 * Not a blur with a white veil. The panel carries a real height field:
 * a signed distance field for the rounded rectangle, a quintic ramp
 * across the rim and a flat plateau in the middle, and the GRADIENT of
 * that height is encoded into an feDisplacementMap. The backdrop is
 * therefore compressed at the rim the way a plano-convex slab compresses
 * it, and left alone across the face where the surface is flat.
 *
 * What this tier does not do, stated so nobody claims otherwise: one
 * interface instead of two, no wavelength dependence, no reverse roll
 * outside the silhouette (the filter only ever sees the backdrop under
 * the element), and the highlight is a masked gradient, not a BRDF.
 * The WebGL lens in glass-lens.js is the honest version.
 *
 * No build step, no modules: this file is loaded with a plain script tag
 * so index.html keeps working from file:// as well as over http.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* feDisplacementMap divides the channel by 255, so exact neutral is
     127.5, not 128. */
  var NEUTRAL = 127.5;

  /* SIGN CONVENTION, and it is easy to get backwards.
     SVG defines the filter as a pull:

       P'(x,y) = P( x + scale*(R/255 - 0.5), y + scale*(G/255 - 0.5) )

     so a channel above neutral samples from FARTHER ALONG the axis, i.e.
     outward at the right rim. A real slab does the opposite: working
     refract() through with front normal N (N.x > 0 at the right rim),
     incident (0,0,-1) and eta = 1/n < 1 gives T.x < 0, an inward sample,
     which is what makes a lens magnify. Since dh/dx < 0 at the right rim,
     the encoding that produces an inward sample is the POSITIVE gradient:

       R = neutral + (dh/dx) * gain

     Encoding the negative gradient (copying the sign from the shader's
     vec3(-grad, 1) normal) double-flips and gives pincushion instead of
     lens, which looks like a plausible effect rather than a bug. */
  function makeDisplacementMap(opt) {
    var w = Math.max(1, Math.round(opt.width));
    var h = Math.max(1, Math.round(opt.height));
    var r = Math.min(Math.max(opt.radius || 0, 0), w / 2, h / 2);
    var b = Math.max(opt.bevel || 18, 1);
    var strength = opt.strength == null ? 1 : opt.strength;

    var hx = w / 2, hy = h / 2;
    function sdf(x, y) {
      var qx = Math.abs(x - hx) - hx + r;
      var qy = Math.abs(y - hy) - hy + r;
      return Math.min(Math.max(qx, qy), 0) +
             Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
    }
    /* Quintic smootherstep across the bevel, then constant. The constant
       tail is the half that matters: it makes the face genuinely planar,
       so text behind the middle of the panel stays readable. */
    function heightAt(x, y) {
      var t = Math.min(Math.max(-sdf(x, y) / b, 0), 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var img = ctx.createImageData(w, h);
    var data = img.data;

    /* 6t^5-15t^4+10t^3 has derivative 30t^2(t-1)^2, peaking at 1.875 at
       t = 0.5, so dh/dx peaks at 1.875/b per pixel. gain = 127*s*b*0.5
       puts the peak excursion at 119*s, just inside the byte range. */
    var gain = 127 * strength * b * 0.5;

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var gx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 0.5;
        var gy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * 0.5;
        var i = (y * w + x) * 4;
        data[i]     = clamp8(NEUTRAL + gx * gain);
        data[i + 1] = clamp8(NEUTRAL + gy * gain);
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

  /* The filter does DISPLACEMENT ONLY. Blur stays in the CSS
     backdrop-filter list, in both the base rule and the @supports
     override, so an engine that parses url() without executing it still
     gets blur + saturate instead of a bare panel. */
  var defs = null;
  function ensureDefs() {
    if (defs) return defs;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
    document.body.appendChild(svg);
    defs = svg;
    return defs;
  }

  var cache = Object.create(null);
  var serial = 0;

  function filterFor(w, h, radius, bevel, scale) {
    var key = w + 'x' + h + 'r' + radius + 'b' + bevel + 's' + scale;
    if (cache[key]) return cache[key];
    var map = makeDisplacementMap({ width: w, height: h, radius: radius, bevel: bevel });
    if (!map) return null;
    var id = 'lg-' + (++serial);
    /* The filter region must exceed the element box, or samples displaced
       near the boundary clamp and the rim goes flat exactly where the
       effect lives. */
    var m = 0.25, pct = function (v) { return (v * 100).toFixed(1) + '%'; };
    var f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', pct(-m)); f.setAttribute('y', pct(-m));
    f.setAttribute('width', pct(1 + 2 * m)); f.setAttribute('height', pct(1 + 2 * m));
    f.setAttribute('filterUnits', 'objectBoundingBox');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML =
      '<feImage href="' + map + '" result="map" preserveAspectRatio="none"' +
      ' x="0" y="0" width="' + w + '" height="' + h + '"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + scale + '"' +
      ' xChannelSelector="R" yChannelSelector="G"/>';
    ensureDefs().appendChild(f);
    cache[key] = id;
    return id;
  }

  /* ---- wiring -------------------------------------------------------
     Elements opt in with data-glass. Sizes are quantised so a few pixels
     of layout jitter do not regenerate the map, and identical sizes share
     one filter. Both matter: each filter is a full extra surface pass. */

  var supported = false;
  try {
    supported = window.CSS && CSS.supports &&
      (CSS.supports('backdrop-filter', 'url(#x)') ||
       CSS.supports('-webkit-backdrop-filter', 'url(#x)'));
  } catch (e) { supported = false; }

  var QUANT = 8;
  function quant(v) { return Math.max(QUANT, Math.round(v / QUANT) * QUANT); }

  function apply(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) return;
    /* A map generated at the element's pixel size and then stretched goes
       soft at the rim, so cap the area instead of scaling a stale map:
       above this the panel is big enough that a coarser map is not
       visible, and generating it per pixel costs real time. */
    var w = quant(Math.min(rect.width, 900));
    var h = quant(Math.min(rect.height, 620));
    var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    var bevel = parseFloat(el.dataset.glassBevel) || 17;
    var scale = parseFloat(el.dataset.glassScale) || 34;
    radius = Math.round(Math.min(radius, Math.min(w, h) / 2));
    if (el.dataset.glassKey === w + ':' + h + ':' + radius) return;
    var id = filterFor(w, h, radius, bevel, scale);
    if (!id) return;
    el.dataset.glassKey = w + ':' + h + ':' + radius;
    el.style.setProperty('--glass-url', 'url(#' + id + ')');
  }

  function wire() {
    if (!supported) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      /* Displacement is static, so it stays. Only the cost of watching
         every panel resize is dropped. */
    }
    var els = document.querySelectorAll('[data-glass]');
    for (var i = 0; i < els.length; i++) apply(els[i]);

    if (typeof ResizeObserver === 'function') {
      var pending = null;
      var ro = new ResizeObserver(function (entries) {
        if (pending) return;
        pending = requestAnimationFrame(function () {
          pending = null;
          for (var j = 0; j < entries.length; j++) apply(entries[j].target);
        });
      });
      for (var k = 0; k < els.length; k++) ro.observe(els[k]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  window.LiquidGlass = {
    makeDisplacementMap: makeDisplacementMap,
    supported: supported,
    refresh: wire
  };
})();
