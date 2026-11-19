// Preset Lightroom (dari Preset Lab) sebagai filter acara.
//
// Supaya ringan di HP:
//  1. Bagian warna preset (WB, eksposur, kurva, HSL, kalibrasi, color grading, dll.) "dipanggang" sekali menjadi
//     tabel warna 3D (LUT 33×33×33) dengan menjalankan mesin Preset Lab pada kisi warna (±36 ribu titik, sangat cepat).
//  2. Saat memotret: tiap piksel cukup dicari di LUT. Efek yang bergantung posisi (clarity/texture, vignette, grain)
//     dikerjakan terpisah dengan rumus yang sama seperti mesin Preset Lab.
//  3. Jendela bidik: LUT dipasang di WebGL, sehingga pratinjau langsung sama dengan hasil foto.
//
// Butuh preset-engine.js (PresetEngine) dan filters.js. Koleksi bawaan (preset-lib.js) dimuat hanya bila diperlukan.

const LUT_N = 33;
const BUILTIN_FILTERS = Object.assign({}, FILTERS);
const MAX_EVENT_PRESETS = 6;

function loadScriptOnce(src) {
  return new Promise((ok, bad) => {
    const old = document.querySelector(`script[data-src="${src}"]`);
    if (old) { if (old.dataset.done) ok(); else { old.addEventListener('load', ok); old.addEventListener('error', bad); } return; }
    const s = document.createElement('script');
    s.src = src; s.dataset.src = src;
    s.onload = () => { s.dataset.done = '1'; ok(); };
    s.onerror = () => bad(new Error('Gagal memuat ' + src));
    document.head.appendChild(s);
  });
}

async function presetLibrary() {
  if (typeof PRESET_LIB === 'undefined') await loadScriptOnce('js/preset-lib.js?v=13');
  return PRESET_LIB;
}

/**
 * Ubah daftar preset acara menjadi entri FILTERS.
 * e.presets     : ['l:faded', 'u:ab12cd', ...]   (l: = koleksi bawaan, u: = unggahan admin)
 * e.presetData  : { 'u:ab12cd': { n, s } }        (dikirim server hanya untuk preset unggahan)
 * e.presetOnly  : true → filter film bawaan disembunyikan (kecuali "Asli")
 */
async function applyEventPresets(e) {
  const keys = (e && e.presets) || [];
  let lib = [];
  if (keys.some((k) => k.startsWith('l:'))) { try { lib = await presetLibrary(); } catch { lib = []; } }
  const list = keys.map((k) => {
    if (k.startsWith('u:')) { const d = e.presetData && e.presetData[k]; return d ? { k, n: d.n, s: d.s } : null; }
    return lib.find((p) => p.k === k) || null;
  }).filter(Boolean);
  setFilterList(list, !!(e && e.presetOnly) && list.length > 0);
  return list;
}

/** Susun ulang FILTERS: Asli → preset acara → filter film bawaan (kecuali presetOnly). */
function setFilterList(list, presetOnly) {
  const prev = {};
  for (const k of Object.keys(FILTERS)) { if (FILTERS[k].lr) prev[k] = FILTERS[k]; delete FILTERS[k]; }
  FILTERS.asli = BUILTIN_FILTERS.asli;
  for (const p of list) {
    const old = prev[p.k];
    FILTERS[p.k] = old && JSON.stringify(old.lr) === JSON.stringify(p.s) ? old
      : { label: p.n, mood: 'preset', css: 'none', lr: p.s };
  }
  if (!presetOnly) for (const k of Object.keys(BUILTIN_FILTERS)) if (k !== 'asli') FILTERS[k] = BUILTIN_FILTERS[k];
}

const isPreset = (name) => !!(FILTERS[name] && FILTERS[name].lr);

/** LUT + parameter efek, dibuat sekali per preset. */
function presetData(f) {
  if (f._data) return f._data;
  const N = LUT_N, n = N * N * N;
  const src = new Uint8ClampedArray(n * 4), dst = new Uint8ClampedArray(n * 4);
  for (let b = 0, i = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++, i += 4) {
    src[i] = Math.round(r * 255 / (N - 1)); src[i + 1] = Math.round(g * 255 / (N - 1)); src[i + 2] = Math.round(b * 255 / (N - 1)); src[i + 3] = 255;
  }
  const s = JSON.parse(JSON.stringify(f.lr));
  delete s.__c; delete s.RGBTable;
  const full = PresetEngine.compile(s);
  // Untuk LUT: matikan semua efek yang bergantung posisi.
  const C = Object.assign({}, full, { clarity: 0, texture: 0, vig: 0, lensVig: 0, grain: 0 });
  PresetEngine.processImage(src, dst, n, 1, { __c: C }, 1);
  const lut = new Uint8Array(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 4) { lut[i * 3] = dst[j]; lut[i * 3 + 1] = dst[j + 1]; lut[i * 3 + 2] = dst[j + 2]; }
  const fx = {
    clarity: full.clarity, texture: full.texture,
    vig: full.vig + full.lensVig * 0.7, vigMid: full.vigMid, vigFeather: full.vigFeather, vigRound: full.vigRound,
    grain: full.grain, grainSize: full.grainSize,
  };
  return (f._data = { lut, fx });
}

/** Terapkan LUT ke data piksel RGBA (trilinear). */
function lutPixels(d, lut) {
  const N = LUT_N, S = (N - 1) / 255, NN = N * N;
  for (let i = 0; i < d.length; i += 4) {
    const fr = d[i] * S, fg = d[i + 1] * S, fb = d[i + 2] * S;
    let r0 = fr | 0, g0 = fg | 0, b0 = fb | 0;
    if (r0 > N - 2) r0 = N - 2; if (g0 > N - 2) g0 = N - 2; if (b0 > N - 2) b0 = N - 2;
    const dr = fr - r0, dg = fg - g0, db = fb - b0;
    const i000 = (b0 * NN + g0 * N + r0) * 3, i100 = i000 + 3, i010 = i000 + N * 3, i110 = i010 + 3;
    const i001 = i000 + NN * 3, i101 = i001 + 3, i011 = i001 + N * 3, i111 = i011 + 3;
    for (let c = 0; c < 3; c++) {
      const a = lut[i000 + c] + (lut[i100 + c] - lut[i000 + c]) * dr;
      const b = lut[i010 + c] + (lut[i110 + c] - lut[i010 + c]) * dr;
      const e = lut[i001 + c] + (lut[i101 + c] - lut[i001 + c]) * dr;
      const f = lut[i011 + c] + (lut[i111 + c] - lut[i011 + c]) * dr;
      const lo = a + (b - a) * dg, hi = e + (f - e) * dg;
      d[i + c] = lo + (hi - lo) * db + 0.5;
    }
  }
}

/** Luminans yang dikaburkan (perkecil-perbesar lewat kanvas, cepat di semua browser). */
function blurredLuma(canvas, w, h, radius) {
  const f = Math.max(2, Math.round(radius));
  const sw = Math.max(2, Math.round(w / f)), sh = Math.max(2, Math.round(h / f));
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(canvas, 0, 0, w, h, 0, 0, sw, sh);
  // Satu kali kabur tambahan supaya transisi halus.
  const c2 = document.createElement('canvas'); c2.width = Math.max(2, sw >> 1); c2.height = Math.max(2, sh >> 1);
  const x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = 'high';
  x2.drawImage(c, 0, 0, c2.width, c2.height);
  x.clearRect(0, 0, sw, sh); x.drawImage(c2, 0, 0, sw, sh);
  const d = x.getImageData(0, 0, sw, sh).data, L = new Float32Array(sw * sh);
  for (let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) / 255;
  return { L, sw, sh, fx: sw / w, fy: sh / h };
}
function sampleBlur(B, x, y) {
  const gx = Math.min(B.sw - 1.001, Math.max(0, x * B.fx - 0.5)), gy = Math.min(B.sh - 1.001, Math.max(0, y * B.fy - 0.5));
  const ix = gx | 0, iy = gy | 0, ax = gx - ix, ay = gy - iy, o = iy * B.sw + ix;
  return (B.L[o] * (1 - ax) + B.L[o + 1] * ax) * (1 - ay) + (B.L[o + B.sw] * (1 - ax) + B.L[o + B.sw + 1] * ax) * ay;
}

/** Terapkan preset ke kanvas (dipanggil oleh applyFilter di filters.js). */
function applyPreset(ctx, w, h, f) {
  const { lut, fx } = presetData(f);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  lutPixels(d, lut);
  const diag = Math.sqrt(w * w + h * h);
  const needLocal = fx.clarity || fx.texture;
  const vigOn = fx.vig !== 0, grainOn = fx.grain > 0;
  if (!needLocal && !vigOn && !grainOn) { ctx.putImageData(img, 0, 0); return; }
  let big = null, small = null;
  if (needLocal) {
    ctx.putImageData(img, 0, 0); // kabur dihitung dari hasil LUT, sama seperti urutan di mesin
    if (fx.clarity) big = blurredLuma(ctx.canvas, w, h, diag * 0.012);
    if (fx.texture) small = blurredLuma(ctx.canvas, w, h, diag * 0.002);
  }
  // Grain: derau halus per sel, diinterpolasi (rumus Preset Lab).
  let gnoise = null, gw = 0, gsz = 1;
  if (grainOn) {
    gsz = Math.max(1, Math.round(fx.grainSize * diag / 2200));
    gw = Math.ceil(w / gsz) + 1; const gh = Math.ceil(h / gsz) + 1;
    gnoise = new Float32Array(gw * gh);
    for (let i = 0; i < gnoise.length; i++) gnoise[i] = (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  }
  const cx = w / 2, cy = h / 2, rr = fx.vigRound;
  const start = 0.25 + fx.vigMid * 0.6, fe = 0.15 + fx.vigFeather * 0.9;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (needLocal) {
        let dl = 0;
        if (big) dl += (lum - sampleBlur(big, x, y)) * fx.clarity * 0.9 * (1 - Math.pow(2 * lum - 1, 4));
        if (small) dl += (lum - sampleBlur(small, x, y)) * fx.texture * 1.2;
        r += dl; g += dl; b += dl;
      }
      if (vigOn) {
        const dx = (x - cx) / cx, dy = (y - cy) / cy;
        const ax = dx * (rr >= 0 ? 1 : 1 + rr * 0.5), ay = dy * (rr >= 0 ? 1 - rr * 0.3 : 1);
        const dd = Math.sqrt(ax * ax + ay * ay);
        let m = (dd - start) / fe; m = m < 0 ? 0 : m > 1 ? 1 : m; m = m * m * (3 - 2 * m);
        if (fx.vig < 0) { const k = 1 + fx.vig * m * 0.85; r *= k; g *= k; b *= k; }
        else { const k = fx.vig * m * 0.8; r += (1 - r) * k; g += (1 - g) * k; b += (1 - b) * k; }
      }
      if (grainOn) {
        const gx = x / gsz, gy = y / gsz, ix = gx | 0, iy = gy | 0, ax = gx - ix, ay = gy - iy, o = iy * gw + ix;
        const nz = (gnoise[o] * (1 - ax) + gnoise[o + 1] * ax) * (1 - ay) + (gnoise[o + gw] * (1 - ax) + gnoise[o + gw + 1] * ax) * ay;
        const l3 = lum < 0 ? 0 : lum > 1 ? 1 : lum, amp = fx.grain * 0.13 * (0.35 + 0.65 * (1 - Math.abs(2 * l3 - 1)));
        r += nz * amp; g += nz * amp; b += nz * amp;
      }
      d[i] = r * 255 + 0.5; d[i + 1] = g * 255 + 0.5; d[i + 2] = b * 255 + 0.5;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Pratinjau kecil (tombol filter, contoh di form): hanya LUT + vignette, tanpa grain. */
function previewPreset(ctx, w, h, f) {
  const { lut } = presetData(f);
  const img = ctx.getImageData(0, 0, w, h);
  lutPixels(img.data, lut);
  ctx.putImageData(img, 0, 0);
}

/* ------------------------------------------------------------------
 * Jendela bidik WebGL: video → LUT 3D (+ vignette) → kanvas.
 * Kanvas memakai object-fit yang sama dengan <video>, jadi posisinya identik.
 * ------------------------------------------------------------------ */
class LutView {
  constructor(canvas, video) {
    this.canvas = canvas; this.video = video; this.filter = null; this.raf = 0; this.ok = false;
    try {
      const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false, antialias: false });
      if (!gl) return;
      this.gl = gl;
      const vs = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2((p.x+1.)*.5, 1.-(p.y+1.)*.5); gl_Position = vec4(p,0.,1.); }`;
      const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        varying vec2 uv; uniform sampler2D vid; uniform sampler2D lut; uniform float N;
        uniform vec4 vg; uniform float vr; uniform float aspect;
        vec3 look(vec3 c){
          float b = c.b*(N-1.); float b0 = floor(b); float b1 = min(b0+1., N-1.); float t = b-b0;
          vec2 s = vec2(c.r*(N-1.)+.5, c.g*(N-1.)+.5) / vec2(N*N, N);
          vec3 x0 = texture2D(lut, s + vec2(b0/N, 0.)).rgb;
          vec3 x1 = texture2D(lut, s + vec2(b1/N, 0.)).rgb;
          return mix(x0, x1, t);
        }
        void main(){
          vec3 c = look(texture2D(vid, uv).rgb);
          if (vg.x != 0.) {
            float dx = (uv.x-.5)*2., dy = (uv.y-.5)*2.;
            float ax = dx*(vr>=0.?1.:1.+vr*.5), ay = dy*(vr>=0.?1.-vr*.3:1.);
            float m = smoothstep(0., 1., clamp((sqrt(ax*ax+ay*ay)-vg.y)/vg.z, 0., 1.));
            if (vg.x < 0.) c *= 1.+vg.x*m*.85; else c += (1.-c)*vg.x*m*.8;
          }
          gl_FragColor = vec4(c, 1.);
        }`;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
      gl.useProgram(pr); this.pr = pr;
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      this.tVid = tex(0); this.tLut = tex(1);
      gl.uniform1i(gl.getUniformLocation(pr, 'vid'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'lut'), 1);
      gl.uniform1f(gl.getUniformLocation(pr, 'N'), LUT_N);
      this.uVg = gl.getUniformLocation(pr, 'vg'); this.uVr = gl.getUniformLocation(pr, 'vr');
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      this.ok = true;
    } catch (err) { console.warn('WebGL tidak tersedia:', err); this.ok = false; }
  }
  /** Pasang preset (objek FILTERS) atau null untuk berhenti. Mengembalikan true jika pratinjau WebGL aktif. */
  set(f) {
    this.filter = f && f.lr ? f : null;
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (!this.ok || !this.filter) { this.canvas.classList.add('hidden'); return false; }
    const gl = this.gl, N = LUT_N, { lut, fx } = presetData(this.filter);
    // Susun LUT 3D menjadi tekstur 2D selebar N×N: tiap irisan biru berdampingan.
    const tex = new Uint8Array(N * N * N * 3);
    for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
      const s = ((b * N + g) * N + r) * 3, t = (g * N * N + b * N + r) * 3;
      tex[t] = lut[s]; tex[t + 1] = lut[s + 1]; tex[t + 2] = lut[s + 2];
    }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tLut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, N * N, N, 0, gl.RGB, gl.UNSIGNED_BYTE, tex);
    gl.uniform4f(this.uVg, fx.vig, 0.25 + fx.vigMid * 0.6, 0.15 + fx.vigFeather * 0.9, 0);
    gl.uniform1f(this.uVr, fx.vigRound);
    this.canvas.classList.remove('hidden');
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); };
    loop();
    return true;
  }
  draw() {
    const v = this.video, gl = this.gl;
    if (!v.videoWidth || document.hidden) return;
    const sc = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * sc), h = Math.round(v.videoHeight * sc);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tVid);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); } catch { return; }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  resume() { if (this.filter && !this.raf) this.set(this.filter); }
}

/** Ambil hanya kunci yang dikenal mesin dari hasil parseXMP (dipakai saat admin mengunggah .xmp). */
function cleanPresetSettings(s) {
  const out = {};
  for (const [k, v] of Object.entries(s || {})) {
    if (k.startsWith('_') || k === 'RGBTable' || !/^[A-Za-z0-9]{1,40}$/.test(k)) continue;
    if (typeof v === 'number' && isFinite(v)) out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v) && /^curve[CRGB]$/.test(k)) out[k] = v.slice(0, 32).map((p) => [Math.round(+p[0]) || 0, Math.round(+p[1]) || 0]);
  }
  return out;
}
