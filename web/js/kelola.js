(function () {
  $('.app-name').textContent = MOMEN.APP_NAME;
  if (!configured()) { $('#ev-name').textContent = ''; $('main').insertAdjacentHTML('afterbegin', setupWarning()); return; }
  if (!Auth.get()) { location.replace('./?next=' + encodeURIComponent(location.href)); return; }

  const id = qs('id');
  let ev, cursor = 0;

  async function load() {
    let data;
    try { data = await api('getManage', { id }); }
    catch (err) { $('#ev-name').textContent = err.message; return; }
    ev = data.event;
    $('#content').classList.remove('hidden');
    document.title = `${ev.name} · ${MOMEN.APP_NAME}`;
    $('#ev-name').textContent = ev.name;
    $('#ev-meta').innerHTML = `
      <span class="chip ${ev.status}">${STATUS_LABEL[ev.status]}</span>
      ${ev.status === 'aktif' ? `<span class="chip">${PHASE_LABEL[ev.state.phase]}</span>` : ''}
      <span class="muted">${fmtDate(ev.start)} – ${fmtTime(ev.end)}</span>
      ${ev.code ? `<span class="muted">Kode akses: <b>${esc(ev.code)}</b></span>` : ''}`;
    $('#approval').classList.toggle('hidden', !(data.admin && ev.status === 'menunggu'));

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
      + (s.reported ? ` · <span style="color:var(--danger)">${s.reported} foto dilaporkan</span>` : '');
    $('#reveal-info').textContent = ev.reveal === 'jadwal' ? `Album dibuka ${fmtDate(ev.revealAt)}` : REVEAL_LABEL[ev.reveal];

    if (!$('#settings').open) {
      $('#form-fields').innerHTML = eventFormHtml(ev);
      bindEventForm($('#edit-form'));
    }
    cursor = 0; $('#photos').innerHTML = '';
    loadPhotos();
  }

  async function loadPhotos() {
    $('#btn-more').disabled = true;
    let data;
    try { data = await api('modList', { id, cursor }); }
    catch (err) { toast(err.message); $('#btn-more').disabled = false; return; }
    $('#no-photos').classList.toggle('hidden', data.total > 0);
    $('#photos').insertAdjacentHTML('beforeend', data.photos.map((p) => `
      <figure class="${p.hidden ? 'is-hidden' : ''}" data-id="${p.id}">
        <img src="${p.thumb}" alt="Foto oleh ${esc(p.by)}" loading="lazy">
        ${p.reports ? `<span class="chip ditolak badge">${p.reports} laporan</span>` : p.hidden ? '<span class="chip badge">Disembunyikan</span>' : ''}
        <span class="by">${esc(p.by)}${p.byType === 'tamu' ? ' (tamu)' : ''}</span>
        <div class="tools">
          <button class="btn ghost small" data-act="${p.hidden ? 'show' : 'hide'}" style="color:#fff">${p.hidden ? 'Tampilkan' : 'Sembunyikan'}</button>
          <button class="btn danger small" data-act="del">Hapus</button>
        </div>
      </figure>`).join(''));
    cursor = data.next;
    $('#more-box').classList.toggle('hidden', data.next === null);
    $('#btn-more').disabled = false;
  }
  $('#btn-more').onclick = loadPhotos;

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

  $('#approval').addEventListener('click', async (e) => {
    const s = e.target.dataset.status; if (!s) return;
    e.target.disabled = true;
    try { await api('updateEvent', { id, status: s }); toast(s === 'aktif' ? 'Acara disetujui' : 'Acara ditolak'); load(); }
    catch (err) { toast(err.message); e.target.disabled = false; }
  });

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
