(function () {
  const slug = qs('e') || '';
  const pt = () => PT.get(slug);
  $('#back').href = `acara.html?e=${encodeURIComponent(slug)}`;
  if (!configured()) { $('#sub').textContent = ''; $('main').insertAdjacentHTML('afterbegin', setupWarning()); return; }

  const thumbs = ThumbLoader(slug, pt);
  const full = new Map();           // foto resolusi penuh yang sudah diambil
  const commentCache = new Map();   // komentar per foto
  let data = null, photos = [], idx = 0, commentsOpen = false;

  /* ---------- Muat album (daftar foto dulu, thumbnail menyusul) ---------- */
  async function load() {
    try {
      data = await api('album', { slug, pt: pt() }, { onSlow: (m) => { $('#sub').textContent = m; } });
    } catch (err) {
      $('#sub').textContent = '';
      const lk = $('#locked'); lk.classList.remove('hidden');
      if (err.code === 'locked') {
        lk.innerHTML = '<h2>Album masih terkunci</h2><p class="muted" style="margin:0">Semua foto dibuka bersamaan. Sampai saat itu, terus memotret!</p>';
      } else {
        lk.innerHTML = `<h2>Belum bisa melihat album</h2><p class="muted">${esc(err.message)}</p>
          <div class="row">${err.retry ? '<button class="btn" id="retry">Coba lagi</button>' : ''}<a class="btn ghost" href="acara.html?e=${encodeURIComponent(slug)}">Buka halaman acara</a></div>`;
        $('#retry')?.addEventListener('click', () => location.reload());
      }
      return;
    }
    photos = data.photos;
    document.title = `Album · ${data.event.name}`;
    $('#title').textContent = data.event.name;
    $('#manage').classList.toggle('hidden', !data.manager);
    $('#sub').textContent = photos.length
      ? `${photos.length} foto dari ${data.people} orang${data.manager && !data.revealed ? ' · Kamu melihat sebagai admin, peserta belum bisa melihat album ini.' : ''}`
      : 'Belum ada foto di album ini.';
    renderTools();
    $('#grid').innerHTML = photos.map((p, i) => `
      <button data-i="${i}" data-id="${p.id}" aria-label="Foto oleh ${esc(p.by)}"><img alt=""><span class="counts">${countsHtml(p)}</span></button>`).join('');
    $$('#grid [data-id]').forEach((el) => thumbs.observe(el));
  }

  function renderTools() {
    const mine = photos.filter((p) => p.mine).length;
    $('#tools').innerHTML =
      (mine ? `<button class="btn small" id="dl-mine">Unduh foto saya (${mine})</button>` : '') +
      (data.folderUrl ? `<a class="btn ghost small" href="${esc(data.folderUrl)}" target="_blank" rel="noopener">Folder Drive (unduh semua)</a>` : '');
    $('#dl-mine')?.addEventListener('click', downloadMine);
  }

  const reactTotal = (p) => Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
  function countsHtml(p) {
    const r = reactTotal(p);
    return (r ? `<span>❤ ${r}</span>` : '') + (p.comments ? `<span>💬 ${p.comments}</span>` : '');
  }
  function refreshCounts(p) {
    const el = $(`#grid [data-id="${p.id}"] .counts`);
    if (el) el.innerHTML = countsHtml(p);
  }

  /* ---------- Penampil foto ---------- */
  async function open(i) {
    if (!photos.length) return;
    idx = (i + photos.length) % photos.length;
    const p = photos[idx];
    $('#v-img').src = full.get(p.id) || thumbs.get(p.id) || '';
    $('#v-img').alt = `Foto oleh ${p.by}`;
    $('#v-by').textContent = `${p.by} · ${fmtTime(p.t)}`;
    $('#v-report').classList.toggle('hidden', !!p.mine || !data.joined);
    renderReacts(p);
    const commentsOn = data.event.comments;
    $('#v-ctoggle').classList.toggle('hidden', !commentsOn);
    $('#v-ctoggle').textContent = `Komentar (${p.comments})`;
    $('#v-comments').classList.toggle('hidden', !(commentsOn && commentsOpen));
    if (commentsOn && commentsOpen) loadComments(p);
    if (!$('#viewer').open) $('#viewer').showModal();
    setDlReady(full.has(p.id));
    if (!full.has(p.id)) {
      try {
        const r = await api('photo', { slug, pt: pt(), id: p.id });
        full.set(p.id, r.data);
        if (photos[idx] === p) { $('#v-img').src = r.data; setDlReady(true); }
      } catch (err) { if (photos[idx] === p) { setDlReady(false, 'Gagal memuat'); toast(err.message); } }
    }
  }
  function setDlReady(ok, label) {
    const b = $('#v-dl');
    b.disabled = !ok;
    b.textContent = ok ? 'Unduh' : (label || 'Memuat foto…');
  }

  $('#grid').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) open(+b.dataset.i); });
  $('#v-close').onclick = () => $('#viewer').close();
  $('#v-prev').onclick = () => open(idx - 1);
  $('#v-next').onclick = () => open(idx + 1);
  $('#viewer').addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') open(idx - 1);
    if (e.key === 'ArrowRight') open(idx + 1);
  });

  /* ---------- Reaksi ---------- */
  function renderReacts(p) {
    const can = data.joined;
    $('#v-reacts').innerHTML = (data.emojis || []).map((em) => {
      const n = (p.reactions || {})[em] || 0;
      return `<button type="button" data-em="${em}" aria-pressed="${p.myReaction === em}" ${can ? '' : 'disabled'} aria-label="Reaksi ${em}">${em}${n ? `<b>${n}</b>` : ''}</button>`;
    }).join('');
    const note = $('#v-note');
    note.textContent = can ? '' : 'Gabung ke acara (scan QR) untuk memberi reaksi.';
    note.classList.toggle('hidden', can);
  }
  $('#v-reacts').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-em]'); if (!b || b.disabled) return;
    const p = photos[idx];
    const before = { reactions: { ...p.reactions }, myReaction: p.myReaction };
    const emoji = p.myReaction === b.dataset.em ? '' : b.dataset.em; // ketuk lagi = batalkan
    // perbarui langsung di layar, lalu sinkron dengan server
    if (p.myReaction) p.reactions[p.myReaction] = Math.max(0, (p.reactions[p.myReaction] || 1) - 1);
    if (emoji) p.reactions[emoji] = (p.reactions[emoji] || 0) + 1;
    p.myReaction = emoji;
    renderReacts(p); refreshCounts(p);
    try {
      const r = await api('react', { slug, pt: pt(), id: p.id, emoji });
      p.reactions = r.reactions; p.myReaction = r.myReaction;
    } catch (err) {
      Object.assign(p, before); toast(err.message);
    }
    if (photos[idx] === p) renderReacts(p);
    refreshCounts(p);
  });

  /* ---------- Komentar ---------- */
  $('#v-ctoggle').onclick = () => {
    commentsOpen = !commentsOpen;
    $('#v-comments').classList.toggle('hidden', !commentsOpen);
    if (commentsOpen) loadComments(photos[idx], true);
  };

  async function loadComments(p, refresh) {
    $('#c-form').classList.toggle('hidden', !data.joined);
    if (commentCache.has(p.id) && !refresh) return renderComments(p);
    if (!commentCache.has(p.id)) $('#c-list').innerHTML = '<p class="v-note">Memuat komentar…</p>';
    try {
      const r = await api('comments', { slug, pt: pt(), id: p.id });
      commentCache.set(p.id, r.comments);
      if (photos[idx] === p) renderComments(p);
    } catch (err) { $('#c-list').innerHTML = `<p class="v-note">${esc(err.message)}</p>`; }
  }

  function renderComments(p) {
    const list = commentCache.get(p.id) || [];
    $('#c-list').innerHTML = list.length ? list.map((c) => `
      <div class="comment ${c.hidden ? 'is-hidden' : ''}" data-cid="${c.id}">
        <b>${esc(c.name)}</b> ${esc(c.text)}
        <div class="meta"><span>${fmtTime(c.t)}</span>
          ${c.hidden ? '<span>disembunyikan</span>' : ''}${c.reports ? `<span>${c.reports} laporan</span>` : ''}
          ${!c.mine && data.joined && !data.manager ? '<button data-cact="report">Laporkan</button>' : ''}
          ${data.manager ? `<button data-cact="${c.hidden ? 'show' : 'hide'}">${c.hidden ? 'Tampilkan' : 'Sembunyikan'}</button><button data-cact="del">Hapus</button>` : ''}
        </div>
      </div>`).join('') : '<p class="v-note">Belum ada komentar. Jadilah yang pertama!</p>';
    $('#c-list').scrollTop = $('#c-list').scrollHeight;
  }

  $('#c-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = photos[idx], input = $('#c-text'), text = input.value.trim();
    if (!text) return;
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try {
      const r = await api('comment', { slug, pt: pt(), id: p.id, text });
      input.value = '';
      commentCache.set(p.id, [...(commentCache.get(p.id) || []), r.comment]);
      p.comments++; refreshCounts(p);
      $('#v-ctoggle').textContent = `Komentar (${p.comments})`;
      renderComments(p);
    } catch (err) { toast(err.message, 3500); }
    btn.disabled = false;
  });

  $('#c-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cact]'); if (!b) return;
    const cid = b.closest('[data-cid]').dataset.cid, act = b.dataset.cact, p = photos[idx];
    try {
      if (act === 'report') {
        if (!confirm('Laporkan komentar ini ke admin?')) return;
        const r = await api('reportComment', { slug, pt: pt(), commentId: cid });
        toast(r.hidden ? 'Komentar disembunyikan sambil menunggu tinjauan admin' : 'Laporan terkirim ke admin');
      } else if (act === 'del') {
        if (!confirm('Hapus komentar ini?')) return;
        await api('deleteComment', { commentId: cid }); toast('Komentar dihapus');
      } else {
        await api('setCommentHidden', { commentId: cid, hidden: act === 'hide' });
        toast(act === 'hide' ? 'Komentar disembunyikan' : 'Komentar ditampilkan');
      }
      loadComments(p, true);
    } catch (err) { toast(err.message); }
  });

  /* ---------- Unduh ---------- */
  function dataUrlToFile(d, name) {
    const bin = atob(d.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: 'image/jpeg' });
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // Di HP: buka menu bagikan (simpan ke galeri/WhatsApp). Di laptop: unduh biasa.
  async function shareOrSave(files, zipName) {
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files }); return; }
      catch (err) { if (err.name === 'AbortError') return; } // dibatalkan pengguna
    }
    if (files.length === 1) return saveBlob(files[0], files[0].name);
    await loadZipLib();
    const zip = new JSZip();
    files.forEach((f) => zip.file(f.name, f));
    saveBlob(await zip.generateAsync({ type: 'blob' }), zipName);
  }
  let zipLib = null;
  function loadZipLib() {
    return zipLib || (zipLib = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = () => { zipLib = null; rej(new Error('Gagal memuat alat ZIP. Periksa koneksi.')); };
      document.head.append(s);
    }));
  }

  $('#v-dl').onclick = async () => {
    const p = photos[idx], d = full.get(p.id);
    if (!d) return;
    try { await shareOrSave([dataUrlToFile(d, `${slug}_${p.id.slice(0, 8)}.jpg`)], ''); }
    catch (err) { toast(err.message || 'Gagal mengunduh foto.'); }
  };

  // Tahap 1: siapkan semua foto milik sendiri. Tahap 2: ketuk lagi untuk menyimpan
  // (browser HP mewajibkan ketukan baru sebelum membuka menu bagikan).
  let prepared = null;
  async function downloadMine() {
    const btn = $('#dl-mine');
    if (prepared) {
      try { await shareOrSave(prepared, `foto-saya_${slug}.zip`); } catch (err) { toast(err.message); }
      return;
    }
    const mine = photos.filter((p) => p.mine);
    btn.disabled = true;
    try {
      const files = [];
      for (let i = 0; i < mine.length; i++) {
        btn.textContent = `Menyiapkan ${i + 1}/${mine.length}…`;
        const p = mine[i];
        if (!full.has(p.id)) full.set(p.id, (await api('photo', { slug, pt: pt(), id: p.id })).data);
        files.push(dataUrlToFile(full.get(p.id), `${slug}_${String(i + 1).padStart(2, '0')}.jpg`));
      }
      prepared = files;
      btn.textContent = `Simpan ${files.length} foto`;
      toast('Foto siap. Ketuk “Simpan” untuk menyimpan.');
    } catch (err) {
      btn.textContent = `Unduh foto saya (${mine.length})`;
      toast(err.message);
    }
    btn.disabled = false;
  }

  /* ---------- Laporkan foto ---------- */
  $('#v-report').onclick = async () => {
    const reason = prompt('Kenapa foto ini perlu ditinjau admin? (opsional)');
    if (reason === null) return;
    try {
      const r = await api('report', { slug, pt: pt(), id: photos[idx].id, reason });
      toast(r.hidden ? 'Foto disembunyikan sambil menunggu tinjauan admin' : 'Laporan terkirim ke admin');
    } catch (err) { toast(err.message); }
  };

  load();
})();
