(function () {
  const slug = qs('e') || '';
  const pt = () => PT.get(slug);
  $('#back').href = `acara.html?e=${encodeURIComponent(slug)}`;
  $('#fab').href = `acara.html?e=${encodeURIComponent(slug)}`;

  /* ---------- Lapisan (penampil foto, daftar aktivitas) yang ikut tombol "kembali" HP ---------- */
  // Saat lapisan dibuka, satu langkah riwayat ditambahkan. Tombol kembali di HP/browser menutup lapisan,
  // bukan keluar dari album.
  function openLayer(dlg) {
    if (dlg.open) return;
    dlg.showModal();
    history.pushState({ layer: dlg.id }, '');
    $('#fab').classList.add('hidden');
  }
  function closeLayer(dlg) {
    if (!dlg.open) return;
    if (history.state && history.state.layer === dlg.id) history.back(); // popstate yang menutup
    else { dlg.close(); afterClose(); }
  }
  function afterClose() { $('#fab').classList.toggle('hidden', !(data && data.cameraOpen)); }
  window.addEventListener('popstate', () => {
    ['viewer', 'act-dlg'].forEach((id) => { const d = $('#' + id); if (d.open) d.close(); });
    afterClose();
  });
  ['viewer', 'act-dlg'].forEach((id) => $('#' + id).addEventListener('cancel', (e) => { e.preventDefault(); closeLayer($('#' + id)); }));
  if (!configured()) { $('#sub').textContent = ''; $('main').insertAdjacentHTML('afterbegin', setupWarning()); return; }

  const thumbs = ThumbLoader(slug, pt);
  const full = new Map();           // foto resolusi penuh yang sudah diambil
  const commentCache = new Map();   // komentar per foto
  let data = null, photos = [], view = [], idx = 0, commentsOpen = false, tab = 'semua';

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
    applyAccent(data.event.accent);
    document.title = `Album · ${data.event.name}`;
    $('#title').textContent = data.event.name;
    $('#manage').classList.toggle('hidden', !data.manager);
    $('#sub').textContent = photos.length
      ? `${photos.length} foto dari ${data.people} orang${data.manager && !data.revealed ? ' · Kamu melihat sebagai admin, peserta belum bisa melihat album ini.' : ''}`
      : 'Belum ada foto di album ini.';
    renderTools();
    afterClose();
    $('#tabs').classList.toggle('hidden', !photos.length);
    $('#tabs [data-tab="saya"]').classList.toggle('hidden', !data.joined);
    // Efek "cuci film" hanya saat pertama kali album yang sudah dibuka dilihat di HP ini.
    const devKey = 'momen.dev.' + slug;
    if (data.revealed && photos.length && !store.get(devKey)) { $('#grid').classList.add('develop'); store.set(devKey, '1'); }
    setupDays();
    renderGrid();
  }

  /* ---------- Pengelompokan per hari ---------- */
  const PER_DAY = 12; // di tampilan "Semua hari", tiap hari hanya menampilkan sekian foto pertama
  const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD (WIB)
  const dayLabel = (key, long) => new Date(key + 'T12:00:00+07:00').toLocaleDateString('id-ID',
    long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
  let days = [], day = null, daysReady = false; // day = null berarti "Semua hari"

  // Saat acara berlangsung, foto terbaru di atas. Setelah selesai, urut dari awal acara.
  const newestFirst = () => !!(data && data.cameraOpen);
  const byTime = (a, b) => (newestFirst() ? (a.t < b.t ? 1 : -1) : (a.t < b.t ? -1 : 1));

  function setupDays() {
    days = [...new Set(photos.map((p) => dayKey(p.t)))].sort();
    if (!daysReady) { day = days.length > 1 ? days[days.length - 1] : null; daysReady = true; } // bawaan: hari terakhir
    if (day && !days.includes(day)) day = days.length > 1 ? days[days.length - 1] : null;
    renderDayChips();
  }
  function renderDayChips() {
    const el = $('#days');
    el.classList.toggle('hidden', days.length < 2);
    if (days.length < 2) return;
    const count = (k) => photos.filter((p) => dayKey(p.t) === k).length;
    const order = newestFirst() ? [...days].reverse() : days;
    el.innerHTML = `<button role="tab" data-day="" aria-selected="${day === null}">Semua hari</button>` +
      order.map((k) => `<button role="tab" data-day="${k}" aria-selected="${day === k}">Hari ${days.indexOf(k) + 1} · ${dayLabel(k)} <span>${count(k)}</span></button>`).join('');
    el.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  $('#days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    day = b.dataset.day || null;
    renderDayChips(); renderGrid();
  });

  function tile(p, i, fresh) {
    return `<button data-i="${i}" data-id="${p.id}" class="${fresh.has(p.id) ? 'has-new' : ''}" aria-label="Foto oleh ${esc(p.by)}${fresh.has(p.id) ? ', ada aktivitas baru' : ''}"><img alt=""><span class="counts">${countsHtml(p)}</span></button>`;
  }

  function renderGrid() {
    // 1) Saring menurut tab
    let base;
    if (tab === 'saya') base = photos.filter((p) => p.mine).sort(byTime);
    else if (tab === 'favorit') base = photos.filter((p) => reactTotal(p) > 0).sort((a, b) => reactTotal(b) - reactTotal(a));
    else base = [...photos].sort(byTime);
    const empty = tab === 'saya' ? ['📷', 'Kamu belum memotret di acara ini.']
      : tab === 'favorit' ? ['❤️', 'Belum ada foto yang diberi reaksi. Buka foto dan ketuk emoji favoritmu!']
      : ['🎞️', 'Belum ada foto di album ini. Jadilah yang pertama memotret!'];
    const fresh = data.joined ? newPhotoIds() : new Set();
    let html = '';

    if (days.length > 1 && day === null) {
      // 2a) Semua hari: dikelompokkan, tiap hari maksimal PER_DAY foto + tombol "Lihat semua"
      view = [];
      const order = newestFirst() ? [...days].reverse() : days;
      order.forEach((k) => {
        const list = base.filter((p) => dayKey(p.t) === k);
        if (!list.length) return;
        const shown = list.slice(0, PER_DAY);
        html += `<h2 class="day-head">Hari ${days.indexOf(k) + 1} · ${dayLabel(k, true)} <span>${list.length} foto</span></h2>`;
        html += shown.map((p) => tile(p, view.push(p) - 1, fresh)).join('');
        if (list.length > shown.length) html += `<button class="more-btn" data-goday="${k}">Lihat semua ${list.length} foto hari ini ›</button>`;
      });
    } else {
      // 2b) Satu hari tertentu (atau acara satu hari): semua foto
      view = day ? base.filter((p) => dayKey(p.t) === day) : base;
      html = view.map((p, i) => tile(p, i, fresh)).join('');
    }
    const emptyMsg = day && tab === 'semua' ? ['🗓️', 'Belum ada foto di hari ini.'] : empty;
    $('#grid').innerHTML = view.length ? html : `<p class="empty-note" style="grid-column:1/-1"><span class="big">${emptyMsg[0]}</span>${emptyMsg[1]}</p>`;
    $$('#grid [data-id]').forEach((el) => thumbs.observe(el));
  }
  $('#grid').addEventListener('click', (e) => {
    const m = e.target.closest('[data-goday]'); if (!m) return;
    day = m.dataset.goday; renderDayChips(); renderGrid();
    window.scrollTo({ top: $('#days').offsetTop - 12, behavior: 'smooth' });
  });
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab;
    $$('#tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', x === b));
    renderGrid();
  });

  /* ---------- Aktivitas di foto milik sendiri ---------- */
  const SEEN_KEY = 'momen.act.' + slug;
  const seenAt = () => store.get(SEEN_KEY) || '';
  const newItems = () => (data.activity || []).filter((a) => a.t > seenAt());
  const newPhotoIds = () => new Set(newItems().map((a) => a.photoId));

  function actText(a) {
    if (a.type === 'comment') return `<b>${esc(a.name)}</b> berkomentar: “${esc(a.text)}”`;
    const em = Object.entries(a.emojis).sort((x, y) => y[1] - x[1]).map(([e]) => e).join('');
    return `<b>${a.count} orang</b> memberi reaksi ${em}`;
  }
  function openActivity() {
    const items = data.activity || [], seen = seenAt();
    $('#act-list').innerHTML = items.length ? items.map((a, i) => {
      const p = photos.find((x) => x.id === a.photoId);
      return `<li><button type="button" data-ai="${i}" class="${a.t > seen ? 'is-new' : ''}">
        <span class="act-thumb">${p ? `<img src="${thumbs.get(p.id) || ''}" alt="">` : ''}</span>
        <span class="act-txt">${actText(a)}<small>${fmtDate(a.t)}</small></span></button></li>`;
    }).join('') : '<li class="muted" style="padding:1rem 0">Belum ada aktivitas di fotomu.</li>';
    openLayer($('#act-dlg'));
    if (items.length) store.set(SEEN_KEY, items[0].t); // tandai sudah dilihat (memakai waktu server)
    renderTools();
    $$('#grid .has-new').forEach((el) => el.classList.remove('has-new'));
  }
  $('#act-close').onclick = () => closeLayer($('#act-dlg'));
  $('#act-dlg').addEventListener('click', (e) => {
    if (e.target === $('#act-dlg')) return closeLayer($('#act-dlg'));
    const b = e.target.closest('[data-ai]'); if (!b) return;
    const a = data.activity[+b.dataset.ai];
    $('#act-dlg').close(); // riwayat dipakai ulang untuk penampil foto
    if (history.state && history.state.layer === 'act-dlg') history.replaceState({ layer: 'viewer' }, '');
    if (tab !== 'semua') { tab = 'semua'; $$('#tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', x.dataset.tab === 'semua')); renderGrid(); }
    let i = view.findIndex((p) => p.id === a.photoId);
    if (i < 0) {
      const ph = photos.find((p) => p.id === a.photoId);
      if (ph && days.length > 1) { day = dayKey(ph.t); renderDayChips(); renderGrid(); i = view.findIndex((p) => p.id === a.photoId); }
    }
    if (i < 0) return toast('Foto ini sudah tidak tersedia.');
    if (a.type === 'comment' && data.event.comments) commentsOpen = true;
    open(i);
  });

  function renderTools() {
    const mine = photos.filter((p) => p.mine).length;
    const n = data.joined ? newItems().length : 0;
    $('#tools').innerHTML =
      (data.joined ? `<button class="btn ghost small" id="btn-act">🔔 Aktivitas${n ? `<span class="count-badge">${n}</span>` : ''}</button>` : '') +
      (mine ? `<button class="btn small" id="dl-mine">Unduh foto saya (${mine})</button>` : '') +
      (data.folderUrl ? `<a class="btn ghost small" href="${esc(data.folderUrl)}" target="_blank" rel="noopener">Folder Drive (unduh semua)</a>` : '') +
      '<button class="btn ghost small" id="btn-fb">💬 Beri masukan</button>';
    $('#dl-mine')?.addEventListener('click', downloadMine);
    $('#btn-act')?.addEventListener('click', openActivity);
    $('#btn-fb').onclick = () => Feedback.open({ slug, page: 'album' });
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
    if (!view.length) return;
    idx = (i + view.length) % view.length;
    const p = view[idx];
    $('#v-img').src = full.get(p.id) || thumbs.get(p.id) || '';
    $('#v-img').alt = `Foto oleh ${p.by}`;
    $('#v-by').textContent = `${p.by} · ${fmtTime(p.t)}`;
    $('#v-report').classList.toggle('hidden', !!p.mine || !data.joined);
    $('#v-del').classList.toggle('hidden', !p.mine);
    renderReacts(p);
    const commentsOn = data.event.comments;
    $('#v-ctoggle').classList.toggle('hidden', !commentsOn);
    $('#v-ctoggle').textContent = `Komentar (${p.comments})`;
    $('#v-comments').classList.toggle('hidden', !(commentsOn && commentsOpen));
    if (commentsOn && commentsOpen) loadComments(p);
    if (!$('#viewer').open) {
      if (history.state && history.state.layer === 'viewer') { $('#viewer').showModal(); $('#fab').classList.add('hidden'); }
      else openLayer($('#viewer'));
    }
    setDlReady(full.has(p.id));
    if (!full.has(p.id)) {
      try {
        const r = await api('photo', { slug, pt: pt(), id: p.id });
        full.set(p.id, r.data);
        if (view[idx] === p) { $('#v-img').src = r.data; setDlReady(true); }
      } catch (err) { if (view[idx] === p) { setDlReady(false, 'Gagal memuat'); toast(err.message); } }
    }
  }
  function setDlReady(ok, label) {
    const b = $('#v-dl');
    b.disabled = !ok;
    b.textContent = ok ? 'Unduh' : (label || 'Memuat foto…');
  }

  $('#grid').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) open(+b.dataset.i); });
  $('#v-close').onclick = () => closeLayer($('#viewer'));
  // Geser kiri/kanan untuk berpindah foto.
  let touchX = null;
  $('.viewer-img').addEventListener('touchstart', (e) => { touchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  $('.viewer-img').addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) open(idx + (dx < 0 ? 1 : -1));
  });
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
    const p = view[idx];
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
    if (view[idx] === p) renderReacts(p);
    refreshCounts(p);
  });

  /* ---------- Komentar ---------- */
  $('#v-ctoggle').onclick = () => {
    commentsOpen = !commentsOpen;
    $('#v-comments').classList.toggle('hidden', !commentsOpen);
    if (commentsOpen) loadComments(view[idx], true);
  };

  async function loadComments(p, refresh) {
    $('#c-form').classList.toggle('hidden', !data.joined);
    if (commentCache.has(p.id) && !refresh) return renderComments(p);
    if (!commentCache.has(p.id)) $('#c-list').innerHTML = '<p class="v-note">Memuat komentar…</p>';
    try {
      const r = await api('comments', { slug, pt: pt(), id: p.id });
      commentCache.set(p.id, r.comments);
      if (view[idx] === p) renderComments(p);
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
    const p = view[idx], input = $('#c-text'), text = input.value.trim();
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
    const cid = b.closest('[data-cid]').dataset.cid, act = b.dataset.cact, p = view[idx];
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
      s.src = 'js/vendor/jszip.min.js';
      s.onload = res; s.onerror = () => { zipLib = null; rej(new Error('Gagal memuat alat ZIP. Periksa koneksi.')); };
      document.head.append(s);
    }));
  }

  $('#v-dl').onclick = async () => {
    const p = view[idx], d = full.get(p.id);
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

  /* ---------- Hapus foto sendiri ---------- */
  $('#v-del').onclick = async () => {
    const p = view[idx];
    if (!confirm('Hapus foto ini? Foto tidak bisa dikembalikan, dan jatah foto tidak bertambah.')) return;
    const b = $('#v-del'); b.disabled = true;
    try {
      await api('deleteMine', { slug, pt: pt(), id: p.id });
      photos = photos.filter((x) => x.id !== p.id);
      data.activity = (data.activity || []).filter((a) => a.photoId !== p.id);
      closeLayer($('#viewer'));
      $('#sub').textContent = photos.length ? `${photos.length} foto` : 'Belum ada foto di album ini.';
      renderTools(); setupDays(); renderGrid();
      toast('Foto dihapus');
    } catch (err) { toast(err.message); }
    b.disabled = false;
  };

  /* ---------- Laporkan foto ---------- */
  $('#v-report').onclick = async () => {
    const reason = prompt('Kenapa foto ini perlu ditinjau admin? (opsional)');
    if (reason === null) return;
    try {
      const r = await api('report', { slug, pt: pt(), id: view[idx].id, reason });
      toast(r.hidden ? 'Foto disembunyikan sambil menunggu tinjauan admin' : 'Laporan terkirim ke admin');
    } catch (err) { toast(err.message); }
  };

  load();
})();
