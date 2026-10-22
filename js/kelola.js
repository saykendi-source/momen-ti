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
    $('#stats').innerHTML = `<b>${s.participants}</b> peserta bergabung · <b>${s.photos}</b> foto · jatah ${ev.maxPhotos} foto per orang`
      + ` · <b>${s.comments}</b> komentar${ev.comments ? '' : ' (komentar nonaktif)'}`
      + (s.reported ? ` · <span style="color:var(--danger)">${s.reported} foto dilaporkan</span>` : '')
      + (s.reportedComments ? ` · <span style="color:var(--danger)">${s.reportedComments} komentar dilaporkan</span>` : '');
    $('#c-status').textContent = ev.comments ? 'Komentar aktif' : 'Komentar nonaktif (ubah di Pengaturan acara)';
    $('#reveal-info').textContent = ev.reveal === 'jadwal' ? `Album dibuka ${fmtDate(ev.revealAt)}` : REVEAL_LABEL[ev.reveal];

    if (!$('#settings').open) {
      $('#form-fields').innerHTML = eventFormHtml(ev);
      bindEventForm($('#edit-form'));
    }
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

  load();
})();
