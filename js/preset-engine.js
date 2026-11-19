
// Preset engine: approximates Lightroom / Camera Raw "crs" settings on 8-bit RGBA pixels.
// Pure function, no DOM. Works in browser and Node.
(function (root) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const g = (s, k, d) => (s[k] === undefined ? (d || 0) : s[k]);

  // Monotone cubic interpolation of a point curve (0..255) into a 256 LUT (0..1)
  function curveLUT(pts) {
    const lut = new Float32Array(256);
    if (!pts || pts.length < 2) { for (let i = 0; i < 256; i++) lut[i] = i / 255; return lut; }
    const P = pts.slice().sort((a, b) => a[0] - b[0]);
    const n = P.length, xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    let seg = 0;
    for (let x = 0; x < 256; x++) {
      let y;
      if (x <= xs[0]) y = ys[0];
      else if (x >= xs[n - 1]) y = ys[n - 1];
      else {
        while (x > xs[seg + 1]) seg++;
        const hgt = xs[seg + 1] - xs[seg], t = (x - xs[seg]) / hgt;
        const t2 = t * t, t3 = t2 * t;
        y = (2 * t3 - 3 * t2 + 1) * ys[seg] + (t3 - 2 * t2 + t) * hgt * m[seg] + (-2 * t3 + 3 * t2) * ys[seg + 1] + (t3 - t2) * hgt * m[seg + 1];
      }
      lut[x] = clamp(y / 255, 0, 1);
    }
    return lut;
  }

  function hueToRgb(h) { // h degrees -> pure color rgb 0..1
    h = ((h % 360) + 360) % 360 / 60;
    const x = 1 - Math.abs((h % 2) - 1);
    const t = [[1, x, 0], [x, 1, 0], [0, 1, x], [0, x, 1], [x, 0, 1], [1, 0, x]][Math.floor(h) % 6];
    return t;
  }

  // Build all per-preset tables once
  function compile(s) {
    const C = {};
    // White balance -> linear channel multipliers
    let t = g(s, 'IncrementalTemperature'), ti = g(s, 'IncrementalTint');
    if (s.Temperature) { t = clamp((s.Temperature - 5500) / 40, -100, 100) * 0.6; ti = g(s, 'Tint') * 0.5; }
    let r = 1 + 0.32 * t / 100, b = 1 - 0.32 * t / 100, gg = 1 - 0.22 * ti / 100;
    r *= 1 + 0.08 * ti / 100; b *= 1 + 0.08 * ti / 100;
    const norm = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const ev = Math.pow(2, g(s, 'Exposure2012'));
    C.wb = [r / norm * ev, gg / norm * ev, b / norm * ev];

    // Tone LUT (basic panel + parametric + point curves), per channel on gamma-encoded values
    const con = g(s, 'Contrast2012') / 100, hi = g(s, 'Highlights2012') / 100, sh = g(s, 'Shadows2012') / 100;
    const wh = g(s, 'Whites2012') / 100, bl = g(s, 'Blacks2012') / 100, dz = g(s, 'Dehaze') / 100;
    const s1 = g(s, 'ParametricShadowSplit', 25) / 100, s2 = g(s, 'ParametricMidtoneSplit', 50) / 100, s3 = g(s, 'ParametricHighlightSplit', 75) / 100;
    const par = [[g(s, 'ParametricShadows'), 0, s1], [g(s, 'ParametricDarks'), s1 * 0.5, s2], [g(s, 'ParametricLights'), s2, s3 + (1 - s3) * 0.5], [g(s, 'ParametricHighlights'), s3, 1]];
    const base = new Float32Array(1024);
    let prev = 0;
    for (let i = 0; i < 1024; i++) {
      let x = i / 1023;
      const ce = con + dz * 0.35;
      x = x - ce * 0.11 * Math.sin(2 * Math.PI * x);
      x = x + sh * 0.75 * x * (1 - x) * (1 - x);
      x = x + hi * 0.75 * x * x * (1 - x);
      x = x + (bl - dz * 0.25) * 0.14 * Math.pow(1 - x, 4);
      x = x + wh * 0.14 * Math.pow(x, 4);
      for (const [v, a, e] of par) {
        if (!v) continue;
        const w = (x <= a || x >= e) ? 0 : Math.pow(Math.sin(Math.PI * (x - a) / (e - a)), 2);
        x += v / 100 * 0.16 * w;
      }
      x = clamp(x, 0, 1);
      if (x < prev) x = prev; prev = x;
      base[i] = x;
    }
    const cm = curveLUT(s.curveC), cr = curveLUT(s.curveR), cg = curveLUT(s.curveG), cb = curveLUT(s.curveB);
    const ap = (lut, v) => { const f = v * 255, i = Math.min(254, Math.floor(f)), fr = f - i; return lut[i] * (1 - fr) + lut[i + 1] * fr; };
    C.tone = [new Float32Array(1024), new Float32Array(1024), new Float32Array(1024)];
    for (let i = 0; i < 1024; i++) {
      const m = ap(cm, base[i]);
      C.tone[0][i] = ap(cr, m); C.tone[1][i] = ap(cg, m); C.tone[2][i] = ap(cb, m);
    }

    // HSL bands (+ camera calibration folded in)
    const names = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];
    C.centers = [0, 30, 60, 120, 180, 240, 270, 300];
    C.hh = names.map(n => g(s, 'HueAdjustment' + n) / 100 * 30);
    C.ss = names.map(n => g(s, 'SaturationAdjustment' + n) / 100);
    C.ll = names.map(n => g(s, 'LuminanceAdjustment' + n) / 100);
    // Camera calibration: rotate / scale each RGB primary around the gray axis (linear light)
    C.cal = null;
    const prim = ['Red', 'Green', 'Blue'];
    if (prim.some(n => g(s, n + 'Hue') || g(s, n + 'Saturation'))) {
      const cols = prim.map((nm, c) => {
        const e = [0, 0, 0]; e[c] = 1;
        const th = g(s, nm + 'Hue') / 100 * 25 * Math.PI / 180, sc = 1 + g(s, nm + 'Saturation') / 100 * 0.6;
        const Y = 1 / 3, ch = e.map(v => v - Y);
        const k = 1 / Math.sqrt(3), cs = Math.cos(th), sn = Math.sin(th);
        // Rodrigues rotation about (1,1,1)/sqrt3 ; ch is orthogonal to the axis
        const ax = [k, k, k];
        const cx = [ax[1] * ch[2] - ax[2] * ch[1], ax[2] * ch[0] - ax[0] * ch[2], ax[0] * ch[1] - ax[1] * ch[0]];
        return ch.map((v, i) => Y + (v * cs + cx[i] * sn) * sc);
      });
      // M[row][col]; normalize rows so white stays white
      const M = [0, 1, 2].map(r => [cols[0][r], cols[1][r], cols[2][r]]);
      for (const row of M) { const sm = row[0] + row[1] + row[2]; for (let i = 0; i < 3; i++) row[i] /= sm; }
      C.cal = M;
    }
    C.hasHSL = C.hh.some(v => v) || C.ss.some(v => v) || C.ll.some(v => v);
    C.vib = g(s, 'Vibrance') / 100;
    C.sat = 1 + g(s, 'Saturation') / 100 + dz * 0.15;
    C.gray = !!s.ConvertToGrayscale;
    C.shadowTint = g(s, 'ShadowTint') / 100;

    // Split toning / color grading
    const tint = (h, sat) => { if (!sat) return null; const c = hueToRgb(h); const m = (c[0] + c[1] + c[2]) / 3; return [(c[0] - m) * sat / 100, (c[1] - m) * sat / 100, (c[2] - m) * sat / 100]; };
    C.gShadow = tint(g(s, 'SplitToningShadowHue'), g(s, 'SplitToningShadowSaturation'));
    C.gHigh = tint(g(s, 'SplitToningHighlightHue'), g(s, 'SplitToningHighlightSaturation'));
    C.gMid = tint(g(s, 'ColorGradeMidtoneHue'), g(s, 'ColorGradeMidtoneSat'));
    C.gGlob = tint(g(s, 'ColorGradeGlobalHue'), g(s, 'ColorGradeGlobalSat'));
    C.bal = g(s, 'SplitToningBalance') / 100;
    C.lumS = g(s, 'ColorGradeShadowLum') / 100; C.lumM = g(s, 'ColorGradeMidtoneLum') / 100;
    C.lumH = g(s, 'ColorGradeHighlightLum') / 100; C.lumG = g(s, 'ColorGradeGlobalLum') / 100;
    C.hasGrade = !!(C.gShadow || C.gHigh || C.gMid || C.gGlob || C.lumS || C.lumM || C.lumH || C.lumG);

    C.clarity = g(s, 'Clarity2012') / 100 + dz * 0.3;
    C.texture = g(s, 'Texture') / 100;
    C.vig = g(s, 'PostCropVignetteAmount') / 100;
    C.vigMid = g(s, 'PostCropVignetteMidpoint', 50) / 100;
    C.vigFeather = g(s, 'PostCropVignetteFeather', 50) / 100;
    C.vigRound = g(s, 'PostCropVignetteRoundness') / 100;
    C.lensVig = g(s, 'VignetteAmount') / 100;
    C.grain = g(s, 'GrainAmount') / 100;
    C.grainSize = g(s, 'GrainSize', 25) / 25;
    return C;
  }

  // Linearization LUTs
  const toLin = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const ENC_N = 4096, toGam = new Float32Array(ENC_N + 1);
  for (let i = 0; i <= ENC_N; i++) { const c = i / ENC_N; toGam[i] = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function enc(v) { // linear -> gamma with soft highlight shoulder
    if (v > 0.75) v = 0.75 + 0.25 * (1 - Math.exp(-(v - 0.75) / 0.25));
    if (v <= 0) return 0;
    return toGam[Math.min(ENC_N, (v * ENC_N) | 0)];
  }

  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    const iarr = 1 / (r + r + 1);
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[o + clamp(k, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = acc * iarr;
        acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc * iarr;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }
  function blur3(src, w, h, r) { r = Math.max(1, r | 0); return boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r); }

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // process(srcRGBA, dstRGBA, w, h, settings, amount 0..1)
  function processImage(src, dst, w, h, s, amount) {
    const C = s.__c || (s.__c = compile(s));
    const n = w * h;
    const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
    const M = C.cal, [wr, wg, wb] = C.wb, T0 = C.tone[0], T1 = C.tone[1], T2 = C.tone[2];
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let lr = toLin[src[p]] * wr, lg = toLin[src[p + 1]] * wg, lb = toLin[src[p + 2]] * wb;
      if (M) { const a = M[0][0] * lr + M[0][1] * lg + M[0][2] * lb, c = M[1][0] * lr + M[1][1] * lg + M[1][2] * lb; lb = M[2][0] * lr + M[2][1] * lg + M[2][2] * lb; lr = a; lg = c; }
      let r = enc(lr), gg = enc(lg), b = enc(lb);
      R[i] = T0[(r * 1023) | 0]; G[i] = T1[(gg * 1023) | 0]; B[i] = T2[(b * 1023) | 0];
    }
    // Local contrast (clarity / texture)
    const diag = Math.sqrt(w * w + h * h);
    if (C.clarity || C.texture) {
      const L = new Float32Array(n);
      for (let i = 0; i < n; i++) L[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
      const bigR = C.clarity ? blur3(L, w, h, diag * 0.012) : null;
      const smR = C.texture ? blur3(L, w, h, diag * 0.002) : null;
      for (let i = 0; i < n; i++) {
        const l = L[i]; let d = 0;
        if (bigR) d += (l - bigR[i]) * C.clarity * 0.9 * (1 - Math.pow(2 * l - 1, 4));
        if (smR) d += (l - smR[i]) * C.texture * 1.2;
        R[i] += d; G[i] += d; B[i] += d;
      }
    }
    const cen = C.centers, hh = C.hh, ss = C.ss, ll = C.ll;
    const vigOn = C.vig || C.lensVig, grainOn = C.grain > 0;
    const cx = w / 2, cy = h / 2;
    const rnd = mulberry(12345);
    let gsz = Math.max(1, Math.round(C.grainSize * diag / 2200));
    let gnoise = null, gw = 0;
    if (grainOn) {
      gw = Math.ceil(w / gsz) + 1; const gh = Math.ceil(h / gsz) + 1;
      gnoise = new Float32Array(gw * gh);
      for (let i = 0; i < gnoise.length; i++) gnoise[i] = (rnd() + rnd() + rnd() - 1.5) * 1.15;
    }
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        let r = R[i], gg = G[i], b = B[i];
        // HSL band adjustments
        if (C.hasHSL) {
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dlt = mx - mn;
          if (dlt > 1e-4) {
            const l = (mx + mn) / 2, sat = dlt / (1 - Math.abs(2 * l - 1) + 1e-6);
            let hue;
            if (mx === r) hue = 60 * (((gg - b) / dlt) % 6); else if (mx === gg) hue = 60 * ((b - r) / dlt + 2); else hue = 60 * ((r - gg) / dlt + 4);
            if (hue < 0) hue += 360;
            let k = 7; while (k > 0 && hue < cen[k]) k--;
            const k2 = (k + 1) % 8, span = (k === 7 ? 360 : cen[k2]) - cen[k];
            const f = (hue - cen[k]) / span, w1 = 1 - f, w2 = f;
            const dh = hh[k] * w1 + hh[k2] * w2, ds = ss[k] * w1 + ss[k2] * w2, dl = ll[k] * w1 + ll[k2] * w2;
            const cs = Math.min(1, sat);
            let nh = hue + dh * cs, ns = clamp(sat * (1 + ds), 0, 1.5), nl = l * (1 + dl * 0.45 * cs);
            nl = clamp(nl, 0, 1); ns = Math.min(ns, 1);
            const c2 = (1 - Math.abs(2 * nl - 1)) * ns, hp = (((nh % 360) + 360) % 360) / 60, xx = c2 * (1 - Math.abs((hp % 2) - 1)), m = nl - c2 / 2;
            const sx = Math.floor(hp) % 6;
            if (sx === 0) { r = c2; gg = xx; b = 0; } else if (sx === 1) { r = xx; gg = c2; b = 0; } else if (sx === 2) { r = 0; gg = c2; b = xx; }
            else if (sx === 3) { r = 0; gg = xx; b = c2; } else if (sx === 4) { r = xx; gg = 0; b = c2; } else { r = c2; gg = 0; b = xx; }
            r += m; gg += m; b += m;
          }
        }
        // Vibrance + saturation
        let lum = 0.299 * r + 0.587 * gg + 0.114 * b;
        if (C.vib || C.sat !== 1) {
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), chroma = mx - mn;
          const f = C.sat * (1 + C.vib * (C.vib > 0 ? (1 - chroma) * 1.1 : 1));
          r = lum + (r - lum) * f; gg = lum + (gg - lum) * f; b = lum + (b - lum) * f;
        }
        if (C.shadowTint) { const ws = (1 - lum) * (1 - lum); gg -= C.shadowTint * 0.06 * ws; r += C.shadowTint * 0.03 * ws; b += C.shadowTint * 0.03 * ws; }
        // Color grading
        if (C.hasGrade) {
          const L = clamp(lum, 0, 1), bal = C.bal;
          let ws = clamp(1 - L * (1.6 - bal * 0.8), 0, 1), wh2 = clamp((L - 0.35 + bal * 0.3) * 1.6, 0, 1);
          ws *= ws; wh2 *= wh2;
          const wm = Math.max(0, 1 - Math.abs(L - 0.5) * 2.2);
          const add = (c, wt) => { if (c) { r += c[0] * wt * 0.32; gg += c[1] * wt * 0.32; b += c[2] * wt * 0.32; } };
          add(C.gShadow, ws); add(C.gHigh, wh2); add(C.gMid, wm); add(C.gGlob, 0.7);
          const dl = (C.lumS * ws + C.lumM * wm + C.lumH * wh2 + C.lumG) * 0.15;
          r += dl; gg += dl; b += dl;
        }
        if (C.gray) { const l2 = 0.299 * r + 0.587 * gg + 0.114 * b; r = gg = b = l2; }
        // Vignette
        if (vigOn) {
          const dx = (x - cx) / cx, dy = (y - cy) / cy;
          const rr = C.vigRound;
          const ax = dx * (rr >= 0 ? 1 : 1 + rr * 0.5) , ay = dy * (rr >= 0 ? 1 - rr * 0.3 : 1);
          const d = Math.sqrt((ax * ax + ay * ay) / 2) * 1.414;
          const start = 0.25 + C.vigMid * 0.6, fe = 0.15 + C.vigFeather * 0.9;
          let m = clamp((d - start) / fe, 0, 1); m = m * m * (3 - 2 * m);
          const a = C.vig + C.lensVig * 0.7;
          if (a < 0) { const k = 1 + a * m * 0.85; r *= k; gg *= k; b *= k; }
          else { const k = a * m * 0.8; r += (1 - r) * k; gg += (1 - gg) * k; b += (1 - b) * k; }
        }
        if (grainOn) {
          const gx = x / gsz, gy = y / gsz, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
          const o = iy * gw + ix;
          const nz = (gnoise[o] * (1 - fx) + gnoise[o + 1] * fx) * (1 - fy) + (gnoise[o + gw] * (1 - fx) + gnoise[o + gw + 1] * fx) * fy;
          const l3 = clamp(lum, 0, 1), amp = C.grain * 0.13 * (0.35 + 0.65 * (1 - Math.abs(2 * l3 - 1)));
          r += nz * amp; gg += nz * amp; b += nz * amp;
        }
        const p = i * 4;
        if (amount >= 1) {
          dst[p] = r * 255 + 0.5; dst[p + 1] = gg * 255 + 0.5; dst[p + 2] = b * 255 + 0.5;
        } else {
          dst[p] = src[p] + (r * 255 - src[p]) * amount + 0.5;
          dst[p + 1] = src[p + 1] + (gg * 255 - src[p + 1]) * amount + 0.5;
          dst[p + 2] = src[p + 2] + (b * 255 - src[p + 2]) * amount + 0.5;
        }
        dst[p + 3] = src[p + 3];
      }
    }
  }

  // Parse crs settings out of XMP text (from .xmp or the XMP packet inside a .dng)
  function parseXMP(text) {
    const i = text.indexOf('<x:xmpmeta'), j = text.indexOf('</x:xmpmeta>');
    if (i < 0) return null;
    const xml = text.slice(i, j > 0 ? j : undefined);
    const s = {}; let pv = false;
    const attr = /crs:(\w+)="([^"]*)"/g; let m;
    while ((m = attr.exec(xml))) {
      const k = m[1], v = m[2];
      if (k === 'ToneCurveName2012') pv = true;
      if (k === 'RGBTable') { s.RGBTable = v; continue; }
      if (v === 'True') s[k] = true; else { const f = parseFloat(v); if (!isNaN(f) && f !== 0) s[k] = f; }
    }
    const seq = /<crs:(\w+)>\s*<rdf:Seq>([\s\S]*?)<\/rdf:Seq>/g;
    const curves = {};
    while ((m = seq.exec(xml))) {
      const pts = []; const li = /<rdf:li>\s*(-?\d+)\s*,\s*(-?\d+)\s*<\/rdf:li>/g; let q;
      while ((q = li.exec(m[2]))) pts.push([+q[1], +q[2]]);
      if (pts.length) curves[m[1]] = pts;
    }
    if (curves.ToneCurvePV2012) pv = true;
    const pre = pv ? 'ToneCurvePV2012' : 'ToneCurve';
    [['', 'C'], ['Red', 'R'], ['Green', 'G'], ['Blue', 'B']].forEach(([c, n]) => { if (curves[pre + c]) s['curve' + n] = curves[pre + c]; });
    if (!s.IncrementalTemperature && !s.IncrementalTint && s.Temperature === undefined) { /* nothing */ }
    if (!('ParametricShadowSplit' in s)) s.ParametricShadowSplit = 25;
    if (!('ParametricMidtoneSplit' in s)) s.ParametricMidtoneSplit = 50;
    if (!('ParametricHighlightSplit' in s)) s.ParametricHighlightSplit = 75;
    if (!('PostCropVignetteMidpoint' in s)) s.PostCropVignetteMidpoint = 50;
    if (!('PostCropVignetteFeather' in s)) s.PostCropVignetteFeather = 50;
    if (!('GrainSize' in s)) s.GrainSize = 25;
    const nm = /<crs:Name>[\s\S]*?<rdf:li[^>]*>([^<]*)<\/rdf:li>/.exec(xml);
    return { name: nm && nm[1].trim() ? nm[1].trim() : null, s, lut: !!s.RGBTable };
  }

  const api = { processImage, parseXMP, compile };
  if (typeof module !== 'undefined') module.exports = api; else root.PresetEngine = api;
})(this);

