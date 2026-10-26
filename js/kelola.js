(function () {
  $('.app-name').textContent = MOMEN.APP_NAME;
  if (!configured()) { $('#ev-name').textContent = ''; $('main').insertAdjacentHTML('afterbegin', setupWarning()); return; }
  if (!Auth.get()) { location.replace('./?next=' + encodeURIComponent(location.href)); return; }

  const id = qs('id');
  let ev, thumbs = null;

  async function load() {
    let data;
    try { data = await api('getManage', { id }); }
    catch (err) {
      if (err.code === 'need_login') { Auth.logout(); location.replace('./?next=' + encodeURIComponent(location.href)); return; }
      $('#ev-name').textContent = err.message; return;
    }
    ev = data.event;
    applyAccent(ev.accent);
    loadCover();
    $('#content').classList.remove('hidden');
    document.title = `${ev.name} · ${MOMEN.APP_NAME}`;
    $('#ev-name').textContent = ev.name;
    $('#ev-meta').innerHTML = `
      <span class="chip ${ev.status}">${STATUS_LABEL[ev.status]}</span>
      ${ev.status === 'aktif' ? `<span class="chip">${PHASE_LABEL[ev.state.phase]}</span>` : ''}
      <span class="muted">${fmtDate(ev.start)} – ${fmtTime(ev.end)}</span>
      ${ev.code ? `<span class="muted">Kode akses: <b>${esc(ev.code)}</b></span>` : ''}`;
    $('#archived').classList.toggle('hidden', ev.status !== 'arsip');
    $('#btn-archive').classList.toggle('hidden', ev.status === 'arsip');

    $('#link').value = ev.url;
    $('#open-cam').href = `acara.html?e=${encodeURIComponent(ev.slug)}`;
    $('#open-album').href = `album.html?e=${encodeURIComponent(ev.slug)}`;
    $('#open-drive').href = ev.folderUrl;
    try {
      const qr = qrcode(0, 'M'); qr.addData(ev.url); qr.make();
      $('#qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch { $('#qr').textContent = 'QR gagal dibuat'; }

    const s = ev.stats;
    $('#stats').innerHTML = `<b>${s.participants}</b> peserta bergabung · <b>${s.photos}</b> foto · ${quotaText(ev)}`
      + ` · <b>${s.comments}</b> komentar${ev.comments ? '' : ' (komentar nonaktif)'}`
      + (s.reported ? ` · <span style="color:var(--danger)">${s.reported} foto dilaporkan</span>` : '')
      + (s.reportedComments ? ` · <span style="color:var(--danger)">${s.reportedComments} komentar dilaporkan</span>` : '');
    $('#c-status').textContent = ev.comments ? 'Komentar aktif' : 'Komentar nonaktif (ubah di Pengaturan acara)';
    $('#reveal-info').textContent = ev.reveal === 'jadwal' ? `Album dibuka ${fmtDate(ev.revealAt)}` : REVEAL_LABEL[ev.reveal];

    if (!$('#settings').open) {
      $('#form-fields').innerHTML = eventFormHtml(ev);
      bindEventForm($('#edit-form'));
    }
    renderBooth(ev.booth);
    thumbs = thumbs || ThumbLoader(ev.slug, () => null);
    loadPhotos();
    loadComments();
  }

  async function loadPhotos() {
    let data;
    try { data = await api('modList', { id }); }
    catch (err) { toast(err.message); return; }
    $('#no-photos').classList.toggle('hidden', data.total > 0);
    $('#photos').innerHTML = data.photos.map((p) => `
      <figure class="${p.hidden ? 'is-hidden' : ''}" data-id="${p.id}">
        <img alt="Foto oleh ${esc(p.by)}">
        ${p.reports ? `<span class="chip ditolak badge">${p.reports} laporan</span>` : p.hidden ? '<span class="chip badge">Disembunyikan</span>' : ''}
        ${p.caption ? `<span class="cap" title="${esc(p.caption)}">“${esc(p.caption)}”</span>` : ''}
        <span class="by">${esc(p.by)}</span>
        <div class="tools">
          <button class="btn ghost small" data-act="${p.hidden ? 'show' : 'hide'}" style="color:#fff">${p.hidden ? 'Tampilkan' : 'Sembunyikan'}</button>
          <button class="btn danger small" data-act="del">Hapus</button>
        </div>
      </figure>`).join('');
    $$('#photos [data-id]').forEach((el) => thumbs.observe(el));
  }

  async function loadComments() {
    let data;
    try { data = await api('modComments', { id }); }
    catch (err) { $('#mod-comments').innerHTML = `<li class="muted">${esc(err.message)}</li>`; return; }
    $('#no-comments').classList.toggle('hidden', data.comments.length > 0);
    $('#mod-comments').innerHTML = data.comments.map((c) => `
      <li class="${c.hidden ? 'is-hidden' : ''}" data-cid="${c.id}">
        <div class="txt"><b>${esc(c.name)}</b> ${esc(c.text)}
          <div class="small muted">${fmtDate(c.t)}${c.reports ? ` · <span style="color:var(--danger)">${c.reports} laporan</span>` : ''}${c.hidden ? ' · disembunyikan' : ''}</div></div>
        <div class="row" style="flex-wrap:nowrap">
          <button class="btn ghost small" data-cact="${c.hidden ? 'show' : 'hide'}">${c.hidden ? 'Tampilkan' : 'Sembunyikan'}</button>
          <button class="btn danger small" data-cact="del">Hapus</button>
        </div>
      </li>`).join('');
  }

  $('#mod-comments').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cact]'); if (!b) return;
    const cid = b.closest('[data-cid]').dataset.cid, act = b.dataset.cact;
    if (act === 'del' && !confirm('Hapus komentar ini?')) return;
    b.disabled = true;
    try {
      if (act === 'del') await api('deleteComment', { commentId: cid });
      else await api('setCommentHidden', { commentId: cid, hidden: act === 'hide' });
      toast(act === 'del' ? 'Komentar dihapus' : act === 'hide' ? 'Komentar disembunyikan' : 'Komentar ditampilkan');
      loadComments();
    } catch (err) { toast(err.message); b.disabled = false; }
  });

  $('#photos').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const fig = btn.closest('figure');
    const act = btn.dataset.act;
    if (act === 'del' && !confirm('Hapus foto ini? File di Google Drive akan dipindah ke sampah.')) return;
    btn.disabled = true;
    try {
      if (act === 'del') { await api('deletePhoto', { photoId: fig.dataset.id }); fig.remove(); toast('Foto dihapus'); }
      else {
        const hidden = act === 'hide';
        await api('setHidden', { photoId: fig.dataset.id, hidden });
        fig.classList.toggle('is-hidden', hidden);
        fig.querySelector('.badge')?.remove();
        if (hidden) fig.insertAdjacentHTML('afterbegin', '<span class="chip badge">Disembunyikan</span>');
        btn.dataset.act = hidden ? 'show' : 'hide'; btn.textContent = hidden ? 'Tampilkan' : 'Sembunyikan';
        toast(hidden ? 'Foto disembunyikan' : 'Foto ditampilkan');
      }
    } catch (err) { toast(err.message); }
    btn.disabled = false;
  });

  $('#btn-restore').onclick = async () => {
    try { await api('updateEvent', { id, status: 'aktif' }); toast('Acara aktif kembali'); load(); } catch (err) { toast(err.message); }
  };

  $('#edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await api('updateEvent', { id, data: readEventForm(e.target) });
      showMsg($('#msg'), ''); $('#settings').open = false; toast('Perubahan tersimpan'); load();
    } catch (err) { showMsg($('#msg'), err.message); }
    btn.disabled = false;
  });

  $('#btn-archive').onclick = async () => {
    if (!confirm('Arsipkan acara ini? Kamera ditutup dan album tidak bisa dibuka peserta. Foto tetap aman di Google Drive.')) return;
    try { await api('updateEvent', { id, status: 'arsip' }); location.href = './'; } catch (err) { toast(err.message); }
  };

  $('#btn-copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('#link').value); toast('Link disalin'); } catch { $('#link').select(); }
  };

  // Unduh QR sebagai PNG resolusi tinggi untuk dicetak.
  $('#dl-qr').onclick = () => {
    const qr = qrcode(0, 'M'); qr.addData(ev.url); qr.make();
    const n = qr.getModuleCount(), cell = 24, pad = cell * 4, size = n * cell + pad * 2;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(pad + k * cell, pad + r * cell, cell, cell);
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `qr-${ev.slug}.png`; a.click();
  };

  function renderBooth(b) {
    const on = !!(b && b.pin);
    $('#booth-off').classList.toggle('hidden', on);
    $('#booth-on').classList.toggle('hidden', !on);
    $('#booth-state').textContent = on ? 'Aktif' : 'Belum aktif';
    if (!on) return;
    $('#booth-pin').textContent = b.pin;
    $('#booth-url').textContent = b.url.replace(/^https?:\/\//, '');
    if (document.activeElement !== $('#booth-name-input')) $('#booth-name-input').value = b.name;
  }
  async function boothSetup(body, okMsg) {
    try { const r = await api('boothSetup', { id, ...body }); renderBooth(r.booth); if (okMsg) toast(okMsg); }
    catch (err) { toast(err.message); }
  }
  $('#btn-booth-on').onclick = () => boothSetup({}, 'Booth aktif. Masukkan kode di layar booth.');
  $('#btn-booth-name').onclick = () => boothSetup({ name: $('#booth-name-input').value }, 'Nama booth disimpan');
  $('#btn-booth-reset').onclick = () => {
    if (confirm('Buat kode booth baru? Semua layar booth yang sudah terpasang harus dipasang ulang dengan kode baru.')) boothSetup({ reset: true }, 'Kode baru dibuat. Booth lama sudah dicabut.');
  };

  /* ---------- Sampul acara ---------- */
  let coverData = '';
  async function loadCover() {
    if (!ev.cover) { coverData = ''; showCover(); return; }
    const key = 'momen.cover.' + ev.cover;
    coverData = store.get(key) || '';
    if (!coverData) {
      try { coverData = (await api('cover', { slug: ev.slug })).data || ''; if (coverData) store.set(key, coverData); } catch {}
    }
    showCover();
  }
  function showCover() {
    $('#cover-img').classList.toggle('hidden', !coverData);
    $('#cover-empty').classList.toggle('hidden', !!coverData);
    $('#cover-remove').classList.toggle('hidden', !coverData);
    if (coverData) $('#cover-img').src = coverData;
  }
  // Potong 16:9 dan perkecil di browser agar ringan (±100 KB).
  function cropCover(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const W = 1000, H = 563, r = W / H;
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
        if (sw / sh > r) { sx = (sw - sh * r) / 2; sw = sh * r; } else { sy = (sh - sw / r) / 2; sh = sw / r; }
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
        x.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        let q = 0.8, d = c.toDataURL('image/jpeg', q);
        while (d.length > 190 * 1024 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
        URL.revokeObjectURL(img.src); res(d);
      };
      img.onerror = () => rej(new Error('Gambar tidak bisa dibaca. Coba file JPG atau PNG.'));
      img.src = URL.createObjectURL(file);
    });
  }
  $('#cover-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const d = await cropCover(f);
      coverData = d; showCover(); toast('Mengunggah sampul…');
      const r = await api('setCover', { id, image: d });
      ev.cover = r.cover; store.set('momen.cover.' + r.cover, d);
      toast('Sampul tersimpan');
    } catch (err) { toast(err.message); loadCover(); }
  });
  $('#cover-remove').onclick = async () => {
    if (!confirm('Hapus sampul acara?')) return;
    try { await api('setCover', { id }); ev.cover = ''; coverData = ''; showCover(); toast('Sampul dihapus'); } catch (err) { toast(err.message); }
  };

  /* ---------- Poster QR siap cetak (A4, 200 dpi) ---------- */
  function wrapLines(x, text, maxW, maxLines) {
    const words = text.split(/\s+/), lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (x.measureText(t).width <= maxW) line = t;
      else { if (line) lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…'; }
    return lines;
  }
  function roundRect(x, X, Y, W, H, r) { x.beginPath(); x.roundRect ? x.roundRect(X, Y, W, H, r) : x.rect(X, Y, W, H); }
  async function makePoster() {
    try { await Promise.all(['800 120px "Bricolage Grotesque"', '600 48px "Bricolage Grotesque"'].map((f) => document.fonts.load(f))); } catch {}
    const W = 1654, H = 2339, M = 130, accent = ev.accent || '#1A9BA1', ink = inkFor(accent);
    const F = (w, s) => `${w} ${s}px "Bricolage Grotesque", system-ui, sans-serif`;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#FBFBF8'; x.fillRect(0, 0, W, H);
    // Pita atas bercorak strip film
    x.fillStyle = accent; x.fillRect(0, 0, W, 230);
    x.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < W; i += 70) { roundRect(x, i + 18, 22, 34, 26, 6); x.fill(); roundRect(x, i + 18, 182, 34, 26, 6); x.fill(); }
    x.fillStyle = ink; x.font = F(800, 64); x.textBaseline = 'middle';
    x.fillText('📸  Momen TI', M, 115);
    x.font = F(600, 36); x.textAlign = 'right'; x.fillText('Kamera bersama acara', W - M, 118); x.textAlign = 'left';
    // Judul & waktu
    let y = 330;
    x.fillStyle = '#1C2230'; x.textBaseline = 'alphabetic';
    let size = 124; x.font = F(800, size);
    let lines = wrapLines(x, ev.name, W - M * 2, 3);
    if (lines.length > 2) { size = 100; x.font = F(800, size); lines = wrapLines(x, ev.name, W - M * 2, 3); }
    lines.forEach((l) => { y += size; x.fillText(l, M, y); });
    y += 90; x.font = F(500, 46); x.fillStyle = "#5F6878";
    x.fillText(`${fmtDate(ev.start)} – ${fmtTime(ev.end)}`, M, y);
    // Sampul (jika ada)
    y += 60;
    if (coverData) {
      const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = coverData; });
      if (img) {
        const cw = W - M * 2, ch = Math.round(cw / 2.6), sh = img.naturalWidth / 2.6, sy = (img.naturalHeight - sh) / 2;
        x.save(); roundRect(x, M, y, cw, ch, 28); x.clip(); x.drawImage(img, 0, sy, img.naturalWidth, sh, M, y, cw, ch); x.restore();
        y += ch + 70;
      }
    } else y += 30;
    // QR
    const qr = qrcode(0, 'M'); qr.addData(ev.url); qr.make();
    const n = qr.getModuleCount();
    const qs = Math.min(coverData ? 680 : 820, H - y - 360), cell = Math.floor(qs / (n + 4)), qsz = cell * (n + 4);
    x.fillStyle = '#FFFFFF'; x.strokeStyle = '#D3D8E0'; x.lineWidth = 4;
    roundRect(x, M, y, qsz + 40, qsz + 40, 32); x.fill(); x.stroke();
    x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(M + 20 + (k + 2) * cell, y + 20 + (r + 2) * cell, cell, cell);
    // Langkah-langkah
    const sx = M + qsz + 110, steps = [['Scan QR', 'dengan kamera HP'], ['Isi nama & potret', 'pilih filter favoritmu'], ['Lihat album', 'semua foto acara di satu tempat']];
    let sy2 = y + 40;
    steps.forEach(([t, d], i) => {
      x.fillStyle = accent; x.beginPath(); x.arc(sx + 42, sy2 + 42, 42, 0, Math.PI * 2); x.fill();
      x.fillStyle = ink; x.font = F(800, 46); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), sx + 42, sy2 + 44);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#1C2230'; x.font = F(700, 50); x.fillText(t, sx + 115, sy2 + 40);
      x.fillStyle = '#5F6878'; x.font = F(500, 36); x.fillText(d, sx + 115, sy2 + 88);
      sy2 += Math.max(170, qsz / 3.2);
    });
    if (ev.code) {
      x.fillStyle = '#1C2230'; x.font = F(600, 40); x.fillText('Kode akses:', sx, sy2 + 20);
      x.font = F(800, 64); x.fillStyle = accent === '#F2A93B' ? '#1C2230' : accent; x.fillText(ev.code, sx, sy2 + 95);
    }
    // Kaki poster
    x.fillStyle = '#5F6878'; x.font = F(500, 34); x.textAlign = 'center';
    x.fillText('Tanpa install aplikasi · Foto tersimpan di album acara', W / 2, H - 140);
    x.font = F(500, 28); x.fillStyle = '#8B95A6';
    x.fillText(ev.url.replace(/^https?:\/\//, ''), W / 2, H - 90);
    return c;
  }
  $('#dl-poster').onclick = async () => {
    const b = $('#dl-poster'); b.disabled = true; b.textContent = 'Menyiapkan…';
    try {
      const c = await makePoster();
      const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `poster-${ev.slug}.png`; a.click();
    } catch (err) { toast('Poster gagal dibuat: ' + err.message); }
    b.disabled = false; b.textContent = 'Unduh poster';
  };

  load();
})();
