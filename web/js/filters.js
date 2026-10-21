// Filter ala film analog untuk Momen TI.
// - css   : perkiraan ringan untuk pratinjau langsung di jendela bidik.
// - p     : parameter olah piksel untuk hasil akhir (sama di semua browser).
//   flash    : efek blitz kamera sekali pakai (tengah lebih terang, tepi jatuh gelap).
//   halation : pendaran merah di sekitar sumber cahaya, ciri khas CineStill 800T.
const FILTERS = {
  asli:      { label: 'Asli', mood: 'natural', css: 'none', p: null },
  funsaver:  { label: 'Funsaver', mood: 'blitz hangat', css: 'contrast(1.15) saturate(1.25) sepia(.1) brightness(1.04)',
               p: { contrast: 1.14, sat: 1.25, warm: 9, fade: 6, grain: 11, vignette: .18, flash: .55 } },
  quicksnap: { label: 'Quicksnap', mood: 'blitz sejuk', css: 'contrast(1.1) saturate(1.1) hue-rotate(-8deg) brightness(1.05)',
               p: { contrast: 1.1, sat: 1.08, warm: -7, tint: 7, fade: 12, sh: [-4, 6, 4], grain: 12, vignette: .16, flash: .5 } },
  portra:    { label: 'Portra', mood: 'hangat', css: 'contrast(.95) saturate(.9) sepia(.18) brightness(1.04)',
               p: { contrast: .95, sat: .9, warm: 14, fade: 12, hi: [8, 4, -4], grain: 6, vignette: .15, bright: 6 } },
  ektar:     { label: 'Ektar', mood: 'cerah', css: 'contrast(1.15) saturate(1.4)',
               p: { contrast: 1.15, sat: 1.4, warm: 4, grain: 5, vignette: .15 } },
  hp5:       { label: 'HP5', mood: 'hitam-putih', css: 'grayscale(1) contrast(1.2)',
               p: { bw: true, contrast: 1.2, fade: 10, grain: 18, vignette: .32 } },
  cinestill: { label: '800T', mood: 'malam', css: 'contrast(1.1) saturate(1.1) hue-rotate(-12deg) brightness(.97)',
               p: { contrast: 1.1, sat: 1.1, warm: -14, sh: [-6, 4, 12], hi: [10, 0, -6], grain: 14, vignette: .25,
                    halation: { threshold: 185, strength: 1, color: [255, 50, 20] } } },
};

function applyFilter(ctx, w, h, name) {
  const f = FILTERS[name] && FILTERS[name].p;
  if (!f) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const c = f.contrast ?? 1, sat = f.sat ?? 1, warm = f.warm ?? 0, tint = f.tint ?? 0;
  const fade = f.fade ?? 0, fadeK = (255 - fade) / 255, bright = f.bright ?? 0;
  const sh = f.sh, hi = f.hi, grain = f.grain ?? 0, vig = f.vignette ?? 0, flash = f.flash ?? 0;
  const cx = w / 2, cy = h * 0.45, maxD2 = (w / 2) * (w / 2) + (h / 2) * (h / 2);

  for (let y = 0, i = 0; y < h; y++) {
    const dy2 = (y - cy) * (y - cy);
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i] + warm + bright, g = d[i + 1] + tint + bright, b = d[i + 2] - warm + bright;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (f.bw) { r = g = b = l; }
      else if (sat !== 1) { r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
      r = (r - 128) * c + 128; g = (g - 128) * c + 128; b = (b - 128) * c + 128;
      if (sh || hi) {
        const t = Math.min(Math.max(l / 255, 0), 1);
        if (sh) { const w1 = (1 - t) * (1 - t); r += sh[0] * w1; g += sh[1] * w1; b += sh[2] * w1; }
        if (hi) { const w2 = t * t; r += hi[0] * w2; g += hi[1] * w2; b += hi[2] * w2; }
      }
      if (fade) { r = fade + r * fadeK; g = fade + g * fadeK; b = fade + b * fadeK; }
      const dd = ((x - cx) * (x - cx) + dy2) / maxD2; // 0 di tengah, ±1 di sudut
      if (flash) {
        // Blitz: subjek di tengah terang (sedikit "terbakar"), latar cepat menggelap.
        const k = 1 + flash * (0.45 - dd * 1.6);
        r *= k; g *= k; b *= k;
      }
      if (vig) { const k = 1 - vig * dd; r *= k; g *= k; b *= k; }
      if (grain) { const n = (Math.random() - 0.5) * grain; r += n; g += n; b += n; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray membatasi 0–255 otomatis
    }
  }
  ctx.putImageData(img, 0, 0);
  if (f.halation) applyHalation(ctx, w, h, f.halation);
}

// Pendaran merah: ambil area paling terang, beri warna merah-jingga, kaburkan, lalu tumpuk dengan mode "screen".
// Kabur dibuat dengan memperkecil lalu memperbesar gambar (cepat dan berjalan di semua browser, termasuk Safari).
function applyHalation(ctx, w, h, o) {
  const mk = (cw, ch) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, cw); cv.height = Math.max(1, ch); return cv; };
  const mw = Math.round(w / 4), mh = Math.round(h / 4);
  const mask = mk(mw, mh);
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  mctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, mw, mh);
  const im = mctx.getImageData(0, 0, mw, mh), d = im.data;
  const thr = o.threshold, span = 255 - thr;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = l <= thr ? 0 : Math.min(1, (l - thr) / span);
    d[i] = o.color[0] * v; d[i + 1] = o.color[1] * v; d[i + 2] = o.color[2] * v; d[i + 3] = 255;
  }
  mctx.putImageData(im, 0, 0);
  const s1 = mk(mw / 4, mh / 4), s2 = mk(mw / 12, mh / 12);
  for (const s of [s1, s2]) {
    const sc = s.getContext('2d'); sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
    sc.drawImage(mask, 0, 0, s.width, s.height);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = Math.min(1, o.strength); ctx.drawImage(s1, 0, 0, w, h);
  ctx.globalAlpha = Math.min(1, o.strength * 0.9); ctx.drawImage(s2, 0, 0, w, h);
  ctx.restore();
}
