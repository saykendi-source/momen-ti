// Menyusun foto akhir: potong → filter film → bingkai → JPEG + thumbnail.
// Dipakai oleh layar booth.
async function composePhoto(src, srcW, srcH, opt) {
  const polaroid = opt.frame === 'polaroid';
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (polaroid) { const s = Math.min(srcW, srcH); sx = (srcW - s) / 2; sy = (srcH - s) / 2; sw = sh = s; }
  const scale = Math.min(1, (polaroid ? 1600 : 2048) / Math.max(sw, sh));
  const pw = Math.round(sw * scale), ph = Math.round(sh * scale);

  const work = document.createElement('canvas');
  work.width = pw; work.height = ph;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (opt.mirror) { wctx.translate(pw, 0); wctx.scale(-1, 1); }
  wctx.drawImage(src, sx, sy, sw, sh, 0, 0, pw, ph);
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  applyFilter(wctx, pw, ph, opt.filter);

  let out = work;
  if (polaroid) {
    try { await document.fonts?.load(`600 ${Math.round(pw * 0.07)}px Caveat`); } catch {}
    const side = Math.round(pw * 0.06), bottom = Math.round(pw * 0.24);
    out = document.createElement('canvas');
    out.width = pw + side * 2; out.height = ph + side + bottom;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#FBFBF8'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(work, side, side);
    ctx.fillStyle = '#2B2B2B'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(pw * 0.07)}px Caveat, cursive`;
    let title = opt.title || '';
    while (title.length > 3 && ctx.measureText(title).width > pw) title = title.slice(0, -2) + '…';
    ctx.fillText(title, side, ph + side + bottom * 0.42);
    ctx.font = `600 ${Math.round(pw * 0.038)}px Caveat, cursive`;
    ctx.fillStyle = '#6A6A6A';
    ctx.fillText(opt.caption || '', side, ph + side + bottom * 0.72);
  }
  const k = Math.min(1, 360 / Math.max(out.width, out.height));
  const t = document.createElement('canvas');
  t.width = Math.round(out.width * k); t.height = Math.round(out.height * k);
  const tctx = t.getContext('2d'); tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(out, 0, 0, t.width, t.height);
  return { data: out.toDataURL('image/jpeg', 0.86), thumb: t.toDataURL('image/jpeg', 0.7) };
}
