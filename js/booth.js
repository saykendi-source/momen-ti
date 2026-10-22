// Layar booth Momen TI untuk layar sentuh besar / Android TV dengan kamera bawaan.
(function () {
  const KEY = 'momen.booth';
  const IDLE_AFTER_MS = 45000;      // kembali ke layar idle bila tidak disentuh
  const RESULT_MS = 25000;          // lama layar hasil + QR
  const WALL_EVERY_MS = 20000;      // perbarui live wall
  const INFO_EVERY_MS = 5 * 60000;  // cek ulang status acara

  let bt = store.get(KEY);
  let info = null, filter = 'asli', stream = null, busy = false;
  let idleTimer = 0, resultTimer = 0, wallTimer = 0, infoTimer = 0, sendingQueue = false;

  const layers = ['s-pair', 's-idle', 's-ready', 's-result', 's-note'];
  function show(id) {
    layers.forEach((l) => $('#' + l).classList.toggle('hidden', l !== id));
    const cam = $('#cam');
    cam.classList.toggle('off', id === 's-pair' || id === 's-result' || id === 's-note');
    cam.classList.toggle('dim', id === 's-idle');
  }
  function toastB(text, ms = 3000) {
    let el = $('.toast-b');
    if (!el) { el = document.createElement('div'); el.className = 'toast-b'; el.setAttribute('role', 'status'); document.body.append(el); }
    el.textContent = text; el.classList.remove('hidden');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), ms);
  }
  function note(title, text, actions = '') {
    $('#note-title').textContent = title; $('#note-text').textContent = text; $('#note-actions').innerHTML = actions;
    show('s-note');
  }
  function qrSvg(text) {
    try {
      const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
    } catch { return '<span>QR tidak tersedia</span>'; }
  }

  /* ---------- Layar penuh & layar tetap menyala ---------- */
  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch {}
  }
  function goFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { keepAwake(); if (info) startCamera(); } });

  /* ---------- Pemasangan ---------- */
  let pin = '';
  function renderPin() { $('#pin-view').innerHTML = Array.from({ length: 6 }, (_, i) => `<span>${pin[i] || ''}</span>`).join(''); }
  function showPair(msg = '') {
    pin = ''; renderPin();
    $('#keypad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']
      .map((k) => `<button data-k="${k}" class="${k === 'ok' ? 'ok' : ''}" aria-label="${k === 'del' ? 'Hapus' : k === 'ok' ? 'Pasang' : k}">${k === 'del' ? '⌫' : k === 'ok' ? 'OK' : k}</button>`).join('');
    $('#pair-msg').textContent = msg;
    show('s-pair');
  }
  async function pressKey(k) {
    if (k === 'del') pin = pin.slice(0, -1);
    else if (k === 'ok') return submitPin();
    else if (/^\d$/.test(k) && pin.length < 6) pin += k;
    renderPin();
    if (pin.length === 6) submitPin();
  }
  async function submitPin() {
    if (pin.length !== 6) { $('#pair-msg').textContent = 'Kode booth terdiri dari 6 angka.'; return; }
    $('#pair-msg').textContent = 'Memeriksa kode…';
    try {
      const r = await api('boothPair', { pin }, { onSlow: (m) => { $('#pair-msg').textContent = m; } });
      bt = r.bt; store.set(KEY, bt);
      $('#pair-msg').textContent = '';
      boot();
    } catch (err) {
      pin = ''; renderPin(); $('#pair-msg').textContent = err.message;
    }
  }
  $('#keypad').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { goFullscreen(); pressKey(b.dataset.k); } });

  /* ---------- Mulai ---------- */
  async function boot() {
    if (!configured()) return note('Belum dikonfigurasi', 'Admin perlu mengisi API_URL di js/config.js.');
    if (!bt) return showPair();
    try {
      info = await api('boothInfo', { bt }, { onSlow: (m) => note('Menyiapkan booth…', m) });
    } catch (err) {
      if (err.code === 'need_pair') { store.del(KEY); bt = null; return showPair(err.message); }
      return note('Booth belum bisa dibuka', err.message, '<button class="big-btn" onclick="location.reload()">Coba lagi</button>');
    }
    const e = info.event;
    filter = e.filter in FILTERS ? e.filter : 'asli';
    document.title = `Booth · ${e.name}`;
    $('#ev-name').textContent = e.name; $('#ev-name2').textContent = e.name;
    $('#ev-sub').textContent = `${fmtDate(e.start)} – ${fmtTime(e.end)}`;
    $('#booth-name').textContent = info.boothName;
    $('#ev-qr').innerHTML = qrSvg(info.eventUrl);
    $('#guide').classList.toggle('hidden', e.frame !== 'polaroid');
    renderFilters();
    await startCamera();
    goIdle();
    clearInterval(infoTimer);
    infoTimer = setInterval(refreshInfo, INFO_EVERY_MS);
    setInterval(sendQueued, 30000);
    sendQueued();
  }

  async function refreshInfo() {
    try { const r = await api('boothInfo', { bt }); info = r; if (!$('#s-idle').classList.contains('hidden')) goIdle(); }
    catch (err) { if (err.code === 'need_pair') { store.del(KEY); location.reload(); } }
  }

  /* ---------- Kamera ---------- */
  async function startCamera() {
    if (stream && stream.active) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      note('Kamera tidak tersedia', 'Browser di layar ini tidak mendukung kamera. Gunakan Chrome atau Fully Kiosk Browser, dan pastikan alamatnya diawali https://.');
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      const v = $('#cam'); v.srcObject = stream; await v.play().catch(() => {});
      return true;
    } catch (err) {
      note('Kamera belum bisa dibuka',
        err.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu muat ulang.' : 'Kamera sedang dipakai aplikasi lain atau tidak terdeteksi. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.',
        '<button class="big-btn" onclick="location.reload()">Coba lagi</button>');
      return false;
    }
  }

  /* ---------- Idle: live wall + ajakan ---------- */
  function canShoot() { return info && info.state.active && info.state.phase === 'berlangsung'; }
  function goIdle() {
    clearTimeout(idleTimer); clearTimeout(resultTimer);
    const st = info.state, e = info.event;
    let status = '';
    if (!st.active) status = 'Acara diarsipkan';
    else if (st.phase === 'belum') status = `Booth dibuka ${fmtDate(e.start)}`;
    else if (st.phase === 'selesai') status = 'Acara sudah selesai. Terima kasih!';
    $('#idle-status').textContent = status;
    $('#btn-start').classList.toggle('hidden', !canShoot());
    show('s-idle');
    loadWall();
    clearInterval(wallTimer); wallTimer = setInterval(loadWall, WALL_EVERY_MS);
    setTimeout(() => $('#btn-start').focus?.(), 50);
  }
  let wallIds = '';
  async function loadWall() {
    if ($('#s-idle').classList.contains('hidden')) return;
    let w;
    try { w = await api('wall', { bt }); } catch { return; }
    const wall = $('#wall');
    if (w.revealed && w.photos.length) {
      const ids = w.photos.map((p) => p.id).join();
      if (ids !== wallIds) {
        wallIds = ids;
        wall.innerHTML = w.photos.filter((p) => p.thumb).map((p, i) => `<figure style="animation-delay:${i * 80}ms"><img src="${p.thumb}" alt=""></figure>`).join('');
      }
      wall.classList.remove('hidden');
      $('#cam').classList.add('off');
      $('#idle-text').textContent = `${w.total} foto dari ${w.people} orang. Pilih filter, berpose, dan scan QR untuk menyimpan fotonya.`;
    } else {
      wall.classList.add('hidden');
      $('#cam').classList.remove('off');
      $('#idle-text').textContent = w.total
        ? `📸 ${w.total} foto sudah diambil. Semua foto dibuka bersamaan nanti. Ayo ikut berfoto!`
        : 'Pilih filter, berpose, dan scan QR untuk menyimpan fotonya.';
    }
  }

  /* ---------- Siap memotret ---------- */
  function renderFilters() {
    $('#filters').innerHTML = Object.entries(FILTERS).map(([k, f]) =>
      `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${f.label}</button>`).join('');
    $('#cam').style.filter = FILTERS[filter].css;
  }
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f;
    $$('#filters button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    $('#cam').style.filter = FILTERS[filter].css;
    bumpIdle();
  });
  function stepFilter(d) {
    const keys = Object.keys(FILTERS);
    filter = keys[(keys.indexOf(filter) + d + keys.length) % keys.length];
    renderFilters();
  }
  function bumpIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(goIdle, IDLE_AFTER_MS); }

  async function goReady() {
    if (!canShoot()) return;
    goFullscreen(); keepAwake();
    clearInterval(wallTimer);
    if (!(await startCamera())) return;
    $('#cam').classList.remove('off');
    show('s-ready');
    $('#cam').style.filter = FILTERS[filter].css;
    bumpIdle();
    setTimeout(() => $('#btn-shoot').focus?.(), 50);
  }
  $('#btn-start').onclick = goReady;
  $('#s-idle').addEventListener('click', (e) => { if (!e.target.closest('.qr-card, #btn-start, #ev-name') && canShoot()) goReady(); });
  $('#btn-back').onclick = goIdle;

  /* ---------- Hitung mundur, kilat, ambil foto ---------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function shoot() {
    if (busy) return;
    const v = $('#cam');
    if (!v.videoWidth) { toastB('Kamera belum siap'); return; }
    busy = true; clearTimeout(idleTimer);
    const cnt = $('#count'); cnt.classList.remove('hidden');
    for (const n of [3, 2, 1]) {
      cnt.innerHTML = `<span>${n}</span><small>${n === 3 ? 'Lihat ke kamera di atas ⬆' : n === 2 ? 'Senyum!' : 'Tahan!'}</small>`;
      await wait(1000);
    }
    cnt.classList.add('hidden');
    // Layar menyala putih penuh sebagai lampu kilat, lalu frame diambil saat wajah paling terang.
    const flash = $('#flash'); flash.classList.add('on');
    await wait(220);
    const takenAt = Date.now();
    const snap = document.createElement('canvas');
    snap.width = v.videoWidth; snap.height = v.videoHeight;
    snap.getContext('2d').drawImage(v, 0, 0);
    await wait(120);
    flash.classList.remove('on');
    $('#processing').classList.remove('hidden');
    await wait(30);
    let photo;
    try {
      const e = info.event;
      const day = new Date(takenAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      photo = await composePhoto(snap, snap.width, snap.height, { mirror: true, filter, frame: e.frame, title: e.name, caption: `${day} · ${info.boothName}` });
    } catch (err) {
      console.error(err); $('#processing').classList.add('hidden'); busy = false; toastB('Foto gagal diproses. Coba lagi.'); bumpIdle(); return;
    }
    $('#processing').classList.add('hidden');
    showResult(photo, takenAt);
    busy = false;
  }
  $('#btn-shoot').onclick = shoot;

  /* ---------- Hasil + QR unduh ---------- */
  async function showResult(photo, takenAt) {
    $('#res-img').src = photo.data;
    $('#res-qr').innerHTML = '<div class="spinner"></div>';
    $('#res-text').textContent = 'Menyimpan fotomu ke album…';
    show('s-result');
    startResultCountdown();
    const item = { id: crypto.randomUUID ? crypto.randomUUID() : String(takenAt), slug: 'booth', filter, takenAt, image: photo.data, thumb: photo.thumb };
    for (let i = 0; i < 4; i++) {
      try {
        const r = await api('boothUpload', { bt, image: item.image, thumb: item.thumb, filter, takenAt });
        $('#res-qr').innerHTML = qrSvg(r.shareUrl);
        $('#res-text').textContent = 'Scan QR ini dengan kamera HP untuk menyimpan fotomu. Foto juga masuk ke album acara.';
        return;
      } catch (err) {
        if (!err.retry) { $('#res-qr').textContent = '—'; $('#res-text').textContent = err.message; return; }
        $('#res-text').textContent = 'Koneksi lambat, mencoba lagi…';
        await wait(2000 * (i + 1));
      }
    }
    // Masih gagal: simpan ke antrean perangkat, dikirim otomatis nanti.
    await Queue.add(item);
    $('#res-qr').textContent = 'QR belum tersedia';
    $('#res-text').textContent = 'Internet sedang bermasalah. Fotomu sudah disimpan di booth dan akan masuk ke album otomatis. Lihat di album acara nanti.';
  }
  function startResultCountdown() {
    clearInterval(resultTimer);
    let left = Math.round(RESULT_MS / 1000);
    const tick = () => { $('#back-in').textContent = `Kembali otomatis dalam ${left} detik`; if (left-- <= 0) { clearInterval(resultTimer); goIdle(); } };
    tick(); resultTimer = setInterval(tick, 1000);
  }
  $('#btn-again').onclick = () => { clearInterval(resultTimer); goReady(); };
  $('#btn-done').onclick = () => { clearInterval(resultTimer); goIdle(); };
  $('#s-result').addEventListener('pointerdown', () => { if (!$('#s-result').classList.contains('hidden')) startResultCountdown(); });

  async function sendQueued() {
    if (sendingQueue || !bt) return;
    sendingQueue = true;
    try {
      for (const it of await Queue.list('booth')) {
        try { await api('boothUpload', { bt, image: it.image, thumb: it.thumb, filter: it.filter, takenAt: it.takenAt }); await Queue.remove(it.id); }
        catch (err) { if (!err.retry) await Queue.remove(it.id); else break; }
      }
    } finally { sendingQueue = false; }
  }

  /* ---------- Remote / keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    const on = (id) => !$('#' + id).classList.contains('hidden');
    if (on('s-pair')) {
      if (/^\d$/.test(e.key)) pressKey(e.key);
      else if (e.key === 'Backspace') pressKey('del');
      else if (e.key === 'Enter') submitPin();
      return;
    }
    const ok = e.key === 'Enter' || e.key === ' ' || e.key === 'MediaPlayPause';
    const back = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack';
    if (on('s-idle') && ok) { e.preventDefault(); goReady(); }
    else if (on('s-ready')) {
      bumpIdle();
      if (ok && (document.activeElement === document.body || document.activeElement?.id === 'btn-shoot')) { e.preventDefault(); shoot(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (document.activeElement?.id === 'btn-shoot' || document.activeElement === document.body) { e.preventDefault(); stepFilter(e.key === 'ArrowLeft' ? -1 : 1); } }
      else if (back) { e.preventDefault(); goIdle(); }
    } else if (on('s-result')) {
      if (back) { e.preventDefault(); goIdle(); }
    }
  });

  // Lepas booth: tekan lama (3 detik) pada nama acara di layar idle.
  let holdTimer = 0;
  $('#ev-name').addEventListener('pointerdown', () => {
    holdTimer = setTimeout(() => {
      if (confirm('Lepas booth dari perangkat ini? Perlu kode booth dari admin untuk memasang lagi.')) { store.del(KEY); location.reload(); }
    }, 3000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => $('#ev-name').addEventListener(ev, () => clearTimeout(holdTimer)));

  boot();
})();
