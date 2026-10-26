const slug = qs('e') || '';
let info = null;          // data acara dari server
let currentFilter = 'asli';
let facing = 'environment';
let stream = null;
let quota = { mode: 'total', left: 0, max: 0, resetAt: null }; // jatah dari server
let quotaTimer = 0;
let sending = false;
let pendingCount = 0;

const screens = ['s-info', 's-join', 's-cam'];
const show = (id) => screens.forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
function infoScreen(title, text, actions = '') {
  stopCamera();
  $('#info-title').textContent = title;
  $('#info-text').textContent = text;
  $('#info-actions').innerHTML = actions;
  show('s-info');
}

/* ---------- Pembukaan halaman: tampilkan dulu dari data tersimpan, perbarui di belakang layar ---------- */
const CACHE_KEY = 'momen.ev.' + slug;
function readCache() { try { return JSON.parse(store.get(CACHE_KEY) || 'null'); } catch { return null; } }
function writeCache(d) { store.set(CACHE_KEY, JSON.stringify(d)); }

// Hitung ulang status acara dari jam HP (dipakai saat menampilkan dari data tersimpan).
function localState(e, active) {
  const now = Date.now(), s = Date.parse(e.start), en = Date.parse(e.end);
  const phase = now < s ? 'belum' : now < en ? 'berlangsung' : 'selesai';
  let rev = false;
  if (e.reveal === 'langsung') rev = now >= s;
  else if (e.reveal === 'setelah') rev = now >= en;
  else if (e.reveal === 'jadwal') rev = !!e.revealAt && now >= Date.parse(e.revealAt);
  return { active, phase, cameraOpen: active && phase === 'berlangsung', revealed: active && rev };
}

let shown = '';         // layar yang sedang tampil: join | arsip | belum | selesai | cam
let camReady = false;   // timer & antrean kamera sudah disiapkan
let endTimer = 0;

function screenOf(d) {
  if (!d.joined) return d.event.status !== 'aktif' ? 'arsip' : 'join';
  if (!d.state.active) return 'arsip';
  return d.state.phase === 'berlangsung' ? 'cam' : d.state.phase;
}

function render(d) {
  info = d;
  const e = d.event, state = d.state;
  applyAccent(e.accent);
  document.title = e.name;
  $$('.ev-name').forEach((el) => (el.textContent = e.name));
  const manageLink = d.canManage ? '<a class="btn ghost block" href="./">Kelola acara</a>' : '';
  const albumBtn = `<a class="btn block" href="album.html?e=${encodeURIComponent(slug)}">Lihat album</a>`;
  const scr = screenOf(d);
  shown = scr;
  if (scr === 'join') { showJoin(); return; }
  if (scr === 'arsip') { infoScreen(e.name, 'Acara ini sudah diarsipkan.', manageLink); return; }
  if (scr === 'belum') { infoScreen(e.name, `Kamera dibuka ${fmtDate(e.start)}. Simpan link ini dan buka lagi saat acara dimulai.`, manageLink); return; }
  if (scr === 'selesai') {
    sendQueue(); // kirim sisa foto yang tertunda
    const t = state.revealed ? 'Acara sudah selesai. Semua foto sudah bisa dilihat.'
      : `Acara sudah selesai. Album dibuka ${e.revealAt ? fmtDate(e.revealAt) : 'sebentar lagi'}.`;
    infoScreen(e.name, t, (state.revealed ? albumBtn : '') + '<button class="btn ghost block" data-fb>💬 Beri masukan</button>' + manageLink);
    return;
  }
  // Kamera
  quota = d.quota || { mode: 'total', left: d.shotsLeft, max: e.maxPhotos, resetAt: null };
  currentFilter = e.filter in FILTERS ? e.filter : 'asli';
  $('#album-link').href = `album.html?e=${encodeURIComponent(slug)}`;
  $('#album-link').classList.toggle('hidden', !(state.revealed || d.canManage));
  $('#vf').classList.toggle('square', e.frame === 'polaroid');
  renderFilters();
  show('s-cam');
  startCamera();
  const savedLast = store.get(LAST_KEY);
  if (savedLast && !$('#last-img').getAttribute('src')) showLast(null, savedLast, false);
  document.fonts?.load('600 40px Caveat').catch(() => {});
  updateCounter();
  if (!camReady) {
    camReady = true;
    setTimeout(checkActivity, 2500);
    actTimer = setInterval(checkActivity, 120000);
    refreshPending().then(() => { updateCounter(); sendQueue(); });
    clearInterval(quotaTimer);
    quotaTimer = setInterval(checkQuota, 30000);
  }
  clearTimeout(endTimer);
  const msLeft = new Date(e.end) - Date.now();
  if (msLeft > 0 && msLeft < 2 ** 31) endTimer = setTimeout(() => init(), msLeft + 1500);
}

async function init() {
  if (!configured()) return infoScreen('Belum dikonfigurasi', 'Admin perlu mengisi js/config.js terlebih dahulu.');
  if (!slug) return infoScreen('Link tidak lengkap', 'Scan ulang QR acara dari panitia.');

  // 1) Tampilkan seketika dari data tersimpan (jika pernah membuka acara ini di HP ini).
  const cached = readCache();
  if (cached && cached.event) {
    cached.state = localState(cached.event, cached.event.status === 'aktif');
    render(cached);
  } else if (!PT.get(slug)) {
    // Kunjungan pertama: formulir gabung langsung tampil, peserta bisa mengetik nama sambil data acara dimuat.
    $$('.ev-name').forEach((el) => (el.textContent = 'Memuat acara…'));
    $('#join-desc').textContent = '';
    $('#btn-join').disabled = true; $('#btn-join').textContent = 'Memuat…';
    show('s-join');
    $('#guest-name').focus();
  }

  // 2) Ambil data terbaru dari server.
  let fresh;
  try {
    fresh = await api('getEvent', { slug, pt: PT.get(slug) }, { onSlow: (m) => { if (!cached) $('#info-text').textContent = m; } });
  } catch (err) {
    if (cached) { if (!err.retry) { store.del(CACHE_KEY); infoScreen('Gagal memuat acara', err.message); } return; }
    return infoScreen(err.code === 'not_found' ? 'Acara tidak ditemukan' : 'Gagal memuat acara', err.message,
      err.retry ? '<button class="btn block" onclick="location.reload()">Coba lagi</button>' : '');
  }
  writeCache({ event: fresh.event, joined: fresh.joined, me: fresh.me, canManage: fresh.canManage, quota: fresh.quota, shotsLeft: fresh.shotsLeft });

  // 3) Jika layar yang seharusnya tampil berbeda, gambar ulang. Jika sama, cukup perbarui jatah & tautan album.
  if (screenOf(fresh) !== shown) render(fresh);
  else {
    info = fresh;
    if (shown === 'join') showJoin(); // perbarui sampul, warna, dan jumlah peserta
    if (shown === 'cam') {
      quota = fresh.quota || quota;
      $('#album-link').classList.toggle('hidden', !(fresh.state.revealed || fresh.canManage));
      updateCounter();
    }
  }
}

async function loadCover(e) {
  const img = $('#join-cover');
  if (!e.cover) { img.classList.add('hidden'); return; }
  const key = 'momen.cover.' + e.cover;
  let d = store.get(key);
  if (!d) {
    try { d = (await api('cover', { slug })).data; } catch { d = ''; }
    if (d) { try { store.set(key, d); } catch {} }
  }
  if (d && info && info.event.cover === e.cover) { img.src = d; img.classList.remove('hidden'); }
}

function showJoin() {
  const e = info.event;
  applyAccent(e.accent);
  loadCover(e);
  const ppl = $('#join-people');
  if (typeof info.people === 'number') {
    ppl.textContent = info.people > 0 ? `📸 ${info.people} orang sudah ikut memotret` : '📸 Jadilah yang pertama ikut memotret!';
    ppl.classList.remove('hidden');
  } else ppl.classList.add('hidden');
  $('#btn-join').disabled = false; $('#btn-join').textContent = 'Mulai memotret';
  $('#join-desc').textContent = `${fmtDate(e.start)} – ${fmtTime(e.end)}${e.description ? '. ' + e.description : ''}`;
  // Admin tidak perlu kode akses.
  $('#code-fields').classList.toggle('hidden', !e.needsCode || info.canManage);
  show('s-join');
  if (!$('#guest-name').value) $('#guest-name').focus();
}

async function doJoin(body) {
  const btn = $('#btn-join');
  btn.disabled = true;
  try {
    const r = await api('join', { slug, ...body });
    PT.set(slug, r.pt);
    showMsg($('#join-msg'), '');
    if (r.info) {
      // Data acara sudah ikut dikirim: langsung tampilkan kamera tanpa menunggu server lagi.
      writeCache({ event: r.info.event, joined: true, me: r.info.me, canManage: r.info.canManage, quota: r.info.quota, shotsLeft: r.info.shotsLeft });
      render(r.info);
    } else { store.del(CACHE_KEY); init(); }
  } catch (err) {
    showMsg($('#join-msg'), err.message);
  }
  btn.disabled = false;
}

$('#join-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const body = { name: $('#guest-name').value.trim(), code: $('#code').value.trim() };
  if (body.name.length < 2) return showMsg($('#join-msg'), 'Tulis nama kamu (minimal 2 huruf).');
  if (info.event.needsCode && !info.canManage && !body.code) return showMsg($('#join-msg'), 'Masukkan kode akses dari panitia.');
  doJoin(body);
});

/* ---------- Kamera ---------- */
let streamFacing = '';
async function startCamera() {
  if (stream && stream.active && streamFacing === facing) { const v = $('#video'); if (v.srcObject !== stream) { v.srcObject = stream; v.play().catch(() => {}); } return; }
  stopCamera();
  if (!navigator.mediaDevices?.getUserMedia) {
    return infoScreen('Kamera tidak tersedia', 'Buka link ini lewat Chrome (Android) atau Safari (iPhone), dan pastikan alamatnya diawali https://.');
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false,
    });
    streamFacing = facing;
    const v = $('#video');
    v.srcObject = stream;
    await v.play().catch(() => {});
    $('#vf').classList.toggle('mirror', facing === 'user');
  } catch (err) {
    infoScreen('Kamera belum bisa dibuka',
      err.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Buka pengaturan situs di browser, izinkan kamera, lalu muat ulang halaman ini.'
        : 'Kamera sedang dipakai aplikasi lain atau tidak ditemukan. Tutup aplikasi kamera lain, lalu coba lagi.',
      '<button class="btn block" onclick="location.reload()">Coba lagi</button>');
  }
}
function stopCamera() { stream?.getTracks().forEach((t) => t.stop()); stream = null; }

$('#flip').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera();
  else if (!$('#s-cam').classList.contains('hidden')) { startCamera(); sendQueue(); checkQuota(true); checkActivity(); }
});
window.addEventListener('online', () => sendQueue());

function renderFilters() {
  $('#filters').innerHTML = Object.entries(FILTERS).map(([k, f]) =>
    `<button type="button" data-f="${k}" aria-pressed="${k === currentFilter}" aria-label="Filter ${f.label} (${f.mood})"><canvas width="96" height="96" style="filter:${f.css}"></canvas>${f.label}</button>`).join('');
  $('#video').style.filter = FILTERS[currentFilter].css;
  requestAnimationFrame(() => $('#filters [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  startPreviews();
}

// Pratinjau tiap filter: potongan kecil dari kamera diperbarui tiap detik (ringan, tanpa olah piksel).
let previewTimer = 0;
function startPreviews() {
  clearInterval(previewTimer);
  const draw = () => {
    const v = $('#video');
    if (document.hidden || $('#s-cam').classList.contains('hidden') || !v.videoWidth) return;
    const s = Math.min(v.videoWidth, v.videoHeight), sx = (v.videoWidth - s) / 2, sy = (v.videoHeight - s) / 2;
    $$('#filters canvas').forEach((c) => {
      const x = c.getContext('2d');
      x.save();
      if (facing === 'user') { x.translate(c.width, 0); x.scale(-1, 1); }
      x.drawImage(v, sx, sy, s, s, 0, 0, c.width, c.height);
      x.restore();
    });
  };
  draw();
  previewTimer = setInterval(draw, 1000);
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  currentFilter = b.dataset.f;
  $$('#filters button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  $('#video').style.filter = FILTERS[currentFilter].css;
});

const unlimited = () => quota.mode === 'bebas';
const leftNow = () => (unlimited() ? Infinity : Math.max(0, quota.left - pendingCount));

let lastShown = null;
function updateCounter() {
  const left = leftNow();
  const txt = unlimited() ? '∞' : String(left);
  const el = $('#shots');
  if (lastShown !== null && lastShown !== txt) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
  lastShown = txt;
  el.textContent = txt;
  $('#shots-label').textContent = unlimited() ? 'tanpa batas' : quota.mode === 'harian' ? 'sisa hari ini' : quota.mode === 'rol' ? 'sisa di rol' : 'sisa foto';
  $('#shutter').disabled = left <= 0;
  $('#shutter').setAttribute('aria-label', left <= 0 ? 'Jatah foto habis' : 'Ambil foto');
  updateQuotaNote();
}

function untilText(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'sebentar lagi';
  const total = Math.ceil(ms / 60000), h = Math.floor(total / 60), m = total % 60;
  return h ? `${h} jam${m ? ` ${m} menit` : ''} lagi` : `${m} menit lagi`;
}
function updateQuotaNote() {
  const el = $('#quota-note');
  if (unlimited() || leftNow() > 0 || pendingCount > 0) { el.classList.add('hidden'); return; }
  let t;
  if (quota.mode === 'harian') t = quota.resetAt ? `Jatah hari ini habis. Jatah baru besok pukul 00.00 (<b>${untilText(quota.resetAt)}</b>).` : 'Jatah hari ini habis, dan ini hari terakhir acara.';
  else if (quota.mode === 'rol') t = quota.resetAt ? `Rol film habis. Rol baru dalam <b>${untilText(quota.resetAt)}</b>.` : 'Rol film habis, dan ini rol terakhir acara.';
  else t = 'Jatah foto habis. Minta admin menambah jatah, atau berfoto di booth jika tersedia.';
  el.innerHTML = t;
  el.classList.remove('hidden');
}

// Periksa jatah ke server: saat jatah habis (mungkin admin menambah), atau saat rol/hari baru tiba.
async function checkQuota(force) {
  if (document.hidden || $('#s-cam').classList.contains('hidden')) return;
  const due = quota.resetAt && Date.now() >= new Date(quota.resetAt);
  if (!force && !due && (unlimited() || leftNow() > 0)) { updateQuotaNote(); return; }
  try {
    const r = await api('getEvent', { slug, pt: PT.get(slug) });
    if (!r.quota) return;
    const before = leftNow();
    quota = r.quota;
    if (before <= 0 && leftNow() > 0) celebrate();
    updateCounter();
  } catch {}
}

function celebrate() {
  const title = quota.mode === 'rol' ? 'Rol baru!' : quota.mode === 'harian' ? 'Jatah baru hari ini!' : 'Jatah foto ditambah!';
  $('#roll-title').textContent = title;
  $('#roll-text').textContent = `${leftNow()} foto siap dipakai`;
  const b = $('#roll-banner');
  b.classList.remove('hidden');
  navigator.vibrate?.([40, 60, 40]);
  setTimeout(() => b.classList.add('hidden'), 2200);
}
$('#roll-banner').addEventListener('click', () => $('#roll-banner').classList.add('hidden'));

/* ---------- Ambil foto ---------- */
$('#shutter').addEventListener('click', async () => {
  const v = $('#video');
  if (!stream || !v.videoWidth || leftNow() <= 0) return;
  $('#shutter').disabled = true;
  const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  navigator.vibrate?.(30);
  try {
    const takenAt = Date.now();
    const work = capturePhoto(v);
    await document.fonts?.load('600 40px Caveat').catch(() => {});
    const caption = info.event.captions ? await askCaption(work, takenAt) : '';
    const full = composePhoto(work, takenAt, caption);
    const thumb = await makeThumb(full);
    showLast(full.data, thumb, true);
    const qid = crypto.randomUUID ? crypto.randomUUID() : String(takenAt) + Math.random();
    lastQueueId = qid; lastServerId = ''; store.del(LAST_ID_KEY);
    await Queue.add({ id: qid, slug, filter: currentFilter, takenAt, image: full.data, thumb, caption });
    await refreshPending();
    updateCounter();
    sendQueue();
  } catch (err) {
    console.error(err);
    toast('Foto gagal diproses. Coba lagi.');
  } finally {
    updateCounter();
  }
});

/* ---------- Foto terakhir di pojok ---------- */
let lastFull = null, lastQueueId = '', lastServerId = '';
const LAST_KEY = 'momen.last.' + slug, LAST_ID_KEY = 'momen.lastid.' + slug;
function showLast(fullData, thumb, animate) {
  lastFull = fullData;
  const btn = $('#last'), img = $('#last-img');
  const set = () => { img.src = thumb; img.classList.remove('hidden'); btn.disabled = false; };
  store.set(LAST_KEY, thumb);
  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return set();
  // Foto "terbang" dari tengah jendela bidik ke tombol di pojok kiri bawah.
  const fly = $('#fly'), vf = $('#vf').getBoundingClientRect(), tb = btn.getBoundingClientRect();
  fly.src = thumb; fly.classList.remove('hidden');
  fly.style.transition = 'none'; fly.style.transform = 'translate(-50%, -50%)'; fly.style.opacity = '1';
  void fly.offsetWidth;
  const dx = tb.left + tb.width / 2 - (vf.left + vf.width / 2), dy = tb.top + tb.height / 2 - (vf.top + vf.height / 2);
  const scale = tb.width / fly.getBoundingClientRect().width;
  fly.style.transition = 'transform .55s cubic-bezier(.5,0,.2,1), opacity .55s';
  fly.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
  setTimeout(() => { fly.classList.add('hidden'); set(); }, 560);
}
$('#last').addEventListener('click', () => {
  const src = lastFull || $('#last-img').src;
  if (!src) return;
  $('#last-full').src = src;
  const open = info && info.state && (info.state.revealed || info.canManage);
  $('#last-album').classList.toggle('hidden', !open);
  $('#last-album').href = `album.html?e=${encodeURIComponent(slug)}`;
  lastServerId = lastServerId || store.get(LAST_ID_KEY) || '';
  const sent = !!lastServerId;
  $('#last-note').textContent = !sent ? 'Foto ini sedang dikirim ke album…'
    : open ? 'Foto ini sudah masuk ke album acara.' : 'Foto ini tersimpan di album dan akan terlihat saat album dibuka.';
  $('#last-del').disabled = !sent;
  $('#last-del').textContent = sent ? 'Hapus foto ini' : 'Sedang dikirim…';
  $('#last-view').classList.remove('hidden');
});
$('#last-del').addEventListener('click', async () => {
  if (!lastServerId) return;
  if (!confirm('Hapus foto ini? Foto tidak bisa dikembalikan, dan jatah foto tidak bertambah.')) return;
  const b = $('#last-del'); b.disabled = true;
  try {
    await api('deleteMine', { slug, pt: PT.get(slug), id: lastServerId });
    lastFull = null; lastServerId = ''; store.del(LAST_KEY); store.del(LAST_ID_KEY);
    $('#last-img').classList.add('hidden'); $('#last-img').removeAttribute('src'); $('#last').disabled = true;
    $('#last-view').classList.add('hidden');
    toast('Foto dihapus');
  } catch (err) { toast(err.message); b.disabled = false; }
});

/* ---------- Titik merah di tombol Album bila ada aktivitas baru di foto kita ---------- */
let actTimer = 0;
async function checkActivity() {
  if (!info || !info.state || !info.state.revealed || document.hidden || $('#s-cam').classList.contains('hidden')) return;
  try {
    const r = await api('activity', { slug, pt: PT.get(slug) });
    const seen = store.get('momen.act.' + slug) || '';
    $('#album-link').classList.toggle('has-dot', r.items.some((a) => a.t > seen));
  } catch {}
}
$('#last-close').onclick = () => $('#last-view').classList.add('hidden');

/** Ambil frame video → potong → filter film. Mengembalikan kanvas foto (tanpa bingkai). */
function capturePhoto(v) {
  const polaroid = info.event.frame === 'polaroid';
  const vw = v.videoWidth, vh = v.videoHeight;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (polaroid) { const s = Math.min(vw, vh); sx = (vw - s) / 2; sy = (vh - s) / 2; sw = sh = s; }
  const scale = Math.min(1, (polaroid ? 1600 : 2048) / Math.max(sw, sh));
  const pw = Math.round(sw * scale), ph = Math.round(sh * scale);
  const work = document.createElement('canvas');
  work.width = pw; work.height = ph;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (facing === 'user') { wctx.translate(pw, 0); wctx.scale(-1, 1); }
  wctx.drawImage(v, sx, sy, sw, sh, 0, 0, pw, ph);
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  applyFilter(wctx, pw, ph, currentFilter);
  return work;
}

function fitText(ctx, text, maxW) {
  let t = text;
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 3 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** Pasang bingkai (polaroid atau polos) beserta kata di bingkai bila ada. */
function composePhoto(work, takenAt, caption, quality = 0.86) {
  const e = info.event, pw = work.width, ph = work.height;
  const stamp = new Date(takenAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const who = info.me ? info.me.name : '';
  const out = document.createElement('canvas');
  if (e.frame !== 'polaroid') {
    out.width = pw; out.height = ph;
    const ctx = out.getContext('2d');
    ctx.drawImage(work, 0, 0);
    if (caption) {
      // Foto polos: kata ditulis di bagian bawah foto dengan bayangan lembut.
      const g = ctx.createLinearGradient(0, ph * 0.7, 0, ph);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = g; ctx.fillRect(0, ph * 0.7, pw, ph * 0.3);
      ctx.font = `600 ${Math.round(Math.min(pw, ph) * 0.07)}px Caveat, cursive`;
      ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(fitText(ctx, caption, pw * 0.9), pw * 0.05, ph - Math.min(pw, ph) * 0.06);
    }
    return { canvas: out, data: out.toDataURL('image/jpeg', quality) };
  }
  const side = Math.round(pw * 0.06), bottom = Math.round(pw * 0.24);
  out.width = pw + side * 2; out.height = ph + side + bottom;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#FBFBF8'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(work, side, side);
  ctx.textBaseline = 'middle';
  // Baris besar: kata dari peserta, atau nama acara bila tidak ada kata.
  ctx.fillStyle = '#2B2B2B';
  ctx.font = `600 ${Math.round(pw * 0.07)}px Caveat, cursive`;
  ctx.fillText(fitText(ctx, caption || e.name, pw), side, ph + side + bottom * 0.42);
  // Baris kecil: (nama acara ·) tanggal · nama pemotret.
  ctx.font = `600 ${Math.round(pw * 0.038)}px Caveat, cursive`;
  ctx.fillStyle = '#6A6A6A';
  const tail = `${stamp} · ${who}`;
  const small = caption ? `${fitText(ctx, e.name, pw * 0.5)} · ${tail}` : tail;
  ctx.fillText(fitText(ctx, small, pw), side, ph + side + bottom * 0.72);
  return { canvas: out, data: out.toDataURL('image/jpeg', quality) };
}

/* ---------- Lembar "Tulis sesuatu di bingkai" ---------- */
// Mengembalikan teks (bisa kosong) setelah peserta menekan Simpan/Lewati.
function askCaption(work, takenAt) {
  return new Promise((resolve) => {
    const sheet = $('#cap-sheet'), input = $('#cap-text');
    const presets = info.event.captionPresets || [];
    $('#cap-presets').innerHTML = presets.map((p) => `<button type="button" data-p="${esc(p)}">${esc(p)}</button>`).join('');
    input.value = '';
    let timer = 0;
    const preview = () => {
      const t = input.value.trim();
      $('#cap-count').textContent = `${input.value.length}/${CAPTION_MAX}`;
      const prob = captionProblem(t);
      showMsg($('#cap-err'), prob);
      $('#cap-save').disabled = !!prob;
      clearTimeout(timer);
      timer = setTimeout(() => { $('#cap-preview').src = composePhoto(work, takenAt, prob ? '' : t, 0.7).data; }, 120);
    };
    const done = (text) => {
      sheet.classList.add('hidden');
      input.removeEventListener('input', preview);
      $('#cap-presets').onclick = null; $('#cap-save').onclick = null; $('#cap-skip').onclick = null; input.onkeydown = null;
      resolve(text);
    };
    input.addEventListener('input', preview);
    $('#cap-presets').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { input.value = b.dataset.p.slice(0, CAPTION_MAX); preview(); } };
    $('#cap-save').onclick = () => { const t = input.value.replace(/\s+/g, ' ').trim(); if (!captionProblem(t)) done(t); };
    $('#cap-skip').onclick = () => done('');
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#cap-save').click(); } };
    sheet.classList.remove('hidden');
    preview();
  });
}

async function makeThumb(full) {
  const src = full.canvas;
  const k = Math.min(1, 360 / Math.max(src.width, src.height)); // kecil agar muat di cache server (±100 KB)
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

/* ---------- Kirim antrean (coba ulang otomatis) ---------- */
async function refreshPending() { pendingCount = (await Queue.list(slug)).length; updateQueueNote(); }

async function sendQueue() {
  if (sending) return;
  sending = true;
  let delay = 4000;
  try {
    for (;;) {
      const items = await Queue.list(slug);
      pendingCount = items.length; updateQueueNote(); updateCounter();
      if (!items.length) break;
      const it = items[0];
      try {
        const r = await api('upload', { slug, pt: PT.get(slug), image: it.image, thumb: it.thumb, filter: it.filter, takenAt: it.takenAt, caption: it.caption || '' });
        await Queue.remove(it.id);
        if (it.id === lastQueueId) { lastServerId = r.id; store.set(LAST_ID_KEY, r.id); }
        if (r.quota) quota = r.quota; else quota.left = r.shotsLeft;
        delay = 4000;
        toast('Foto tersimpan di album');
      } catch (err) {
        if (err.retry) {
          updateQueueNote(true);
          await new Promise((res) => setTimeout(res, delay));
          delay = Math.min(delay * 2, 60000);
          continue;
        }
        // Ditolak server (jatah habis, acara selesai, dll.): tidak dicoba ulang.
        await Queue.remove(it.id);
        toast(err.message, 4000);
        if (err.code === 'quota') { quota.left = 0; if (err.resetAt) quota.resetAt = err.resetAt; }
        if (err.code === 'need_join') { PT.clear(slug); }
      }
    }
  } finally {
    sending = false;
    updateQueueNote(); updateCounter();
  }
}

function updateQueueNote(waiting = false) {
  const n = pendingCount;
  $('#queue-note').textContent = !n ? '' : waiting
    ? `Sinyal lemah atau server sibuk. ${n} foto menunggu dikirim ulang otomatis.`
    : `Mengirim ${n} foto…`;
}

document.addEventListener('click', (e) => { if (e.target.closest('[data-fb]')) Feedback.open({ slug, page: 'kamera' }); });

init();
