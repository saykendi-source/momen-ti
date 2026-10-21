(function () {
  const slug = qs('e') || '';
  $('#back').href = `acara.html?e=${encodeURIComponent(slug)}`;
  if (!configured()) { $('#title').textContent = ''; $('main').insertAdjacentHTML('afterbegin', setupWarning()); return; }

  let photos = [], idx = 0, cursor = 0, total = 0;
  const full = new Map(); // cache foto resolusi penuh yang sudah dibuka

  async function loadPage() {
    $('#btn-more').disabled = true;
    let data;
    try { data = await api('album', { slug, pt: PT.get(slug), cursor }); }
    catch (err) {
      $('#title').textContent = $('#title').textContent === 'Memuat…' ? 'Album' : $('#title').textContent;
      const lk = $('#locked'); lk.classList.remove('hidden');
      if (err.code === 'locked') {
        lk.innerHTML = `<h2>Album masih terkunci</h2><p class="muted" style="margin:0">Semua foto dibuka bersamaan. Sampai saat itu, terus memotret!</p>`;
      } else {
        lk.innerHTML = `<h2>Belum bisa melihat album</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="acara.html?e=${encodeURIComponent(slug)}">Buka halaman acara</a>`;
      }
      return;
    }
    document.title = `Album · ${data.event.name}`;
    $('#title').textContent = data.event.name;
    $('#manage').classList.toggle('hidden', !data.manager);
    total = data.total;
    $('#sub').textContent = total
      ? `${total} foto dari ${data.people} orang${data.manager && !data.revealed ? ' · Kamu melihat sebagai admin, peserta belum bisa melihat album ini.' : ''}`
      : 'Belum ada foto di album ini.';
    const start = photos.length;
    photos.push(...data.photos);
    $('#grid').insertAdjacentHTML('beforeend', data.photos.map((p, i) => `
      <button data-i="${start + i}" aria-label="Foto oleh ${esc(p.by)}"><img src="${p.thumb}" alt="" loading="lazy"></button>`).join(''));
    cursor = data.next;
    $('#more-box').classList.toggle('hidden', data.next === null);
    $('#btn-more').disabled = false;
  }
  $('#btn-more').onclick = loadPage;

  async function open(i) {
    if (!photos.length) return;
    idx = (i + photos.length) % photos.length;
    const p = photos[idx];
    $('#v-img').src = full.get(p.id) || p.thumb;
    $('#v-img').alt = `Foto oleh ${p.by}`;
    $('#v-by').textContent = `${p.by}${p.byType === 'tamu' ? ' (tamu)' : ''} · ${fmtTime(p.t)}`;
    $('#v-report').classList.toggle('hidden', !!p.mine);
    if (!$('#viewer').open) $('#viewer').showModal();
    if (!full.has(p.id)) {
      try {
        const r = await api('photo', { slug, pt: PT.get(slug), id: p.id });
        full.set(p.id, r.data);
        if (photos[idx] === p) $('#v-img').src = r.data;
      } catch {}
    }
  }

  $('#grid').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) open(+b.dataset.i); });
  $('#v-close').onclick = () => $('#viewer').close();
  $('#v-prev').onclick = () => open(idx - 1);
  $('#v-next').onclick = () => open(idx + 1);
  $('#viewer').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') open(idx - 1);
    if (e.key === 'ArrowRight') open(idx + 1);
  });

  $('#v-dl').onclick = async () => {
    const p = photos[idx];
    const btn = $('#v-dl'); btn.disabled = true; btn.textContent = 'Menyiapkan…';
    try {
      let data = full.get(p.id);
      if (!data) { data = (await api('photo', { slug, pt: PT.get(slug), id: p.id })).data; full.set(p.id, data); }
      const blob = await (await fetch(data)).blob();
      const name = `${slug}_${p.id.slice(0, 8)}.jpg`;
      const file = new File([blob], name, { type: 'image/jpeg' });
      // Di HP, bagikan langsung ke galeri/WhatsApp bila didukung; selain itu unduh biasa.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (err) { toast(err.message || 'Gagal mengunduh foto.'); }
    btn.disabled = false; btn.textContent = 'Unduh';
  };

  $('#v-report').onclick = async () => {
    const reason = prompt('Kenapa foto ini perlu ditinjau admin? (opsional)');
    if (reason === null) return;
    try {
      const r = await api('report', { slug, pt: PT.get(slug), id: photos[idx].id, reason });
      toast(r.hidden ? 'Foto disembunyikan sambil menunggu tinjauan admin' : 'Laporan terkirim ke admin');
    } catch (err) { toast(err.message); }
  };

  loadPage();
})();
